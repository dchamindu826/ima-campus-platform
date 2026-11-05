const { PrismaClient } = require('@prisma/client');
const prisma = require('../../src/core/db');

exports.getStaffOverview = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.id;
        
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, firstName: true, lastName: true, role: true, businessType: true, agentStatus: true }
        });

        if (!user) return res.status(404).json({ error: "User not found" });

        const userRole = String(user.role).toUpperCase().replace(/ /g, '_');
        const isAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER'].includes(userRole);
        const isManager = ['MANAGER', 'ASS_MANAGER'].includes(userRole);

        // 1. Get Assigned Businesses
        let assignedBusinesses = [];
        if (isAdmin) {
            assignedBusinesses = await prisma.business.findMany({
                select: { id: true, name: true, logo: true }
            });
        } else {
            const allBiz = await prisma.business.findMany({
                select: { id: true, name: true, logo: true, head_manager_id: true, ass_manager_id: true }
            });
            
            const userBizList = user.businessType ? String(user.businessType).split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
            const isAll = userBizList.length === 0 || userBizList.includes('all');
            assignedBusinesses = allBiz.filter(biz => {
                if (isAll) return true;
                const isManagerOf = (biz.head_manager_id && String(biz.head_manager_id) === String(userId)) ||
                                    (biz.ass_manager_id && String(biz.ass_manager_id) === String(userId));
                const matchesBizType = userBizList.some(b => 
                    b === String(biz.id) ||
                    b === biz.name.toLowerCase().trim() ||
                    biz.name.toLowerCase().trim().includes(b) ||
                    b.includes(biz.name.toLowerCase().trim())
                );
                return isManagerOf || matchesBizType;
            }).map(b => ({ id: b.id, name: b.name, logo: b.logo, category: b.category, medium: b.medium }));
        }

        const businessIds = assignedBusinesses.map(b => b.id);

        // 2. Get Batches for these businesses
        const batches = await prisma.batch.findMany({
            where: { 
                businessId: { in: businessIds },
                is_active: true
            },
            select: { id: true, name: true, businessId: true }
        });
        
        const batchIds = batches.map(b => b.id);

        // 3. Get Active Enrolled Students Count for these batches
        const activeStudentsCount = await prisma.lead.count({
            where: {
                batchId: { in: batchIds },
                enrollmentStatus: 'ENROLLED'
            }
        });

        // 4. Get Upcoming Timetables for these batches (Next 7 days)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);

        const timetables = await prisma.timetable.findMany({
            where: {
                batch_id: { in: batchIds },
                date: {
                    gte: today,
                    lte: nextWeek
                }
            },
            orderBy: {
                date: 'asc'
            },
            take: 10,
            include: {
                batch: { select: { name: true } },
                subject: { select: { subject_name: true } }
            }
        });

        const formattedTimetables = timetables.map(t => ({
            id: t.id,
            title: t.title || t.subject?.subject_name || 'Class',
            date: t.date,
            startTime: t.start_time,
            endTime: t.end_time,
            batchName: t.batch?.name,
            type: t.type
        }));

        res.status(200).json({
            agentStatus: user.agentStatus || 'OFFLINE',
            businesses: assignedBusinesses,
            batches: batches,
            activeStudentsCount: activeStudentsCount,
            timetables: formattedTimetables
        });

    } catch (error) {
        console.error("Error in getStaffOverview:", error);
        res.status(500).json({ error: "Failed to load overview data" });
    }
};

exports.updateFcmToken = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.id;
        const { fcmToken } = req.body;
        if (!fcmToken) return res.status(400).json({ error: "fcmToken is required" });

        await prisma.user.update({
            where: { id: parseInt(userId, 10) },
            data: { fcmToken }
        });

        res.status(200).json({ success: true, message: "FCM token updated successfully" });
    } catch (error) {
        console.error("Error in updateFcmToken:", error);
        res.status(500).json({ error: "Failed to update FCM token" });
    }
};

exports.updateAgentStatus = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.id;
        const { status } = req.body;
        const validStatuses = ['ACTIVE', 'LUNCH', 'AWAY', 'OFFLINE'];
        const cleanStatus = String(status || '').toUpperCase().trim();
        if (!validStatuses.includes(cleanStatus)) {
            return res.status(400).json({ error: "Invalid status" });
        }

        const user = await prisma.user.update({
            where: { id: parseInt(userId, 10) },
            data: { agentStatus: cleanStatus },
            select: { id: true, agentStatus: true, firstName: true }
        });

        res.status(200).json({ success: true, agentStatus: user.agentStatus });
    } catch (error) {
        console.error("Error in updateAgentStatus:", error);
        res.status(500).json({ error: "Failed to update agent status" });
    }
};
