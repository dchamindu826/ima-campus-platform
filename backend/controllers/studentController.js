const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');
const crypto = require('crypto');
const jwt = require('jsonwebtoken'); // 🔥 FIX: Ghost login error fix
const bcrypt = require('bcrypt');
const axios = require('axios');
const { getStudentBatchAccess } = require('../utils/installmentHelper');
const streamCache = {};

// 🔥 NEW: BigInt convert karana helper function eka meka hama thanatama pawichi karanawa
const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

// Helper to safely extract integer subject IDs from raw payment subjects (ignores NaN, strings, objects)
const parseSafeSubjectIds = (subjects) => {
    if (!subjects) return [];
    try {
        const raw = typeof subjects === 'string' ? JSON.parse(subjects) : subjects;
        if (!Array.isArray(raw)) return [];
        return raw
            .map(id => parseInt(id, 10))
            .filter(id => !isNaN(id) && id > 0);
    } catch (e) {
        return [];
    }
};

// Helper to safely extract string subject names/codes from raw payment subjects (e.g. "SUB 01")
const parseSafeSubjectStrings = (subjects) => {
    if (!subjects) return [];
    try {
        const raw = typeof subjects === 'string' ? JSON.parse(subjects) : subjects;
        if (!Array.isArray(raw)) return [];
        return raw
            .filter(item => typeof item === 'string' && isNaN(parseInt(item, 10)))
            .map(s => s.trim().toLowerCase())
            .filter(Boolean);
    } catch (e) {
        return [];
    }
};

const getCourseGroupPrice = (course, groupId) => {
    let price = course.price || 0;
    if (course.groupPrices) {
        try {
            const gp = typeof course.groupPrices === 'string' ? JSON.parse(course.groupPrices) : course.groupPrices;
            if (Array.isArray(gp)) {
                const found = gp.find(item => String(item.groupId) === String(groupId));
                if (found && found.price !== undefined && found.price !== null && found.price !== '') {
                    price = Number(found.price);
                }
            } else if (typeof gp === 'object' && gp !== null) {
                if (gp[groupId] !== undefined && gp[groupId] !== null && gp[groupId] !== '') {
                    price = Number(gp[groupId]);
                }
            }
        } catch (e) {}
    }
    return price;
};

const normStr = (str) => (str || '').toLowerCase().replace(/[\s\-_]+/g, ' ').trim();

const getCleanZoomMeetingId = (urlOrId) => {
    if (!urlOrId) return null;
    const match = String(urlOrId).match(/(?:j\/|join\/|zoom\.us\/s\/)(\d+)/) || String(urlOrId).match(/\b(\d{9,11})\b/);
    return match ? match[1] : null;
};

const ensureAbsoluteUrl = (link, meetingId) => {
    if (link && String(link).trim()) {
        const trimmed = String(link).trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
        if (trimmed.includes('zoom.us') || trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) return `https://${trimmed}`;
        if (/^\d{9,12}$/.test(trimmed)) return `https://zoom.us/j/${trimmed}`;
        return `https://${trimmed}`;
    }
    if (meetingId && String(meetingId).trim()) {
        const cleanId = String(meetingId).trim().replace(/\s+/g, '');
        return `https://zoom.us/j/${cleanId}`;
    }
    return '';
};

const calculateGroupAmount = (group, courses) => {
    if (!courses || courses.length === 0) return 0;

    const coursePriceMap = courses.map(c => ({
        id: c.id,
        price: getCourseGroupPrice(c, group ? group.id : null),
        isDiscountExcluded: !!c.isDiscountExcluded
    }));

    let activeRule = null;
    if (group && group.discount_rules) {
        try {
            const rules = typeof group.discount_rules === 'string' ? JSON.parse(group.discount_rules) : group.discount_rules;
            if (Array.isArray(rules) && rules.length > 0) {
                const sortedRules = [...rules].sort((a, b) => Number(b.courseCount) - Number(a.courseCount));
                const eligibleCount = coursePriceMap.filter(c => !c.isDiscountExcluded).length;
                for (const rule of sortedRules) {
                    if (eligibleCount >= Number(rule.courseCount)) {
                        activeRule = rule;
                        break;
                    }
                }
            }
        } catch (e) {}
    }

    if (!activeRule) {
        return coursePriceMap.reduce((sum, c) => sum + c.price, 0);
    }

    let total = 0;
    const hasPackage = activeRule.packagePrice !== undefined && activeRule.packagePrice !== null && activeRule.packagePrice !== '';
    const hasPricePerCourse = activeRule.pricePerCourse !== undefined && activeRule.pricePerCourse !== null && activeRule.pricePerCourse !== '';
    const hasFixedDiscount = activeRule.fixedDiscount !== undefined && activeRule.fixedDiscount !== null && activeRule.fixedDiscount !== '';

    if (hasPackage) {
        total += Number(activeRule.packagePrice);
        coursePriceMap.filter(c => c.isDiscountExcluded).forEach(c => {
            total += c.price;
        });
    } else if (hasPricePerCourse) {
        const newPrice = Number(activeRule.pricePerCourse);
        coursePriceMap.forEach(c => {
            if (c.isDiscountExcluded) {
                total += c.price;
            } else {
                total += newPrice;
            }
        });
        if (hasFixedDiscount) {
            total -= Number(activeRule.fixedDiscount);
        }
    } else if (hasFixedDiscount) {
        const sumNormal = coursePriceMap.reduce((sum, c) => sum + c.price, 0);
        total = Math.max(0, sumNormal - Number(activeRule.fixedDiscount));
    } else {
        total = coursePriceMap.reduce((sum, c) => sum + c.price, 0);
    }

    return Math.max(0, total);
};

// Helper to identify batches where the student has an overdue installment
const getStudentOverdueInstallmentBatchIds = async (studentId) => {
    if (!studentId) return new Set();
    const now = new Date();

    // 1. Any upcoming or pending installment with due_date in the past
    const overdueUpcoming = await prisma.payment.findMany({
        where: {
            studentId: parseInt(studentId),
            payment_type: 2,
            status: { in: [0, 2] },
            due_date: { not: null, lt: now }
        },
        select: { batchId: true }
    });

    const overdueBatchIds = new Set(overdueUpcoming.map(p => p.batchId).filter(Boolean));

    // 2. Also check approved installments where gapDays expired and next phase is unpaid
    const approvedInstallments = await prisma.payment.findMany({
        where: {
            studentId: parseInt(studentId),
            payment_type: 2,
            status: 1
        }
    });

    for (const p of approvedInstallments) {
        if (!p.batchId || overdueBatchIds.has(p.batchId) || !p.subjects) continue;
        try {
            const subIds = parseSafeSubjectIds(p.subjects);
            const plan = await prisma.installment.findFirst({
                where: {
                    batchId: p.batchId,
                    subjectCount: { lte: subIds.length }
                },
                orderBy: { subjectCount: 'desc' }
            });

            if (plan && plan.details) {
                const phases = JSON.parse(plan.details);
                const currentStep = p.installment_no || 1;
                const currentPhaseIndex = currentStep - 1;

                if (currentPhaseIndex + 1 < phases.length) {
                    const nextPaid = approvedInstallments.find(
                        other => other.batchId === p.batchId && (other.installment_no || 1) > currentStep
                    );
                    if (!nextPaid) {
                        // Check if an upcoming or pending payment record already exists for the next phase
                        const nextPending = await prisma.payment.findFirst({
                            where: {
                                studentId: parseInt(studentId),
                                batchId: p.batchId,
                                payment_type: 2,
                                installment_no: currentStep + 1,
                                status: { in: [0, 2] }
                            }
                        });

                        if (nextPending && nextPending.due_date) {
                            if (new Date(nextPending.due_date) < now) {
                                overdueBatchIds.add(p.batchId);
                            }
                            // If nextPending has a future due_date, student is within payment window!
                            continue;
                        }

                        // If no nextPending with due_date, check if this approved payment itself has an explicit due_date
                        if (p.due_date) {
                            if (new Date(p.due_date) < now) {
                                overdueBatchIds.add(p.batchId);
                            }
                            continue;
                        }

                        const currentPhase = phases[currentPhaseIndex];
                        const gapDays = parseInt(currentPhase.gapDays || '30', 10);
                        const baseDate = p.updatedAt || p.created_at;
                        const expiryDate = new Date(baseDate.getTime() + gapDays * 24 * 60 * 60 * 1000);

                        if (expiryDate < now) {
                            overdueBatchIds.add(p.batchId);
                        }
                    }
                }
            }
        } catch (err) {}
    }

    return overdueBatchIds;
};
exports.getStudentOverdueInstallmentBatchIds = getStudentOverdueInstallmentBatchIds;

// 1. Dashboard
exports.getStudentDashboard = async (req, res) => {
    try {
        const studentId = req.user?.userId || req.user?.id;

        const overdueBatchIds = await getStudentOverdueInstallmentBatchIds(studentId);

        // 1. ළමයාගේ Valid Payments ගන්නවා
        const allValidPayments = await prisma.payment.findMany({
            where: { studentId: parseInt(studentId), status: { in: [1, 4] } },
            include: { group: true }
        });

        // Filter out installment payments for batches with overdue installments,
        // unless the student also has a valid full or monthly payment for that batch
        const validPayments = allValidPayments.filter(p => {
            if (p.payment_type === 2 && overdueBatchIds.has(p.batchId)) {
                const hasValidAlternative = allValidPayments.some(other =>
                    other.id !== p.id &&
                    other.batchId === p.batchId &&
                    [1, 3].includes(other.payment_type) &&
                    other.status === 1
                );
                return hasValidAlternative;
            }
            return true;
        });

        const fullOrInstallmentPayments = validPayments.filter(p => [2, 3].includes(p.payment_type));
        const monthlyPayments = validPayments.filter(p => p.payment_type === 1);

        const fullOrInstSubjectIds = new Set();
        fullOrInstallmentPayments.forEach(p => {
            if (p.subjects) {
                parseSafeSubjectIds(p.subjects).forEach(id => fullOrInstSubjectIds.add(id));
            }
        });

        const monthlySubjectIds = new Set();
        monthlyPayments.forEach(p => {
            if (p.subjects) {
                parseSafeSubjectIds(p.subjects).forEach(id => monthlySubjectIds.add(id));
            }
        });

        const enrolledSubjectIds = new Set([...fullOrInstSubjectIds, ...monthlySubjectIds]);

        // 2. ළමයා ඉන්න Business IDs සහ Batch IDs වෙන් කරලා BigInt වලට හරවනවා
        const enrolledBusinessIds = [...new Set(validPayments.map(p => p.businessId).filter(Boolean))].map(id => BigInt(id));
        const enrolledBatchIds = [...new Set(validPayments.map(p => p.batchId).filter(Boolean))].map(id => BigInt(id));

        // 3. 🔥 FIX: ළමයාට අදාළ පෝස්ට් විතරක් Filter කරලා ගන්නවා
        const posts = await prisma.post.findMany({
            where: {
                OR: [
                    { business_id: null }, // හැමෝටම පේන පොදු පෝස්ට් (All)
                    { 
                        business_id: { in: enrolledBusinessIds }, 
                        batch_id: null // ළමයා ඉන්න Business එකේ ඔක්කොම Batches වලට දාපු පෝස්ට්
                    }, 
                    { 
                        business_id: { in: enrolledBusinessIds },
                        batch_id: { in: enrolledBatchIds } // ළමයා ඉන්න Specific Batch එකට දාපු පෝස්ට්
                    }
                ]
            },
            orderBy: { created_at: 'desc' },
            take: 5
        });

        let alerts = [];
        let duePaymentsList = [];
        
        const pendingPayments = await prisma.payment.findMany({
            where: { 
                studentId: parseInt(studentId),
                OR: [
                    { status: 0 },
                    {
                        status: { in: [2, 5] },
                        due_date: { not: null }
                    }
                ]
            },
            include: { business: true, batch: true }
        });

        const today = new Date();

        // -- PROACTIVE UPCOMING MONTHLY PAYMENTS LOGIC --
        // Check if today is >= 24th of the month OR <= 15th of the month
        if (today.getDate() >= 24 || today.getDate() <= 15) {
            // Find valid monthly payments for this student
            const validMonthly = await prisma.payment.findMany({
                where: { studentId: parseInt(studentId), status: { in: [0, 1, 4] }, payment_type: 1 },
                include: { group: true, batch: { include: { business: true } } }
            });
            
            const batchMap = {};
            validMonthly.forEach(p => {
                if (!p.batchId || !p.group) return;
                const cType = parseInt(p.group.classType || 1);
                const key = `${p.batchId}_${cType}`;
                if (!batchMap[key]) {
                    batchMap[key] = { batch: p.batch, highestGroup: p.group, subjects: p.subjects, classType: cType };
                } else {
                    if (p.group.itemOrder > batchMap[key].highestGroup.itemOrder) {
                        batchMap[key].highestGroup = p.group;
                        batchMap[key].subjects = p.subjects;
                    }
                }
            });

            for (let key in batchMap) {
                const { batch, highestGroup, subjects, classType } = batchMap[key];
                
                // Find next group strictly matching classType (Theory vs Paper)
                const nextGroup = await prisma.group.findFirst({
                    where: {
                        batchId: parseInt(batch.id),
                        type: 1, // monthly groups
                        classType: classType,
                        itemOrder: { gt: highestGroup.itemOrder }
                    },
                    orderBy: { itemOrder: 'asc' }
                });

                if (nextGroup) {
                    // Check if user already has a pending/completed payment for this group
                    const existingPayment = await prisma.payment.findFirst({
                        where: {
                            studentId: parseInt(studentId),
                            batchId: parseInt(batch.id),
                            groupId: nextGroup.id,
                            status: { not: 3 } // not rejected
                        }
                    });

                    if (!existingPayment) {
                        let amount = 0;
                        const parsedSubjects = parseSafeSubjectIds(subjects);
                        
                        if (parsedSubjects.length > 0) {
                            const courses = await prisma.course.findMany({
                                where: { id: { in: parsedSubjects } }
                            });
                            amount = calculateGroupAmount(nextGroup, courses);
                        }

                        // Push a virtual payment
                        const classLabel = classType === 2 ? ' (Paper Class)' : ' (Theory Class)';
                        const courseName = `${batch.business?.name || ''} - ${batch.name || ''}${classLabel}`;
                        const nextMonthDueDate = new Date(today.getFullYear(), today.getMonth() + 1, 5); // 5th of next month

                        duePaymentsList.push({
                            id: `virtual_${nextGroup.id}`,
                            isUpcomingMonthly: true,
                            groupId: nextGroup.id,
                            batchId: batch.id,
                            businessId: batch.businessId,
                            subjects: subjects, // raw JSON string
                            courseName: courseName,
                            amount: amount,
                            dueDate: nextMonthDueDate,
                            isInstallment: false,
                            diffDays: Math.ceil((nextMonthDueDate - today) / (1000 * 60 * 60 * 24)),
                            nextGroupName: nextGroup.name
                        });
                    }
                }
            }
        }
        // ------------------------------------------------

        pendingPayments.forEach(p => {
            if (p.due_date && (p.method !== 'Slip' || p.status === 2 || p.status === 5)) {
                const dueDate = new Date(p.due_date);
                const diffTime = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24)); 
                const courseName = `${p.business?.name || ''} - ${p.batch?.name || ''}`;

                duePaymentsList.push({
                    id: p.id,
                    businessId: p.businessId,
                    batchId: p.batchId,
                    groupId: p.groupId,
                    courseName: courseName,
                    amount: p.amount || 0,
                    dueDate: p.due_date,
                    isInstallment: p.payment_type === 2,
                    installmentNo: p.installment_no,
                    diffDays: diffTime
                });

                if (diffTime < 0) {
                    alerts.push({ type: 'locked', msg: `Your payment for ${courseName} is OVERDUE by ${Math.abs(diffTime)} days. Please pay immediately.` });
                } else if (diffTime <= 1) {
                    alerts.push({ type: 'danger', msg: `Your payment for ${courseName} is due TOMORROW!` });
                } else if (diffTime <= 5) {
                    alerts.push({ type: 'warning', msg: `Your payment for ${courseName} is due in ${diffTime} days.` });
                }
            }
        });

        let unlockedVideos = 0;
        let studyMaterials = 0;
        let upcomingLives = []; 

        const enrolledBatchIdNums = [...new Set(validPayments.map(p => p.batchId).filter(Boolean))].map(Number);
        let enrolledCourses = [];
        const expandedCourseIds = new Set();

        if (enrolledSubjectIds.size > 0) {
            const rawSubjectIds = Array.from(enrolledSubjectIds).map(Number);
            enrolledCourses = await prisma.course.findMany({
                where: { id: { in: rawSubjectIds } },
                include: { group: true }
            });

            // Start with only the courses the student directly paid for
            rawSubjectIds.forEach(id => expandedCourseIds.add(id));

            // 🔥 CRITICAL: ONLY expand sibling courses across monthly groups for FULL payment (payment_type: 3)
            // or active INSTALLMENT (payment_type: 2) students!
            // Monthly students (payment_type: 1) only paid for that specific month and MUST NOT be expanded to other months!
            const fullOrInstCourses = enrolledCourses.filter(c => fullOrInstSubjectIds.has(c.id));

            for (const ec of fullOrInstCourses) {
                if (ec.group?.batchId) {
                    const targetClassType = parseInt(ec.courseType || ec.group?.classType || 1, 10);
                    const ecNorm = normStr(ec.name);
                    const ecCode = ec.code ? ec.code.trim() : '';

                    const siblingCourses = await prisma.course.findMany({
                        where: {
                            group: { batchId: ec.group.batchId }
                        },
                        select: { id: true, name: true, code: true, courseType: true, lecturerName: true, groupId: true, group: { select: { classType: true } } }
                    });

                    siblingCourses.forEach(sc => {
                        const scClassType = parseInt(sc.courseType || sc.group?.classType || 1, 10);
                        if (scClassType === targetClassType) {
                            const scNorm = normStr(sc.name);
                            const scCode = sc.code ? sc.code.trim() : '';
                            const isSameName = scNorm === ecNorm;
                            const isSameLecturer = Boolean(ec.lecturerName && sc.lecturerName && normStr(ec.lecturerName) === normStr(sc.lecturerName));
                            const isCodeAndNameMatch = Boolean(ecCode && scCode && scCode === ecCode && (isSameLecturer || scNorm.includes(ecNorm) || ecNorm.includes(scNorm)));

                            if (isSameName || (isSameLecturer && (scNorm.includes(ecNorm) || ecNorm.includes(scNorm))) || isCodeAndNameMatch) {
                                expandedCourseIds.add(sc.id);
                            }
                        }
                    });
                }
            }

            // Stats calculation from ContentCourse
            const courseIds = Array.from(expandedCourseIds).map(id => BigInt(id));
            const linkedContents = await prisma.contentCourse.findMany({ where: { course_id: { in: courseIds } } });
            
            if (linkedContents.length > 0) {
                const contentIds = [...new Set(linkedContents.map(lc => lc.content_id))];
                const allContents = await prisma.content.findMany({ where: { id: { in: contentIds } } });
                
                unlockedVideos = allContents.filter(c => ['live', 'recording', '1', '2'].includes(c.contentType)).length;
                studyMaterials = allContents.filter(c => ['document', 'paper', 'sPaper', 'rankingTest', 'ranking_test', 'test', '3', '4', '5'].includes(c.contentType)).length;
            }
        }

        // ================= UPCOMING / ACTIVE LIVE CLASSES LOGIC =================
        const now = new Date();
        // 24-hr buffer ensures classes saved in SLT (18:30 UTC yesterday) aren't cut off
        const startOfLiveWindow = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        startOfLiveWindow.setHours(0, 0, 0, 0);

        const courseIdsBigInt = Array.from(expandedCourseIds).map(id => BigInt(id));
        const liveContentList = [];

        // 1. Fetch live classes from Content table
        if (courseIdsBigInt.length > 0 || enrolledBatchIdNums.length > 0) {
            const linkedContents = courseIdsBigInt.length > 0 ? await prisma.contentCourse.findMany({
                where: { course_id: { in: courseIdsBigInt } },
                select: { content_id: true, course_id: true }
            }) : [];
            const linkedContentIdSet = new Set(linkedContents.map(lc => lc.content_id));

            const contentOrClauses = [];
            if (linkedContentIdSet.size > 0) {
                contentOrClauses.push({ id: { in: Array.from(linkedContentIdSet) } });
            }
            if (enrolledBatchIdNums.length > 0) {
                contentOrClauses.push({ batchId: { in: enrolledBatchIdNums } });
                enrolledBatchIdNums.forEach(bId => {
                    contentOrClauses.push({ additionalBatchIds: { contains: `${bId}` } });
                });
            }

            const candidateContents = await prisma.content.findMany({
                where: {
                    contentType: { in: ['live', '1'] },
                    date: { gte: startOfLiveWindow },
                    OR: contentOrClauses
                },
                include: { group: true }
            });

            for (const c of candidateContents) {
                const isDirectCourseLink = linkedContentIdSet.has(c.id);
                if (isDirectCourseLink) {
                    const cLink = linkedContents.find(l => l.content_id === c.id);
                    const courseDetails = enrolledCourses.find(ec => ec.id === Number(cLink?.course_id)) || await prisma.course.findUnique({ where: { id: Number(cLink?.course_id || 0) } });
                    liveContentList.push({
                        id: c.id,
                        source: 'content',
                        title: c.title,
                        link: ensureAbsoluteUrl(c.link, c.meetingId),
                        date: c.date,
                        startTime: c.startTime,
                        endTime: c.endTime,
                        courseName: courseDetails?.name || 'Live Class',
                        batchId: c.batchId
                    });
                    continue;
                }

                // If not directly linked by courseId, ONLY match if content has NO linked courses (general batch announcement)
                // AND student has active access to this batch/month!
                const isBatchMatch = enrolledBatchIdNums.includes(c.batchId) || (c.additionalBatchIds && enrolledBatchIdNums.some(bId => c.additionalBatchIds.includes(`${bId}`)));
                if (isBatchMatch) {
                    const cLinks = await prisma.contentCourse.findMany({ where: { content_id: c.id } });
                    if (cLinks.length === 0) {
                        const cDate = c.date ? new Date(c.date) : now;
                        const cMonth = cDate.toLocaleString('en-US', { month: 'long' }).toLowerCase();
                        const cMonthShort = cDate.toLocaleString('en-US', { month: 'short' }).toLowerCase();

                        const hasBatchAccess = fullOrInstallmentPayments.some(p => p.batchId === c.batchId) ||
                            monthlyPayments.some(p => p.batchId === c.batchId && p.group && (normStr(p.group.name).includes(cMonth) || normStr(p.group.name).includes(cMonthShort)));

                        if (hasBatchAccess) {
                            liveContentList.push({
                                id: c.id,
                                source: 'content',
                                title: c.title,
                                link: ensureAbsoluteUrl(c.link, c.meetingId),
                                date: c.date,
                                startTime: c.startTime,
                                endTime: c.endTime,
                                courseName: 'Live Class',
                                batchId: c.batchId
                            });
                        }
                    }
                }
            }
        }

        // 2. Fetch live classes from Timetable table (delivered or has liveLink)
        const timetableLives = [];
        if (enrolledBatchIdNums.length > 0) {
            const ttOrClauses = [
                { batchId: { in: enrolledBatchIdNums } }
            ];
            enrolledBatchIdNums.forEach(bId => {
                ttOrClauses.push({ additionalBatchIds: { contains: `${bId}` } });
            });

            const candidateTimetables = await prisma.timetable.findMany({
                where: {
                    date: { gte: startOfLiveWindow },
                    liveLink: { not: null },
                    OR: ttOrClauses
                },
                include: { batch: true }
            });

            for (const tt of candidateTimetables) {
                const rawLink = tt.liveLink ? tt.liveLink.trim() : '';
                if (!rawLink || rawLink.toUpperCase() === 'PENDING') continue;

                const ttNormSub = normStr(tt.subjectName);
                const ttDate = tt.date ? new Date(tt.date) : now;
                const ttMonth = ttDate.toLocaleString('en-US', { month: 'long' }).toLowerCase();
                const ttMonthShort = ttDate.toLocaleString('en-US', { month: 'short' }).toLowerCase();

                // Check if student has paid access to this timetable class:
                // 1. Full or Installment payment for this batch matching subject
                const hasFullOrInstAccess = fullOrInstallmentPayments.some(p => {
                    if (p.batchId !== tt.batchId) return false;
                    const pSubs = parseSafeSubjectIds(p.subjects);
                    if (pSubs.length === 0 || !ttNormSub) return true;
                    return pSubs.some(subId => {
                        const crs = enrolledCourses.find(ec => ec.id === subId);
                        if (!crs) return false;
                        const crsNorm = normStr(crs.name);
                        return ttNormSub.includes(crsNorm) || crsNorm.includes(ttNormSub);
                    });
                });

                // 2. Monthly payment for this batch for THIS specific month matching subject
                const hasMonthlyAccess = monthlyPayments.some(p => {
                    if (p.batchId !== tt.batchId) return false;
                    if (!p.group) return false;
                    const grpNameNorm = normStr(p.group.name);
                    const isForThisMonth = grpNameNorm.includes(ttMonth) || grpNameNorm.includes(ttMonthShort);
                    if (!isForThisMonth) return false;

                    const pSubs = parseSafeSubjectIds(p.subjects);
                    if (pSubs.length === 0 || !ttNormSub) return true;
                    return pSubs.some(subId => {
                        const crs = enrolledCourses.find(ec => ec.id === subId);
                        if (!crs) return false;
                        const crsNorm = normStr(crs.name);
                        return ttNormSub.includes(crsNorm) || crsNorm.includes(ttNormSub);
                    });
                });

                if (!hasFullOrInstAccess && !hasMonthlyAccess) {
                    continue; // Student has NOT paid for this subject/month!
                }

                // Check lecturer match to avoid teacher mixing
                const ttLecturerNorm = normStr(tt.lecturerName);
                if (ttLecturerNorm) {
                    const sameSubjectCourses = enrolledCourses.filter(ec => {
                        const ecNorm = normStr(ec.name);
                        return ttNormSub.includes(ecNorm) || ecNorm.includes(ttNormSub);
                    });
                    const hasDifferentLecturer = sameSubjectCourses.some(ec => {
                        const ecLecNorm = normStr(ec.lecturerName);
                        return ecLecNorm && ecLecNorm !== ttLecturerNorm && !ttLecturerNorm.includes(ecLecNorm) && !ecLecNorm.includes(ttLecturerNorm);
                    });
                    const hasMatchingLecturer = sameSubjectCourses.some(ec => {
                        const ecLecNorm = normStr(ec.lecturerName);
                        return ecLecNorm && (ecLecNorm === ttLecturerNorm || ttLecturerNorm.includes(ecLecNorm) || ecLecNorm.includes(ttLecturerNorm));
                    });
                    if (hasDifferentLecturer && !hasMatchingLecturer) {
                        continue; // Skip timetable for another teacher
                    }
                }

                timetableLives.push({
                    id: `tt_${tt.id}`,
                    source: 'timetable',
                    title: tt.title,
                    link: ensureAbsoluteUrl(tt.liveLink),
                    date: tt.date,
                    startTime: tt.startTime,
                    endTime: tt.endTime,
                    courseName: tt.subjectName || tt.batch?.name || 'Live Class',
                    batchId: tt.batchId
                });
            }
        }

        // 3. Deduplicate between Content and Timetable
        const mergedLives = [...liveContentList];
        for (const tt of timetableLives) {
            const ttMeetingId = getCleanZoomMeetingId(tt.link);
            const ttDateStr = tt.date ? new Date(tt.date).toISOString().split('T')[0] : '';
            const ttNormTitle = normStr(tt.title);

            const isDuplicate = mergedLives.some(existing => {
                const exMeetingId = getCleanZoomMeetingId(existing.link);
                if (ttMeetingId && exMeetingId && ttMeetingId === exMeetingId) return true;
                if (existing.link && tt.link && existing.link === tt.link) return true;

                const exDateStr = existing.date ? new Date(existing.date).toISOString().split('T')[0] : '';
                const exNormTitle = normStr(existing.title);
                if (exDateStr === ttDateStr && existing.startTime === tt.startTime && (exNormTitle === ttNormTitle || ttNormTitle.includes(exNormTitle) || exNormTitle.includes(ttNormTitle))) {
                    return true;
                }
                return false;
            });

            if (!isDuplicate) {
                mergedLives.push(tt);
            }
        }

        // Sort by date and startTime ascending
        mergedLives.sort((a, b) => {
            const da = new Date(a.date || 0);
            const db = new Date(b.date || 0);
            if (da - db !== 0) return da - db;
            return (a.startTime || '').localeCompare(b.startTime || '');
        });

        upcomingLives = mergedLives;

        res.status(200).json(safeJson({
            enrolledCount: enrolledSubjectIds.size, 
            enrolledCourses: enrolledCourses,
            upcomingLives: upcomingLives, 
            posts: posts, // 🔥 ළමයාගේ පෝස්ට් විතරයි යන්නේ
            alerts: alerts,
            duePayments: duePaymentsList,
            stats: { unlockedVideos, studyMaterials }
        }));
    } catch (error) {
        console.error("Dashboard Load Error:", error);
        res.status(500).json({ error: "Dashboard load failed" });
    }
};

// 2. Enroll Businesses
exports.getAvailableEnrollments = async (req, res) => {
    try {
        const studentId = req.user?.userId || req.user?.id;

        // ළමයාගේ valid payments ගන්නවා
        const validPayments = await prisma.payment.findMany({
            where: { studentId: parseInt(studentId), status: { in: [0, 1, 4] } }
        });

        // ළමයා enroll වෙලා ඉන්න Batch IDs
        const enrolledBatchIds = [...new Set(validPayments.map(p => p.batchId).filter(Boolean))].map(id => parseInt(id));

        const businesses = await prisma.business.findMany({
            where: { status: 1 },
            include: {
                batches: {
                    where: { status: 1 },
                    include: {
                        groups: { include: { courses: true }, orderBy: [{ itemOrder: 'asc' }, { id: 'asc' }] }
                    }
                }
            }
        });

        const safeData = safeJson(businesses);
        
        for (let i = 0; i < safeData.length; i++) {
            for (let j = 0; j < safeData[i].batches.length; j++) {
                const currentBatch = safeData[i].batches[j];
                const batchInstallments = await prisma.installment.findMany({
                    where: { batchId: parseInt(currentBatch.id) }
                });
                currentBatch.installment_plans_parsed = batchInstallments || [];
            }
        }

        res.status(200).json({ businesses: safeData });
    } catch (error) {
        console.error("Error in getAvailableEnrollments:", error);
        res.status(500).json({ error: "Failed to load courses", details: error.message });
    }
};

// 🔥 NEW: ළමයා දැනටමත් ගෙවලා තියෙන subjects වල IDs ගන්නවා
exports.getMyEnrolledSubjects = async (req, res) => {
    try {
        const studentId = req.user?.userId || req.user?.id;

        const overdueBatchIds = await getStudentOverdueInstallmentBatchIds(studentId);
        
        const validPayments = await prisma.payment.findMany({
            where: { studentId: parseInt(studentId), status: { in: [0, 1, 4] } },
            include: { group: true }
        });

        const activePayments = validPayments.filter(p => {
            if (p.payment_type === 2 && overdueBatchIds.has(p.batchId)) return false;
            return true;
        });

        let enrolled = [];
        let groupPaidSubjects = {};
        let fullPaidSubjects = [];

        activePayments.forEach(p => {
            if (p.subjects) {
                try { 
                    const parsed = typeof p.subjects === 'string' ? JSON.parse(p.subjects) : p.subjects;
                    if (Array.isArray(parsed)) {
                        const numParsed = parsed.map(Number).filter(n => !isNaN(n));
                        const strParsed = parsed.map(String);
                        enrolled.push(...numParsed, ...strParsed); 
                        
                        if (p.payment_type === 3 || p.payment_type === 2) {
                            fullPaidSubjects.push(...numParsed, ...strParsed);
                        }

                        if (p.groupId) {
                            if (!groupPaidSubjects[p.groupId]) groupPaidSubjects[p.groupId] = [];
                            groupPaidSubjects[p.groupId].push(...numParsed, ...strParsed);
                        }
                    }
                } catch(e) {
                    console.error("Subject Parse Error:", e);
                }
            }
        });

        const user = await prisma.user.findUnique({
            where: { id: parseInt(studentId) },
            select: { walletBalance: true }
        });

        res.status(200).json({
            enrolledSubjects: enrolled,
            groupPaidSubjects: groupPaidSubjects,
            fullPaidSubjects: fullPaidSubjects,
            walletBalance: user?.walletBalance || 0
        });
    } catch (error) {
        console.error("Error fetching enrolled subjects:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// 3. PayHere Hash 
exports.generatePayHereHash = async (req, res) => {
    try {
        const { amount, orderId, currency = 'LKR' } = req.body;

        if (!orderId) {
            return res.status(400).json({ error: "Order ID is required" });
        }
        
        const merchantId = process.env.PAYHERE_MERCHANT_ID || process.env.VITE_PAYHERE_MERCHANT_ID || "222646"; 
        const merchantSecret = process.env.PAYHERE_SECRET || process.env.VITE_PAYHERE_SECRET; 

        if (!merchantId || !merchantSecret) {
            console.error("❌ Backend .env missing PayHere keys!");
            return res.status(500).json({ error: "PayHere credentials missing in server configuration" });
        }

        let amountFormatted = null;

        // If orderId is a numeric payment ID in DB (e.g. Due / Installment payments), enforce authoritative DB amount
        const numericOrderId = parseInt(orderId);
        if (!isNaN(numericOrderId) && String(numericOrderId) === String(orderId).trim()) {
            const paymentRecord = await prisma.payment.findUnique({ where: { id: numericOrderId } });
            if (paymentRecord && paymentRecord.amount) {
                amountFormatted = parseFloat(paymentRecord.amount).toFixed(2);
            }
        }

        // For new course enrollments where orderId is generated by client (e.g. ORD-172646...), use validated amount
        if (!amountFormatted) {
            if (!amount || isNaN(parseFloat(amount))) {
                return res.status(400).json({ error: "Valid amount is required" });
            }
            amountFormatted = parseFloat(amount).toFixed(2);
        }

        const hashedSecret = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase();
        const hashString = merchantId + orderId + amountFormatted + currency + hashedSecret;
        const hash = crypto.createHash('md5').update(hashString).digest('hex').toUpperCase();

        // Remember this order server-side, so only PayHere's own notify can approve it.
        await require('../src/modules/payments/service').recordGatewayStart('payhere', orderId, {
            studentId: req.user?.userId || req.user?.id,
            amount: amountFormatted,
        });

        res.status(200).json({ hash, amount: amountFormatted });
    } catch (error) {
        console.error("PayHere Hash Error:", error);
        res.status(500).json({ error: "Failed to generate hash" });
    }
};

// 🔥 PayHere Notify Webhook (server-to-server — the ONLY thing that may approve a PayHere payment)
exports.payhereNotify = async (req, res) => {
    try {
        const { merchant_id, order_id, payhere_amount, payhere_currency, status_code, md5sig } = req.body;
        const merchantSecret = process.env.PAYHERE_SECRET || process.env.VITE_PAYHERE_SECRET;

        if (!merchantSecret) {
            console.error("❌ PayHere Secret missing in environment");
            return res.status(500).send("Configuration Error");
        }

        const payRules = require('../src/modules/payments/rules');
        const payService = require('../src/modules/payments/service');
        const localMd5sig = payRules.payhereSignature({
            merchantId: merchant_id, orderId: order_id, amount: payhere_amount,
            currency: payhere_currency, statusCode: status_code, secret: merchantSecret,
        });

        if (localMd5sig !== md5sig) {
            console.warn(`[PayHere] Invalid signature for order ${order_id}`);
            return res.status(200).send("OK");
        }
        if (String(status_code) !== "2") {
            console.log(`[PayHere] Order ${order_id} status_code=${status_code} (not successful)`);
            return res.status(200).send("OK");
        }

        await payService.recordGatewayConfirmed('payhere', order_id, { paidAmount: payhere_amount, raw: { status_code, payhere_currency } });
        console.log(`[PayHere] Verified payment for order ${order_id}, Rs. ${payhere_amount}`);

        const { createAutoDeliveryForPayment, syncLeadEnrollment } = require('./paymentController');
        const afterApprove = async (payment) => {
            if (payment.subjects) {
                try { await createAutoDeliveryForPayment(payment); } catch (e) { console.error("Auto Delivery Error in payhereNotify:", e); }
            }
            try { await syncLeadEnrollment(payment.studentId, payment.payment_type, payment); } catch (e) { console.error("CRM Sync Error in payhereNotify:", e); }
        };

        const numericId = parseInt(order_id);
        if (!isNaN(numericId) && String(numericId) === String(order_id).trim()) {
            // Due / installment payment: order_id is the Payment id
            const existingPayment = await prisma.payment.findUnique({ where: { id: numericId } });
            if (existingPayment && existingPayment.status !== 1) {
                const paidAmount = parseFloat(payhere_amount);
                if (paidAmount + 0.01 < parseFloat(existingPayment.amount)) {
                    console.error(`🚨 [PayHere Underpayment] Order ${order_id}: expected Rs. ${existingPayment.amount}, paid Rs. ${paidAmount}`);
                    await payService.changeStatusIfUnchanged(prisma, numericId, existingPayment.status, { status: -2 });
                } else if (await payService.changeStatusIfUnchanged(prisma, numericId, existingPayment.status, { status: 1, method: 'PayHere' })) {
                    await afterApprove({ ...existingPayment, status: 1 });
                }
            }
        } else {
            // New enrollment: order_id is "ORD-..."; approve the pending payments created for it (if any yet)
            await payService.approvePendingForOrder('payhere', order_id, afterApprove);
        }

        res.status(200).send("OK");
    } catch (error) {
        console.error("PayHere Notify Error:", error);
        res.status(500).send("Webhook Error");
    }
};

// 4. Enrollment
exports.enrollStudent = async (req, res) => {
    try {
        const studentId = req.user?.userId || req.user?.id;
        const { businessId, batchId, groupId, subjects, paymentMethodChosen, method, orderId, amount, remark, upgrades } = req.body;
        
        const slipFileNames = req.files && req.files.length > 0 
            ? req.files.map(f => f.filename).join(',') 
            : null;

        const safeMethod = String(method || '').toLowerCase().trim();
        // Online payments are approved ONLY if the gateway confirmed them to this server
        // (PayHere notify / Paycorp complete). The browser saying "completed" is not enough.
        const payService = require('../src/modules/payments/service');
        const payRules = require('../src/modules/payments/rules');
        const isOnline = Boolean(payRules.normGateway(safeMethod));
        // Server-side price check (src/modules/payments/priceCheck.js). Shadow mode only logs;
        // with PRICING_ENFORCE=true an underpriced online payment is left pending for staff.
        const priceCheck = require('../src/modules/payments/priceCheck');
        const price = await priceCheck.checkEnrollmentPrice({ studentId, body: req.body, userAgent: req.headers && req.headers['user-agent'] });
        const priceBlocked = priceCheck.enforcing() && price.supported && !price.ok;
        const onlineClaim = !isOnline
            ? { approve: false, reason: 'not-online' }
            : priceBlocked
                ? { approve: false, reason: `price-below-expected (paid ${price.claimed}, expected ${price.expected})` }
                : await payService.claimOnlinePayment(safeMethod, orderId, { studentId: parseInt(studentId), amount });
        const initialStatus = onlineClaim.approve ? 1 : 0;
        // Pending online payments carry a marker, so a late gateway confirmation can approve them.
        const tagPendingOnline = async (payment) => {
            if (priceBlocked && !isOnline) {
                const note = `[PRICE CHECK] Student entered LKR ${price.claimed}, system price LKR ${price.expected}. Check before approving.`;
                return prisma.payment.update({ where: { id: payment.id }, data: { remark: payment.remark ? `${payment.remark}\n${note}` : note } });
            }
            if (!isOnline || initialStatus === 1 || !orderId) return payment;
            const note = `${payRules.onlineMarker(safeMethod, orderId)} Waiting for gateway confirmation (${onlineClaim.reason})`;
            console.warn(`[Enroll] ${safeMethod} payment ${payment.id} for student ${studentId} left PENDING: ${onlineClaim.reason}`);
            return prisma.payment.update({ where: { id: payment.id }, data: { remark: payment.remark ? `${payment.remark}\n${note}` : note } });
        };

        const resolveTargetFullGroupId = async (batchId, candidateGroupId, subjectIds) => {
            let resolvedId = candidateGroupId ? parseInt(candidateGroupId) : null;
            const cleanSubIds = (Array.isArray(subjectIds) ? subjectIds : []).map(Number).filter(Boolean);
            if (cleanSubIds.length === 0 && resolvedId) return resolvedId;

            let targetClassType = 1;
            if (cleanSubIds.length > 0) {
                const courses = await prisma.course.findMany({
                    where: { id: { in: cleanSubIds } },
                    include: { group: true }
                });
                targetClassType = courses.some(c => parseInt(c.courseType || c.group?.classType || 1, 10) === 2) ? 2 : 1;
            }

            let needsCorrection = true;
            if (resolvedId) {
                const curGroup = await prisma.group.findUnique({ where: { id: resolvedId } });
                if (curGroup && curGroup.type === 2 && parseInt(curGroup.classType || 1, 10) === targetClassType) {
                    needsCorrection = false;
                }
            }

            if (needsCorrection && batchId) {
                const fullGroup = await prisma.group.findFirst({
                    where: {
                        batchId: parseInt(batchId),
                        type: 2,
                        classType: targetClassType
                    }
                });
                if (fullGroup) {
                    resolvedId = fullGroup.id;
                }
            }
            return resolvedId;
        };

        // 🔥 MULTI-BUSINESS UPGRADE HANDLING 🔥
        if (upgrades) {
            const parsedUpgrades = typeof upgrades === 'string' ? JSON.parse(upgrades) : upgrades;
            
            // 1. DUPLICATE PAYMENT PREVENTION LOGIC FOR ALL BATCHES
            if (safeMethod === 'slip') {
                const fiveMinutesAgo = new Date(Date.now() - 10 * 1000); // Changed to 10 seconds for testing
                for (const upg of parsedUpgrades) {
                    let parsedPaymentType = 1; 
                    if (upg.paymentMethodChosen) {
                        const methodStr = String(upg.paymentMethodChosen).toLowerCase().trim();
                        if (methodStr === 'installment' || methodStr === '2') {
                            parsedPaymentType = 2; 
                        } else if (methodStr === 'full' || methodStr === '3') {
                            parsedPaymentType = 3; 
                        }
                    }

                    const upgGroupId = upg.groupId || upg.group_id;
                    const recentDuplicatePayment = await prisma.payment.findFirst({
                        where: {
                            studentId: parseInt(studentId),
                            businessId: parseInt(upg.businessId),
                            batchId: parseInt(upg.batchId),
                            ...(upgGroupId ? { groupId: parseInt(upgGroupId) } : {}),
                            method: 'Slip',
                            payment_type: parsedPaymentType,
                            status: { notIn: [2, 5] },
                            created_at: {
                                gte: fiveMinutesAgo
                            }
                        }
                    });

                    if (recentDuplicatePayment) {
                        console.log(`🚫 Duplicate slip upload blocked for Student: ${studentId}, Batch: ${upg.batchId}`);
                        return res.status(400).json({ 
                            error: "ඔබගේ ගෙවීම මේ වනවිටත් තහවුරු වෙමින් පවතී. කරුණාකර මඳ වේලාවක් රැඳී සිටින්න." 
                        });
                    }

                    // 🔥 PREVENT ENROLLING IN ALREADY PAID SUBJECTS 🔥
                    const existingPayments = await prisma.payment.findMany({
                        where: { studentId: parseInt(studentId), status: { in: [0, 1, 4] }, payment_type: { in: [2, 3] } }
                    });
                    let enrolledSubIds = [];
                    existingPayments.forEach(p => {
                        if (p.subjects) {
                            try { enrolledSubIds.push(...JSON.parse(p.subjects).map(Number)); } catch(e) {}
                        }
                    });
                    
                    if (upg.subjects && Array.isArray(upg.subjects)) {
                        const requestedSubIds = upg.subjects.map(Number);
                        const alreadyEnrolled = requestedSubIds.some(id => enrolledSubIds.includes(id));
                        if (alreadyEnrolled) {
                            console.log(`🚫 Prevented duplicate subject enrollment for Student: ${studentId}`);
                            return res.status(400).json({ 
                                error: "ඔබ මෙම විෂයන් සඳහා මේ වනවිටත් ගෙවීම් කර ඇත! (You have already paid for some of these subjects)" 
                            });
                        }
                    }
                }
            }

            const createdPayments = [];

            // 2. CREATE PAYMENT RECORD PER BATCH
            for (const upg of parsedUpgrades) {
                let parsedPaymentType = 1; 
                if (upg.paymentMethodChosen) {
                    const methodStr = String(upg.paymentMethodChosen).toLowerCase().trim();
                    if (methodStr === 'installment' || methodStr === '2') {
                        parsedPaymentType = 2; 
                    } else if (methodStr === 'full' || methodStr === '3') {
                        parsedPaymentType = 3; 
                    }
                }

                const finalRemark = upg.remark ? `${upg.remark} | Total Slip: LKR ${amount}${remark ? ` | Student Msg: ${remark}` : ''}` : remark || null;

                const upgSubList = (typeof upg.subjects === 'string' ? JSON.parse(upg.subjects) : (upg.subjects || [])).map(Number).filter(Boolean);
                let resolvedUpgGroupId = upg.groupId ? parseInt(upg.groupId) : null;
                if (parsedPaymentType === 2 || parsedPaymentType === 3) {
                    resolvedUpgGroupId = await resolveTargetFullGroupId(upg.batchId, upg.groupId, upgSubList);
                }

                const newPayment = await prisma.payment.create({
                    data: {
                        studentId: parseInt(studentId),
                        businessId: parseInt(upg.businessId),
                        batchId: parseInt(upg.batchId),
                        groupId: resolvedUpgGroupId,
                        subjects: JSON.stringify([...new Set((typeof upg.subjects === 'string' ? JSON.parse(upg.subjects) : (upg.subjects || [])))].map(String)),
                        payment_type: parsedPaymentType,
                        method: safeMethod === 'slip' ? 'Slip' : (safeMethod === 'paycorp' ? 'Paycorp' : 'PayHere'),
                        status: initialStatus,
                        slip_image: slipFileNames,
                        amount: upg.amount ? parseFloat(parseFloat(upg.amount).toFixed(2)) : 0,
                        remark: finalRemark
                    }
                });

                await tagPendingOnline(newPayment);
                // PayHere/Paycorp Delivery Auto-Create Logic (only once the payment is really approved)
                if (initialStatus === 1 && newPayment.subjects) {
                    try {
                        const { createAutoDeliveryForPayment } = require('./paymentController');
                        await createAutoDeliveryForPayment(newPayment);
                    } catch (err) {
                        console.error("Auto Delivery Error in upgrade flow:", err);
                    }
                }

                // Lead Sync logic for card payments
                if (initialStatus === 1) {
                    try {
                        const { syncLeadEnrollment } = require('./paymentController');
                        await syncLeadEnrollment(parseInt(studentId), parsedPaymentType, newPayment);
                    } catch (e) {
                        console.error("CRM Sync Error:", e);
                    }
                }

                createdPayments.push(newPayment);
            }

            return res.status(200).json({ message: initialStatus === 1 ? "Payments Approved & Enrolled" : "Enrolled Successfully", payments: createdPayments });
        }

        // ----------------------------------------------------
        // 🔥 STANDARD SINGLE BUSINESS ENROLLMENT/UPGRADE FLOW 🔥
        // ----------------------------------------------------
        let parsedPaymentType = 1; 
        
        if (paymentMethodChosen) {
            const methodStr = String(paymentMethodChosen).toLowerCase().trim();
            if (methodStr === 'installment' || methodStr === '2') {
                parsedPaymentType = 2; 
            } else if (methodStr === 'full' || methodStr === '3') {
                parsedPaymentType = 3; 
            } else if (methodStr === 'monthly' || methodStr === '1') {
                parsedPaymentType = 1; 
            }
        }

        if (groupId) {
            const groupData = await prisma.group.findUnique({ where: { id: parseInt(groupId) } });
            if (groupData) {
                const isUpgrade = remark && remark.includes('[UPGRADE]');
                if (!isUpgrade) {
                    if (groupData.type === 1) {
                        parsedPaymentType = 1; 
                    } else if (groupData.type === 2) {
                        if (parsedPaymentType === 1) {
                            parsedPaymentType = 3; 
                        }
                    }
                }
            }
        }

        // 🔥 DUPLICATE PAYMENT PREVENTION LOGIC (START) 🔥
        if (safeMethod === 'slip') {
            const fiveMinutesAgo = new Date(Date.now() - 10 * 1000); // Changed to 10 seconds for testing // විනාඩි 5කට කලින් වෙලාව
            
            const recentDuplicatePayment = await prisma.payment.findFirst({
                where: {
                    studentId: parseInt(studentId),
                    businessId: parseInt(businessId),
                    batchId: parseInt(batchId),
                    ...(groupId ? { groupId: parseInt(groupId) } : {}),
                    method: 'Slip',
                    payment_type: parsedPaymentType,
                    status: { notIn: [2, 5] },
                    created_at: {
                        gte: fiveMinutesAgo // පහුගිය විනාඩි 5 ඇතුළත දාලද බලනවා
                    }
                }
            });

            if (recentDuplicatePayment) {
                console.log(`🚫 Duplicate slip upload blocked for Student: ${studentId}, Batch: ${businessId}`);
                // ළමයා දෙපාරක් එබුවොත් Error එකක් යවනවා අලුත් එක සේව් කරන්නේ නැතුව
                return res.status(400).json({ 
                    error: "ඔබගේ ගෙවීම මේ වනවිටත් තහවුරු වෙමින් පවතී. කරුණාකර මඳ වේලාවක් රැඳී සිටින්න." 
                });
            }
        }
        // 🔥 DUPLICATE PAYMENT PREVENTION LOGIC (END) 🔥

        let resolvedEnrollGroupId = groupId ? parseInt(groupId) : null;
        const parsedSubjectsList = (typeof subjects === 'string' ? JSON.parse(subjects) : (subjects || [])).map(Number).filter(Boolean);
        if (parsedPaymentType === 2 || parsedPaymentType === 3) {
            resolvedEnrollGroupId = await resolveTargetFullGroupId(batchId, groupId, parsedSubjectsList);
        }

        const newPayment = await prisma.payment.create({
            data: {
                studentId: parseInt(studentId),
                businessId: parseInt(businessId),
                batchId: parseInt(batchId),
                groupId: resolvedEnrollGroupId,
                subjects: JSON.stringify([...new Set((typeof subjects === 'string' ? JSON.parse(subjects) : (subjects || [])))].map(String)),
                payment_type: parsedPaymentType,
                method: safeMethod === 'slip' ? 'Slip' : (safeMethod === 'paycorp' ? 'Paycorp' : 'PayHere'),
                status: initialStatus,
                slip_image: slipFileNames,
                amount: amount ? parseFloat(parseFloat(amount).toFixed(2)) : 0,
                remark: remark || null 
            }
        });

        await tagPendingOnline(newPayment);
        // PayHere/Paycorp Delivery Auto-Create Logic (only once the payment is really approved)
        if (initialStatus === 1 && newPayment.subjects) {
            try {
                const { createAutoDeliveryForPayment } = require('./paymentController');
                await createAutoDeliveryForPayment(newPayment);
            } catch (err) {
                console.error("Auto Delivery Error in standard flow:", err);
            }
        }

        try {
            const { syncLeadEnrollment } = require('./paymentController');
            await syncLeadEnrollment(parseInt(studentId), parsedPaymentType, newPayment);
        } catch (e) {
            console.error("CRM Sync Error in enrollStudent:", e);
        }

        res.status(200).json({ message: initialStatus === 1 ? "Payment Approved & Enrolled" : "Enrolled Successfully" });
    } catch (error) {
        console.error("Enrollment Save Error:", error);
        res.status(500).json({ error: "Enrollment failed" });
    }
};

// 5. My Classroom
exports.getStudentClassroom = async (req, res) => {
    try {
        const studentId = req.user?.userId || req.user?.id;

        const overdueBatchIds = await getStudentOverdueInstallmentBatchIds(studentId);

        const validPayments = await prisma.payment.findMany({
            where: { studentId: parseInt(studentId), status: { in: [1, 4] } }
        });

        // Filter out installment payments for batches with overdue installments,
        // unless the student also has a valid full or monthly payment for that batch
        const effectivePayments = validPayments.filter(p => {
            if (p.payment_type === 2 && overdueBatchIds.has(p.batchId)) {
                const hasValidAlternative = validPayments.some(other =>
                    other.id !== p.id &&
                    other.batchId === p.batchId &&
                    [1, 3].includes(other.payment_type) &&
                    other.status === 1
                );
                return hasValidAlternative;
            }
            return true;
        });

        if (effectivePayments.length === 0) return res.status(200).json({ businesses: [] });

        const validBatchIds = [...new Set(effectivePayments.map(p => p.batchId).filter(Boolean))];
        let validGroupIds = [...new Set(effectivePayments.map(p => p.groupId).filter(Boolean))];

        let allowedSubjectIds = [];
        effectivePayments.forEach(p => {
            if (p.subjects) {
                allowedSubjectIds.push(...parseSafeSubjectIds(p.subjects));
            }
        });
        allowedSubjectIds = [...new Set(allowedSubjectIds)];

        // Ensure all groupIds for courses paid in full/installment are included in validGroupIds
        if (allowedSubjectIds.length > 0) {
            const courseGroupRecords = await prisma.course.findMany({
                where: { id: { in: allowedSubjectIds } },
                select: { groupId: true }
            });
            courseGroupRecords.forEach(c => {
                if (c.groupId && !validGroupIds.includes(c.groupId)) {
                    validGroupIds.push(c.groupId);
                }
            });
        }

        const businesses = await prisma.business.findMany({
            where: { batches: { some: { id: { in: validBatchIds } } } },
            include: {
                batches: {
                    where: { id: { in: validBatchIds } },
                    include: {
                        groups: {
                            where: validGroupIds.length > 0 ? { id: { in: validGroupIds } } : undefined,
                            include: { courses: true },
                            orderBy: [{ itemOrder: 'asc' }, { id: 'asc' }]
                        }
                    }
                }
            }
        });

        // 🔥 FIX: Map all allowed subjects to their codes AND names so we can match payments by code or name instead of just exact ID
        const paidCourses = allowedSubjectIds.length > 0 ? await prisma.course.findMany({
            where: { id: { in: allowedSubjectIds } },
            select: { id: true, code: true, name: true }
        }) : [];
        const paidCourseMap = new Map();
        paidCourses.forEach(c => paidCourseMap.set(c.id, { code: c.code, name: c.name }));

        businesses.forEach(biz => {
            biz.batches.forEach(batch => {
                batch.groups.forEach(group => {
                    // Determine which subjects were explicitly paid for in THIS group
                    const paidSubjectIdsInThisGroup = [];
                    const paidSubjectStringsInThisGroup = [];
                    effectivePayments.filter(p => p.groupId === group.id).forEach(p => {
                        if (p.subjects && p.subjects !== '[]') {
                            paidSubjectIdsInThisGroup.push(...parseSafeSubjectIds(p.subjects));
                            paidSubjectStringsInThisGroup.push(...parseSafeSubjectStrings(p.subjects));
                        }
                    });

                    // Get the paid courses details (for code/name matching) only for this group
                    const paidCoursesInThisGroup = paidCourses.filter(pc => paidSubjectIdsInThisGroup.includes(pc.id));

                    group.courses = group.courses.filter(c => {
                        const hasFullGroupPayment = effectivePayments.some(p => p.groupId === group.id && (!p.subjects || p.subjects === '[]'));
                        if (hasFullGroupPayment) return true;

                        // Check if THIS specific group's payment included this subject
                        if (paidSubjectIdsInThisGroup.includes(c.id)) return true;
                        
                        // Check if payment included this course by name or code string
                        if (c.name && paidSubjectStringsInThisGroup.includes(c.name.trim().toLowerCase())) return true;
                        if (c.code && paidSubjectStringsInThisGroup.includes(c.code.trim().toLowerCase())) return true;

                        // Check if any full/installment payment for this batch includes this course
                        const hasFullPaymentForCourse = effectivePayments.some(p => {
                            if (![2, 3].includes(p.payment_type) || p.batchId !== batch.id) return false;
                            if (!p.subjects || p.subjects === '[]') return false;
                            const subs = parseSafeSubjectIds(p.subjects);
                            if (subs.includes(c.id)) return true;
                            const subStrs = parseSafeSubjectStrings(p.subjects);
                            if (c.name && subStrs.includes(c.name.trim().toLowerCase())) return true;
                            if (c.code && subStrs.includes(c.code.trim().toLowerCase())) return true;
                            return false;
                        });
                        if (hasFullPaymentForCourse) return true;

                        // Fallback: match by code/name ONLY against subjects paid for in THIS group
                        for (const paidCourse of paidCoursesInThisGroup) {
                            const nameMatches = c.name && paidCourse.name && c.name.trim().toLowerCase() === paidCourse.name.trim().toLowerCase();
                            const codeMatches = c.code && paidCourse.code && c.code.trim().toLowerCase() === paidCourse.code.trim().toLowerCase();
                            
                            if (c.code && paidCourse.code) {
                                if (codeMatches && nameMatches) return true;
                            } else if (nameMatches) {
                                return true;
                            }
                        }
                        
                        return false;
                    });

                    // 🔥 FIX: Deduplicate courses in the group by name/type so duplicate courses in DB don't show multiple cards
                    const deduplicatedCourses = new Map();
                    group.courses.forEach(c => {
                        const key = `${(c.name || '').trim().toLowerCase()}_${c.courseType || group.classType || 1}`;
                        if (!deduplicatedCourses.has(key)) {
                            deduplicatedCourses.set(key, c);
                        } else {
                            // If this course is the exact one in paidSubjectIdsInThisGroup, prefer it
                            if (paidSubjectIdsInThisGroup.includes(c.id)) {
                                deduplicatedCourses.set(key, c);
                            }
                        }
                    });
                    group.courses = Array.from(deduplicatedCourses.values());

                    // Determine actual payment type for the student for EACH course
                    group.courses.forEach(course => {
                        const courseCode = course.code;
                        const courseName = course.name;

                        const coursePayments = validPayments.filter(p => {
                            if (p.groupId !== group.id) return false;
                            if (!p.subjects || p.subjects === '[]') return true;
                            try {
                                const subs = parseSafeSubjectIds(p.subjects);
                                const subStrs = parseSafeSubjectStrings(p.subjects);
                                if (subs.includes(course.id)) return true;
                                if (courseName && subStrs.includes(courseName.trim().toLowerCase())) return true;
                                if (courseCode && subStrs.includes(courseCode.trim().toLowerCase())) return true;
                                return subs.some(subId => {
                                    const paidCourse = paidCourseMap.get(subId);
                                    if (!paidCourse) return false;
                                    const codeMatch = courseCode && paidCourse.code && courseCode.trim().toLowerCase() === paidCourse.code.trim().toLowerCase();
                                    const nameMatch = courseName && paidCourse.name && courseName.trim().toLowerCase() === paidCourse.name.trim().toLowerCase();
                                    if (courseCode && paidCourse.code) return codeMatch && nameMatch;
                                    return nameMatch;
                                });
                            } catch (e) {
                                return false;
                            }
                        });

                        let actualType = 1; // Default to Monthly
                        if (coursePayments.some(p => p.payment_type === 3)) {
                            actualType = 3;
                        } else if (coursePayments.some(p => p.payment_type === 2)) {
                            actualType = 2;
                        }
                        course.studentPaymentType = actualType;
                    });
                });
            });

        });

        const safeData = safeJson(businesses);
        res.status(200).json({ businesses: safeData }); 
    } catch (error) {
        console.error("Classroom Error:", error);
        res.status(500).json({ error: "Failed to load classroom" });
    }
};

// 6. Course Modules
exports.getCourseModules = async (req, res) => {
    try {
        const { id } = req.params; 
        const studentId = req.user?.userId || req.user?.id;

        const requestedCourse = await prisma.course.findUnique({
            where: { id: parseInt(id) },
            include: { group: true }
        });

        let targetCourseIds = [BigInt(id)];

        if (requestedCourse && requestedCourse.group?.batchId) {
            const batchId = requestedCourse.group.batchId;
            const targetClassType = parseInt(requestedCourse.courseType || requestedCourse.group?.classType || 1, 10);

            // Check if student's installment is overdue for this batch
            const overdueBatchIds = await getStudentOverdueInstallmentBatchIds(studentId);
            if (overdueBatchIds.has(batchId)) {
                const hasValidAlternative = await prisma.payment.findFirst({
                    where: {
                        studentId: parseInt(studentId),
                        batchId: batchId,
                        payment_type: { in: [1, 3] },
                        status: 1
                    }
                });
                if (!hasValidAlternative) {
                    return res.status(403).json({
                        error: "INSTALLMENT_OVERDUE",
                        message: "ඔබගේ වාරික ගෙවීමේ (Installment) අවසන් දිනය ඉක්මවා ගොස් ඇත. පාඨමාලාවට ප්‍රවේශ වීම සඳහා කරුණාකර හිඟ වාරිකය ගෙවන්න.",
                        isOverdue: true
                    });
                }
            }

            const fullPayments = await prisma.payment.findMany({
                where: {
                    studentId: parseInt(studentId),
                    batchId: batchId,
                    payment_type: { in: [2, 3] },
                    status: { in: [1, 4] }
                },
                include: { group: true }
            });

            // Filter out overdue installment payments from fullPayments
            const activeFullPayments = fullPayments.filter(p => {
                if (p.payment_type === 2 && overdueBatchIds.has(p.batchId)) return false;
                return true;
            });

            if (activeFullPayments.length > 0) {
                // If Full Payment, fetch all courses in this batch with the same code OR same name AND matching classType!
                const similarCoursesRaw = await prisma.course.findMany({
                    where: {
                        OR: [
                            requestedCourse.code ? { code: requestedCourse.code } : undefined,
                            { name: requestedCourse.name }
                        ].filter(Boolean),
                        group: { 
                            batchId: batchId,
                            classType: targetClassType
                        },
                        courseType: targetClassType
                    }
                });

                // 🔥 FIX: Filter out courses that clearly belong to a different subject or different classType
                const similarCourses = similarCoursesRaw.filter(c => {
                    const cClassType = parseInt(c.courseType || c.group?.classType || 1, 10);
                    if (cClassType !== targetClassType) return false;

                    if (c.name === requestedCourse.name) return true;
                    if (requestedCourse.code && c.code === requestedCourse.code) {
                        const reqFirstWord = requestedCourse.name.trim().split(/[\s-]+/)[0].toLowerCase();
                        const cFirstWord = (c.name || '').trim().split(/[\s-]+/)[0].toLowerCase();
                        return reqFirstWord === cFirstWord;
                    }
                    return false;
                });
                
                const similarCourseIds = similarCourses.map(c => parseInt(c.id));
                
                const validFullPayments = activeFullPayments.filter(p => {
                    const groupMatches = parseInt(p.group?.classType || 1, 10) === targetClassType;
                    if (!p.subjects) return groupMatches;
                    try {
                        const subs = parseSafeSubjectIds(p.subjects);
                        const hasMatchingSubject = subs.some(subId => similarCourseIds.includes(subId));
                        if (hasMatchingSubject) return true;
                        return groupMatches;
                    } catch (e) {
                        return groupMatches;
                    }
                });

                if (validFullPayments.length > 0) {
                    targetCourseIds = similarCourses.map(c => BigInt(c.id));
                }
            }

            // 🔥 FIX: Also for monthly payments, if student has paid for multiple monthly groups of the same subject in this batch,
            // merge them into targetCourseIds so the student can access contents across all the months they have paid for!
            const validMonthlyPayments = await prisma.payment.findMany({
                where: {
                    studentId: parseInt(studentId),
                    batchId: batchId,
                    payment_type: 1,
                    status: { in: [1, 4] },
                    group: { classType: targetClassType }
                }
            });

            if (validMonthlyPayments.length > 0) {
                const paidSubIds = new Set();
                validMonthlyPayments.forEach(p => {
                    if (p.subjects) {
                        parseSafeSubjectIds(p.subjects).forEach(id => paidSubIds.add(id));
                    }
                });

                if (paidSubIds.size > 0) {
                    const paidMonthlyCourses = await prisma.course.findMany({
                        where: {
                            id: { in: Array.from(paidSubIds) },
                            group: { batchId: batchId, classType: targetClassType }
                        }
                    });

                    const reqNorm = (requestedCourse.name || '').trim().toLowerCase();
                    const reqCode = (requestedCourse.code || '').trim().toLowerCase();

                    paidMonthlyCourses.forEach(pmc => {
                        const pmcNorm = (pmc.name || '').trim().toLowerCase();
                        const pmcCode = (pmc.code || '').trim().toLowerCase();

                        const isMatch = (reqNorm && pmcNorm && reqNorm === pmcNorm) ||
                                        (reqCode && pmcCode && reqCode === pmcCode);

                        if (isMatch) {
                            const pmcBig = BigInt(pmc.id);
                            if (!targetCourseIds.some(tid => tid.toString() === pmcBig.toString())) {
                                targetCourseIds.push(pmcBig);
                            }
                        }
                    });
                }
            }
        }

        // 🔥 FIX: Include sibling duplicate courses in the same group so contents assigned to duplicate courses are accessible
        if (requestedCourse && requestedCourse.groupId && requestedCourse.name) {
            const sameGroupSiblings = await prisma.course.findMany({
                where: {
                    groupId: requestedCourse.groupId,
                    name: requestedCourse.name
                },
                select: { id: true }
            });
            sameGroupSiblings.forEach(s => {
                const sBig = BigInt(s.id);
                if (!targetCourseIds.some(tid => tid.toString() === sBig.toString())) {
                    targetCourseIds.push(sBig);
                }
            });
        }

        const linkedContents = await prisma.contentCourse.findMany({
            where: { course_id: { in: targetCourseIds } }
        });
        
        const contentIds = linkedContents.map(lc => lc.content_id);
        
        const contentsRaw = await prisma.content.findMany({
            where: { id: { in: contentIds } },
            include: { group: true, paper: true },
            orderBy: { createdAt: 'desc' }
        });

        // 🔥 FIX: Deduplicate contents to prevent showing duplicates when enrolled in both Monthly and Full Payment courses
        // Same title is NOT enough to call two items duplicates (different lecturers
        // reuse titles) — dedupe on title + type + actual media. See src/modules/content/rules.js
        const contents = require('../src/modules/content/rules').dedupeContents(contentsRaw);

        const groupIds = [...new Set(contents.map(c => c.contentGroupId).filter(Boolean))];
        const groupTitles = [...new Set(contents.map(c => c.group?.title).filter(Boolean))];
        const batchIdForGroups = requestedCourse?.group?.batchId;
        const targetClassType = parseInt(requestedCourse?.courseType || requestedCourse?.group?.classType || 1, 10);

        let allSubjectCourseCodes = [];
        if (requestedCourse?.code) allSubjectCourseCodes.push(requestedCourse.code);
        allSubjectCourseCodes.push(`SUB_${requestedCourse?.id}`);
        if (requestedCourse && batchIdForGroups) {
            const subjectCoursesInBatch = await prisma.course.findMany({
                where: {
                    name: requestedCourse.name,
                    group: { batchId: batchIdForGroups, classType: targetClassType }
                },
                select: { id: true, code: true }
            });
            subjectCoursesInBatch.forEach(sc => {
                if (sc.code) allSubjectCourseCodes.push(sc.code);
                allSubjectCourseCodes.push(`SUB_${sc.id}`);
            });
        }
        allSubjectCourseCodes = [...new Set(allSubjectCourseCodes.filter(Boolean))];

        const initialGroups = await prisma.contentGroup.findMany({
             where: { 
                 classType: targetClassType,
                 OR: [
                     batchIdForGroups ? { batchId: batchIdForGroups, courseCode: { in: allSubjectCourseCodes } } : undefined,
                     batchIdForGroups ? { batchId: batchIdForGroups, courseCode: null } : undefined,
                     batchIdForGroups ? { batchId: batchIdForGroups, courseCode: '' } : undefined,
                     batchIdForGroups ? { additionalBatchIds: { contains: `,${batchIdForGroups},` } } : undefined,
                     batchIdForGroups && groupTitles.length > 0 ? { batchId: batchIdForGroups, title: { in: groupTitles } } : undefined,
                     batchIdForGroups ? {
                         batchId: batchIdForGroups,
                         parentId: null,
                         OR: [
                             { title: { contains: 'month' } },
                             { title: { contains: 'මාස' } },
                             { title: { in: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December", "General", "General Content"] } }
                         ]
                     } : undefined,
                     { id: { in: groupIds } }
                 ].filter(Boolean)
             },
             orderBy: { itemOrder: 'asc' }
        });

        // Also fetch any missing parent folders for subfolders
        const parentIdsToFetch = initialGroups.map(g => g.parentId).filter(Boolean);
        let allGroupsMap = new Map();
        initialGroups.forEach(g => allGroupsMap.set(g.id, g));

        if (parentIdsToFetch.length > 0) {
            const parentGroups = await prisma.contentGroup.findMany({
                where: { id: { in: parentIdsToFetch }, classType: targetClassType }
            });
            parentGroups.forEach(pg => allGroupsMap.set(pg.id, pg));
        }

        // Also fetch any subfolders of root folders
        const rootIds = Array.from(allGroupsMap.values()).filter(g => !g.parentId).map(g => g.id);
        if (rootIds.length > 0) {
            const subGroups = await prisma.contentGroup.findMany({
                where: { parentId: { in: rootIds }, classType: targetClassType }
            });
            subGroups.forEach(sg => allGroupsMap.set(sg.id, sg));
        }

        const normalizeMonthTitle = (title) => {
            if (!title) return '';
            return title.toLowerCase()
                .replace(/octomber/gi, 'october')
                .replace(/septeber/gi, 'september')
                .replace(/[\s_-]+/g, ' ')
                .replace(/\b(month|batch|මාසය|මාස|පාඩම|පාඩම්)\b/gi, '')
                .trim();
        };

        const lessonGroups = Array.from(allGroupsMap.values()).sort((a, b) => (a.itemOrder || 1) - (b.itemOrder || 1));

        const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
        const sinhalaMonths = ["ජනවාරි", "පෙබරවාරි", "මාර්තු", "අප්‍රේල්", "මැයි", "ජූනි", "ජූලි", "අගෝස්තු", "සැප්තැම්බර්", "ඔක්තෝබර්", "නොවැම්බර්", "දෙසැම්බර්"];

        const contentsProcessed = contents.map(c => {
            let finalGroupId = c.contentGroupId;
            let groupTitle = c.group?.title || null;

            const typeInt = (c.contentType === 'live' || c.contentType === '1') ? 1
                : (c.contentType === 'recording' || c.contentType === '2') ? 2
                : (c.contentType === 'document' || c.contentType === '3') ? 3
                : (c.contentType === 'testRanking' || c.contentType === 'rankingTest' || c.contentType === 'ranking_test' || c.contentType === 'test' || c.contentType === 'sPaper' || c.contentType === '4' || c.contentType === 'paper' || c.contentType === '5') ? 4 : 1;

            if (finalGroupId && !lessonGroups.some(g => g.id === finalGroupId)) {
                if (groupTitle) {
                    const rawItem = groupTitle.trim().toLowerCase();
                    const normItem = normalizeMonthTitle(groupTitle);
                    const matched = lessonGroups.find(g => {
                        if (g.type && g.type !== typeInt && !(typeInt === 3 && g.type === 2)) return false;
                        const gRaw = (g.title || '').trim().toLowerCase();
                        const gNorm = normalizeMonthTitle(g.title);
                        return gRaw === rawItem || (normItem && gNorm && gNorm === normItem);
                    });
                    if (matched) {
                        finalGroupId = matched.id;
                        groupTitle = matched.title;
                    }
                }
            }

            // Smart month matching fallback for cross-batch or uncategorized items
            if (!finalGroupId || !lessonGroups.some(g => g.id === finalGroupId)) {
                let targetMonthIdx = -1;
                if (c.date) {
                    try {
                        const d = new Date(c.date);
                        if (!isNaN(d.getTime())) targetMonthIdx = d.getMonth();
                    } catch (err) {}
                }
                if (targetMonthIdx === -1 && c.title) {
                    const titleLower = c.title.toLowerCase();
                    targetMonthIdx = monthNames.findIndex(m => titleLower.includes(m));
                    if (targetMonthIdx === -1) {
                        targetMonthIdx = sinhalaMonths.findIndex(m => titleLower.includes(m));
                    }
                }
                if (targetMonthIdx !== -1) {
                    const engMonth = monthNames[targetMonthIdx];
                    const sinMonth = sinhalaMonths[targetMonthIdx];
                    const matched = lessonGroups.find(g => {
                        if (g.type && g.type !== typeInt && !(typeInt === 3 && g.type === 2)) return false;
                        const gTitle = (g.title || '').toLowerCase();
                        const gNorm = normalizeMonthTitle(g.title);
                        return gTitle.includes(engMonth) || gTitle.includes(sinMonth) ||
                               gNorm.includes(engMonth) || gNorm.includes(sinMonth);
                    });
                    if (matched) {
                        finalGroupId = matched.id;
                        groupTitle = matched.title;
                    }
                }
            }

            // Display-only: the folder is NOT written back to the database. Read requests used to
            // "auto-heal" contentGroupId, and web, app and Content Hub each guessed differently, so
            // recordings kept moving between folders. Only staff (Content Hub edit) change folders now.

            return {
                ...c,
                contentGroupId: finalGroupId,
                content_group_id: finalGroupId,
                groupTitle: groupTitle
            };
        });

        const liveClasses = contentsProcessed.filter(c => c.contentType === 'live' || c.contentType === '1');
        const recordings = contentsProcessed.filter(c => c.contentType === 'recording' || c.contentType === '2');
        const documents = contentsProcessed.filter(c => c.contentType === 'document' || c.contentType === '3');
        const sPapers = contentsProcessed.filter(c => c.contentType === 'sPaper' || c.contentType === '4');
        const papers = contentsProcessed.filter(c => c.contentType === 'paper' || c.contentType === '5');
        const rankingTests = contentsProcessed.filter(c => ['testRanking', 'rankingTest', 'ranking_test', 'test', 'sPaper', 'paper', '4', '5'].includes(c.contentType));

        const safeData = safeJson({ 
            course: requestedCourse,
            lessonGroups, 
            contents: contentsProcessed,
            liveClasses,
            recordings,
            documents,
            sPapers,
            papers,
            rankingTests,
            paidStatus: 1 
        });
        
        res.status(200).json(safeData);
    } catch (error) {
        console.error("Module Error:", error);
        res.status(500).json({ error: "Failed to load modules" });
    }
};

// 7. Payment History
exports.getMyPayments = async (req, res) => {
    try {
        const studentId = req.user?.userId || req.user?.id;
        console.log(`[getMyPayments] Called for Student ID: ${studentId}`);

        // Auto-heal: Ensure next installment phase is generated if previous installment is approved
        try {
            const approvedInsts = await prisma.payment.findMany({
                where: {
                    studentId: parseInt(studentId),
                    payment_type: 2,
                    status: 1
                },
                orderBy: { installment_no: 'desc' }
            });

            const checkedBatches = new Set();
            const { createNextInstallmentPhase } = require('./paymentController');
            for (const inst of approvedInsts) {
                if (!inst.batchId || checkedBatches.has(inst.batchId)) continue;
                checkedBatches.add(inst.batchId);
                await createNextInstallmentPhase(inst);
            }
        } catch (healErr) {
            console.error("Auto-heal next installment error:", healErr);
        }

        const payments = await prisma.payment.findMany({
            where: { 
                studentId: parseInt(studentId),
                OR: [
                    { status: { not: 5 } },
                    {
                        status: 5,
                        OR: [
                            { due_date: { not: null } },
                            { method: 'Upcoming' }
                        ]
                    }
                ]
            },
            include: { business: true, batch: true, group: true },
            orderBy: { created_at: 'desc' }
        });

        const studentData = await prisma.user.findUnique({ 
            where: { id: parseInt(studentId) }, 
            select: { walletBalance: true } 
        });

        const allPaymentSubjectIds = [];
        payments.forEach(p => {
            if (p.subjects) allPaymentSubjectIds.push(...parseSafeSubjectIds(p.subjects));
        });
        const paidCoursesTypeMap = new Map();
        const paidCoursesPriceMap = new Map();
        if (allPaymentSubjectIds.length > 0) {
            const fetchedCourses = await prisma.course.findMany({
                where: { id: { in: [...new Set(allPaymentSubjectIds)] } },
                select: { id: true, courseType: true, price: true }
            });
            fetchedCourses.forEach(c => {
                paidCoursesTypeMap.set(c.id, c.courseType);
                paidCoursesPriceMap.set(c.id, parseFloat(c.price || 0));
            });
        }

        const formattedPayments = payments.map(p => {
            let frontendStatus = p.status;
            if (p.status === 0 && p.method === 'Slip') frontendStatus = -1; 
            else if (p.status === 0 && p.method === 'Upcoming') frontendStatus = 0; 

            let resolvedClassType = parseInt(p.group?.classType || 1);
            let paymentSubjectsList = [];
            if (p.subjects) {
                try {
                    paymentSubjectsList = parseSafeSubjectIds(p.subjects);
                    if (paymentSubjectsList.length > 0) {
                        const types = paymentSubjectsList.map(id => paidCoursesTypeMap.get(id)).filter(Boolean);
                        const hasPaper = types.some(t => t === 2);
                        const hasTheory = types.some(t => t === 1);
                        if (hasPaper && !hasTheory) resolvedClassType = 2;
                        else if (hasTheory && !hasPaper) resolvedClassType = 1;
                    }
                } catch(e) {}
            }
            const classTypeName = resolvedClassType === 2 ? 'Paper Class' : 'Theory Class';

            let resolvedAmount = parseFloat(p.amount || 0);
            if (resolvedAmount === 0 && p.remark) {
                const match = String(p.remark).match(/(?:Extracted Total|Target Amount|Wallet Excess \(-?LKR|Wallet Due \(\+?LKR|Wallet adjusted by LKR [+-]?|LKR|Rs\.?)\s*:?\s*(?:LKR|Rs\.?)?\s*([\d,]+(?:\.\d+)?)/i);
                if (match && match[1]) {
                    resolvedAmount = parseFloat(match[1].replace(/,/g, ''));
                }
            }

            if (resolvedAmount === 0 && paymentSubjectsList.length > 0) {
                const subjectsSum = paymentSubjectsList.reduce((acc, subId) => acc + (paidCoursesPriceMap.get(subId) || 0), 0);
                if (subjectsSum > 0) {
                    resolvedAmount = subjectsSum;
                }
            }

            return {
                id: p.id,
                businessId: p.businessId || p.business?.id || p.batch?.businessId,
                batchId: p.batchId,
                groupId: p.groupId,
                courseName: `${p.business?.name || 'Course'} - ${p.batch?.name || 'Batch'} - ${p.group?.name || 'Unknown'}`,
                groupName: p.group?.name,
                classType: resolvedClassType,
                classTypeName: classTypeName,
                slips: p.slip_image ? p.slip_image.split(',') : [],
                amount: resolvedAmount, 
                actualAmountPaid: resolvedAmount,
                remark: p.remark,
                status: frontendStatus,
                createdDate: p.created_at,
                dueDate: p.due_date,
                isInstallment: p.payment_type === 2,
                installmentNo: p.installment_no,
                method: p.method,
                excessAmount: p.excessAmount || 0,  
                arrearsAmount: p.arrearsAmount || 0 
            };
        });

        // -- PROACTIVE UPCOMING MONTHLY PAYMENTS LOGIC FOR MY PAYMENTS --
        const today = new Date();
        if (today.getDate() >= 24 || today.getDate() <= 15) {
            const validMonthly = await prisma.payment.findMany({
                where: { studentId: parseInt(studentId), status: { in: [0, 1, 4] }, payment_type: 1 },
                include: { group: true, batch: { include: { business: true } } }
            });
            
            const batchMap = {};
            validMonthly.forEach(p => {
                if (!p.batchId || !p.group) return;
                if (!batchMap[p.batchId]) {
                    batchMap[p.batchId] = { batch: p.batch, highestGroup: p.group, subjects: p.subjects };
                } else {
                    if (p.group.itemOrder > batchMap[p.batchId].highestGroup.itemOrder) {
                        batchMap[p.batchId].highestGroup = p.group;
                        batchMap[p.batchId].subjects = p.subjects;
                    }
                }
            });

            for (let batchId in batchMap) {
                const { batch, highestGroup, subjects } = batchMap[batchId];
                
                const nextGroup = await prisma.group.findFirst({
                    where: {
                        batchId: parseInt(batchId),
                        type: 1, 
                        itemOrder: { gt: highestGroup.itemOrder }
                    },
                    orderBy: { itemOrder: 'asc' }
                });

                if (nextGroup) {
                    const existingPayment = await prisma.payment.findFirst({
                        where: {
                            studentId: parseInt(studentId),
                            batchId: parseInt(batchId),
                            groupId: nextGroup.id,
                            status: { not: 3 }
                        }
                    });

                    if (!existingPayment) {
                        let amount = 0;
                        const parsedSubjects = parseSafeSubjectIds(subjects);
                        
                        if (parsedSubjects.length > 0) {
                            const courses = await prisma.course.findMany({
                                where: { id: { in: parsedSubjects } }
                            });
                            amount = calculateGroupAmount(nextGroup, courses);
                        }

                        const nextMonthDueDate = new Date(today.getFullYear(), today.getMonth() + 1, 5);
                        
                        // Push into formattedPayments
                        formattedPayments.push({
                            id: `virtual_${nextGroup.id}`,
                            courseName: `${batch.business?.name || 'Course'} - ${batch.name || 'Batch'} - ${nextGroup.name}`,
                            groupName: nextGroup.name,
                            groupId: nextGroup.id,
                            batchId: batch.id,
                            businessId: batch.businessId,
                            subjects: subjects,
                            slips: [],
                            amount: amount, 
                            status: 0, // Pending/Due
                            createdDate: nextMonthDueDate,
                            dueDate: nextMonthDueDate,
                            isInstallment: false,
                            method: 'Upcoming',
                            isUpcomingMonthly: true
                        });
                    }
                }
            }
        }
        // ------------------------------------------------

        const safeData = safeJson({
            oldPayments: formattedPayments,
            walletBalance: studentData?.walletBalance || 0
        });
        
        res.status(200).json(safeData); 
    } catch (error) {
        console.error("History Error:", error);
        res.status(200).json({ oldPayments: [], walletBalance: 0 }); 
    }
};

// 8. Profile
exports.updateProfile = async (req, res) => {
    try {
        const rawId = req.user?.userId || req.user?.id || req.userId || req.user;
        const studentId = parseInt(rawId);

        if (!studentId || isNaN(studentId)) {
            return res.status(401).json({ error: "User authorization failed. Please relogin." });
        }

        const { addressHouseNo, addressStreet, city, district } = req.body;
        const image = req.file ? req.file.filename : undefined;

        let updateData = { addressHouseNo, addressStreet, city, district };
        if (image) { updateData.image = image; }

        await prisma.user.update({
            where: { id: studentId },
            data: updateData
        });

        res.status(200).json({ message: "Profile updated successfully", image: image || null });
    } catch (error) {
        console.error("Profile Update Error:", error);
        res.status(500).json({ error: "Failed to update profile" });
    }
};

exports.updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.userId;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: "User not found" });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(401).json({ error: "Incorrect current password" });

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: userId },
            data: { 
                password: hashedPassword,
                session_id: crypto.randomBytes(16).toString('hex')
            }
        });

        res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
        console.error("Password Update Error:", error);
        res.status(500).json({ error: "Failed to update password" });
    }
};

// 🔥 NEW: Handle Due Slip Uploads / Online Pay For Dues
exports.uploadDueSlip = async (req, res) => {
    try {
        const { paymentId, remark, method, isVirtual, businessId, batchId, groupId, amount, subjects } = req.body;
        const safeMethod = String(method || '').toLowerCase().trim();

        if (!paymentId) {
            return res.status(400).json({ error: "Invalid or missing paymentId" });
        }

        const slipFileNames = req.files && req.files.length > 0 
            ? req.files.map(f => f.filename).join(',') 
            : null;

        if (safeMethod !== 'payhere' && !slipFileNames) {
            return res.status(400).json({ error: "No slips provided" });
        }

        let updatedPayment;

        if (isVirtual === 'true' || String(paymentId).startsWith('virtual_')) {
            const rawStudentId = req.user?.userId || req.user?.id;
            if (!rawStudentId) return res.status(401).json({ error: "Unauthorized" });

            updatedPayment = await prisma.payment.create({
                data: {
                    studentId: parseInt(rawStudentId),
                    businessId: parseInt(businessId),
                    batchId: parseInt(batchId),
                    groupId: parseInt(groupId),
                    amount: parseFloat(amount),
                    subjects: subjects || '[]',
                    payment_type: 1, // Monthly
                    status: safeMethod === 'payhere' ? 1 : 0,
                    method: safeMethod === 'payhere' ? 'PayHere' : 'Slip',
                    slip_image: slipFileNames,
                    remark: remark || null,
                    due_date: null
                }
            });
        } else {
            if (isNaN(parseInt(paymentId))) {
                return res.status(400).json({ error: "Invalid paymentId format" });
            }

            const existingPayment = await prisma.payment.findUnique({
                where: { id: parseInt(paymentId) }
            });

            if (!existingPayment) {
                return res.status(404).json({ error: "Payment record not found" });
            }

            if (existingPayment.status === 1 || existingPayment.status === 3) {
                return res.status(400).json({ error: "මෙම ගෙවීම දැනටමත් සිදුකර ඇත. නැවත රිසිට්පත් උඩුගත කළ නොහැක." });
            }

            updatedPayment = await prisma.payment.update({
                where: { id: parseInt(paymentId) },
                data: {
                    slip_image: slipFileNames || existingPayment.slip_image,
                    method: safeMethod === 'payhere' ? 'PayHere' : 'Slip',
                    status: safeMethod === 'payhere' ? 1 : 0, 
                    remark: remark ? (existingPayment.remark ? `${existingPayment.remark}\n${remark}` : remark) : existingPayment.remark
                }
            });
        }

        // PayHere Delivery & CRM Auto-Create Logic
        if (safeMethod === 'payhere' && updatedPayment.subjects) {
            try {
                const { createAutoDeliveryForPayment } = require('./paymentController');
                await createAutoDeliveryForPayment(updatedPayment);
            } catch (err) {
                console.error("Auto Delivery Error for due payment:", err);
            }

            try {
                const { syncLeadEnrollment } = require('./paymentController');
                await syncLeadEnrollment(parseInt(updatedPayment.studentId), updatedPayment.payment_type, updatedPayment);
            } catch (e) {
                console.error("CRM Sync Error for due payment:", e);
            }
        }

        res.status(200).json({ message: safeMethod === 'payhere' ? "Payment updated successfully" : "Slip uploaded successfully" });
    } catch (error) {
        console.error("Upload Due Slip Error:", error);
        res.status(500).json({ error: "Failed to upload slip" });
    }
};

// ==========================================
// 🔥 STUDENT DATA CENTER (ADMIN/STAFF USE) 🔥
// ==========================================

exports.getStudentsDataCenter = async (req, res) => {
    try {
        const students = await prisma.user.findMany({
            where: {
                role: {
                    in: ['Student', 'STUDENT', 'user', 'USER']
                }
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                whatsapp: true,
                optionalPhone: true,
                nic: true,
                addressHouseNo: true,
                addressStreet: true,
                city: true,
                district: true,
                image: true,
                role: true,
                payments: {
                    where: { status: { in: [1, 4] } },
                    include: {
                        business: true,
                        batch: true,
                        group: { select: { id: true, name: true, type: true } }
                    }
                }
            },
            orderBy: { id: 'desc' }
        });

        const allCourses = await prisma.course.findMany({ select: { id: true, name: true } });
        const courseMap = {};
        allCourses.forEach(c => {
            courseMap[c.id] = c.name;
        });

        const formattedStudents = students.map(student => {
            const enrolledBusinesses = new Set();
            const enrolledBatches = new Set();
            const enrolledSubjects = new Set();
            const enrolledGroupsMap = new Map(); // Use Map to prevent duplicates by group ID

            student.payments.forEach(p => {
                if (p.business) enrolledBusinesses.add(p.business.name);
                if (p.batch) enrolledBatches.add(p.batch.name);
                if (p.group) {
                    enrolledGroupsMap.set(p.group.id, {
                        id: p.group.id,
                        name: p.group.name,
                        type: p.group.type,
                        batchName: p.batch?.name
                    });
                }
                if (p.subjects) {
                    try {
                        const parsed = JSON.parse(p.subjects);
                        parsed.forEach(sub => {
                            const subId = parseInt(sub.id || sub);
                            if (courseMap[subId]) {
                                enrolledSubjects.add(courseMap[subId]);
                            }
                        });
                    } catch(e) {}
                }
            });

            delete student.payments;

            return {
                ...student,
                enrolledBusinesses: Array.from(enrolledBusinesses),
                enrolledBatches: Array.from(enrolledBatches),
                enrolledSubjects: Array.from(enrolledSubjects),
                enrolledGroups: Array.from(enrolledGroupsMap.values())
            };
        });

        res.status(200).json(safeJson(formattedStudents));
    } catch (error) {
        console.error("Error fetching students data center:", error);
        res.status(500).json({ error: "Failed to fetch students" });
    }
};

const normalizePhone = (p) => {
    if (!p) return p;
    let num = String(p).replace(/[\s-]/g, '');
    if (num.startsWith('+94')) {
        num = '0' + num.slice(3);
    } else if (num.startsWith('94') && num.length === 11) {
        num = '0' + num.slice(2);
    }
    return num;
};

exports.updateStudentByAdmin = async (req, res) => {
    try {
        let { 
            id, firstName, lastName, phone, whatsapp, optionalPhone, 
            nic, addressHouseNo, addressStreet, city, district 
        } = req.body;

        phone = normalizePhone(phone);
        whatsapp = normalizePhone(whatsapp);
        optionalPhone = normalizePhone(optionalPhone);

        await prisma.user.update({
            where: { id: parseInt(id) },
            data: { 
                firstName, lastName, phone, whatsapp, optionalPhone, 
                nic, addressHouseNo, addressStreet, city, district 
            }
        });
        res.status(200).json({ message: "Student updated successfully" });
    } catch (error) {
        console.error("Update student error:", error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: "Phone number or NIC already exists for another student." });
        }
        res.status(500).json({ error: "Failed to update student" });
    }
};

exports.resetStudentPassword = async (req, res) => {
    try {
        const { studentId, newPassword } = req.body;
        if (!studentId || !newPassword) {
            return res.status(400).json({ error: "Student ID and new password are required" });
        }

        const targetUser = await prisma.user.findUnique({ where: { id: parseInt(studentId) } });
        if (!targetUser) return res.status(404).json({ error: "Student not found" });

        const targetRole = String(targetUser.role || '').trim().toUpperCase();
        const callerRole = String(req.user?.role || '').trim().toUpperCase();
        const isAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER_ADMIN', 'ADMIN'].includes(callerRole);

        if (targetRole !== 'STUDENT' && !isAdmin) {
            return res.status(403).json({ error: "Unauthorized: Only student accounts can be reset." });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        await prisma.user.update({
            where: { id: targetUser.id },
            data: { 
                password: hashedPassword,
                session_id: crypto.randomBytes(16).toString('hex')
            }
        });
        
        res.status(200).json({ message: "Password reset successful" });
    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ error: "Failed to reset password" });
    }
};

exports.ghostLogin = async (req, res) => {
    try {
        const { studentId } = req.body;
        if (!studentId) {
            return res.status(400).json({ error: "Student ID is required" });
        }

        const user = await prisma.user.findUnique({ where: { id: parseInt(studentId) } });
        if (!user) return res.status(404).json({ error: "Student not found" });

        const targetRole = String(user.role || '').trim().toUpperCase();
        const callerRole = String(req.user?.role || '').trim().toUpperCase();
        const isAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER_ADMIN', 'ADMIN'].includes(callerRole);

        if (targetRole !== 'STUDENT' && !isAdmin) {
            return res.status(403).json({ error: "Unauthorized: Ghost login is only permitted for student accounts." });
        }

        const sessionId = crypto.randomBytes(16).toString('hex');
        await prisma.user.update({
            where: { id: user.id },
            data: { session_id: sessionId }
        });

        const token = jwt.sign(
            { id: user.id, userId: user.id, role: user.role, sessionId: sessionId },
            process.env.JWT_SECRET || "ima_super_secret_token_12345", 
            { expiresIn: '1d' }
        );

        delete user.password;

        res.status(200).json(safeJson({ token, user }));
    } catch (error) {
        console.error("Ghost login error:", error);
        res.status(500).json({ error: "Failed to ghost login" });
    }
};

// ==========================================
// 🚚 STUDENT DELIVERY MODULE 
// ==========================================

exports.getMyDeliveries = async (req, res) => {
    try {
        const studentId = req.user?.userId || req.user?.id;

        if (!studentId) {
            return res.status(401).json({ error: "Unauthorized access" });
        }

        const deliveries = await prisma.delivery.findMany({
            where: { studentId: studentId.toString() },
            include: { items: true },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json(safeJson(deliveries));
    } catch (error) {
        console.error("Fetch Deliveries Error:", error);
        res.status(500).json({ error: "Failed to fetch deliveries." });
    }
};

exports.confirmDelivery = async (req, res) => {
    try {
        const { deliveryId, status } = req.body;
        const studentId = req.user?.userId || req.user?.id;

        if (!studentId) {
            return res.status(401).json({ error: "Unauthorized access" });
        }

        const existingDelivery = await prisma.delivery.findFirst({
            where: { id: parseInt(deliveryId), studentId: studentId.toString() }
        });

        if (!existingDelivery || existingDelivery.status !== 'On the way') {
            return res.status(400).json({ error: "Invalid request or delivery is not 'On the way'." });
        }

        const updatedDelivery = await prisma.delivery.update({
            where: { id: parseInt(deliveryId) },
            data: { 
                status: status, 
                resolvedAt: new Date()
            }
        });

        res.status(200).json({ message: `Delivery marked as ${status}`, data: safeJson(updatedDelivery) });
    } catch (error) {
        console.error("Confirm Delivery Error:", error);
        res.status(500).json({ error: "Failed to update delivery status." });
    }
};

const youtubedl = require('yt-dlp-exec');
const path = require('path');
const fs = require('fs');

// 🔥 PERMANENT YOUTUBE DIRECT STREAM FIX (YT-DLP WITH COOKIES) 🔥
exports.getVideoStream = async (req, res) => {
    try {
        const videoId = req.params.videoId;
        
        console.log(`🎬 YouTube Secure Stream request for ID: ${videoId}`);

        if (!videoId) {
            return res.status(400).json({ error: 'Invalid YouTube ID' });
        }

        const cookiePath = path.join(__dirname, '..', 'yt_cookies.txt');
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        const options = {
            dumpSingleJson: true,
            noWarnings: true,
            noCallHome: true,
            noCheckCertificate: true,
            youtubeSkipDashManifest: true,
            format: 'best'
        };

        if (fs.existsSync(cookiePath)) {
            options.cookies = cookiePath;
        }

        // Fetch direct video URL using yt-dlp
        const output = await youtubedl(videoUrl, options);

        if (!output || !output.url) {
            throw new Error("Could not extract video URL");
        }

        res.status(200).json({ 
            stream_url: output.url,
            is_youtube_embed: false, 
            yt_id: videoId
        });

    } catch (error) {
        console.error("❌ yt-dlp Error (Falling back to iframe):", error.message);
        const embedUrl = `https://www.youtube.com/embed/${req.params.videoId}?rel=0&modestbranding=1`;
        res.status(200).json({ 
            stream_url: embedUrl,
            is_youtube_embed: true, 
            yt_id: req.params.videoId
        });
    }
};

// 🔥 NEW: Delete Student Account (Safe Delete with Relations & Debugging) 🔥

// 🔥 FIXED: Pay Due Online
exports.payDueOnline = async (req, res) => {
    try {
        const { paymentId, orderId, method, isVirtual, businessId, batchId, groupId, amount, subjects } = req.body;
        const rawStudentId = req.user?.userId || req.user?.id;

        if (!rawStudentId) return res.status(401).json({ error: "Unauthorized" });
        const studentId = parseInt(rawStudentId);

        const safeMethod = method === 'payhere' || method === 'PayHere' ? 'PayHere' : 'Paycorp';
        const payService = require('../src/modules/payments/service');
        const payRules = require('../src/modules/payments/rules');
        const gatewayRef = `Sampath IPG ID: ${orderId || 'Direct'}`;

        let updatedPayment;
        let claim;

        if (isVirtual === 'true' || String(paymentId).startsWith('virtual_')) {
            // Only the gateway's server-side confirmation may make this payment approved.
            claim = await payService.claimOnlinePayment(safeMethod, orderId, { studentId, amount });
            const marker = claim.approve ? '' : ` ${payRules.onlineMarker(safeMethod.toLowerCase(), orderId)} Waiting for gateway confirmation (${claim.reason})`;
            updatedPayment = await prisma.payment.create({
                data: {
                    studentId: studentId,
                    businessId: parseInt(businessId),
                    batchId: parseInt(batchId),
                    groupId: parseInt(groupId),
                    amount: parseFloat(amount),
                    subjects: subjects || '[]',
                    payment_type: 1, // Monthly
                    status: claim.approve ? 1 : 0,
                    method: safeMethod,
                    remark: `${gatewayRef}${marker}`,
                    due_date: null
                }
            });
        } else {
            const payment = await prisma.payment.findFirst({
                where: { id: parseInt(paymentId), studentId: studentId }
            });

            if (!payment) return res.status(404).json({ error: "Payment not found" });
            if (payment.status === 1) return res.status(200).json({ message: "Payment already approved" });

            claim = await payService.claimOnlinePayment(safeMethod, orderId, { studentId, amount: payment.amount });
            const marker = claim.approve ? '' : ` ${payRules.onlineMarker(safeMethod.toLowerCase(), orderId)} Waiting for gateway confirmation (${claim.reason})`;
            const newRemark = payment.remark ? `${payment.remark} | ${gatewayRef}${marker}` : `${gatewayRef}${marker}`;

            if (claim.approve) {
                const changed = await payService.changeStatusIfUnchanged(prisma, payment.id, payment.status, { status: 1, method: safeMethod, remark: newRemark });
                if (!changed) return res.status(200).json({ message: "Payment already updated" });
                updatedPayment = { ...payment, status: 1, method: safeMethod, remark: newRemark };
            } else {
                updatedPayment = await prisma.payment.update({ where: { id: payment.id }, data: { method: safeMethod, remark: newRemark } });
            }
        }

        if (!claim.approve) {
            console.warn(`[PayDueOnline] ${safeMethod} payment ${updatedPayment.id} for student ${studentId} left PENDING: ${claim.reason}`);
            return res.status(200).json({ message: "Payment received. It will be confirmed shortly.", pending: true });
        }

        // 🔥 Auto-Delivery Creation for Online Due Payment
        if (updatedPayment.subjects) {
            try {
                const { createAutoDeliveryForPayment } = require('./paymentController');
                await createAutoDeliveryForPayment(updatedPayment);
            } catch (err) {
                console.error("Auto Delivery Error for due payment:", err);
            }
        }

        // 🔥 Sync Lead Enrollment Status with CRM
        try {
            const { syncLeadEnrollment } = require('./paymentController');
            await syncLeadEnrollment(updatedPayment.studentId, updatedPayment.payment_type, updatedPayment);
        } catch (syncErr) {
            console.error("Lead Sync Error on Online Pay:", syncErr);
        }

        res.status(200).json({ message: "Payment updated successfully" });
    } catch (error) {
        console.error("Pay Due Online Error:", error);
        res.status(500).json({ error: "Failed to update payment" });
    }
};

exports.deleteStudentAccount = async (req, res) => {
    console.log("🔥 [BACKEND] Delete Student API Hit! Received Body:", req.body);
    try {
        const { studentId } = req.body;
        if (!studentId) {
            console.log("❌ [BACKEND] Error: No Student ID provided!");
            return res.status(400).json({ error: "Student ID is required." });
        }

        const id = parseInt(studentId);
        console.log(`🗑️ [BACKEND] Processing delete for ID: ${id}`);

        const targetUser = await prisma.user.findUnique({ where: { id } });
        if (!targetUser) {
            return res.status(404).json({ error: "Student account not found." });
        }

        const targetRoleUpper = String(targetUser.role || '').trim().toUpperCase();
        if (['SYSTEM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR'].includes(targetRoleUpper)) {
            return res.status(403).json({ error: "Cannot delete administrator accounts." });
        }

        // 1. ළමයාගේ Payments, Delivery items සහ Deliveries අයින් කිරීම
        const payments = await prisma.payment.findMany({ where: { studentId: id } });
        if (payments.length > 0) {
            console.log(`📦 [BACKEND] Found ${payments.length} payments. Deleting related deliveries & payments...`);
            const paymentIds = payments.map(p => p.id);
            await prisma.deliveryItem.deleteMany({ where: { delivery: { paymentId: { in: paymentIds } } } }).catch(() => {});
            await prisma.delivery.deleteMany({ where: { paymentId: { in: paymentIds } } }).catch(() => {});
            await prisma.paymentAuditLog.deleteMany({ where: { paymentId: { in: paymentIds } } }).catch(() => {});
            await prisma.payment.deleteMany({ where: { studentId: id } }).catch(() => {});
        }

        // 2. Chat messages, App chat messages, Web inquiries nulling/cleanup
        console.log(`💬 [BACKEND] Clearing chat messages & inquiries...`);
        await prisma.chatMessage.updateMany({ 
            where: { senderId: id }, 
            data: { senderId: null } 
        }).catch(() => {});

        await prisma.appChatMessage.deleteMany({ 
            where: { senderId: id } 
        }).catch(() => {});

        await prisma.webInquiry.updateMany({ 
            where: { studentId: id }, 
            data: { studentId: null } 
        }).catch(() => {});

        await prisma.note.deleteMany({ 
            where: { userId: id } 
        }).catch(() => {});

        await prisma.paperSubmissionAnswer.deleteMany({
            where: { submission: { studentId: id } }
        }).catch(() => {});

        await prisma.paperSubmission.deleteMany({ 
            where: { studentId: id } 
        }).catch(() => {});

        // 3. ආරක්ෂිතව ළමයාව Delete කිරීම
        console.log(`👤 [BACKEND] Deleting User Record from DB...`);
        await prisma.user.delete({ 
            where: { id } 
        });

        console.log("✅ [BACKEND] Student account permanently deleted.");
        res.status(200).json({ message: "Student account permanently deleted." });
    } catch (error) {
        console.error("❌ [BACKEND] Delete Student Error in Catch Block:", error);
        res.status(500).json({ error: "Failed to delete student account. Please check relations." });
    }
};

exports.inspectStudentRecords = async (req, res) => {
    try {
        const query = (req.params.query || '').trim();
        if (!query) {
            return res.status(400).json({ error: "Query parameter required" });
        }

        const cleanNoZero = query.replace(/^0+/, '');
        const noPlus = query.replace(/^\+94|^94|^\+/, '');
        const cleanNoPrefix = query.replace(/^STU-|^PHY-STU-/i, '');
        const intId = parseInt(query, 10);
        const intClean = parseInt(cleanNoPrefix, 10);

        const idConditions = [];
        if (!isNaN(intId)) idConditions.push({ id: intId });
        if (!isNaN(intClean)) idConditions.push({ id: intClean });

        // 1. Search Users
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { phone: { contains: query } },
                    { phone: { contains: cleanNoZero } },
                    { phone: { contains: noPlus } },
                    { whatsapp: { contains: query } },
                    { whatsapp: { contains: cleanNoZero } },
                    { optionalPhone: { contains: query } },
                    { nic: { contains: query } },
                    { firstName: { contains: query } },
                    { lastName: { contains: query } },
                    ...idConditions
                ]
            },
            include: {
                payments: {
                    include: {
                        business: true,
                        batch: true,
                        group: true,
                        delivery: {
                            include: {
                                items: true
                            }
                        }
                    }
                }
            }
        });

        const userIds = users.map(u => u.id);
        const userPhones = users.map(u => u.phone).filter(Boolean);

        // 2. Search Payments (any status)
        const payments = await prisma.payment.findMany({
            where: {
                OR: [
                    { studentId: { in: userIds } },
                    ...userIds.map(uid => ({ studentId: uid }))
                ]
            },
            include: {
                business: true,
                batch: true,
                group: true,
                delivery: {
                    include: {
                        items: true
                    }
                },
                bankTransactions: true,
                auditLogs: true
            }
        });

        // 3. Search Deliveries (Tute Packs)
        const deliveries = await prisma.delivery.findMany({
            where: {
                OR: [
                    { studentId: { in: userIds.map(String) } },
                    { studentId: { in: userIds.map(id => `STU-${id}`) } },
                    { labelPhone: { contains: query } },
                    { labelPhone: { contains: cleanNoZero } },
                    { labelName: { contains: query } },
                    { trackingNumber: { contains: query } }
                ]
            },
            include: {
                items: true,
                payment: {
                    include: {
                        business: true,
                        batch: true,
                        group: true
                    }
                }
            }
        });

        // 4. Search Leads
        const leads = await prisma.lead.findMany({
            where: {
                OR: [
                    { phone: { contains: query } },
                    { phone: { contains: cleanNoZero } },
                    { name: { contains: query } }
                ]
            },
            include: {
                batch: {
                    include: {
                        business: true
                    }
                },
                assignedUser: true
            }
        });

        // 5. Search Bank Transactions
        const bankTransactions = await prisma.bankTransaction.findMany({
            where: {
                OR: [
                    { description: { contains: query } },
                    { description: { contains: cleanNoZero } }
                ]
            }
        });

        // 6. Search Physical Students (in Physical CRM)
        const physicalStudents = await prisma.physicalStudent.findMany({
            where: {
                OR: [
                    { phone: { contains: query } },
                    { phone: { contains: cleanNoZero } },
                    { rfid: { contains: query } },
                    { studentName: { contains: query } },
                    { nic: { contains: query } }
                ]
            },
            include: {
                feePayments: true,
                enrollments: {
                    include: {
                        class: true
                    }
                }
            }
        });

        res.json({
            query,
            users,
            payments,
            deliveries,
            leads,
            bankTransactions,
            physicalStudents
        });
    } catch (error) {
        console.error("Inspect Student Error:", error);
        res.status(500).json({ error: error.message });
    }
};