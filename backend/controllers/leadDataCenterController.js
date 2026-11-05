const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');

/**
 * Get Lead Data Center records with filtering, search, stats, and pagination.
 */
exports.getLeadDataCenterRecords = async (req, res) => {
    try {
        const {
            businessId,
            batchId,
            campaignType = 'ALL',
            assignmentFilter = 'ALL',
            statusFilter = 'ALL',
            search = '',
            page = 1,
            limit = 50
        } = req.query;

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
        const skip = (pageNum - 1) * limitNum;

        // Fetch dropdown metadata: Businesses and Batches
        const businesses = await prisma.business.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        });

        let availableBatches = [];
        if (businessId && businessId !== 'ALL') {
            availableBatches = await prisma.batch.findMany({
                where: { businessId: parseInt(businessId) },
                select: { id: true, name: true, businessId: true },
                orderBy: { id: 'desc' }
            });
        } else {
            availableBatches = await prisma.batch.findMany({
                select: { id: true, name: true, businessId: true },
                orderBy: { id: 'desc' },
                take: 100
            });
        }

        // Build main where clause
        const whereClause = {
            AND: []
        };

        // Filter by Batch or Business
        if (batchId && batchId !== 'ALL') {
            whereClause.AND.push({ batchId: parseInt(batchId) });
        } else if (businessId && businessId !== 'ALL') {
            const batchIdsForBiz = availableBatches.map(b => b.id);
            whereClause.AND.push({ batchId: { in: batchIdsForBiz } });
        }

        // Filter by Campaign Type / Lead Source
        if (campaignType === 'NEW_INQ') {
            whereClause.AND.push({ inquiryType: 'NEW_INQ' });
        } else if (campaignType === 'OPEN_SEMINAR') {
            whereClause.AND.push({ inquiryType: 'OPEN_SEMINAR' });
        }

        // Filter by Assignment
        if (assignmentFilter === 'ASSIGNED') {
            whereClause.AND.push({ assignedTo: { not: null } });
        } else if (assignmentFilter === 'UNASSIGNED') {
            whereClause.AND.push({ assignedTo: null });
        }

        // Search Filter (Name or Phone)
        if (search && search.trim() !== '') {
            const q = search.trim();
            whereClause.AND.push({
                OR: [
                    { name: { contains: q } },
                    { phone: { contains: q } }
                ]
            });
        }

        // Filter by Round / Status
        if (statusFilter === 'ROUND1') {
            whereClause.AND.push({
                coordinationRound: 1,
                enrollmentStatus: { notIn: ['ENROLLED', 'PAID'] }
            });
        } else if (statusFilter === 'ROUND2') {
            whereClause.AND.push({
                coordinationRound: 2,
                enrollmentStatus: { notIn: ['ENROLLED', 'PAID'] }
            });
        } else if (statusFilter === 'PAID') {
            whereClause.AND.push({
                enrollmentStatus: { in: ['ENROLLED', 'PAID'] }
            });
        } else if (statusFilter === 'NON_PAID') {
            whereClause.AND.push({
                coordinationRound: 3,
                enrollmentStatus: { notIn: ['ENROLLED', 'PAID'] }
            });
        } else if (statusFilter === 'DELAYED') {
            whereClause.AND.push({
                OR: [
                    { r1DelayedDays: { gt: 0 } },
                    { r2DelayedDays: { gt: 0 } }
                ]
            });
        }

        if (whereClause.AND.length === 0) {
            delete whereClause.AND;
        }

        // Fetch Total Count for Pagination
        const totalCount = await prisma.lead.count({ where: whereClause });

        // Fetch Leads
        const rawLeads = await prisma.lead.findMany({
            where: whereClause,
            include: {
                assignedUser: {
                    select: { id: true, firstName: true, lastName: true, role: true }
                },
                batch: {
                    select: { id: true, name: true, businessId: true }
                }
            },
            orderBy: { updatedAt: 'desc' },
            skip,
            take: limitNum
        });

        // Compute Statistics for the active filter context
        const baseWhere = { AND: [] };
        if (batchId && batchId !== 'ALL') {
            baseWhere.AND.push({ batchId: parseInt(batchId) });
        } else if (businessId && businessId !== 'ALL') {
            const batchIdsForBiz = availableBatches.map(b => b.id);
            baseWhere.AND.push({ batchId: { in: batchIdsForBiz } });
        }
        if (baseWhere.AND.length === 0) delete baseWhere.AND;

        const [totalInContext, assignedInContext, unassignedInContext, round1InContext, round2InContext, paidInContext, nonPaidInContext, delayedInContext] = await Promise.all([
            prisma.lead.count({ where: baseWhere }),
            prisma.lead.count({ where: { ...baseWhere, assignedTo: { not: null } } }),
            prisma.lead.count({ where: { ...baseWhere, assignedTo: null } }),
            prisma.lead.count({ where: { ...baseWhere, coordinationRound: 1, enrollmentStatus: { notIn: ['ENROLLED', 'PAID'] } } }),
            prisma.lead.count({ where: { ...baseWhere, coordinationRound: 2, enrollmentStatus: { notIn: ['ENROLLED', 'PAID'] } } }),
            prisma.lead.count({ where: { ...baseWhere, enrollmentStatus: { in: ['ENROLLED', 'PAID'] } } }),
            prisma.lead.count({ where: { ...baseWhere, coordinationRound: 3, enrollmentStatus: { notIn: ['ENROLLED', 'PAID'] } } }),
            prisma.lead.count({ where: { ...baseWhere, OR: [{ r1DelayedDays: { gt: 0 } }, { r2DelayedDays: { gt: 0 } }] } })
        ]);

        // Format formatted records
        const records = rawLeads.map(lead => {
            const isPaid = lead.enrollmentStatus === 'ENROLLED' || lead.enrollmentStatus === 'PAID';
            const isAssigned = !!lead.assignedTo;
            const coordinatorName = isAssigned && lead.assignedUser
                ? `${lead.assignedUser.firstName || ''} ${lead.assignedUser.lastName || ''}`.trim()
                : 'Unassigned';

            let currentRoundLabel = 'Round 1';
            if (isPaid) {
                currentRoundLabel = 'Paid / Enrolled';
            } else if (lead.coordinationRound === 2) {
                currentRoundLabel = 'Round 2 (Active)';
            } else if (lead.coordinationRound === 3) {
                currentRoundLabel = 'Non-Enrolled';
            }

            return {
                id: lead.id,
                name: lead.name || 'Unnamed',
                phone: lead.phone,
                source: lead.source,
                campaignType: lead.inquiryType === 'NEW_INQ' ? 'New Inquiry' : (lead.inquiryType === 'OPEN_SEMINAR' ? 'Open Seminar' : lead.campaignType || 'After Seminar'),
                inquiryType: lead.inquiryType || 'NORMAL',
                batchId: lead.batchId,
                batchName: lead.batch?.name || 'No Batch',
                isAssigned,
                assignedTo: lead.assignedTo,
                coordinatorName,
                assignedAt: lead.assignedAt || lead.createdAt,
                coordinationRound: lead.coordinationRound,
                currentRoundLabel,
                r1DelayedDays: lead.r1DelayedDays || 0,
                r2DelayedDays: lead.r2DelayedDays || 0,
                callStatus: lead.callStatus || 'pending',
                callAttempt: lead.callAttempt || 1,
                enrollmentStatus: lead.enrollmentStatus || 'NON_ENROLLED',
                isPaid,
                createdAt: lead.createdAt,
                updatedAt: lead.updatedAt
            };
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
            stats: {
                total: totalInContext,
                assigned: assignedInContext,
                unassigned: unassignedInContext,
                round1: round1InContext,
                round2: round2InContext,
                paid: paidInContext,
                nonPaid: nonPaidInContext,
                delayed: delayedInContext
            },
            meta: {
                businesses,
                batches: availableBatches
            }
        });

    } catch (error) {
        console.error("Error in getLeadDataCenterRecords:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch lead data center records",
            details: error.message
        });
    }
};
