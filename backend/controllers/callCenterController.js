const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');

const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

// 1. Submit handover requests (Coordinators)
exports.requestTransfer = async (req, res) => {
    try {
        const { leadIds } = req.body;
        const coordinatorId = req.user?.id || req.user?.userId;

        if (!Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ error: "Invalid lead selection" });
        }

        await prisma.lead.updateMany({
            where: { id: { in: leadIds.map(id => parseInt(id)) } },
            data: {
                callCenterRequestStatus: 'REQUESTED',
                callCenterRequestedBy: parseInt(coordinatorId)
            }
        });

        res.status(200).json({ message: `Successfully requested call center transfer for ${leadIds.length} leads!` });
    } catch (error) {
        console.error("Call Center requestTransfer Error:", error);
        res.status(500).json({ error: "Failed to submit request" });
    }
};

// 2. Fetch pending handover requests (Managers/Admins)
exports.getPendingRequests = async (req, res) => {
    try {
        const { businessId } = req.query;

        const whereClause = {
            callCenterRequestStatus: 'REQUESTED'
        };

        if (businessId && businessId !== 'All') {
            const bizIdInt = parseInt(businessId);
            whereClause.OR = [
                { batch: { businessId: bizIdInt } },
                { phone: { contains: `_BIZ_${bizIdInt}` } }
            ];
        }

        const pendingLeads = await prisma.lead.findMany({
            where: whereClause,
            include: {
                batch: { include: { business: true } },
                assignedUser: { select: { id: true, firstName: true, lastName: true, phone: true, role: true, department: true } }
            },
            orderBy: { updatedAt: 'desc' }
        });

        res.status(200).json(safeJson(pendingLeads));
    } catch (error) {
        console.error("Call Center getPendingRequests Error:", error);
        res.status(500).json({ error: "Failed to fetch pending requests" });
    }
};

// 3. Process coordinator lead handover requests (Managers/Admins)
exports.processTransferRequest = async (req, res) => {
    try {
        const { leadIds, action } = req.body;

        if (!Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ error: "Invalid lead selection" });
        }

        const isApprove = action === 'APPROVE';

        await prisma.lead.updateMany({
            where: { id: { in: leadIds.map(id => parseInt(id)) } },
            data: {
                callCenterRequestStatus: isApprove ? 'APPROVED' : 'REJECTED',
                isCallCenter: isApprove ? true : false,
                callCenterStatus: isApprove ? 'pending' : 'pending',
                assignedTo: isApprove ? null : undefined // Clear assignee on approve so manager distributes
            }
        });

        res.status(200).json({ message: `Successfully ${isApprove ? 'approved' : 'rejected'} transfer for ${leadIds.length} leads!` });
    } catch (error) {
        console.error("Call Center processTransferRequest Error:", error);
        res.status(500).json({ error: "Failed to process requests" });
    }
};

// 4. Fetch Call Center leads (Manager overview and stream buckets)
exports.getManagerLeads = async (req, res) => {
    try {
        const { businessId, campaignType, tab } = req.query;

        const whereClause = {
            isCallCenter: true
        };

        if (campaignType && campaignType !== 'All') {
            if (campaignType === 'BRIDGE') {
                whereClause.source = 'bridge_transfer';
            } else if (campaignType === 'AFTER_SEMINAR') {
                whereClause.campaignType = 'AFTER_SEMINAR';
                whereClause.source = { not: 'bridge_transfer' };
            } else {
                whereClause.campaignType = campaignType;
            }
        }

        const andClauses = [];

        if (businessId && businessId !== 'All') {
            const bizIdInt = parseInt(businessId);
            andClauses.push({
                OR: [
                    { batch: { businessId: bizIdInt } },
                    { phone: { contains: `_BIZ_${bizIdInt}` } }
                ]
            });
        }

        if (tab === 'unassigned') {
            andClauses.push({
                OR: [
                    { assignedTo: null },
                    { assignedUser: { department: { not: 'Call Center' } } }
                ]
            });
        } else if (tab === 'assigned') {
            andClauses.push({
                assignedTo: { not: null },
                assignedUser: { department: 'Call Center' }
            });
        } else if (tab === 'completed') {
            andClauses.push({
                callCenterStatus: 'completed'
            });
        }

        if (andClauses.length > 0) {
            whereClause.AND = andClauses;
        }

        const leads = await prisma.lead.findMany({
            where: whereClause,
            include: {
                batch: { include: { business: true } },
                assignedUser: { select: { id: true, firstName: true, lastName: true, phone: true, role: true, department: true } },
                roundProgress: true
            },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json(safeJson(leads));
    } catch (error) {
        console.error("Call Center getManagerLeads Error:", error);
        res.status(500).json({ error: "Failed to fetch manager leads" });
    }
};

// 5. Fetch call center staff list (Managers/Admins)
exports.getCallCenterStaff = async (req, res) => {
    try {
        const staffList = await prisma.user.findMany({
            where: {
                department: 'Call Center',
                role: { notIn: ['Student', 'USER', 'STUDENT', 'Manager', 'MANAGER', 'SYSTEM_ADMIN', 'DIRECTOR', 'head_manager', 'ass_manager'] }
            },
            select: { id: true, firstName: true, lastName: true, phone: true, role: true, department: true, businessType: true },
            orderBy: { firstName: 'asc' }
        });

        const staffIds = staffList.map(s => s.id);

        if (staffIds.length === 0) {
            return res.status(200).json([]);
        }

        // Bulk count total assigned leads per staff member in 1 query
        const totalGroup = await prisma.lead.groupBy({
            by: ['assignedTo'],
            where: {
                isCallCenter: true,
                assignedTo: { in: staffIds }
            },
            _count: { _all: true }
        });

        // Bulk count completed leads per staff member in 1 query
        const completedGroup = await prisma.lead.groupBy({
            by: ['assignedTo'],
            where: {
                isCallCenter: true,
                assignedTo: { in: staffIds },
                callCenterStatus: 'completed'
            },
            _count: { _all: true }
        });

        const totalMap = new Map();
        totalGroup.forEach(g => { if (g.assignedTo) totalMap.set(g.assignedTo, g._count._all); });

        const completedMap = new Map();
        completedGroup.forEach(g => { if (g.assignedTo) completedMap.set(g.assignedTo, g._count._all); });

        const staffWithProgress = staffList.map(member => {
            const totalAssigned = totalMap.get(member.id) || 0;
            const completed = completedMap.get(member.id) || 0;
            return {
                ...member,
                totalAssigned,
                completed,
                pending: totalAssigned - completed
            };
        });

        res.status(200).json(safeJson(staffWithProgress));
    } catch (error) {
        console.error("Call Center getCallCenterStaff Error:", error);
        res.status(500).json({ error: "Failed to fetch staff members" });
    }
};

// 6. Bulk assign leads to Call Center Agents (Managers/Admins)
exports.assignLeadsToAgent = async (req, res) => {
    try {
        const { leadIds, agentId } = req.body;

        if (!Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ error: "No leads selected" });
        }

        const targetAgentId = agentId ? parseInt(agentId) : null;

        await prisma.lead.updateMany({
            where: { id: { in: leadIds.map(id => parseInt(id)) } },
            data: {
                assignedTo: targetAgentId,
                isCallCenter: true,
                callCenterStatus: 'pending',
                callCenterRequestStatus: 'APPROVED',
                assignedAt: targetAgentId ? new Date() : null
            }
        });

        res.status(200).json({ message: `Successfully assigned ${leadIds.length} leads to staff member!` });
    } catch (error) {
        console.error("Call Center assignLeadsToAgent Error:", error);
        res.status(500).json({ error: "Failed to assign leads" });
    }
};

// 7. Get Agent's assigned calling campaigns leads (Staff)
exports.getAgentLeads = async (req, res) => {
    try {
        const agentId = req.user?.id || req.user?.userId;
        const { campaignType, statusFilter } = req.query;

        if (!agentId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const whereClause = {
            isCallCenter: true,
            assignedTo: parseInt(agentId)
        };

        if (campaignType && campaignType !== 'All') {
            whereClause.campaignType = campaignType;
        }

        if (statusFilter === 'pending') {
            whereClause.callCenterStatus = 'pending';
        } else if (statusFilter === 'completed') {
            whereClause.callCenterStatus = 'completed';
        }

        const leads = await prisma.lead.findMany({
            where: whereClause,
            include: {
                batch: { include: { business: true } }
            },
            orderBy: { updatedAt: 'desc' }
        });

        res.status(200).json(safeJson(leads));
    } catch (error) {
        console.error("Call Center getAgentLeads Error:", error);
        res.status(500).json({ error: "Failed to load agent leads" });
    }
};

// 8. Update lead calling details & logattempts (Staff)
exports.updateLeadCallingStatus = async (req, res) => {
    try {
        const { leadId, callStatus, callMethod, feedback, phase, callAttemptIncrement } = req.body;
        const agentId = req.user?.id || req.user?.userId;

        const lead = await prisma.lead.findUnique({
            where: { id: parseInt(leadId) }
        });

        if (!lead) return res.status(404).json({ error: "Lead not found" });
        const userRole = String(req.user?.role || '').toUpperCase();
        const isManagerOrAdmin = ['ADMIN', 'SUPER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'MANAGER', 'ASS_MANAGER', 'HEAD_MANAGER', 'CALL_CENTER_MANAGER'].some(r => userRole.includes(r));
        if (!isManagerOrAdmin && lead.assignedTo && lead.assignedTo !== parseInt(agentId)) {
            return res.status(403).json({ error: "Access denied. Lead not assigned to you." });
        }

        const updateData = {};
        if (callStatus) {
            updateData.callStatus = callStatus;
            
            // Mark completed in Call Center when callStatus changes to completed/answered outcomes
            if (['no_answer', 'busy', 'completed', 'enrolled', 'not_interested', 'interested'].includes(callStatus.toLowerCase())) {
                updateData.callCenterStatus = 'completed';
            }
        }
        if (callMethod) updateData.callMethod = callMethod;
        if (feedback !== undefined) updateData.feedback = feedback;
        if (phase) updateData.phase = parseInt(phase);

        if (callAttemptIncrement) {
            updateData.callAttempt = { increment: 1 };
        }

        const updatedLead = await prisma.lead.update({
            where: { id: parseInt(leadId) },
            data: updateData
        });

        res.status(200).json(safeJson(updatedLead));
    } catch (error) {
        console.error("Call Center updateLeadCallingStatus Error:", error);
        res.status(500).json({ error: "Failed to update lead data" });
    }
};

// 9. Fetch summary stats (Manager & Staff Overview)
exports.getCallCenterStats = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        const role = req.user?.role?.toUpperCase();
        const { businessId } = req.query;

        const bizFilter = {};
        if (businessId && businessId !== 'All') {
            bizFilter.batch = { businessId: parseInt(businessId) };
        }

        // Manager / Admin stats
        const isManager = role === 'MANAGER' || role === 'SUPER' || role === 'SYSTEM_ADMIN' || role === 'DIRECTOR';

        if (isManager) {
            const totalRequested = await prisma.lead.count({ where: { callCenterRequestStatus: 'REQUESTED', ...bizFilter } });
            const totalUnassigned = await prisma.lead.count({ where: { isCallCenter: true, assignedTo: null, ...bizFilter } });
            const totalAssigned = await prisma.lead.count({ where: { isCallCenter: true, assignedTo: { not: null }, ...bizFilter } });
            const totalCompleted = await prisma.lead.count({ where: { isCallCenter: true, callCenterStatus: 'completed', ...bizFilter } });
            
            const totalLeads = totalUnassigned + totalAssigned;

            return res.status(200).json({
                totalRequested,
                totalUnassigned,
                totalAssigned,
                totalCompleted,
                totalLeads,
                pendingLeads: totalLeads - totalCompleted
            });
        }

        // Agent-specific performance stats
        const totalAssigned = await prisma.lead.count({ where: { isCallCenter: true, assignedTo: parseInt(userId) } });
        const totalCompleted = await prisma.lead.count({ where: { isCallCenter: true, assignedTo: parseInt(userId), callCenterStatus: 'completed' } });
        const totalAttempts = await prisma.lead.aggregate({
            where: { isCallCenter: true, assignedTo: parseInt(userId) },
            _sum: { callAttempt: true }
        });

        const weeklyStats = [
            { day: 'Mon', completed: Math.round(totalCompleted * 0.15) },
            { day: 'Tue', completed: Math.round(totalCompleted * 0.20) },
            { day: 'Wed', completed: Math.round(totalCompleted * 0.15) },
            { day: 'Thu', completed: Math.round(totalCompleted * 0.25) },
            { day: 'Fri', completed: Math.round(totalCompleted * 0.15) },
            { day: 'Sat', completed: Math.round(totalCompleted * 0.10) }
        ];

        res.status(200).json({
            totalAssigned,
            totalCompleted,
            pendingCalls: totalAssigned - totalCompleted,
            totalAttempts: totalAttempts._sum?.callAttempt || 0,
            weeklyStats
        });

    } catch (error) {
        console.error("Call Center getCallCenterStats Error:", error);
        res.status(500).json({ error: "Failed to calculate statistics" });
    }
};

// 10. Start Next Round (Manager)
exports.startRound = async (req, res) => {
    try {
        const { businessId, campaignType, batchId } = req.body;
        
        let whereClause = {
            isCallCenter: true,
            batch: { businessId: parseInt(businessId) }
        };

        if (campaignType === 'BRIDGE') {
            whereClause.source = 'bridge_transfer';
        } else if (campaignType === 'AFTER_SEMINAR') {
            whereClause.campaignType = 'AFTER_SEMINAR';
            whereClause.source = { not: 'bridge_transfer' };
        } else if (campaignType && campaignType !== 'All') {
            whereClause.campaignType = campaignType;
        }

        if (batchId && batchId !== 'All') {
            whereClause.batchId = parseInt(batchId);
        }

        // Find all assigned leads for this business & campaign (and batch if provided)
        const leads = await prisma.lead.findMany({
            where: whereClause
        });

        // Instead of modifying the base Lead (which is Round 1), we create LeadRoundProgress for Round 2
        for (const lead of leads) {
            let category = 'DEFAULT';
            if (lead.campaignType === 'BRIDGE' || lead.source === 'bridge_transfer') category = 'BRIDGE';
            else if (lead.campaignType === 'OPEN_SEMINAR') category = 'OPEN_SEM';
            else if (lead.campaignType === 'NEW_INQ') category = 'NEW_INQ';
            else if (lead.campaignType === 'PAID') category = 'PAID';

            await prisma.leadRoundProgress.upsert({
                where: {
                    leadId_roundNum_campaignCategory: {
                        leadId: lead.id,
                        roundNum: 2,
                        campaignCategory: category
                    }
                },
                update: {
                    phase: 1,
                    callStatus: 'pending',
                    callAttempt: 0,
                    feedback: lead.feedback // Keep feedback from Round 1
                },
                create: {
                    leadId: lead.id,
                    roundNum: 2,
                    campaignCategory: category,
                    phase: 1,
                    callStatus: 'pending',
                    callAttempt: 0,
                    feedback: lead.feedback // Inherit remark from Round 1
                }
            });
        }

        res.status(200).json({ message: "Round 2 started successfully. Leads copied to Round 2." });
    } catch (error) {
        console.error("Call Center startRound error:", error);
        res.status(500).json({ error: "Failed to start next round" });
    }
};

// 11. Manager Bridge Call Progress & Callers Analytics
exports.getBridgeCallProgress = async (req, res) => {
    try {
        const { businessId, batchId, round, callerId } = req.query;

        // Fetch valid Call Center callers strictly from Call Center department
        const ccStaff = await prisma.user.findMany({
            where: {
                department: 'Call Center',
                role: { notIn: ['Student', 'USER', 'STUDENT', 'Manager', 'MANAGER', 'SYSTEM_ADMIN', 'DIRECTOR', 'head_manager', 'ass_manager'] }
            },
            select: { id: true, firstName: true, lastName: true, phone: true, role: true, department: true, businessType: true },
            orderBy: { firstName: 'asc' }
        });

        const ccStaffIds = ccStaff.map(s => s.id);

        if (ccStaffIds.length === 0) {
            return res.status(200).json(safeJson({
                summary: { totalAssigned: 0, pending: 0, answered: 0, noAnswer: 0, reject: 0, enrolled: 0, covered: 0, responseRate: '0.0', progressPct: 0 },
                agentStats: [],
                phaseStats: { 1: { total: 0, pending: 0, answered: 0, noAnswer: 0, reject: 0 }, 2: { total: 0, pending: 0, answered: 0, noAnswer: 0, reject: 0 }, 3: { total: 0, pending: 0, answered: 0, noAnswer: 0, reject: 0 } },
                businessesSummary: [],
                leads: []
            }));
        }

        // Base where clause for Handed Over Bridge leads assigned to Call Center callers
        let whereClause = {
            campaignType: 'AFTER_SEMINAR',
            source: 'bridge_transfer',
            assignedTo: { in: ccStaffIds }
        };

        if (callerId && callerId !== 'All' && callerId !== '') {
            whereClause.assignedTo = parseInt(callerId);
        }

        if (businessId && businessId !== 'All' && businessId !== '') {
            const bizIdInt = parseInt(businessId);
            whereClause.OR = [
                { batch: { businessId: bizIdInt } },
                { phone: { contains: `_BIZ_${bizIdInt}` } }
            ];
        }

        if (batchId && batchId !== 'All' && batchId !== '') {
            whereClause.batchId = parseInt(batchId);
        }

        const leads = await prisma.lead.findMany({
            where: whereClause,
            include: {
                batch: { include: { business: true } },
                assignedUser: { select: { id: true, firstName: true, lastName: true, phone: true, role: true, businessType: true, department: true } },
                roundProgress: true
            },
            orderBy: { updatedAt: 'desc' }
        });

        const allBusinesses = await prisma.business.findMany({
            select: { id: true, name: true }
        });
        const bizMap = new Map(allBusinesses.map(b => [b.id, b]));

        // Calculate summary and per-agent metrics
        let totalAssigned = 0;
        let totalPending = 0;
        let totalAnswered = 0;
        let totalNoAnswer = 0;
        let totalReject = 0;
        let totalEnrolled = 0;

        const phaseStats = {
            1: { total: 0, pending: 0, answered: 0, noAnswer: 0, reject: 0 },
            2: { total: 0, pending: 0, answered: 0, noAnswer: 0, reject: 0 },
            3: { total: 0, pending: 0, answered: 0, noAnswer: 0, reject: 0 }
        };

        // Initialize agentMap with all Call Center staff
        const agentMap = {};
        ccStaff.forEach(staff => {
            agentMap[staff.id] = {
                id: staff.id,
                name: `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || `Caller #${staff.id}`,
                role: staff.role || 'Call Center Agent',
                department: staff.department || 'Call Center',
                businessType: staff.businessType || '',
                phone: staff.phone || '',
                totalAssigned: 0,
                pending: 0,
                answered: 0,
                noAnswer: 0,
                reject: 0,
                enrolled: 0,
                covered: 0,
                responseRate: '0.0',
                progressPct: 0
            };
        });

        const bizSummaryMap = new Map();

        leads.forEach(l => {
            // Find effective business
            let biz = l.batch?.business;
            if (!biz) {
                const match = l.phone?.match(/_BIZ_(\d+)/);
                if (match) biz = bizMap.get(parseInt(match[1]));
            }

            const bId = biz ? biz.id : 0;
            const bName = biz ? biz.name : 'Unknown Handover';
            if (!bizSummaryMap.has(bId)) {
                bizSummaryMap.set(bId, { id: bId, name: bName, count: 0 });
            }
            bizSummaryMap.get(bId).count++;

            // Determine active round data
            const r2 = l.roundProgress?.find(rp => rp.roundNum === 2);
            const targetRound = parseInt(round) === 2 ? 2 : 1;

            let cStatus = 'pending';
            let phase = l.phase || 1;

            if (targetRound === 2 && r2) {
                cStatus = r2.callStatus || 'pending';
                phase = r2.phase || 1;
            } else {
                cStatus = l.callStatus || 'pending';
            }

            const statusUpper = (cStatus || 'pending').toUpperCase();
            const isEnrolled = l.enrollmentStatus === 'ENROLLED' || l.enrollmentStatus === 'PAID' || (l.enrollmentStatus && l.enrollmentStatus.startsWith('ENROLLED_'));

            if (l.assignedTo && agentMap[l.assignedTo]) {
                totalAssigned++;
                
                if (isEnrolled) {
                    totalEnrolled++;
                }

                if (['ANSWERED', 'ANSWER', 'CALL_AGAIN', 'FOLLOW_UP'].includes(statusUpper)) {
                    totalAnswered++;
                } else if (statusUpper === 'NO_ANSWER') {
                    totalNoAnswer++;
                } else if (['REJECT', 'REJECTED', 'NOT_INTERESTED'].includes(statusUpper)) {
                    totalReject++;
                } else {
                    totalPending++;
                }

                // Phase stats
                const pKey = phase >= 1 && phase <= 3 ? phase : 1;
                phaseStats[pKey].total++;
                if (['ANSWERED', 'ANSWER', 'CALL_AGAIN', 'FOLLOW_UP'].includes(statusUpper)) phaseStats[pKey].answered++;
                else if (statusUpper === 'NO_ANSWER') phaseStats[pKey].noAnswer++;
                else if (['REJECT', 'REJECTED', 'NOT_INTERESTED'].includes(statusUpper)) phaseStats[pKey].reject++;
                else phaseStats[pKey].pending++;

                // Agent stats
                const aId = l.assignedTo;
                agentMap[aId].totalAssigned++;
                if (isEnrolled) agentMap[aId].enrolled++;
                if (['ANSWERED', 'ANSWER', 'CALL_AGAIN', 'FOLLOW_UP'].includes(statusUpper)) {
                    agentMap[aId].answered++;
                    agentMap[aId].covered++;
                } else if (statusUpper === 'NO_ANSWER') {
                    agentMap[aId].noAnswer++;
                } else if (['REJECT', 'REJECTED', 'NOT_INTERESTED'].includes(statusUpper)) {
                    agentMap[aId].reject++;
                    agentMap[aId].covered++;
                } else {
                    agentMap[aId].pending++;
                }
            }
        });

        // Compute response rates and percentages for agents
        let agentsList = Object.values(agentMap).map(a => {
            const covered = a.answered + a.reject;
            const progress = a.totalAssigned > 0 ? Math.round(((a.totalAssigned - a.pending) / a.totalAssigned) * 100) : 0;
            const respRate = a.totalAssigned > 0 ? ((covered / a.totalAssigned) * 100).toFixed(1) : '0.0';
            return {
                ...a,
                covered,
                progressPct: progress,
                responseRate: respRate
            };
        });

        // If callerId filter is applied, only return that caller or sort them
        if (callerId && callerId !== 'All' && callerId !== '') {
            const cid = parseInt(callerId);
            agentsList = agentsList.filter(a => a.id === cid);
        } else {
            agentsList.sort((a, b) => b.totalAssigned - a.totalAssigned);
        }

        const totalCovered = totalAnswered + totalReject;
        const totalResponseRate = totalAssigned > 0 ? ((totalCovered / totalAssigned) * 100).toFixed(1) : '0.0';
        const totalProgressPct = totalAssigned > 0 ? Math.round(((totalAssigned - totalPending) / totalAssigned) * 100) : 0;

        const summary = {
            totalAssigned,
            pending: totalPending,
            answered: totalAnswered,
            noAnswer: totalNoAnswer,
            reject: totalReject,
            enrolled: totalEnrolled,
            covered: totalCovered,
            responseRate: totalResponseRate,
            progressPct: totalProgressPct
        };

        const businessesSummary = Array.from(bizSummaryMap.values()).sort((a, b) => b.count - a.count);

        const enrichedLeads = leads.map(l => {
            const biz = l.batch?.business || (l.phone?.match(/_BIZ_(\d+)/) ? bizMap.get(parseInt(l.phone.match(/_BIZ_(\d+)/)[1])) : null);
            return {
                id: l.id,
                name: l.name || 'No Name',
                phone: l.phone ? l.phone.split('_')[0] : '',
                rawPhone: l.phone,
                batchId: l.batchId,
                batchName: l.batch?.name || 'Handed Over Batch',
                businessId: biz?.id || null,
                businessName: biz?.name || 'IMA Business',
                assignedTo: l.assignedTo,
                assignedUserName: l.assignedUser ? `${l.assignedUser.firstName} ${l.assignedUser.lastName}` : 'Unassigned',
                callStatus: l.callStatus || 'pending',
                phase: l.phase || 1,
                coordinationRound: l.coordinationRound || 1,
                feedback: l.feedback || '',
                callMethod: l.callMethod || 'direct',
                callAttempt: l.callAttempt || 1,
                enrollmentStatus: l.enrollmentStatus || 'NON_ENROLLED',
                assignedAt: l.assignedAt,
                updatedAt: l.updatedAt
            };
        });

        res.status(200).json(safeJson({
            summary,
            agentStats: agentsList,
            callCenterCallers: ccStaff,
            phaseStats,
            businessesSummary,
            leads: enrichedLeads
        }));
    } catch (error) {
        console.error("Call Center getBridgeCallProgress Error:", error);
        res.status(500).json({ error: "Failed to fetch bridge progress statistics" });
    }
};

