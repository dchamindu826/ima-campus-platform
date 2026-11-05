const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');

const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

exports.getOverview = async (req, res) => {
    try {
        const agentId = req.user?.id || req.user?.userId;
        if (!agentId) return res.status(401).json({ error: "Unauthorized" });

        // Get all assigned leads for this agent
        const leads = await prisma.lead.findMany({
            where: {
                isCallCenter: true,
                assignedTo: parseInt(agentId)
            },
            include: {
                batch: { include: { business: true } },
                roundProgress: true
            }
        });

        const allBusinesses = await prisma.business.findMany();
        const bizMap = new Map(allBusinesses.map(b => [b.id, b]));

        // Group by Campaign Type (AFTER_SEMINAR / FREE_SEMINAR) and Business
        const overview = {
            AFTER_SEMINAR: {},
            FREE_SEMINAR: {},
            BRIDGE: {}
        };

        leads.forEach(lead => {
            let biz = lead.batch?.business;
            if (!biz) {
                const match = lead.phone?.match(/_BIZ_(\d+)/);
                if (match) {
                    biz = bizMap.get(parseInt(match[1]));
                }
            }
            if (!biz) return;
            
            let cType = lead.campaignType;
            if (cType === 'AFTER_SEMINAR' && lead.source === 'bridge_transfer') {
                cType = 'BRIDGE';
            } else if (cType === 'AFTER_SEMINAR' && lead.source !== 'bridge_transfer') {
                cType = 'AFTER_SEMINAR';
            }

            if (!overview[cType]) return;

            if (!overview[cType][biz.id]) {
                overview[cType][biz.id] = {
                    business: biz,
                    totalAssigned: 0,
                    completed: 0,
                    pending: 0
                };
            }

            overview[cType][biz.id].totalAssigned++;
            
            // Check active round
            const r2 = lead.roundProgress?.find(r => r.roundNum === 2);
            let cStatus = '';
            
            if (r2) {
                cStatus = (r2.callStatus || '').toUpperCase();
            } else {
                cStatus = (lead.callStatus || lead.roundProgress?.[0]?.callStatus || '').toUpperCase();
            }

            const coveredStatuses = ['ANSWERED', 'ANSWER', 'REJECT', 'REJECTED', 'NO_ANSWER', 'CALL_AGAIN', 'FOLLOW_UP', 'NOT_INTERESTED', 'ENROLLED', 'COMPLETED'];
            const isCovered = coveredStatuses.includes(cStatus) || lead.callCenterStatus === 'completed';

            if (isCovered) {
                overview[cType][biz.id].completed++;
            } else {
                overview[cType][biz.id].pending++;
            }
        });

        // Convert to arrays
        const result = {
            AFTER_SEMINAR: Object.values(overview.AFTER_SEMINAR),
            FREE_SEMINAR: Object.values(overview.FREE_SEMINAR),
            BRIDGE: Object.values(overview.BRIDGE || {})
        };

        res.status(200).json(safeJson(result));
    } catch (error) {
        console.error("Agent getOverview error:", error);
        res.status(500).json({ error: "Failed to fetch overview" });
    }
};

exports.getBusinessLeads = async (req, res) => {
    try {
        const agentId = req.user?.id || req.user?.userId;
        const { businessId, campaignType, batchId } = req.query;

        if (!agentId) return res.status(401).json({ error: "Unauthorized" });

        const bizIdInt = parseInt(businessId);
        const whereClause = {
            assignedTo: parseInt(agentId),
            OR: [
                { batch: { businessId: bizIdInt } },
                { phone: { contains: `_BIZ_${bizIdInt}` } }
            ]
        };

        if (campaignType === 'BRIDGE') {
            whereClause.campaignType = 'AFTER_SEMINAR';
            whereClause.source = 'bridge_transfer';
        } else if (campaignType === 'AFTER_SEMINAR') {
            whereClause.campaignType = 'AFTER_SEMINAR';
            whereClause.source = { not: 'bridge_transfer' };
        } else {
            whereClause.campaignType = campaignType;
        }

        if (batchId && batchId !== 'All') {
            whereClause.batchId = parseInt(batchId);
        }

        const leads = await prisma.lead.findMany({
            where: whereClause,
            include: {
                batch: { include: { business: true } },
                roundProgress: true
            },
            orderBy: { updatedAt: 'desc' }
        });

        const biz = await prisma.business.findUnique({ where: { id: bizIdInt } });
        const enrichedLeads = leads.map(l => {
            if (!l.batch && biz) {
                return {
                    ...l,
                    batch: {
                        id: 0,
                        name: 'General Bridge Pool',
                        business: biz
                    }
                };
            }
            return l;
        });

        res.status(200).json(safeJson(enrichedLeads));
    } catch (error) {
        console.error("Agent getBusinessLeads error:", error);
        res.status(500).json({ error: "Failed to fetch leads" });
    }
};

exports.updateProgress = async (req, res) => {
    try {
        const agentId = req.user?.id || req.user?.userId;
        const userRole = String(req.user?.role || '').toUpperCase();
        const { leadId, leadStatus, payPlan, callMethod, attempts, feedback, callOutcome } = req.body;

        const lead = await prisma.lead.findUnique({
            where: { id: parseInt(leadId) }
        });

        if (!lead) return res.status(404).json({ error: "Lead not found" });

        // Allow Admins, Super Admins, and Managers to update progress without restriction.
        // For regular callers, verify assignment or allow claiming unassigned leads.
        const isManagerOrAdmin = ['ADMIN', 'SUPER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'MANAGER', 'ASS_MANAGER', 'HEAD_MANAGER', 'CALL_CENTER_MANAGER'].some(r => userRole.includes(r));
        if (!isManagerOrAdmin && lead.assignedTo && lead.assignedTo !== parseInt(agentId)) {
            return res.status(403).json({ error: "Access denied. Lead not assigned to you." });
        }

        const updateData = {};
        const { roundNum } = req.body; // e.g., 1 or 2
        const isRoundTwo = parseInt(roundNum) === 2;
        
        // For Round 1 (base lead) or Round 2 (LeadRoundProgress)
        if (isRoundTwo) {
            if (callMethod) updateData.callMethod = callMethod;
            if (attempts !== undefined) updateData.callAttempt = parseInt(attempts);
            if (feedback !== undefined) updateData.feedback = feedback;

            if (callOutcome) {
                updateData.callStatus = callOutcome;
                let currentPhase = 1;

                // Find existing Round 2 record safely via findFirst
                const progressRecord = await prisma.leadRoundProgress.findFirst({
                    where: { leadId: parseInt(leadId), roundNum: 2 }
                });
                if (progressRecord) currentPhase = progressRecord.phase || 1;

                if (callOutcome.toUpperCase() === 'NO_ANSWER') {
                    if (currentPhase < 3) {
                        updateData.phase = currentPhase + 1;
                    }
                }
            }

            // Find or create Round 2 record without crashing on compound key
            const existingProgress = await prisma.leadRoundProgress.findFirst({
                where: { leadId: parseInt(leadId), roundNum: 2 }
            });

            let updatedProgress;
            if (existingProgress) {
                updatedProgress = await prisma.leadRoundProgress.update({
                    where: { id: existingProgress.id },
                    data: updateData
                });
            } else {
                let category = 'DEFAULT';
                if (lead.campaignType === 'BRIDGE' || lead.source === 'bridge_transfer') category = 'BRIDGE';
                else if (lead.campaignType === 'OPEN_SEMINAR') category = 'OPEN_SEM';
                else if (lead.campaignType === 'NEW_INQ') category = 'NEW_INQ';
                else if (lead.campaignType === 'PAID') category = 'PAID';

                updatedProgress = await prisma.leadRoundProgress.create({
                    data: {
                        leadId: parseInt(leadId),
                        roundNum: 2,
                        campaignCategory: category,
                        phase: 1,
                        ...updateData
                    }
                });
            }

            // Also keep base Lead timestamp, feedback, and callCenterStatus synced
            const baseLeadUpdate = { updatedAt: new Date() };
            if (feedback !== undefined) baseLeadUpdate.feedback = feedback;
            if (['ANSWERED', 'REJECT'].includes((callOutcome || '').toUpperCase())) {
                baseLeadUpdate.callCenterStatus = 'completed';
            }
            if (!lead.assignedTo && agentId) {
                baseLeadUpdate.assignedTo = parseInt(agentId);
                baseLeadUpdate.assignedAt = new Date();
            }
            await prisma.lead.update({
                where: { id: parseInt(leadId) },
                data: baseLeadUpdate
            });

            return res.status(200).json(safeJson(updatedProgress));

        } else {
            // Round 1 Updates
            if (leadStatus) updateData.enrollmentStatus = leadStatus;
            if (payPlan) updateData.paymentIntention = payPlan;
            if (callMethod) updateData.callMethod = callMethod;
            if (attempts !== undefined) updateData.callAttempt = parseInt(attempts);
            if (feedback !== undefined) updateData.feedback = feedback;

            if (callOutcome) {
                updateData.callStatus = callOutcome;
                
                if (callOutcome.toUpperCase() === 'NO_ANSWER') {
                    const curPhase = lead.phase || 1;
                    if (curPhase < 3) {
                        updateData.phase = curPhase + 1;
                        updateData.callCenterStatus = 'pending';
                    } else {
                        updateData.callCenterStatus = 'completed';
                    }
                } else if (['ANSWERED', 'REJECT'].includes(callOutcome.toUpperCase())) {
                    updateData.callCenterStatus = 'completed';
                }
            }

            // Sync campaign-specific prefix fields if applicable
            let prefix = '';
            if (lead.campaignType === 'OPEN_SEMINAR') prefix = 'openSem';
            else if (lead.campaignType === 'NEW_INQ') prefix = 'newInq';
            else if (lead.campaignType === 'PAID') prefix = 'paid';

            if (prefix) {
                if (feedback !== undefined) updateData[`${prefix}Feedback`] = feedback;
                if (callOutcome) updateData[`${prefix}CallStatus`] = callOutcome;
                if (callMethod) updateData[`${prefix}CallMethod`] = callMethod;
                if (updateData.phase) updateData[`${prefix}Phase`] = updateData.phase;
                if (updateData.callAttempt) updateData[`${prefix}CallAttempt`] = updateData.callAttempt;
            }

            if (!lead.assignedTo && agentId) {
                updateData.assignedTo = parseInt(agentId);
                updateData.assignedAt = new Date();
            }

            updateData.updatedAt = new Date();

            const updatedLead = await prisma.lead.update({
                where: { id: parseInt(leadId) },
                data: updateData
            });

            // If there's an existing Round 1 progress in leadRoundProgress, sync it too
            try {
                const r1Progress = await prisma.leadRoundProgress.findFirst({
                    where: { leadId: parseInt(leadId), roundNum: 1 }
                });
                if (r1Progress) {
                    const r1Data = {};
                    if (callMethod) r1Data.callMethod = callMethod;
                    if (attempts !== undefined) r1Data.callAttempt = parseInt(attempts);
                    if (feedback !== undefined) r1Data.feedback = feedback;
                    if (callOutcome) r1Data.callStatus = callOutcome;
                    if (updateData.phase) r1Data.phase = updateData.phase;
                    await prisma.leadRoundProgress.update({
                        where: { id: r1Progress.id },
                        data: r1Data
                    });
                }
            } catch (err) {
                console.error("Warning syncing R1 progress:", err);
            }

            return res.status(200).json(safeJson(updatedLead));
        }
    } catch (error) {
        console.error("Agent updateProgress error:", error);
        res.status(500).json({ error: "Failed to update progress" });
    }
};

