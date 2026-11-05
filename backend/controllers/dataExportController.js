const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { resolveInstallmentStepRange } = require('../utils/installmentHelper');

const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

// Helper function to check access
const checkAccess = async (req, parsedBizId) => {
    const userId = req.user.userId || req.user.id;
    const userRole = req.user.role;
    const businessType = req.user.businessType;
    
    const roleUpper = userRole ? userRole.toUpperCase().replace(/ /g, '_') : '';
    const isAdmin = ['SYSTEM_ADMIN', 'DIRECTOR'].includes(roleUpper);
    
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
        
        if (!myBizIds.includes(parsedBizId)) {
            return false;
        }
    }
    return true;
};

// ============================================================================
// MODULE 01: RETENTION & DROP ANALYTICS (INQUIRIES, DISTRIBUTION, DROPS)
// ============================================================================
exports.getModuleOneAnalytics = async (req, res) => {
    console.log("HIT GET MODULE ONE ANALYTICS ROUTE!");
    try {
        const { businessId, batchId, classType } = req.query;
        console.log("Query params:", { businessId, batchId, classType });

        if (!batchId || batchId === 'null' || batchId === 'undefined' || isNaN(parseInt(batchId))) {
            return res.status(400).json({ error: "Batch ID is required for Analytics" });
        }

        const parsedBatchId = parseInt(batchId);
        const parsedBizId = parseInt(businessId);
        if (!parsedBizId || isNaN(parsedBizId)) {
            return res.status(400).json({ error: "Valid Business ID is required for Analytics" });
        }
        const parsedClassType = (classType && classType !== 'ALL') ? parseInt(classType) : (classType === 'ALL' ? null : 1);
        
        const hasAccess = await checkAccess(req, parsedBizId);
        if (!hasAccess) return res.status(403).json({ error: "Access Denied." });

        // ---------------------------------------------------------
        // 1. SUMMARY CARDS DATA (Inquiries & Real Enrolled)
        // ---------------------------------------------------------
        const freeSeminarCount = await prisma.lead.count({
            where: { batchId: parsedBatchId, campaignType: 'FREE_SEMINAR' }
        });

        const openSeminarCount = await prisma.lead.count({
            where: { batchId: parsedBatchId, campaignType: 'AFTER_SEMINAR', inquiryType: 'OPEN_SEMINAR' }
        });

        const newInqCount = await prisma.lead.count({
            where: { batchId: parsedBatchId, campaignType: 'AFTER_SEMINAR', inquiryType: 'NEW_INQ' }
        });

        // ---------------------------------------------------------
        // 2. FETCH PAYMENTS, GROUPS & COURSES
        // ---------------------------------------------------------
        let groupWhere = { batchId: parsedBatchId };
        if (parsedClassType) groupWhere.classType = parsedClassType;
        const allGroups = await prisma.group.findMany({
            where: groupWhere,
            orderBy: [{ itemOrder: 'asc' }, { id: 'asc' }],
            select: { id: true, name: true, itemOrder: true, type: true, classType: true }
        });

        const monthlyGroups = allGroups.filter(g => !g.name.toLowerCase().includes('full payment') && !g.name.toLowerCase().includes('full'));

        let courseWhere = { group: { batchId: parsedBatchId } };
        if (parsedClassType) {
            courseWhere.OR = [
                { courseType: parsedClassType },
                { group: { classType: parsedClassType } }
            ];
        }
        const courses = await prisma.course.findMany({
            where: courseWhere,
            select: { id: true, name: true, courseType: true, groupId: true }
        });

        const courseMap = {};
        courses.forEach(c => {
            let normalizedSubName = c.name.trim().toUpperCase();
            if (!parsedClassType && (c.courseType === 2 || allGroups.find(g => g.id === c.groupId)?.classType === 2)) {
                normalizedSubName += ' (PAPER)';
            }
            courseMap[c.id] = normalizedSubName;
        });
        const uniqueSubjectNames = [...new Set(Object.values(courseMap))];

        const batchInstallmentPlans = await prisma.installment.findMany({
            where: { batchId: parsedBatchId }
        });

        let paymentWhere = { batchId: parsedBatchId, status: 1 };
        if (parsedClassType) {
            paymentWhere.OR = [
                { group: { classType: parsedClassType } },
                { groupId: { in: allGroups.map(g => g.id) } }
            ];
        }
        const rawPayments = await prisma.payment.findMany({
            where: paymentWhere,
            select: { 
                studentId: true, 
                groupId: true, 
                payment_type: true, 
                installment_no: true,
                subjects: true, 
                created_at: true, 
                amount: true, 
                remark: true,
                group: { select: { id: true, name: true, classType: true } }
            }
        });

        const payments = rawPayments.filter(p => {
            if (!parsedClassType) return true;
            const gClassType = p.group ? parseInt(p.group.classType || 1) : null;
            if (gClassType !== null && gClassType === parsedClassType) return true;
            try {
                const subIds = JSON.parse(p.subjects || '[]').map(id => typeof id === 'object' ? parseInt(id.id) : parseInt(id));
                const hasMatchingCourse = subIds.some(cid => {
                    const crs = courses.find(c => c.id === cid);
                    return crs && (crs.courseType === parsedClassType || (crs.groupId && allGroups.some(rg => rg.id === crs.groupId && rg.classType === parsedClassType)));
                });
                if (hasMatchingCourse) return true;
            } catch (e) {}
            return false;
        });

        const uniqueStudents = new Set();
        const studentSubjectsCount = {}; 

        const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
        const batchMonths = [];
        monthlyGroups.forEach(mg => {
            monthNames.forEach(m => {
                if (mg.name.toUpperCase().includes(m) && !batchMonths.includes(m)) {
                    batchMonths.push(m);
                }
            });
        });

        // Data Structures
        const distributionData = {}; // For Group Distribution Table (SLIP COUNTS)
        const dropData = {};         // For Drop Analytics Table (STUDENT TRACKING)
        const batchUniqueStudents = {}; // For OVERALL True Unique Students (Headcount)

        batchMonths.forEach(m => {
            batchUniqueStudents[m] = new Set();
        });

        uniqueSubjectNames.forEach(sub => {
            distributionData[sub] = {};
            dropData[sub] = {};
            
            batchMonths.forEach(m => {
                distributionData[sub][m] = { FULL: 0, MONTHLY: 0, INSTALLMENT: 0 };
                dropData[sub][m] = { 
                    FULL: new Set(), 
                    MONTHLY: new Set(),
                    INSTALLMENT: new Set()
                }; 
            });
        });

        // ---------------------------------------------------------
        // 3. PROCESS PAYMENTS
        // ---------------------------------------------------------
        payments.forEach(p => {
            if (!p.subjects || !p.studentId || !p.groupId) return;

            // EXCLUDE FREE CARDS: amount is 0 OR remark contains "FREE"
            if (p.amount === 0 || (p.remark && p.remark.toUpperCase().includes('FREE'))) {
                return;
            }

            uniqueStudents.add(p.studentId); 

            if (!studentSubjectsCount[p.studentId]) {
                studentSubjectsCount[p.studentId] = new Set();
            }

            let enrolledSubjects = [];
            try {
                const subs = JSON.parse(p.subjects);
                subs.forEach(item => {
                    if (typeof item === 'object' && item.id && courseMap[parseInt(item.id)]) {
                        enrolledSubjects.push(courseMap[parseInt(item.id)]);
                        studentSubjectsCount[p.studentId].add(courseMap[parseInt(item.id)]);
                    } else if (typeof item === 'string' && isNaN(parseInt(item))) {
                        enrolledSubjects.push(item.trim().toUpperCase());
                        studentSubjectsCount[p.studentId].add(item.trim().toUpperCase());
                    } else if (!isNaN(parseInt(item)) && courseMap[parseInt(item)]) {
                        enrolledSubjects.push(courseMap[parseInt(item)]);
                        studentSubjectsCount[p.studentId].add(courseMap[parseInt(item)]);
                    }
                });
            } catch(e) { return; }

            enrolledSubjects = [...new Set(enrolledSubjects)];
            const payType = parseInt(p.payment_type);
            
            let typeCat = 'MONTHLY';
            if (payType === 3) typeCat = 'FULL';
            else if (payType === 2) typeCat = 'INSTALLMENT';
            else if (payType === 1) typeCat = 'MONTHLY';

            let pMonth = null;
            const mg = monthlyGroups.find(m => m.id === p.groupId);
            if (mg) {
                for (let m of batchMonths) {
                    if (mg.name.toUpperCase().includes(m)) {
                        pMonth = m; break;
                    }
                }
            } else {
                if (p.created_at) {
                    const date = new Date(p.created_at);
                    const monthString = monthNames[date.getMonth()];
                    if (batchMonths.includes(monthString)) {
                        pMonth = monthString;
                    } else if (batchMonths.length > 0) {
                        pMonth = batchMonths[0];
                    }
                }
            }

            if (pMonth) {
                let monthsToCover = [];
                const isUpgrade = Boolean(p.remark && (p.remark.includes('[UPGRADE]') || p.remark.toUpperCase().includes('UPGRADE')));
                const numActive = batchMonths.length || 1;

                // Count approved monthly payments this student has in the current batch (for upgrade offset)
                const studentMonthlyPayments = payments.filter(pm => pm.studentId === p.studentId && parseInt(pm.payment_type) === 1);
                const alreadyPaidMonthlyCount = studentMonthlyPayments.length;

                if (typeCat === 'FULL') {
                    // Full payment allocation matching Finance Matrix
                    let lastPaidMonthlyIndex = -1;
                    studentMonthlyPayments.forEach(pm => {
                        const mgMatch = monthlyGroups.find(m => m.id === pm.groupId);
                        if (mgMatch) {
                            const idx = batchMonths.findIndex(bm => mgMatch.name.toUpperCase().includes(bm));
                            if (idx > lastPaidMonthlyIndex) lastPaidMonthlyIndex = idx;
                        }
                    });

                    const startIdx = (isUpgrade && lastPaidMonthlyIndex >= 0)
                        ? Math.min(lastPaidMonthlyIndex + 1, Math.max(0, numActive - 1))
                        : (batchMonths.indexOf(pMonth) !== -1 ? batchMonths.indexOf(pMonth) : 0);

                    for (let i = startIdx; i < numActive; i++) {
                        if (batchMonths[i]) monthsToCover.push(batchMonths[i]);
                    }
                } else if (typeCat === 'INSTALLMENT') {
                    // Installment allocation matching Finance Matrix Dynamic Mathematical Engine
                    const subCount = enrolledSubjects.length;
                    const applicablePlans = batchInstallmentPlans.filter(pl => pl.subjectCount <= (subCount || 1)).sort((a, b) => b.subjectCount - a.subjectCount);
                    const plan = applicablePlans.length > 0 ? applicablePlans[0] : (batchInstallmentPlans[0] || null);

                    let stepDetails = [];
                    if (plan && plan.details) {
                        try { stepDetails = JSON.parse(plan.details); } catch(e) {}
                    }
                    const instNo = p.installment_no || 1;
                    const instIdx = Math.max(0, instNo - 1);

                    const stepRange = resolveInstallmentStepRange(stepDetails, instIdx, isUpgrade, alreadyPaidMonthlyCount, numActive);
                    const start = stepRange.start;
                    const end = stepRange.end;
                    const monthsSpan = end - start;
                    const actualStart = monthsSpan > 0 ? start : 0;
                    const actualEnd = monthsSpan > 0 ? end : numActive;

                    monthsToCover = [];
                    for (let i = actualStart; i < actualEnd; i++) {
                        if (batchMonths[i]) {
                            monthsToCover.push(batchMonths[i]);
                        }
                    }
                    if (monthsToCover.length === 0 && pMonth) {
                        monthsToCover.push(pMonth);
                    }
                } else {
                    monthsToCover.push(pMonth);
                }

                monthsToCover.forEach(m => {
                    batchUniqueStudents[m].add(p.studentId);
                });

                enrolledSubjects.forEach(sub => {
                    if (!uniqueSubjectNames.includes(sub)) return;

                    monthsToCover.forEach(m => {
                        if (distributionData[sub][m] !== undefined) {
                            distributionData[sub][m][typeCat] += 1;
                        }

                        if (dropData[sub][m] !== undefined) {
                            dropData[sub][m][typeCat].add(p.studentId);
                        }
                    });
                });
            }
        });

        // ---------------------------------------------------------
        // 4. CALCULATE DROPS & GROWTH (Month over Month)
        // ---------------------------------------------------------
        const batchOverallUniqueStats = {};
        let prevBatchUniqueSet = new Set();

        batchMonths.forEach((m, index) => {
            const currentBatchSet = batchUniqueStudents[m];
            let uniqueGrow = 0, uniqueDrop = 0;
            
            if (index > 0) {
                currentBatchSet.forEach(id => {
                    if (!prevBatchUniqueSet.has(id)) {
                        uniqueGrow++;
                    }
                });
                prevBatchUniqueSet.forEach(id => {
                    if (!currentBatchSet.has(id)) {
                        uniqueDrop++;
                    }
                });
            }
            
            batchOverallUniqueStats[m] = {
                size: currentBatchSet.size,
                grow: uniqueGrow,
                drop: uniqueDrop
            };
            
            prevBatchUniqueSet = currentBatchSet;
        });

        const finalDropStats = {};
        uniqueSubjectNames.forEach(sub => {
            finalDropStats[sub] = { 
                months: {}, 
                totalMonthlyDrops: 0, totalFullGrowths: 0,
                totalMonthlyGrowths: 0, totalFullDrops: 0,
                totalInstDrops: 0, totalInstGrowths: 0,
                overallDrop: 0, overallGrow: 0
            };
            
            let prevFullSet = new Set();
            let prevMonthlySet = new Set();
            let prevInstSet = new Set();

            batchMonths.forEach((m, index) => {
                const currentFullSet = dropData[sub][m].FULL;
                const currentMonthlySet = dropData[sub][m].MONTHLY;
                const currentInstSet = dropData[sub][m].INSTALLMENT;
                
                let fullGrow = 0, fullDrop = 0;
                let fullGrowNew = 0, fullGrowUpg = 0;
                let monthlyGrow = 0, monthlyDrop = 0, monthlyUpg = 0;
                let instGrow = 0, instDrop = 0, instUpg = 0;

                if (index > 0) {
                    // Full
                    currentFullSet.forEach(id => { 
                        if (!prevFullSet.has(id)) {
                            fullGrow++;
                            if (prevMonthlySet.has(id) || prevInstSet.has(id)) {
                                fullGrowUpg++;
                            } else {
                                fullGrowNew++;
                            }
                        } 
                    });
                    prevFullSet.forEach(id => { if (!currentFullSet.has(id)) fullDrop++; });

                    // Monthly
                    currentMonthlySet.forEach(id => { if (!prevMonthlySet.has(id)) monthlyGrow++; });
                    prevMonthlySet.forEach(id => { 
                        if (!currentMonthlySet.has(id)) {
                            if (currentFullSet.has(id) || currentInstSet.has(id)) {
                                monthlyUpg++;
                            } else {
                                monthlyDrop++;
                            }
                        }
                    });

                    // Installment
                    currentInstSet.forEach(id => { if (!prevInstSet.has(id)) instGrow++; });
                    prevInstSet.forEach(id => { 
                        if (!currentInstSet.has(id)) {
                            if (currentFullSet.has(id)) {
                                instUpg++;
                            } else {
                                instDrop++;
                            }
                        }
                    });
                }

                const calcPct = (val, prevBase) => prevBase > 0 ? ((val / prevBase) * 100).toFixed(1) : 0;

                finalDropStats[sub].months[m] = { 
                    FULL: { 
                        grow: fullGrow, 
                        growNew: fullGrowNew,
                        growUpg: fullGrowUpg,
                        drop: fullDrop,
                        prevSize: prevFullSet.size,
                        growPct: calcPct(fullGrow, prevFullSet.size), 
                        growNewPct: calcPct(fullGrowNew, prevFullSet.size),
                        growUpgPct: calcPct(fullGrowUpg, prevFullSet.size),
                        dropPct: calcPct(fullDrop, prevFullSet.size) 
                    },
                    MONTHLY: { 
                        grow: monthlyGrow, drop: monthlyDrop, upg: monthlyUpg,
                        prevSize: prevMonthlySet.size,
                        growPct: calcPct(monthlyGrow, prevMonthlySet.size), 
                        dropPct: calcPct(monthlyDrop, prevMonthlySet.size),
                        upgPct: calcPct(monthlyUpg, prevMonthlySet.size)
                    },
                    INSTALLMENT: { 
                        grow: instGrow, drop: instDrop, upg: instUpg,
                        prevSize: prevInstSet.size,
                        growPct: calcPct(instGrow, prevInstSet.size), 
                        dropPct: calcPct(instDrop, prevInstSet.size),
                        upgPct: calcPct(instUpg, prevInstSet.size)
                    }
                };
                
                finalDropStats[sub].totalFullGrowths += fullGrow;
                finalDropStats[sub].totalFullDrops += fullDrop;
                finalDropStats[sub].totalMonthlyDrops += monthlyDrop;
                finalDropStats[sub].totalMonthlyGrowths += monthlyGrow;
                finalDropStats[sub].totalInstDrops += instDrop;
                finalDropStats[sub].totalInstGrowths += instGrow;
                
                prevFullSet = currentFullSet;
                prevMonthlySet = currentMonthlySet;
                prevInstSet = currentInstSet;
            });
            finalDropStats[sub].overallDrop = finalDropStats[sub].totalFullDrops + finalDropStats[sub].totalMonthlyDrops + finalDropStats[sub].totalInstDrops;
            finalDropStats[sub].overallGrow = finalDropStats[sub].totalFullGrowths + finalDropStats[sub].totalMonthlyGrowths + finalDropStats[sub].totalInstGrowths;
        });

        // ---------------------------------------------------------
        // 5. CORE AVERAGE LOGIC
        // ---------------------------------------------------------
        const biz = await prisma.business.findUnique({ where: { id: parsedBizId } });
        const isOL = biz ? (biz.name.toLowerCase().includes('o/l') || biz.name.toLowerCase().includes('ordinary')) : false;

        let coreAverageCount = 0;

        Object.values(studentSubjectsCount).forEach(subsSet => {
            if (isOL) {
                if (subsSet.size >= 9) coreAverageCount++;
            } else {
                let mainCount = 0;
                subsSet.forEach(s => {
                    const sn = s.toLowerCase();
                    if (!sn.includes('english') && !sn.includes('general') && !sn.includes('git')) {
                        mainCount++;
                    }
                });
                if (mainCount >= 3) coreAverageCount++;
            }
        });

        // ---------------------------------------------------------
        // 6. FORMAT RESPONSE DATA
        // ---------------------------------------------------------
        const formattedDistribution = {};
        uniqueSubjectNames.forEach(sub => {
            formattedDistribution[sub] = {};
            let rowTotal = 0;
            batchMonths.forEach(m => {
                const data = distributionData[sub][m];
                const total = data.FULL + data.MONTHLY + data.INSTALLMENT;
                formattedDistribution[sub][m] = { ...data, total };
                rowTotal += total;
            });
            formattedDistribution[sub]['Total'] = rowTotal;
        });

        const allBatchGroups = await prisma.group.findMany({
            where: { batchId: parsedBatchId },
            select: { id: true, classType: true }
        });
        const hasTheory = allBatchGroups.some(g => (g.classType || 1) === 1);
        const hasPaper = allBatchGroups.some(g => g.classType === 2);

        res.status(200).json(safeJson({
            batchMonths: batchMonths,
            summaryCards: {
                freeSeminar: freeSeminarCount,
                openSeminar: openSeminarCount,
                newInquiries: newInqCount,
                realEnrolled: uniqueStudents.size
            },
            coreAverage: coreAverageCount,
            allGroups: allGroups, 
            monthlyGroups: monthlyGroups, 
            subjects: uniqueSubjectNames,
            distributionData: formattedDistribution,
            dropData: finalDropStats,
            batchOverallUniqueStats: batchOverallUniqueStats,
            classType: classType || '1',
            availableClassTypes: {
                hasTheory,
                hasPaper
            }
        }));

    } catch (error) {
        console.error("Module 01 Analytics Error:", error);
        res.status(500).json({ error: "Failed to load Module 01 Analytics" });
    }
};

// ============================================================================
// MODULE 02: BATCH COMPARISON
// ============================================================================
exports.getBatchComparison = async (req, res) => {
    try {
        const { businessId, batchAId, batchBId, classType } = req.query;
        if (!batchAId || !batchBId || batchAId === 'null' || batchBId === 'null') {
            return res.status(400).json({ error: "Both Batch A and Batch B IDs are required." });
        }

        const bAId = parseInt(batchAId);
        const bBId = parseInt(batchBId);
        const parsedBizId = parseInt(businessId);
        const parsedClassType = (classType && classType !== 'ALL') ? parseInt(classType) : (classType === 'ALL' ? null : 1);

        const hasAccess = await checkAccess(req, parsedBizId);
        if (!hasAccess) return res.status(403).json({ error: "Access Denied." });

        const fetchBatchData = async (batchId) => {
            const batch = await prisma.batch.findUnique({ where: { id: batchId } });
            if (!batch) return null;

            const freeSem = await prisma.lead.count({ where: { batchId, campaignType: 'FREE_SEMINAR' } });
            const openSem = await prisma.lead.count({ where: { batchId, campaignType: 'AFTER_SEMINAR', inquiryType: 'OPEN_SEMINAR' } });
            const newInq = await prisma.lead.count({ where: { batchId, campaignType: 'AFTER_SEMINAR', inquiryType: 'NEW_INQ' } });
            
            const payments = await prisma.payment.findMany({
                where: { 
                    batchId, 
                    status: { in: [1, 4] },
                    ...(parsedClassType ? { group: { classType: parsedClassType } } : {})
                },
                select: { studentId: true }
            });
            const uniqueEnrolled = new Set(payments.map(p => p.studentId)).size;

            return {
                batchName: batch.name,
                freeSem, openSem, newInq, uniqueEnrolled
            };
        };

        const batchAData = await fetchBatchData(bAId);
        const batchBData = await fetchBatchData(bBId);

        res.status(200).json(safeJson({
            batchA: batchAData,
            batchB: batchBData
        }));

    } catch (error) {
        console.error("Batch Comparison Error:", error);
        res.status(500).json({ error: "Failed to load Batch Comparison" });
    }
};
// ============================================================================
// MODULE 03: COORDINATOR KPI ANALYTICS
// ============================================================================
exports.getCoordinatorKPI = async (req, res) => {
    try {
        const { businessId, batchId } = req.query;
        if (!businessId) {
            return res.status(400).json({ error: "Business ID is required" });
        }
        
        const parsedBizId = parseInt(businessId);
        
        // Access Check
        const hasAccess = await checkAccess(req, parsedBizId);
        if (!hasAccess) {
            return res.status(403).json({ error: "Access Denied to this Campaign" });
        }

        let leadWhere = { 
            campaignType: 'AFTER_SEMINAR',
            assignedTo: { not: null }
        };

        if (batchId && batchId !== 'null') {
            leadWhere.batchId = parseInt(batchId);
        } else {
            leadWhere.OR = [
                { phone: { endsWith: `BIZ_${parsedBizId}` } },
                { phone: { endsWith: `BIZ_${parsedBizId}_AS` } },
                { phone: { contains: `BIZ_${parsedBizId}_BATCH_` } },
                { phone: { contains: `BIZ_${parsedBizId}_ROUND_` } },
                { phone: { contains: `BIZ_${parsedBizId}_HISTORY_ROUND_` } }
            ];
        }

        const leads = await prisma.lead.findMany({
            where: leadWhere,
            include: {
                assignedUser: {
                    select: { id: true, firstName: true, lastName: true }
                },
                messages: true,
                roundProgress: true
            }
        });

        // Map phone numbers to find corresponding Users (Students) and Payments
        const enrolledLeads = leads.filter(l => l.enrollmentStatus === 'ENROLLED');
        const cleanPhoneMap = {}; // Maps clean phone back to lead's full phone string
        const cleanPhones = [];
        
        enrolledLeads.forEach(l => {
            let clean = l.phone.split('_')[0];
            if (clean.startsWith('94')) clean = '0' + clean.substring(2);
            cleanPhones.push(clean);
            cleanPhoneMap[l.phone] = clean;
        });

        const students = await prisma.user.findMany({
            where: { phone: { in: cleanPhones } },
            select: { id: true, phone: true }
        });

        const studentIdByCleanPhone = {};
        students.forEach(s => studentIdByCleanPhone[s.phone] = s.id);

        const studentPhoneMap = {}; // original lead phone -> student id
        enrolledLeads.forEach(l => {
            const cPhone = cleanPhoneMap[l.phone];
            if (studentIdByCleanPhone[cPhone]) {
                studentPhoneMap[l.phone] = studentIdByCleanPhone[cPhone];
            }
        });

        const studentIds = students.map(s => s.id);
        const payments = await prisma.payment.findMany({
            where: { studentId: { in: studentIds }, status: { in: [0, 1, 4] } },
            orderBy: { created_at: 'desc' }
        });

        const paymentMap = {}; // studentId -> all payments
        payments.forEach(p => {
            if (!paymentMap[p.studentId]) paymentMap[p.studentId] = [];
            paymentMap[p.studentId].push(p);
        });

        // Initialize Aggregation Map
        const coordinatorMap = {};
        const getMonthYear = (dateStr) => {
            if (!dateStr) return 'Unknown';
            const d = new Date(dateStr);
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        };

        leads.forEach(lead => {
            if (!lead.assignedUser) return;
            const staffId = lead.assignedUser.id;
            
            if (!coordinatorMap[staffId]) {
                coordinatorMap[staffId] = {
                    id: staffId,
                    name: `${lead.assignedUser.firstName} ${lead.assignedUser.lastName || ''}`.trim(),
                    calls: {
                        openSem: { assigned: 0, covered: 0, pending: 0, r1: { covered: 0, pending: 0 }, r2: { covered: 0, pending: 0 }, enrolled: 0, nonEnrolled: 0, paid: 0 },
                        newInq: { assigned: 0, covered: 0, pending: 0, r1: { covered: 0, pending: 0 }, r2: { covered: 0, pending: 0 }, enrolled: 0, nonEnrolled: 0, paid: 0 },
                    },
                    finances: {
                        totalEnrolled: 0,
                        monthly: 0, installment: 0, full: 0, upgraded: 0,
                        subjects: {}
                    },
                    messages: {
                        openSem: { total: 0, sent: 0, received: 0, unread: 0 },
                        newInq: { total: 0, sent: 0, received: 0, unread: 0 }
                    },
                    monthlyTrends: {} // e.g. { '2024-05': { enrolled: 5, drops: 1, growth: 2, monthly: 1, full: 2, install: 2, upgraded: 0 } }
                };
            }
            
            const c = coordinatorMap[staffId];
            const inqType = lead.inquiryType === 'NEW_INQ' ? 'newInq' : 'openSem';
            
            // Calls Aggregation
            c.calls[inqType].assigned++;
            if (lead.callStatus === 'pending') c.calls[inqType].pending++;
            else c.calls[inqType].covered++;

            // Round Breakdown
            const r1 = lead.roundProgress?.find(r => r.roundNum === 1);
            if (r1) {
                if (r1.callStatus === 'pending') c.calls[inqType].r1.pending++;
                else c.calls[inqType].r1.covered++;
            } else {
                // Fallback to lead coordinationRound
                if (lead.coordinationRound === 1) {
                    if (lead.callStatus === 'pending') c.calls[inqType].r1.pending++;
                    else c.calls[inqType].r1.covered++;
                }
            }

            const r2 = lead.roundProgress?.find(r => r.roundNum === 2);
            if (r2) {
                if (r2.callStatus === 'pending') c.calls[inqType].r2.pending++;
                else c.calls[inqType].r2.covered++;
            } else {
                if (lead.coordinationRound === 2) {
                    if (lead.callStatus === 'pending') c.calls[inqType].r2.pending++;
                    else c.calls[inqType].r2.covered++;
                }
            }

            // Enrollments
            if (lead.enrollmentStatus === 'ENROLLED') {
                c.calls[inqType].enrolled++;
                c.calls[inqType].paid++;
                c.finances.totalEnrolled++;
                
                if (lead.paymentIntention === 'MONTHLY') c.finances.monthly++;
                else if (lead.paymentIntention === 'INSTALLMENT') c.finances.installment++;
                else if (lead.paymentIntention === 'FULL') c.finances.full++;

                let isUpgraded = false;
                let isDropped = false;
                
                // Check Payments for this student
                const sId = studentPhoneMap[lead.phone];
                if (sId && paymentMap[sId] && paymentMap[sId].length > 0) {
                    const stuPayments = paymentMap[sId];
                    // Upgraded: Multiple payments with different types or Full after Monthly
                    if (stuPayments.length > 1) {
                        const hasMonthly = stuPayments.some(p => p.payment_type === 1);
                        const hasFull = stuPayments.some(p => p.payment_type === 3);
                        if (hasMonthly && hasFull) {
                            isUpgraded = true;
                            c.finances.upgraded++;
                        }
                    }

                    // Subjects Parsing
                    const firstPayment = stuPayments[stuPayments.length - 1]; // Oldest payment
                    if (firstPayment && firstPayment.subjects) {
                        try {
                            const subs = JSON.parse(firstPayment.subjects);
                            subs.forEach(s => {
                                let subName = typeof s === 'string' ? s : (s.name || s.id || 'Unknown');
                                if (!c.finances.subjects[subName]) c.finances.subjects[subName] = 0;
                                c.finances.subjects[subName]++;
                            });
                        } catch(e) {}
                    }

                    // Drop Logic: Monthly/Installment and no payment in last 35 days
                    if (lead.paymentIntention !== 'FULL') {
                        const latestPayment = stuPayments[0]; // Newest payment
                        const daysSinceLastPayment = (new Date() - new Date(latestPayment.created_at)) / (1000 * 60 * 60 * 24);
                        if (daysSinceLastPayment > 35) {
                            isDropped = true;
                        }
                    }
                }

                // Monthly Trend Logic
                const monthStr = getMonthYear(lead.createdAt || new Date());
                if (!c.monthlyTrends[monthStr]) {
                    c.monthlyTrends[monthStr] = { month: monthStr, enrolled: 0, drops: 0, growth: 0, monthly: 0, full: 0, install: 0, upgraded: 0 };
                }
                c.monthlyTrends[monthStr].enrolled++;
                if (lead.paymentIntention === 'MONTHLY') c.monthlyTrends[monthStr].monthly++;
                else if (lead.paymentIntention === 'INSTALLMENT') c.monthlyTrends[monthStr].install++;
                else if (lead.paymentIntention === 'FULL') c.monthlyTrends[monthStr].full++;
                
                if (isUpgraded) c.monthlyTrends[monthStr].upgraded++;
                
                if (isDropped) {
                    c.monthlyTrends[monthStr].drops++;
                } else {
                    c.monthlyTrends[monthStr].growth++; // Active
                }

            } else {
                c.calls[inqType].nonEnrolled++;
            }

            // Messaging Aggregation
            if (lead.messages && lead.messages.length > 0) {
                c.messages[inqType].total += lead.messages.length;
                lead.messages.forEach(msg => {
                    // Handle both casing for safety
                    const dir = msg.direction ? msg.direction.toLowerCase() : '';
                    if (dir === 'in' || dir === 'inbound') {
                        c.messages[inqType].received++;
                        if (!msg.isRead) c.messages[inqType].unread++;
                    } else if (dir === 'out' || dir === 'outbound') {
                        c.messages[inqType].sent++;
                    }
                });
            }
        });

        // Format Output
        const result = Object.values(coordinatorMap).map(c => {
            const formattedTrends = Object.values(c.monthlyTrends).sort((a,b) => a.month.localeCompare(b.month));
            
            // Format subjects into array for charting
            const subjectArray = Object.entries(c.finances.subjects).map(([name, count]) => ({
                name, count, percent: c.finances.totalEnrolled > 0 ? ((count / c.finances.totalEnrolled) * 100).toFixed(1) : 0
            }));

            // Format Calls Response Rates
            const os = c.calls.openSem;
            const ni = c.calls.newInq;
            os.responseRate = os.assigned > 0 ? ((os.covered / os.assigned) * 100).toFixed(1) : '0.0';
            ni.responseRate = ni.assigned > 0 ? ((ni.covered / ni.assigned) * 100).toFixed(1) : '0.0';

            return {
                ...c,
                monthlyTrendsArray: formattedTrends,
                subjectsArray: subjectArray
            };
        });

        res.status(200).json(safeJson(result));

    } catch (error) {
        console.error("Coordinator KPI Error:", error);
        res.status(500).json({ error: "Failed to load Coordinator KPI Analytics" });
    }
};
