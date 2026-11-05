const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper to sanitize BigInts for JSON response
const safeJson = (data) => {
    return JSON.parse(JSON.stringify(data, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
    ));
};

exports.getExecutiveAnalytics = async (req, res) => {
    try {
        const { businessId, batchId, startDate, endDate, timeFilter } = req.query;

        // Parse IDs safely
        const parsedBizId = (businessId && businessId !== 'ALL' && businessId !== 'undefined' && businessId !== 'null') 
            ? parseInt(businessId) 
            : null;
        const parsedBatchId = (batchId && batchId !== 'ALL' && batchId !== 'undefined' && batchId !== 'null') 
            ? parseInt(batchId) 
            : null;

        // Date Range Logic (Safe Date objects without mutation)
        let start = null;
        let end = null;

        const now = new Date();
        if (timeFilter === 'today') {
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        } else if (timeFilter === 'this_week') {
            const temp = new Date(now);
            const firstDayOfWeek = new Date(temp.setDate(temp.getDate() - temp.getDay()));
            firstDayOfWeek.setHours(0, 0, 0, 0);
            start = firstDayOfWeek;
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        } else if (timeFilter === 'this_month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        } else if (startDate || endDate) {
            if (startDate) {
                const s = new Date(startDate);
                s.setHours(0, 0, 0, 0);
                start = s;
            }
            if (endDate) {
                const e = new Date(endDate);
                e.setHours(23, 59, 59, 999);
                end = e;
            }
        }

        // 1. Fetch All Active Businesses with their Batches & Managers
        const allBusinesses = await prisma.business.findMany({
            where: { status: 1 },
            orderBy: [{ itemOrder: 'asc' }, { id: 'asc' }],
            include: {
                batches: {
                    where: { status: 1 },
                    orderBy: [{ itemOrder: 'asc' }, { id: 'asc' }]
                }
            }
        });

        // Fetch managers for business details
        const managerIds = [];
        allBusinesses.forEach(b => {
            if (b.head_manager_id) managerIds.push(b.head_manager_id);
            if (b.ass_manager_id) managerIds.push(b.ass_manager_id);
        });
        const managers = await prisma.user.findMany({
            where: { id: { in: managerIds } },
            select: { id: true, firstName: true, lastName: true, role: true, image: true }
        });
        const managerMap = new Map(managers.map(m => [m.id, m]));

        // Calculate mini stats for businesses grid (Optimized: only compute counts when needed)
        const businessesWithSummary = await Promise.all(allBusinesses.map(async (biz) => {
            let leadCount = 0;
            let freeSemCount = 0;
            let afterSemCount = 0;

            if (!parsedBizId || biz.id === parsedBizId) {
                const bizBatches = biz.batches.map(b => b.id);
                leadCount = await prisma.lead.count({
                    where: {
                        OR: [
                            { batchId: { in: bizBatches } },
                            { phone: { endsWith: `_BIZ_${biz.id}` } },
                            { phone: { contains: `_BIZ_${biz.id}_` } }
                        ]
                    }
                });
                freeSemCount = await prisma.lead.count({
                    where: {
                        campaignType: 'FREE_SEMINAR',
                        OR: [
                            { batchId: { in: bizBatches } },
                            { phone: { endsWith: `_BIZ_${biz.id}` } },
                            { phone: { contains: `_BIZ_${biz.id}_` } }
                        ]
                    }
                });
                afterSemCount = await prisma.lead.count({
                    where: {
                        campaignType: 'AFTER_SEMINAR',
                        OR: [
                            { batchId: { in: bizBatches } },
                            { phone: { endsWith: `_BIZ_${biz.id}` } },
                            { phone: { contains: `_BIZ_${biz.id}_` } }
                        ]
                    }
                });
            }

            return {
                id: biz.id,
                name: biz.name,
                category: biz.category,
                medium: biz.medium,
                description: biz.description,
                logo: biz.logo,
                streams: biz.streams,
                itemOrder: biz.itemOrder,
                status: biz.status,
                headManager: managerMap.get(biz.head_manager_id) || null,
                assManager: managerMap.get(biz.ass_manager_id) || null,
                batchesCount: biz.batches.length,
                batches: biz.batches.map(b => ({
                    id: b.id,
                    name: b.name,
                    logo: b.logo,
                    type: b.type,
                    targetIndividualGoal: b.targetIndividualGoal ?? 40,
                    targetGroupGoal: b.targetGroupGoal ?? 50
                })),
                totalLeads: leadCount,
                freeSemLeads: freeSemCount,
                afterSemLeads: afterSemCount
            };
        }));

        // If no business selected yet, return just the businesses directory list
        if (!parsedBizId) {
            return res.status(200).json(safeJson({
                selectedBusiness: null,
                selectedBatch: null,
                businesses: businessesWithSummary,
                overview: null
            }));
        }

        // Active Business
        const activeBusiness = businessesWithSummary.find(b => b.id === parsedBizId);
        if (!activeBusiness) {
            return res.status(404).json({ error: "Selected business not found" });
        }

        // Determine Batches Filter
        const availableBatchIds = activeBusiness.batches.map(b => b.id);
        const targetBatchIds = parsedBatchId ? [parsedBatchId] : availableBatchIds;

        // Base Where Clause for Business
        const leadScope = {
            OR: [
                { batchId: { in: targetBatchIds } },
                ...(!parsedBatchId ? [
                    { phone: { endsWith: `_BIZ_${parsedBizId}` } },
                    { phone: { contains: `_BIZ_${parsedBizId}_` } }
                ] : [])
            ]
        };

        if (start || end) {
            const dateOr = [];
            if (start && end) {
                dateOr.push({ createdAt: { gte: start, lte: end } });
                dateOr.push({ updatedAt: { gte: start, lte: end } });
            } else if (start) {
                dateOr.push({ createdAt: { gte: start } });
                dateOr.push({ updatedAt: { gte: start } });
            } else if (end) {
                dateOr.push({ createdAt: { lte: end } });
                dateOr.push({ updatedAt: { lte: end } });
            }

            leadScope.AND = [
                { OR: dateOr }
            ];
        }

        // Fetch All Leads in scope with coordinator details (Optimized: select required fields)
        const allScopedLeads = await prisma.lead.findMany({
            where: leadScope,
            select: {
                id: true,
                phone: true,
                campaignType: true,
                inquiryType: true,
                source: true,
                status: true,
                callStatus: true,
                callAttempt: true,
                phase: true,
                batchId: true,
                assignedTo: true,
                isCallCenter: true,
                callCenterRequestStatus: true,
                callCenterStatus: true,
                r1DelayedDays: true,
                r2DelayedDays: true,
                openSemCallStatus: true,
                openSemCallAttempt: true,
                openSemRound: true,
                newInqCallStatus: true,
                newInqCallAttempt: true,
                newInqRound: true,
                paidCallStatus: true,
                paidCallAttempt: true,
                paidRound: true,
                paymentIntention: true,
                enrollmentStatus: true,
                createdAt: true,
                updatedAt: true,
                assignedUser: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                        image: true,
                        businessType: true,
                        agentStatus: true
                    }
                },
                batch: {
                    select: {
                        id: true,
                        name: true,
                        targetIndividualGoal: true,
                        targetGroupGoal: true
                    }
                }
            }
        });

        // Also fetch Verified Payments for this Business / Batch to strictly verify Paid status
        const paymentWhere = {
            status: 1,
            businessId: parsedBizId
        };
        if (parsedBatchId) paymentWhere.batchId = parsedBatchId;
        if (start || end) {
            paymentWhere.created_at = {};
            if (start) paymentWhere.created_at.gte = start;
            if (end) paymentWhere.created_at.lte = end;
        }

        const verifiedPayments = await prisma.payment.findMany({
            where: paymentWhere,
            select: {
                id: true,
                amount: true,
                payment_type: true,
                post_pay_days: true,
                studentId: true,
                student: {
                    select: { phone: true, optionalPhone: true, whatsapp: true }
                }
            }
        });

        const verifiedPhoneSet = new Set();
        verifiedPayments.forEach(p => {
            if (p.student?.phone) verifiedPhoneSet.add(p.student.phone.replace(/[^0-9]/g, '').slice(-7));
            if (p.student?.whatsapp) verifiedPhoneSet.add(p.student.whatsapp.replace(/[^0-9]/g, '').slice(-7));
            if (p.student?.optionalPhone) verifiedPhoneSet.add(p.student.optionalPhone.replace(/[^0-9]/g, '').slice(-7));
        });

        // -------------------------------------------------------------
        // 2. FREE SEMINAR ANALYTICS
        // -------------------------------------------------------------
        const freeSemLeads = allScopedLeads.filter(l => l.campaignType === 'FREE_SEMINAR');
        
        let freeSemTotal = freeSemLeads.length;
        let freeSemAssigned = 0;
        let freeSemUnassigned = 0;
        let freeSemCallCenterAssigned = 0;
        let freeSemCovered = 0;
        let freeSemPending = 0;
        let freeSemAnswered = 0;
        let freeSemNoAnswer = 0;
        let freeSemReject = 0;

        // Call Center Specific
        let ccTotal = 0;
        let ccCovered = 0;
        let ccPending = 0;

        const coordinatorFreeSemMap = {};

        freeSemLeads.forEach(l => {
            const isCCRole = l.assignedUser && ['CALLER', 'CALL_CENTER_AGENT', 'CALL_CENTER'].includes(l.assignedUser.role?.toUpperCase().replace(/ /g, '_'));
            const isCCReq = l.callCenterRequestStatus === 'REQUESTED' || l.callCenterRequestStatus === 'APPROVED' || l.isCallCenter || isCCRole;

            if (isCCReq) {
                freeSemCallCenterAssigned++;
                ccTotal++;
            }

            if (!l.assignedTo) {
                freeSemUnassigned++;
            } else {
                freeSemAssigned++;
            }

            let status = (l.callStatus || 'pending').toLowerCase();
            if (!l.isCallCenter && l.phase > 1 && status === 'pending') {
                status = 'no_answer';
            }

            const isAnswered = status === 'answered' || status === 'completed';
            const isNoAns = status === 'no_answer';
            const isRej = status === 'reject';
            const isPend = status === 'pending';

            if (isAnswered) freeSemAnswered++;
            else if (isNoAns) freeSemNoAnswer++;
            else if (isRej) freeSemReject++;
            else if (isPend) freeSemPending++;

            if (!isPend) {
                freeSemCovered++;
                if (isCCReq) ccCovered++;
            } else {
                if (isCCReq) ccPending++;
            }

            // Group by coordinator
            if (l.assignedTo && l.assignedUser) {
                const cId = l.assignedUser.id;
                const cName = `${l.assignedUser.firstName} ${l.assignedUser.lastName || ''}`.trim();
                if (!coordinatorFreeSemMap[cId]) {
                    coordinatorFreeSemMap[cId] = {
                        id: cId,
                        name: cName,
                        role: l.assignedUser.role || 'Coordinator',
                        image: l.assignedUser.image,
                        assigned: 0,
                        pending: 0,
                        answered: 0,
                        noAnswer: 0,
                        reject: 0,
                        covered: 0
                    };
                }
                coordinatorFreeSemMap[cId].assigned++;
                if (isAnswered) {
                    coordinatorFreeSemMap[cId].answered++;
                    coordinatorFreeSemMap[cId].covered++;
                } else if (isNoAns) {
                    coordinatorFreeSemMap[cId].noAnswer++;
                    coordinatorFreeSemMap[cId].covered++;
                } else if (isRej) {
                    coordinatorFreeSemMap[cId].reject++;
                    coordinatorFreeSemMap[cId].covered++;
                } else {
                    coordinatorFreeSemMap[cId].pending++;
                }
            }
        });

        const freeSemResponseRate = freeSemAssigned > 0 ? Math.round((freeSemAnswered / freeSemAssigned) * 100) : 0;
        const ccResponseRate = ccTotal > 0 ? Math.round((ccCovered / ccTotal) * 100) : 0;

        const coordinatorFreeSemList = Object.values(coordinatorFreeSemMap).map(c => ({
            ...c,
            responseRate: c.assigned > 0 ? Math.round((c.answered / c.assigned) * 100) : 0
        })).sort((a, b) => b.assigned - a.assigned);

        // -------------------------------------------------------------
        // 2.1 FREE SEMINAR WHATSAPP MESSAGES BREAKDOWN (OPTIMIZED)
        // -------------------------------------------------------------
        const freeSemLeadMap = new Map();
        freeSemLeads.forEach(l => freeSemLeadMap.set(l.id, l));
        const freeSemLeadIds = freeSemLeads.map(l => l.id);

        let msgCreatedAtWhere = undefined;
        if (start || end) {
            msgCreatedAtWhere = {};
            if (start) msgCreatedAtWhere.gte = start;
            if (end) msgCreatedAtWhere.lte = end;
        }

        const freeSemMessages = freeSemLeadIds.length > 0 ? await prisma.chatMessage.findMany({
            where: {
                leadId: { in: freeSemLeadIds },
                ...(msgCreatedAtWhere ? { createdAt: msgCreatedAtWhere } : {})
            },
            select: {
                id: true,
                leadId: true,
                direction: true,
                senderId: true,
                senderName: true,
                senderUser: {
                    select: { id: true, firstName: true, lastName: true, role: true, image: true }
                }
            }
        }) : [];

        let totalInboundMessages = 0;
        let totalOutboundMessages = 0;
        const totalUniqueInboundNumbers = new Set();
        const totalUniqueOutboundNumbers = new Set();

        const whatsappStaffMap = {};

        freeSemMessages.forEach(m => {
            const lead = freeSemLeadMap.get(m.leadId);
            if (!lead) return;
            const phone = lead.phone ? lead.phone.split('_')[0] : String(lead.id);

            if (m.direction === 'outbound') {
                totalOutboundMessages++;
                totalUniqueOutboundNumbers.add(phone);

                const sender = m.senderUser;
                const staffId = sender?.id || m.senderId || (lead.assignedTo || 0);
                const staffName = sender ? `${sender.firstName} ${sender.lastName || ''}`.trim() : (m.senderName || 'System / Auto');
                const staffImg = sender?.image || null;
                const staffRole = sender?.role || 'Staff';

                if (!whatsappStaffMap[staffName]) {
                    whatsappStaffMap[staffName] = {
                        coordinatorId: staffId,
                        coordinatorName: staffName,
                        role: staffRole,
                        image: staffImg,
                        inboundNumbers: new Set(),
                        outboundNumbers: new Set(),
                        assignedNumbersMessaged: new Set(),
                        otherNumbersMessaged: new Set(),
                        totalSent: 0,
                        totalReceived: 0
                    };
                }

                whatsappStaffMap[staffName].totalSent++;
                whatsappStaffMap[staffName].outboundNumbers.add(phone);

                if (staffId && lead.assignedTo === staffId) {
                    whatsappStaffMap[staffName].assignedNumbersMessaged.add(phone);
                } else {
                    whatsappStaffMap[staffName].otherNumbersMessaged.add(phone);
                }
            } else {
                totalInboundMessages++;
                totalUniqueInboundNumbers.add(phone);

                const assignedUser = lead.assignedUser;
                const staffName = assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName || ''}`.trim() : 'Unassigned Pool';
                const staffId = lead.assignedTo || null;
                const staffImg = assignedUser?.image || null;
                const staffRole = assignedUser?.role || 'Unassigned';

                if (!whatsappStaffMap[staffName]) {
                    whatsappStaffMap[staffName] = {
                        coordinatorId: staffId,
                        coordinatorName: staffName,
                        role: staffRole,
                        image: staffImg,
                        inboundNumbers: new Set(),
                        outboundNumbers: new Set(),
                        assignedNumbersMessaged: new Set(),
                        otherNumbersMessaged: new Set(),
                        totalSent: 0,
                        totalReceived: 0
                    };
                }

                whatsappStaffMap[staffName].totalReceived++;
                whatsappStaffMap[staffName].inboundNumbers.add(phone);
            }
        });

        const whatsappStaffList = Object.values(whatsappStaffMap).map(s => {
            const outCount = s.outboundNumbers.size;
            const assignedCount = s.assignedNumbersMessaged.size;
            const otherCount = s.otherNumbersMessaged.size;
            const inCount = s.inboundNumbers.size;
            const matchRate = outCount > 0 ? Math.round((assignedCount / outCount) * 100) : 0;

            return {
                coordinatorId: s.coordinatorId,
                coordinatorName: s.coordinatorName,
                role: s.role,
                image: s.image,
                inboundNumbersCount: inCount,
                outboundNumbersCount: outCount,
                assignedNumbersMessagedCount: assignedCount,
                otherNumbersMessagedCount: otherCount,
                totalSent: s.totalSent,
                totalReceived: s.totalReceived,
                matchRate
            };
        }).sort((a, b) => b.totalSent - a.totalSent);

        // -------------------------------------------------------------
        // 3. AFTER SEMINAR ANALYTICS (Open Sem, New Inq, Paid, Bridge)
        // -------------------------------------------------------------
        const afterSemLeads = allScopedLeads.filter(l => l.campaignType === 'AFTER_SEMINAR');
        const afterSemTotal = afterSemLeads.length;

        // 3.0 AFTER SEMINAR WHATSAPP MESSAGES BREAKDOWN
        const afterSemLeadIds = afterSemLeads.map(l => l.id);
        const afterSemLeadMap = new Map();
        afterSemLeads.forEach(l => afterSemLeadMap.set(l.id, l));

        const afterSemMessages = afterSemLeadIds.length > 0 ? await prisma.chatMessage.findMany({
            where: {
                leadId: { in: afterSemLeadIds },
                ...(msgCreatedAtWhere ? { createdAt: msgCreatedAtWhere } : {})
            },
            select: {
                id: true,
                leadId: true,
                direction: true,
                senderId: true,
                senderName: true,
                senderUser: {
                    select: { id: true, firstName: true, lastName: true, role: true, image: true }
                }
            }
        }) : [];

        let totalAfterSemInboundMsgs = 0;
        let totalAfterSemOutboundMsgs = 0;
        const totalAfterSemInboundNumbers = new Set();
        const totalAfterSemOutboundNumbers = new Set();
        const afterSemWhatsappStaffMap = {};

        afterSemMessages.forEach(m => {
            const lead = afterSemLeadMap.get(m.leadId);
            if (!lead) return;
            const phone = lead.phone ? lead.phone.split('_')[0] : String(lead.id);

            if (m.direction === 'outbound') {
                totalAfterSemOutboundMsgs++;
                totalAfterSemOutboundNumbers.add(phone);
                const sender = m.senderUser;
                const staffId = sender?.id || m.senderId || (lead.assignedTo || 0);
                const staffName = sender ? `${sender.firstName} ${sender.lastName || ''}`.trim() : (m.senderName || 'System / Auto');
                const staffImg = sender?.image || null;
                const staffRole = sender?.role || 'Staff';

                if (!afterSemWhatsappStaffMap[staffName]) {
                    afterSemWhatsappStaffMap[staffName] = {
                        coordinatorId: staffId,
                        coordinatorName: staffName,
                        role: staffRole,
                        image: staffImg,
                        inboundNumbers: new Set(),
                        outboundNumbers: new Set(),
                        assignedNumbersMessaged: new Set(),
                        otherNumbersMessaged: new Set(),
                        totalSent: 0,
                        totalReceived: 0
                    };
                }
                afterSemWhatsappStaffMap[staffName].totalSent++;
                afterSemWhatsappStaffMap[staffName].outboundNumbers.add(phone);
                if (staffId && lead.assignedTo === staffId) {
                    afterSemWhatsappStaffMap[staffName].assignedNumbersMessaged.add(phone);
                } else {
                    afterSemWhatsappStaffMap[staffName].otherNumbersMessaged.add(phone);
                }
            } else {
                totalAfterSemInboundMsgs++;
                totalAfterSemInboundNumbers.add(phone);
                const assignedUser = lead.assignedUser;
                const staffName = assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName || ''}`.trim() : 'Unassigned Pool';
                const staffId = lead.assignedTo || null;
                const staffImg = assignedUser?.image || null;
                const staffRole = assignedUser?.role || 'Unassigned';

                if (!afterSemWhatsappStaffMap[staffName]) {
                    afterSemWhatsappStaffMap[staffName] = {
                        coordinatorId: staffId,
                        coordinatorName: staffName,
                        role: staffRole,
                        image: staffImg,
                        inboundNumbers: new Set(),
                        outboundNumbers: new Set(),
                        assignedNumbersMessaged: new Set(),
                        otherNumbersMessaged: new Set(),
                        totalSent: 0,
                        totalReceived: 0
                    };
                }
                afterSemWhatsappStaffMap[staffName].totalReceived++;
                afterSemWhatsappStaffMap[staffName].inboundNumbers.add(phone);
            }
        });

        const afterSemWhatsappStaffList = Object.values(afterSemWhatsappStaffMap).map(s => {
            const outCount = s.outboundNumbers.size;
            const assignedCount = s.assignedNumbersMessaged.size;
            const otherCount = s.otherNumbersMessaged.size;
            const inCount = s.inboundNumbers.size;
            const matchRate = outCount > 0 ? Math.round((assignedCount / outCount) * 100) : 0;
            return {
                coordinatorId: s.coordinatorId,
                coordinatorName: s.coordinatorName,
                role: s.role,
                image: s.image,
                inboundNumbersCount: inCount,
                outboundNumbersCount: outCount,
                assignedNumbersMessagedCount: assignedCount,
                otherNumbersMessagedCount: otherCount,
                totalSent: s.totalSent,
                totalReceived: s.totalReceived,
                matchRate
            };
        }).sort((a, b) => b.totalSent - a.totalSent);

        // A. Open Seminar Leads
        const openSemLeads = afterSemLeads.filter(l => 
            (l.inquiryType === 'OPEN_SEMINAR' || l.inquiryType === 'NORMAL' || !l.inquiryType) && 
            l.source !== 'bridge_transfer'
        );

        let openSemTotal = openSemLeads.length;
        let openSemAssigned = 0;
        let openSemContacted = 0;
        let openSemPending = 0;
        let openSemAnswered = 0;
        let openSemNoAnswer = 0;
        let openSemReject = 0;
        let openSemDelayed = 0;
        let openSemEnrolled = 0;

        let planFull = 0;
        let planUpgrade = 0;
        let planMonthly = 0;
        let planInstallments = 0;

        const openSemRounds = {
            round1: { assigned: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0, delayed: 0 },
            round2: { assigned: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0, delayed: 0 },
            nonEnrolled: { assigned: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0, delayed: 0 },
            enrolledPaid: { assigned: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0, delayed: 0 }
        };

        let historicalR1Delays = 0;
        let historicalR2Delays = 0;

        const openSemStaffMap = {};

        openSemLeads.forEach(l => {
            if (l.assignedTo) openSemAssigned++;
            
            const cleanPhone = (l.phone || '').replace(/[^0-9]/g, '').slice(-7);
            const isEnrolled = l.enrollmentStatus === 'ENROLLED' || l.enrollmentStatus === 'PAID' || verifiedPhoneSet.has(cleanPhone);
            if (isEnrolled) openSemEnrolled++;

            const status = (l.openSemCallStatus || 'pending').toLowerCase();
            const isPend = status === 'pending';
            const isAns = status === 'answered';
            const isNoAns = status === 'no_answer';
            const isRej = status === 'reject';
            const isDelayed = (l.r1DelayedDays > 0 || l.r2DelayedDays > 0 || isPend);

            if (l.r1DelayedDays > 0) historicalR1Delays += l.r1DelayedDays;
            if (l.r2DelayedDays > 0) historicalR2Delays += l.r2DelayedDays;

            if (isAns) openSemAnswered++;
            else if (isNoAns) openSemNoAnswer++;
            else if (isRej) openSemReject++;
            else if (isPend) openSemPending++;

            if (!isPend) openSemContacted++;
            if (isDelayed && isPend) openSemDelayed++;

            const payIntention = (l.paymentIntention || '').toUpperCase();
            if (payIntention === 'FULL' || l.enrollmentStatus === 'FULL') planFull++;
            else if (payIntention === 'UPGRADE' || l.enrollmentStatus === 'UPGRADE') planUpgrade++;
            else if (payIntention === 'MONTHLY' || l.enrollmentStatus === 'MONTHLY') planMonthly++;
            else if (payIntention === 'INSTALLMENTS' || payIntention === 'INSTALLMENT' || l.enrollmentStatus === 'INSTALLMENT') planInstallments++;

            const roundNum = l.openSemRound || 1;
            if (isEnrolled) {
                openSemRounds.enrolledPaid.assigned++;
                if (isAns) openSemRounds.enrolledPaid.answered++;
                else if (isPend) openSemRounds.enrolledPaid.pending++;
                else if (isNoAns) openSemRounds.enrolledPaid.noAnswer++;
                else if (isRej) openSemRounds.enrolledPaid.reject++;
            } else if (roundNum >= 3) {
                openSemRounds.nonEnrolled.assigned++;
                if (isAns) openSemRounds.nonEnrolled.answered++;
                else if (isPend) openSemRounds.nonEnrolled.pending++;
                else if (isNoAns) openSemRounds.nonEnrolled.noAnswer++;
                else if (isRej) openSemRounds.nonEnrolled.reject++;
                if (isDelayed) openSemRounds.nonEnrolled.delayed++;
            } else if (roundNum === 2) {
                openSemRounds.round2.assigned++;
                if (isAns) openSemRounds.round2.answered++;
                else if (isPend) openSemRounds.round2.pending++;
                else if (isNoAns) openSemRounds.round2.noAnswer++;
                else if (isRej) openSemRounds.round2.reject++;
                if (isDelayed) openSemRounds.round2.delayed++;
            } else {
                openSemRounds.round1.assigned++;
                if (isAns) openSemRounds.round1.answered++;
                else if (isPend) openSemRounds.round1.pending++;
                else if (isNoAns) openSemRounds.round1.noAnswer++;
                else if (isRej) openSemRounds.round1.reject++;
                if (isDelayed) openSemRounds.round1.delayed++;
            }

            // Coordinator Advanced Stats & Round Breakdown
            if (l.assignedTo && l.assignedUser) {
                const cId = l.assignedUser.id;
                const cName = `${l.assignedUser.firstName} ${l.assignedUser.lastName || ''}`.trim();
                if (!openSemStaffMap[cId]) {
                    openSemStaffMap[cId] = {
                        id: cId,
                        name: cName,
                        role: l.assignedUser.role || 'Coordinator',
                        image: l.assignedUser.image,
                        stream: l.assignedUser.businessType || activeBusiness.category || 'Standard',
                        assigned: 0,
                        answered: 0,
                        noAnswer: 0,
                        pending: 0,
                        reject: 0,
                        delayed: 0,
                        enrolled: 0,
                        rounds: {
                            round1: { assigned: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0, delayed: 0 },
                            round2: { assigned: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0, delayed: 0 },
                            nonEnrolled: { assigned: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0, delayed: 0 },
                            enrolledPaid: { assigned: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0 }
                        }
                    };
                }
                openSemStaffMap[cId].assigned++;
                if (isAns) openSemStaffMap[cId].answered++;
                else if (isNoAns) openSemStaffMap[cId].noAnswer++;
                else if (isRej) openSemStaffMap[cId].reject++;
                else if (isPend) openSemStaffMap[cId].pending++;

                if (isDelayed && isPend) openSemStaffMap[cId].delayed++;
                if (isEnrolled) openSemStaffMap[cId].enrolled++;

                // Coordinator-specific round accumulation
                if (isEnrolled) {
                    openSemStaffMap[cId].rounds.enrolledPaid.assigned++;
                    if (isAns) openSemStaffMap[cId].rounds.enrolledPaid.answered++;
                    else if (isPend) openSemStaffMap[cId].rounds.enrolledPaid.pending++;
                    else if (isNoAns) openSemStaffMap[cId].rounds.enrolledPaid.noAnswer++;
                    else if (isRej) openSemStaffMap[cId].rounds.enrolledPaid.reject++;
                } else if (roundNum >= 3) {
                    openSemStaffMap[cId].rounds.nonEnrolled.assigned++;
                    if (isAns) openSemStaffMap[cId].rounds.nonEnrolled.answered++;
                    else if (isPend) openSemStaffMap[cId].rounds.nonEnrolled.pending++;
                    else if (isNoAns) openSemStaffMap[cId].rounds.nonEnrolled.noAnswer++;
                    else if (isRej) openSemStaffMap[cId].rounds.nonEnrolled.reject++;
                    if (isDelayed) openSemStaffMap[cId].rounds.nonEnrolled.delayed++;
                } else if (roundNum === 2) {
                    openSemStaffMap[cId].rounds.round2.assigned++;
                    if (isAns) openSemStaffMap[cId].rounds.round2.answered++;
                    else if (isPend) openSemStaffMap[cId].rounds.round2.pending++;
                    else if (isNoAns) openSemStaffMap[cId].rounds.round2.noAnswer++;
                    else if (isRej) openSemStaffMap[cId].rounds.round2.reject++;
                    if (isDelayed) openSemStaffMap[cId].rounds.round2.delayed++;
                } else {
                    openSemStaffMap[cId].rounds.round1.assigned++;
                    if (isAns) openSemStaffMap[cId].rounds.round1.answered++;
                    else if (isPend) openSemStaffMap[cId].rounds.round1.pending++;
                    else if (isNoAns) openSemStaffMap[cId].rounds.round1.noAnswer++;
                    else if (isRej) openSemStaffMap[cId].rounds.round1.reject++;
                    if (isDelayed) openSemStaffMap[cId].rounds.round1.delayed++;
                }
            }
        });

        const targetIndividualGoal = activeBusiness.batches[0]?.targetIndividualGoal ?? 40;
        const targetGroupGoal = activeBusiness.batches[0]?.targetGroupGoal ?? 50;

        const openSemStaffList = Object.values(openSemStaffMap).map(c => {
            const reqCount = Math.floor(c.assigned * (targetIndividualGoal / 100));
            const targetNeed = Math.max(0, reqCount - c.enrolled);
            let conversionRate = c.assigned > 0 ? Math.round((c.enrolled / c.assigned) * 100) : 0;
            if (targetNeed === 0 && c.enrolled > 0 && targetIndividualGoal > conversionRate) {
                conversionRate = targetIndividualGoal;
            }
            return {
                ...c,
                conversionRate,
                targetNeed,
                goalAchievedPct: targetNeed === 0 ? 100 : Math.min(100, Math.round((c.enrolled / (reqCount || 1)) * 100))
            };
        }).sort((a, b) => b.enrolled - a.enrolled);

        // B. New Inquiries Leads
        const newInqLeads = afterSemLeads.filter(l => l.inquiryType === 'NEW_INQ' && l.source !== 'bridge_transfer');
        let newInqTotal = newInqLeads.length;
        let newInqAssigned = 0;
        let newInqContacted = 0;
        let newInqPending = 0;
        let newInqAnswered = 0;
        let newInqNoAnswer = 0;
        let newInqReject = 0;
        let newInqDelayed = 0;
        let newInqEnrolled = 0;

        let newInqPlanFull = 0;
        let newInqPlanUpgrade = 0;
        let newInqPlanMonthly = 0;
        let newInqPlanInstallments = 0;

        const newInqRounds = {
            round1: { assigned: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0, delayed: 0 },
            round2: { assigned: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0, delayed: 0 },
            nonEnrolled: { assigned: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0, delayed: 0 },
            enrolledPaid: { assigned: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0 }
        };

        const newInqStaffMap = {};

        newInqLeads.forEach(l => {
            if (l.assignedTo) newInqAssigned++;
            const cleanPhone = (l.phone || '').replace(/[^0-9]/g, '').slice(-7);
            const isEnrolled = l.enrollmentStatus === 'ENROLLED' || l.enrollmentStatus === 'PAID' || verifiedPhoneSet.has(cleanPhone);
            if (isEnrolled) newInqEnrolled++;

            const status = (l.newInqCallStatus || 'pending').toLowerCase();
            const isPend = status === 'pending';
            const isAns = status === 'answered';
            const isNoAns = status === 'no_answer';
            const isRej = status === 'reject';
            const isDelayed = (l.r1DelayedDays > 0 || l.r2DelayedDays > 0 || isPend);

            if (isAns) newInqAnswered++;
            else if (isNoAns) newInqNoAnswer++;
            else if (isRej) newInqReject++;
            else if (isPend) newInqPending++;

            if (!isPend) newInqContacted++;
            if (isDelayed && isPend) newInqDelayed++;

            const payIntention = (l.paymentIntention || '').toUpperCase();
            if (payIntention === 'FULL' || l.enrollmentStatus === 'FULL') newInqPlanFull++;
            else if (payIntention === 'UPGRADE' || l.enrollmentStatus === 'UPGRADE') newInqPlanUpgrade++;
            else if (payIntention === 'MONTHLY' || l.enrollmentStatus === 'MONTHLY') newInqPlanMonthly++;
            else if (payIntention === 'INSTALLMENTS' || payIntention === 'INSTALLMENT' || l.enrollmentStatus === 'INSTALLMENT') newInqPlanInstallments++;

            const roundNum = l.openSemRound || 1;
            if (isEnrolled) {
                newInqRounds.enrolledPaid.assigned++;
                if (isAns) newInqRounds.enrolledPaid.answered++;
                else if (isPend) newInqRounds.enrolledPaid.pending++;
                else if (isNoAns) newInqRounds.enrolledPaid.noAnswer++;
                else if (isRej) newInqRounds.enrolledPaid.reject++;
            } else if (roundNum >= 3) {
                newInqRounds.nonEnrolled.assigned++;
                if (isAns) newInqRounds.nonEnrolled.answered++;
                else if (isPend) newInqRounds.nonEnrolled.pending++;
                else if (isNoAns) newInqRounds.nonEnrolled.noAnswer++;
                else if (isRej) newInqRounds.nonEnrolled.reject++;
                if (isDelayed) newInqRounds.nonEnrolled.delayed++;
            } else if (roundNum === 2) {
                newInqRounds.round2.assigned++;
                if (isAns) newInqRounds.round2.answered++;
                else if (isPend) newInqRounds.round2.pending++;
                else if (isNoAns) newInqRounds.round2.noAnswer++;
                else if (isRej) newInqRounds.round2.reject++;
                if (isDelayed) newInqRounds.round2.delayed++;
            } else {
                newInqRounds.round1.assigned++;
                if (isAns) newInqRounds.round1.answered++;
                else if (isPend) newInqRounds.round1.pending++;
                else if (isNoAns) newInqRounds.round1.noAnswer++;
                else if (isRej) newInqRounds.round1.reject++;
                if (isDelayed) newInqRounds.round1.delayed++;
            }

            if (l.assignedTo && l.assignedUser) {
                const cId = l.assignedUser.id;
                const cName = `${l.assignedUser.firstName} ${l.assignedUser.lastName || ''}`.trim();
                if (!newInqStaffMap[cId]) {
                    newInqStaffMap[cId] = {
                        id: cId,
                        name: cName,
                        role: l.assignedUser.role || 'Coordinator',
                        image: l.assignedUser.image,
                        stream: l.assignedUser.businessType || activeBusiness.category || 'Standard',
                        assigned: 0,
                        answered: 0,
                        noAnswer: 0,
                        pending: 0,
                        reject: 0,
                        delayed: 0,
                        enrolled: 0,
                        rounds: {
                            round1: { assigned: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0, delayed: 0 },
                            round2: { assigned: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0, delayed: 0 },
                            nonEnrolled: { assigned: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0, delayed: 0 },
                            enrolledPaid: { assigned: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0 }
                        }
                    };
                }
                newInqStaffMap[cId].assigned++;
                if (isAns) newInqStaffMap[cId].answered++;
                else if (isNoAns) newInqStaffMap[cId].noAnswer++;
                else if (isRej) newInqStaffMap[cId].reject++;
                else if (isPend) newInqStaffMap[cId].pending++;
                if (isDelayed && isPend) newInqStaffMap[cId].delayed++;
                if (isEnrolled) newInqStaffMap[cId].enrolled++;

                // Coordinator-specific round accumulation for New Inq
                if (isEnrolled) {
                    newInqStaffMap[cId].rounds.enrolledPaid.assigned++;
                    if (isAns) newInqStaffMap[cId].rounds.enrolledPaid.answered++;
                    else if (isPend) newInqStaffMap[cId].rounds.enrolledPaid.pending++;
                    else if (isNoAns) newInqStaffMap[cId].rounds.enrolledPaid.noAnswer++;
                    else if (isRej) newInqStaffMap[cId].rounds.enrolledPaid.reject++;
                } else if (roundNum >= 3) {
                    newInqStaffMap[cId].rounds.nonEnrolled.assigned++;
                    if (isAns) newInqStaffMap[cId].rounds.nonEnrolled.answered++;
                    else if (isPend) newInqStaffMap[cId].rounds.nonEnrolled.pending++;
                    else if (isNoAns) newInqStaffMap[cId].rounds.nonEnrolled.noAnswer++;
                    else if (isRej) newInqStaffMap[cId].rounds.nonEnrolled.reject++;
                    if (isDelayed) newInqStaffMap[cId].rounds.nonEnrolled.delayed++;
                } else if (roundNum === 2) {
                    newInqStaffMap[cId].rounds.round2.assigned++;
                    if (isAns) newInqStaffMap[cId].rounds.round2.answered++;
                    else if (isPend) newInqStaffMap[cId].rounds.round2.pending++;
                    else if (isNoAns) newInqStaffMap[cId].rounds.round2.noAnswer++;
                    else if (isRej) newInqStaffMap[cId].rounds.round2.reject++;
                    if (isDelayed) newInqStaffMap[cId].rounds.round2.delayed++;
                } else {
                    newInqStaffMap[cId].rounds.round1.assigned++;
                    if (isAns) newInqStaffMap[cId].rounds.round1.answered++;
                    else if (isPend) newInqStaffMap[cId].rounds.round1.pending++;
                    else if (isNoAns) newInqStaffMap[cId].rounds.round1.noAnswer++;
                    else if (isRej) newInqStaffMap[cId].rounds.round1.reject++;
                    if (isDelayed) newInqStaffMap[cId].rounds.round1.delayed++;
                }
            }
        });

        const newInqStaffList = Object.values(newInqStaffMap).map(c => {
            const reqCount = Math.floor(c.assigned * (targetIndividualGoal / 100));
            const targetNeed = Math.max(0, reqCount - c.enrolled);
            let conversionRate = c.assigned > 0 ? Math.round((c.enrolled / c.assigned) * 100) : 0;
            if (targetNeed === 0 && c.enrolled > 0 && targetIndividualGoal > conversionRate) {
                conversionRate = targetIndividualGoal;
            }
            return {
                ...c,
                conversionRate,
                targetNeed,
                goalAchievedPct: targetNeed === 0 ? 100 : Math.min(100, Math.round((c.enrolled / (reqCount || 1)) * 100))
            };
        }).sort((a, b) => b.enrolled - a.enrolled);

        // C. Paid Campaign / Retention Leads Breakdown
        const paidCampLeads = afterSemLeads.filter(l => l.inquiryType === 'PAID_CAMP' || l.enrollmentStatus === 'ENROLLED' || l.enrollmentStatus === 'PAID');
        let paidCampTotal = paidCampLeads.length;
        let paidCampContacted = 0;
        let paidCampPending = 0;
        let paidCampAnswered = 0;
        let paidCampNoAnswer = 0;
        let paidCampReject = 0;

        const paidPlans = {
            full: { assigned: 0, covered: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0 },
            monthly: { assigned: 0, covered: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0 },
            installment: { assigned: 0, covered: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0 },
            totalEnrolled: { assigned: 0, covered: 0, answered: 0, pending: 0, noAnswer: 0, reject: 0 }
        };

        paidCampLeads.forEach(l => {
            const status = (l.paidCallStatus || l.callStatus || 'pending').toLowerCase();
            const isAns = status === 'answered';
            const isNoAns = status === 'no_answer';
            const isRej = status === 'reject';
            const isPend = status === 'pending';
            const isCovered = !isPend;

            if (isAns) paidCampAnswered++;
            else if (isNoAns) paidCampNoAnswer++;
            else if (isRej) paidCampReject++;
            else if (isPend) paidCampPending++;

            if (isCovered) paidCampContacted++;

            const pInt = (l.paymentIntention || l.enrollmentStatus || '').toUpperCase();
            let targetPlanKey = 'monthly';
            if (pInt === 'FULL') targetPlanKey = 'full';
            else if (pInt === 'INSTALLMENTS' || pInt === 'INSTALLMENT') targetPlanKey = 'installment';

            paidPlans[targetPlanKey].assigned++;
            if (isCovered) paidPlans[targetPlanKey].covered++;
            if (isAns) paidPlans[targetPlanKey].answered++;
            else if (isPend) paidPlans[targetPlanKey].pending++;
            else if (isNoAns) paidPlans[targetPlanKey].noAnswer++;
            else if (isRej) paidPlans[targetPlanKey].reject++;

            // Total Enrolled aggregation
            paidPlans.totalEnrolled.assigned++;
            if (isCovered) paidPlans.totalEnrolled.covered++;
            if (isAns) paidPlans.totalEnrolled.answered++;
            else if (isPend) paidPlans.totalEnrolled.pending++;
            else if (isNoAns) paidPlans.totalEnrolled.noAnswer++;
            else if (isRej) paidPlans.totalEnrolled.reject++;
        });

        // D. Batch Payment Groups & Coordinator Cohort Retention Matrix
        const rawMonthlyGroups = await prisma.group.findMany({
            where: { batchId: { in: targetBatchIds } },
            orderBy: [{ itemOrder: 'asc' }, { id: 'asc' }],
            select: { id: true, name: true, itemOrder: true, batchId: true }
        });

        const monthlyGroups = rawMonthlyGroups.filter(g => 
            !g.name.toLowerCase().includes('full payment') && 
            !g.name.toLowerCase().includes('full')
        );

        const allBatchPayments = await prisma.payment.findMany({
            where: {
                batchId: { in: targetBatchIds },
                status: 1
            },
            select: {
                id: true,
                studentId: true,
                groupId: true,
                payment_type: true,
                created_at: true,
                student: { select: { id: true, phone: true, whatsapp: true } }
            }
        });

        const phoneToCoordMap = new Map();
        afterSemLeads.forEach(l => {
            if (l.assignedUser) {
                const norm = (l.phone || '').split('_')[0].slice(-9);
                phoneToCoordMap.set(norm, l.assignedUser);
            }
        });

        const stuPaymentsMap = new Map();
        const stuCoordMap = new Map();

        allBatchPayments.forEach(p => {
            if (!stuPaymentsMap.has(p.studentId)) stuPaymentsMap.set(p.studentId, new Set());
            stuPaymentsMap.get(p.studentId).add(p.groupId);

            if (!stuCoordMap.has(p.studentId) && p.student) {
                const phoneNorm = (p.student.whatsapp || p.student.phone || '').slice(-9);
                if (phoneToCoordMap.has(phoneNorm)) {
                    stuCoordMap.set(p.studentId, phoneToCoordMap.get(phoneNorm));
                }
            }
        });

        const paymentGroupCohorts = monthlyGroups.map((g, gIdx) => {
            const nextGroups = monthlyGroups.slice(gIdx + 1);

            const paidStudentIds = [];
            stuPaymentsMap.forEach((gSet, stuId) => {
                if (gSet.has(g.id)) paidStudentIds.push(stuId);
            });

            const coordMap = {};

            paidStudentIds.forEach(stuId => {
                const coord = stuCoordMap.get(stuId) || { id: 0, firstName: 'Unassigned', lastName: '', image: null };
                const cName = `${coord.firstName} ${coord.lastName || ''}`.trim();

                if (!coordMap[cName]) {
                    coordMap[cName] = {
                        coordinatorId: coord.id,
                        coordinatorName: cName,
                        image: coord.image,
                        paidCount: 0,
                        nextMonthPaid: 0,
                        droppedInNext: 0,
                        recoveredLater: 0,
                        recoveredDetails: {}
                    };
                }

                coordMap[cName].paidCount++;

                if (nextGroups.length > 0) {
                    const nextG = nextGroups[0];
                    const hasNext = stuPaymentsMap.get(stuId).has(nextG.id);
                    if (hasNext) {
                        coordMap[cName].nextMonthPaid++;
                    } else {
                        coordMap[cName].droppedInNext++;
                        const laterGroups = nextGroups.slice(1);
                        const recG = laterGroups.find(lg => stuPaymentsMap.get(stuId).has(lg.id));
                        if (recG) {
                            coordMap[cName].recoveredLater++;
                            const cleanGName = recG.name.replace('Monthly Payment - ', '').trim();
                            coordMap[cName].recoveredDetails[cleanGName] = (coordMap[cName].recoveredDetails[cleanGName] || 0) + 1;
                        }
                    }
                }
            });

            const coordinatorList = Object.values(coordMap).map(c => ({
                ...c,
                retentionRate: c.paidCount > 0 ? Math.round((c.nextMonthPaid / c.paidCount) * 100) : 0,
                recoveryRate: c.droppedInNext > 0 ? Math.round((c.recoveredLater / c.droppedInNext) * 100) : 0
            })).sort((a, b) => b.paidCount - a.paidCount);

            return {
                groupId: g.id,
                groupName: g.name,
                totalPaidStudents: paidStudentIds.length,
                nextGroupName: nextGroups[0]?.name || null,
                coordinators: coordinatorList
            };
        });

        // E. Bridge Transfers
        const bridgeLeads = afterSemLeads.filter(l => l.source === 'bridge_transfer');
        let bridgeTotal = bridgeLeads.length;
        let bridgeEnrolled = bridgeLeads.filter(l => l.enrollmentStatus === 'ENROLLED' || l.enrollmentStatus === 'PAID').length;
        let bridgePending = bridgeLeads.filter(l => (l.callStatus || 'pending') === 'pending').length;

        // -------------------------------------------------------------
        // 4. OVERALL EXECUTIVE SUMMARY & FUNNEL
        // -------------------------------------------------------------
        const totalSystemLeads = allScopedLeads.length;
        const totalCallsMade = freeSemCovered + openSemContacted + newInqContacted + paidCampContacted;
        const totalPendingCalls = freeSemPending + openSemPending + newInqPending + paidCampPending;
        const totalSystemEnrolled = openSemEnrolled + newInqEnrolled + bridgeEnrolled;
        const overallConversionRate = totalSystemLeads > 0 ? Math.round((totalSystemEnrolled / totalSystemLeads) * 100) : 0;

        // -------------------------------------------------------------
        // TASK CENTER & OPERATIONAL INTELLIGENCE AGGREGATION
        // -------------------------------------------------------------
        const taskWhere = {
            parentId: null,
            businessId: parsedBizId
        };
        if (parsedBatchId) {
            taskWhere.OR = [
                { batchId: parsedBatchId },
                { additionalBatchIds: { contains: String(parsedBatchId) } }
            ];
        }
        if (start || end) {
            const dateOr = [];
            if (start && end) {
                dateOr.push({ createdAt: { gte: start, lte: end } });
                dateOr.push({ updatedAt: { gte: start, lte: end } });
            } else if (start) {
                dateOr.push({ createdAt: { gte: start } });
                dateOr.push({ updatedAt: { gte: start } });
            } else if (end) {
                dateOr.push({ createdAt: { lte: end } });
                dateOr.push({ updatedAt: { lte: end } });
            }

            taskWhere.AND = [
                { OR: dateOr }
            ];
        }

        const allTasks = await prisma.task.findMany({
            where: taskWhere,
            include: {
                assignedUser: {
                    select: { id: true, firstName: true, lastName: true, role: true, image: true }
                },
                batch: { select: { id: true, name: true } },
                business: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        const taskCurrentTime = new Date();
        let taskTotal = allTasks.length;
        let taskCompleted = 0;
        let taskInProgress = 0;
        let taskPending = 0;
        let taskLocked = 0;

        const staffTaskMap = new Map();
        const typeTaskMap = new Map();

        allTasks.forEach(t => {
            const isCompleted = t.status === 'COMPLETED';
            const isLocked = t.status === 'LOCKED' || (t.deadline && new Date(t.deadline).getTime() < taskCurrentTime.getTime() && !isCompleted);
            const isInProgress = t.status === 'IN_PROGRESS' && !isLocked;
            const isPending = (t.status === 'PENDING' || !t.status) && !isLocked;

            if (isCompleted) taskCompleted++;
            else if (isLocked) taskLocked++;
            else if (isInProgress) taskInProgress++;
            else taskPending++;

            // Staff breakdown
            const staffId = t.assignedTo || 0;
            const staffName = t.assignedUser ? `${t.assignedUser.firstName} ${t.assignedUser.lastName || ''}`.trim() : 'Unassigned';
            const staffRole = t.assignedUser?.role || 'Staff';
            const staffImage = t.assignedUser?.image || null;

            if (!staffTaskMap.has(staffId)) {
                staffTaskMap.set(staffId, {
                    id: staffId,
                    name: staffName,
                    role: staffRole,
                    image: staffImage,
                    total: 0,
                    completed: 0,
                    inProgress: 0,
                    pending: 0,
                    locked: 0
                });
            }
            const staffStat = staffTaskMap.get(staffId);
            staffStat.total++;
            if (isCompleted) staffStat.completed++;
            else if (isLocked) staffStat.locked++;
            else if (isInProgress) staffStat.inProgress++;
            else staffStat.pending++;

            // Task Type breakdown
            const tType = t.taskType || 'General Task';
            if (!typeTaskMap.has(tType)) {
                typeTaskMap.set(tType, {
                    type: tType,
                    total: 0,
                    completed: 0,
                    inProgress: 0,
                    pending: 0,
                    locked: 0
                });
            }
            const typeStat = typeTaskMap.get(tType);
            typeStat.total++;
            if (isCompleted) typeStat.completed++;
            else if (isLocked) typeStat.locked++;
            else if (isInProgress) typeStat.inProgress++;
            else typeStat.pending++;
        });

        const staffTaskList = Array.from(staffTaskMap.values()).map(s => ({
            ...s,
            completionRate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0
        })).sort((a, b) => b.total - a.total);

        const typeTaskList = Array.from(typeTaskMap.values()).map(t => ({
            ...t,
            completionRate: t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0
        })).sort((a, b) => b.total - a.total);

        const recentTaskList = allTasks.slice(0, 30).map(t => {
            const isCompleted = t.status === 'COMPLETED';
            const isOverdue = t.deadline && new Date(t.deadline).getTime() < taskCurrentTime.getTime() && !isCompleted;
            return {
                id: t.id,
                title: t.customTitle || t.taskType,
                taskType: t.taskType,
                assignedUser: t.assignedUser ? {
                    id: t.assignedUser.id,
                    name: `${t.assignedUser.firstName} ${t.assignedUser.lastName || ''}`.trim(),
                    role: t.assignedUser.role,
                    image: t.assignedUser.image
                } : null,
                batchName: t.batch?.name || null,
                status: isCompleted ? 'COMPLETED' : (isOverdue ? 'LOCKED' : (t.status || 'PENDING')),
                deadline: t.deadline,
                completedAt: t.completedAt,
                proofUrl: t.proofUrl,
                proofType: t.proofType,
                createdAt: t.createdAt
            };
        });

        res.status(200).json(safeJson({
            selectedBusiness: activeBusiness,
            selectedBatch: parsedBatchId ? activeBusiness.batches.find(b => b.id === parsedBatchId) : null,
            businesses: businessesWithSummary,
            overview: {
                totalSystemLeads,
                totalAssignedLeads: freeSemAssigned + openSemAssigned + newInqAssigned,
                totalUnassignedLeads: freeSemUnassigned + (newInqTotal - newInqAssigned) + (openSemTotal - openSemAssigned),
                totalCallsMade,
                totalPendingCalls,
                totalSystemEnrolled,
                overallConversionRate,
                freeSemShare: freeSemTotal,
                afterSemShare: afterSemTotal,
                funnel: [
                    { stage: 'Free Seminar Inflow', count: freeSemTotal, drop: 0 },
                    { stage: 'Open Seminar / Inquiries', count: openSemTotal + newInqTotal, drop: Math.max(0, freeSemTotal - (openSemTotal + newInqTotal)) },
                    { stage: 'Calls Contacted', count: totalCallsMade, drop: Math.max(0, (openSemTotal + newInqTotal) - totalCallsMade) },
                    { stage: 'Enrolled / Paid Students', count: totalSystemEnrolled, drop: Math.max(0, totalCallsMade - totalSystemEnrolled) }
                ]
            },
            freeSeminar: {
                total: freeSemTotal,
                assigned: freeSemAssigned,
                unassigned: freeSemUnassigned,
                callCenterAssigned: freeSemCallCenterAssigned,
                covered: freeSemCovered,
                pending: freeSemPending,
                answered: freeSemAnswered,
                noAnswer: freeSemNoAnswer,
                reject: freeSemReject,
                responseRate: freeSemResponseRate,
                callCenterProgress: {
                    totalAssigned: ccTotal,
                    covered: ccCovered,
                    pending: ccPending,
                    responseRate: ccResponseRate
                },
                coordinators: coordinatorFreeSemList,
                whatsappMessages: {
                    totalSent: totalOutboundMessages,
                    totalReceived: totalInboundMessages,
                    uniqueInboundNumbersCount: totalUniqueInboundNumbers.size,
                    uniqueOutboundNumbersCount: totalUniqueOutboundNumbers.size,
                    staffBreakdown: whatsappStaffList
                }
            },
            afterSeminar: {
                total: afterSemTotal,
                totalCallsMade: openSemContacted + newInqContacted + paidCampContacted,
                totalCallsPending: openSemPending + newInqPending + paidCampPending,
                totalEnrolled: openSemEnrolled + newInqEnrolled + bridgeEnrolled,
                conversionRate: afterSemTotal > 0 ? Math.round(((openSemEnrolled + newInqEnrolled + bridgeEnrolled) / afterSemTotal) * 100) : 0,
                whatsappMessages: {
                    totalSent: totalAfterSemOutboundMsgs,
                    totalReceived: totalAfterSemInboundMsgs,
                    uniqueInboundNumbersCount: totalAfterSemInboundNumbers.size,
                    uniqueOutboundNumbersCount: totalAfterSemOutboundNumbers.size,
                    staffBreakdown: afterSemWhatsappStaffList
                },
                openSeminar: {
                    total: openSemTotal,
                    assigned: openSemAssigned,
                    unassigned: openSemTotal - openSemAssigned,
                    contacted: openSemContacted,
                    pending: openSemPending,
                    answered: openSemAnswered,
                    noAnswer: openSemNoAnswer,
                    reject: openSemReject,
                    delayed: openSemDelayed,
                    enrolled: openSemEnrolled,
                    conversionRate: openSemTotal > 0 ? Math.round((openSemEnrolled / openSemTotal) * 100) : 0,
                    plans: {
                        full: planFull,
                        upgrade: planUpgrade,
                        monthly: planMonthly,
                        installments: planInstallments
                    },
                    historicalDelays: {
                        round1: historicalR1Delays,
                        round2: historicalR2Delays
                    },
                    rounds: openSemRounds,
                    goals: {
                        targetIndividualGoal,
                        targetGroupGoal
                    },
                    coordinators: openSemStaffList
                },
                newInquiries: {
                    total: newInqTotal,
                    assigned: newInqAssigned,
                    unassigned: newInqTotal - newInqAssigned,
                    contacted: newInqContacted,
                    pending: newInqPending,
                    answered: newInqAnswered,
                    noAnswer: newInqNoAnswer,
                    reject: newInqReject,
                    delayed: newInqDelayed,
                    enrolled: newInqEnrolled,
                    conversionRate: newInqTotal > 0 ? Math.round((newInqEnrolled / newInqTotal) * 100) : 0,
                    rounds: newInqRounds,
                    coordinators: newInqStaffList
                },
                paidCampaign: {
                    total: paidCampTotal,
                    contacted: paidCampContacted,
                    pending: paidCampPending,
                    answered: paidCampAnswered,
                    noAnswer: paidCampNoAnswer,
                    reject: paidCampReject,
                    plans: paidPlans,
                    paymentGroups: paymentGroupCohorts
                },
                bridge: {
                    total: bridgeTotal,
                    enrolled: bridgeEnrolled,
                    pending: bridgePending
                }
            },
            taskCenter: {
                total: taskTotal,
                completed: taskCompleted,
                inProgress: taskInProgress,
                pending: taskPending,
                locked: taskLocked,
                completionRate: taskTotal > 0 ? Math.round((taskCompleted / taskTotal) * 100) : 0,
                taskTypes: typeTaskList,
                staffBreakdown: staffTaskList,
                recentTasks: recentTaskList
            }
        }));

    } catch (error) {
        console.error("Executive Analytics Error:", error);
        res.status(500).json({ error: "Failed to generate executive analytics", details: error.message });
    }
};
