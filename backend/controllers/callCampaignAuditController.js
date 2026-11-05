const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getLiveCampaignLeads = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            search = '',
            campaignCategory = 'ALL',
            coordinatorId = 'ALL',
            businessType = 'ALL',
            batchId = 'ALL'
        } = req.query;

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
        const skip = (pageNum - 1) * limitNum;

        const whereClause = { AND: [] };

        // We only want leads that belong to these campaigns (either by inquiryType or assigned campaignType)
        // Let's ensure they are not just raw NEW leads without a campaign.
        // If the user selects ALL, we filter leads that are actually part of some call campaign logic.
        // Based on the system, ALL leads assigned to someone usually have a campaignType or inquiryType.
        // We'll just fetch all leads and allow filtering.

        if (campaignCategory !== 'ALL') {
            whereClause.AND.push({
                OR: [
                    { inquiryType: campaignCategory },
                    { campaignType: campaignCategory }
                ]
            });
        }

        if (coordinatorId !== 'ALL') {
            if (coordinatorId === 'UNASSIGNED') {
                whereClause.AND.push({ assignedTo: null });
            } else {
                whereClause.AND.push({ assignedTo: parseInt(coordinatorId) });
            }
        }

        if (batchId !== 'ALL') {
            whereClause.AND.push({ batchId: parseInt(batchId) });
        }

        if (businessType !== 'ALL') {
            whereClause.AND.push({
                batch: {
                    business: {
                        name: businessType
                    }
                }
            });
        }

        if (search && search.trim() !== '') {
            const q = search.trim();
            whereClause.AND.push({
                OR: [
                    { phone: { contains: q } },
                    { name: { contains: q } }
                ]
            });
        }

        if (whereClause.AND.length === 0) {
            delete whereClause.AND;
        }

        const [totalCount, rawLeads] = await Promise.all([
            prisma.lead.count({ where: whereClause }),
            prisma.lead.findMany({
                where: whereClause,
                include: {
                    assignedUser: { select: { firstName: true, lastName: true } },
                    batch: {
                        include: {
                            business: { select: { name: true } }
                        }
                    }
                },
                orderBy: { updatedAt: 'desc' },
                skip,
                take: limitNum
            })
        ]);

        const records = rawLeads.map(lead => {
            // Determine the active campaign category and status based on inquiryType or campaignType
            let activeCategory = lead.inquiryType || lead.campaignType || 'UNKNOWN';
            let activeStatus = lead.callStatus || 'pending';
            let activeAttempt = lead.callAttempt || 1;
            let activeFeedback = lead.feedback || '';

            if (activeCategory === 'OPEN_SEMINAR') {
                activeStatus = lead.openSemCallStatus || 'pending';
                activeAttempt = lead.openSemCallAttempt || 1;
                activeFeedback = lead.openSemFeedback || '';
            } else if (activeCategory === 'NEW_INQ') {
                activeStatus = lead.newInqCallStatus || 'pending';
                activeAttempt = lead.newInqCallAttempt || 1;
                activeFeedback = lead.newInqFeedback || '';
            }

            return {
                id: lead.id,
                leadName: lead.name || 'Unnamed',
                leadPhone: lead.phone || 'No Phone',
                campaignCategory: activeCategory,
                businessType: lead.batch?.business?.name || 'N/A',
                batchName: lead.batch?.name || 'No Batch',
                coordinatorName: lead.assignedUser ? `${lead.assignedUser.firstName} ${lead.assignedUser.lastName}`.trim() : 'Unassigned',
                currentStatus: activeStatus,
                callAttempt: activeAttempt,
                remarks: activeFeedback,
                updatedAt: lead.updatedAt,
                createdAt: lead.createdAt
            };
        });

        // Fetch meta data for dropdowns
        const [coordinators, batches] = await Promise.all([
            prisma.user.findMany({
                where: { role: 'Coordinator' }, // Might need to expand if others manage campaigns
                select: { id: true, firstName: true, lastName: true },
                orderBy: { firstName: 'asc' }
            }),
            prisma.batch.findMany({
                include: { business: { select: { name: true } } },
                orderBy: { createdAt: 'desc' }
            })
        ]);

        return res.status(200).json({
            success: true,
            records,
            pagination: {
                total: totalCount,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(totalCount / limitNum) || 1
            },
            meta: {
                coordinators,
                batches
            }
        });

    } catch (error) {
        console.error("Error in getLiveCampaignLeads:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch live campaign leads",
            details: error.message
        });
    }
};

exports.getAuditLogs = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            search = '',
            campaignCategory = 'ALL',
            coordinatorId = 'ALL',
            startDate = '',
            endDate = ''
        } = req.query;

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
        const skip = (pageNum - 1) * limitNum;

        const whereClause = { AND: [] };

        if (campaignCategory !== 'ALL') {
            whereClause.AND.push({ campaignCategory });
        }

        if (coordinatorId !== 'ALL') {
            whereClause.AND.push({ actionedById: parseInt(coordinatorId) });
        }

        if (search && search.trim() !== '') {
            const q = search.trim();
            whereClause.AND.push({
                lead: {
                    OR: [
                        { phone: { contains: q } },
                        { name: { contains: q } }
                    ]
                }
            });
        }

        if (startDate && endDate) {
            whereClause.AND.push({
                createdAt: {
                    gte: new Date(startDate),
                    lte: new Date(endDate + 'T23:59:59.999Z')
                }
            });
        } else if (startDate) {
            whereClause.AND.push({
                createdAt: {
                    gte: new Date(startDate)
                }
            });
        }

        if (whereClause.AND.length === 0) {
            delete whereClause.AND;
        }

        const [totalCount, rawLogs] = await Promise.all([
            prisma.callCampaignAuditLog.count({ where: whereClause }),
            prisma.callCampaignAuditLog.findMany({
                where: whereClause,
                include: {
                    lead: { select: { name: true, phone: true } },
                    actionedUser: { select: { firstName: true, lastName: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum
            })
        ]);

        const records = rawLogs.map(log => ({
            id: log.id,
            leadId: log.leadId,
            leadName: log.lead?.name || 'Unnamed',
            leadPhone: log.lead?.phone || 'No Phone',
            campaignCategory: log.campaignCategory,
            actionType: log.actionType,
            oldStatus: log.oldStatus,
            newStatus: log.newStatus,
            callAttempt: log.callAttempt,
            remarks: log.remarks,
            coordinatorName: log.actionedUser ? `${log.actionedUser.firstName} ${log.actionedUser.lastName}`.trim() : 'System/Unknown',
            createdAt: log.createdAt
        }));

        const coordinators = await prisma.user.findMany({
            where: { role: 'Coordinator' },
            select: { id: true, firstName: true, lastName: true },
            orderBy: { firstName: 'asc' }
        });

        return res.status(200).json({
            success: true,
            records,
            pagination: {
                total: totalCount,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(totalCount / limitNum) || 1
            },
            meta: {
                coordinators
            }
        });

    } catch (error) {
        console.error("Error in getAuditLogs:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch audit logs",
            details: error.message
        });
    }
};
