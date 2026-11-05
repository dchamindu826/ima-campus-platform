const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');

// Helper to filter leads by business safely
const buildLeadFilter = (bizId, batId) => {
    let whereClause = {};
    if (batId) {
        whereClause.batchId = batId;
    } else if (bizId) {
        whereClause.OR = [
            { phone: { endsWith: `_BIZ_${bizId}` } },
            { phone: { endsWith: `_BIZ_${bizId}_AS` } },
            { phone: { contains: `_BIZ_${bizId}_BATCH_` } },
            { phone: { contains: `_BIZ_${bizId}_ROUND_` } },
            { phone: { contains: `_BIZ_${bizId}_HISTORY_ROUND_` } }
        ];
    }
    return whereClause;
};

exports.getManagerDashboardOverview = async (req, res) => {
    try {
        const { businessId, batchId } = req.query;

        // Date calculations
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        const daysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDayName = daysMap[startOfDay.getDay()];

        const bizId = businessId && businessId !== 'ALL' ? parseInt(businessId) : null;
        const batId = batchId && batchId !== 'ALL' && batchId !== 'UNASSIGNED' ? parseInt(batchId) : null;

        // 1. Basic Filters
        let batchQuery = {};
        if (batId) batchQuery.id = batId;
        else if (bizId) batchQuery.businessId = bizId;

        let businessQuery = {};
        if (bizId) businessQuery.id = bizId;

        let deliveryQuery = {};
        if (bizId) deliveryQuery.businessId = bizId;

        // 2. Active Students & Verified Revenue (From Payments)
        let activeStudentsCount = 0;
        let totalRevenue = 0;
        let mixerData = [];

        let paymentWhere = { status: { in: [1, 4] } };
        if (batId) paymentWhere.batchId = batId;
        else if (bizId) paymentWhere.businessId = bizId;

        const payments = await prisma.payment.findMany({
            where: paymentWhere,
            select: { amount: true, studentId: true, payment_type: true, subjects: true }
        });

        // Calculate Revenue & Unique Active Students
        const uniqueStudentIds = new Set();
        payments.forEach(p => {
            totalRevenue += (p.amount || 0);
            if (p.studentId) uniqueStudentIds.add(p.studentId);
        });
        activeStudentsCount = uniqueStudentIds.size;

        // Subject breakdown
        const allCourses = await prisma.course.findMany({ select: { id: true, name: true } });
        const globalCourseMap = {};
        allCourses.forEach(c => globalCourseMap[c.id] = c.name.trim().toUpperCase());

        const subjectAggregates = {};
        allCourses.forEach(c => {
            const upName = c.name.trim().toUpperCase();
            subjectAggregates[upName] = { subject: c.name, full: 0, monthly: 0, installment: 0 };
        });

        const studentPaymentMap = {};
        payments.forEach(p => {
            if (!p.studentId) return;
            if (!studentPaymentMap[p.studentId]) studentPaymentMap[p.studentId] = { typeStr: 'MONTHLY', typeValue: 1, subjects: new Set() };
            
            const pType = parseInt(p.payment_type);
            if (pType === 3) { studentPaymentMap[p.studentId].typeStr = 'FULL'; studentPaymentMap[p.studentId].typeValue = 3; }
            else if (pType === 2 && studentPaymentMap[p.studentId].typeValue < 3) { studentPaymentMap[p.studentId].typeStr = 'INSTALLMENT'; studentPaymentMap[p.studentId].typeValue = 2; }

            if (p.subjects) {
                try {
                    const subs = typeof p.subjects === 'string' ? JSON.parse(p.subjects) : p.subjects;
                    subs.forEach(item => {
                        const sName = globalCourseMap[parseInt(item.id || item)];
                        if (sName) studentPaymentMap[p.studentId].subjects.add(sName);
                    });
                } catch(e) {}
            }
        });

        Object.values(studentPaymentMap).forEach(studentData => {
            studentData.subjects.forEach(sub => {
                if (subjectAggregates[sub]) {
                    if (studentData.typeStr === 'FULL') subjectAggregates[sub].full++;
                    else if (studentData.typeStr === 'MONTHLY') subjectAggregates[sub].monthly++;
                    else if (studentData.typeStr === 'INSTALLMENT') subjectAggregates[sub].installment++;
                }
            });
        });
        mixerData = Object.values(subjectAggregates).filter(s => s.full > 0 || s.monthly > 0 || s.installment > 0);

        // 3. Active Batches Count
        const activeBatchesCount = await prisma.batch.count({
            where: { ...businessQuery, status: 1 }
        });

        // 4. Leads & CRM Stats
        const leadFilter = buildLeadFilter(bizId, batId);
        const leads = await prisma.lead.findMany({
            where: leadFilter,
            select: { id: true, assignedTo: true, source: true, inquiryType: true }
        });

        let leadStats = { total: leads.length, assigned: 0, unassigned: 0, openSem: 0, newInq: 0, bridge: 0 };
        const leadIds = [];
        leads.forEach(l => {
            leadIds.push(l.id);
            if (l.assignedTo) leadStats.assigned++;
            else leadStats.unassigned++;

            if (l.source === 'bridge_transfer') leadStats.bridge++;
            else if (l.inquiryType === 'NEW_INQ') leadStats.newInq++;
            else leadStats.openSem++;
        });

        // CRM WhatsApp Messages Today
        let crmMessages = { received: 0, replied: 0 };
        if (leadIds.length > 0) {
            const todayMessages = await prisma.chatMessage.findMany({
                where: {
                    leadId: { in: leadIds },
                    createdAt: { gte: startOfDay, lte: endOfDay }
                },
                select: { direction: true }
            });
            crmMessages.received = todayMessages.filter(m => m.direction === 'inbound').length;
            crmMessages.replied = todayMessages.filter(m => m.direction === 'outbound').length;
        }

        // Today's Lead Coverage (Coordinator-Wise)
        let coordinatorStats = [];
        if (leadIds.length > 0) {
            const todayProgresses = await prisma.leadRoundProgress.findMany({
                where: {
                    leadId: { in: leadIds },
                    updatedAt: { gte: startOfDay, lte: endOfDay }
                },
                include: { lead: { include: { assignedUser: true } } }
            });

            const coordinatorMap = {};
            todayProgresses.forEach(prog => {
                if (prog.lead && prog.lead.assignedUser) {
                    const name = `${prog.lead.assignedUser.firstName} ${prog.lead.assignedUser.lastName}`;
                    if (!coordinatorMap[name]) coordinatorMap[name] = new Set();
                    coordinatorMap[name].add(prog.leadId);
                }
            });
            coordinatorStats = Object.keys(coordinatorMap).map(name => ({
                name,
                leadsCovered: coordinatorMap[name].size
            }));
        }

        // 5. Today's Classes (Timetable)
        let timetableQuery = { date: { gte: startOfDay, lte: endOfDay } };
        if (batId) timetableQuery.batchId = batId;
        else if (bizId) {
            const bizBatches = await prisma.batch.findMany({ where: { businessId: bizId }, select: { id: true } });
            timetableQuery.batchId = { in: bizBatches.map(b => b.id) };
        }

        const todayClasses = await prisma.timetable.findMany({
            where: timetableQuery,
            include: { hall: true, batch: true },
            orderBy: { startTime: 'asc' }
        });

        // 6. Delivery Quick Stats
        const deliveries = await prisma.delivery.findMany({
            where: deliveryQuery,
            select: { status: true }
        });
        
        let deliveryStats = { pending: 0, dispatched: 0, delivered: 0, hold: 0 };
        deliveries.forEach(d => {
            if (d.status === 'Pending') deliveryStats.pending++;
            else if (d.status === 'Hold') deliveryStats.hold++;
            else if (d.status === 'Received' || d.status === 'Delivered') deliveryStats.delivered++;
            else deliveryStats.dispatched++; // Packed, On the way
        });

        // 7. System Tasks (Pending tasks for staff in this business)
        // Find staff assigned to this business
        let staffFilter = { role: { notIn: ['Student', 'USER', 'STUDENT'] } };
        // We will just fetch all pending tasks for now since branch separation for tasks is complex
        const pendingTasks = await prisma.task.count({
            where: { status: 'PENDING' }
        });

        res.status(200).json({
            activeStudentsCount,
            totalRevenue,
            activeBatchesCount,
            crmMessages,
            coordinatorStats,
            todayClasses,
            leadStats,
            mixerData,
            deliveryStats,
            pendingTasks
        });

    } catch (error) {
        console.error("Manager Overview Stats Error:", error);
        res.status(500).json({ error: "Failed to fetch manager overview stats" });
    }
};
