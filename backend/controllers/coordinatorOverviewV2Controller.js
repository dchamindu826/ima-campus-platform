const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');
if (process.env.NODE_ENV !== 'production') global.prisma = prisma;

exports.getCoordinatorV2Stats = async (req, res) => {
    try {
        const userId = parseInt(req.user?.userId || req.user?.id || req.query.loggedUserId);
        if (!userId || isNaN(userId)) {
            return res.status(401).json({ error: "Unauthorized. Missing user ID." });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true, businessType: true }
        });

        if (!user) return res.status(404).json({ error: "User not found." });

        const userRole = String(user.role).toUpperCase().replace(/ /g, '_');
        const isAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER'].includes(userRole);
        const isManager = ['MANAGER', 'ASS_MANAGER'].includes(userRole);

        // Fetch assigned businesses for Manager/Admin
        let assignedBusinessIds = [];
        if (isManager || isAdmin) {
            if (isAdmin) {
                const allBiz = await prisma.business.findMany({ select: { id: true } });
                assignedBusinessIds = allBiz.map(b => b.id);
            } else {
                const allBiz = await prisma.business.findMany();
                const matches = [];
                allBiz.forEach(biz => {
                    const isManagerOf = biz.head_manager_id === userId || biz.ass_manager_id === userId;
                    const matchesBizType = user.businessType && (
                        String(biz.id) === String(user.businessType).trim() ||
                        biz.name.toLowerCase().trim() === String(user.businessType).toLowerCase().trim() ||
                        biz.name.toLowerCase().includes(String(user.businessType).toLowerCase().trim()) ||
                        String(user.businessType).toLowerCase().trim().includes(biz.name.toLowerCase().trim())
                    );
                    if (isManagerOf || matchesBizType) matches.push(biz.id);
                });
                assignedBusinessIds = matches;
            }
        }

        const { businessId, batchId } = req.query;
        let baseLeadFilter = {};

        if (isAdmin || isManager) {
            if (batchId && batchId !== '' && batchId !== 'undefined' && batchId !== 'null') {
                baseLeadFilter.batchId = parseInt(batchId);
            } else if (businessId && businessId !== '' && businessId !== 'undefined' && businessId !== 'null') {
                const bizBatches = await prisma.batch.findMany({ where: { businessId: parseInt(businessId) }, select: { id: true } });
                baseLeadFilter.OR = [
                    { batchId: { in: bizBatches.map(b => b.id) } },
                    { phone: { endsWith: `_BIZ_${businessId}` } },
                    { phone: { contains: `_BIZ_${businessId}_` } }
                ];
            } else if (assignedBusinessIds.length > 0) {
                const bizBatches = await prisma.batch.findMany({ where: { businessId: { in: assignedBusinessIds } }, select: { id: true } });
                baseLeadFilter.OR = [
                    { batchId: { in: bizBatches.map(b => b.id) } },
                    ...assignedBusinessIds.flatMap(id => [
                        { phone: { endsWith: `_BIZ_${id}` } },
                        { phone: { contains: `_BIZ_${id}_` } }
                    ])
                ];
            } else {
                baseLeadFilter.batch = { businessId: -1 };
            }
        } else {
            baseLeadFilter.assignedTo = userId;
        }

        // ==========================================
        // 1. OVERALL METRICS
        // ==========================================
        const totalAssigned = await prisma.lead.count({ where: { ...baseLeadFilter, ...( (isAdmin || isManager) ? { assignedTo: { not: null } } : {} ) } });
        const totalEnrolled = await prisma.lead.count({ where: { ...baseLeadFilter, enrollmentStatus: 'ENROLLED' } });
        const totalPending = await prisma.lead.count({ where: { ...baseLeadFilter, callStatus: 'pending' } });
        const totalCovered = await prisma.lead.count({ where: { ...baseLeadFilter, callStatus: { not: 'pending' } } });
        const callAnswerCount = await prisma.lead.count({ where: { ...baseLeadFilter, callStatus: 'answer' } });

        const conversionRate = totalAssigned > 0 ? ((totalEnrolled / totalAssigned) * 100).toFixed(1) : 0;
        const responseRate = totalCovered > 0 ? ((callAnswerCount / totalCovered) * 100).toFixed(1) : 0;

        // ==========================================
        // 2. TODAY METRICS (Messages & Coverages)
        // ==========================================
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Calculate Messages Sent/Received TODAY for assigned leads
        const todayChats = await prisma.chatMessage.findMany({
            where: {
                createdAt: { gte: today },
                lead: { ...baseLeadFilter }
            },
            select: { direction: true, lead: { select: { phone: true } } }
        });

        let msgsSent = 0;
        let msgsReceived = 0;
        const uniqueNumbers = new Set();

        todayChats.forEach(chat => {
            if (chat.direction === 'outbound') msgsSent++;
            if (chat.direction === 'inbound') msgsReceived++;
            if (chat.lead?.phone) uniqueNumbers.add(chat.lead.phone);
        });

        // Leads covered today
        const coveredToday = await prisma.lead.groupBy({
            by: ['inquiryType'],
            where: {
                ...baseLeadFilter,
                updatedAt: { gte: today },
                callStatus: { not: 'pending' }
            },
            _count: true
        });

        const todayCovers = {
            newInq: coveredToday.find(c => c.inquiryType === 'NEW_INQ')?._count || 0,
            openSem: coveredToday.find(c => c.inquiryType === 'OPEN_SEMINAR')?._count || 0,
            paid: coveredToday.find(c => c.inquiryType === 'PAID_CAMP')?._count || 0
        };

        // ==========================================
        // 3. TODAY TASKS (Task Center)
        // ==========================================
        const tasks = await prisma.task.findMany({
            where: {
                assignedTo: userId,
                // Assuming existing task logic checks dueDate or target date.
                // Will fetch non-completed tasks or tasks updated today
                status: { not: 'COMPLETED' }
            },
            take: 10,
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({
            overall: {
                assigned: totalAssigned,
                enrolled: totalEnrolled,
                pending: totalPending,
                covered: totalCovered,
                callAnswers: callAnswerCount,
                conversionRate: parseFloat(conversionRate),
                responseRate: parseFloat(responseRate)
            },
            today: {
                msgsSent,
                msgsReceived,
                uniqueNumbers: uniqueNumbers.size,
                covers: todayCovers
            },
            tasks
        });
    } catch (error) {
        console.error("Error fetching V2 Stats:", error);
        res.status(500).json({ error: "Failed to load dashboard metrics." });
    }
};

exports.getCoordinatorDailyLogs = async (req, res) => {
    try {
        const userId = parseInt(req.user?.userId || req.user?.id || req.query.loggedUserId);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        const logs = await prisma.coordinatorDailyLog.findMany({
            where: {
                coordinatorId: userId,
                date: { gte: startOfMonth }
            }
        });

        const todayLog = logs.find(l => new Date(l.date).getTime() === today.getTime());
        
        const monthlyTotal = logs.reduce((acc, curr) => {
            acc.newInqCalls += curr.newInqCalls;
            acc.generalInqCalls += curr.generalInqCalls;
            return acc;
        }, { newInqCalls: 0, generalInqCalls: 0 });

        res.status(200).json({
            today: todayLog || { newInqCalls: 0, generalInqCalls: 0 },
            monthlyTotal
        });

    } catch (error) {
        console.error("Error fetching daily logs:", error);
        res.status(500).json({ error: "Failed to fetch logs" });
    }
};

exports.saveCoordinatorDailyLog = async (req, res) => {
    try {
        const userId = parseInt(req.user?.userId || req.user?.id);
        const { newInqCalls, generalInqCalls } = req.body;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upsertedLog = await prisma.coordinatorDailyLog.upsert({
            where: {
                coordinatorId_date: {
                    coordinatorId: userId,
                    date: today
                }
            },
            update: {
                newInqCalls: parseInt(newInqCalls) || 0,
                generalInqCalls: parseInt(generalInqCalls) || 0
            },
            create: {
                coordinatorId: userId,
                date: today,
                newInqCalls: parseInt(newInqCalls) || 0,
                generalInqCalls: parseInt(generalInqCalls) || 0
            }
        });

        res.status(200).json(upsertedLog);
    } catch (error) {
        console.error("Error saving daily log:", error);
        res.status(500).json({ error: "Failed to save logs" });
    }
};
