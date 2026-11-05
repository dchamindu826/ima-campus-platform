const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { resolveInstallmentStepRange } = require('../utils/installmentHelper');

// Helper function to handle BigInt serialization
const safeJson = (data) => {
    return JSON.parse(JSON.stringify(data, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
    ));
};

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const SINHALA_MONTH_MAP = {
    'ජනවාරි': 'January', 'පෙබරවාරි': 'February', 'මාර්තු': 'March', 'අප්‍රේල්': 'April',
    'මැයි': 'May', 'ජූනි': 'June', 'ජූලි': 'July', 'අගෝස්තු': 'August',
    'සැප්තැම්බර්': 'September', 'ඔක්තෝම්බර්': 'October', 'නොවැම්බර්': 'November', 'දෙසැම්බර්': 'December'
};

const parseMonthName = (str) => {
    if (!str) return null;
    const s = String(str).trim();
    for (const [sin, eng] of Object.entries(SINHALA_MONTH_MAP)) {
        if (s.includes(sin)) return eng;
    }
    const lower = s.toLowerCase();
    for (const m of MONTH_NAMES) {
        if (lower.includes(m.toLowerCase())) return m;
    }
    const shortPrefixes = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    for (let i = 0; i < shortPrefixes.length; i++) {
        if (lower.includes(shortPrefixes[i])) return MONTH_NAMES[i];
    }
    return null;
};

const getMonthSpan = (startStr, endStr) => {
    const start = parseMonthName(startStr);
    const end = parseMonthName(endStr);
    if (!start || !end) return [];
    const sIdx = MONTH_NAMES.indexOf(start);
    const eIdx = MONTH_NAMES.indexOf(end);
    if (sIdx === -1 || eIdx === -1) return [];
    const span = [];
    let curr = sIdx;
    while (true) {
        span.push(MONTH_NAMES[curr]);
        if (curr === eIdx) break;
        curr = (curr + 1) % 12;
    }
    return span;
};

const ensureBatchMonthlyGroups = async (batchId) => {
    try {
        const batch = await prisma.batch.findUnique({
            where: { id: batchId }
        });
        if (!batch) return;

        const courses = await prisma.course.findMany({
            where: { group: { batchId: batchId } }
        });
        const groups = await prisma.group.findMany({
            where: { batchId: batchId }
        });

        const theoryCourses = courses.filter(c => (c.courseType || 1) === 1);
        const paperCourses = courses.filter(c => c.courseType === 2);

        const checkAndCreateGroups = async (courseList, classType) => {
            if (courseList.length === 0) return;
            const existingGroups = groups.filter(g => (g.classType || 1) === classType && !g.name.toLowerCase().includes('full'));
            const maxOrder = existingGroups.reduce((max, g) => Math.max(max, g.itemOrder || 0), 0);

            let orderCounter = maxOrder + 1;
            for (const c of courseList) {
                if (!c.startMonth || !c.endMonth) continue;
                const span = getMonthSpan(c.startMonth, c.endMonth);
                for (const mName of span) {
                    const exists = existingGroups.some(g => parseMonthName(g.name) === mName);
                    if (!exists) {
                        const newGrp = await prisma.group.create({
                            data: {
                                name: `Monthly Payment - ${mName}`,
                                batchId: batchId,
                                classType: classType,
                                itemOrder: orderCounter++
                            }
                        });
                        existingGroups.push(newGrp);
                    }
                }
            }
        };

        await checkAndCreateGroups(theoryCourses, 1);
        await checkAndCreateGroups(paperCourses, 2);
    } catch (err) {
        console.error("ensureBatchMonthlyGroups error:", err);
    }
};

exports.getFinanceMatrix = async (req, res) => {
    try {
        const { businessId, batchId, classType } = req.query;
        if (!batchId || batchId === 'null') return res.status(400).json({ error: "Batch ID is required" });
        const parsedBatchId = parseInt(batchId);
        const parsedClassType = (classType && classType !== 'ALL') ? parseInt(classType) : (classType === 'ALL' ? null : 1);

        const userId = req.user.userId || req.user.id;
        const userRole = req.user.role;
        const businessType = req.user.businessType;
        const userDepartment = req.user.department;
        
        const roleUpper = userRole ? userRole.toUpperCase().replace(/ /g, '_') : '';
        const isAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'ASS_MANAGER'].includes(roleUpper) || userDepartment === 'Finance';
        
        const batchObj = await prisma.batch.findUnique({ 
            where: { id: parsedBatchId },
            include: { business: true }
        });
        if (!batchObj) return res.status(404).json({ error: "Batch not found" });

        const isOLBusiness = batchObj.business && batchObj.business.name.toUpperCase().includes('O/L');
        const isCommerceBusiness = batchObj.business && (batchObj.business.name.toUpperCase().includes('COMMERCE') || batchObj.business.name.includes('වාණිජ'));

        if (!isAdmin) {
            const allBiz = await prisma.business.findMany();
            const myBizs = allBiz.filter(biz => {
                const isManagerOf = biz.head_manager_id === userId || biz.ass_manager_id === userId;
                const matchesBizType = businessType && (
                    String(biz.id) === String(businessType).trim() ||
                    biz.name.toLowerCase().trim() === String(businessType).toLowerCase().trim() ||
                    biz.name.toLowerCase().includes(String(businessType).toLowerCase().trim()) ||
                    String(businessType).toLowerCase().trim().includes(biz.name.toLowerCase().trim())
                );
                return isManagerOf || matchesBizType;
            });
            const myBizIds = myBizs.map(b => b.id);
            
            if (!myBizIds.includes(batchObj.businessId)) {
                return res.status(403).json({ error: "Access Denied. You are not allowed to view this batch's finance matrix." });
            }
        }

        // Auto-create missing monthly groups for courses in this batch
        await ensureBatchMonthlyGroups(parsedBatchId);

        // 1. Get Monthly Groups (Columns Headers)
        let groupWhere = { batchId: parsedBatchId };
        if (parsedClassType) {
            groupWhere.classType = parsedClassType;
        }

        const rawGroups = await prisma.group.findMany({
            where: groupWhere,
            orderBy: [{ itemOrder: 'asc' }, { id: 'asc' }],
            select: { id: true, name: true, classType: true, itemOrder: true }
        });
        const monthlyGroups = rawGroups
            .filter(g => !g.name.toLowerCase().includes('full payment') && !g.name.toLowerCase().includes('full'))
            .map(g => {
                if (!parsedClassType && parseInt(g.classType || 1) === 2) {
                    return { ...g, name: `${g.name} (Paper)` };
                }
                return g;
            });

        // 2. Get Courses
        let courseWhere = { group: { batchId: parsedBatchId } };
        if (parsedClassType) {
            courseWhere.OR = [
                { courseType: parsedClassType },
                { group: { classType: parsedClassType } }
            ];
        }

        const courses = await prisma.course.findMany({
            where: courseWhere,
            select: { id: true, name: true, price: true, code: true, activeMonths: true, startMonth: true, endMonth: true, courseType: true, groupId: true }
        });

        // Sort monthly groups chronologically based on batch intake start month
        let intakeStartMonth = null;
        for (const c of courses) {
            const parsed = parseMonthName(c.startMonth);
            if (parsed) {
                intakeStartMonth = parsed;
                break;
            }
        }
        if (!intakeStartMonth && monthlyGroups.length > 0) {
            intakeStartMonth = parseMonthName(monthlyGroups[0].name) || 'January';
        }
        const intakeStartIdx = intakeStartMonth ? MONTH_NAMES.indexOf(intakeStartMonth) : 0;

        const getMonthOffset = (name) => {
            const m = parseMonthName(name);
            if (!m) return 99;
            const idx = MONTH_NAMES.indexOf(m);
            return (idx - intakeStartIdx + 12) % 12;
        };

        monthlyGroups.sort((a, b) => {
            const offA = getMonthOffset(a.name);
            const offB = getMonthOffset(b.name);
            if (offA !== offB) return offA - offB;
            const ctA = parseInt(a.classType || 1);
            const ctB = parseInt(b.classType || 1);
            if (ctA !== ctB) return ctA - ctB;
            return (a.itemOrder || 0) - (b.itemOrder || 0);
        });

        const courseMap = {};
        const courseCodeMap = {};
        courses.forEach(c => {
            let normalizedSubName = c.name.trim().toUpperCase();
            if (!parsedClassType && (c.courseType === 2 || rawGroups.find(g => g.id === c.groupId)?.classType === 2)) {
                normalizedSubName += ' (PAPER)';
            }
            courseMap[c.id] = normalizedSubName;
            if (c.code) courseCodeMap[normalizedSubName] = c.code.trim();
        });
        const uniqueSubjectNames = [...new Set(Object.values(courseMap))];

        // Helper function to extract exact monthly groups a course spans in chronological order
        const getActiveMonthsForCourse = (course) => {
            if (!course) return monthlyGroups;
            const cType = parseInt(course.courseType || 1);
            const relevantGroups = monthlyGroups.filter(g => parseInt(g.classType || 1) === cType);
            const candidateGroups = relevantGroups.length > 0 ? relevantGroups : monthlyGroups;

            const startStr = course.startMonth;
            const endStr = course.endMonth;
            if (!startStr || !endStr) return candidateGroups;

            const span = getMonthSpan(startStr, endStr);
            if (span.length === 0) return candidateGroups;

            const matched = [];
            span.forEach(mName => {
                const found = candidateGroups.find(g => parseMonthName(g.name) === mName);
                if (found && !matched.some(m => m.id === found.id)) {
                    matched.push(found);
                }
            });

            return matched.length > 0 ? matched : candidateGroups;
        };

        // 3. Dynamic Month Extraction
        const subjectActiveMonthsMap = {};
        uniqueSubjectNames.forEach(subName => {
            const dbCourse = courses.find(c => {
                let name = c.name.trim().toUpperCase();
                if (!parsedClassType && (c.courseType === 2 || rawGroups.find(g => g.id === c.groupId)?.classType === 2)) {
                    name += ' (PAPER)';
                }
                return name === subName;
            });
            const activeM = getActiveMonthsForCourse(dbCourse);
            subjectActiveMonthsMap[subName] = activeM.map(g => g.id);
        });

        // 4. Get Payments
        let paymentWhere = { batchId: parsedBatchId, status: 1 };
        if (parsedClassType) {
            paymentWhere.OR = [
                { group: { classType: parsedClassType } },
                { groupId: { in: rawGroups.map(g => g.id) } }
            ];
        }

        const rawPayments = await prisma.payment.findMany({
            where: paymentWhere,
            include: { 
                student: { 
                    select: { 
                        id: true, 
                        firstName: true, 
                        lastName: true, 
                        phone: true, 
                        whatsapp: true, 
                        nic: true,
                        addressHouseNo: true,
                        addressStreet: true,
                        city: true,
                        district: true
                    } 
                },
                group: { select: { id: true, name: true, classType: true } },
                delivery: { select: { labelAddress: true } }
            },
            orderBy: { created_at: 'asc' }
        });

        // Filter payments to match class type precisely
        const payments = rawPayments.filter(p => {
            if (!parsedClassType) return true;
            const gClassType = p.group ? parseInt(p.group.classType || 1) : null;
            if (gClassType !== null && gClassType === parsedClassType) return true;

            try {
                const subIds = JSON.parse(p.subjects || '[]').map(id => typeof id === 'object' ? parseInt(id.id) : parseInt(id));
                const hasMatchingCourse = subIds.some(cid => {
                    const crs = courses.find(c => c.id === cid);
                    return crs && (crs.courseType === parsedClassType || (crs.groupId && rawGroups.some(rg => rg.id === crs.groupId && rg.classType === parsedClassType)));
                });
                if (hasMatchingCourse) return true;
            } catch (e) {}

            return false;
        });

        const installmentPlans = await prisma.installment.findMany({ where: { batchId: parsedBatchId } });

        let grandTotal = 0.0;
        const studentMap = {};

        const isAdjustedPayment = (p) => {
            const isExcess = p.excessAmount && parseFloat(p.excessAmount) > 0;
            const isArrears = p.arrearsAmount && parseFloat(p.arrearsAmount) > 0;
            const r = p.remark || '';
            const rLower = r.toLowerCase();

            const isInstitute = r.includes('[Institute Payment]') || rLower.includes('institute payment') || (p.method && p.method.toLowerCase().includes('institute'));

            // Explicit half card / discount keywords
            const isExplicitDiscount = Boolean(
                rLower.includes('half payment') ||
                rLower.includes('half paymnet') ||
                rLower.includes('half card') ||
                rLower.includes('halfcard') ||
                rLower.includes('halfpaymant') ||
                rLower.includes('discount') ||
                rLower.includes('boss approved') ||
                r.includes('Custom Breakdown')
            );

            // 🔥 INSTITUTE PAYMENT RULE:
            // Institute Payments are normal payments collected directly at the campus/institute.
            // They belong to Monthly (payment_type=1) or Full (payment_type=3) and must NOT be marked as Adjusted
            // unless they are explicitly flagged with a genuine discount/half-card approved remark.
            if (isInstitute && !isExplicitDiscount && !isExcess && !isArrears) {
                return false;
            }

            const hasKeyword = Boolean(
                isExcess ||
                isArrears ||
                isExplicitDiscount ||
                rLower.includes('wallet adjusted') ||
                rLower.includes('excess adjusted') ||
                rLower.includes('arrears adjusted')
            );
            if (hasKeyword) return true;

            // Check if custom prices are actually discounted below catalog course price
            if (r.includes('[CUSTOM_PRICES:')) {
                try {
                    const match = r.match(/\[CUSTOM_PRICES:({.*?})\]/);
                    if (match) {
                        const customMap = JSON.parse(match[1]);
                        for (const [cIdStr, cPrice] of Object.entries(customMap)) {
                            const cId = parseInt(cIdStr);
                            const course = courses.find(c => c.id === cId);
                            if (course && course.price > 0 && parseFloat(cPrice) < parseFloat(course.price)) {
                                return true;
                            }
                        }
                    }
                } catch (e) {}
            }

            return false;
        };

        payments.forEach(p => {
            if (!p.studentId || !p.student) return;
            const paidAmount = parseFloat(p.amount || 0);
            if (paidAmount <= 0) return;

            const isUpgrade = p.remark && (p.remark.includes('[UPGRADE]') || p.remark.includes('UPGRADE'));
            const isAdj = isAdjustedPayment(p);

            // Subject parsing first to ensure payment belongs to active subjects in this view
            let enrolledSubjectData = [];
            try {
                const subs = JSON.parse(p.subjects || '[]');
                
                // Parse custom overridden prices if they exist in payment remark
                let customPricesMap = {};
                let customPricesBySubName = {};
                if (p.remark) {
                    if (p.remark.includes('[CUSTOM_PRICES:')) {
                        try {
                            const match = p.remark.match(/\[CUSTOM_PRICES:({.*?})\]/);
                            if (match) {
                                const parsed = JSON.parse(match[1]);
                                Object.entries(parsed).forEach(([k, v]) => {
                                    const num = parseFloat(v);
                                    if (!isNaN(num)) {
                                        customPricesMap[String(k)] = num;
                                        const matchedCourse = courses.find(c => String(c.id) === String(k));
                                        if (matchedCourse) {
                                            customPricesBySubName[matchedCourse.name.trim().toUpperCase()] = num;
                                        }
                                    }
                                });
                            }
                        } catch (e) { }
                    }

                    const adminBreakdownMatch = p.remark.match(/(?:\[ADMIN\]:\s*)?Custom Breakdown:\s*\[(.*?)\]/i);
                    if (adminBreakdownMatch) {
                        const parts = adminBreakdownMatch[1].split('|');
                        parts.forEach(part => {
                            const [codeOrIdStr, amtStr] = part.split(':').map(s => s.trim());
                            if (codeOrIdStr && amtStr) {
                                const numAmt = parseFloat(amtStr.replace(/[^0-9.]/g, ''));
                                if (!isNaN(numAmt)) {
                                    customPricesMap[codeOrIdStr] = numAmt;
                                    const matchedCourses = courses.filter(c => 
                                        String(c.id) === codeOrIdStr || 
                                        (c.code && c.code.trim().toUpperCase() === codeOrIdStr.toUpperCase())
                                    );
                                    matchedCourses.forEach(mc => {
                                        customPricesMap[String(mc.id)] = numAmt;
                                        customPricesBySubName[mc.name.trim().toUpperCase()] = numAmt;
                                    });
                                }
                            }
                        });
                    }
                }

                subs.forEach(item => {
                    let cid = typeof item === 'object' ? parseInt(item.id) : parseInt(item);
                    let subName = cid ? courseMap[cid] : (typeof item === 'string' ? item.trim().toUpperCase() : null);
                    if (subName && uniqueSubjectNames.includes(subName) && !enrolledSubjectData.find(u => u.name === subName)) {
                        const dbCourse = courses.find(c => c.id === cid);
                        let price = dbCourse ? parseFloat(dbCourse.price || 0) : 0;
                        
                        // Apply custom override or special discount price
                        const strId = String(cid);
                        if (customPricesMap[strId] !== undefined) {
                            price = parseFloat(customPricesMap[strId]);
                        } else if (customPricesBySubName[subName] !== undefined) {
                            price = parseFloat(customPricesBySubName[subName]);
                        }

                        enrolledSubjectData.push({
                            name: subName,
                            price: price,
                            courseObj: dbCourse
                        });
                    }
                });
            } catch (e) { }

            if (enrolledSubjectData.length === 0) return;

            if (!studentMap[p.studentId]) {
                let nic = p.student.nic || '';
                let birthYear = nic.length === 12 ? nic.substring(0, 4) : (nic.length === 10 ? '19' + nic.substring(0, 2) : '-');

                let addressParts = [
                    p.student.addressHouseNo,
                    p.student.addressStreet,
                    p.student.city,
                    p.student.district
                ].map(s => s ? s.trim() : '').filter(Boolean);
                let fullAddress = addressParts.join(', ');
                if (!fullAddress && p.delivery?.labelAddress && p.delivery.labelAddress !== 'No Address Provided') {
                    fullAddress = p.delivery.labelAddress.trim();
                }

                studentMap[p.studentId] = {
                    id: p.studentId,
                    studentNo: `STU-${p.studentId}`,
                    studentName: `${p.student.firstName} ${p.student.lastName}`.trim(),
                    phone: p.student.phone || '',
                    whatsapp: p.student.whatsapp || '',
                    address: fullAddress || '-',
                    birthYear: birthYear,
                    paymentTypes: new Set(),
                    matrixValues: {},
                    totalPaid: 0.0,
                    isUpgradeStudent: false,
                    isAdjustedStudent: false
                };

                monthlyGroups.forEach(mg => {
                    studentMap[p.studentId].matrixValues[mg.id] = {};
                    uniqueSubjectNames.forEach(sub => {
                        studentMap[p.studentId].matrixValues[mg.id][sub] = { total: 0, Full: 0, Monthly: 0, Installment: 0, Upgrade: 0, Adjusted: 0 };
                    });
                });
            }

            const sData = studentMap[p.studentId];
            if ((!sData.address || sData.address === '-') && p.delivery?.labelAddress && p.delivery.labelAddress !== 'No Address Provided') {
                sData.address = p.delivery.labelAddress.trim();
            }
            if (isUpgrade) sData.isUpgradeStudent = true;
            if (isAdj) sData.isAdjustedStudent = true;
            const payType = parseInt(p.payment_type);
            sData.paymentTypes.add(payType === 3 ? 'Full' : (payType === 2 ? 'Installment' : 'Monthly'));
            sData.totalPaid += paidAmount;
            grandTotal += paidAmount;

            // =========================================================
            // 🔥 UNIVERSAL RATIO ENGINE (WITH ENGLISH ISOLATION) 🔥
            // =========================================================

            // 1. English subject eka isolate kireema (matches 'ENGLISH', 'GENERAL ENGLISH', etc., but NOT 'English Medium')
            let englishSub = null;
            let otherSubs = enrolledSubjectData;

            if (!isOLBusiness) {
                englishSub = enrolledSubjectData.find(s => s.name.toUpperCase().includes('ENGLISH') && !s.name.toUpperCase().includes('MEDIUM'));
                otherSubs = enrolledSubjectData.filter(s => !(s.name.toUpperCase().includes('ENGLISH') && !s.name.toUpperCase().includes('MEDIUM')));
            }

            let englishFund = 0;
            let othersTotalFund = paidAmount;

            if (payType === 2) {
                // 🔥 English is TOTALLY EXCLUDED from Installment calculations!
                // Entire installment amount belongs strictly to the core stream subjects.
                if (otherSubs.length === 0) {
                    englishFund = paidAmount;
                    othersTotalFund = 0;
                } else {
                    englishFund = 0;
                    othersTotalFund = paidAmount;
                }
            } else if (englishSub) {
                if (otherSubs.length === 0) {
                    englishFund = paidAmount;
                    othersTotalFund = 0;
                } else {
                    let cap = englishSub.price;
                    englishFund = Math.min(cap, paidAmount);
                    othersTotalFund = Math.max(0, paidAmount - englishFund);
                }
            }

            // Anith subjects wala combined base price
            let totalBaseCombinedPrice = otherSubs.reduce((acc, es) => acc + es.price, 0) || otherSubs.length;

            // Count approved monthly payments this student has in the current batch
            const studentMonthlyPayments = payments.filter(pm => pm.studentId === p.studentId && parseInt(pm.payment_type) === 1);
            const alreadyPaidMonthlyCount = studentMonthlyPayments.length;

            enrolledSubjectData.forEach(es => {
                const sub = es.name;
                const isEnglish = sub.toUpperCase().includes('ENGLISH') && !sub.toUpperCase().includes('MEDIUM');

                // 2. Fund Allocation
                let subjectAllocatedFund = 0;
                // Only treat as isolated English if we actually extracted it (i.e. not an O/L business)
                const isIsolatedEnglish = isEnglish && englishSub !== null;

                if (isIsolatedEnglish) {
                    // English is completely excluded from installment payments if core subjects are present
                    if (payType === 2 && otherSubs.length > 0) {
                        return;
                    }
                    subjectAllocatedFund = englishFund;
                } else { 
                    // Use price weight ratio for ALL payment types (MONTHLY, FULL, INSTALLMENT)
                    const weightRatio = totalBaseCombinedPrice > 0 ? (es.price / totalBaseCombinedPrice) : (1 / (otherSubs.length || 1));
                    subjectAllocatedFund = othersTotalFund * weightRatio;
                }

                // 3. Active Months walin bedeema
                const targetCourse = es.courseObj || courses.find(c => {
                    let name = c.name.trim().toUpperCase();
                    if (!parsedClassType && (c.courseType === 2 || rawGroups.find(g => g.id === c.groupId)?.classType === 2)) {
                        name += ' (PAPER)';
                    }
                    return name === sub;
                });

                let activeGroupIds = subjectActiveMonthsMap[sub] || (targetCourse ? getActiveMonthsForCourse(targetCourse).map(g => g.id) : monthlyGroups.map(g => g.id));
                if (!activeGroupIds || activeGroupIds.length === 0) {
                    activeGroupIds = monthlyGroups.map(g => g.id);
                }
                const numActive = activeGroupIds.length || 1;

                if (isIsolatedEnglish) {
                    if (payType === 1) { // MONTHLY for English
                        let targetMg = monthlyGroups.find(mg => mg.id === p.groupId);
                        let targetMgId = targetMg ? targetMg.id : (activeGroupIds.length > 0 ? activeGroupIds[0] : (monthlyGroups[0]?.id || null));
                        if (targetMgId && sData.matrixValues[targetMgId] && sData.matrixValues[targetMgId][sub]) {
                            if (isAdj) {
                                sData.matrixValues[targetMgId][sub].Adjusted = (sData.matrixValues[targetMgId][sub].Adjusted || 0) + subjectAllocatedFund;
                            } else {
                                sData.matrixValues[targetMgId][sub].Monthly += subjectAllocatedFund;
                            }
                            sData.matrixValues[targetMgId][sub].total += subjectAllocatedFund;
                        }
                    } else if (payType === 3) { // FULL for English
                        let lastPaidMonthlyIndex = -1;
                        studentMonthlyPayments.forEach(pm => {
                            const idx = activeGroupIds.indexOf(pm.groupId);
                            if (idx > lastPaidMonthlyIndex) {
                                lastPaidMonthlyIndex = idx;
                            }
                        });
                        const startIdx = (isUpgrade && lastPaidMonthlyIndex >= 0) ? Math.min(lastPaidMonthlyIndex + 1, Math.max(0, numActive - 1)) : 0;
                        const divisor = Math.max(1, numActive - startIdx);
                        const amountPerMonth = subjectAllocatedFund / divisor;

                        for (let i = startIdx; i < numActive; i++) {
                            const mgId = activeGroupIds[i];
                            if (mgId && sData.matrixValues[mgId] && sData.matrixValues[mgId][sub]) {
                                if (isAdj) {
                                    sData.matrixValues[mgId][sub].Adjusted = (sData.matrixValues[mgId][sub].Adjusted || 0) + amountPerMonth;
                                } else if (isUpgrade) {
                                    sData.matrixValues[mgId][sub].Upgrade = (sData.matrixValues[mgId][sub].Upgrade || 0) + amountPerMonth;
                                } else {
                                    sData.matrixValues[mgId][sub].Full += amountPerMonth;
                                }
                                sData.matrixValues[mgId][sub].total += amountPerMonth;
                            }
                        }
                    } else { // INSTALLMENT for English
                        const applicablePlans = installmentPlans.filter(pl => pl.subjectCount <= (otherSubs.length || 1)).sort((a, b) => b.subjectCount - a.subjectCount);
                        const plan = applicablePlans.length > 0 ? applicablePlans[0] : null;
                        const stepDetails = plan ? JSON.parse(plan.details) : [];
                        const totalPhases = stepDetails.length || 3;
                        const instNo = p.installment_no || 1;
                        const instIdx = instNo - 1;

                        const start_norm = Math.floor((instIdx * numActive) / totalPhases);
                        const end_norm = Math.floor(((instIdx + 1) * numActive) / totalPhases);
                        let start = start_norm;
                        let end = end_norm;
                        if (isUpgrade) {
                            start = Math.max(start, alreadyPaidMonthlyCount);
                            if (start > end) start = end;
                        }
                        if (start < 0) start = 0;
                        if (end > numActive) end = numActive;
                        if (start > end) start = end;

                        const monthsToCover = end - start;
                        const divisor = monthsToCover > 0 ? monthsToCover : Math.max(1, numActive);
                        const amountPerMonth = subjectAllocatedFund / divisor;
                        const actualStart = monthsToCover > 0 ? start : 0;
                        const actualEnd = monthsToCover > 0 ? end : numActive;

                        for (let i = actualStart; i < actualEnd; i++) {
                            const mgId = activeGroupIds[i];
                            if (mgId && sData.matrixValues[mgId] && sData.matrixValues[mgId][sub]) {
                                if (isAdj) {
                                    sData.matrixValues[mgId][sub].Adjusted = (sData.matrixValues[mgId][sub].Adjusted || 0) + amountPerMonth;
                                } else if (isUpgrade) {
                                    sData.matrixValues[mgId][sub].Upgrade = (sData.matrixValues[mgId][sub].Upgrade || 0) + amountPerMonth;
                                } else {
                                    sData.matrixValues[mgId][sub].Installment += amountPerMonth;
                                }
                                sData.matrixValues[mgId][sub].total += amountPerMonth;
                            }
                        }
                    }
                } else if (payType === 3) { // FULL PAYMENT
                    let lastPaidMonthlyIndex = -1;
                    studentMonthlyPayments.forEach(pm => {
                        const idx = activeGroupIds.indexOf(pm.groupId);
                        if (idx > lastPaidMonthlyIndex) {
                            lastPaidMonthlyIndex = idx;
                        }
                    });
                    
                    const startIdx = (isUpgrade && lastPaidMonthlyIndex >= 0) ? Math.min(lastPaidMonthlyIndex + 1, Math.max(0, numActive - 1)) : 0;
                    const divisor = Math.max(1, numActive - startIdx);
                    const amountPerMonth = subjectAllocatedFund / divisor;

                    for (let i = startIdx; i < numActive; i++) {
                        const mgId = activeGroupIds[i];
                        if (mgId && sData.matrixValues[mgId] && sData.matrixValues[mgId][sub]) {
                            if (isAdj) {
                                sData.matrixValues[mgId][sub].Adjusted = (sData.matrixValues[mgId][sub].Adjusted || 0) + amountPerMonth;
                            } else if (isUpgrade) {
                                sData.matrixValues[mgId][sub].Upgrade = (sData.matrixValues[mgId][sub].Upgrade || 0) + amountPerMonth;
                            } else {
                                sData.matrixValues[mgId][sub].Full += amountPerMonth;
                            }
                            sData.matrixValues[mgId][sub].total += amountPerMonth;
                        }
                    }
                } else if (payType === 1) { // MONTHLY
                    let targetMg = monthlyGroups.find(mg => mg.id === p.groupId);
                    let targetMgId = targetMg ? targetMg.id : (activeGroupIds.length > 0 ? activeGroupIds[0] : (monthlyGroups[0]?.id || null));
                    if (targetMgId && sData.matrixValues[targetMgId] && sData.matrixValues[targetMgId][sub]) {
                        if (isAdj) {
                            sData.matrixValues[targetMgId][sub].Adjusted = (sData.matrixValues[targetMgId][sub].Adjusted || 0) + subjectAllocatedFund;
                        } else {
                            sData.matrixValues[targetMgId][sub].Monthly += subjectAllocatedFund;
                        }
                        sData.matrixValues[targetMgId][sub].total += subjectAllocatedFund;
                    }
                } else { // INSTALLMENT
                    // Filter down to the correct subject count to avoid 2-phase plans for 3-subject students
                    const applicablePlans = installmentPlans.filter(pl => pl.subjectCount <= (otherSubs.length || 1)).sort((a, b) => b.subjectCount - a.subjectCount);
                    const plan = applicablePlans.length > 0 ? applicablePlans[0] : null;
                    let stepDetails = [];
                    if (plan && plan.details) {
                        try { stepDetails = JSON.parse(plan.details); } catch(e) {}
                    }
                    const instNo = p.installment_no || 1;
                    const instIdx = Math.max(0, instNo - 1);

                    const stepRange = resolveInstallmentStepRange(stepDetails, instIdx, isUpgrade, alreadyPaidMonthlyCount, numActive);
                    const start = stepRange.start;
                    const end = stepRange.end;
                    const monthsToCover = end - start;
                    const divisor = monthsToCover > 0 ? monthsToCover : Math.max(1, numActive);
                    const amountPerMonth = subjectAllocatedFund / divisor;
                    
                    const actualStart = monthsToCover > 0 ? start : 0;
                    const actualEnd = monthsToCover > 0 ? end : numActive;

                    for (let i = actualStart; i < actualEnd; i++) {
                        const mgId = activeGroupIds[i];
                        if (mgId && sData.matrixValues[mgId] && sData.matrixValues[mgId][sub]) {
                            if (isAdj) {
                                sData.matrixValues[mgId][sub].Adjusted = (sData.matrixValues[mgId][sub].Adjusted || 0) + amountPerMonth;
                            } else if (isUpgrade) {
                                sData.matrixValues[mgId][sub].Upgrade = (sData.matrixValues[mgId][sub].Upgrade || 0) + amountPerMonth;
                            } else {
                                sData.matrixValues[mgId][sub].Installment += amountPerMonth;
                            }
                            sData.matrixValues[mgId][sub].total += amountPerMonth;
                        }
                    }
                }
            });
        });

        // Hybrid, Upgrade, and Adjusted detection
        Object.values(studentMap).forEach(sData => {
            const baseType = sData.paymentTypes.size > 1 ? 'Hybrid' : (Array.from(sData.paymentTypes)[0] || 'Other');
            sData.originalType = baseType;
            if (sData.isAdjustedStudent) {
                sData.isAdjusted = true;
                sData.type = 'Adjusted';
            } else if (sData.isUpgradeStudent) {
                sData.type = 'Upgrade';
            } else {
                sData.type = baseType;
            }
            delete sData.paymentTypes;
            delete sData.isUpgradeStudent;
            delete sData.isAdjustedStudent;
        });

        const typeOrder = { 'Full': 1, 'Monthly': 2, 'Installment': 3, 'Upgrade': 4, 'Hybrid': 5, 'Adjusted': 6 };
        const sortedStudents = Object.values(studentMap).sort((a, b) => {
            const wA = typeOrder[a.type] || 99;
            const wB = typeOrder[b.type] || 99;
            if (wA !== wB) return wA - wB;
            return a.id - b.id; // secondary sort by ID
        });

        const allBatchGroups = await prisma.group.findMany({
            where: { batchId: parsedBatchId },
            select: { id: true, classType: true }
        });
        const hasTheory = allBatchGroups.some(g => (g.classType || 1) === 1);
        const hasPaper = allBatchGroups.some(g => g.classType === 2);

        res.status(200).json(safeJson({
            months: monthlyGroups,
            subjects: uniqueSubjectNames,
            students: sortedStudents,
            grandTotal: grandTotal,
            classType: classType || '1',
            availableClassTypes: {
                hasTheory,
                hasPaper
            }
        }));

    } catch (error) {
        console.error("Finance Matrix Error:", error);
        res.status(500).json({ error: "Failed to load matrix" });
    }
};

exports.getPaidCampaignDropMatrix = async (req, res) => {
    try {
        const { businessId, batchId, classType } = req.query;
        if (!batchId || batchId === 'null') return res.status(400).json({ error: "Batch ID is required" });
        const parsedBatchId = parseInt(batchId);
        const parsedClassType = (classType && classType !== 'ALL') ? parseInt(classType) : (classType === 'ALL' ? null : 1);

        const userRole = req.user.role;
        const roleUpper = userRole ? userRole.toUpperCase().replace(/ /g, '_') : '';
        const isAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'ASS_MANAGER'].includes(roleUpper);
        if (!isAdmin) {
             return res.status(403).json({ error: "Access Denied." });
        }

        // Auto-create missing monthly groups for courses in this batch
        await ensureBatchMonthlyGroups(parsedBatchId);

        // 1. Get Monthly Groups
        let groupWhere = { batchId: parsedBatchId };
        if (parsedClassType) groupWhere.classType = parsedClassType;
        const rawGroups = await prisma.group.findMany({
            where: groupWhere,
            orderBy: [{ itemOrder: 'asc' }, { id: 'asc' }],
            select: { id: true, name: true, classType: true, itemOrder: true }
        });
        const monthlyGroups = rawGroups
            .filter(g => !g.name.toLowerCase().includes('full payment') && !g.name.toLowerCase().includes('full'))
            .map(g => {
                if (!parsedClassType && parseInt(g.classType || 1) === 2) {
                    return { ...g, name: `${g.name} (Paper)` };
                }
                return g;
            });

        // 2. Get Courses
        let courseWhere = { group: { batchId: parsedBatchId } };
        if (parsedClassType) {
            courseWhere.OR = [
                { courseType: parsedClassType },
                { group: { classType: parsedClassType } }
            ];
        }
        const courses = await prisma.course.findMany({
            where: courseWhere,
            select: { id: true, name: true, code: true, startMonth: true, endMonth: true, courseType: true, groupId: true }
        });

        // Sort monthly groups chronologically based on batch intake start month
        let intakeStartMonth = null;
        for (const c of courses) {
            const parsed = parseMonthName(c.startMonth);
            if (parsed) {
                intakeStartMonth = parsed;
                break;
            }
        }
        if (!intakeStartMonth && monthlyGroups.length > 0) {
            intakeStartMonth = parseMonthName(monthlyGroups[0].name) || 'January';
        }
        const intakeStartIdx = intakeStartMonth ? MONTH_NAMES.indexOf(intakeStartMonth) : 0;

        const getMonthOffset = (name) => {
            const m = parseMonthName(name);
            if (!m) return 99;
            const idx = MONTH_NAMES.indexOf(m);
            return (idx - intakeStartIdx + 12) % 12;
        };

        monthlyGroups.sort((a, b) => {
            const offA = getMonthOffset(a.name);
            const offB = getMonthOffset(b.name);
            if (offA !== offB) return offA - offB;
            const ctA = parseInt(a.classType || 1);
            const ctB = parseInt(b.classType || 1);
            if (ctA !== ctB) return ctA - ctB;
            return (a.itemOrder || 0) - (b.itemOrder || 0);
        });

        const courseMap = {};
        courses.forEach(c => {
            let normalizedSubName = c.name.trim().toUpperCase();
            if (!parsedClassType && (c.courseType === 2 || rawGroups.find(g => g.id === c.groupId)?.classType === 2)) {
                normalizedSubName += ' (PAPER)';
            }
            courseMap[c.id] = normalizedSubName;
        });
        const uniqueSubjectNames = [...new Set(Object.values(courseMap))];

        const getActiveMonthsForCourse = (course) => {
            if (!course) return monthlyGroups;
            const cType = parseInt(course.courseType || 1);
            const relevantGroups = monthlyGroups.filter(g => parseInt(g.classType || 1) === cType);
            const candidateGroups = relevantGroups.length > 0 ? relevantGroups : monthlyGroups;

            const startStr = course.startMonth;
            const endStr = course.endMonth;
            if (!startStr || !endStr) return candidateGroups;

            const span = getMonthSpan(startStr, endStr);
            if (span.length === 0) return candidateGroups;

            const matched = [];
            span.forEach(mName => {
                const found = candidateGroups.find(g => parseMonthName(g.name) === mName);
                if (found && !matched.some(m => m.id === found.id)) {
                    matched.push(found);
                }
            });

            return matched.length > 0 ? matched : candidateGroups;
        };

        const subjectActiveMonthsMap = {};
        uniqueSubjectNames.forEach(subName => {
            const dbCourse = courses.find(c => {
                let name = c.name.trim().toUpperCase();
                if (!parsedClassType && (c.courseType === 2 || rawGroups.find(g => g.id === c.groupId)?.classType === 2)) {
                    name += ' (PAPER)';
                }
                return name === subName;
            });
            subjectActiveMonthsMap[subName] = getActiveMonthsForCourse(dbCourse).map(g => g.id);
        });

        // 4. Get Payments
        let paymentWhere = { batchId: parsedBatchId, status: 1 };
        if (parsedClassType) {
            paymentWhere.OR = [
                { group: { classType: parsedClassType } },
                { groupId: { in: rawGroups.map(g => g.id) } }
            ];
        }
        const rawPayments = await prisma.payment.findMany({
            where: paymentWhere,
            include: { 
                student: { select: { id: true, firstName: true, lastName: true, phone: true, whatsapp: true, nic: true } },
                group: { select: { id: true, name: true, classType: true } }
            },
            orderBy: { created_at: 'asc' }
        });

        const payments = rawPayments.filter(p => {
            if (!parsedClassType) return true;
            const gClassType = p.group ? parseInt(p.group.classType || 1) : null;
            if (gClassType !== null && gClassType === parsedClassType) return true;
            try {
                const subIds = JSON.parse(p.subjects || '[]').map(id => typeof id === 'object' ? parseInt(id.id) : parseInt(id));
                const hasMatchingCourse = subIds.some(cid => {
                    const crs = courses.find(c => c.id === cid);
                    return crs && (crs.courseType === parsedClassType || (crs.groupId && rawGroups.some(rg => rg.id === crs.groupId && rg.classType === parsedClassType)));
                });
                if (hasMatchingCourse) return true;
            } catch (e) {}
            return false;
        });

        // 5. Get Leads from After Sem CRM to map Coordinators
        const rawLeads = await prisma.lead.findMany({
             where: { 
                 campaignType: 'AFTER_SEMINAR',
                 phone: { contains: `_BIZ_${businessId}` }
             },
             include: { assignedUser: { select: { firstName: true, lastName: true } } }
        });
        
        const bizPrefix = `_BIZ_${businessId}_`;
        const bizSuffix = `_BIZ_${businessId}`;
        const leads = rawLeads.filter(l => l.phone.includes(bizPrefix) || l.phone.endsWith(bizSuffix));
        
        const leadPhoneMap = {};
        const leadInquiryTypeMap = {};
        leads.forEach(l => {
             const norm = l.phone.split('_')[0].replace(/[^0-9]/g, '').slice(-9);
             leadPhoneMap[norm] = l.assignedUser ? `${l.assignedUser.firstName || ''} ${l.assignedUser.lastName || ''}`.trim() : 'Unassigned';
             
             let pType = l.inquiryType || 'Unknown';
             if (pType === 'NEW_INQ') pType = 'New Inquiry';
             else if (pType === 'OPEN_SEM') pType = 'Open Seminar';
             leadInquiryTypeMap[norm] = pType;
        });

        // 6. Process Students
        const studentMap = {};
        for (const p of payments) {
            if (!p.student) continue;
            const stuId = p.student.id;
            if (!studentMap[stuId]) {
                const normPhone = (p.student.whatsapp || p.student.phone || '').replace(/[^0-9]/g, '').slice(-9);
                studentMap[stuId] = {
                    id: stuId,
                    studentName: `${p.student.firstName || ''} ${p.student.lastName || ''}`.trim(),
                    studentNo: p.student.nic || p.student.phone,
                    phone: p.student.phone,
                    whatsapp: p.student.whatsapp,
                    coordinator: leadPhoneMap[normPhone] || 'Unassigned',
                    leadType: leadInquiryTypeMap[normPhone] || '-',
                    matrixValues: {}, 
                    paymentTypes: new Set(),
                    isUpgradeStudent: false
                };
                monthlyGroups.forEach(mg => {
                    studentMap[stuId].matrixValues[mg.id] = { activeSubjects: new Set() };
                });
            }

            const sData = studentMap[stuId];
            const payType = parseInt(p.payment_type);

            if (payType === 1) sData.paymentTypes.add('Monthly');
            else if (payType === 2) sData.paymentTypes.add('Installment');
            else if (payType === 3) sData.paymentTypes.add('Full');
            else if (payType === 4) {
                sData.paymentTypes.add('Upgrade');
                sData.isUpgradeStudent = true;
            }

            try {
                let subs = typeof p.subjects === 'string' ? JSON.parse(p.subjects) : p.subjects;
                if (!Array.isArray(subs)) subs = [subs];
                
                let enrolledSubjectData = [];
                subs.forEach(item => {
                    let cid = typeof item === 'object' ? parseInt(item.id) : parseInt(item);
                    let subName = cid ? courseMap[cid] : (typeof item === 'string' ? item.trim().toUpperCase() : null);
                    if (subName && uniqueSubjectNames.includes(subName)) {
                        enrolledSubjectData.push(subName);
                    }
                });

                enrolledSubjectData = [...new Set(enrolledSubjectData)];
                if (enrolledSubjectData.length === 0) continue;

                enrolledSubjectData.forEach(sub => {
                     let activeGroupIds = subjectActiveMonthsMap[sub] || monthlyGroups.map(g => g.id);
                     if (payType === 1) {
                         let targetMgId = monthlyGroups.find(mg => mg.id === p.groupId)?.id || (activeGroupIds.length > 0 ? activeGroupIds[0] : (monthlyGroups[0]?.id || null));
                         if (targetMgId && sData.matrixValues[targetMgId]) {
                             sData.matrixValues[targetMgId].activeSubjects.add(sub);
                         }
                     } else {
                         activeGroupIds.forEach(mgId => {
                             if (sData.matrixValues[mgId]) {
                                 sData.matrixValues[mgId].activeSubjects.add(sub);
                             }
                         });
                     }
                });
            } catch (e) { }
        }

        // Convert Sets to Arrays and compute Plan Type
        Object.values(studentMap).forEach(sData => {
            if (sData.isUpgradeStudent) {
                sData.type = 'Upgrade';
            } else if (sData.paymentTypes.size === 0) {
                sData.type = 'Unknown';
            } else {
                sData.type = sData.paymentTypes.size > 1 ? 'Hybrid' : Array.from(sData.paymentTypes)[0];
            }
            delete sData.paymentTypes;
            delete sData.isUpgradeStudent;

            Object.keys(sData.matrixValues).forEach(mgId => {
                sData.matrixValues[mgId].activeSubjects = Array.from(sData.matrixValues[mgId].activeSubjects);
            });
        });

        const typeOrder = { 'Full': 1, 'Monthly': 2, 'Installment': 3, 'Upgrade': 4, 'Hybrid': 5 };
        const sortedStudents = Object.values(studentMap).sort((a, b) => {
            const wA = typeOrder[a.type] || 99;
            const wB = typeOrder[b.type] || 99;
            if (wA !== wB) return wA - wB;
            return a.id - b.id;
        });

        const allBatchGroups = await prisma.group.findMany({
            where: { batchId: parsedBatchId },
            select: { id: true, classType: true }
        });
        const hasTheory = allBatchGroups.some(g => (g.classType || 1) === 1);
        const hasPaper = allBatchGroups.some(g => g.classType === 2);

        res.status(200).json(safeJson({
            months: monthlyGroups,
            subjects: uniqueSubjectNames,
            students: sortedStudents,
            classType: classType || '1',
            availableClassTypes: {
                hasTheory,
                hasPaper
            }
        }));

    } catch (error) {
        console.error("Paid Campaign Matrix Error:", error);
        res.status(500).json({ error: "Failed to load drop matrix" });
    }
};