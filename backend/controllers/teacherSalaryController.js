const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const financeController = require('./financeController');

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const SINHALA_MONTH_MAP = {
    "ජනවාරි": "January", "පෙබරවාරි": "February", "මාර්තු": "March", "අප්‍රේල්": "April",
    "මැයි": "May", "ජූනි": "June", "ජූලි": "July", "අගෝස්තු": "August",
    "සැප්තැම්බර්": "September", "ඔක්තෝම්බර්": "October", "නොවැම්බර්": "November", "දෙසැම්බර්": "December"
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
    const shortPrefixes = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    for (let i = 0; i < shortPrefixes.length; i++) {
        if (lower.includes(shortPrefixes[i])) return MONTH_NAMES[i];
    }
    return null;
};

const callGetFinanceMatrix = async (batchId, user, classType = '1') => {
    return new Promise((resolve) => {
        const mockReq = {
            query: { batchId: String(batchId), classType: String(classType) },
            user: { ...(user || {}), role: 'SYSTEM_ADMIN', department: 'Finance', isAdmin: true }
        };
        const mockRes = {
            status: (code) => {
                if (code >= 400) return { json: () => resolve(null) };
                return mockRes;
            },
            json: (data) => resolve(data)
        };
        financeController.getFinanceMatrix(mockReq, mockRes).catch(() => resolve(null));
    });
};

/**
 * Controller for Teachers Salary Breakdown
 * Integrates directly with the Finance Matrix Engine:
 * - Paid Student Count matches Finance Matrix exactly (Monthly, Full, Upgrade, Mix)
 * - Revenue matches Finance Matrix weighted ratio engine
 * - NO tute stock is used
 */
exports.getTeacherSalaryBreakdown = async (req, res) => {
    try {
        const {
            businessId,
            batchId,
            lecturerName: queryLecturer,
            paymentType,
            dateType,
            billingMonth,
            search
        } = req.query;

        // User role & access checks
        const user = req.user;
        const userRole = (user?.role || '').toUpperCase();
        const userDept = (user?.department || '').toUpperCase();
        const isSystemAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'SYSTEM_ADMIN' || user?.isAdmin;
        const isDelivery = userDept === 'DELIVERY' || userRole.includes('DELIVERY');
        const isFinance = userDept === 'FINANCE' || userRole.includes('FINANCE');
        const isGeneralManager = userRole === 'GENERAL_MANAGER' || userRole.includes('GENERAL');
        const isFullAccess = isSystemAdmin || isDelivery || isFinance || isGeneralManager;

        // 1. Fetch accessible businesses
        let accessibleBusinesses = [];
        if (isFullAccess) {
            accessibleBusinesses = await prisma.business.findMany({
                where: { status: 1 },
                select: { id: true, name: true, category: true, head_manager_id: true, ass_manager_id: true },
                orderBy: { itemOrder: 'asc' }
            });
        } else {
            accessibleBusinesses = await prisma.business.findMany({
                where: {
                    status: 1,
                    OR: [
                        { head_manager_id: user.id },
                        { ass_manager_id: user.id }
                    ]
                },
                select: { id: true, name: true, category: true, head_manager_id: true, ass_manager_id: true },
                orderBy: { itemOrder: 'asc' }
            });
        }

        const accessibleBizIds = accessibleBusinesses.map(b => b.id);
        if (accessibleBizIds.length === 0) {
            return res.status(200).json({
                businesses: [],
                lecturers: [],
                availableBillingMonths: [],
                activeCycle: null,
                summary: {
                    totalLecturers: 0,
                    totalApprovedStudents: 0,
                    totalFullPayments: 0,
                    totalMonthlyPayments: 0,
                    totalUpgradePayments: 0,
                    totalInstallmentPayments: 0,
                    totalMixPayments: 0,
                    totalRevenue: 0
                }
            });
        }

        let targetBizIds = accessibleBizIds;
        if (businessId && businessId !== 'All' && businessId !== 'all') {
            const parsedBizId = parseInt(businessId);
            if (accessibleBizIds.includes(parsedBizId)) {
                targetBizIds = [parsedBizId];
            } else {
                return res.status(403).json({ error: "Access denied to selected business." });
            }
        }

        // 2. Determine target Billing Month (Monthwise 1 - 30/31)
        // Default to '2026-09' or '2026-10'
        let targetMonthKey = billingMonth;
        if (!targetMonthKey || targetMonthKey === 'All') {
            targetMonthKey = '2026-09'; // Default to September (or October)
        }

        let targetMonthName = "September";
        let targetYear = 2026;
        let lastDay = 30;

        if (/^\d{4}-\d{2}$/.test(targetMonthKey)) {
            const [y, m] = targetMonthKey.split('-').map(Number);
            targetYear = y;
            targetMonthName = MONTH_NAMES[m - 1];
            lastDay = new Date(y, m, 0).getDate();
        } else if (targetMonthKey && targetMonthKey !== 'All' && targetMonthKey !== 'all') {
            const p = parseMonthName(targetMonthKey);
            if (p) targetMonthName = p;
        }

        const activeCycleInfo = {
            type: 'monthwise',
            monthKey: targetMonthKey,
            year: targetYear,
            monthName: targetMonthName,
            startDate: `${targetMonthKey}-01`,
            endDate: `${targetMonthKey}-${String(lastDay).padStart(2, '0')}`,
            lastDay,
            label: `${targetMonthName} ${targetYear} (01 - ${lastDay})`,
            cycleText: `01 - ${lastDay} of ${targetMonthName} ${targetYear}`
        };

        // 3. Available Billing Months List
        const allApprovedDates = await prisma.payment.findMany({
            where: { status: 1, amount: { gt: 0 } },
            select: { created_at: true },
            orderBy: { created_at: 'desc' }
        });

        const monthMap = new Map();
        for (const p of allApprovedDates) {
            if (!p.created_at) continue;
            const d = new Date(p.created_at);
            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            const key = `${y}-${String(m).padStart(2, '0')}`;
            if (!monthMap.has(key)) {
                const lDay = new Date(y, m, 0).getDate();
                monthMap.set(key, {
                    key,
                    year: y,
                    month: m,
                    name: MONTH_NAMES[m - 1],
                    label: `${MONTH_NAMES[m - 1]} ${y} (01 - ${lDay})`,
                    shortLabel: `${MONTH_NAMES[m - 1].slice(0, 3)} (01-${lDay})`,
                    startDate: `${key}-01`,
                    endDate: `${key}-${String(lDay).padStart(2, '0')}`,
                    lastDay: lDay,
                    paymentsCount: 0
                });
            }
            monthMap.get(key).paymentsCount++;
        }
        const availableBillingMonths = Array.from(monthMap.values());

        // 4. Fetch Master Lecturers from Delivery Department
        const masterSetting = await prisma.appSetting.findUnique({ where: { key: 'MASTER_TUTES' } });
        let masterLecturers = [];
        if (masterSetting && masterSetting.value) {
            try { masterLecturers = JSON.parse(masterSetting.value); } catch (e) {}
        }

        // Fetch Teacher Salary Configuration Rules
        const salarySetting = await prisma.appSetting.findUnique({ where: { key: 'TEACHER_SALARY_CONFIG' } });
        let salaryRulesMap = {};
        if (salarySetting && salarySetting.value) {
            try { salaryRulesMap = JSON.parse(salarySetting.value); } catch (e) {}
        }

        const resolveSalaryRule = (rules, bId, lecName, normSub) => {
            if (!rules) return null;
            const cleanLec = (lecName || '').trim();
            const cleanSub = (normSub || '').trim().toUpperCase();

            // 1. Specific: Batch + Lecturer + Subject
            const k1 = `${bId}:::${cleanLec}:::${cleanSub}`;
            if (rules[k1]) return { key: k1, ...rules[k1] };

            // 2. Batch + Subject
            const k2 = `${bId}:::${cleanSub}`;
            if (rules[k2]) return { key: k2, ...rules[k2] };

            // 3. Global Lecturer + Subject (Across all batches)
            const k3 = `GLOBAL:::${cleanLec}:::${cleanSub}`;
            if (rules[k3]) return { key: k3, ...rules[k3] };

            // 4. Global Lecturer (Default for lecturer)
            const k4 = `GLOBAL:::${cleanLec}`;
            if (rules[k4]) return { key: k4, ...rules[k4] };

            return null;
        };

        // 5. Fetch Courses linked to accessible businesses
        const courseWhere = {
            lecturerName: { not: null },
            group: {
                batch: {
                    businessId: { in: targetBizIds }
                }
            }
        };

        if (batchId && batchId !== 'All' && batchId !== 'all') {
            courseWhere.group.batchId = parseInt(batchId);
        }

        const courses = await prisma.course.findMany({
            where: courseWhere,
            include: {
                group: {
                    include: {
                        batch: {
                            include: {
                                business: {
                                    select: { id: true, name: true, category: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        // Group courses by Batch ID
        const batchCoursesMap = new Map();
        courses.forEach(c => {
            const b = c.group?.batch;
            if (!b) return;
            if (!batchCoursesMap.has(b.id)) {
                batchCoursesMap.set(b.id, {
                    batch: b,
                    business: b.business,
                    courses: []
                });
            }
            batchCoursesMap.get(b.id).courses.push(c);
        });

        // 6. Setup Lecturer Registry
        const lecturerRegistry = new Map();

        masterLecturers.forEach(m => {
            const cleanName = m.name.trim();
            lecturerRegistry.set(cleanName, {
                id: m.id,
                name: cleanName,
                image: m.image || null,
                businesses: new Map(),
                totalPaidStudents: 0,
                fullCount: 0,
                fullAmount: 0,
                monthlyCount: 0,
                monthlyAmount: 0,
                upgradeCount: 0,
                upgradeAmount: 0,
                installmentCount: 0,
                installmentAmount: 0,
                mixCount: 0,
                mixAmount: 0,
                adjustedCount: 0,
                adjustedAmount: 0,
                totalAmount: 0,
                grossSalary: 0,
                whtAmount: 0,
                teacherSalary: 0,
                instituteShare: 0
            });
        });

        const findLecturerEntry = (rawName) => {
            if (!rawName) return null;
            const clean = rawName.trim();
            if (lecturerRegistry.has(clean)) return lecturerRegistry.get(clean);
            const norm = clean.toLowerCase();
            for (const [key, val] of lecturerRegistry.entries()) {
                const kNorm = key.toLowerCase();
                if (kNorm === norm || kNorm.includes(norm) || norm.includes(kNorm)) {
                    return val;
                }
            }
            const newEntry = {
                id: clean,
                name: clean,
                image: null,
                businesses: new Map(),
                totalPaidStudents: 0,
                fullCount: 0,
                fullAmount: 0,
                monthlyCount: 0,
                monthlyAmount: 0,
                upgradeCount: 0,
                upgradeAmount: 0,
                installmentCount: 0,
                installmentAmount: 0,
                mixCount: 0,
                mixAmount: 0,
                adjustedCount: 0,
                adjustedAmount: 0,
                totalAmount: 0,
                grossSalary: 0,
                whtAmount: 0,
                teacherSalary: 0,
                instituteShare: 0
            };
            lecturerRegistry.set(clean, newEntry);
            return newEntry;
        };

        // 7. Calculate Finance Matrix for each batch and map to Lecturers (Theory Class & Paper Class)
        for (const [bId, batchData] of batchCoursesMap.entries()) {
            const [theoryMatrix, paperMatrix] = await Promise.all([
                callGetFinanceMatrix(bId, user, '1'),
                callGetFinanceMatrix(bId, user, '2')
            ]);

            const classTypeConfigs = [
                { classType: 1, groupType: 'Theory Class', matrix: theoryMatrix },
                { classType: 2, groupType: 'Paper Class', matrix: paperMatrix }
            ];

            const biz = batchData.business;
            const b = batchData.batch;

            for (const ctConfig of classTypeConfigs) {
                const { classType, groupType, matrix } = ctConfig;
                if (!matrix || !matrix.months || !matrix.students || matrix.months.length === 0 || matrix.students.length === 0) continue;

                // Find target months in matrix
                let targetMonths = [];
                if (dateType === 'ALL_TIME' || billingMonth === 'All' || billingMonth === 'all') {
                    targetMonths = matrix.months;
                } else {
                    const foundM = matrix.months.find(m => {
                        const pMonth = parseMonthName(m.name);
                        return pMonth && pMonth.toLowerCase() === targetMonthName.toLowerCase();
                    });
                    if (foundM) targetMonths = [foundM];
                }

                if (targetMonths.length === 0) continue;

                // Deduplicate courses by normalized subject name and lecturer within this batch & classType
                let relevantCourses = batchData.courses.filter(c => {
                    const ct = (c.courseType === 2 || c.group?.classType === 2) ? 2 : 1;
                    return ct === classType;
                });
                if (classType === 2 && relevantCourses.length === 0) {
                    relevantCourses = batchData.courses;
                }

                const uniqueBatchSubjects = new Map();
                relevantCourses.forEach(c => {
                    if (!c.lecturerName) return;
                    const cleanLecName = c.lecturerName.trim();
                    const normalizedSubName = c.name.trim().toUpperCase();
                    const key = `${normalizedSubName}:::${cleanLecName}`;
                    if (!uniqueBatchSubjects.has(key)) {
                        uniqueBatchSubjects.set(key, {
                            id: c.id,
                            name: c.name.trim(),
                            normalizedSubName,
                            lecturerName: cleanLecName
                        });
                    }
                });

                // Process each unique subject taught by a lecturer in this batch & classType
                uniqueBatchSubjects.forEach(item => {
                    const lec = findLecturerEntry(item.lecturerName);
                    if (!lec) return;

                    // Find matching subject in Finance Matrix
                    const matrixSub = matrix.subjects.find(s => 
                        s.toUpperCase() === item.normalizedSubName || 
                        s.toUpperCase().includes(item.normalizedSubName) ||
                        item.normalizedSubName.includes(s.toUpperCase())
                    );
                    if (!matrixSub) return;

                    // Calculate breakdown from Finance Matrix
                    const breakdown = {};
                    let subRevenue = 0;

                    matrix.students.forEach(stu => {
                        let studentHasPaidInTargetMonths = false;
                        let studentTotalInTargetMonths = 0;
                        let hasAdjusted = false;
                        let hasUpgrade = false;
                        let hasMonthly = false;
                        let hasFull = false;
                        let hasInstallment = false;

                        targetMonths.forEach(tMonth => {
                            const val = stu.matrixValues?.[tMonth.id]?.[matrixSub];
                            if (val && val.total > 0) {
                                studentHasPaidInTargetMonths = true;
                                studentTotalInTargetMonths += val.total;
                                if (val.Adjusted > 0) hasAdjusted = true;
                                if (val.Upgrade > 0) hasUpgrade = true;
                                if (val.Monthly > 0) hasMonthly = true;
                                if (val.Full > 0) hasFull = true;
                                if (val.Installment > 0) hasInstallment = true;
                            }
                        });

                        if (studentHasPaidInTargetMonths && studentTotalInTargetMonths > 0) {
                            let type = "Other";
                            if (hasAdjusted) type = "Adjusted";
                            else if (hasUpgrade) type = "Upgrade";
                            else if (hasMonthly) type = "Monthly";
                            else if (hasFull) type = "Full";
                            else if (hasInstallment) type = "Installment";
                            else type = stu.type || "Other";

                            if (!breakdown[type]) breakdown[type] = { count: 0, amount: 0 };
                            breakdown[type].count++;
                            breakdown[type].amount += studentTotalInTargetMonths;
                            subRevenue += studentTotalInTargetMonths;
                        }
                    });

                    const totalPaidStudents = Object.values(breakdown).reduce((s, item) => s + item.count, 0);
                    if (totalPaidStudents === 0 && subRevenue === 0) return;

                    const fullC = breakdown.Full?.count || 0;
                    const fullAmt = breakdown.Full?.amount || 0;
                    const monthlyC = breakdown.Monthly?.count || 0;
                    const monthlyAmt = breakdown.Monthly?.amount || 0;
                    const upgradeC = breakdown.Upgrade?.count || 0;
                    const upgradeAmt = breakdown.Upgrade?.amount || 0;
                    const mixC = breakdown.Hybrid?.count || 0;
                    const mixAmt = breakdown.Hybrid?.amount || 0;
                    const installmentC = breakdown.Installment?.count || 0;
                    const installmentAmt = breakdown.Installment?.amount || 0;
                    const adjustedC = breakdown.Adjusted?.count || 0;
                    const adjustedAmt = breakdown.Adjusted?.amount || 0;

                    // Add to Lecturer registry
                    lec.totalPaidStudents += totalPaidStudents;
                    lec.fullCount += fullC;
                    lec.fullAmount += fullAmt;
                    lec.monthlyCount += monthlyC;
                    lec.monthlyAmount += monthlyAmt;
                    lec.upgradeCount += upgradeC;
                    lec.upgradeAmount += upgradeAmt;
                    lec.installmentCount = (lec.installmentCount || 0) + installmentC;
                    lec.installmentAmount = (lec.installmentAmount || 0) + installmentAmt;
                    lec.mixCount = (lec.mixCount || 0) + installmentC;
                    lec.mixAmount = (lec.mixAmount || 0) + installmentAmt;
                    lec.adjustedCount = (lec.adjustedCount || 0) + adjustedC;
                    lec.adjustedAmount = (lec.adjustedAmount || 0) + adjustedAmt;
                    lec.totalAmount += subRevenue;

                    // Business entry
                    if (!lec.businesses.has(biz.id)) {
                        lec.businesses.set(biz.id, {
                            id: biz.id,
                            name: biz.name,
                            batches: new Map(),
                            totalPaidStudents: 0,
                            fullCount: 0,
                            fullAmount: 0,
                            monthlyCount: 0,
                            monthlyAmount: 0,
                            upgradeCount: 0,
                            upgradeAmount: 0,
                            installmentCount: 0,
                            installmentAmount: 0,
                            mixCount: 0,
                            mixAmount: 0,
                            adjustedCount: 0,
                            adjustedAmount: 0,
                            totalAmount: 0,
                            grossSalary: 0,
                            whtAmount: 0,
                            teacherSalary: 0,
                            instituteShare: 0
                        });
                    }
                    const bEntry = lec.businesses.get(biz.id);
                    bEntry.totalPaidStudents += totalPaidStudents;
                    bEntry.fullCount += fullC;
                    bEntry.fullAmount += fullAmt;
                    bEntry.monthlyCount += monthlyC;
                    bEntry.monthlyAmount += monthlyAmt;
                    bEntry.upgradeCount += upgradeC;
                    bEntry.upgradeAmount += upgradeAmt;
                    bEntry.installmentCount = (bEntry.installmentCount || 0) + installmentC;
                    bEntry.installmentAmount = (bEntry.installmentAmount || 0) + installmentAmt;
                    bEntry.mixCount = (bEntry.mixCount || 0) + installmentC;
                    bEntry.mixAmount = (bEntry.mixAmount || 0) + installmentAmt;
                    bEntry.adjustedCount += adjustedC;
                    bEntry.adjustedAmount = (bEntry.adjustedAmount || 0) + adjustedAmt;
                    bEntry.totalAmount += subRevenue;

                    // Batch entry
                    if (!bEntry.batches.has(b.id)) {
                        bEntry.batches.set(b.id, {
                            id: b.id,
                            name: b.name,
                            subjects: new Map(),
                            totalPaidStudents: 0,
                            fullCount: 0,
                            fullAmount: 0,
                            monthlyCount: 0,
                            monthlyAmount: 0,
                            upgradeCount: 0,
                            upgradeAmount: 0,
                            installmentCount: 0,
                            installmentAmount: 0,
                            mixCount: 0,
                            mixAmount: 0,
                            adjustedCount: 0,
                            adjustedAmount: 0,
                            totalAmount: 0,
                            grossSalary: 0,
                            whtAmount: 0,
                            teacherSalary: 0,
                            instituteShare: 0
                        });
                    }
                    const batchEntry = bEntry.batches.get(b.id);
                    batchEntry.totalPaidStudents += totalPaidStudents;
                    batchEntry.fullCount += fullC;
                    batchEntry.fullAmount += fullAmt;
                    batchEntry.monthlyCount += monthlyC;
                    batchEntry.monthlyAmount += monthlyAmt;
                    batchEntry.upgradeCount += upgradeC;
                    batchEntry.upgradeAmount += upgradeAmt;
                    batchEntry.installmentCount = (batchEntry.installmentCount || 0) + installmentC;
                    batchEntry.installmentAmount = (batchEntry.installmentAmount || 0) + installmentAmt;
                    batchEntry.mixCount = (batchEntry.mixCount || 0) + installmentC;
                    batchEntry.mixAmount = (batchEntry.mixAmount || 0) + installmentAmt;
                    batchEntry.adjustedCount += adjustedC;
                    batchEntry.adjustedAmount = (batchEntry.adjustedAmount || 0) + adjustedAmt;
                    batchEntry.totalAmount += subRevenue;

                    // Calculate Teacher Salary & Withholding Tax (WHT) for this subject & classType
                    const ruleKeySuffix = classType === 2 ? ':::PAPER' : '';
                    const rule = resolveSalaryRule(salaryRulesMap, b.id, item.lecturerName, `${item.normalizedSubName}${ruleKeySuffix}`)
                              || (classType === 2 ? resolveSalaryRule(salaryRulesMap, b.id, item.lecturerName, item.normalizedSubName) : null);

                    let grossSalary = 0;
                    let whtRate = 0;
                    let whtAmount = 0;
                    let teacherSalary = 0; // Net payable to teacher
                    let salaryModel = 'NOT_SET';

                    if (rule) {
                        salaryModel = rule.model; // 'COMMISSION' or 'FIXED'
                        if (rule.model === 'FIXED') {
                            grossSalary = Math.round(Number(rule.fixedAmount) || 0);
                        } else if (rule.model === 'COMMISSION') {
                            if (rule.commissionType === 'PER_STUDENT') {
                                const rate = Number(rule.perStudentRate) || 0;
                                grossSalary = Math.round(totalPaidStudents * rate);
                            } else {
                                // PERCENTAGE (default)
                                const pct = Number(rule.commissionRate) || 0;
                                grossSalary = Math.round((subRevenue * pct) / 100);
                            }
                        }
                        whtRate = Number(rule.whtRate) || 0;
                        if (whtRate > 0) {
                            whtAmount = Math.round((grossSalary * whtRate) / 100);
                        }
                        teacherSalary = Math.max(0, grossSalary - whtAmount);
                    }
                    const instituteShare = Math.max(0, Math.round(subRevenue - grossSalary));

                    lec.grossSalary = (lec.grossSalary || 0) + grossSalary;
                    lec.whtAmount = (lec.whtAmount || 0) + whtAmount;
                    lec.teacherSalary = (lec.teacherSalary || 0) + teacherSalary;
                    lec.instituteShare = (lec.instituteShare || 0) + instituteShare;

                    bEntry.grossSalary = (bEntry.grossSalary || 0) + grossSalary;
                    bEntry.whtAmount = (bEntry.whtAmount || 0) + whtAmount;
                    bEntry.teacherSalary = (bEntry.teacherSalary || 0) + teacherSalary;
                    bEntry.instituteShare = (bEntry.instituteShare || 0) + instituteShare;

                    batchEntry.grossSalary = (batchEntry.grossSalary || 0) + grossSalary;
                    batchEntry.whtAmount = (batchEntry.whtAmount || 0) + whtAmount;
                    batchEntry.teacherSalary = (batchEntry.teacherSalary || 0) + teacherSalary;
                    batchEntry.instituteShare = (batchEntry.instituteShare || 0) + instituteShare;

                    // Subject entry (differentiated by subject + classType)
                    const subjectKey = `${item.normalizedSubName}:::${classType}`;
                    if (!batchEntry.subjects.has(subjectKey)) {
                        batchEntry.subjects.set(subjectKey, {
                            id: item.id,
                            name: item.name,
                            normalizedSubName: item.normalizedSubName,
                            batchId: b.id,
                            batchName: b.name,
                            lecturerName: item.lecturerName,
                            groupName: targetMonths.map(m => m.name).join(', '),
                            groupType: groupType,
                            classType: classType,
                            isPaperClass: classType === 2,
                            monthlyCount: monthlyC,
                            monthlyAmount: Math.round(monthlyAmt),
                            fullCount: fullC,
                            fullAmount: Math.round(fullAmt),
                            upgradeCount: upgradeC,
                            upgradeAmount: Math.round(upgradeAmt),
                            installmentCount: installmentC,
                            installmentAmount: Math.round(installmentAmt),
                            mixCount: installmentC,
                            mixAmount: Math.round(installmentAmt),
                            adjustedCount: adjustedC,
                            adjustedAmount: Math.round(adjustedAmt),
                            totalApproved: totalPaidStudents, // Paid student count matching Finance Matrix!
                            totalAmount: Math.round(subRevenue),
                            salaryRuleKey: `${b.id}:::${item.lecturerName}:::${item.normalizedSubName}${ruleKeySuffix}`,
                            salaryConfig: rule,
                            salaryModel,
                            grossSalary,
                            whtRate,
                            whtAmount,
                            teacherSalary,
                            instituteShare
                        });
                    }
                });
            }
        }

        // 8. Format Output Array
        let formattedLecturers = Array.from(lecturerRegistry.values()).map(lec => {
            const businessesArr = Array.from(lec.businesses.values()).map(b => {
                const batchesArr = Array.from(b.batches.values()).map(batch => {
                    const allSubjects = Array.from(batch.subjects.values()).sort((s1, s2) => s2.totalApproved - s1.totalApproved);
                    const theorySubjects = allSubjects.filter(s => s.classType === 1);
                    const paperSubjects = allSubjects.filter(s => s.classType === 2);
                    return {
                        id: batch.id,
                        name: batch.name,
                        totalApproved: batch.totalPaidStudents,
                        fullCount: batch.fullCount,
                        fullAmount: Math.round(batch.fullAmount || 0),
                        monthlyCount: batch.monthlyCount,
                        monthlyAmount: Math.round(batch.monthlyAmount || 0),
                        upgradeCount: batch.upgradeCount,
                        upgradeAmount: Math.round(batch.upgradeAmount || 0),
                        installmentCount: batch.installmentCount || batch.mixCount || 0,
                        installmentAmount: Math.round(batch.installmentAmount || batch.mixAmount || 0),
                        mixCount: batch.installmentCount || batch.mixCount || 0,
                        mixAmount: Math.round(batch.installmentAmount || batch.mixAmount || 0),
                        adjustedCount: batch.adjustedCount || 0,
                        adjustedAmount: Math.round(batch.adjustedAmount || 0),
                        totalAmount: Math.round(batch.totalAmount),
                        grossSalary: Math.round(batch.grossSalary || 0),
                        whtAmount: Math.round(batch.whtAmount || 0),
                        teacherSalary: Math.round(batch.teacherSalary || 0),
                        instituteShare: Math.round(batch.instituteShare || 0),
                        subjects: allSubjects,
                        theorySubjects,
                        paperSubjects,
                        hasPaperClasses: paperSubjects.length > 0
                    };
                }).filter(batch => batch.subjects.length > 0);

                return {
                    id: b.id,
                    name: b.name,
                    totalApproved: b.totalPaidStudents,
                    fullCount: b.fullCount,
                    fullAmount: Math.round(b.fullAmount || 0),
                    monthlyCount: b.monthlyCount,
                    monthlyAmount: Math.round(b.monthlyAmount || 0),
                    upgradeCount: b.upgradeCount,
                    upgradeAmount: Math.round(b.upgradeAmount || 0),
                    installmentCount: b.installmentCount || b.mixCount || 0,
                    installmentAmount: Math.round(b.installmentAmount || b.mixAmount || 0),
                    mixCount: b.installmentCount || b.mixCount || 0,
                    mixAmount: Math.round(b.installmentAmount || b.mixAmount || 0),
                    adjustedCount: b.adjustedCount || 0,
                    adjustedAmount: Math.round(b.adjustedAmount || 0),
                    totalAmount: Math.round(b.totalAmount),
                    grossSalary: Math.round(b.grossSalary || 0),
                    whtAmount: Math.round(b.whtAmount || 0),
                    teacherSalary: Math.round(b.teacherSalary || 0),
                    instituteShare: Math.round(b.instituteShare || 0),
                    batches: batchesArr
                };
            }).filter(biz => biz.batches.length > 0);

            return {
                id: lec.id,
                name: lec.name,
                image: lec.image,
                totalApproved: lec.totalPaidStudents,
                fullCount: lec.fullCount,
                fullAmount: Math.round(lec.fullAmount || 0),
                monthlyCount: lec.monthlyCount,
                monthlyAmount: Math.round(lec.monthlyAmount || 0),
                upgradeCount: lec.upgradeCount,
                upgradeAmount: Math.round(lec.upgradeAmount || 0),
                installmentCount: lec.installmentCount || lec.mixCount || 0,
                installmentAmount: Math.round(lec.installmentAmount || lec.mixAmount || 0),
                mixCount: lec.installmentCount || lec.mixCount || 0,
                mixAmount: Math.round(lec.installmentAmount || lec.mixAmount || 0),
                adjustedCount: lec.adjustedCount || 0,
                adjustedAmount: Math.round(lec.adjustedAmount || 0),
                totalAmount: Math.round(lec.totalAmount),
                grossSalary: Math.round(lec.grossSalary || 0),
                whtAmount: Math.round(lec.whtAmount || 0),
                teacherSalary: Math.round(lec.teacherSalary || 0),
                instituteShare: Math.round(lec.instituteShare || 0),
                businessesCount: businessesArr.length,
                batchesCount: businessesArr.reduce((acc, b) => acc + b.batches.length, 0),
                subjectsCount: businessesArr.reduce((acc, b) => acc + b.batches.reduce((subAcc, bt) => subAcc + bt.subjects.length, 0), 0),
                businesses: businessesArr
            };
        });

        formattedLecturers = formattedLecturers.filter(l => l.businessesCount > 0);

        // Search filter
        if (search && search.trim() !== '') {
            const q = search.toLowerCase().trim();
            formattedLecturers = formattedLecturers.filter(l => {
                if (l.name.toLowerCase().includes(q)) return true;
                return l.businesses.some(b => 
                    b.name.toLowerCase().includes(q) ||
                    b.batches.some(bt => 
                        bt.name.toLowerCase().includes(q) ||
                        bt.subjects.some(s => s.name.toLowerCase().includes(q))
                    )
                );
            });
        }

        // Query Lecturer filter
        if (queryLecturer && queryLecturer !== 'All' && queryLecturer !== 'all') {
            const qLec = queryLecturer.toLowerCase().trim();
            formattedLecturers = formattedLecturers.filter(l => l.name.toLowerCase().includes(qLec));
        }

        formattedLecturers.sort((a, b) => b.totalApproved - a.totalApproved);

        // Summary KPI calculations
        const summary = {
            totalLecturers: formattedLecturers.length,
            totalApprovedStudents: formattedLecturers.reduce((acc, l) => acc + l.totalApproved, 0),
            totalFullPayments: formattedLecturers.reduce((acc, l) => acc + l.fullCount, 0),
            totalFullRevenue: formattedLecturers.reduce((acc, l) => acc + (l.fullAmount || 0), 0),
            totalMonthlyPayments: formattedLecturers.reduce((acc, l) => acc + l.monthlyCount, 0),
            totalMonthlyRevenue: formattedLecturers.reduce((acc, l) => acc + (l.monthlyAmount || 0), 0),
            totalUpgradePayments: formattedLecturers.reduce((acc, l) => acc + l.upgradeCount, 0),
            totalUpgradeRevenue: formattedLecturers.reduce((acc, l) => acc + (l.upgradeAmount || 0), 0),
            totalInstallmentPayments: formattedLecturers.reduce((acc, l) => acc + (l.installmentCount || l.mixCount || 0), 0),
            totalInstallmentRevenue: formattedLecturers.reduce((acc, l) => acc + (l.installmentAmount || l.mixAmount || 0), 0),
            totalMixPayments: formattedLecturers.reduce((acc, l) => acc + (l.installmentCount || l.mixCount || 0), 0),
            totalMixRevenue: formattedLecturers.reduce((acc, l) => acc + (l.installmentAmount || l.mixAmount || 0), 0),
            totalAdjustedPayments: formattedLecturers.reduce((acc, l) => acc + (l.adjustedCount || 0), 0),
            totalAdjustedRevenue: formattedLecturers.reduce((acc, l) => acc + (l.adjustedAmount || 0), 0),
            totalRevenue: formattedLecturers.reduce((acc, l) => acc + l.totalAmount, 0),
            totalGrossSalary: formattedLecturers.reduce((acc, l) => acc + (l.grossSalary || 0), 0),
            totalWhtAmount: formattedLecturers.reduce((acc, l) => acc + (l.whtAmount || 0), 0),
            totalTeacherSalary: formattedLecturers.reduce((acc, l) => acc + (l.teacherSalary || 0), 0),
            totalInstituteShare: formattedLecturers.reduce((acc, l) => acc + (l.instituteShare || 0), 0)
        };

        const adjKey = targetMonthKey ? `TEACHER_SALARY_ADJ_${targetMonthKey}` : 'TEACHER_SALARY_ADJUSTMENTS';
        const adjSetting = await prisma.appSetting.findUnique({ where: { key: adjKey } });
        const savedAdjustments = adjSetting?.value ? JSON.parse(adjSetting.value) : {};

        const safeJson = (data) => JSON.parse(JSON.stringify(data, (k, v) => typeof v === 'bigint' ? v.toString() : v));

        return res.status(200).json({
            businesses: safeJson(accessibleBusinesses),
            lecturers: safeJson(formattedLecturers),
            availableBillingMonths: safeJson(availableBillingMonths),
            activeCycle: safeJson(activeCycleInfo),
            summary: safeJson(summary),
            savedAdjustments: safeJson(savedAdjustments)
        });

    } catch (error) {
        console.error("Error in getTeacherSalaryBreakdown:", error);
        return res.status(500).json({ error: "Failed to generate teachers salary breakdown." });
    }
};

/**
 * Get saved Teacher Salary Configuration rules
 */
exports.getTeacherSalaryConfig = async (req, res) => {
    try {
        const setting = await prisma.appSetting.findUnique({
            where: { key: 'TEACHER_SALARY_CONFIG' }
        });
        const config = setting?.value ? JSON.parse(setting.value) : {};
        return res.status(200).json({ success: true, config });
    } catch (error) {
        console.error("Error fetching teacher salary config:", error);
        return res.status(500).json({ error: "Failed to fetch teacher salary configuration." });
    }
};

/**
 * Save or update Teacher Salary Configuration rule
 * Supports:
 * - Model: COMMISSION (Percentage or Per Student) vs FIXED (Fixed Amount per Batch)
 * - Scope: Per Batch/Subject or Apply to all batches of subject
 */
exports.saveTeacherSalaryConfig = async (req, res) => {
    try {
        const { ruleKey, rule, applyToAllBatches } = req.body;

        if (!ruleKey && !rule) {
            return res.status(400).json({ error: "Rule key or rule object is required." });
        }

        const setting = await prisma.appSetting.findUnique({
            where: { key: 'TEACHER_SALARY_CONFIG' }
        });
        let config = setting?.value ? JSON.parse(setting.value) : {};

        if (rule === null) {
            // Delete rule
            delete config[ruleKey];
        } else if (rule && ruleKey) {
            const sanitizedRule = {
                model: rule.model === 'FIXED' ? 'FIXED' : 'COMMISSION',
                commissionType: rule.commissionType === 'PER_STUDENT' ? 'PER_STUDENT' : 'PERCENTAGE',
                commissionRate: Number(rule.commissionRate) || 0,
                perStudentRate: Number(rule.perStudentRate) || 0,
                fixedAmount: Number(rule.fixedAmount) || 0,
                whtRate: Math.max(0, Math.min(100, Number(rule.whtRate) || 0)),
                batchId: rule.batchId || null,
                batchName: rule.batchName || '',
                subjectName: rule.subjectName || '',
                normalizedSubName: (rule.normalizedSubName || '').trim().toUpperCase(),
                lecturerName: (rule.lecturerName || '').trim(),
                note: rule.note || '',
                updatedAt: new Date().toISOString()
            };

            config[ruleKey] = sanitizedRule;

            // Apply across all batches if requested
            if (applyToAllBatches && sanitizedRule.lecturerName && sanitizedRule.normalizedSubName) {
                const isPaper = ruleKey.endsWith(':::PAPER');
                const globalKey = `GLOBAL:::${sanitizedRule.lecturerName}:::${sanitizedRule.normalizedSubName}${isPaper ? ':::PAPER' : ''}`;
                config[globalKey] = {
                    ...sanitizedRule,
                    batchId: null,
                    batchName: 'All Batches',
                    updatedAt: new Date().toISOString()
                };
            }
        }

        await prisma.appSetting.upsert({
            where: { key: 'TEACHER_SALARY_CONFIG' },
            create: {
                key: 'TEACHER_SALARY_CONFIG',
                value: JSON.stringify(config)
            },
            update: {
                value: JSON.stringify(config)
            }
        });

        return res.status(200).json({
            success: true,
            message: "Teacher salary configuration saved successfully.",
            config
        });
    } catch (error) {
        console.error("Error saving teacher salary config:", error);
        return res.status(500).json({ error: "Failed to save teacher salary configuration." });
    }
};

/**
 * Get saved Teacher Salary Custom Payout Adjustments for a billing month
 */
exports.getTeacherSalaryAdjustments = async (req, res) => {
    try {
        const { billingMonth } = req.query;
        const key = billingMonth ? `TEACHER_SALARY_ADJ_${billingMonth}` : 'TEACHER_SALARY_ADJUSTMENTS';
        const setting = await prisma.appSetting.findUnique({ where: { key } });
        const adjustments = setting?.value ? JSON.parse(setting.value) : {};
        return res.status(200).json({ success: true, adjustments });
    } catch (error) {
        console.error("Error fetching teacher salary adjustments:", error);
        return res.status(500).json({ error: "Failed to fetch teacher salary adjustments." });
    }
};

/**
 * Save Teacher Salary Custom Payout Adjustments for a billing month
 */
exports.saveTeacherSalaryAdjustments = async (req, res) => {
    try {
        const { billingMonth, adjustments } = req.body;
        const key = billingMonth ? `TEACHER_SALARY_ADJ_${billingMonth}` : 'TEACHER_SALARY_ADJUSTMENTS';
        await prisma.appSetting.upsert({
            where: { key },
            create: {
                key,
                value: JSON.stringify(adjustments || {})
            },
            update: {
                value: JSON.stringify(adjustments || {})
            }
        });

        if (billingMonth) {
            await prisma.appSetting.deleteMany({
                where: { key: `TEACHER_SALARY_CYCLE_CACHE_${billingMonth}` }
            }).catch(() => {});
        }

        return res.status(200).json({
            success: true,
            message: "Teacher salary adjustments saved successfully."
        });
    } catch (error) {
        console.error("Error saving teacher salary adjustments:", error);
        return res.status(500).json({ error: "Failed to save teacher salary adjustments." });
    }
};

/**
 * Controller for Cycle-Wise Salary History & Management
 * Features:
 * - True Apportioned Income (Institute revenue)
 * - True Salary vs Paid Salary Comparison & Variance
 * - Business-wise Month-by-Month Totals of all Teachers
 * - Multi-Cycle Timeline & Historical Audit
 * - Status Management (Draft, Audited, Settled)
 */
exports.getTeacherSalaryHistory = async (req, res) => {
    try {
        const { billingMonth, businessId, forceRefresh, search } = req.query;
        const user = req.user;

        // Default month
        let targetMonthKey = billingMonth;
        if (!targetMonthKey || targetMonthKey === 'All' || targetMonthKey === 'all') {
            targetMonthKey = '2026-10'; // default to active month
        }

        const cacheKey = `TEACHER_SALARY_CYCLE_CACHE_${targetMonthKey}`;

        // Check cache if not force refresh
        if (forceRefresh !== 'true' && forceRefresh !== true) {
            const cachedSetting = await prisma.appSetting.findUnique({ where: { key: cacheKey } });
            if (cachedSetting && cachedSetting.value) {
                try {
                    const cachedData = JSON.parse(cachedSetting.value);
                    let filteredBiz = cachedData.businesses || [];
                    if (businessId && businessId !== 'All' && businessId !== 'all') {
                        filteredBiz = filteredBiz.filter(b => String(b.id) === String(businessId));
                    }
                    if (search && search.trim() !== '') {
                        const q = search.toLowerCase().trim();
                        filteredBiz = filteredBiz.map(b => ({
                            ...b,
                            teachers: b.teachers.filter(t => 
                                t.name.toLowerCase().includes(q) ||
                                (t.batches || []).some(bt => bt.toLowerCase().includes(q))
                            )
                        })).filter(b => b.teachers.length > 0 || b.name.toLowerCase().includes(q));
                    }
                    return res.status(200).json({
                        ...cachedData,
                        businesses: filteredBiz
                    });
                } catch (e) {
                    console.warn("Error parsing cached history:", e);
                }
            }
        }

        // Generate full breakdown for this billing month
        const mockReq = {
            query: { billingMonth: targetMonthKey, businessId: 'All' },
            user: { ...(user || {}), role: 'SYSTEM_ADMIN', department: 'Finance', isAdmin: true }
        };
        let breakdownResult = null;
        const mockRes = {
            status: (code) => {
                if (code >= 400) return { json: () => { breakdownResult = null; } };
                return mockRes;
            },
            json: (data) => { breakdownResult = data; }
        };
        await exports.getTeacherSalaryBreakdown(mockReq, mockRes);

        if (!breakdownResult) {
            return res.status(500).json({ error: "Failed to compute cycle salary history." });
        }

        const savedAdj = breakdownResult.savedAdjustments || {};
        const activeCycle = breakdownResult.activeCycle || {};
        const availableBillingMonths = breakdownResult.availableBillingMonths || [];
        const accessibleBusinesses = breakdownResult.businesses || [];

        // Fetch cycle status & notes
        const statusSettingKey = `TEACHER_SALARY_CYCLE_STATUS_${targetMonthKey}`;
        const statusSetting = await prisma.appSetting.findUnique({ where: { key: statusSettingKey } });
        let cycleStatusData = {
            status: 'DRAFT',
            settledAt: null,
            settledBy: null,
            notes: ''
        };
        if (statusSetting && statusSetting.value) {
            try { cycleStatusData = JSON.parse(statusSetting.value); } catch (e) {}
        }

        // Compute per-business and per-teacher true vs paid
        const bizMap = {};
        for (const biz of accessibleBusinesses) {
            bizMap[biz.id] = {
                id: biz.id,
                name: biz.name,
                category: biz.category,
                trueIncome: 0,
                trueSalary: 0,
                paidSalary: 0,
                trueStudents: 0,
                paidStudents: 0,
                variance: 0,
                instituteShare: 0,
                teachersCount: 0,
                teachers: []
            };
        }

        let overallTrueIncome = 0;
        let overallTrueSalary = 0;
        let overallPaidSalary = 0;
        let overallTrueStudents = 0;
        let overallPaidStudents = 0;

        for (const lec of (breakdownResult.lecturers || [])) {
            for (const b of (lec.businesses || [])) {
                if (!bizMap[b.id]) {
                    bizMap[b.id] = {
                        id: b.id,
                        name: b.name,
                        category: b.category,
                        trueIncome: 0,
                        trueSalary: 0,
                        paidSalary: 0,
                        trueStudents: 0,
                        paidStudents: 0,
                        variance: 0,
                        instituteShare: 0,
                        teachersCount: 0,
                        teachers: []
                    };
                }

                const trueStudents = b.totalApproved || 0;
                const trueIncome = b.totalAmount || 0;
                const trueGrossSalary = b.grossSalary || 0;
                const trueWht = b.whtAmount || 0;
                const trueSalary = b.teacherSalary || 0;

                // Compute subject-level adjustments
                let adjustedStudents = 0;
                let adjustedIncome = 0;
                let adjustedGrossSalary = 0;
                let adjustedWhtAmount = 0;
                let adjustedTeacherSalary = 0;
                let isAnySubjectCountModified = false;

                const batchNames = [];
                for (const bt of (b.batches || [])) {
                    batchNames.push(bt.name);
                    for (const s of (bt.subjects || [])) {
                        const isPaperSuffix = (s.classType === 2 || s.isPaperClass) ? ':::PAPER' : '';
                        const adjKey = `${targetMonthKey}:::${bt.id}:::${s.normalizedSubName || s.name}${isPaperSuffix}`;
                        const adj = savedAdj[adjKey];

                        if (adj) {
                            isAnySubjectCountModified = true;
                            const mCount = adj.monthlyCount !== undefined && adj.monthlyCount !== '' ? Number(adj.monthlyCount) : s.monthlyCount;
                            const fCount = adj.fullCount !== undefined && adj.fullCount !== '' ? Number(adj.fullCount) : s.fullCount;
                            const uCount = adj.upgradeCount !== undefined && adj.upgradeCount !== '' ? Number(adj.upgradeCount) : (s.upgradeCount || 0);
                            const installmentCount = adj.installmentCount !== undefined && adj.installmentCount !== ''
                                ? Number(adj.installmentCount)
                                : (adj.mixCount !== undefined && adj.mixCount !== '' ? Number(adj.mixCount) : (s.installmentCount || s.mixCount || 0));
                            const aCount = adj.adjustedCount !== undefined && adj.adjustedCount !== '' ? Number(adj.adjustedCount) : (s.adjustedCount || 0);

                            const mRate = s.monthlyCount > 0 ? (s.monthlyAmount / s.monthlyCount) : (s.totalAmount / (s.totalApproved || 1));
                            const fRate = s.fullCount > 0 ? (s.fullAmount / s.fullCount) : mRate;
                            const uRate = s.upgradeCount > 0 ? (s.upgradeAmount / s.upgradeCount) : mRate;
                            const installmentRate = s.installmentCount > 0
                                ? (s.installmentAmount / s.installmentCount)
                                : (s.mixCount > 0 ? (s.mixAmount / s.mixCount) : mRate);
                            const aRate = s.adjustedCount > 0 ? (s.adjustedAmount / s.adjustedCount) : (mRate * 0.5);

                            const subStudents = mCount + fCount + uCount + installmentCount + aCount;
                            const subRev = Math.round(mCount * mRate + fCount * fRate + uCount * uRate + installmentCount * installmentRate + aCount * aRate);

                            let subGross = 0;
                            const rule = s.salaryConfig;
                            if (rule) {
                                if (rule.model === 'FIXED') {
                                    subGross = Math.round(Number(rule.fixedAmount) || 0);
                                } else if (rule.commissionType === 'PER_STUDENT') {
                                    subGross = Math.round(subStudents * (Number(rule.perStudentRate) || 0));
                                } else {
                                    subGross = Math.round((subRev * (Number(rule.commissionRate) || 0)) / 100);
                                }
                            } else {
                                const ratio = (s.totalAmount > 0 && s.grossSalary > 0) ? (s.grossSalary / s.totalAmount) : 0.5;
                                subGross = Math.round(subRev * ratio);
                            }

                            const wRate = Number(rule?.whtRate ?? s.whtRate ?? 0) || 0;
                            const wAmt = wRate > 0 ? Math.round((subGross * wRate) / 100) : 0;
                            const subNet = Math.max(0, subGross - wAmt);

                            adjustedStudents += subStudents;
                            adjustedIncome += subRev;
                            adjustedGrossSalary += subGross;
                            adjustedWhtAmount += wAmt;
                            adjustedTeacherSalary += subNet;
                        } else {
                            adjustedStudents += (s.totalApproved || 0);
                            adjustedIncome += (s.totalAmount || 0);
                            adjustedGrossSalary += (s.grossSalary || 0);
                            adjustedWhtAmount += (s.whtAmount || 0);
                            adjustedTeacherSalary += (s.teacherSalary || 0);
                        }
                    }
                }

                // Check voucher adjustments (deductions, additions, breakdown mode)
                const vKey = `VOUCHER_ADJ:::${targetMonthKey}:::${lec.name}:::MULTI-${b.id}`;
                const vAdj = savedAdj[vKey] || {};
                const additionsList = vAdj.additions || [];
                const deductionsList = vAdj.deductions || [];
                const additionsTotal = additionsList.reduce((acc, a) => acc + (parseFloat(a.amount) || 0), 0);
                const deductionsTotal = deductionsList.reduce((acc, d) => acc + (parseFloat(d.amount) || 0), 0);
                const breakdownMode = vAdj.breakdownMode || 'DETAILED';

                const paidSalary = Math.max(0, adjustedTeacherSalary + additionsTotal - deductionsTotal);
                const variance = paidSalary - trueSalary;
                const isModified = isAnySubjectCountModified || additionsTotal > 0 || deductionsTotal > 0;

                bizMap[b.id].trueIncome += trueIncome;
                bizMap[b.id].trueSalary += trueSalary;
                bizMap[b.id].paidSalary += paidSalary;
                bizMap[b.id].trueStudents += trueStudents;
                bizMap[b.id].paidStudents += adjustedStudents;

                overallTrueIncome += trueIncome;
                overallTrueSalary += trueSalary;
                overallPaidSalary += paidSalary;
                overallTrueStudents += trueStudents;
                overallPaidStudents += adjustedStudents;

                bizMap[b.id].teachers.push({
                    name: lec.name,
                    image: lec.image,
                    batches: Array.from(new Set(batchNames)),
                    businessId: b.id,
                    businessName: b.name,
                    trueStudents,
                    paidStudents: adjustedStudents,
                    studentsDiff: adjustedStudents - trueStudents,
                    trueIncome,
                    paidIncome: adjustedIncome,
                    trueSalary,
                    paidSalary,
                    variance,
                    trueGrossSalary,
                    paidGrossSalary: adjustedGrossSalary,
                    trueWht,
                    paidWht: adjustedWhtAmount,
                    additions: additionsTotal,
                    deductions: deductionsTotal,
                    additionsList,
                    deductionsList,
                    breakdownMode,
                    status: isModified ? 'ADJUSTED' : 'EXACT',
                    batchesCount: b.batches?.length || 1,
                    rawSlipData: {
                        isConsolidated: true,
                        business: { id: b.id, name: b.name },
                        lecturer: { name: lec.name, image: lec.image },
                        batchesCount: b.batches?.length || 1,
                        additions: additionsList,
                        deductions: deductionsList,
                        breakdownMode,
                        subtotalAdj: {
                            totalApproved: adjustedStudents,
                            monthlyCount: b.monthlyCount,
                            fullCount: b.fullCount,
                            upgradeCount: b.upgradeCount,
                            installmentCount: b.installmentCount || b.mixCount || 0,
                            mixCount: b.installmentCount || b.mixCount || 0,
                            adjustedCount: b.adjustedCount,
                            totalAmount: adjustedIncome,
                            grossSalary: adjustedGrossSalary,
                            whtAmount: adjustedWhtAmount,
                            teacherSalary: adjustedTeacherSalary
                        }
                    }
                });
            }
        }

        // Format businesses list
        const businessesList = Object.values(bizMap).map(biz => {
            biz.variance = biz.paidSalary - biz.trueSalary;
            biz.instituteShare = Math.max(0, biz.trueIncome - biz.paidSalary);
            biz.teachersCount = biz.teachers.length;
            biz.teachers.sort((a, b) => b.paidSalary - a.paidSalary);
            return biz;
        }).filter(b => b.teachersCount > 0 || b.trueIncome > 0);

        businessesList.sort((a, b) => b.paidSalary - a.paidSalary);

        // Multi-cycle summary timeline
        const allPayments = await prisma.payment.findMany({
            where: { status: 1, amount: { gt: 0 } },
            select: { created_at: true, amount: true }
        });
        const timelineMap = {};
        for (const p of allPayments) {
            if (!p.created_at) continue;
            const d = new Date(p.created_at);
            const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!timelineMap[k]) {
                const [y, m] = k.split('-').map(Number);
                timelineMap[k] = {
                    monthKey: k,
                    year: y,
                    monthName: MONTH_NAMES[m - 1],
                    label: `${MONTH_NAMES[m - 1]} ${y}`,
                    paymentsCount: 0,
                    revenue: 0,
                    status: 'PENDING'
                };
            }
            timelineMap[k].paymentsCount++;
            timelineMap[k].revenue += p.amount;
        }

        // Fetch saved status for other cycles
        const allStatusKeys = Object.keys(timelineMap).map(k => `TEACHER_SALARY_CYCLE_STATUS_${k}`);
        const statusSettings = await prisma.appSetting.findMany({
            where: { key: { in: allStatusKeys } }
        });
        const statusLookup = {};
        for (const s of statusSettings) {
            try {
                const k = s.key.replace('TEACHER_SALARY_CYCLE_STATUS_', '');
                statusLookup[k] = JSON.parse(s.value);
            } catch (e) {}
        }

        const multiCycleTimeline = Object.values(timelineMap).sort((a, b) => b.monthKey.localeCompare(a.monthKey)).map(t => {
            const st = statusLookup[t.monthKey] || {};
            return {
                ...t,
                status: st.status || (t.monthKey === targetMonthKey ? cycleStatusData.status : 'PENDING'),
                settledAt: st.settledAt || null,
                settledBy: st.settledBy || null,
                notes: st.notes || ''
            };
        });

        const overallVariance = overallPaidSalary - overallTrueSalary;
        const resultPayload = {
            success: true,
            activeCycle: {
                ...activeCycle,
                status: cycleStatusData.status,
                settledAt: cycleStatusData.settledAt,
                settledBy: cycleStatusData.settledBy,
                notes: cycleStatusData.notes
            },
            availableBillingMonths,
            multiCycleTimeline,
            summary: {
                totalTrueIncome: overallTrueIncome,
                totalTrueSalary: overallTrueSalary,
                totalPaidSalary: overallPaidSalary,
                totalVariance: overallVariance,
                varianceType: overallVariance < 0 ? 'SAVINGS' : (overallVariance > 0 ? 'EXTRA_PAID' : 'EXACT'),
                instituteSavings: Math.max(0, -overallVariance),
                instituteExtraPaid: Math.max(0, overallVariance),
                totalInstituteShare: Math.max(0, overallTrueIncome - overallPaidSalary),
                totalLecturers: (breakdownResult.lecturers || []).length,
                totalBusinesses: businessesList.length,
                totalTrueStudents: overallTrueStudents,
                totalPaidStudents: overallPaidStudents
            },
            businesses: businessesList
        };

        // Cache result for rapid subsequent loads
        await prisma.appSetting.upsert({
            where: { key: cacheKey },
            create: { key: cacheKey, value: JSON.stringify(resultPayload) },
            update: { value: JSON.stringify(resultPayload) }
        }).catch(err => console.warn("Cache write warning:", err));

        // Filter by businessId or search if provided
        let filteredBiz = businessesList;
        if (businessId && businessId !== 'All' && businessId !== 'all') {
            filteredBiz = filteredBiz.filter(b => String(b.id) === String(businessId));
        }
        if (search && search.trim() !== '') {
            const q = search.toLowerCase().trim();
            filteredBiz = filteredBiz.map(b => ({
                ...b,
                teachers: b.teachers.filter(t => 
                    t.name.toLowerCase().includes(q) ||
                    (t.batches || []).some(bt => bt.toLowerCase().includes(q))
                )
            })).filter(b => b.teachers.length > 0 || b.name.toLowerCase().includes(q));
        }

        return res.status(200).json({
            ...resultPayload,
            businesses: filteredBiz
        });

    } catch (error) {
        console.error("Error in getTeacherSalaryHistory:", error);
        return res.status(500).json({ error: "Failed to generate cycle salary history." });
    }
};

/**
 * Save Cycle Status (e.g. DRAFT, AUDITED, SETTLED) with notes
 */
exports.saveTeacherSalaryCycleStatus = async (req, res) => {
    try {
        const { billingMonth, status, notes } = req.body;
        if (!billingMonth) {
            return res.status(400).json({ error: "Billing month is required." });
        }
        const user = req.user;
        const key = `TEACHER_SALARY_CYCLE_STATUS_${billingMonth}`;
        const payload = {
            status: status || 'DRAFT',
            settledAt: status === 'SETTLED' ? new Date().toISOString() : null,
            settledBy: status === 'SETTLED' ? (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Finance Admin') : null,
            notes: notes || '',
            updatedAt: new Date().toISOString()
        };

        await prisma.appSetting.upsert({
            where: { key },
            create: { key, value: JSON.stringify(payload) },
            update: { value: JSON.stringify(payload) }
        });

        // Invalidate cache
        await prisma.appSetting.deleteMany({
            where: { key: `TEACHER_SALARY_CYCLE_CACHE_${billingMonth}` }
        }).catch(() => {});

        return res.status(200).json({
            success: true,
            message: "Cycle status updated successfully.",
            cycleStatus: payload
        });
    } catch (error) {
        console.error("Error saving cycle status:", error);
        return res.status(500).json({ error: "Failed to save cycle status." });
    }
};
