const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');
const axios = require('axios');
const fs = require('fs'); 
const path = require('path');
const pdfParse = require('pdf-parse'); 
const ffmpeg = require('fluent-ffmpeg');
const { getAvatarForPhone } = require('../utils/avatarUtils');

// In-memory cache to prevent race conditions on duplicate Meta webhooks
const processingMessages = new Set();
const auditLogService = require('../services/auditLogService');

// Short-term in-memory cache for CRM tab counts (15s TTL to avoid constant heavy table scans)
const leadCountsCache = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [key, val] of leadCountsCache.entries()) {
        if (now - val.timestamp > 30000) {
            leadCountsCache.delete(key);
        }
    }
}, 30000);


// ==========================================
// 1. SETTINGS & CRM SETUP 
// ==========================================
exports.saveCrmSettings = async (req, res) => {
    try {
        const { businessId, campaignType, metaApiKey, waId, waNumId, geminiKeys, botMode, openSemActive, batchId, welcomeMessageText, btnAllowText, btnStopText } = req.body;
        if (!businessId || !campaignType) return res.status(400).json({ error: "Missing businessId or campaignType" });
        const existing = await prisma.crmSettings.findFirst({ where: { businessId: parseInt(businessId), campaignType: campaignType } });
        const settingsData = { 
            metaApiKey: metaApiKey || null, 
            waId: waId || null, 
            waNumId: waNumId || null, 
            geminiKeys: geminiKeys || [], 
            botMode: botMode || 'OFF', 
            openSemActive: openSemActive || false, 
            batchId: batchId ? String(batchId) : null,
            welcomeMessageText: welcomeMessageText || null,
            btnAllowText: btnAllowText || null,
            btnStopText: btnStopText || null
        };
        
        if (existing) {
            const updated = await prisma.crmSettings.update({ where: { id: existing.id }, data: settingsData });
            return res.status(200).json({ message: "Settings updated", data: updated });
        } else {
            const created = await prisma.crmSettings.create({ data: { businessId: parseInt(businessId), campaignType: campaignType, ...settingsData } });
            return res.status(201).json({ message: "Settings saved", data: created });
        }
    } catch (error) { res.status(500).json({ error: "Failed to save settings", details: error.message }); }
};

exports.getCrmSettings = async (req, res) => {
    try {
        const { businessId, campaignType } = req.params;
        const settings = await prisma.crmSettings.findFirst({ where: { businessId: parseInt(businessId), campaignType: campaignType } });
        res.status(200).json(settings || {});
    } catch (error) { res.status(500).json({ error: "Failed to get settings" }); }
};

exports.getFollowUpStatus = async (req, res) => {
    try {
        const { businessId } = req.query;
        if(!businessId) return res.status(400).json({ error: "Missing business ID" });
        
        const settings = await prisma.crmSettings.findFirst({ 
            where: { businessId: parseInt(businessId), campaignType: 'AFTER_SEMINAR' } 
        });
        res.status(200).json({ isOn: settings?.botMode === 'AUTO_FOLLOW_UP' });
    } catch (error) { res.status(500).json({ error: "Failed to get follow-up status" }); }
};

exports.toggleFollowUpStatus = async (req, res) => {
    try {
        const { businessId, isOn } = req.body;
        if(!businessId) return res.status(400).json({ error: "Missing business ID" });
        
        const settings = await prisma.crmSettings.findFirst({ 
            where: { businessId: parseInt(businessId), campaignType: 'AFTER_SEMINAR' } 
        });

        if (settings) {
            await prisma.crmSettings.update({
                where: { id: settings.id },
                data: { botMode: isOn ? 'AUTO_FOLLOW_UP' : 'OFF' } 
            });
            res.status(200).json({ success: true, message: "Follow-up status updated" });
        } else {
             res.status(404).json({ error: "Settings not found for this business" });
        }
    } catch (error) { res.status(500).json({ error: "Failed to toggle follow-up" }); }
};

exports.getOpenSemStatus = async (req, res) => {
    try {
        const { businessId } = req.query;
        if(!businessId) return res.status(400).json({ error: "Missing business ID" });
        
        const settings = await prisma.crmSettings.findFirst({ 
            where: { businessId: parseInt(businessId), campaignType: 'AFTER_SEMINAR' } 
        });
        res.status(200).json({ isOn: settings?.openSemActive || false });
    } catch (error) { res.status(500).json({ error: "Failed to get open sem status" }); }
};

exports.toggleOpenSemStatus = async (req, res) => {
    try {
        const { businessId, isOn } = req.body;
        if(!businessId) return res.status(400).json({ error: "Missing business ID" });
        
        const settings = await prisma.crmSettings.findFirst({ 
            where: { businessId: parseInt(businessId), campaignType: 'AFTER_SEMINAR' } 
        });

        if (settings) {
            await prisma.crmSettings.update({
                where: { id: settings.id },
                data: { openSemActive: isOn } 
            });
            res.status(200).json({ success: true, message: "Open sem status updated" });
        } else {
             res.status(404).json({ error: "Settings not found for this business" });
        }
    } catch (error) { res.status(500).json({ error: "Failed to toggle open sem" }); }
};

// ==========================================
// 🔒 CAMPAIGN LOCK / UNLOCK SYSTEM
// ==========================================
const getOpenSemLockKey = (batchId) => `OPEN_SEMINAR_LOCKED_BATCH_${batchId}`;

const isOpenSeminarLocked = async (batchId) => {
    if (!batchId) return false;
    try {
        const setting = await prisma.appSetting.findUnique({ where: { key: getOpenSemLockKey(batchId) } });
        return setting?.value === 'true';
    } catch (e) {
        console.error("isOpenSeminarLocked check error:", e);
        return false;
    }
};
exports.isOpenSeminarLocked = isOpenSeminarLocked;

exports.getCampaignLockStatus = async (req, res) => {
    try {
        const { batchId } = req.query;
        if (batchId && batchId !== 'ALL' && batchId !== '') {
            const isLocked = await isOpenSeminarLocked(parseInt(batchId));
            return res.status(200).json({ isLocked, batchId: parseInt(batchId) });
        }
        
        // Return all locked batch IDs and map
        const lockedSettings = await prisma.appSetting.findMany({
            where: {
                key: { startsWith: 'OPEN_SEMINAR_LOCKED_BATCH_' },
                value: 'true'
            }
        });
        const lockedBatchIds = lockedSettings.map(s => {
            const parts = s.key.split('_');
            return parseInt(parts[parts.length - 1]);
        }).filter(id => !isNaN(id));

        const lockedMap = {};
        lockedBatchIds.forEach(id => { lockedMap[id] = true; });

        return res.status(200).json({ lockedBatchIds, lockedMap });
    } catch (error) { 
        console.error("getCampaignLockStatus error:", error);
        res.status(500).json({ error: "Failed to get campaign lock status" }); 
    }
};

exports.toggleCampaignLock = async (req, res) => {
    try {
        const { batchId, isLocked } = req.body;
        if (!batchId || batchId === 'ALL') {
            return res.status(400).json({ error: "Please specify a valid Batch ID to lock/unlock" });
        }

        const userRole = (req.user?.role || '').toUpperCase().replace(/[\s_-]+/g, '_');
        const allowedRoles = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DIRECTOR', 'ADMIN', 'HEAD_MANAGER', 'ASSISTANT_MANAGER', 'MANAGER'];
        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({ error: "Only Managers and Super Admins can lock or unlock campaigns." });
        }

        const bId = parseInt(batchId);
        const key = getOpenSemLockKey(bId);
        await prisma.appSetting.upsert({
            where: { key },
            update: { value: isLocked ? 'true' : 'false' },
            create: { key, value: isLocked ? 'true' : 'false' }
        });

        const batch = await prisma.batch.findUnique({ where: { id: bId }, select: { name: true } });

        return res.status(200).json({ 
            success: true, 
            batchId: bId, 
            batchName: batch?.name || `Batch ${bId}`,
            isLocked: Boolean(isLocked), 
            message: `Opening Seminar Campaign for ${batch?.name || `Batch ${bId}`} is now ${isLocked ? 'LOCKED' : 'UNLOCKED'}.` 
        });
    } catch (error) { 
        console.error("toggleCampaignLock error:", error);
        res.status(500).json({ error: "Failed to toggle campaign lock" }); 
    }
};

// Cached helper function to calculate tab counts (15s TTL)
async function getAfterSemCounts(businessId, batchId, isManager, userId, excludeColdBridge) {
    const countCacheKey = `${businessId || 'all'}_${batchId || 'all'}_${isManager ? 'mgr' : userId}_${excludeColdBridge || 'f'}`;
    const cached = leadCountsCache.get(countCacheKey);
    if (cached && (Date.now() - cached.timestamp < 15000)) {
        return cached;
    }

    let countWhere = { campaignType: 'AFTER_SEMINAR', source: { not: 'system' }, AND: [] }; 

    if (businessId && businessId !== '') {
        countWhere.AND.push({
            OR: [
                { phone: { endsWith: `BIZ_${businessId}` } },
                { phone: { endsWith: `BIZ_${businessId}_AS` } },
                { phone: { contains: `BIZ_${businessId}_BATCH_` } },
                { phone: { contains: `BIZ_${businessId}_ROUND_` } },
                { phone: { contains: `BIZ_${businessId}_HISTORY_ROUND_` } }
            ]
        });
    }

    if (excludeColdBridge === 'true') {
        countWhere.AND.push({
            NOT: {
                AND: [
                    { source: 'bridge_transfer' },
                    { lastMessage: null }
                ]
            }
        });
    }

    if (countWhere.AND.length === 0) {
        delete countWhere.AND;
    }

    if (batchId === 'UNASSIGNED') {
        countWhere.batchId = null;
    } else if (batchId && batchId !== '') {
        countWhere.batchId = parseInt(batchId);
    }

    const trueAllLeadsCount = await prisma.lead.count({ where: countWhere });
    const trueAllUnreadCount = await prisma.lead.count({ where: { ...countWhere, unreadCount: { gt: 0 } } });

    let coordinatorCountWhere = { ...countWhere };
    if (!isManager) {
        if (!coordinatorCountWhere.AND) coordinatorCountWhere.AND = [];
        coordinatorCountWhere.AND = [
            ...(coordinatorCountWhere.AND || []),
            {
                OR: [
                    { assignedTo: null },
                    { assignedTo: parseInt(userId) }
                ]
            }
        ];
    }

    const [
        assignedCount,
        assignedUnread,
        importedCount,
        importedUnread,
        openSemCount,
        openSemUnread,
        newInqCount,
        newInqUnread,
        fullCount,
        monthlyCount,
        installmentCount,
        notDecidedCount
    ] = await Promise.all([
        prisma.lead.count({ where: { ...coordinatorCountWhere, assignedTo: { not: null } } }),
        prisma.lead.count({ where: { ...coordinatorCountWhere, assignedTo: { not: null }, unreadCount: { gt: 0 } } }),
        prisma.lead.count({ where: { ...coordinatorCountWhere, assignedTo: isManager ? null : parseInt(userId), source: { in: ['import', 'bulk_import'] } } }),
        prisma.lead.count({ where: { ...coordinatorCountWhere, assignedTo: isManager ? null : parseInt(userId), source: { in: ['import', 'bulk_import'] }, unreadCount: { gt: 0 } } }),
        prisma.lead.count({ where: { ...coordinatorCountWhere, assignedTo: isManager ? null : parseInt(userId), source: { notIn: ['import', 'bulk_import'] }, inquiryType: { in: ['OPEN_SEMINAR', 'NORMAL'] } } }),
        prisma.lead.count({ where: { ...coordinatorCountWhere, assignedTo: isManager ? null : parseInt(userId), source: { notIn: ['import', 'bulk_import'] }, inquiryType: { in: ['OPEN_SEMINAR', 'NORMAL'] }, unreadCount: { gt: 0 } } }),
        prisma.lead.count({ where: { ...coordinatorCountWhere, assignedTo: isManager ? null : parseInt(userId), source: { notIn: ['import', 'bulk_import'] }, inquiryType: 'NEW_INQ' } }),
        prisma.lead.count({ where: { ...coordinatorCountWhere, assignedTo: isManager ? null : parseInt(userId), source: { notIn: ['import', 'bulk_import'] }, inquiryType: 'NEW_INQ', unreadCount: { gt: 0 } } }),
        prisma.lead.count({ where: { ...coordinatorCountWhere, paymentIntention: 'FULL' } }),
        prisma.lead.count({ where: { ...coordinatorCountWhere, paymentIntention: 'MONTHLY' } }),
        prisma.lead.count({ where: { ...coordinatorCountWhere, paymentIntention: 'INSTALLMENT' } }),
        prisma.lead.count({ where: { ...coordinatorCountWhere, paymentIntention: 'NOT_DECIDED' } })
    ]);

    const counts = { 
        ALL: trueAllLeadsCount,
        ASSIGNED: assignedCount, 
        IMPORTED: importedCount, 
        NEW: openSemCount + newInqCount, 
        NEW_INQ: newInqCount, 
        OPEN_SEMINAR: openSemCount,
        FULL: fullCount, 
        MONTHLY: monthlyCount, 
        INSTALLMENT: installmentCount, 
        NOT_DECIDED: notDecidedCount 
    };

    const unreadCounts = { 
        ALL: trueAllUnreadCount,
        ASSIGNED: assignedUnread,
        IMPORTED: importedUnread,
        NEW: openSemUnread + newInqUnread, 
        NEW_INQ: newInqUnread, 
        OPEN_SEMINAR: openSemUnread
    };
    const totalUnread = trueAllUnreadCount;

    const result = {
        timestamp: Date.now(),
        counts,
        unreadCounts,
        totalUnread,
        trueAllLeadsCount,
        trueAllUnreadCount
    };

    leadCountsCache.set(countCacheKey, result);
    return result;
}

// ==========================================
// 2. LEAD FETCHING (WITH AUTO-SYNC ENGINE)
// ==========================================
exports.getLeads = async (req, res) => {

    try {
        const userId = req.user?.id || req.query.loggedUserId || 1;
        const userRoleRaw = req.user?.role || req.query.loggedUserRole || 'STAFF'; 
        const userRole = String(userRoleRaw).toUpperCase().replace(/ /g, '_');

        const { tab, subTab, staffPhase, status, staffId, batchId, businessId, paymentGroup, enrollmentStatus, inquiryType, round, phase, excludeColdBridge, searchQuery, page, limit, unassignedOnly, source } = req.query; 
        const isManager = ['SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER', 'ASS_MANAGER'].includes(userRole);

        let whereClause = { campaignType: 'AFTER_SEMINAR', source: { not: 'system' }, isBlocked: false, status: { not: 'BLOCKED' }, AND: [] };

        if (source && source !== '') {
            whereClause.source = source;
        }

        if (businessId && businessId !== '') {
            whereClause.AND.push({
                OR: [
                    { phone: { endsWith: `BIZ_${businessId}` } },
                    { phone: { endsWith: `BIZ_${businessId}_AS` } },
                    { phone: { contains: `BIZ_${businessId}_BATCH_` } },
                    { phone: { contains: `BIZ_${businessId}_ROUND_` } },
                    { phone: { contains: `BIZ_${businessId}_HISTORY_ROUND_` } }
                ]
            });
        }

        if (searchQuery && searchQuery.trim() !== '') {
            const q = searchQuery.trim();
            whereClause.AND.push({
                OR: [
                    { phone: { contains: q } },
                    { name: { contains: q } }
                ]
            });
        }

        if (excludeColdBridge === 'true') {
            whereClause.AND.push({
                NOT: {
                    AND: [
                        { source: 'bridge_transfer' },
                        { lastMessage: null }
                    ]
                }
            });
        }

        if (whereClause.AND.length === 0) {
            delete whereClause.AND;
        }

        if (batchId === 'UNASSIGNED') {
            whereClause.batchId = null;
        } else if (batchId && batchId !== '') {
            whereClause.batchId = parseInt(batchId);
        }
        if (paymentGroup && paymentGroup !== '') whereClause.paymentIntention = paymentGroup;
        if (enrollmentStatus && enrollmentStatus !== '') whereClause.enrollmentStatus = enrollmentStatus;
        if (inquiryType && inquiryType !== '') {
            if (inquiryType.includes(',')) {
                whereClause.inquiryType = { in: inquiryType.split(',') };
            } else {
                whereClause.inquiryType = inquiryType; 
            }
        }

        if (tab === 'NEW') {
            if (isManager) whereClause.assignedTo = null; 
            else whereClause.assignedTo = parseInt(userId);

            if (subTab) {
                if (subTab.includes(',')) {
                    whereClause.inquiryType = { in: subTab.split(',') };
                } else if (subTab === 'OPEN_SEMINAR') {
                    whereClause.inquiryType = { in: ['OPEN_SEMINAR', 'NORMAL'] };
                } else {
                    whereClause.inquiryType = subTab;
                }
            }
        } else if (tab === 'ASSIGNED') {
            whereClause.assignedTo = { not: null }; 
            
            // 1. Staff Filter
            if (staffId && staffId !== '') whereClause.assignedTo = parseInt(staffId);
            else if (!isManager) whereClause.assignedTo = parseInt(userId);
            
            // 2. Status Filter
            if (status && status !== '') whereClause.callStatus = status;
            
            // 3. Round Filter
            if (round && round !== '') {
                const parsedRound = parseInt(round);
                const isOpenseminar = subTab === 'OPEN_SEMINAR' || inquiryType?.includes('OPEN_SEMINAR') || inquiryType === 'OPEN_SEMINAR';
                
                if (isOpenseminar) {
                    const fourteenDaysAgo = new Date();
                    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

                    if (parsedRound === 3) {
                        whereClause.AND = whereClause.AND || [];
                        whereClause.AND.push({
                            OR: [
                                { openSemRound: 3 },
                                {
                                    assignedAt: { lte: fourteenDaysAgo },
                                    enrollmentStatus: { not: 'ENROLLED' }
                                }
                            ]
                        });
                    } else {
                        whereClause.openSemRound = parsedRound;
                        whereClause.AND = whereClause.AND || [];
                        whereClause.AND.push({
                            OR: [
                                { assignedAt: { gt: fourteenDaysAgo } },
                                { assignedAt: null } // Fallback for old leads
                            ]
                        });
                    }
                } else {
                    whereClause.coordinationRound = parsedRound;
                }
            }
            
            // 4. Phase Filter
            if (phase && phase !== '') {
                whereClause.phase = parseInt(phase);
            } else if (staffPhase && staffPhase !== '') {
                whereClause.phase = parseInt(staffPhase);
            }
        } else if (tab === 'ALL' && String(unassignedOnly) === 'true') {
            whereClause.assignedTo = null;
        }

        const pageNum = page ? parseInt(page) : 1;
        const limitNum = limit ? parseInt(limit) : 50;
        const skipNum = (pageNum - 1) * limitNum;

        if (req.query.fetchAllIds === 'true') {
            const allIds = await prisma.lead.findMany({
                where: whereClause,
                select: { id: true }
            });
            return res.status(200).json({ ids: allIds.map(a => a.id) });
        }

        // 🔥 UNREAD FIRST (Ordered by latest message), THEN READ LEADS 🔥
        const unreadTotal = await prisma.lead.count({
            where: { ...whereClause, unreadCount: { gt: 0 } }
        });

        const leadInclude = { 
            assignedUser: { select: { firstName: true, lastName: true, businessType: true } }, 
            batch: { select: { id: true, name: true, businessId: true } },
            roundProgress: true
        };

        const leadOrderBy = [ { lastMessageAt: 'desc' }, { updatedAt: 'desc' } ];

        let leads = [];
        if (skipNum < unreadTotal) {
            const unreadTake = Math.min(limitNum, unreadTotal - skipNum);
            const unreadLeads = await prisma.lead.findMany({
                where: { ...whereClause, unreadCount: { gt: 0 } },
                orderBy: leadOrderBy,
                include: leadInclude,
                skip: skipNum,
                take: unreadTake
            });
            leads.push(...unreadLeads);

            const remainingLimit = limitNum - leads.length;
            if (remainingLimit > 0) {
                const readLeads = await prisma.lead.findMany({
                    where: { ...whereClause, unreadCount: 0 },
                    orderBy: leadOrderBy,
                    include: leadInclude,
                    skip: 0,
                    take: remainingLimit
                });
                leads.push(...readLeads);
            }
        } else {
            const readSkip = skipNum - unreadTotal;
            leads = await prisma.lead.findMany({
                where: { ...whereClause, unreadCount: 0 },
                orderBy: leadOrderBy,
                include: leadInclude,
                skip: readSkip,
                take: limitNum
            });
        }

        const countData = await getAfterSemCounts(businessId, batchId, isManager, userId, excludeColdBridge);
        const counts = { ...countData.counts };
        const unreadCounts = { ...countData.unreadCounts };
        let totalUnread = countData.totalUnread;

        const hasCustomFilter = Boolean((searchQuery && searchQuery.trim() !== '') || round || paymentGroup || staffId || (unassignedOnly && unassignedOnly !== 'false') || status);

        let totalMatching = 0;
        let totalUnreadMatching = 0;
        let newInqMatching = 0;
        let openSemMatching = 0;
        let newInqUnreadMatching = 0;
        let openSemUnreadMatching = 0;

        if (hasCustomFilter) {
            const [tMatch, tUnreadMatch] = await Promise.all([
                prisma.lead.count({ where: whereClause }),
                prisma.lead.count({ where: { ...whereClause, unreadCount: { gt: 0 } } })
            ]);
            totalMatching = tMatch;
            totalUnreadMatching = tUnreadMatch;

            if (tab === 'NEW' || tab === 'ALL') {
                const baseSubTabWhere = { ...whereClause };
                delete baseSubTabWhere.inquiryType;

                const [newInq, openSem, newInqU, openSemU] = await Promise.all([
                    prisma.lead.count({ where: { ...baseSubTabWhere, inquiryType: 'NEW_INQ' } }),
                    prisma.lead.count({ where: { ...baseSubTabWhere, inquiryType: 'OPEN_SEMINAR' } }),
                    prisma.lead.count({ where: { ...baseSubTabWhere, inquiryType: 'NEW_INQ', unreadCount: { gt: 0 } } }),
                    prisma.lead.count({ where: { ...baseSubTabWhere, inquiryType: 'OPEN_SEMINAR', unreadCount: { gt: 0 } } })
                ]);
                newInqMatching = newInq;
                openSemMatching = openSem;
                newInqUnreadMatching = newInqU;
                openSemUnreadMatching = openSemU;
            }
        } else {
            const tabKey = (tab === 'NEW_INQ' || tab === 'OPEN_SEMINAR') ? tab : (tab || 'ALL');
            totalMatching = counts[tabKey] ?? counts.ALL;
            totalUnreadMatching = unreadCounts[tabKey] ?? unreadCounts.ALL;
            newInqMatching = counts.NEW_INQ;
            openSemMatching = counts.OPEN_SEMINAR;
            newInqUnreadMatching = unreadCounts.NEW_INQ;
            openSemUnreadMatching = unreadCounts.OPEN_SEMINAR;
        }


        let phoneVariants = [];
        leads.forEach(l => {
            if (!l.phone) return;
            const rawPhone = l.phone.split('_')[0].replace(/[^0-9]/g, '');
            if (rawPhone.length >= 9) {
                const suffix = rawPhone.slice(-9);
                phoneVariants.push(`0${suffix}`, `94${suffix}`, `+94${suffix}`, `${suffix}`);
            }
        });
        phoneVariants = [...new Set(phoneVariants)];

        const registeredUsers = await prisma.user.findMany({
            where: {
                OR: [
                    { phone: { in: phoneVariants } },
                    { whatsapp: { in: phoneVariants } }
                ]
            },
            select: { id: true, phone: true, whatsapp: true, firstName: true, lastName: true, optionalPhone: true, image: true, appChatDp: true }
        });

        const regUserIds = registeredUsers.map(u => u.id);
        const userPhoneMap = new Map();
        registeredUsers.forEach(u => {
            userPhoneMap.set(u.id, [u.phone, u.whatsapp, u.optionalPhone]);
        });

        const approvedPayments = regUserIds.length > 0 ? await prisma.payment.findMany({
            where: {
                status: { in: [1, 4] },
                batchId: { not: null },
                studentId: { in: regUserIds }
            },
            select: {
                batchId: true,
                payment_type: true,
                studentId: true
            }
        }) : [];

        // Map: `${batchId}_${suffix7}` -> payment_type
        const approvedBatchPaymentMap = new Map();
        approvedPayments.forEach(p => {
            if (!p.studentId || !p.batchId) return;
            const pPhones = userPhoneMap.get(p.studentId) || [];
            pPhones.forEach(raw => {
                if (!raw) return;
                const cleaned = raw.replace(/[^0-9]/g, '');
                if (cleaned.length >= 7) {
                    approvedBatchPaymentMap.set(`${p.batchId}_${cleaned.slice(-7)}`, p.payment_type);
                }
            });
        });


        const leadsNeedingEnrollmentDbUpdate = [];
        const now = new Date();

        await Promise.all(leads.map(async (l, i) => {
            if (l.phone) {
                const rawPhone = l.phone.split('_')[0].replace(/[^0-9]/g, '');
                if (rawPhone.length >= 7) {
                    const suffix = rawPhone.slice(-9);
                    const rUser = registeredUsers.find(u => {
                        const uP = (u.phone || '').replace(/[^0-9]/g, '');
                        const uW = (u.whatsapp || '').replace(/[^0-9]/g, '');
                        return (uP && (uP.endsWith(suffix) || suffix.endsWith(uP.slice(-9)))) || 
                               (uW && (uW.endsWith(suffix) || suffix.endsWith(uW.slice(-9))));
                    });
                    if (rUser) leads[i].registeredUser = rUser;
                }
            }

            if (['NEW_INQ', 'OPEN_SEMINAR', 'NORMAL'].includes(l.inquiryType)) {
                
                const assignedTime = new Date(l.assignedAt || l.createdAt);
                const assignedDaysPassed = (now - assignedTime) / (1000 * 60 * 60 * 24);

                const referenceTime = new Date(l.newInqTimestamp || l.updatedAt || l.createdAt);
                const hoursPassed = (now - referenceTime) / (1000 * 60 * 60);
                const daysPassed = hoursPassed / 24;

                // 24 Hour Delay Check
                if (hoursPassed >= 24 && l.phase === 1 && (!l.callStatus || l.callStatus === 'pending')) {
                    if (l.inquiryType !== 'NEW_INQ' && l.inquiryType !== 'OPEN_SEMINAR') {
                        leads[i].isLocked = true; 
                    } else {
                        leads[i].isLocked = false;
                    }
                } else {
                    leads[i].isLocked = false;
                }

                // --- NEW CALL CAMPAIGN ROUND LOGIC ---
                if (l.inquiryType === 'OPEN_SEMINAR') {
                    leads[i].isDelayed = false;
                    leads[i].isWaitingForRound2 = false;
                    
                    if (l.enrollmentStatus === 'PAID' || l.enrollmentStatus === 'ENROLLED') {
                        // Bypass all delays and locks if paid/enrolled
                        leads[i].isDelayed = false;
                        leads[i].isLocked = false;
                        leads[i].isWaitingForRound2 = false;
                    } else {
                        // Strict 14-Day Limit
                        if (assignedDaysPassed >= 14) {
                            leads[i].isDelayed = true;
                        }

                        if (l.coordinationRound === 1) {
                            // Round 1 Delay Check (after 7 days)
                            if (assignedDaysPassed >= 7) {
                                leads[i].isDelayed = true;
                            }
                        } else if (l.coordinationRound === 2) {
                            // Round 2 Waiting Rule (starts at 7 days)
                            if (assignedDaysPassed < 7) {
                                leads[i].isWaitingForRound2 = true;
                                leads[i].isLocked = true; // Lock the lead until 7 days have passed
                            } else if (assignedDaysPassed >= 14) {
                                leads[i].isDelayed = true;
                            }
                        }
                    }
                }

                if (l.inquiryType === 'NEW_INQ') {
                    leads[i].isDelayed = false;
                    leads[i].isWaitingForRound2 = false;
                    
                    if (l.enrollmentStatus === 'PAID' || l.enrollmentStatus === 'ENROLLED') {
                        leads[i].isDelayed = false;
                        leads[i].isLocked = false;
                        leads[i].isWaitingForRound2 = false;
                    } else {
                        const assignedTimeNew = new Date(l.assignedAt || l.createdAt);
                        const assignedDaysPassedNew = (now - assignedTimeNew) / (1000 * 60 * 60 * 24);
                        const hoursPassedNew = assignedDaysPassedNew * 24;

                        if (l.coordinationRound === 1) {
                            if (hoursPassedNew >= 24 && (!l.callStatus || l.callStatus === 'pending')) {
                                leads[i].isDelayed = true;
                            }
                        } else if (l.coordinationRound === 2) {
                            if (assignedDaysPassedNew < 6) {
                                leads[i].isWaitingForRound2 = true;
                                leads[i].isLocked = true;
                            } else {
                                const round2HoursPassed = (assignedDaysPassedNew - 6) * 24;
                                if (round2HoursPassed >= 24 && (!l.callStatus || l.callStatus === 'pending')) {
                                    leads[i].isDelayed = true;
                                }
                            }
                        }
                    }
                }

                // Legacy checks
                if (daysPassed >= 5) leads[i].needs5DayCall = true; 
                else leads[i].needs5DayCall = false;

                if (daysPassed >= 10 && l.enrollmentStatus === 'NON_ENROLLED') leads[i].needs10DayCall = true; 
                else leads[i].needs10DayCall = false;
            }

            // Real-time batch-level payment verification
            if (l.batchId && l.phone) {
                const rawP = l.phone.split('_')[0].replace(/[^0-9]/g, '');
                if (rawP.length >= 7) {
                    const suffix7 = rawP.slice(-7);
                    const approvedPType = approvedBatchPaymentMap.get(`${l.batchId}_${suffix7}`);
                    if (approvedPType) {
                        const actualIntention = approvedPType === 3 ? 'FULL' : approvedPType === 2 ? 'INSTALLMENT' : 'MONTHLY';
                        leads[i].enrollmentStatus = 'ENROLLED';
                        leads[i].paymentIntention = actualIntention;
                        leads[i].isLocked = false;
                        if (l.enrollmentStatus !== 'ENROLLED') {
                            leadsNeedingEnrollmentDbUpdate.push(l.id);
                        }
                    }
                }
            }

            leads[i].rawPhone = l.phone;
            leads[i].businessId = l.batch?.businessId || (l.phone && l.phone.includes('_BIZ_') ? parseInt(l.phone.split('_BIZ_')[1]?.split('_')[0]) : null);
            leads[i].phone = l.phone ? l.phone.split('_BIZ')[0] : '';
            const userImg = leads[i].registeredUser?.image;
            const hasCustomImg = userImg && userImg !== 'default.png' && userImg !== 'null' && String(userImg).trim() !== '';
            leads[i].avatar = hasCustomImg ? userImg : (leads[i].registeredUser?.appChatDp ? `chat_dps/${leads[i].registeredUser.appChatDp}` : getAvatarForPhone(l.phone).imagePath);
            leads[i].image = userImg || null;
        }));

        // Display only (see crm module): writing ENROLLED here undid the monthly reset.

        // Map the correct campaign fields back to the base properties for frontend compatibility
        const mappedLeads = leads.map(l => {
            const isNewInq = tab === 'NEW' ? req.query.subTab === 'NEW_INQ' : req.query.inquiryType?.includes('NEW_INQ');
            const isOpenSem = tab === 'NEW' ? req.query.subTab === 'OPEN_SEMINAR' : req.query.inquiryType?.includes('OPEN_SEMINAR');
            
            if (isOpenSem || l.inquiryType === 'OPEN_SEMINAR') {
                const assignedTime = l.assignedAt ? new Date(l.assignedAt).getTime() : new Date(l.createdAt).getTime();
                const nowTime = new Date().getTime();
                const totalDaysSinceAssign = Math.floor((nowTime - assignedTime) / (1000 * 60 * 60 * 24));
                
                let round = l.openSemRound || 1;
                let locked = false;
                let unlocksInDays = 0;
                let finalCallStatus = l.openSemCallStatus || 'pending';
                let finalPhase = l.openSemPhase || 1;
                
                // Auto move to Non-Enrolled if 14 days passed and not PAID
                if (totalDaysSinceAssign >= 14 && l.enrollmentStatus !== 'ENROLLED') {
                    round = 3; 
                } 
                // Round 2 Freeze Logic
                else if (round === 2) {
                    if (totalDaysSinceAssign < 7) {
                        locked = true;
                        unlocksInDays = 7 - totalDaysSinceAssign;
                    } else {
                        // After 7 days, it unlocks as a fresh lead!
                        // If it hasn't been updated yet (is still pending from the auto-move)
                        // It's naturally pending. If it was updated, it's not.
                    }
                }

                // Extract Round 1 feedback from history if available
                let r1Feedback = '';
                if (round > 1 && l.roundProgress && Array.isArray(l.roundProgress)) {
                    const r1 = l.roundProgress.find(r => r.roundNum === 1 && (r.campaignCategory === 'OPEN_SEMINAR' || r.campaignCategory === 'OPEN_SEM'));
                    if (r1) r1Feedback = r1.feedback || '';
                }

                return {
                    ...l,
                    phase: finalPhase,
                    callStatus: finalCallStatus,
                    coordinationRound: round,
                    feedback: finalCallStatus === 'pending' ? '' : (l.openSemFeedback || ''),
                    r1Feedback: r1Feedback,
                    locked: locked,
                    unlocksInDays: unlocksInDays,
                    callMethod: l.openSemCallMethod || null,
                    callAttempt: l.openSemCallAttempt || 1
                };
            }
            if (isNewInq || l.inquiryType === 'NEW_INQ') {
                return {
                    ...l,
                    phase: l.newInqPhase || 1,
                    callStatus: l.newInqCallStatus || 'pending',
                    coordinationRound: l.newInqRound || 1,
                    feedback: (l.newInqCallStatus === 'pending') ? '' : (l.newInqFeedback || ''),
                    callMethod: l.newInqCallMethod || null,
                    callAttempt: l.newInqCallAttempt || 1
                };
            }
            return l;
        });
        if (String(unassignedOnly) === 'true') {
            counts.ALL = totalMatching;
        }

        res.status(200).json({ leads: mappedLeads, counts, unreadCounts, totalUnread, totalMatching, totalUnreadMatching, newInqMatching, openSemMatching, newInqUnreadMatching, openSemUnreadMatching });

    } catch (error) { 
        console.error("Auto Sync Engine Error:", error);
        res.status(500).json({ error: "Failed to fetch leads" }); 
    }
};

// ==========================================
// 3. IMPORT, BULK ACTIONS & ASSIGN
// ==========================================
const { normalizePhone } = require('../utils/phoneUtils');

exports.importLead = async (req, res) => {
    try {
        const { name, number, isBulk, leadsList, batchId, businessId, inquiryType } = req.body;
        
        const userId = req.user?.id;
        const userRoleRaw = req.user?.role || '';
        const userRole = userRoleRaw.toUpperCase().replace(/ /g, '_');
        
        const isManager = ['SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER', 'ASS_MANAGER'].includes(userRole);
        const assignedTo = isManager ? null : parseInt(userId);
        
        const parsedBatchId = batchId ? parseInt(batchId) : null;
        const parsedBusinessId = businessId ? parseInt(businessId) : null;

        if (!parsedBusinessId) return res.status(400).json({ error: "Business ID is required." });

        const targetInquiryType = inquiryType || 'OPEN_SEMINAR';

        if (targetInquiryType === 'OPEN_SEMINAR' || targetInquiryType === 'NORMAL') {
            if (parsedBatchId && await isOpenSeminarLocked(parsedBatchId)) {
                return res.status(403).json({ error: "Opening Seminar campaign for this batch is locked by Management. Cannot import leads to Open Seminar." });
            }
        }

        const baseData = {
            batchId: parsedBatchId, 
            source: isBulk ? 'bulk_import' : 'import', 
            campaignType: 'AFTER_SEMINAR',
            assignedTo, 
            status: assignedTo ? 'OPEN' : 'NEW', 
            phase: 1, 
            callStatus: 'pending',
            paymentIntention: 'NOT_DECIDED', 
            enrollmentStatus: 'NON_ENROLLED', 
            inquiryType: targetInquiryType,
            newInqTimestamp: targetInquiryType === 'NEW_INQ' ? new Date() : null
        };

        if (isBulk && leadsList && Array.isArray(leadsList)) {
            let importedCount = 0;
            for (const lead of leadsList) {
                let phone = lead.number?.toString().trim();
                if (!phone) continue;
                phone = normalizePhone(phone); // 🔥 NORMALIZED 🔥
                const dbPhone = parsedBatchId ? `${phone}_BIZ_${parsedBusinessId}_BATCH_${parsedBatchId}` : `${phone}_BIZ_${parsedBusinessId}`;
                await prisma.lead.upsert({
                    where: { phone: dbPhone }, 
                    update: { name: lead.name || '' }, 
                    create: { name: lead.name || '', phone: dbPhone, ...baseData }
                });
                importedCount++;
            }
            return res.status(201).json({ message: `${importedCount} leads imported successfully!` });
        } else {
            const normalizedNumber = normalizePhone(number); // 🔥 NORMALIZED 🔥
            const dbPhone = parsedBatchId ? `${normalizedNumber}_BIZ_${parsedBusinessId}_BATCH_${parsedBatchId}` : `${normalizedNumber}_BIZ_${parsedBusinessId}`;
            const newLead = await prisma.lead.upsert({
                where: { phone: dbPhone }, 
                update: { name }, 
                create: { name, phone: dbPhone, ...baseData }
            });
            return res.status(201).json({ message: "Lead imported successfully!", lead: newLead });
        }
    } catch (error) { 
        res.status(500).json({ error: "Failed to import lead" }); 
    }
};

exports.bulkActions = async (req, res) => {
    try {
        const { action, leadIds, staffId, targetRound, assignType, batchId } = req.body;

        if (action === 'MARK_READ') {
            await prisma.lead.updateMany({ where: { id: { in: leadIds } }, data: { unreadCount: 0 } });
        } 
        else if (action === 'MARK_UNREAD') {
            await prisma.lead.updateMany({ where: { id: { in: leadIds } }, data: { unreadCount: 1 } });
        } 
        else if (action === 'ASSIGN_BATCH') {
            const targetBatchId = batchId || req.body.batchId;
            if (!targetBatchId || isNaN(parseInt(targetBatchId))) {
                return res.status(400).json({ error: "Invalid batch ID provided." });
            }
            const parsedLeadIds = (leadIds || []).map(id => parseInt(id)).filter(id => !isNaN(id));
            await prisma.lead.updateMany({ 
                where: { id: { in: parsedLeadIds } }, 
                data: { 
                    batchId: parseInt(targetBatchId),
                    callStatus: 'pending',
                    openSemCallStatus: 'pending',
                    newInqCallStatus: 'pending',
                    phase: 1,
                    openSemPhase: 1,
                    newInqPhase: 1,
                    callAttempt: 1,
                    openSemCallAttempt: 1,
                    newInqCallAttempt: 1,
                    coordinationRound: 1,
                    openSemRound: 1,
                    newInqRound: 1,
                    feedback: '',
                    openSemFeedback: '',
                    newInqFeedback: '',
                    callMethod: null,
                    openSemCallMethod: null,
                    newInqCallMethod: null,
                    nonEnrolledReason: null,
                    r1DelayedDays: 0,
                    r2DelayedDays: 0,
                    lastAttemptAt: null
                } 
            });
            await prisma.leadRoundProgress.deleteMany({
                where: { leadId: { in: parsedLeadIds } }
            });
        }
        else if (action === 'ASSIGN') {
            if (!staffId || isNaN(parseInt(staffId))) {
                return res.status(400).json({ error: "Invalid staff ID provided for assignment." });
            }
            const parsedLeadIds = (leadIds || []).map(id => parseInt(id)).filter(id => !isNaN(id));
            const updateData = { 
                assignedTo: parseInt(staffId), 
                status: 'OPEN', 
                phase: 1, 
                callStatus: 'pending',
                coordinationRound: 1,
                openSemRound: 1,
                newInqRound: 1,
                openSemPhase: 1,
                newInqPhase: 1,
                openSemCallStatus: 'pending',
                newInqCallStatus: 'pending',
                callAttempt: 1,
                openSemCallAttempt: 1,
                newInqCallAttempt: 1,
                isLocked: false,
                assignedAt: new Date(),
                feedback: '',
                openSemFeedback: '',
                newInqFeedback: '',
                callMethod: null,
                openSemCallMethod: null,
                newInqCallMethod: null,
                nonEnrolledReason: null,
                r1DelayedDays: 0,
                r2DelayedDays: 0,
                lastAttemptAt: null
            };
            if (batchId && !isNaN(parseInt(batchId))) {
                updateData.batchId = parseInt(batchId);
            }
            if (assignType === 'OPEN_SEMINAR' || assignType === 'OPEN_SEM') {
                updateData.inquiryType = 'OPEN_SEMINAR';
            } else if (assignType === 'NEW_INQ') {
                updateData.inquiryType = 'NEW_INQ';
                updateData.newInqTimestamp = new Date();
            } else if (assignType === 'NORMAL') {
                updateData.inquiryType = 'NORMAL';
            }
            await prisma.lead.updateMany({ 
                where: { id: { in: parsedLeadIds } }, 
                data: updateData 
            });
            await prisma.leadRoundProgress.deleteMany({
                where: { leadId: { in: parsedLeadIds } }
            });
        } 
        else if (action === 'UNASSIGN') {
            await prisma.lead.updateMany({ where: { id: { in: leadIds } }, data: { assignedTo: null, status: 'NEW', phase: 1, callStatus: 'pending', assignedAt: null } });
        }
        else if (action === 'CONVERT_TO_NEW_INQ' || action === 'SET_NEW_INQ') {
            const parsedLeadIds = (leadIds || []).map(id => parseInt(id)).filter(id => !isNaN(id));
            if (parsedLeadIds.length > 0) {
                await prisma.lead.updateMany({
                    where: { id: { in: parsedLeadIds } },
                    data: {
                        inquiryType: 'NEW_INQ',
                        newInqTimestamp: new Date()
                    }
                });
            }
        }
        else if (action === 'CONVERT_TO_OPEN_SEM' || action === 'SET_OPEN_SEM') {
            const parsedLeadIds = (leadIds || []).map(id => parseInt(id)).filter(id => !isNaN(id));
            if (parsedLeadIds.length > 0) {
                await prisma.lead.updateMany({
                    where: { id: { in: parsedLeadIds } },
                    data: {
                        inquiryType: 'OPEN_SEMINAR'
                    }
                });
            }
        }
        else if (action === 'CHANGE_ROUND') {
            for (const leadId of leadIds) {
                const lead = await prisma.lead.findUnique({ where: { id: parseInt(leadId) } });
                if (!lead) continue;

                const currentRound = lead.coordinationRound || 1;

                let campaignCategory = 'DEFAULT';
                if (lead.inquiryType === 'NEW_INQ') campaignCategory = 'NEW_INQ';
                else if (lead.inquiryType === 'OPEN_SEMINAR') campaignCategory = 'OPEN_SEM';
                else if (lead.inquiryType === 'PAID') campaignCategory = 'PAID';

                // 1. Save history to LeadRoundProgress
                await prisma.leadRoundProgress.upsert({
                    where: {
                        leadId_roundNum_campaignCategory: {
                            leadId: lead.id,
                            roundNum: currentRound,
                            campaignCategory: campaignCategory
                        }
                    },
                    update: {
                        callStatus: lead.callStatus || 'pending',
                        callMethod: lead.callMethod || 'direct',
                        callAttempt: lead.callAttempt || 1,
                        feedback: lead.feedback || 'Manually pushed to next round'
                    },
                    create: {
                        leadId: lead.id,
                        roundNum: currentRound,
                        campaignCategory: campaignCategory,
                        callStatus: lead.callStatus || 'pending',
                        callMethod: lead.callMethod || 'direct',
                        callAttempt: lead.callAttempt || 1,
                        feedback: lead.feedback || 'Manually pushed to next round'
                    }
                });

                    const isNewInq = lead.inquiryType === 'NEW_INQ';

                    const updateData = {
                        coordinationRound: (parseInt(targetRound) >= 3 && !isNewInq) ? 1 : parseInt(targetRound),
                        phase: 1,
                        callStatus: 'pending',
                        callAttempt: 1,
                        callMethod: 'direct',
                        feedback: '',
                        isLocked: false,
                        updatedAt: new Date()
                    };
                    
                    if (parseInt(targetRound) >= 3 && !isNewInq) {
                        updateData.inquiryType = 'NORMAL';
                    }

                    if (lead.inquiryType === 'OPEN_SEMINAR') {
                        updateData.openSemRound = updateData.coordinationRound;
                        updateData.openSemPhase = 1;
                        updateData.openSemCallStatus = 'pending';
                        updateData.openSemCallAttempt = 1;
                        updateData.openSemCallMethod = 'direct';
                        updateData.openSemFeedback = '';
                    } else if (lead.inquiryType === 'NEW_INQ') {
                        updateData.newInqRound = updateData.coordinationRound;
                        updateData.newInqPhase = 1;
                        updateData.newInqCallStatus = 'pending';
                        updateData.newInqCallAttempt = 1;
                        updateData.newInqCallMethod = 'direct';
                        updateData.newInqFeedback = '';
                    } else if (lead.inquiryType === 'PAID') {
                        updateData.paidRound = updateData.coordinationRound;
                        updateData.paidPhase = 1;
                        updateData.paidCallStatus = 'pending';
                        updateData.paidCallAttempt = 1;
                        updateData.paidCallMethod = 'direct';
                        updateData.paidFeedback = '';
                    }

                    await prisma.lead.update({
                        where: { id: lead.id },
                        data: updateData
                    });
            }
        }

        res.status(200).json({ message: "Action successful" });
    } catch (error) { 
        console.error("Bulk action failed:", error);
        res.status(500).json({ error: "Bulk action failed" }); 
    }
};

exports.getAutoAssignQuotas = async (req, res) => {
    try {
        const quotas = await prisma.autoAssignQuota.findMany({ include: { staff: { select: { firstName: true, lastName: true } } } });
        res.status(200).json(quotas);
    } catch (error) { res.status(500).json({ error: "Failed to load quotas" }); }
};

exports.assignLeads = async (req, res) => {
    try {
        const { type, staffId, count, sort, autoAssignConfig, batchId, businessId, assignType, sourceTab, sourceInquiryType } = req.body;
        
        if (type === 'bulk') {
            let whereClause = { assignedTo: null, campaignType: 'AFTER_SEMINAR', source: { not: 'system' } };
            
            if (batchId && batchId !== '' && batchId !== 'ALL' && batchId !== 'UNASSIGNED') {
                whereClause.batchId = parseInt(batchId);
            } else if (batchId === 'UNASSIGNED') {
                whereClause.batchId = null;
            }

            if (businessId && businessId !== '' && businessId !== 'ALL') {
                const bId = parseInt(businessId);
                whereClause.OR = [
                    { phone: { contains: `BIZ_${bId}_` } },
                    { phone: { endsWith: `BIZ_${bId}` } }
                ];
            } else if (!batchId || batchId === 'ALL') {
                return res.status(400).json({ error: "Please select a specific Business or Batch before assigning." });
            }

            // Determine source pool to search FROM:
            const sourcePool = sourceInquiryType || sourceTab;
            if (sourcePool === 'NEW_INQ') {
                whereClause.inquiryType = 'NEW_INQ';
            } else if (sourcePool === 'OPEN_SEMINAR' || sourcePool === 'OPEN_SEM') {
                whereClause.inquiryType = { in: ['OPEN_SEMINAR', 'NORMAL'] };
            } else if (sourcePool === 'NORMAL' || sourcePool === 'IMPORTED') {
                whereClause.inquiryType = 'NORMAL';
            } else if (sourcePool === 'PAID_CAMP') {
                whereClause.inquiryType = 'PAID_CAMP';
            }
            // If sourcePool is 'ALL' or empty, do not restrict inquiryType in search

            let leadsToAssign = await prisma.lead.findMany({ 
                where: whereClause, 
                orderBy: { id: sort === 'oldest' ? 'asc' : 'desc' }, 
                take: parseInt(count) || 50
            });

            // Fallback: If no leads found with strict batchId filter, and source was NEW_INQ, search for unassigned NEW_INQ leads for this business with batchId=null
            if (leadsToAssign.length === 0 && whereClause.batchId && (sourcePool === 'NEW_INQ' || !sourcePool)) {
                const fallbackWhere = { ...whereClause, batchId: null };
                leadsToAssign = await prisma.lead.findMany({
                    where: fallbackWhere,
                    orderBy: { id: sort === 'oldest' ? 'asc' : 'desc' },
                    take: parseInt(count) || 50
                });
            }

            if (leadsToAssign.length === 0) {
                return res.status(400).json({ error: "No unassigned leads found for this category." });
            }

            if (!staffId || isNaN(parseInt(staffId))) {
                return res.status(400).json({ error: "Please select a staff member to assign." });
            }

            const ids = leadsToAssign.map(l => l.id);
            const updateData = { 
                assignedTo: parseInt(staffId), 
                status: 'OPEN', 
                phase: 1, 
                callStatus: 'pending',
                coordinationRound: 1,
                openSemRound: 1,
                newInqRound: 1,
                openSemPhase: 1,
                newInqPhase: 1,
                openSemCallStatus: 'pending',
                newInqCallStatus: 'pending',
                callAttempt: 1,
                openSemCallAttempt: 1,
                newInqCallAttempt: 1,
                isLocked: false,
                assignedAt: new Date(),
                feedback: '',
                openSemFeedback: '',
                newInqFeedback: '',
                callMethod: null,
                openSemCallMethod: null,
                newInqCallMethod: null,
                nonEnrolledReason: null,
                r1DelayedDays: 0,
                r2DelayedDays: 0,
                lastAttemptAt: null
            };
            if (batchId && batchId !== 'ALL' && batchId !== 'UNASSIGNED' && !isNaN(parseInt(batchId))) {
                updateData.batchId = parseInt(batchId);
            }

            // Target inquiry type conversion when assigned:
            const targetType = assignType || sourcePool;
            if (targetType === 'OPEN_SEMINAR' || targetType === 'OPEN_SEM' || targetType === 'NORMAL') {
                const effectiveBatchId = batchId && batchId !== 'ALL' && batchId !== 'UNASSIGNED' ? parseInt(batchId) : null;
                if (effectiveBatchId) {
                    const isBatchLocked = await isOpenSeminarLocked(effectiveBatchId);
                    if (isBatchLocked) {
                        return res.status(403).json({ error: "The Opening Seminar campaign for this batch is locked by Management. Cannot assign new leads." });
                    }
                }
                updateData.inquiryType = (targetType === 'NORMAL') ? 'NORMAL' : 'OPEN_SEMINAR';
            } else if (targetType === 'NEW_INQ') {
                updateData.inquiryType = 'NEW_INQ';
                updateData.newInqTimestamp = new Date();
            }

            await prisma.lead.updateMany({ 
                where: { id: { in: ids } }, 
                data: updateData 
            });

            await prisma.leadRoundProgress.deleteMany({
                where: { leadId: { in: ids } }
            });

            return res.status(200).json({ message: `${leadsToAssign.length} leads assigned successfully!` });

        } else if (type === 'auto') {
            for (const config of autoAssignConfig) {
                await prisma.autoAssignQuota.upsert({
                    where: { staffId: parseInt(config.staffId) },
                    update: { quotaAmount: parseInt(config.quotaAmount), isActive: config.isActive },
                    create: { staffId: parseInt(config.staffId), quotaAmount: parseInt(config.quotaAmount), isActive: config.isActive }
                });
            }
            return res.status(200).json({ message: "Auto Assign configuration saved!" });
        }
    } catch (error) { 
        console.error("Assign leads error:", error);
        res.status(500).json({ error: "Failed to process assignment" }); 
    }
};

// ==========================================
// 4. CALL CAMPAIGN & COORDINATION
// ==========================================
exports.updateCallCampaign = async (req, res) => {
    try {
        const { leadId, method, status, callStatus, feedback, coordinationRound, paymentIntention, enrollmentStatus, inquiryType, callAttempt, nonEnrolledReason, campaignContext, isNonEnrolledTab, attemptsData } = req.body;
        
        const lead = await prisma.lead.findUnique({ where: { id: parseInt(leadId) } });
        if (!lead) return res.status(404).json({ error: "Lead not found" });

        let prefix = '';
        let category = 'DEFAULT';
        if (campaignContext === 'OPEN_SEMINAR') { prefix = 'openSem'; category = 'OPEN_SEM'; }
        else if (campaignContext === 'NEW_INQ') { prefix = 'newInq'; category = 'NEW_INQ'; }
        else if (campaignContext === 'PAID') { prefix = 'paid'; category = 'PAID'; }
        else if (campaignContext === 'BRIDGE' || lead.source === 'bridge_transfer') {
            category = 'BRIDGE';
        }

        const phaseField = prefix ? `${prefix}Phase` : 'phase';
        const roundField = prefix ? `${prefix}Round` : 'coordinationRound';
        const statusField = prefix ? `${prefix}CallStatus` : 'callStatus';
        const methodField = prefix ? `${prefix}CallMethod` : 'callMethod';
        const attemptField = prefix ? `${prefix}CallAttempt` : 'callAttempt';
        const feedbackField = prefix ? `${prefix}Feedback` : 'feedback';

        let currentPhase = parseInt(lead[phaseField]) || 1;
        let nextPhase = currentPhase;
        
        let currentRound = coordinationRound !== undefined ? parseInt(coordinationRound) : (parseInt(lead[roundField]) || 1);
        let nextRound = currentRound;
        
        const actualStatus = status || callStatus || lead[statusField];
        let finalCallStatus = actualStatus;

        let promoteToRound2 = false;

        if (campaignContext === 'PAID') {
            // PAID campaigns do not have rounds in the same way, they use coordinationRound as the month index.
            // We just save the status and remark for the specific month/round. No auto-promotion.
            finalCallStatus = actualStatus;
            nextPhase = currentPhase;
            nextRound = currentRound;
            
            await prisma.leadRoundProgress.upsert({
                where: {
                    leadId_roundNum_campaignCategory: { leadId: lead.id, roundNum: currentRound, campaignCategory: 'PAID' }
                },
                update: {
                    phase: currentPhase,
                    callStatus: actualStatus,
                    callMethod: method || lead[methodField] || 'direct',
                    callAttempt: callAttempt || lead[attemptField] || 1,
                    feedback: feedback || lead[feedbackField] || '',
                    attemptsData: attemptsData ? JSON.stringify(attemptsData) : undefined
                },
                create: {
                    leadId: lead.id,
                    roundNum: currentRound,
                    campaignCategory: 'PAID',
                    phase: currentPhase,
                    callStatus: actualStatus,
                    callMethod: method || lead[methodField] || 'direct',
                    callAttempt: callAttempt || lead[attemptField] || 1,
                    feedback: feedback || lead[feedbackField] || '',
                    attemptsData: attemptsData ? JSON.stringify(attemptsData) : undefined
                }
            });
        } else if (campaignContext === 'BRIDGE' || (category === 'BRIDGE' && campaignContext !== 'OPEN_SEMINAR' && campaignContext !== 'NEW_INQ')) {
            // 🔥 BRIDGE CAMPAIGN SPECIFIC LOGIC: Preserve actual callStatus, attempt count, and phase 🔥
            finalCallStatus = actualStatus;
            
            if (req.body.phase !== undefined && req.body.phase !== null && req.body.phase !== '') {
                nextPhase = parseInt(req.body.phase);
            } else if (actualStatus === 'no_answer') {
                nextPhase = Math.min(3, currentPhase + 1);
            } else {
                nextPhase = currentPhase;
            }
            nextRound = currentRound;

            const nextAttempt = callAttempt !== undefined ? parseInt(callAttempt) : (lead[attemptField] || 1);

            await prisma.leadRoundProgress.upsert({
                where: {
                    leadId_roundNum_campaignCategory: { leadId: lead.id, roundNum: currentRound, campaignCategory: 'BRIDGE' }
                },
                update: {
                    phase: nextPhase,
                    callStatus: actualStatus,
                    callMethod: method || lead[methodField] || 'direct',
                    callAttempt: nextAttempt,
                    feedback: feedback !== undefined ? feedback : (lead[feedbackField] || ''),
                    attemptsData: attemptsData ? JSON.stringify(attemptsData) : undefined
                },
                create: {
                    leadId: lead.id,
                    roundNum: currentRound,
                    campaignCategory: 'BRIDGE',
                    phase: nextPhase,
                    callStatus: actualStatus,
                    callMethod: method || lead[methodField] || 'direct',
                    callAttempt: nextAttempt,
                    feedback: feedback !== undefined ? feedback : (lead[feedbackField] || ''),
                    attemptsData: attemptsData ? JSON.stringify(attemptsData) : undefined
                }
            });
        } else if (isNonEnrolledTab) {
            finalCallStatus = actualStatus;
            nextPhase = currentPhase;
            nextRound = currentRound;
        } else {
            // 🔥 NEW 14-DAY ABSOLUTE TIMELINE LOGIC (OPEN SEMINAR & GENERAL) 🔥
            if (currentRound === 1) {
                if (actualStatus === 'reject') {
                    finalCallStatus = 'reject';
                    nextPhase = 1;
                } else if (actualStatus === 'no_answer') {
                    finalCallStatus = 'no_answer';
                    nextPhase = 1;
                } else if (actualStatus !== 'pending') {
                    // Any other update (e.g. answered) -> Move to Round 2 (it will be frozen dynamically based on 7-day rule)
                    promoteToRound2 = true;
                }
            } else if (currentRound === 2) {
                if (actualStatus === 'reject') {
                    finalCallStatus = 'reject';
                    nextPhase = 1;
                } else if (actualStatus === 'no_answer') {
                    finalCallStatus = 'no_answer';
                    nextPhase = 1;
                } else if (actualStatus !== 'pending') {
                    // Any other update in Round 2 immediately pushes it to Non-Enrolled (Round 3)
                    finalCallStatus = actualStatus;
                    nextPhase = 1;
                    nextRound = 3; 
                }
            }
        }

        if (campaignContext !== 'PAID' && campaignContext !== 'BRIDGE' && category !== 'BRIDGE') {
            await prisma.leadRoundProgress.upsert({
                where: {
                    leadId_roundNum_campaignCategory: { leadId: lead.id, roundNum: currentRound, campaignCategory: category }
                },
                update: {
                    phase: currentPhase,
                    callStatus: actualStatus,
                    callMethod: method || lead[methodField] || 'direct',
                    callAttempt: lead[attemptField] || 1,
                    feedback: feedback !== undefined ? feedback : (lead[feedbackField] || '')
                },
                create: {
                    leadId: lead.id,
                    roundNum: currentRound,
                    campaignCategory: category,
                    phase: currentPhase,
                    callStatus: actualStatus,
                    callMethod: method || lead[methodField] || 'direct',
                    callAttempt: lead[attemptField] || 1,
                    feedback: feedback !== undefined ? feedback : (lead[feedbackField] || '')
                }
            });
        }

        if (promoteToRound2 && campaignContext !== 'PAID' && campaignContext !== 'BRIDGE' && category !== 'BRIDGE') {
            nextRound = 2;
            nextPhase = 1;
            finalCallStatus = 'pending';
        }

        const tabChanged = inquiryType && inquiryType !== lead.inquiryType;
        const phaseChanged = currentPhase !== nextPhase;
        const statusChanged = actualStatus !== lead[statusField];
        
        let nextCallAttempt = callAttempt !== undefined ? parseInt(callAttempt) : lead[attemptField];
        let nextLastAttemptAt = lead.lastAttemptAt;

        if (lead[statusField] === 'pending' && actualStatus !== 'pending') {
            nextLastAttemptAt = new Date();
        } else if (campaignContext !== 'PAID' && campaignContext !== 'BRIDGE' && category !== 'BRIDGE' && lead.lastAttemptAt && statusChanged) {
            const daysPassed = (new Date() - new Date(lead.lastAttemptAt)) / (1000 * 60 * 60 * 24);
            if (daysPassed >= 5) {
                nextCallAttempt = 2;
                nextLastAttemptAt = new Date();
            }
        }

        const newTimestamp = (tabChanged || phaseChanged || statusChanged) ? new Date() : lead.updatedAt;

        // 🔥 Calculate Delays 🔥
        let updatedR1Delay = lead.r1DelayedDays || 0;
        let updatedR2Delay = lead.r2DelayedDays || 0;

        if (lead[statusField] === 'pending' && actualStatus !== 'pending') {
            const assignedTime = lead.assignedAt ? new Date(lead.assignedAt).getTime() : new Date(lead.createdAt).getTime();
            const nowTime = new Date().getTime();
            const hoursSinceAssign = (nowTime - assignedTime) / (1000 * 60 * 60);

            if (currentRound === 1 && hoursSinceAssign > 24) {
                const delayedDays = Math.floor((hoursSinceAssign - 24) / 24);
                updatedR1Delay += (delayedDays > 0 ? delayedDays : 1);
            } else if (currentRound === 2) {
                const round2HoursPassed = hoursSinceAssign - (6 * 24);
                if (round2HoursPassed > 24) {
                    const delayedDays = Math.floor((round2HoursPassed - 24) / 24);
                    updatedR2Delay += (delayedDays > 0 ? delayedDays : 1);
                }
            }
        }

        let finalEnrollmentStatus = enrollmentStatus || lead.enrollmentStatus;
        let finalPaymentIntention = paymentIntention || lead.paymentIntention;

        // 🔥 STRICT ENROLLMENT PROTECTION: If student already paid for this batch, NEVER demote to NON_ENROLLED!
        // NOTE: In PAID (retention) campaign or when coordinating the NON_ENROLLED tab,
        // students are tracked per-month; a student who paid in previous months may be NON_ENROLLED
        // for the current coordination month. Never force ENROLLED in PAID campaign or when on NON_ENROLLED tab!
        if (campaignContext !== 'PAID' && !isNonEnrolledTab && lead.batchId && lead.phone) {
            const rawP = lead.phone.split('_')[0].replace(/[^0-9]/g, '');
            if (rawP.length >= 7) {
                const suffix7 = rawP.slice(-7);
                const approvedPay = await prisma.payment.findFirst({
                    where: {
                        batchId: lead.batchId,
                        status: { in: [1, 4] },
                        OR: [
                            { student: { phone: { contains: suffix7 } } },
                            { student: { whatsapp: { contains: suffix7 } } },
                            { student: { optionalPhone: { contains: suffix7 } } }
                        ]
                    },
                    select: { id: true, payment_type: true }
                });

                if (approvedPay) {
                    finalEnrollmentStatus = 'ENROLLED';
                    if (!paymentIntention || paymentIntention === 'NOT_DECIDED') {
                        finalPaymentIntention = approvedPay.payment_type === 3 ? 'FULL' : approvedPay.payment_type === 2 ? 'INSTALLMENT' : 'MONTHLY';
                    }
                }
            }
        }

        if (campaignContext === 'PAID' && isNonEnrolledTab) {
            finalEnrollmentStatus = 'NON_ENROLLED';
        }

        const updatedLead = await prisma.lead.update({
            where: { id: parseInt(leadId) },
            data: { 
                r1DelayedDays: updatedR1Delay,
                r2DelayedDays: updatedR2Delay,
                [methodField]: method !== undefined ? method : lead[methodField], 
                [statusField]: finalCallStatus, 
                [feedbackField]: feedback !== undefined ? feedback : lead[feedbackField], 
                nonEnrolledReason: nonEnrolledReason !== undefined ? nonEnrolledReason : lead.nonEnrolledReason,
                [phaseField]: nextPhase,             
                [roundField]: nextRound,
                coordinationRound: nextRound,
                [attemptField]: nextCallAttempt,
                lastAttemptAt: nextLastAttemptAt,
                paymentIntention: finalPaymentIntention,
                enrollmentStatus: finalEnrollmentStatus,
                inquiryType: lead.inquiryType || 'NORMAL',
                updatedAt: newTimestamp
            }
        });

        // 🔥 LOG TO CALL CAMPAIGN DATA CENTER EVENT VAULT 🔥
        if (auditLogService && auditLogService.logCampaignEvent) {
            await auditLogService.logCampaignEvent({
                leadId: lead.id,
                campaignCategory: category === 'DEFAULT' ? (campaignContext || 'UNKNOWN') : category,
                actionType: 'STATUS_UPDATED',
                oldStatus: lead[statusField],
                newStatus: finalCallStatus,
                callAttempt: nextCallAttempt,
                remarks: feedback,
                actionedById: req.user ? req.user.id : null
            });
        }

        // 🔥 Map back to base properties so the frontend doesn't reset to default global 'pending' 🔥
        let mappedLead = { ...updatedLead };
        if (campaignContext === 'PAID') {
            mappedLead.attemptsData = attemptsData || null;
            mappedLead.callStatus = updatedLead.paidCallStatus || 'pending';
            mappedLead.paidCallStatus = updatedLead.paidCallStatus || 'pending';
            mappedLead.phase = updatedLead.paidPhase || 1;
            mappedLead.coordinationRound = updatedLead.paidRound || 1;
            mappedLead.feedback = updatedLead.paidFeedback || '';
            mappedLead.callMethod = updatedLead.paidCallMethod || null;
            mappedLead.callAttempt = updatedLead.paidCallAttempt || 1;
        } else if (campaignContext === 'OPEN_SEMINAR' || updatedLead.inquiryType === 'OPEN_SEMINAR') {
            mappedLead.phase = updatedLead.openSemPhase || 1;
            mappedLead.callStatus = updatedLead.openSemCallStatus || 'pending';
            mappedLead.coordinationRound = updatedLead.openSemRound || 1;
            mappedLead.feedback = updatedLead.openSemFeedback || '';
            mappedLead.callMethod = updatedLead.openSemCallMethod || null;
            mappedLead.callAttempt = updatedLead.openSemCallAttempt || 1;
        } else if (campaignContext === 'NEW_INQ' || updatedLead.inquiryType === 'NEW_INQ') {
            mappedLead.phase = updatedLead.newInqPhase || 1;
            mappedLead.callStatus = updatedLead.newInqCallStatus || 'pending';
            mappedLead.coordinationRound = updatedLead.newInqRound || 1;
            mappedLead.feedback = updatedLead.newInqFeedback || '';
            mappedLead.callMethod = updatedLead.newInqCallMethod || null;
            mappedLead.callAttempt = updatedLead.newInqCallAttempt || 1;
        }

        res.status(200).json({ message: "Call status updated successfully", lead: mappedLead });
    } catch (error) { 
        console.error("Update Call Error:", error);
        res.status(500).json({ error: "Failed to update call campaign" }); 
    }
};

exports.startNewCoordination = async (req, res) => {
    try {
        const { businessId, batchId } = req.body;
        let whereClause = { campaignType: 'AFTER_SEMINAR', enrollmentStatus: 'NON_ENROLLED' };
        if (batchId === 'UNASSIGNED') {
            whereClause.batchId = null;
        } else if (batchId && batchId !== '') {
            whereClause.batchId = parseInt(batchId);
        } else if (businessId && businessId !== '') {
            whereClause.OR = [
                { phone: { endsWith: `BIZ_${businessId}` } },
                { phone: { endsWith: `BIZ_${businessId}_AS` } },
                { phone: { contains: `BIZ_${businessId}_BATCH_` } },
                { phone: { contains: `BIZ_${businessId}_ROUND_` } },
                { phone: { contains: `BIZ_${businessId}_HISTORY_ROUND_` } }
            ];
        }
        if (batchId === 'UNASSIGNED') {
            whereClause.batchId = null;
        } else if (batchId && batchId !== '') {
            whereClause.batchId = parseInt(batchId);
        }

        await prisma.lead.updateMany({
            where: whereClause,
            data: { callStatus: 'pending', coordinationRound: { increment: 1 } }
        });
        res.status(200).json({ message: "New coordination round started!" });
    } catch (error) { 
        res.status(500).json({ error: "Failed to start new round" }); 
    }
};

exports.getAllCampaignLeads = async (req, res) => {
    try {
        const { businessId, batchId } = req.query;
        let whereClause = { campaignType: 'AFTER_SEMINAR' };
        
        if (batchId === 'UNASSIGNED') {
            whereClause.batchId = null;
        } else if (batchId && batchId !== '') {
            whereClause.batchId = parseInt(batchId);
        } else if (businessId && businessId !== '') {
            whereClause.OR = [
                { phone: { endsWith: `BIZ_${businessId}` } },
                { phone: { endsWith: `BIZ_${businessId}_AS` } },
                { phone: { contains: `BIZ_${businessId}_BATCH_` } },
                { phone: { contains: `BIZ_${businessId}_ROUND_` } },
                { phone: { contains: `BIZ_${businessId}_HISTORY_ROUND_` } }
            ];
        }
        
        const leads = await prisma.lead.findMany({ where: whereClause, orderBy: { updatedAt: 'desc' } }); 
        const cleanedLeads = leads.map(l => ({ ...l, phone: l.phone ? l.phone.split('_')[0] : '' }));
        res.status(200).json(cleanedLeads);
    } catch (error) { res.status(500).json({ error: "Failed to fetch leads" }); }
};

// ==========================================
// 5. CHATS, WEBHOOK & BROADCAST
// ==========================================
const downloadMetaMedia = async (mediaId, metaApiKey) => {
    try {
        const urlResponse = await axios.get(`https://graph.facebook.com/v19.0/${mediaId}`, {
            headers: { 'Authorization': `Bearer ${metaApiKey}` }
        });
        
        const mediaUrl = urlResponse.data.url;
        const mimeType = urlResponse.data.mime_type || '';

        if(!mediaUrl) return null;

        const fileResponse = await axios.get(mediaUrl, {
            headers: { 'Authorization': `Bearer ${metaApiKey}` },
            responseType: 'arraybuffer' 
        });

        let ext = 'bin';
        if (mimeType.includes('jpeg')) ext = 'jpeg';
        else if (mimeType.includes('png')) ext = 'png';
        else if (mimeType.includes('webp')) ext = 'webp';
        else if (mimeType.includes('mp4')) ext = 'mp4';
        else if (mimeType.includes('pdf')) ext = 'pdf';
        else if (mimeType.includes('ogg')) ext = 'ogg'; 
        else if (mimeType.includes('audio')) ext = 'mp3';

        const filename = `CHAT_MEDIA_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
        const uploadPathDir = path.join(process.cwd(), 'storage/documents');
        
        if (!fs.existsSync(uploadPathDir)){
            fs.mkdirSync(uploadPathDir, { recursive: true });
        }
        
        const finalPath = path.join(uploadPathDir, filename);
        fs.writeFileSync(finalPath, Buffer.from(fileResponse.data));
        
        return { url: `/storage/documents/${filename}`, type: mimeType };
    } catch (error) { return null; }
};

exports.verifyWebhook = (req, res) => {
    const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || "ImaCampusMetaApp@2026";
    let mode = req.query["hub.mode"];
    let token = req.query["hub.verify_token"];
    let challenge = req.query["hub.challenge"];

    if (mode && token) {
        if (mode === "subscribe" && token === VERIFY_TOKEN) res.status(200).send(challenge);
        else res.sendStatus(403);
    } else res.sendStatus(400);
};

// ==========================================
// 6. RECEIVE MESSAGE WEBHOOK (WITH FULL BUTTON SUPPORT)
// ==========================================
exports.receiveMessage = async (req, res) => {
    try {
        let body = req.body;
        
        // Delegate incoming WhatsApp calls to freeSeminarController call handler
        if (body.object === "whatsapp_business_account" && body.entry?.[0]?.changes?.[0]?.value?.calls?.[0]) {
            const freeSeminarController = require('./freeSeminarController');
            return freeSeminarController.receiveMessage(req, res);
        }

        if (body.object === "whatsapp_business_account" && body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
            let msgData = body.entry[0].changes[0].value.messages[0];
            let contactData = body.entry[0].changes[0].value.contacts?.[0] || {};
            let phone = msgData.from; 
            let name = contactData?.profile?.name || "Unknown"; 
            let metaMsgId = msgData.id; 

            // 🔥 Prevent Race Conditions from Duplicate Meta Webhooks 🔥
            if (processingMessages.has(metaMsgId)) {
                console.log(`[DEDUPE] Ignored duplicate webhook for message ID: ${metaMsgId}`);
                return res.status(200).send("EVENT_RECEIVED");
            }
            processingMessages.add(metaMsgId);
            setTimeout(() => processingMessages.delete(metaMsgId), 30000); // Keep lock for 30s

            console.log("\n🟢 ====== INCOMING MESSAGE WEBHOOK ======");
            console.log(JSON.stringify(msgData, null, 2));
            console.log("=========================================\n");

            const existingMessage = await prisma.chatMessage.findFirst({
                where: { metaMessageId: metaMsgId }
            });

            if (existingMessage) return res.status(200).send("EVENT_RECEIVED");

            let metadata = body.entry[0].changes[0].value.metadata;
            let receivingWaNumId = metadata ? metadata.phone_number_id : null;

            const rawDigits = (phone || '').replace(/[^0-9]/g, '');
            const phoneSuffix = rawDigits.length >= 9 ? rawDigits.slice(-9) : rawDigits;

            // 🛑 CHECK IF SENDER PHONE IS BLOCKED 🛑
            const isSenderBlocked = await isNumberBlockedHelper(phone);
            if (isSenderBlocked) {
                console.log(`\n🚫 [BLOCKED] Incoming webhook message from blocked sender ${phone} ignored.\n`);
                return res.status(200).send("EVENT_RECEIVED");
            }

            const allMatchingSettings = await prisma.crmSettings.findMany({
                where: { waNumId: receivingWaNumId },
                orderBy: { updatedAt: 'desc' }
            });

            if (!allMatchingSettings || allMatchingSettings.length === 0) return res.status(200).send("EVENT_RECEIVED");

            let settings = null;
            if (allMatchingSettings.length === 1) {
                settings = allMatchingSettings[0];
            } else {
                const existingLeadForRouting = await prisma.lead.findFirst({
                    where: {
                        phone: { contains: phoneSuffix }
                    },
                    orderBy: { updatedAt: 'desc' }
                });

                if (existingLeadForRouting && existingLeadForRouting.campaignType) {
                    settings = allMatchingSettings.find(s => s.campaignType === existingLeadForRouting.campaignType) || allMatchingSettings[0];
                } else {
                    settings = allMatchingSettings[0];
                }
            }
            
            let messageText = "";
            let interactiveId = null;
            let isFollowUpReply = false;
            let mediaUrl = null;
            let mediaType = null;

            if (["image", "audio", "video", "document", "sticker"].includes(msgData.type)) {
                const mediaObj = msgData[msgData.type];
                messageText = mediaObj.caption || mediaObj.filename || `${msgData.type.toUpperCase()} Message`;
                const mediaRes = await downloadMetaMedia(mediaObj.id, settings.metaApiKey);
                if (mediaRes) { mediaUrl = mediaRes.url; mediaType = mediaRes.type; }
            } 
            else if (msgData.type === "interactive" && msgData.interactive?.type === "button_reply") {
                interactiveId = msgData.interactive.button_reply.id; 
                messageText = msgData.interactive.button_reply.title; 
                if (interactiveId === "FU_YES" || interactiveId === "FU_NO") isFollowUpReply = true;
            } 
            else if (msgData.type === "interactive" && msgData.interactive?.type === "call_permission_reply") {
                const cpr = msgData.interactive.call_permission_reply;
                if (cpr?.response === "accept") {
                    let expDate = cpr.expiration_timestamp ? new Date(cpr.expiration_timestamp * 1000) : null;
                    if (cpr.is_permanent === false && !expDate) {
                        expDate = new Date();
                        expDate.setDate(expDate.getDate() + 7);
                    }
                    if (expDate) {
                        messageText = "📞 ✅ Student GRANTED TEMPORARY call permission";
                        msgData.callPermissionExpiryDate = expDate;
                    } else {
                        messageText = "📞 ✅ Student GRANTED ALWAYS call permission";
                        msgData.callPermissionExpiryDate = null;
                    }
                } else {
                    messageText = "📞 ❌ Student REJECTED call permission";
                }
            } 
            else if (msgData.type === "button" && msgData.button) {
                interactiveId = msgData.button.payload; 
                messageText = msgData.button.text; 
            } 
            else if (msgData.text) {
                messageText = msgData.text.body;
            } 
            else {
                messageText = `Unsupported Message (${msgData.type})`;
            }
            // ========================================================
            // 0. INTERCEPT META OTP FOR FB PAGE LINKING
            // ========================================================
            
            // 🔥 META OTP INTERCEPTOR 🔥
            let displayPhoneIntercept = req.body?.entry?.[0]?.changes?.[0]?.value?.metadata?.display_phone_number || "Unknown";
            
            if (phone === "447710173736" || phone === "16503087300" || phone === "32665" || (messageText && (messageText.includes("Facebook confirmation code") || messageText.includes("FB-") || (/\b\d{5,6}\b/.test(messageText) && messageText.toLowerCase().includes("code"))))) {
                
                let logMsg = messageText || JSON.stringify(msgData);
                if (logMsg && logMsg.length > 190) {
                    logMsg = logMsg.substring(0, 187) + "...";
                }

                console.log("\n🔑 ==========================================");
                console.log(`🔑 [META INTERCEPTED OTP] SENDER: ${phone}`);
                console.log(`🔑 TARGET CRM NUMBER: ${displayPhoneIntercept}`);
                console.log(`🔑 FULL MSG/PAYLOAD: ${logMsg}`);
                console.log("🔑 ==========================================\n");

                await prisma.webhookLog.create({
                    data: {
                        phone: phone,
                        waNumId: receivingWaNumId,
                        message: logMsg,
                        status: "OTP",
                        errorMsg: displayPhoneIntercept
                    }
                });
                
                // Don't continue normal CRM logic for OTPs
                return res.status(200).send("EVENT_RECEIVED");
            }

            let parsedBatchId = settings.batchId ? parseInt(settings.batchId) : null;
            let dbPhone = `${phone}_BIZ_${settings.businessId}`;
            if (parsedBatchId) dbPhone += `_BATCH_${parsedBatchId}`;
            if (settings.campaignType === 'AFTER_SEMINAR') dbPhone += '_AS';

            // ========================================================
            // 1. AFTER SEMINAR MESSAGE EKAK NAM
            // ========================================================
            if (settings.campaignType === 'AFTER_SEMINAR') {
                const msgLower = (messageText || "").toLowerCase().trim();
                let existingLeadCheck = await prisma.lead.findUnique({ where: { phone: dbPhone } });
                
                const exactBizRegex = new RegExp(`_BIZ_${settings.businessId}(_|$)`);
                if (!existingLeadCheck) {
                    const candidateLeads = await prisma.lead.findMany({
                        where: { 
                            phone: { contains: phoneSuffix },
                            campaignType: 'AFTER_SEMINAR',
                            status: { not: 'ARCHIVED' }
                        },
                        include: { _count: { select: { messages: true } } },
                        orderBy: { updatedAt: 'desc' }
                    });

                    // Filter for matching business and ensure phone ends with phoneSuffix
                    const matchedLeads = candidateLeads.filter(l => {
                        if (!exactBizRegex.test(l.phone)) return false;
                        const lBase = (l.phone || '').split('_')[0].replace(/[^0-9]/g, '');
                        return lBase.endsWith(phoneSuffix);
                    });

                    // Priority Sorting:
                    // 1. Valid phone length (<= 11 digits) before corrupted (> 11 digits)
                    // 2. Assigned leads before unassigned
                    // 3. Enrolled leads before non-enrolled
                    // 4. More messages before fewer messages
                    // 5. Most recently updated
                    matchedLeads.sort((a, b) => {
                        const aBase = (a.phone || '').split('_')[0].replace(/[^0-9]/g, '');
                        const bBase = (b.phone || '').split('_')[0].replace(/[^0-9]/g, '');
                        const aValid = aBase.length <= 11 ? 1 : 0;
                        const bValid = bBase.length <= 11 ? 1 : 0;
                        if (aValid !== bValid) return bValid - aValid;

                        const aAssigned = a.assignedTo ? 1 : 0;
                        const bAssigned = b.assignedTo ? 1 : 0;
                        if (aAssigned !== bAssigned) return bAssigned - aAssigned;

                        const aEnrolled = a.enrollmentStatus === 'ENROLLED' ? 1 : 0;
                        const bEnrolled = b.enrollmentStatus === 'ENROLLED' ? 1 : 0;
                        if (aEnrolled !== bEnrolled) return bEnrolled - aEnrolled;

                        const aMsgs = a._count?.messages || 0;
                        const bMsgs = b._count?.messages || 0;
                        if (aMsgs !== bMsgs) return bMsgs - aMsgs;

                        return new Date(b.updatedAt) - new Date(a.updatedAt);
                    });

                    existingLeadCheck = matchedLeads[0] || null;
                    if (existingLeadCheck) {
                        dbPhone = existingLeadCheck.phone;
                    }
                }

                let targetPhone = existingLeadCheck ? existingLeadCheck.phone : dbPhone;

                const isRestartCommand = ['hi', 'hello', 'hey', 'menu', 'start'].includes(msgLower);
                const timeSinceLastMsg = existingLeadCheck && existingLeadCheck.updatedAt ? new Date() - new Date(existingLeadCheck.updatedAt) : 10000;
                
                const isSpamming = timeSinceLastMsg < 10000; 

                let resetData = {};
                if (isRestartCommand || timeSinceLastMsg > 43200000) { 
                    resetData = { autoReplyStep: 0, sequenceCompleted: false };
                }

                let detInquiryType = 'NEW_INQ'; 
                let newInqTs = null;

                const normalizedMsg = msgLower.replace(/\s+/g, ' ');
                console.log(`DEBUG WEBHOOK EXACT MSG: [${normalizedMsg}] (len: ${normalizedMsg.length}) chars: ${normalizedMsg.split('').map(c=>c.charCodeAt(0)).join(',')}`);
                
                let shouldUnassign = false;
                const isNewBatchForLead = parsedBatchId && existingLeadCheck && existingLeadCheck.batchId !== parsedBatchId;

                if (!existingLeadCheck) {
                    if ((normalizedMsg === 'open seminar' || normalizedMsg === 'opening seminar') && settings.openSemActive) { 
                        detInquiryType = 'OPEN_SEMINAR';
                        shouldUnassign = true;
                    } else {
                        detInquiryType = 'NEW_INQ';
                        newInqTs = new Date(); 
                    }
                } else {
                    detInquiryType = existingLeadCheck.inquiryType || 'NEW_INQ';
                    if (normalizedMsg === 'open seminar' || normalizedMsg === 'opening seminar') { 
                        if (settings.openSemActive) {
                            detInquiryType = 'OPEN_SEMINAR';
                            shouldUnassign = true;
                        } else if (!existingLeadCheck.assignedTo) {
                            detInquiryType = 'NEW_INQ';
                            shouldUnassign = true;
                        }
                    } else if (isNewBatchForLead && settings.openSemActive) {
                        detInquiryType = 'OPEN_SEMINAR';
                        shouldUnassign = true;
                    }
                }

                let createDataAfterSeminar = { 
                    name: name, phone: dbPhone, source: 'whatsapp', campaignType: 'AFTER_SEMINAR', 
                    lastMessage: messageText || 'Received Media', lastMessageAt: new Date(), unreadCount: 1, status: 'NEW', 
                    phase: 1, callStatus: 'pending', paymentIntention: 'NOT_DECIDED', 
                    enrollmentStatus: 'NON_ENROLLED', inquiryType: detInquiryType, 
                    newInqTimestamp: newInqTs, autoReplyStep: 0, sequenceCompleted: false
                };

                if (parsedBatchId) createDataAfterSeminar.batch = { connect: { id: parsedBatchId } };

                let fallbackAssignedTo = null;
                if (existingLeadCheck?.assignedTo) {
                    const assignedStaff = await prisma.user.findUnique({
                        where: { id: existingLeadCheck.assignedTo },
                        select: { id: true, role: true }
                    });
                    const staffRole = (assignedStaff?.role || '').toUpperCase();
                    if (['COORDINATOR', 'MANAGER', 'SYSTEM_ADMIN', 'DIRECTOR', 'ASS_MANAGER'].includes(staffRole) && !staffRole.includes('CALL')) {
                        fallbackAssignedTo = existingLeadCheck.assignedTo;
                    }
                }

                if (!fallbackAssignedTo && phoneSuffix) {
                    const crossSemCandidates = await prisma.lead.findMany({
                        where: { 
                            phone: { contains: phoneSuffix }, 
                            campaignType: 'AFTER_SEMINAR',
                            assignedTo: { not: null } 
                        },
                        include: { assignedUser: { select: { id: true, role: true } } },
                        orderBy: { updatedAt: 'desc' }
                    });
                    const crossSemLead = crossSemCandidates.find(l => {
                        if (!exactBizRegex.test(l.phone)) return false;
                        const lBase = (l.phone || '').split('_')[0].replace(/[^0-9]/g, '');
                        return lBase.endsWith(phoneSuffix) && lBase.length <= 11;
                    });
                    if (crossSemLead && crossSemLead.assignedUser) {
                        const sRole = (crossSemLead.assignedUser.role || '').toUpperCase();
                        if (['COORDINATOR', 'MANAGER', 'SYSTEM_ADMIN', 'DIRECTOR', 'ASS_MANAGER'].includes(sRole) && !sRole.includes('CALL')) {
                            fallbackAssignedTo = crossSemLead.assignedTo;
                        }
                    }
                }

                if (fallbackAssignedTo) {
                    createDataAfterSeminar.assignedTo = fallbackAssignedTo;
                    createDataAfterSeminar.status = 'OPEN';
                    createDataAfterSeminar.assignedAt = new Date();
                }

                let updateData = { 
                    name: name, 
                    lastMessage: messageText || 'Received Media', 
                    lastMessageAt: new Date(),
                    unreadCount: { increment: 1 }, 
                    status: fallbackAssignedTo ? 'OPEN' : 'NEW', 
                    updatedAt: new Date(),
                    inquiryType: detInquiryType,
                    source: 'whatsapp',
                    ...resetData
                };

                if (fallbackAssignedTo) {
                    updateData.assignedTo = fallbackAssignedTo;
                }

                if (parsedBatchId && (shouldUnassign || isNewBatchForLead)) {
                    updateData.batchId = parsedBatchId;
                }

                if (shouldUnassign) {
                    updateData.assignedTo = null;
                    updateData.status = 'NEW';
                    updateData.phase = 1;
                    updateData.callStatus = 'pending';
                    updateData.openSemPhase = 1;
                    updateData.openSemCallStatus = 'pending';
                    updateData.newInqPhase = 1;
                    updateData.newInqCallStatus = 'pending';
                    updateData.openSemRound = 1;
                    updateData.newInqRound = 1;
                    updateData.coordinationRound = 1;
                    updateData.openSemCallAttempt = 1;
                    updateData.newInqCallAttempt = 1;
                    updateData.callAttempt = 1;
                    updateData.openSemFeedback = '';
                    updateData.newInqFeedback = '';
                    updateData.feedback = '';
                    updateData.openSemCallMethod = null;
                    updateData.newInqCallMethod = null;
                    updateData.callMethod = null;
                    updateData.nonEnrolledReason = null;
                    updateData.r1DelayedDays = 0;
                    updateData.r2DelayedDays = 0;
                    updateData.lastAttemptAt = null;
                }

                try {
                    existingLead = await prisma.lead.upsert({
                        where: { phone: targetPhone },
                        update: updateData,
                        create: createDataAfterSeminar
                    });
                } catch (upsertError) {
                    if (upsertError.code === 'P2002' && upsertError.meta?.target?.includes('phone')) {
                        await new Promise(resolve => setTimeout(resolve, 50)); 
                        existingLead = await prisma.lead.update({
                            where: { phone: targetPhone },
                            data: updateData
                        });
                    } else throw upsertError;
                }

                if (existingLead && (shouldUnassign || isNewBatchForLead)) {
                    await prisma.leadRoundProgress.deleteMany({
                        where: { leadId: existingLead.id }
                    }).catch(() => {});
                }

                await prisma.chatMessage.create({ 
                    data: { leadId: existingLead.id, message: messageText, mediaUrl: mediaUrl, mediaType: mediaType, direction: 'inbound', senderType: 'USER', senderName: name, metaMessageId: metaMsgId } 
                });

                try {
                    const { getIo } = require('./chatController');
                    const io = getIo();
                    if (io) {
                        io.emit('new_inbound_message', { leadId: existingLead.id, businessId: settings.businessId });
                        io.emit('lead_updated', { leadId: existingLead.id, businessId: settings.businessId });
                    }
                } catch (err) {}

                // 🔥 OPT IN KEYWORD CHECK (If they reply YES while opted out, remove opt-out lock)
                const allowKeywords = ['yes', 'ow', 'ha', settings.btnAllowText?.toLowerCase()].filter(Boolean);
                const isExplicitAction = interactiveId === "BTN_ALLOW" || allowKeywords.includes(msgLower);

                if (isExplicitAction) {
                    let dataToUpdate = {};
                    if (existingLead.isOptedOut) {
                        dataToUpdate.isOptedOut = false;
                        existingLead.isOptedOut = false;
                    }
                    if (existingLead.autoReplyStep === -1) {
                        dataToUpdate.autoReplyStep = 0;
                        existingLead.autoReplyStep = 0;
                    }
                    if (Object.keys(dataToUpdate).length > 0) {
                        await prisma.lead.update({ where: { id: existingLead.id }, data: dataToUpdate });
                    }
                }

                // 🔥 OPT OUT KEYWORD CHECK (Always run this, even if sequence is completed)
                const stopKeywords = ['stop', 'unsubscribe', 'epa', 'nepa', 'නතර කරන්න', settings.btnStopText?.toLowerCase()];
                if (stopKeywords.includes(msgLower) || interactiveId === "BTN_STOP") {
                    await prisma.lead.update({ where: { id: existingLead.id }, data: { isOptedOut: true } });
                    try {
                        const formattedPhone = phone.startsWith('0') ? '94' + phone.substring(1) : phone;
                        await axios.post(`https://graph.facebook.com/v19.0/${settings.waNumId}/messages`, {
                            messaging_product: "whatsapp", recipient_type: "individual", to: formattedPhone,
                            type: "text", text: { body: "ඔබ සාර්ථකව ඉවත් වී ඇත. තවත් පණිවිඩ නොයවනු ලැබේ.\nYou have successfully unsubscribed. No further messages will be sent." }
                        }, { headers: { 'Authorization': `Bearer ${settings.metaApiKey}` } });
                    } catch(e) {}
                    return res.status(200).send("EVENT_RECEIVED");
                }
                // 🔥 CALL PERMISSION CHECK 🔥
                const textLower = (messageText || '').toLowerCase().trim();
                const idLower = (interactiveId || '').toLowerCase().trim();

                const isTempAllow = idLower === "call_allow_temp" || idLower === "allow once" || idLower === "temp allow" || idLower === "temporarily allow calls" || idLower === "temporarily allow" || textLower === "allow once" || textLower === "temp allow" || textLower === "temporarily allow calls" || textLower === "temporarily allow" || textLower.includes("temporary") || (msgData?.callPermissionExpiryDate !== undefined && msgData?.callPermissionExpiryDate !== null);

                const isAlwaysAllow = idLower === "call_always_allow" || idLower === "call_allow" || idLower === "always allow" || idLower === "allow calls" || idLower === "yes, call me" || textLower === "always allow" || textLower === "allow calls" || textLower === "yes, call me" || (textLower.includes("granted") && textLower.includes("permission") && !textLower.includes("temporary") && !msgData?.callPermissionExpiryDate) || msgData?.interactive?.call_permission_reply?.response === "accept";

                if (isTempAllow || isAlwaysAllow) {
                    let expiryDate = null;
                    if (msgData?.callPermissionExpiryDate) {
                        expiryDate = msgData.callPermissionExpiryDate;
                    } else if (isTempAllow) {
                        expiryDate = new Date();
                        expiryDate.setDate(expiryDate.getDate() + 7);
                    }
                    
                    const updatedLead = await prisma.lead.update({ 
                        where: { id: existingLead.id }, 
                        data: { waCallPermissionStatus: 'ALLOWED', waCallPermissionExpiry: expiryDate, waCallPermissionNotified: false } 
                    });

                    await prisma.lead.updateMany({
                        where: {
                            OR: [
                                { phone: phone },
                                { phone: { startsWith: `${phone}_` } }
                            ],
                            id: { not: existingLead.id }
                        },
                        data: { waCallPermissionStatus: 'ALLOWED', waCallPermissionExpiry: expiryDate, waCallPermissionNotified: true }
                    });
                    
                    try {
                        const { getIo } = require('./chatController');
                        const io = getIo();
                        if (io) {
                            io.emit('wa_call_permission_granted', {
                                leadId: updatedLead.id,
                                phone: updatedLead.phone,
                                name: updatedLead.name,
                                campaignType: updatedLead.campaignType,
                                inquiryType: updatedLead.inquiryType,
                                status: 'ALLOWED',
                                expiry: expiryDate,
                                assignedTo: updatedLead.assignedTo
                            });
                        }
                    } catch(e) { console.error("Socket emit failed for wa_call_permission_granted:", e); }
                    
                    try {
                        const formattedPhone = phone.startsWith('0') ? '94' + phone.substring(1) : phone;
                        await axios.post(`https://graph.facebook.com/v19.0/${settings.waNumId}/messages`, {
                            messaging_product: "whatsapp", recipient_type: "individual", to: formattedPhone,
                            type: "text", text: { body: "ස්තුතියි! අපි ඔබව ඉක්මනින්ම සම්බන්ධ කරගන්නෙමු.\nThank you! We will call you soon." }
                        }, { headers: { 'Authorization': `Bearer ${settings.metaApiKey}` } });
                    } catch(e) {}
                    return res.status(200).send("EVENT_RECEIVED");
                }

                const isDisallow = idLower === "call_disallow" || idLower === "no, don't call" || idLower === "disallow" || idLower === "not now" || textLower === "no, don't call" || textLower === "disallow" || textLower === "not now";
                if (isDisallow) {
                    const updatedLead = await prisma.lead.update({ 
                        where: { id: existingLead.id }, 
                        data: { waCallPermissionStatus: 'DISALLOWED', waCallPermissionExpiry: null } 
                    });

                    await prisma.lead.updateMany({
                        where: {
                            OR: [
                                { phone: phone },
                                { phone: { startsWith: `${phone}_` } }
                            ],
                            id: { not: existingLead.id }
                        },
                        data: { waCallPermissionStatus: 'DISALLOWED', waCallPermissionExpiry: null }
                    });

                    try {
                        const { getIo } = require('./chatController');
                        const io = getIo();
                        if (io) {
                            io.emit('wa_call_permission_updated', {
                                leadId: updatedLead.id,
                                phone: updatedLead.phone,
                                status: 'DISALLOWED',
                                expiry: null
                            });
                        }
                    } catch(e) {}
                    
                    try {
                        const formattedPhone = phone.startsWith('0') ? '94' + phone.substring(1) : phone;
                        await axios.post(`https://graph.facebook.com/v19.0/${settings.waNumId}/messages`, {
                            messaging_product: "whatsapp", recipient_type: "individual", to: formattedPhone,
                            type: "text", text: { body: "ඔබගේ තීරණයට ගරු කරමු. අපි ඔබව අමතන්නේ නැත.\nUnderstood. We will not call you." }
                        }, { headers: { 'Authorization': `Bearer ${settings.metaApiKey}` } });
                    } catch(e) {}
                    return res.status(200).send("EVENT_RECEIVED");
                }

                const botAllowed = ['ON', 'AUTO_REPLY_ONLY', 'AUTO_FOLLOW_UP'].includes(settings?.botMode);
                
                // Allow if not spamming OR if they explicitly triggered YES (they might click fast)
                if (botAllowed && !existingLead.sequenceCompleted && (!isSpamming || isExplicitAction) && !isFollowUpReply && !existingLead.isOptedOut) {
                    
                    console.log("=== AUTO REPLY DEBUG ===");
                    console.log("Existing Lead AutoReplyStep:", existingLead.autoReplyStep);
                    console.log("Interactive ID:", interactiveId);
                    console.log("Message:", msgLower);
                    console.log("Allow Keywords:", allowKeywords);
                    console.log("Is Explicit Action:", isExplicitAction);

                    if (isExplicitAction) {
                        // Let it fall through to step 1
                        console.log("✅ Matched ALLOW Keyword! Falling through...");
                    } else if ((existingLead.autoReplyStep === 0 || !existingLead.autoReplyStep) && settings.welcomeMessageText && settings.btnAllowText && settings.btnStopText) {
                        try {
                            const formattedPhone = phone.startsWith('0') ? '94' + phone.substring(1) : phone;
                            const payload = {
                                messaging_product: "whatsapp",
                                recipient_type: "individual",
                                to: formattedPhone,
                                type: "interactive",
                                interactive: {
                                    type: "button",
                                    body: { text: settings.welcomeMessageText },
                                    action: {
                                        buttons: [
                                            { type: "reply", reply: { id: "BTN_ALLOW", title: settings.btnAllowText.substring(0, 20) } },
                                            { type: "reply", reply: { id: "BTN_STOP", title: settings.btnStopText.substring(0, 20) } }
                                        ]
                                    }
                                }
                            };
                            const metaRes = await axios.post(`https://graph.facebook.com/v19.0/${settings.waNumId}/messages`, payload, { headers: { 'Authorization': `Bearer ${settings.metaApiKey}` } });
                            await prisma.chatMessage.create({ data: { leadId: existingLead.id, message: settings.welcomeMessageText, direction: 'outbound', senderType: 'SYSTEM', senderName: 'AutoBot', metaMessageId: metaRes.data?.messages?.[0]?.id } });
                            
                            // 🔥 Mark as sent so it doesn't spam them again!
                            await prisma.lead.update({ where: { id: existingLead.id }, data: { autoReplyStep: -1 } });
                        } catch(e) {
                            console.error("Failed to send Welcome Buttons", e.response?.data);
                        }
                        return res.status(200).send("EVENT_RECEIVED");
                    } else if (existingLead.autoReplyStep === -1) {
                        // 🔥 They are in the welcome phase but didn't say YES yet. Do NOT send anything!
                        return res.status(200).send("EVENT_RECEIVED");
                    }

                    console.log("DEBUG: existingLead.autoReplyStep =", existingLead.autoReplyStep);
                    const autoReplies = await prisma.autoReply.findMany({ 
                        where: { campaignType: 'AFTER_SEMINAR', businessId: settings.businessId }, 
                        orderBy: { stepOrder: 'asc' } 
                    });
                    
                    if (autoReplies.length > 0) {
                        const currentStep = existingLead.autoReplyStep || 0;
                        const futureReplies = autoReplies.filter(r => r.stepOrder > currentStep);

                        console.log("DEBUG: futureReplies.length =", futureReplies.length, "targetStep=", futureReplies.length > 0 ? futureReplies[0].stepOrder : 'none');
                        if (futureReplies.length > 0) {
                            const targetStep = futureReplies[0].stepOrder;
                            const possibleReplies = futureReplies.filter(r => r.stepOrder === targetStep);
                            const nextReply = possibleReplies[Math.floor(Math.random() * possibleReplies.length)];

                            let formattedPhone = phone.startsWith('0') ? '94' + phone.substring(1) : phone;
                            let metaPayload = { messaging_product: "whatsapp", recipient_type: "individual", to: formattedPhone };

                            const parsedMessage = nextReply.message;

                            let payloadsToSend = [];
                            if (nextReply.attachment) {
                                const attachmentPath = nextReply.attachment.startsWith('/') ? nextReply.attachment : `/${nextReply.attachment}`;
                                const liveMediaUrl = `https://imacampus.online${attachmentPath}`; 
                                
                                if (nextReply.attachmentType === 'Audio') { 
                                    if (parsedMessage && parsedMessage.trim() !== '') {
                                        payloadsToSend.push({ ...metaPayload, type: "text", text: { body: parsedMessage } });
                                    }
                                    payloadsToSend.push({ ...metaPayload, type: "audio", audio: { link: liveMediaUrl } });
                                } else {
                                    if (nextReply.attachmentType === 'Image') { metaPayload.type = "image"; metaPayload.image = { link: liveMediaUrl, caption: parsedMessage || "" }; } 
                                    else if (nextReply.attachmentType === 'Video') { metaPayload.type = "video"; metaPayload.video = { link: liveMediaUrl, caption: parsedMessage || "" }; } 
                                    else { metaPayload.type = "document"; metaPayload.document = { link: liveMediaUrl, caption: parsedMessage || "" }; }
                                    payloadsToSend.push(metaPayload);
                                }
                            } else if (parsedMessage && parsedMessage.trim() !== '') { 
                                payloadsToSend.push({ ...metaPayload, type: "text", text: { body: parsedMessage } });
                            }

                            const sendAutoReply = async () => {
                                console.log("DEBUG: EXECUTING sendAutoReply step", nextReply.stepOrder);
                                try {
                                    const isLastStep = autoReplies[autoReplies.length - 1].id === nextReply.id;
                                    await prisma.lead.update({ where: { id: existingLead.id }, data: { autoReplyStep: nextReply.stepOrder, sequenceCompleted: isLastStep } });
                                    
                                    let lastMetaMessageId = null;
                                    for (const payload of payloadsToSend) {
                                        const metaRes = await axios.post(`https://graph.facebook.com/v19.0/${settings.waNumId}/messages`, payload, { headers: { 'Authorization': `Bearer ${settings.metaApiKey}` } });
                                        if (metaRes.data?.messages?.[0]?.id) lastMetaMessageId = metaRes.data.messages[0].id;
                                    }
                                    
                                    await prisma.chatMessage.create({ data: { leadId: existingLead.id, message: parsedMessage || '', mediaUrl: nextReply.attachment, mediaType: nextReply.attachmentType, direction: 'outbound', senderType: 'SYSTEM', senderName: 'AutoBot', metaMessageId: lastMetaMessageId } });
                                } catch (sendErr) {
                                    console.log(`🔴 ERROR: Meta API rejected the AFTER_SEMINAR auto-reply!`);
                                    console.log(`Payload Sent:`, JSON.stringify(payloadsToSend, null, 2));
                                    console.log(`Error Details:`, sendErr.response?.data || sendErr.message);
                                }
                            };

                            console.log("DEBUG: SCHEDULING AUTO REPLY step", nextReply.stepOrder);
                            const delayMs = Math.floor(Math.random() * (8000 - 3000 + 1)) + 3000; // 3 to 8 seconds delay
                            setTimeout(sendAutoReply, delayMs);
                        }
                    }
                }
                return res.status(200).send("EVENT_RECEIVED");
            }

            // ========================================================
            // 2. FREE SEMINAR MESSAGE EKAK NAM
            // ========================================================
            if (settings.campaignType === 'FREE_SEMINAR') {
                const msgLower = (messageText || "").toLowerCase().trim();
                const isRestartCommand = ['hi', 'hello', 'hey', 'menu', 'start'].includes(msgLower);
                
                const exactBizRegex = new RegExp(`_BIZ_${settings.businessId}(_|$)`);
                const candidateMatchingLeads = await prisma.lead.findMany({
                    where: { 
                        phone: { contains: phoneSuffix },
                        campaignType: 'FREE_SEMINAR'
                    },
                    include: { _count: { select: { messages: true } } },
                    orderBy: { updatedAt: 'desc' }
                });

                const allMatchingLeads = candidateMatchingLeads.filter(l => {
                    if (!exactBizRegex.test(l.phone)) return false;
                    const lBase = (l.phone || '').split('_')[0].replace(/[^0-9]/g, '');
                    return lBase.endsWith(phoneSuffix);
                });

                allMatchingLeads.sort((a, b) => {
                    const aBase = (a.phone || '').split('_')[0].replace(/[^0-9]/g, '');
                    const bBase = (b.phone || '').split('_')[0].replace(/[^0-9]/g, '');
                    const aValid = aBase.length <= 11 ? 1 : 0;
                    const bValid = bBase.length <= 11 ? 1 : 0;
                    if (aValid !== bValid) return bValid - aValid;

                    const aAssigned = a.assignedTo ? 1 : 0;
                    const bAssigned = b.assignedTo ? 1 : 0;
                    if (aAssigned !== bAssigned) return bAssigned - aAssigned;

                    const aMsgs = a._count?.messages || 0;
                    const bMsgs = b._count?.messages || 0;
                    if (aMsgs !== bMsgs) return bMsgs - aMsgs;

                    return new Date(b.updatedAt) - new Date(a.updatedAt);
                });

                let existingLeadCheck = allMatchingLeads.length > 0 ? allMatchingLeads[0] : null;
                const timeSinceLastMsg = existingLeadCheck && existingLeadCheck.updatedAt ? new Date() - new Date(existingLeadCheck.updatedAt) : 10000;
                
                const isSpamming = timeSinceLastMsg < 10000; 
                
                let resetData = {};
                if (isRestartCommand || timeSinceLastMsg > 43200000) { 
                    resetData = { autoReplyStep: 0, sequenceCompleted: false };
                }

                let createDataFreeSeminar = { 
                    name: name, phone: dbPhone, source: 'whatsapp', campaignType: 'FREE_SEMINAR', 
                    lastMessage: messageText || 'Received Media', lastMessageAt: new Date(), unreadCount: 1, status: 'NEW', 
                    phase: 1, callStatus: 'pending', autoReplyStep: 0, sequenceCompleted: false 
                };

                if (parsedBatchId) createDataFreeSeminar.batch = { connect: { id: parsedBatchId } };

                let targetPhone = existingLeadCheck ? existingLeadCheck.phone : dbPhone;

                // 🔥 Prevent Unique Constraint Error if targetPhone already exists as something else
                if (!existingLeadCheck) {
                    const exactMatch = await prisma.lead.findUnique({ where: { phone: targetPhone } });
                    if (exactMatch) {
                        targetPhone = `${targetPhone}_FS_${Date.now()}`;
                        createDataFreeSeminar.phone = targetPhone;
                    }
                }

                let existingLead = await prisma.lead.upsert({
                    where: { phone: targetPhone },
                    update: { name: name, lastMessage: messageText || 'Received Media', lastMessageAt: new Date(), unreadCount: { increment: 1 }, status: existingLeadCheck?.assignedTo ? 'OPEN' : 'NEW', updatedAt: new Date(), ...resetData },
                    create: createDataFreeSeminar
                });

                await prisma.chatMessage.create({ 
                    data: { 
                        leadId: existingLead.id, 
                        message: messageText, 
                        mediaUrl: mediaUrl, 
                        mediaType: mediaType, 
                        direction: 'inbound', 
                        senderType: 'USER', 
                        senderName: name, 
                        metaMessageId: metaMsgId 
                    } 
                });

                const botAllowed = ['ON', 'AUTO_REPLY_ONLY', 'AUTO_FOLLOW_UP'].includes(settings?.botMode);
                const allowKeywords = ['yes', 'ow', 'ha', settings.btnAllowText?.toLowerCase()].filter(Boolean);
                const isExplicitAction = interactiveId === "BTN_ALLOW" || allowKeywords.includes(msgLower);
                
                if (botAllowed && !existingLead.sequenceCompleted && (!isSpamming || isExplicitAction) && !isFollowUpReply) {
                    if (isExplicitAction && existingLead.autoReplyStep === -1) {
                        await prisma.lead.update({ where: { id: existingLead.id }, data: { autoReplyStep: 0 } });
                        existingLead.autoReplyStep = 0;
                    }
                    const autoReplies = await prisma.autoReply.findMany({ where: { campaignType: 'FREE_SEMINAR', businessId: settings.businessId }, orderBy: { stepOrder: 'asc' } });
                    if (autoReplies.length > 0) {
                        const currentStep = existingLead.autoReplyStep || 0;
                        const nextReply = autoReplies.find(r => r.stepOrder > currentStep);

                        if (nextReply) {
                            let formattedPhone = phone.startsWith('0') ? '94' + phone.substring(1) : phone;
                            let metaPayload = { messaging_product: "whatsapp", recipient_type: "individual", to: formattedPhone };

                            if (nextReply.attachment) {
                                const attachmentPath = nextReply.attachment.startsWith('/') ? nextReply.attachment : `/${nextReply.attachment}`;
                                const liveMediaUrl = `https://imacampus.online${attachmentPath}`; 
                                if (nextReply.attachmentType === 'Image') { metaPayload.type = "image"; metaPayload.image = { link: liveMediaUrl, caption: nextReply.message || "" }; } 
                                else if (nextReply.attachmentType === 'Video') { metaPayload.type = "video"; metaPayload.video = { link: liveMediaUrl, caption: nextReply.message || "" }; } 
                                else { metaPayload.type = "document"; metaPayload.document = { link: liveMediaUrl, caption: nextReply.message || "" }; }
                            } else { 
                                metaPayload.type = "text"; metaPayload.text = { body: nextReply.message }; 
                            }

                            try {
                                const metaRes = await axios.post(`https://graph.facebook.com/v19.0/${settings.waNumId}/messages`, metaPayload, { headers: { 'Authorization': `Bearer ${settings.metaApiKey}` } });
                                await prisma.chatMessage.create({ data: { leadId: existingLead.id, message: nextReply.message, mediaUrl: nextReply.attachment, mediaType: nextReply.attachmentType, direction: 'outbound', senderType: 'SYSTEM', senderName: 'AutoBot', metaMessageId: metaRes.data?.messages?.[0]?.id } });
                                const isLastStep = autoReplies[autoReplies.length - 1].id === nextReply.id;
                                await prisma.lead.update({ where: { id: existingLead.id }, data: { autoReplyStep: nextReply.stepOrder, sequenceCompleted: isLastStep } });
                            } catch (sendErr) {
                                console.log(`🔴 ERROR: Meta API rejected the FREE_SEMINAR auto-reply!`);
                                console.log(`Payload Sent:`, JSON.stringify(metaPayload, null, 2));
                                console.log(`Error Details:`, sendErr.response?.data || sendErr.message);
                            }
                        }
                    }
                }
                return res.status(200).send("EVENT_RECEIVED");
            }
        }
        res.status(200).send("EVENT_RECEIVED");
    } catch (error) { 
        console.error("Webhook Error:", error);
        res.status(500).send("ERROR"); 
    }
};

exports.getMessages = async (req, res) => {
    try {
        const { leadId } = req.params;
        const parsedLeadId = parseInt(leadId);
        if (isNaN(parsedLeadId)) return res.status(400).json({ error: "Invalid lead ID" });

        await prisma.lead.update({ where: { id: parsedLeadId }, data: { unreadCount: 0 } }).catch(() => {});
        const messages = await prisma.chatMessage.findMany({ where: { leadId: parsedLeadId }, orderBy: { createdAt: 'asc' } });
        res.status(200).json(messages);
    } catch (error) { 
        console.error("Error in afterSeminar getMessages:", error);
        res.status(500).json({ error: "Failed to fetch messages" }); 
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const { leadId, message, senderName, replyToMetaId, localUIMessage, isTemplate, templateName, templateLanguage } = req.body; 
        
        const lead = await prisma.lead.findUnique({ where: { id: parseInt(leadId) } });
        if (!lead) return res.status(404).json({ error: "Lead not found" });

        if (lead.isBlocked || await isNumberBlockedHelper(lead.phone)) {
            return res.status(400).json({ error: "This phone number is blocked. Please unblock the contact first to send messages." });
        }

        if (lead.isOptedOut) {
            // Un-opt-out lead when staff manually sends a message so chat stays active
            await prisma.lead.update({ where: { id: lead.id }, data: { isOptedOut: false } }).catch(() => {});
        }
        
        let formattedPhone = lead.phone.split('_')[0].replace(/[^0-9]/g, ''); 
        if (formattedPhone.startsWith('0')) formattedPhone = '94' + formattedPhone.substring(1);

        const bizMatch = lead.phone.match(/_BIZ_(\d+)/);
        const extractedBizId = bizMatch ? parseInt(bizMatch[1]) : null;

        let mediaUrl = null; let mediaType = null;
        if (req.file) { 
            mediaUrl = `/storage/documents/${req.file.filename}`; 
            mediaType = req.file.mimetype; 

            const origLower = (req.file.originalname || '').toLowerCase();
            const isVoiceOrAudio = 
                mediaType.includes('audio') || 
                mediaType.includes('webm') || 
                mediaType.includes('ogg') || 
                mediaType.includes('opus') || 
                origLower.endsWith('.webm') || 
                origLower.endsWith('.ogg') || 
                origLower.endsWith('.mp3') || 
                origLower.endsWith('.m4a') || 
                origLower.endsWith('.wav') || 
                origLower.endsWith('.aac') ||
                origLower.startsWith('voice_note_');
            
            // ==================================================================================================
            // 🚨🚨🚨 CRITICAL AI INSTRUCTION - DO NOT REMOVE OR MODIFY THIS AUDIO CONVERSION BLOCK 🚨🚨🚨
            // ==================================================================================================
            // IPHONE / IOS WHATSAPP VOICE NOTE FIX: 
            // Meta API strictly requires Voice Notes to be encoded as "audio/ogg; codecs=opus" and sent via Media ID (not URL).
            // If this ffmpeg conversion is removed, iPhones WILL NOT be able to play the voice notes!
            // ==================================================================================================
            if (isVoiceOrAudio) {
                const inputPath = path.join(process.cwd(), 'storage/documents', req.file.filename);
                const outputFilename = `VN_CONVERTED_${Date.now()}.ogg`;
                const outputPath = path.join(process.cwd(), 'storage/documents', outputFilename);
                
                try {
                    await new Promise((resolve, reject) => {
                        ffmpeg(inputPath)
                            .audioCodec('libopus')
                            .audioBitrate('32k')
                            .audioChannels(1)
                            .audioFrequency(48000)
                            .outputOptions([
                                '-application voip',
                                '-avoid_negative_ts make_zero',
                                '-map_metadata -1'
                            ])
                            .toFormat('ogg')
                            .on('end', () => resolve())
                            .on('error', (err) => reject(err))
                            .save(outputPath);
                    });
                    
                    mediaUrl = `/storage/documents/${outputFilename}`;
                    mediaType = 'audio/ogg; codecs=opus';
                } catch (error) {
                    console.error("Audio conversion failed:", error);
                }
            }
        }

        const newMsg = await prisma.chatMessage.create({
            data: {
                leadId: parseInt(leadId), message: localUIMessage || message || '', mediaUrl, mediaType,
                direction: 'outbound', senderType: 'STAFF', senderId: req.user?.id || null, senderName: senderName || req.user?.firstName || 'Staff'
            }
        });

        const safeLastMessage = message 
            ? Array.from(message).slice(0, 30).join('') 
            : (mediaUrl ? 'Sent Media' : 'Sent Message');

        await prisma.lead.update({
            where: { id: parseInt(leadId) },
            data: { lastMessage: safeLastMessage, status: 'OPEN', updatedAt: new Date() }
        });

        try {
            let settings = null;
            if (extractedBizId) {
                settings = await prisma.crmSettings.findFirst({ 
                    where: { businessId: extractedBizId, campaignType: lead.campaignType || 'AFTER_SEMINAR' } 
                });
            }
            if (!settings && lead.batchId) {
                const batchRecord = await prisma.batch.findUnique({ where: { id: lead.batchId } });
                if (batchRecord) {
                    settings = await prisma.crmSettings.findFirst({ 
                        where: { businessId: batchRecord.businessId, campaignType: lead.campaignType || 'AFTER_SEMINAR' } 
                    });
                    if (!settings) {
                        settings = await prisma.crmSettings.findFirst({ where: { businessId: batchRecord.businessId } });
                    }
                }
            }
            if (!settings && extractedBizId) {
                settings = await prisma.crmSettings.findFirst({ where: { businessId: extractedBizId } });
            }
            if (!settings) {
                settings = await prisma.crmSettings.findFirst({ where: { campaignType: lead.campaignType || 'AFTER_SEMINAR' } });
            }
            if (!settings) {
                settings = await prisma.crmSettings.findFirst();
            }

            if (settings && settings.metaApiKey && settings.waNumId) {
                let metaPayload = { messaging_product: "whatsapp", recipient_type: "individual", to: formattedPhone };
                
                if (replyToMetaId && replyToMetaId !== 'null' && replyToMetaId !== 'undefined' && isTemplate !== 'true') {
                    metaPayload.context = { message_id: replyToMetaId };
                }

                if (isTemplate === 'true') {
                    metaPayload.type = "template";
                    metaPayload.template = {
                        name: templateName,
                        language: {
                            code: templateLanguage || "en" 
                        }
                    };
                } 
                else if (message && !mediaUrl) {
                    metaPayload.type = "text"; 
                    metaPayload.text = { preview_url: false, body: message };
                } 
                else if (mediaUrl) {
                    const liveMediaUrl = `https://imacampus.online${mediaUrl}`; 
                    
                    const isAudio = mediaType.includes('audio') || 
                                    mediaType.includes('ogg') || 
                                    mediaUrl.toLowerCase().endsWith('.ogg') || 
                                    mediaUrl.toLowerCase().endsWith('.mp3') ||
                                    mediaUrl.toLowerCase().endsWith('.m4a');

                    if (isAudio) { 
                        let uploadedMediaId = null;
                        const localFilePath = path.join(process.cwd(), mediaUrl); 

                        if (fs.existsSync(localFilePath)) {
                            try {
                                // ==================================================================================================
                                // 🚨🚨🚨 CRITICAL AI INSTRUCTION - DO NOT REMOVE THIS FORMDATA UPLOAD LOGIC 🚨🚨🚨
                                // ==================================================================================================
                                // To render as a playable Voice Note on WhatsApp (especially for iOS), we MUST upload the audio
                                // file to Meta's /media endpoint via FormData with contentType 'audio/ogg; codecs=opus'.
                                // DO NOT change this to send the file via URL (link: liveMediaUrl). iPhones will fail to play it.
                                // ==================================================================================================
                                const FormData = require('form-data');
                                const formData = new FormData();
                                formData.append('messaging_product', 'whatsapp');
                                
                                const isOgg = mediaUrl.endsWith('.ogg') || mediaType.includes('ogg') || mediaType.includes('opus');
                                const uploadMime = isOgg ? 'audio/ogg; codecs=opus' : (mediaType || 'audio/ogg; codecs=opus');

                                formData.append('file', fs.createReadStream(localFilePath), {
                                    contentType: uploadMime,
                                    filename: path.basename(localFilePath)
                                });

                                const uploadRes = await axios.post(`https://graph.facebook.com/v19.0/${settings.waNumId}/media`, formData, {
                                    headers: { 
                                        'Authorization': `Bearer ${settings.metaApiKey}`,
                                        ...formData.getHeaders()
                                    }
                                });

                                if (uploadRes.data && uploadRes.data.id) {
                                    uploadedMediaId = uploadRes.data.id;
                                }
                            } catch (uploadErr) {
                                console.error("Failed to upload audio to Meta:", uploadErr?.response?.data || uploadErr.message);
                            }
                        }

                        metaPayload.type = "audio";
                        if (uploadedMediaId) {
                            metaPayload.audio = { id: uploadedMediaId };
                        } else {
                            metaPayload.audio = { link: liveMediaUrl };
                        }
                    } 
                    else if (mediaType.includes('image')) { 
                        metaPayload.type = "image";
                        metaPayload.image = { link: liveMediaUrl, caption: message || "" };
                    } 
                    else if (mediaType.includes('video')) { 
                        metaPayload.type = "video";
                        metaPayload.video = { link: liveMediaUrl, caption: message || "" };
                    } 
                    else { 
                        metaPayload.type = "document";
                        metaPayload.document = { 
                            link: liveMediaUrl, 
                            caption: message || "", 
                            filename: req.file ? req.file.originalname : "document.pdf" 
                        };
                    }
                }

                const metaRes = await axios.post(`https://graph.facebook.com/v19.0/${settings.waNumId}/messages`, metaPayload, { 
                    headers: { 'Authorization': `Bearer ${settings.metaApiKey}`, 'Content-Type': 'application/json' } 
                });
                
                if (metaRes.data?.messages?.[0]?.id) {
                    await prisma.chatMessage.update({ where: { id: newMsg.id }, data: { metaMessageId: metaRes.data.messages[0].id } });
                }
            }
            res.status(201).json(newMsg);
        } catch (metaError) { 
            console.error("Meta API Error:", metaError.response?.data || metaError.message);
            const metaErrData = metaError.response?.data?.error;

            // Handle Meta Code 138017: Student already approved permanent call permission
            if (metaErrData?.code === 138017) {
                const cleanPhone = lead.phone ? lead.phone.split('_')[0].replace(/[^0-9]/g, '') : '';
                if (cleanPhone) {
                    await prisma.lead.updateMany({
                        where: { phone: { contains: cleanPhone.slice(-9) } },
                        data: {
                            waCallPermissionStatus: 'ALLOWED',
                            waCallPermissionExpiry: null,
                            waCallPermissionNotified: true
                        }
                    }).catch(() => {});
                }

                await prisma.chatMessage.update({
                    where: { id: newMsg.id },
                    data: { message: "📞 ✅ Student has ALREADY granted permanent call permission (Confirmed by WhatsApp). You can call directly!" }
                }).catch(() => {});

                const io = req.app.get('socketio');
                if (io) {
                    io.emit('wa_call_permission_granted', {
                        leadId: lead.id,
                        phone: lead.phone,
                        expiry: null
                    });
                }

                return res.status(200).json({
                    ...newMsg,
                    message: "📞 ✅ Student has ALREADY granted permanent call permission (Confirmed by WhatsApp). You can call directly!",
                    alreadyAllowed: true
                });
            }

            // Handle Meta Code 138009: Permission request rate limit
            if (metaErrData?.code === 138009) {
                await prisma.chatMessage.delete({ where: { id: newMsg.id } }).catch(() => {});
                const errMsg = "Meta Limit Reached: A call permission request has already been sent to this student recently. Waiting for student to accept on WhatsApp.";
                return res.status(400).json({ error: errMsg, metaDetails: metaErrData, alreadySent: true });
            }

            // Delete the message from DB since Meta API rejected it
            await prisma.chatMessage.delete({ where: { id: newMsg.id } }).catch(() => {});
            
            let errMsg = metaErrData?.message || metaErrData?.error_data?.details || "Failed to send message via Meta API";
            return res.status(400).json({ error: errMsg, metaDetails: metaErrData });
        }
    } catch (error) { 
        console.error("SendMessage Error:", error);
        res.status(500).json({ error: "Failed to send message" }); 
    }
};

exports.sendReaction = async (req, res) => {
    try {
        const { leadId, metaMessageId, emoji } = req.body;
        if (!metaMessageId) return res.status(400).json({ error: "No Meta Message ID provided" });
        const lead = await prisma.lead.findUnique({ where: { id: parseInt(leadId) } });
        let formattedPhone = lead.phone.split('_')[0].replace(/[^0-9]/g, ''); 
        if (formattedPhone.startsWith('0')) formattedPhone = '94' + formattedPhone.substring(1);

        let settings;
        if (lead.batchId) {
            const batchRecord = await prisma.batch.findUnique({ where: { id: lead.batchId } });
            if (batchRecord) settings = await prisma.crmSettings.findFirst({ where: { businessId: batchRecord.businessId, campaignType: lead.campaignType } });
        } else {
            settings = await prisma.crmSettings.findFirst({ where: { campaignType: lead.campaignType } });
        }

        if (settings && settings.metaApiKey && settings.waNumId) {
            await axios.post(`https://graph.facebook.com/v19.0/${settings.waNumId}/messages`, { messaging_product: "whatsapp", recipient_type: "individual", to: formattedPhone, type: "reaction", reaction: { message_id: metaMessageId, emoji: emoji } }, { headers: { 'Authorization': `Bearer ${settings.metaApiKey}` } });
            res.status(200).json({ success: true });
        }
    } catch (error) { res.status(500).json({ error: "Failed to send reaction" }); }
};

exports.sendBroadcast = async (req, res) => {
    try {
        const { leadIds, type, message, templateName } = req.body;
        const parsedLeadIds = typeof leadIds === 'string' ? JSON.parse(leadIds) : leadIds;
        const leads = await prisma.lead.findMany({ where: { id: { in: parsedLeadIds } } });
        const settings = await prisma.crmSettings.findFirst({ where: { campaignType: 'AFTER_SEMINAR' } });

        if (!settings?.metaApiKey) return res.status(400).json({ error: "Meta Config Missing" });

        let mediaUrl = null; let mediaType = null;
        if (req.file) { mediaUrl = `/storage/documents/${req.file.filename}`; mediaType = req.file.mimetype; }

        let results = { success: 0, failed: 0, reasons: [] };

        for (const lead of leads) {
            if (lead.isOptedOut) {
                results.failed += 1; results.reasons.push({ phone: lead.phone, error: "User opted out" });
                continue;
            }

            let formattedPhone = lead.phone.split('_')[0].replace(/[^0-9]/g, ''); 
            if (formattedPhone.startsWith('0')) formattedPhone = '94' + formattedPhone.substring(1);
            let metaPayload = { messaging_product: "whatsapp", recipient_type: "individual", to: formattedPhone };

            if (type === '24H') {
                if (mediaUrl) {
                    const isWebmAudio = mediaType.includes('audio') || mediaType.includes('webm') || mediaUrl.endsWith('.webm') || mediaUrl.endsWith('.ogg');
                    
                    if (isWebmAudio) {
                        const path = require('path');
                        const fs = require('fs');
                        const ffmpeg = require('fluent-ffmpeg');
                        
                        const inputPath = path.join(process.cwd(), mediaUrl);
                        const outputFilename = `VN_BROADCAST_CONVERTED_${Date.now()}.ogg`;
                        const outputPath = path.join(process.cwd(), 'storage/documents', outputFilename);
                        
                        try {
                            await new Promise((resolve, reject) => {
                                ffmpeg(inputPath)
                                    .audioCodec('libopus')
                                    .audioBitrate('32k')
                                    .audioChannels(1)
                                    .audioFrequency(48000)
                                    .outputOptions([
                                        '-application voip',
                                        '-avoid_negative_ts make_zero',
                                        '-map_metadata -1'
                                    ])
                                    .toFormat('ogg')
                                    .on('end', () => resolve())
                                    .on('error', (err) => reject(err))
                                    .save(outputPath);
                            });
                            
                            const FormData = require('form-data');
                            const formData = new FormData();
                            formData.append('messaging_product', 'whatsapp');
                            formData.append('file', fs.createReadStream(outputPath), {
                                contentType: 'audio/ogg; codecs=opus',
                                filename: outputFilename
                            });

                            const axios = require('axios');
                            const uploadRes = await axios.post(`https://graph.facebook.com/v19.0/${settings.waNumId}/media`, formData, {
                                headers: { 'Authorization': `Bearer ${settings.metaApiKey}`, ...formData.getHeaders() }
                            });

                            if (uploadRes.data && uploadRes.data.id) {
                                metaPayload.type = "audio";
                                metaPayload.audio = { id: uploadRes.data.id };
                            } else {
                                metaPayload.type = "audio";
                                metaPayload.audio = { link: `https://imacampus.online/storage/documents/${outputFilename}` };
                            }
                        } catch (err) {
                            console.error("Broadcast Audio conversion failed:", err);
                            metaPayload.type = "document";
                            metaPayload.document = { link: `https://imacampus.online${mediaUrl}` };
                        }
                    } else {
                        const liveMediaUrl = `https://imacampus.online${mediaUrl}`;
                        if (mediaType.includes('image')) { metaPayload.type = "image"; metaPayload.image = { link: liveMediaUrl, caption: message || "" }; }
                        else if (mediaType.includes('pdf')) { metaPayload.type = "document"; metaPayload.document = { link: liveMediaUrl, caption: message || "", filename: req.file.originalname }; }
                        else if (mediaType.includes('video')) { metaPayload.type = "video"; metaPayload.video = { link: liveMediaUrl, caption: message || "" }; }
                    }
                } else {
                    metaPayload.type = "text"; metaPayload.text = { preview_url: true, body: message };
                }
            } else {
                metaPayload.type = "template"; 
                metaPayload.template = { name: templateName, language: { code: "en_US" } };
            }

            try {
                await axios.post(`https://graph.facebook.com/v19.0/${settings.waNumId}/messages`, metaPayload, { headers: { 'Authorization': `Bearer ${settings.metaApiKey}` } });
                results.success += 1;
            } catch (err) {
                results.failed += 1; results.reasons.push({ phone: formattedPhone, error: err.message });
            }
        }
        res.status(200).json(results);
    } catch (error) { res.status(500).json({ error: "Broadcast failed" }); }
};

exports.updateLeadBatch = async (req, res) => {
    try {
        const { leadId, batchId } = req.body;
        if (batchId && !isNaN(parseInt(batchId))) {
            const lead = await prisma.lead.findUnique({ where: { id: parseInt(leadId) } });
            if (lead && (lead.inquiryType === 'OPEN_SEMINAR' || lead.inquiryType === 'NORMAL')) {
                const isLocked = await isOpenSeminarLocked(parseInt(batchId));
                if (isLocked) {
                    return res.status(403).json({ error: "Opening Seminar campaign for this batch is locked by Management. Cannot allocate lead to this batch." });
                }
            }
        }
        const parsedLeadId = parseInt(leadId);
        await prisma.lead.update({
            where: { id: parsedLeadId },
            data: { 
                batchId: batchId ? parseInt(batchId) : null,
                callStatus: 'pending',
                openSemCallStatus: 'pending',
                newInqCallStatus: 'pending',
                phase: 1,
                openSemPhase: 1,
                newInqPhase: 1,
                callAttempt: 1,
                openSemCallAttempt: 1,
                newInqCallAttempt: 1,
                coordinationRound: 1,
                openSemRound: 1,
                newInqRound: 1,
                feedback: '',
                openSemFeedback: '',
                newInqFeedback: '',
                callMethod: null,
                openSemCallMethod: null,
                newInqCallMethod: null,
                nonEnrolledReason: null,
                r1DelayedDays: 0,
                r2DelayedDays: 0,
                lastAttemptAt: null
            }
        });
        await prisma.leadRoundProgress.deleteMany({
            where: { leadId: parsedLeadId }
        }).catch(() => {});
        res.status(200).json({ success: true, message: "Batch Updated!" });
    } catch (error) { 
        res.status(500).json({ error: "Failed to update batch" }); 
    }
};

exports.revertDeletedRound = async (req, res) => {
    try {
        const { roundToDelete, targetRound, inquiryType } = req.body;
        
        await prisma.lead.updateMany({
            where: { 
                coordinationRound: parseInt(roundToDelete),
                inquiryType: inquiryType
            },
            data: { 
                coordinationRound: parseInt(targetRound),
            }
        });

        res.status(200).json({ message: "Leads reverted back to default round successfully" });
    } catch (error) {
        console.error("Revert round error:", error);
        res.status(500).json({ error: "Failed to revert leads" });
    }
};

exports.testDirectFollowUp = async (req, res) => {
    try {
        const { leadId } = req.body;
        const lead = await prisma.lead.findUnique({ where: { id: parseInt(leadId) } });
        if (!lead) return res.status(404).json({ error: "Lead not found" });

        const bizMatch = lead.phone.match(/_BIZ_(\d+)/);
        const extractedBizId = bizMatch ? parseInt(bizMatch[1]) : null;

        const settings = await prisma.crmSettings.findFirst({ 
            where: { businessId: extractedBizId, campaignType: 'AFTER_SEMINAR' } 
        });

        if (!settings || !settings.metaApiKey || !settings.waNumId) {
            return res.status(400).json({ error: "Meta Config missing for this business" });
        }

        let formattedPhone = lead.phone.split('_')[0].replace(/[^0-9]/g, ''); 
        if (formattedPhone.startsWith('0')) formattedPhone = '94' + formattedPhone.substring(1);

        let metaPayload = {
            messaging_product: "whatsapp", 
            recipient_type: "individual", 
            to: formattedPhone, 
            type: "interactive",
            interactive: { 
                type: "button", 
                body: { text: "ආයුබෝවන් පුතේ, ඔයාගේ ගැටලුවට විසඳුමක් හම්බුනාද?" }, 
                action: { buttons: [ { type: "reply", reply: { id: "FU_YES", title: "ඔව්" } }, { type: "reply", reply: { id: "FU_NO", title: "නැත" } } ] } 
            }
        };

        const metaRes = await axios.post(`https://graph.facebook.com/v19.0/${settings.waNumId}/messages`, metaPayload, { headers: { 'Authorization': `Bearer ${settings.metaApiKey}` } });
        
        await prisma.chatMessage.create({ 
            data: { leadId: lead.id, message: "Follow-Up Auto Sent", direction: 'outbound', senderType: 'SYSTEM', senderName: 'SystemBot', metaMessageId: metaRes.data?.messages?.[0]?.id } 
        });

        res.status(200).json({ message: "Test Follow-up sent successfully!" });
    } catch (error) {
        console.error("Test FollowUp Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to send test follow-up" });
    }
};

exports.getMetaTemplates = async (req, res) => {
    try {
        const { businessId } = req.query;
        console.log("\n=== DEBUG: GET META TEMPLATES ===");
        console.log("1. Received Business ID:", businessId);

        let settings = null;
        if (businessId && businessId !== 'undefined' && businessId !== 'null') {
            settings = await prisma.crmSettings.findFirst({
                where: { 
                    businessId: parseInt(businessId), 
                    campaignType: 'AFTER_SEMINAR',
                    metaApiKey: { not: null }
                }
            });
            if (!settings) {
                settings = await prisma.crmSettings.findFirst({
                    where: { businessId: parseInt(businessId), metaApiKey: { not: null } }
                });
            }
        }

        if (!settings) {
            settings = await prisma.crmSettings.findFirst({
                where: { campaignType: 'AFTER_SEMINAR', metaApiKey: { not: null } }
            });
        }

        if (!settings) {
            settings = await prisma.crmSettings.findFirst({
                where: { metaApiKey: { not: null }, waId: { not: null } }
            });
        }

        if (!settings || !settings.metaApiKey || !settings.waId) {
            console.log("Error: Missing API Keys or waId in DB");
            return res.status(404).json({ error: "WhatsApp API credentials missing." });
        }

        console.log(`3. Calling Meta API for waId: ${settings.waId}`);

        const metaResponse = await axios.get(`https://graph.facebook.com/v19.0/${settings.waId}/message_templates`, {
            params: { status: 'APPROVED', limit: 100 },
            headers: { Authorization: `Bearer ${settings.metaApiKey}` }
        });

        console.log("4. Meta API Raw Response (Templates Count):", metaResponse.data?.data?.length);

        const templates = metaResponse.data.data.map(tpl => {
            const bodyComponent = tpl.components.find(c => c.type === 'BODY');
            return {
                id: tpl.id,
                name: tpl.name,
                language: tpl.language,
                text: bodyComponent ? bodyComponent.text : 'Media/Interactive Template (No Body Text)',
                rawComponents: tpl.components
            };
        });

        console.log("5. Formatted Templates Sent to Frontend:", templates.length);
        console.log("=================================\n");
        res.status(200).json(templates);

    } catch (error) {
        console.error("\n=== META API ERROR ===");
        console.error("Error Status:", error.response?.status);
        console.error("Error Data:", error.response?.data || error.message);
        console.error("======================\n");
        res.status(500).json({ error: "Failed to fetch templates from Meta API." });
    }
};
exports.sendOptInRequest = async (req, res) => {
    try {
        const { leadId } = req.body;
        const axios = require('axios');

        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) return res.status(404).json({ error: "Lead not found" });

        let settings;
        if (lead.batchId) {
            const batchRecord = await prisma.batch.findUnique({ where: { id: lead.batchId } });
            if (batchRecord) settings = await prisma.crmSettings.findFirst({ where: { businessId: batchRecord.businessId, campaignType: lead.campaignType || 'AFTER_SEMINAR' } });
        } else {
            settings = await prisma.crmSettings.findFirst({ where: { campaignType: lead.campaignType || 'AFTER_SEMINAR' } });
        }

        if (!settings || !settings.welcomeMessageText || !settings.btnAllowText || !settings.btnStopText) {
            return res.status(400).json({ error: "Welcome message settings not configured for this campaign" });
        }

        const actualPhone = lead.phone.split('_')[0];
        const formattedPhone = actualPhone.startsWith('0') ? '94' + actualPhone.substring(1) : actualPhone;
        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedPhone,
            type: "interactive",
            interactive: {
                type: "button",
                body: { text: settings.welcomeMessageText },
                action: {
                    buttons: [
                        { type: "reply", reply: { id: "BTN_ALLOW", title: settings.btnAllowText.substring(0, 20) } },
                        { type: "reply", reply: { id: "BTN_STOP", title: settings.btnStopText.substring(0, 20) } }
                    ]
                }
            }
        };

        const metaRes = await axios.post(`https://graph.facebook.com/v19.0/${settings.waNumId}/messages`, payload, { headers: { 'Authorization': `Bearer ${settings.metaApiKey}` } });
        await prisma.chatMessage.create({ data: { leadId: lead.id, message: settings.welcomeMessageText, direction: 'outbound', senderType: 'SYSTEM', senderName: 'AutoBot', metaMessageId: metaRes.data?.messages?.[0]?.id } });
        
        res.status(200).json({ message: "Opt-in request sent successfully" });
    } catch (error) {
        console.error("Error in sendOptInRequest:", error);
        res.status(500).json({ error: "Failed to send opt-in request." });
    }
};

const callTemplateCache = new Map();

exports.sendCallPermissionRequest = async (req, res) => {
    try {
        const { leadId } = req.body;
        const axios = require('axios');

        const lead = await prisma.lead.findUnique({ where: { id: parseInt(leadId) } });
        if (!lead) return res.status(404).json({ error: "Lead not found" });

        const bizMatch = lead.phone.match(/_BIZ_(\d+)/);
        const extractedBizId = bizMatch ? parseInt(bizMatch[1], 10) : null;

        let settings = null;
        if (extractedBizId) {
            settings = await prisma.crmSettings.findFirst({ where: { businessId: extractedBizId, campaignType: lead.campaignType || 'AFTER_SEMINAR' } });
        }
        if (!settings && lead.batchId) {
            const batchRecord = await prisma.batch.findUnique({ where: { id: lead.batchId } });
            if (batchRecord) {
                settings = await prisma.crmSettings.findFirst({ where: { businessId: batchRecord.businessId, campaignType: lead.campaignType || 'AFTER_SEMINAR' } });
                if (!settings) settings = await prisma.crmSettings.findFirst({ where: { businessId: batchRecord.businessId } });
            }
        }
        if (!settings && extractedBizId) {
            settings = await prisma.crmSettings.findFirst({ where: { businessId: extractedBizId } });
        }
        if (!settings) {
            settings = await prisma.crmSettings.findFirst({ where: { campaignType: lead.campaignType || 'AFTER_SEMINAR' } });
        }
        if (!settings) {
            settings = await prisma.crmSettings.findFirst();
        }

        if (!settings || !settings.metaApiKey || !settings.waNumId) {
            return res.status(400).json({ error: "WhatsApp API settings not configured." });
        }
        const actualPhone = lead.phone.split('_')[0];
        const formattedPhone = actualPhone.startsWith('0') ? '94' + actualPhone.substring(1) : actualPhone;

        let templateName = null;
        if (settings.waId) {
            templateName = callTemplateCache.get(settings.waId);
            if (!templateName) {
                try {
                    const resTemplates = await axios.get(`https://graph.facebook.com/v19.0/${settings.waId}/message_templates`, {
                        headers: { Authorization: `Bearer ${settings.metaApiKey}` }
                    });
                    const callReqs = resTemplates.data.data.filter(t => t.name.startsWith('call_request') && t.status === 'APPROVED');
                    if (callReqs.length > 0) {
                        // Sort by name descending so call_request_03 is chosen over 01
                        callReqs.sort((a, b) => b.name.localeCompare(a.name));
                        templateName = callReqs[0].name;
                    } else {
                        templateName = "call_request_03";
                    }
                } catch (err) {
                    console.error("Failed to fetch templates for waId " + settings.waId + ":", err.message);
                    templateName = "call_request_03";
                }
                // ALWAYS cache it so we don't fetch repeatedly
                callTemplateCache.set(settings.waId, templateName);
            }
        } else {
            templateName = "call_request_03"; // fallback if waId is null
        }
        
        const messageText = "අපට ඔබව ඇමතීමට අවසර දිය හැකිද? / Can we call you to explain details?";
        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedPhone,
            type: "template",
            template: {
                name: templateName,
                language: {
                    code: "en"
                }
            }
        };

        console.log("\n=== DEBUG: SEND CALL PERMISSION REQUEST ===");
        console.log(`Lead ID: ${lead.id} | Phone: ${lead.phone} | Formatted: ${formattedPhone}`);
        console.log(`Campaign: ${lead.campaignType} | Biz ID: ${settings.businessId}`);
        console.log(`Using WaNumId: ${settings.waNumId}`);
        console.log("Payload:", JSON.stringify(payload, null, 2));

        const metaRes = await axios.post(`https://graph.facebook.com/v19.0/${settings.waNumId}/messages`, payload, { headers: { 'Authorization': `Bearer ${settings.metaApiKey}` } });
        
        console.log("Meta API Response Success:", metaRes.data);
        console.log("===========================================\n");

        await prisma.chatMessage.create({ 
            data: { 
                leadId: lead.id, 
                message: messageText, 
                direction: 'outbound', 
                senderType: 'SYSTEM', 
                senderName: 'AutoBot', 
                metaMessageId: metaRes.data?.messages?.[0]?.id 
            } 
        });
        
        await prisma.lead.update({
            where: { id: lead.id },
            data: { 
                waCallPermissionStatus: 'PENDING',
                waCallPermissionRequestedAt: new Date()
            }
        });
        
        res.status(200).json({ message: "Call request sent successfully", status: "PENDING" });
    } catch (error) {
        console.error("\n=== DEBUG: META API CALL ERROR ===");
        console.error("Error Response Data:", JSON.stringify(error.response?.data, null, 2) || error.message);
        console.error("===================================\n");
        const metaErrData = error.response?.data?.error;

        if (metaErrData?.code === 138017) {
            const cleanPhone = lead.phone ? lead.phone.split('_')[0].replace(/[^0-9]/g, '') : '';
            if (cleanPhone) {
                await prisma.lead.updateMany({
                    where: { phone: { contains: cleanPhone.slice(-9) } },
                    data: {
                        waCallPermissionStatus: 'ALLOWED',
                        waCallPermissionExpiry: null,
                        waCallPermissionNotified: true
                    }
                }).catch(() => {});
            }

            await prisma.chatMessage.create({
                data: {
                    leadId: lead.id,
                    message: "📞 ✅ Student has ALREADY granted permanent call permission (Confirmed by WhatsApp). You can call directly!",
                    direction: 'inbound',
                    senderType: 'SYSTEM',
                    senderName: 'AutoBot'
                }
            }).catch(() => {});

            const io = req.app.get('socketio');
            if (io) {
                io.emit('wa_call_permission_granted', {
                    leadId: lead.id,
                    phone: lead.phone,
                    expiry: null
                });
            }

            return res.status(200).json({
                message: "Student has already approved permanent call permission! You can place calls directly.",
                status: "ALLOWED",
                alreadyAllowed: true
            });
        }

        if (metaErrData?.code === 138009) {
            return res.status(200).json({
                message: "A call permission request was already sent to this student recently. Waiting for student to accept on WhatsApp.",
                status: "PENDING",
                alreadySent: true
            });
        }

        res.status(400).json({ error: metaErrData?.message || metaErrData?.error_data?.details || "Failed to send call request.", details: error.response?.data });
    }
};

exports.getUnnotifiedPermissions = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = (req.user.role || '').toUpperCase().replace(' ', '_');
        const isManagerOrAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER', 'ASS_MANAGER', 'SUPER_ADMIN'].includes(role);
        
        let where = {
            waCallPermissionStatus: 'ALLOWED',
            waCallPermissionNotified: false
        };

        if (!isManagerOrAdmin) {
            where.assignedTo = parseInt(userId);
        }

        const leads = await prisma.lead.findMany({
            where,
            select: {
                id: true,
                name: true,
                phone: true,
                campaignType: true,
                batch: { select: { id: true, name: true } }
            }
        });

        res.status(200).json({ leads });
    } catch (error) {
        console.error("Error fetching unnotified permissions:", error);
        res.status(500).json({ error: "Failed to fetch notifications." });
    }
};

exports.getCallPermissions = async (req, res) => {
    try {
        const userId = parseInt(req.user.id || req.user.userId);
        const role = (req.user.role || '').toUpperCase().replace(/[\s_-]+/g, '_');
        const isSuperAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER_ADMIN', 'SUPERADMIN', 'ADMIN'].includes(role);
        const isManager = ['MANAGER', 'ASS_MANAGER', 'SUPER'].includes(role);
        
        const { status = 'ACTIVE', search, businessId, batchId, staffId, startDate, endDate } = req.query;
        const now = new Date();

        let baseScope = {};

        if (isSuperAdmin) {
            if (businessId && businessId !== 'ALL') {
                baseScope.batch = { ...(baseScope.batch || {}), businessId: parseInt(businessId) };
            }
            if (staffId && staffId !== 'ALL') {
                baseScope.assignedTo = parseInt(staffId);
            }
        } else if (isManager) {
            // Find businesses managed by this manager
            const allBiz = await prisma.business.findMany({
                select: { id: true, name: true, head_manager_id: true, ass_manager_id: true }
            });
            let managedBizIds = allBiz
                .filter(b => (b.head_manager_id && Number(b.head_manager_id) === userId) || (b.ass_manager_id && Number(b.ass_manager_id) === userId))
                .map(b => b.id);

            if (managedBizIds.length === 0 && req.user.businessType && req.user.businessType !== 'ALL') {
                const matched = allBiz.filter(b => b.name.toLowerCase().trim() === String(req.user.businessType).toLowerCase().trim());
                managedBizIds = matched.map(b => b.id);
            }

            if (businessId && businessId !== 'ALL') {
                const targetBizId = parseInt(businessId);
                if (managedBizIds.length === 0 || managedBizIds.includes(targetBizId)) {
                    baseScope.batch = { ...(baseScope.batch || {}), businessId: targetBizId };
                } else {
                    return res.status(200).json({ leads: [], counts: { active: 0, pending: 0, rejected: 0, expired: 0, total: 0 } });
                }
            } else if (managedBizIds.length > 0) {
                baseScope.batch = { ...(baseScope.batch || {}), businessId: { in: managedBizIds } };
            }

            if (staffId && staffId !== 'ALL') {
                baseScope.assignedTo = parseInt(staffId);
            }
        } else {
            // Coordinator: only see their assigned leads
            baseScope.assignedTo = userId;
            if (businessId && businessId !== 'ALL') {
                baseScope.batch = { ...(baseScope.batch || {}), businessId: parseInt(businessId) };
            }
        }

        if (batchId && batchId !== 'ALL' && batchId !== '') {
            baseScope.batchId = parseInt(batchId);
        }

        let whereClause = { ...baseScope };

        if (status === 'ACTIVE') {
            whereClause.waCallPermissionStatus = 'ALLOWED';
            whereClause.OR = [
                { waCallPermissionExpiry: null },
                { waCallPermissionExpiry: { gt: now } }
            ];
        } else if (status === 'PENDING') {
            whereClause.waCallPermissionStatus = 'PENDING';
        } else if (status === 'REJECTED' || status === 'DISALLOWED') {
            whereClause.waCallPermissionStatus = 'DISALLOWED';
        } else if (status === 'EXPIRED') {
            whereClause.waCallPermissionStatus = 'ALLOWED';
            whereClause.waCallPermissionExpiry = { lte: now };
        } else if (status === 'ALL') {
            whereClause.waCallPermissionStatus = { not: 'NONE' };
        } else {
            whereClause.waCallPermissionStatus = status;
        }

        if (startDate || endDate) {
            whereClause.AND = [
                ...(whereClause.AND || []),
                {
                    OR: [
                        {
                            waCallPermissionRequestedAt: {
                                ...(startDate ? { gte: new Date(startDate) } : {}),
                                ...(endDate ? { lte: new Date(endDate + 'T23:59:59.999Z') } : {})
                            }
                        },
                        {
                            updatedAt: {
                                ...(startDate ? { gte: new Date(startDate) } : {}),
                                ...(endDate ? { lte: new Date(endDate + 'T23:59:59.999Z') } : {})
                            }
                        }
                    ]
                }
            ];
        }

        if (search && search.trim()) {
            const cleanSearch = search.trim().replace(/[^0-9a-zA-Z]/g, '');
            whereClause.AND = [
                ...(whereClause.AND || []),
                {
                    OR: [
                        { name: { contains: search.trim() } },
                        { phone: { contains: cleanSearch } }
                    ]
                }
            ];
        }

        const leads = await prisma.lead.findMany({
            where: whereClause,
            include: {
                assignedUser: { select: { id: true, firstName: true, lastName: true } },
                batch: {
                    select: {
                        id: true,
                        name: true,
                        businessId: true,
                        business: { select: { id: true, name: true, logo: true } }
                    }
                }
            },
            orderBy: [
                { waCallPermissionRequestedAt: 'desc' },
                { updatedAt: 'desc' }
            ],
            take: 300
        });

        const [activeCount, pendingCount, rejectedCount, expiredCount, totalCount] = await Promise.all([
            prisma.lead.count({
                where: {
                    ...baseScope,
                    waCallPermissionStatus: 'ALLOWED',
                    OR: [
                        { waCallPermissionExpiry: null },
                        { waCallPermissionExpiry: { gt: now } }
                    ]
                }
            }),
            prisma.lead.count({
                where: {
                    ...baseScope,
                    waCallPermissionStatus: 'PENDING'
                }
            }),
            prisma.lead.count({
                where: {
                    ...baseScope,
                    waCallPermissionStatus: 'DISALLOWED'
                }
            }),
            prisma.lead.count({
                where: {
                    ...baseScope,
                    waCallPermissionStatus: 'ALLOWED',
                    waCallPermissionExpiry: { lte: now }
                }
            }),
            prisma.lead.count({
                where: {
                    ...baseScope,
                    waCallPermissionStatus: { not: 'NONE' }
                }
            })
        ]);

        res.status(200).json({
            leads,
            counts: {
                active: activeCount,
                pending: pendingCount,
                rejected: rejectedCount,
                expired: expiredCount,
                total: totalCount
            }
        });
    } catch (error) {
        console.error("Error fetching call permissions:", error);
        res.status(500).json({ error: "Failed to fetch call permissions." });
    }
};

exports.markPermissionNotified = async (req, res) => {
    try {
        const { leadId } = req.body;
        if (!leadId) return res.status(400).json({ error: "leadId is required" });
        await prisma.lead.update({
            where: { id: parseInt(leadId) },
            data: { waCallPermissionNotified: true }
        });
        res.status(200).json({ message: "Marked as notified." });
    } catch (error) {
        console.error("Error marking permission as notified:", error);
        res.status(500).json({ error: "Failed to update permission status." });
    }
};

// ==========================================
// 🛑 NUMBER BLOCKING & BLACKLISTING
// ==========================================

async function isNumberBlockedHelper(phone) {
    if (!phone) return false;
    const rawDigits = String(phone).split('_')[0].replace(/[^0-9]/g, '');
    if (!rawDigits) return false;
    const phoneSuffix = rawDigits.length >= 9 ? rawDigits.slice(-9) : rawDigits;

    const blocked = await prisma.blockedNumber.findFirst({
        where: {
            OR: [
                { phone: rawDigits },
                { phone: { contains: phoneSuffix } }
            ]
        }
    });
    if (blocked) return true;

    const blockedLead = await prisma.lead.findFirst({
        where: {
            isBlocked: true,
            phone: { contains: phoneSuffix }
        }
    });
    return !!blockedLead;
}

exports.blockNumber = async (req, res) => {
    try {
        const { phone, leadId, reason } = req.body;
        const currentUserId = req.user?.userId || req.user?.id || null;

        if (!phone && !leadId) {
            return res.status(400).json({ error: "Phone or leadId is required to block." });
        }

        let targetPhone = phone;
        let targetLead = null;

        if (leadId) {
            targetLead = await prisma.lead.findUnique({ where: { id: parseInt(leadId) } });
            if (targetLead && !targetPhone) {
                targetPhone = targetLead.phone;
            }
        }

        if (!targetPhone) {
            return res.status(400).json({ error: "Could not determine phone number." });
        }

        const rawPhone = String(targetPhone).split('_')[0].replace(/[^0-9]/g, '');
        const phoneSuffix = rawPhone.length >= 9 ? rawPhone.slice(-9) : rawPhone;

        // Upsert into BlockedNumber
        await prisma.blockedNumber.upsert({
            where: { phone: rawPhone },
            update: {
                reason: reason || 'Blocked from CRM',
                blockedBy: currentUserId,
                updatedAt: new Date()
            },
            create: {
                phone: rawPhone,
                reason: reason || 'Blocked from CRM',
                blockedBy: currentUserId
            }
        });

        // Update matching Leads
        await prisma.lead.updateMany({
            where: {
                OR: [
                    { phone: targetPhone },
                    { phone: { contains: phoneSuffix } }
                ]
            },
            data: {
                isBlocked: true,
                blockedReason: reason || 'Blocked from CRM',
                blockedAt: new Date(),
                isOptedOut: true,
                status: 'BLOCKED'
            }
        });

        try {
            const { getIo } = require('./chatController');
            const io = getIo();
            if (io) {
                io.emit('lead_blocked', { phone: rawPhone, leadId: targetLead?.id, reason: reason || 'Blocked from CRM' });
                io.emit('lead_updated', { phone: rawPhone, leadId: targetLead?.id });
            }
        } catch (e) {}

        return res.status(200).json({ success: true, message: `Phone ${rawPhone} has been blocked.` });
    } catch (error) {
        console.error("Block Number Error:", error);
        return res.status(500).json({ error: "Failed to block number", details: error.message });
    }
};

exports.unblockNumber = async (req, res) => {
    try {
        const { phone, leadId } = req.body;

        let targetPhone = phone;
        let targetLead = null;

        if (leadId) {
            targetLead = await prisma.lead.findUnique({ where: { id: parseInt(leadId) } });
            if (targetLead && !targetPhone) {
                targetPhone = targetLead.phone;
            }
        }

        if (!targetPhone) {
            return res.status(400).json({ error: "Could not determine phone number." });
        }

        const rawPhone = String(targetPhone).split('_')[0].replace(/[^0-9]/g, '');
        const phoneSuffix = rawPhone.length >= 9 ? rawPhone.slice(-9) : rawPhone;

        // Delete from BlockedNumber
        await prisma.blockedNumber.deleteMany({
            where: {
                OR: [
                    { phone: rawPhone },
                    { phone: { contains: phoneSuffix } }
                ]
            }
        });

        // Update matching Leads
        await prisma.lead.updateMany({
            where: {
                OR: [
                    { phone: targetPhone },
                    { phone: { contains: phoneSuffix } }
                ]
            },
            data: {
                isBlocked: false,
                blockedReason: null,
                blockedAt: null,
                isOptedOut: false,
                status: 'NEW'
            }
        });

        try {
            const { getIo } = require('./chatController');
            const io = getIo();
            if (io) {
                io.emit('lead_unblocked', { phone: rawPhone, leadId: targetLead?.id });
                io.emit('lead_updated', { phone: rawPhone, leadId: targetLead?.id });
            }
        } catch (e) {}

        return res.status(200).json({ success: true, message: `Phone ${rawPhone} has been unblocked.` });
    } catch (error) {
        console.error("Unblock Number Error:", error);
        return res.status(500).json({ error: "Failed to unblock number", details: error.message });
    }
};

exports.getBlockedNumbers = async (req, res) => {
    try {
        const blocked = await prisma.blockedNumber.findMany({
            include: {
                blockedByUser: {
                    select: { id: true, firstName: true, lastName: true, role: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return res.status(200).json(blocked || []);
    } catch (error) {
        console.error("Get Blocked Numbers Error:", error);
        return res.status(500).json({ error: "Failed to fetch blocked numbers." });
    }
};
