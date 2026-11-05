const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');

// 1. Get Monthly Roster for a specific Staff Member
exports.getMonthlyRoster = async (req, res) => {
    try {
        const staffId = req.query.staffId ? parseInt(req.query.staffId) : req.user.id;
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const month = parseInt(req.query.month) || new Date().getMonth(); // 0-11

        // මාසේ මුල සහ අග හොයාගන්නවා
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0, 23, 59, 59);

        // A. Manual Roster Data (Status & Manual Calls)
        const manualRosterData = await prisma.staffRoster.findMany({
            where: {
                staffId: staffId,
                date: { gte: startDate, lte: endDate }
            }
        });
        const rosterMap = {};
        manualRosterData.forEach(r => rosterMap[r.date.toISOString().split('T')[0]] = r);

        // B. Assigned Leads Analytics (From Leads Table)
        const assignedLeads = await prisma.lead.findMany({
            where: {
                assignedTo: staffId,
                createdAt: { gte: startDate, lte: endDate } // Assign වුණු දවස අනුව
            },
            select: { inquiryType: true, enrollmentStatus: true, createdAt: true }
        });

        // C. Chat Messages Analytics (From CRM)
        const outboundMessages = await prisma.chatMessage.findMany({
            where: {
                senderId: staffId,
                direction: 'outbound',
                createdAt: { gte: startDate, lte: endDate }
            },
            select: { createdAt: true }
        });

        // D. Call Analytics 
        // (Note: To get accurate daily calls, you should ideally track them in a CallLog table. 
        // For now, we count updated leads for the day)
        const callUpdates = await prisma.lead.findMany({
            where: {
                assignedTo: staffId,
                updatedAt: { gte: startDate, lte: endDate },
                callStatus: { not: 'pending' }
            },
            select: { callStatus: true, updatedAt: true }
        });

        // දවස් 31 ටම Data Map කරනවා
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        let finalRosterArray = [];

        for (let i = 1; i <= daysInMonth; i++) {
            const dateObj = new Date(year, month, i);
            const dateStr = dateObj.toISOString().split('T')[0];
            const isWeekend = dateObj.getDay() === 0; // Sunday

            const dayManualData = rosterMap[dateStr] || { status: isWeekend ? 'Day Off' : 'Normal', manualCalls: 0 };

            // Calculate Assigned Stats for this day
            const dayLeads = assignedLeads.filter(l => l.createdAt.toISOString().split('T')[0] === dateStr);
            
            // Calculate Messages Stats for this day
            const dayMessages = outboundMessages.filter(m => m.createdAt.toISOString().split('T')[0] === dateStr);

            // Calculate Calls Stats for this day
            const dayCalls = callUpdates.filter(c => c.updatedAt.toISOString().split('T')[0] === dateStr);

            finalRosterArray.push({
                date: dateStr,
                dayName: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
                status: dayManualData.status,
                otherCalls: dayManualData.manualCalls,
                
                assigned: {
                    openSem: dayLeads.filter(l => l.inquiryType === 'OPEN_SEMINAR').length,
                    newInq: dayLeads.filter(l => l.inquiryType === 'NEW_INQ').length,
                    bridge: dayLeads.filter(l => l.inquiryType === 'BRIDGE').length, // Adjust according to your DB
                    paid: dayLeads.filter(l => l.enrollmentStatus === 'ENROLLED').length
                },
                systemDials: {
                    answered: dayCalls.filter(c => c.callStatus === 'answered').length,
                    rejected: dayCalls.filter(c => c.callStatus === 'reject').length,
                    noAnswer: dayCalls.filter(c => c.callStatus === 'no_answer').length
                },
                crmMessages: {
                    sent: dayMessages.length // අලුතින් CRM Messages ගාණත් යනවා
                },
                tasksCount: 0 // Fetch from Task table if needed
            });
        }

        res.status(200).json(finalRosterArray);
    } catch (error) {
        console.error("Get Roster Error:", error);
        res.status(500).json({ error: "Failed to fetch roster data" });
    }
};

// 2. Update Daily Manual Roster (Status & Manual Calls)
exports.updateDailyRoster = async (req, res) => {
    try {
        const { date, status, manualCalls } = req.body;
        const staffId = req.user.id; // Logged in coordinator's ID

        const dateObj = new Date(date);

        const updated = await prisma.staffRoster.upsert({
            where: {
                staffId_date: { staffId: staffId, date: dateObj }
            },
            update: {
                status: status,
                manualCalls: parseInt(manualCalls) || 0
            },
            create: {
                staffId: staffId,
                date: dateObj,
                status: status,
                manualCalls: parseInt(manualCalls) || 0
            }
        });

        res.status(200).json({ message: "Roster updated successfully", data: updated });
    } catch (error) {
        console.error("Update Roster Error:", error);
        res.status(500).json({ error: "Failed to update roster" });
    }
};