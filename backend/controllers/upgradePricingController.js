const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');

const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

// 1. Calculate personalized upgrade details for a student
exports.calculateUpgrade = async (req, res) => {
    try {
        const studentId = req.user?.userId || req.user?.id;
        if (!studentId) {
            return res.status(401).json({ error: "Unauthorized. Student not found." });
        }

        const parsedStudentId = parseInt(studentId);

        // Fetch all successful and post-pay active payments for this student
        const studentPayments = await prisma.payment.findMany({
            where: {
                studentId: parsedStudentId,
                status: { in: [1, 4] }
            },
            include: {
                batch: true,
                business: true
            }
        });

        // Find their upgraded subjects
        const upgradedSubjectIds = new Set();
        studentPayments.forEach(p => {
            if (p.subjects) {
                try {
                    const subs = JSON.parse(p.subjects);
                    if (Array.isArray(subs)) {
                        subs.forEach(id => {
                            const parsedId = parseInt(id);
                            if (p.payment_type === 2 || p.payment_type === 3) {
                                upgradedSubjectIds.add(parsedId);
                            }
                        });
                    }
                } catch (e) {}
            }
        });

        // Find the active batch from the monthly payments
        const monthlyPayments = studentPayments.filter(p => p.payment_type === 1);
        
        // Group them to find unique active monthly batches
        const activeBatchesMap = {};
        monthlyPayments.forEach(p => {
            if (p.batchId && p.businessId) {
                activeBatchesMap[p.batchId] = {
                    batchId: p.batchId,
                    businessId: p.businessId,
                    batchName: p.batch?.name || `Batch ${p.batchId}`,
                    businessName: p.business?.name || `Business ${p.businessId}`
                };
            }
        });
        const activeBatchesList = Object.values(activeBatchesMap);

        if (activeBatchesList.length === 0) {
            return res.status(200).json({
                eligible: false,
                reason: "Active batch or business not found in monthly payments.",
                subjectCount: 0
            });
        }

        const batchesData = [];

        for (const selectedBatchInfo of activeBatchesList) {
            const batchId = selectedBatchInfo.batchId;
            const businessId = selectedBatchInfo.businessId;

            const batchMonthlyPayments = studentPayments.filter(p => p.payment_type === 1 && p.batchId === batchId);
            batchMonthlyPayments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            const activeMonthly = batchMonthlyPayments[0] || null;

            // Check business-specific special offer visibility toggle in AppSetting
            const bizToggle = await prisma.appSetting.findUnique({ where: { key: `SHOW_UPGRADE_OFFER_BIZ_${businessId}` } });
            let showUpgradeOffer = true;
            if (bizToggle) {
                showUpgradeOffer = bizToggle.value === 'true';
            } else {
                // Fallback to global toggle
                const globalToggle = await prisma.appSetting.findUnique({ where: { key: 'SHOW_UPGRADE_OFFER' } });
                showUpgradeOffer = globalToggle ? globalToggle.value === 'true' : true;
            }

            if (!showUpgradeOffer) {
                continue; // Skip this business
            }

            // Fetch all courses in this batch
            const allBatchCourses = await prisma.course.findMany({
                where: {
                    group: {
                        batchId: batchId
                    }
                },
                include: { group: true }
            });

            // Extract the monthly subjects the student is currently enrolled in
            let enrolledMonthlySubjectIds = [];
            batchMonthlyPayments.forEach(payment => {
                if (payment.subjects) {
                    try {
                        const parsed = JSON.parse(payment.subjects).map(id => parseInt(id));
                        parsed.forEach(id => {
                            if (!enrolledMonthlySubjectIds.includes(id)) {
                                enrolledMonthlySubjectIds.push(id);
                            }
                        });
                    } catch (e) {}
                }
            });

            // Eligible subjects are ONLY the ones they are already enrolled in, mapped to their FULL course variants
            const eligibleUpgradeSubjectIdsSet = new Set();
            enrolledMonthlySubjectIds.forEach(id => {
                const paidCourse = allBatchCourses.find(c => c.id === id);
                if (paidCourse) {
                    const paidClassType = parseInt(paidCourse.courseType || paidCourse.group?.classType || 1, 10);
                    const fullCourse = allBatchCourses.find(c => {
                        const cClassType = parseInt(c.courseType || c.group?.classType || 1, 10);
                        return (c.name || '').trim().toLowerCase() === (paidCourse.name || '').trim().toLowerCase() && 
                               c.price > 5000 &&
                               cClassType === paidClassType; // Strictly isolate Theory (1) vs Paper (2)
                    });
                    if (fullCourse && !upgradedSubjectIds.has(fullCourse.id)) {
                        eligibleUpgradeSubjectIdsSet.add(fullCourse.id);
                    } else if (!fullCourse && !upgradedSubjectIds.has(paidCourse.id)) {
                        eligibleUpgradeSubjectIdsSet.add(paidCourse.id);
                    }
                }
            });

            const eligibleUpgradeSubjectIds = Array.from(eligibleUpgradeSubjectIdsSet);

            if (eligibleUpgradeSubjectIds.length === 0) {
                continue; // Skip if all upgraded
            }

            // 1. Enforce 3-Month maximum monthly enrollment limit for Full Upgrade
            // Option 1: 1 month paid -> Upgrading to Full starting from 2nd month
            // Option 2: 2 months paid -> Upgrading to Full starting from 3rd month
            // Option 3: 3 months paid -> Upgrading to Full starting from 4th month (Final Chance)
            // Students who paid 4 or more months monthly are strictly ineligible for full upgrade.
            const paidMonthsCount = Math.max(
                batchMonthlyPayments.length,
                ...batchMonthlyPayments.map(p => p.installment_no || 1)
            );

            if (paidMonthsCount > 3) {
                // Ineligible for upgrade: only up to 3 months of monthly enrollment can upgrade to full
                continue;
            }

            const activeOption = Math.min(3, Math.max(1, paidMonthsCount));

            // 2. Check if there's already an upgrade slip pending approval (double-upload prevention)
            const pendingUpgradePayment = await prisma.payment.findFirst({
                where: {
                    studentId: parsedStudentId,
                    batchId: batchId,
                    status: 0,
                    OR: [
                        { remark: { contains: "[UPGRADE]:" } },
                        { payment_type: { in: [2, 3] } }
                    ]
                }
            });

            // Fetch the details of the eligible subjects (Courses)
            const subjects = await prisma.course.findMany({
                where: {
                    id: { in: eligibleUpgradeSubjectIds }
                },
                include: { group: true }
            });

            // Fetch all upgrade pricing records for this batch
            const upgradeConfigs = await prisma.upgradePricing.findMany({
                where: {
                    batchId: batchId
                }
            });

            // Fetch the rich config from AppSetting
            const richConfigRec = await prisma.appSetting.findUnique({
                where: { key: `UPGRADE_RICH_CONFIG_BATCH_${batchId}` }
            });
            const richConfig = richConfigRec ? JSON.parse(richConfigRec.value) : null;

            // Calculate Full Upgrade target price
            let targetFullAmount = 0;
            const subjectDetails = [];

            // Build bundle discounts map
            const bundleDiscountsMap = {};
            const allBundleConfigs = upgradeConfigs.filter(c => c.planType === 'BUNDLE_DISCOUNT');
            allBundleConfigs.forEach(c => {
                bundleDiscountsMap[c.subjectCount] = c.amount;
            });

            const batchCoursesMap = {};
            allBatchCourses.forEach(c => {
                batchCoursesMap[c.id] = c;
            });

            subjects.forEach(sub => {
                let subFullTarget = null;

                // Priority 1: Check richConfig.optionPrices for activeOption
                if (richConfig?.optionPrices) {
                    const courseOptPrices = richConfig.optionPrices[sub.id] || richConfig.optionPrices[String(sub.id)];
                    if (courseOptPrices && courseOptPrices[activeOption] !== undefined && courseOptPrices[activeOption] !== null && courseOptPrices[activeOption] !== '') {
                        const parsed = parseFloat(courseOptPrices[activeOption]);
                        if (!isNaN(parsed) && parsed > 0) {
                            subFullTarget = parsed;
                        }
                    }
                }

                // Priority 2: Check UpgradePricing table for planType: 'FULL' and installmentNum === activeOption
                if (subFullTarget === null) {
                    const customFullOpt = upgradeConfigs.find(c => {
                        if (c.planType !== 'FULL') return false;
                        if (c.installmentNum !== activeOption) return false;
                        if (c.courseId === sub.id) return true;
                        if (c.courseId) {
                            const confCourse = batchCoursesMap[c.courseId];
                            if (confCourse) {
                                return confCourse.name === sub.name || (confCourse.code && confCourse.code === sub.code);
                            }
                        }
                        return false;
                    });
                    if (customFullOpt) {
                        subFullTarget = customFullOpt.amount;
                    }
                }

                // Priority 3: Fallback to general/legacy FULL config (installmentNum === null or 1)
                if (subFullTarget === null) {
                    const legacyFull = upgradeConfigs.find(c => {
                        if (c.planType !== 'FULL') return false;
                        if (c.courseId === sub.id) return true;
                        if (c.courseId) {
                            const confCourse = batchCoursesMap[c.courseId];
                            if (confCourse) {
                                return confCourse.name === sub.name || (confCourse.code && confCourse.code === sub.code);
                            }
                        }
                        return false;
                    });
                    if (legacyFull) {
                        subFullTarget = legacyFull.amount;
                    }
                }

                // Priority 4: Fallback to course base price
                if (subFullTarget === null) {
                    subFullTarget = sub.price || 34500;
                }

                const customInsts = upgradeConfigs.filter(c => {
                    if (c.planType !== 'INSTALLMENT') return false;
                    if (c.courseId === sub.id) return true;
                    if (c.courseId) {
                        const confCourse = batchCoursesMap[c.courseId];
                        if (confCourse) {
                            return confCourse.name === sub.name || (confCourse.code && confCourse.code === sub.code);
                        }
                    }
                    return false;
                });

                let subInstSteps = [];
                if (customInsts.length > 0) {
                    subInstSteps = customInsts
                        .sort((a, b) => (a.installmentNum || 1) - (b.installmentNum || 1))
                        .map(c => ({
                            installmentNum: c.installmentNum,
                            amount: c.amount
                        }));
                } else {
                    subInstSteps = [
                        { installmentNum: 1, amount: Math.round(subFullTarget * 0.55) },
                        { installmentNum: 2, amount: Math.round(subFullTarget * 0.45) }
                    ];
                }

                let lecturerImage = null;
                if (sub.groupPrices) {
                    try {
                        const parsed = JSON.parse(sub.groupPrices);
                        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].lecturerImage) {
                            lecturerImage = parsed[0].lecturerImage;
                        }
                    } catch (e) {}
                }

                targetFullAmount += subFullTarget;
                subjectDetails.push({
                    id: sub.id,
                    name: sub.name,
                    code: sub.code,
                    basePrice: sub.price,
                    lecturerName: sub.lecturerName || 'TBA',
                    lecturerImage: lecturerImage,
                    upgradeFullTarget: subFullTarget,
                    installmentSteps: subInstSteps
                });
            });

            // Apply Batch-Level Bundle Discount dynamically
            let bundleDiscount = 0;
            if (richConfig && richConfig.enableBundle) {
                const batchSelectedSubjects = eligibleUpgradeSubjectIds;
                const batchSelectedCount = batchSelectedSubjects.length;
                const bundleSubIds = (richConfig.bundleSubjects || []).map(x => parseInt(x));
                const allSelectedAreEligible = batchSelectedSubjects.every(id => bundleSubIds.includes(id));
                if (allSelectedAreEligible) {
                    if (batchSelectedCount === 2 && richConfig.bundle2Price > 0) {
                        bundleDiscount = Math.max(0, targetFullAmount - richConfig.bundle2Price);
                    } else if (batchSelectedCount === 3 && richConfig.bundle3Price > 0) {
                        bundleDiscount = Math.max(0, targetFullAmount - richConfig.bundle3Price);
                    }
                }
            }
            if (bundleDiscount === 0) {
                const bundleDiscountConfig = upgradeConfigs.find(c => c.planType === 'BUNDLE_DISCOUNT' && c.subjectCount === eligibleUpgradeSubjectIds.length);
                bundleDiscount = bundleDiscountConfig ? bundleDiscountConfig.amount : 0;
            }
            const finalUpgradeTargetAmount = Math.max(0, targetFullAmount - bundleDiscount);

            // Sum monthly payments paid using exact Credit-by-Subject Algorithm
            const paidMonthlyPerSubject = {};
            eligibleUpgradeSubjectIds.forEach(id => {
                paidMonthlyPerSubject[id] = 0;
            });

            batchMonthlyPayments.forEach(p => {
                if (p.subjects) {
                    try {
                        const subs = JSON.parse(p.subjects).map(id => parseInt(id));
                        if (subs.length > 0) {
                            const splitAmount = (p.amount || 0) / subs.length;
                            subs.forEach(id => {
                                const paidCourse = allBatchCourses.find(c => c.id === id);
                                if (paidCourse) {
                                    const matchingEligibleCourse = subjects.find(c => (c.name || '').trim().toLowerCase() === (paidCourse.name || '').trim().toLowerCase());
                                    if (matchingEligibleCourse) {
                                        // Skip monthly deduction if custom FULL upgrade price is set for this subject in the batch
                                        const hasCustomFull = (richConfig?.optionPrices && (richConfig.optionPrices[matchingEligibleCourse.id] || richConfig.optionPrices[String(matchingEligibleCourse.id)])) ||
                                            upgradeConfigs.some(c => 
                                                c.planType === 'FULL' && 
                                                (c.courseId === matchingEligibleCourse.id || 
                                                 (c.courseId && batchCoursesMap[c.courseId] && (batchCoursesMap[c.courseId].name === matchingEligibleCourse.name || batchCoursesMap[c.courseId].code === matchingEligibleCourse.code)))
                                            );
                                        if (!hasCustomFull) {
                                            paidMonthlyPerSubject[matchingEligibleCourse.id] = (paidMonthlyPerSubject[matchingEligibleCourse.id] || 0) + splitAmount;
                                        }
                                    }
                                }
                            });
                        }
                    } catch (e) {}
                }
            });

            const totalPaidMonthly = Object.values(paidMonthlyPerSubject).reduce((sum, val) => sum + val, 0);
            const upgradeFullBalance = Math.max(0, finalUpgradeTargetAmount - totalPaidMonthly);

            // Combined Installment Steps
            const combinedInstallmentsMap = {};
            subjectDetails.forEach(sub => {
                sub.installmentSteps.forEach(step => {
                    if (!combinedInstallmentsMap[step.installmentNum]) {
                        combinedInstallmentsMap[step.installmentNum] = 0;
                    }
                    combinedInstallmentsMap[step.installmentNum] += step.amount;
                });
            });

            let installmentOptions = Object.keys(combinedInstallmentsMap)
                .sort((a, b) => parseInt(a) - parseInt(b))
                .map(num => ({
                    installmentNum: parseInt(num),
                    amount: combinedInstallmentsMap[num]
                }));

            if (installmentOptions.length > 0 && bundleDiscount > 0) {
                installmentOptions[0].amount = Math.max(0, installmentOptions[0].amount - bundleDiscount);
            }



            // Determine target Full Payment group (type: 2) for the upgraded subjects
            const targetClassType = subjects.some(s => parseInt(s.courseType || s.group?.classType || 1, 10) === 2) ? 2 : 1;

            // 1. Check if eligible full courses have a groupId pointing to a Type 2 group matching classType
            const fullCourseGroup = subjects.find(s => s.group?.type === 2 && parseInt(s.group?.classType || 1, 10) === targetClassType);
            let targetGroupId = fullCourseGroup?.groupId || null;

            // 2. Lookup the Type 2 (Full Payment) group for this batch matching targetClassType
            if (!targetGroupId) {
                const fullPaymentGroup = await prisma.group.findFirst({
                    where: {
                        batchId: batchId,
                        type: 2,
                        classType: targetClassType
                    }
                });
                if (fullPaymentGroup) {
                    targetGroupId = fullPaymentGroup.id;
                }
            }

            // 3. Fallback to course groupId, or active monthly only if nothing else matches
            if (!targetGroupId) {
                targetGroupId = subjects[0]?.groupId || activeMonthly?.groupId || null;
            }

            batchesData.push({
                batchId,
                businessId,
                batchName: selectedBatchInfo.batchName,
                businessName: selectedBatchInfo.businessName,
                groupId: targetGroupId,
                classType: targetClassType,
                pendingUpgrade: !!pendingUpgradePayment,
                upgradeOption: activeOption,
                upgradeOptionLabel: activeOption === 1 
                    ? 'Option 1 (Upgrading from Month 2)' 
                    : activeOption === 2 
                        ? 'Option 2 (Upgrading from Month 3)' 
                        : 'Option 3 (Upgrading from Month 4 - Final Opportunity)',
                paidMonthsCount: paidMonthsCount,
                subjectCount: eligibleUpgradeSubjectIds.length,
                totalPaidMonthly,
                paidMonthlyPerSubject,
                subjects: eligibleUpgradeSubjectIds,
                subjectDetails,
                bundleDiscount,
                bundleDiscountsMap,
                fullUpgrade: {
                    targetAmount: finalUpgradeTargetAmount,
                    balanceToPay: upgradeFullBalance,
                    savingsAmount: Math.max(0, (eligibleUpgradeSubjectIds.length * 10000 * 12) - finalUpgradeTargetAmount)
                },
                installmentOptions,
                richConfig
            });
        }

        const isAnyEligible = batchesData.length > 0;
        const isAnyPending = batchesData.some(b => b.pendingUpgrade);

        res.status(200).json(safeJson({
            eligible: isAnyEligible && !isAnyPending,
            pendingUpgrade: isAnyPending,
            multipleBatches: batchesData.length > 1,
            batches: batchesData,
            alreadyPaidSubjects: Array.from(upgradedSubjectIds)
        }));

    } catch (error) {
        console.error("Error in calculateUpgrade:", error);
        res.status(500).json({ error: "Failed to calculate student upgrade details." });
    }
};



// 2. Get all configured upgrade prices for a batch
exports.getAdminPrices = async (req, res) => {
    try {
        const { batchId } = req.query;
        if (!batchId) {
            return res.status(400).json({ error: "Batch ID is required." });
        }
        
        const parsedBatchId = parseInt(batchId);
        const prices = await prisma.upgradePricing.findMany({
            where: { batchId: parsedBatchId }
        });

        // Fetch the rich config from AppSetting
        const richConfigRec = await prisma.appSetting.findUnique({
            where: { key: `UPGRADE_RICH_CONFIG_BATCH_${parsedBatchId}` }
        });
        const richConfig = richConfigRec ? JSON.parse(richConfigRec.value) : null;
        
        res.status(200).json(safeJson({ prices, richConfig }));
    } catch (error) {
        console.error("Error in getAdminPrices:", error);
        res.status(500).json({ error: "Failed to load upgrade prices." });
    }
};

// 3. Set custom upgrade prices in bulk for a batch
exports.setAdminPrices = async (req, res) => {
    try {
        const { batchId, pricingConfigs, richConfig } = req.body;

        if (!batchId) {
            return res.status(400).json({ error: "Batch ID is required." });
        }
        if (!Array.isArray(pricingConfigs)) {
            return res.status(400).json({ error: "Invalid pricing configuration format." });
        }

        const parsedBatchId = parseInt(batchId);

        // Run sequential deletion and creation inside a transaction
        await prisma.$transaction(async (tx) => {
            // Delete all existing pricing entries for this batch
            await tx.upgradePricing.deleteMany({
                where: { batchId: parsedBatchId }
            });

            // Create new configurations if present
            if (pricingConfigs.length > 0) {
                await tx.upgradePricing.createMany({
                    data: pricingConfigs.map(config => ({
                        batchId: parsedBatchId,
                        courseId: config.courseId ? parseInt(config.courseId) : null,
                        planType: config.planType,
                        subjectCount: config.subjectCount ? parseInt(config.subjectCount) : null,
                        installmentNum: config.installmentNum ? parseInt(config.installmentNum) : null,
                        amount: parseFloat(config.amount) || 0
                    }))
                });
            }
        });

        // Save the rich config in AppSetting
        if (richConfig) {
            await prisma.appSetting.upsert({
                where: { key: `UPGRADE_RICH_CONFIG_BATCH_${parsedBatchId}` },
                update: { value: JSON.stringify(richConfig) },
                create: { key: `UPGRADE_RICH_CONFIG_BATCH_${parsedBatchId}`, value: JSON.stringify(richConfig) }
            });
        }

        res.status(200).json({ message: "Upgrade pricing configurations updated successfully!" });
    } catch (error) {
        console.error("Error in setAdminPrices:", error);
        res.status(500).json({ error: "Failed to update upgrade pricing configurations." });
    }
};

// 4. Get show/hide special offer dashboard widget setting
exports.getUpgradeOfferToggle = async (req, res) => {
    try {
        const { businessId } = req.query;
        let key = 'SHOW_UPGRADE_OFFER';
        if (businessId && businessId !== 'undefined' && businessId !== 'null') {
            key = `SHOW_UPGRADE_OFFER_BIZ_${businessId}`;
        }

        const setting = await prisma.appSetting.findUnique({ where: { key } });
        
        let showUpgradeOffer = true;
        if (setting) {
            showUpgradeOffer = setting.value === 'true';
        } else if (businessId && businessId !== 'undefined' && businessId !== 'null') {
            // Fallback to global setting if business-specific setting not set yet
            const globalSetting = await prisma.appSetting.findUnique({ where: { key: 'SHOW_UPGRADE_OFFER' } });
            showUpgradeOffer = globalSetting ? globalSetting.value === 'true' : true;
        }

        res.status(200).json({ showUpgradeOffer });
    } catch (error) {
        console.error("Error getting upgrade toggle setting:", error);
        res.status(500).json({ error: "Failed to load toggle status." });
    }
};

// 5. Set show/hide special offer dashboard widget setting
exports.setUpgradeOfferToggle = async (req, res) => {
    try {
        const { showUpgradeOffer, businessId } = req.body;
        const valStr = showUpgradeOffer ? 'true' : 'false';
        
        let key = 'SHOW_UPGRADE_OFFER';
        if (businessId && businessId !== 'undefined' && businessId !== 'null') {
            key = `SHOW_UPGRADE_OFFER_BIZ_${businessId}`;
        }

        await prisma.appSetting.upsert({
            where: { key },
            update: { value: valStr },
            create: { key, value: valStr }
        });
        res.status(200).json({ message: "Upgrade Offer Dashboard Visibility Updated!" });
    } catch (error) {
        console.error("Error setting upgrade toggle setting:", error);
        res.status(500).json({ error: "Failed to update toggle status." });
    }
};

// 6. Handle single image upload for special upgrade widget
exports.uploadBanner = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded." });
        }
        res.status(200).json({ filename: req.file.filename });
    } catch (error) {
        console.error("Error in uploadBanner:", error);
        res.status(500).json({ error: "Failed to upload banner image." });
    }
};
