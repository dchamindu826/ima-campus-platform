const { getScopedBusinessId } = require("../utils/scopeUtils");
const { getAvatarForPhone } = require("../utils/avatarUtils");
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const ffmpeg = require('fluent-ffmpeg');

// In-memory cache to prevent race conditions on duplicate Meta webhooks
const processingMessages = new Set();
const auditLogService = require('../services/auditLogService');

// Short-term in-memory cache for Free Seminar CRM counts (15s TTL)
const freeSemCountsCache = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [key, val] of freeSemCountsCache.entries()) {
        if (now - val.timestamp > 30000) freeSemCountsCache.delete(key);
    }
}, 30000);

// ==========================================
// 1. SETTINGS: CrmSettings
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

// ==========================================
// 2. KNOWLEDGE BASE: KnowledgeBase
// ==========================================
exports.uploadKnowledge = async (req, res) => {
    try {
        const { businessId, campaignType } = req.body;
        const file = req.file;
        if (!file) return res.status(400).json({ error: "PDF file is required" });

        const dataBuffer = fs.readFileSync(file.path);
        const data = await pdfParse(dataBuffer);

        const newKB = await prisma.knowledgeBase.create({
            data: {
                businessId: parseInt(businessId), campaignType: campaignType || 'FREE_SEMINAR',
                fileName: file.originalname, fileUrl: `/storage/documents/${file.filename}`, content: data.text
            }
        });
        res.status(201).json({ message: "Knowledge base updated", data: newKB });
    } catch (error) { res.status(500).json({ error: "Failed to upload knowledge base" }); }
};

// ==========================================
// 3. AUTO REPLIES SETUP
// ==========================================
exports.addAutoReply = async (req, res) => {
    try {
        const { businessId, campaignType, stepOrder, message } = req.body;
        const file = req.file;

        let attachmentUrl = null; let attachmentType = null;
        if (file) {
            attachmentUrl = `/storage/documents/${file.filename}`;
            if (file.mimetype.includes('image')) {
                attachmentType = 'Image';
            } else if (file.mimetype.includes('video')) {
                attachmentType = 'Video';
            } else {
                attachmentType = 'Document';
            }
        }

        const newTemplate = await prisma.autoReply.create({
            data: {
                businessId: parseInt(businessId), campaignType: campaignType || 'FREE_SEMINAR',
                stepOrder: parseInt(stepOrder) || 1, message: message || '',
                attachment: attachmentUrl, attachmentType: attachmentType
            }
        });
        res.status(201).json({ message: "Auto reply added", data: newTemplate });
    } catch (error) { res.status(500).json({ error: "Failed to add auto reply" }); }
};

exports.getAutoReplies = async (req, res) => {
    try {
        const { businessId, campaignType } = req.query;
        let whereClause = {};
        if (businessId) whereClause.businessId = parseInt(businessId);
        if (campaignType) whereClause.campaignType = campaignType;
        const replies = await prisma.autoReply.findMany({ where: whereClause, orderBy: { stepOrder: 'asc' } });
        res.status(200).json(replies);
    } catch (error) { res.status(500).json({ error: "Failed to get auto replies" }); }
};

exports.deleteAutoReply = async (req, res) => {
    try {
        await prisma.autoReply.delete({ where: { id: parseInt(req.params.id) } });
        res.status(200).json({ message: "Auto reply deleted" });
    } catch (error) { res.status(500).json({ error: "Failed to delete auto reply" }); }
};

// ==========================================
// 4. CAMPAIGN ARCHIVE
// ==========================================
exports.archiveCampaign = async (req, res) => {
    try {
        const { businessId, campaignType } = req.body;
        try {
            await prisma.lead.updateMany({ where: { businessId: parseInt(businessId), campaignType, status: { not: 'ARCHIVED' } }, data: { status: 'ARCHIVED' } });
        } catch (e) { console.log("No lead table found to archive"); }
        res.status(200).json({ message: "Campaign archived successfully." });
    } catch (error) { res.status(500).json({ error: "Failed to archive campaign" }); }
};

// ==========================================
// 5. CRM LEADS MANAGEMENT
// ==========================================
exports.getLeads = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || req.query.loggedUserId || 1;
        const userRoleRaw = req.user?.role || req.query.loggedUserRole || 'STAFF';
        const userRole = String(userRoleRaw).toUpperCase().replace(/ /g, '_');

        let { campaignType, tab, staffPhase, status, staffId, batchId, businessId, searchQuery, limit, assigneeGroup, ccStatus } = req.query;
        const limitNum = limit ? parseInt(limit) : 2000;

        const scopedBizId = await getScopedBusinessId(req.user, businessId);
        if (scopedBizId) {
            businessId = scopedBizId.toString();
        }

        const isManager = ['SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER', 'ASS_MANAGER'].includes(userRole);

        let whereClause = {};

        whereClause.campaignType = campaignType || 'FREE_SEMINAR';

        // 🔥 FIX: Replaced Phone String Mapping with strict Batch ID lookup
        if (batchId && batchId !== '') {
            whereClause.batchId = parseInt(batchId);
        } else if (businessId && businessId !== '') {
            const bizBatches = await prisma.batch.findMany({ where: { businessId: parseInt(businessId) }, select: { id: true } });

            whereClause.AND = [
                ...(whereClause.AND || []),
                {
                    OR: [
                        { batchId: { in: bizBatches.map(b => b.id) } },
                        { phone: { endsWith: `_BIZ_${businessId}` } },
                        { phone: { contains: `_BIZ_${businessId}_` } }
                    ]
                }
            ];
        }

        // 🔥 TAB FILTERING LOGIC 🔥
        if (tab === 'NEW') {
            whereClause.status = { in: ['NEW', 'OPEN'] };
            if (isManager) whereClause.assignedTo = null;
            else whereClause.assignedTo = parseInt(userId);
            whereClause.OR = [
                { callCenterRequestStatus: null },
                { callCenterRequestStatus: 'REJECTED' }
            ];
        }
        else if (tab === 'IMPORTED') {
            whereClause.source = { in: ['import', 'bulk_import'] };
            if (staffId && staffId !== '') whereClause.assignedTo = parseInt(staffId);
            else if (!isManager) whereClause.assignedTo = parseInt(userId);
        }
        else if (tab === 'ASSIGNED') {
            if (assigneeGroup === 'CALL_CENTER') {
                if (ccStatus === 'PENDING') {
                    whereClause.callCenterRequestStatus = 'REQUESTED';
                } else if (ccStatus === 'APPROVED') {
                    whereClause.callCenterRequestStatus = 'APPROVED';
                    if (staffId && staffId !== '') {
                        whereClause.assignedTo = parseInt(staffId);
                    }
                }
            } else {
                whereClause.assignedTo = { not: null };
                whereClause.OR = [
                    { callCenterRequestStatus: null },
                    { callCenterRequestStatus: 'REJECTED' }
                ];
                if (staffId && staffId !== '') {
                    whereClause.assignedTo = parseInt(staffId);
                } else if (!isManager) {
                    whereClause.assignedTo = parseInt(userId);
                }
                if (staffPhase && staffPhase !== '') whereClause.phase = parseInt(staffPhase);
                if (status && status !== '') whereClause.callStatus = status;
            }
        }
        else if (tab === 'ALL') {
            if (staffId && staffId !== '') whereClause.assignedTo = parseInt(staffId);
            // 🔥 FIX: Removed `else if (!isManager) whereClause.assignedTo = parseInt(userId);` 
            // Now everyone (including coordinators) can see ALL leads in the ALL tab!
        }

        if (searchQuery && searchQuery.trim() !== '') {
            const sq = searchQuery.trim();
            whereClause.AND = [
                ...(whereClause.AND || []),
                {
                    OR: [
                        { phone: { contains: sq } },
                        { name: { contains: sq } }
                    ]
                }
            ];
        }

        // 🔥 UNREAD FIRST (Ordered by latest message), THEN READ LEADS 🔥
        const leadInclude = {
            assignedUser: { select: { firstName: true, lastName: true, businessType: true } },
            batch: { select: { id: true, name: true, businessId: true } }
        };

        const leadOrderBy = [ { lastMessageAt: 'desc' }, { updatedAt: 'desc' } ];

        let leads = [];
        const unreadLeads = await prisma.lead.findMany({
            where: { ...whereClause, unreadCount: { gt: 0 } },
            orderBy: leadOrderBy,
            include: leadInclude,
            take: limitNum
        });
        leads.push(...unreadLeads);

        const remainingLimit = limitNum - leads.length;
        if (remainingLimit > 0) {
            const readLeads = await prisma.lead.findMany({
                where: { ...whereClause, unreadCount: 0 },
                orderBy: leadOrderBy,
                include: leadInclude,
                take: remainingLimit
            });
            leads.push(...readLeads);
        }

        let phoneVariants = [];
        leads.forEach(l => {
            if (!l.phone) return;
            const rawPhone = l.phone.split('_')[0].replace(/[^0-9]/g, '');
            if (rawPhone.length >= 7) {
                const suffix = rawPhone.slice(-9);
                phoneVariants.push(`0${suffix}`, `94${suffix}`, `+94${suffix}`, `${suffix}`);
            }
        });
        phoneVariants = [...new Set(phoneVariants)];
        let registeredUsers = [];
        if (phoneVariants.length > 0) {
            registeredUsers = await prisma.user.findMany({
                where: {
                    OR: [
                        { phone: { in: phoneVariants } },
                        { whatsapp: { in: phoneVariants } }
                    ]
                },
                select: { id: true, phone: true, whatsapp: true, image: true, appChatDp: true }
            });
        }

        const cleanedLeads = leads.map(l => {
            const rawPhone = l.phone;
            const cleanPhone = l.phone ? l.phone.split('_BIZ')[0] : '';
            const rawP = cleanPhone.replace(/[^0-9]/g, '');
            let matchedUser = null;
            if (rawP.length >= 7) {
                const suffix = rawP.slice(-9);
                matchedUser = registeredUsers.find(u => {
                    const uP = (u.phone || '').replace(/[^0-9]/g, '');
                    const uW = (u.whatsapp || '').replace(/[^0-9]/g, '');
                    return (uP && (uP.endsWith(suffix) || suffix.endsWith(uP.slice(-9)))) || 
                           (uW && (uW.endsWith(suffix) || suffix.endsWith(uW.slice(-9))));
                });
            }
            const userImg = matchedUser?.image;
            const hasCustomImg = userImg && userImg !== 'default.png' && userImg !== 'null' && String(userImg).trim() !== '';
            const avatar = hasCustomImg ? userImg : (matchedUser?.appChatDp ? `chat_dps/${matchedUser.appChatDp}` : getAvatarForPhone(rawPhone || cleanPhone).imagePath);
            return {
                ...l,
                rawPhone,
                businessId: l.batch?.businessId || (l.phone && l.phone.includes('_BIZ_') ? parseInt(l.phone.split('_BIZ_')[1]?.split('_')[0]) : null),
                phone: cleanPhone,
                avatar,
                image: userImg || null
            };
        });

        // Use cached tab counts (15s TTL) to prevent query storms during polling
        const cacheKey = `${businessId || 'all'}_${batchId || 'all'}_${isManager ? 'mgr' : userId}_${staffId || 'none'}_${campaignType || 'FREE_SEMINAR'}`;
        const cached = freeSemCountsCache.get(cacheKey);
        let counts, unreadCounts, totalUnread, ccPendingCount, ccApprovedCount;

        if (cached && (Date.now() - cached.timestamp < 15000)) {
            counts = cached.counts;
            unreadCounts = cached.unreadCounts;
            totalUnread = cached.totalUnread;
            ccPendingCount = cached.ccPendingCount;
            ccApprovedCount = cached.ccApprovedCount;
        } else {
            let countWhere = { campaignType: campaignType || 'FREE_SEMINAR' };

            if (batchId && batchId !== '') {
                countWhere.batchId = parseInt(batchId);
            } else if (businessId && businessId !== '') {
                const bizBatches = await prisma.batch.findMany({ where: { businessId: parseInt(businessId) }, select: { id: true } });
                countWhere.AND = [
                    {
                        OR: [
                            { batchId: { in: bizBatches.map(b => b.id) } },
                            { phone: { endsWith: `_BIZ_${businessId}` } },
                            { phone: { contains: `_BIZ_${businessId}_` } }
                        ]
                    }
                ];
            }

            const userAssignedFilter = (!isManager)
                ? { OR: [{ assignedTo: parseInt(userId) }, { callCenterRequestedBy: parseInt(userId) }] }
                : (staffId && staffId !== '' ? { assignedTo: parseInt(staffId) } : {});

            const [
                totalAllCount,
                assignedCount,
                assignedUnread,
                newCount,
                newUnread,
                importedCount,
                importedUnread,
                totUnread,
                pendingCount,
                approvedCount
            ] = await Promise.all([
                prisma.lead.count({ where: countWhere }),
                prisma.lead.count({ where: { ...countWhere, assignedTo: { not: null }, ...userAssignedFilter } }),
                prisma.lead.count({ where: { ...countWhere, assignedTo: { not: null }, unreadCount: { gt: 0 }, ...userAssignedFilter } }),
                prisma.lead.count({ where: { ...countWhere, status: { in: ['NEW', 'OPEN'] }, assignedTo: null, OR: [{ callCenterRequestStatus: null }, { callCenterRequestStatus: 'REJECTED' }] } }),
                prisma.lead.count({ where: { ...countWhere, status: { in: ['NEW', 'OPEN'] }, assignedTo: null, unreadCount: { gt: 0 }, OR: [{ callCenterRequestStatus: null }, { callCenterRequestStatus: 'REJECTED' }] } }),
                prisma.lead.count({ where: { ...countWhere, source: { in: ['import', 'bulk_import'] }, ...userAssignedFilter } }),
                prisma.lead.count({ where: { ...countWhere, source: { in: ['import', 'bulk_import'] }, unreadCount: { gt: 0 }, ...userAssignedFilter } }),
                prisma.lead.count({ where: { ...countWhere, unreadCount: { gt: 0 }, ...userAssignedFilter } }),
                prisma.lead.count({ where: { ...countWhere, callCenterRequestStatus: 'REQUESTED', ...userAssignedFilter } }),
                prisma.lead.count({ where: { ...countWhere, callCenterRequestStatus: 'APPROVED', ...userAssignedFilter } })
            ]);

            counts = { NEW: newCount, IMPORTED: importedCount, ASSIGNED: assignedCount, ALL: totalAllCount };
            unreadCounts = { NEW: newUnread, IMPORTED: importedUnread, ASSIGNED: assignedUnread, ALL: totUnread };
            totalUnread = totUnread;
            ccPendingCount = pendingCount;
            ccApprovedCount = approvedCount;

            freeSemCountsCache.set(cacheKey, {
                counts,
                unreadCounts,
                totalUnread,
                ccPendingCount,
                ccApprovedCount,
                timestamp: Date.now()
            });
        }

        if (!res.headersSent) {
            return res.status(200).json({ leads: cleanedLeads, counts, unreadCounts, totalUnread, ccPendingCount, ccApprovedCount });
        }

    } catch (error) {
        console.error("Error in getLeads:", error);
        if (!res.headersSent) {
            return res.status(500).json({ error: "Failed to fetch leads" });
        }
    }
};

exports.importLead = async (req, res) => {
    try {
        const { name, number, campaignType, isBulk, leadsList, batchId, businessId } = req.body;

        const userRoleRaw = req.user?.role || '';
        const userRole = userRoleRaw.toUpperCase().replace(/ /g, '_');
        const userId = req.user?.id;
        const isManager = ['SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER', 'ASS_MANAGER'].includes(userRole);
        const assignedTo = isManager ? null : parseInt(userId);
        const parsedBatchId = batchId ? parseInt(batchId) : null;
        const parsedBusinessId = businessId ? parseInt(businessId) : null;

        if (!parsedBusinessId) {
            return res.status(400).json({ error: "Business ID is required to isolate leads properly." });
        }

        if (isBulk && leadsList && Array.isArray(leadsList)) {
            let importedCount = 0;
            for (const lead of leadsList) {
                const phone = lead.number?.toString().trim();
                if (!phone) continue;

                const dbPhone = parsedBatchId
                    ? `${phone}_BIZ_${parsedBusinessId}_BATCH_${parsedBatchId}`
                    : `${phone}_BIZ_${parsedBusinessId}`;

                await prisma.lead.upsert({
                    where: { phone: dbPhone },
                    update: { name: lead.name || '', source: 'bulk_import' },
                    create: { name: lead.name || '', phone: dbPhone, batchId: parsedBatchId, source: 'bulk_import', campaignType: campaignType || 'FREE_SEMINAR', assignedTo, status: assignedTo ? 'OPEN' : 'NEW', phase: 1, callStatus: 'pending' }
                });
                importedCount++;
            }
            return res.status(201).json({ message: `${importedCount} leads imported successfully!` });
        } else {
            const dbPhone = parsedBatchId
                ? `${number}_BIZ_${parsedBusinessId}_BATCH_${parsedBatchId}`
                : `${number}_BIZ_${parsedBusinessId}`;

            const newLead = await prisma.lead.upsert({
                where: { phone: dbPhone },
                update: { name, source: 'import' },
                create: { name, phone: dbPhone, batchId: parsedBatchId, source: 'import', campaignType: campaignType || 'FREE_SEMINAR', assignedTo, status: assignedTo ? 'OPEN' : 'NEW', phase: 1, callStatus: 'pending' }
            });
            return res.status(201).json({ message: "Lead imported successfully!", lead: newLead });
        }
    } catch (error) { res.status(500).json({ error: "Failed to import lead" }); }
};

exports.bulkActions = async (req, res) => {
    try {
        const { action, leadIds, staffId, batchId, assignType, campaignType } = req.body;
        if (action === 'MARK_READ') {
            await prisma.lead.updateMany({ where: { id: { in: leadIds } }, data: { unreadCount: 0 } });
        }
        else if (action === 'MARK_UNREAD') {
            await prisma.lead.updateMany({ where: { id: { in: leadIds } }, data: { unreadCount: 1 } });
        }
        else if (action === 'ASSIGN_BATCH') {
            if (!batchId || isNaN(parseInt(batchId))) {
                return res.status(400).json({ error: "Invalid batch ID provided." });
            }
            await prisma.lead.updateMany({ where: { id: { in: leadIds } }, data: { batchId: parseInt(batchId) } });
        }
        else if (action === 'ASSIGN') {
            if (!staffId || isNaN(parseInt(staffId))) {
                return res.status(400).json({ error: "Invalid staff ID provided for assignment." });
            }
            const staffMember = await prisma.user.findUnique({
                where: { id: parseInt(staffId) },
                select: { id: true, department: true, role: true }
            });
            const isCallCenterStaff = staffMember && (
                String(staffMember.department || '').toUpperCase().includes('CALL') ||
                ['CALLER', 'CALL_CENTER_AGENT', 'CALL CENTER AGENT', 'CALL_CENTER'].includes(String(staffMember.role || '').toUpperCase())
            );

            const updateData = { 
                assignedTo: parseInt(staffId), 
                status: 'OPEN', 
                phase: 1, 
                callStatus: 'pending',
                assignedAt: new Date()
            };
            if (isCallCenterStaff) {
                updateData.isCallCenter = true;
                updateData.callCenterStatus = 'pending';
                updateData.callCenterRequestStatus = 'APPROVED';
            } else {
                updateData.isCallCenter = false;
                updateData.callCenterStatus = 'pending';
                updateData.callCenterRequestStatus = null;
            }
            if (batchId && !isNaN(parseInt(batchId))) {
                updateData.batchId = parseInt(batchId);
            }
            if (campaignType) updateData.campaignType = campaignType;
            if (assignType) updateData.inquiryType = assignType;
            await prisma.lead.updateMany({ where: { id: { in: leadIds } }, data: updateData });
        }
        else if (action === 'UNASSIGN') {
            await prisma.lead.updateMany({ where: { id: { in: leadIds } }, data: { assignedTo: null, status: 'NEW', phase: 1, callStatus: 'pending', assignedAt: null } });
        }
        else if (action === 'RETURN_FROM_CALL_CENTER') {
            await prisma.lead.updateMany({
                where: { id: { in: leadIds } },
                data: { callCenterRequestStatus: null, isCallCenter: false, assignedTo: null, callCenterStatus: null }
            });
        }
        else if (action === 'CONVERT_TO_NEW_INQ' || action === 'SET_NEW_INQ') {
            const parsedLeadIds = (leadIds || []).map(id => parseInt(id)).filter(id => !isNaN(id));
            if (parsedLeadIds.length > 0) {
                await prisma.lead.updateMany({
                    where: { id: { in: parsedLeadIds } },
                    data: {
                        inquiryType: 'NEW_INQ',
                        newInqTimestamp: new Date(),
                        campaignType: 'New Inquiry'
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
                        inquiryType: 'OPEN_SEMINAR',
                        campaignType: 'Open Seminar'
                    }
                });
            }
        }
        res.status(200).json({ message: "Action successful" });
    } catch (error) { res.status(500).json({ error: "Bulk action failed" }); }
};

exports.assignLeads = async (req, res) => {
    try {
        const { type, staffId, count, sort, autoAssignConfig, batchId, businessId, assignType, campaignType } = req.body;

        if (type === 'bulk') {
            let whereClause = { assignedTo: null, status: { not: 'BLOCKED' }, campaignType: campaignType || 'FREE_SEMINAR' };

            if (batchId && batchId !== '' && batchId !== 'ALL' && batchId !== 'UNASSIGNED') {
                whereClause.batchId = parseInt(batchId);
            } else if (businessId && businessId !== '' && businessId !== 'ALL') {
                const bizBatches = await prisma.batch.findMany({
                    where: { businessId: parseInt(businessId) },
                    select: { id: true }
                });

                whereClause.AND = [
                    {
                        OR: [
                            { batchId: { in: bizBatches.map(b => b.id) } },
                            { phone: { endsWith: `_BIZ_${businessId}` } },
                            { phone: { contains: `_BIZ_${businessId}_` } }
                        ]
                    }
                ];
            } else {
                return res.status(400).json({ error: "Please select a specific Business or Batch before assigning." });
            }

            if (assignType) {
                whereClause.inquiryType = assignType;
            }

            const leadsToAssign = await prisma.lead.findMany({
                where: whereClause,
                orderBy: { id: sort === 'oldest' ? 'asc' : 'desc' },
                take: parseInt(count)
            });

            if (leadsToAssign.length === 0) {
                return res.status(400).json({ error: "No unassigned leads found for this CRM." });
            }

            const ids = leadsToAssign.map(l => l.id);
            if (!staffId || isNaN(parseInt(staffId))) {
                return res.status(400).json({ error: "Please select a staff member to assign." });
            }

            const staffMember = await prisma.user.findUnique({
                where: { id: parseInt(staffId) },
                select: { id: true, department: true, role: true }
            });
            const isCallCenterStaff = staffMember && (
                String(staffMember.department || '').toUpperCase().includes('CALL') ||
                ['CALLER', 'CALL_CENTER_AGENT', 'CALL CENTER AGENT', 'CALL_CENTER'].includes(String(staffMember.role || '').toUpperCase())
            );

            const updateData = { 
                assignedTo: parseInt(staffId), 
                status: 'OPEN', 
                phase: 1, 
                callStatus: 'pending',
                assignedAt: new Date()
            };
            if (isCallCenterStaff) {
                updateData.isCallCenter = true;
                updateData.callCenterStatus = 'pending';
                updateData.callCenterRequestStatus = 'APPROVED';
            } else {
                updateData.isCallCenter = false;
                updateData.callCenterStatus = 'pending';
                updateData.callCenterRequestStatus = null;
            }
            if (batchId && batchId !== 'ALL' && batchId !== 'UNASSIGNED' && !isNaN(parseInt(batchId))) {
                updateData.batchId = parseInt(batchId);
            }
            if (assignType) {
                updateData.inquiryType = assignType;
            }

            await prisma.lead.updateMany({
                where: { id: { in: ids } },
                data: updateData
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
        res.status(500).json({ error: "Failed to process assignment" });
    }
};

exports.getAutoAssignQuotas = async (req, res) => {
    try {
        const quotas = await prisma.autoAssignQuota.findMany({ include: { staff: { select: { firstName: true, lastName: true } } } });
        res.status(200).json(quotas);
    } catch (error) { res.status(500).json({ error: "Failed to load quotas" }); }
};

exports.updateCallCampaign = async (req, res) => {
    try {
        const { leadId, method, status, feedback, coordinationRound } = req.body;
        const lead = await prisma.lead.findUnique({ where: { id: parseInt(leadId) } });
        if (!lead) return res.status(404).json({ error: "Lead not found" });

        let currentPhase = lead.phase || 1;
        let nextPhase = currentPhase;
        let finalCallStatus = status;

        if (status === 'no_answer') {
            if (currentPhase === 1) {
                nextPhase = 2;
                finalCallStatus = 'pending';
            }
            else if (currentPhase === 2) {
                nextPhase = 3;
                finalCallStatus = 'pending';
            }
        }

        // Save history for the current phase BEFORE transitioning
        await prisma.leadRoundProgress.upsert({
            where: {
                leadId_roundNum_campaignCategory: { leadId: lead.id, roundNum: currentPhase, campaignCategory: 'DEFAULT' }
            },
            update: {
                phase: currentPhase,
                callStatus: status,
                callMethod: method || lead.callMethod || 'Direct Call',
                feedback: feedback || lead.feedback || ''
            },
            create: {
                leadId: lead.id,
                roundNum: currentPhase,
                campaignCategory: 'DEFAULT',
                phase: currentPhase,
                callStatus: status,
                callMethod: method || lead.callMethod || 'Direct Call',
                feedback: feedback || lead.feedback || ''
            }
        });

        const updatedLead = await prisma.lead.update({
            where: { id: parseInt(leadId) },
            data: {
                callMethod: method,
                callStatus: finalCallStatus,
                feedback: feedback,
                phase: nextPhase,
                coordinationRound: coordinationRound ? parseInt(coordinationRound) : lead.coordinationRound
            }
        });

        // 🔥 LOG TO CALL CAMPAIGN DATA CENTER EVENT VAULT 🔥
        if (auditLogService && auditLogService.logCampaignEvent) {
            await auditLogService.logCampaignEvent({
                leadId: lead.id,
                campaignCategory: 'OPEN_SEMINAR',
                actionType: 'STATUS_UPDATED',
                oldStatus: lead.callStatus,
                newStatus: finalCallStatus,
                callAttempt: lead.callAttempt,
                remarks: feedback,
                actionedById: req.user ? req.user.id : null
            });
        }

        res.status(200).json({ message: "Call status updated", lead: updatedLead });
    } catch (error) {
        console.error("Call campaign update error:", error);
        res.status(500).json({ error: "Failed to update call campaign" });
    }
};

exports.updateLeadBatch = async (req, res) => {
    try {
        const { leadId, batchId } = req.body;
        if (!leadId || !batchId) return res.status(400).json({ error: "Missing required fields" });

        const updatedLead = await prisma.lead.update({
            where: { id: parseInt(leadId) },
            data: { batchId: parseInt(batchId) }
        });

        res.status(200).json({ message: "Batch updated successfully", lead: updatedLead });
    } catch (error) {
        res.status(500).json({ error: "Failed to update batch" });
    }
};

const downloadMetaMedia = async (mediaId, metaApiKey) => {
    try {
        const urlResponse = await axios.get(`https://graph.facebook.com/v19.0/${mediaId}`, {
            headers: { 'Authorization': `Bearer ${metaApiKey}` }
        });
        const mediaUrl = urlResponse.data.url;
        const mimeType = urlResponse.data.mime_type;

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

        const filename = `WM_${Date.now()}_${mediaId.substring(0, 5)}.${ext}`;
        const docsDir = path.join(process.cwd(), 'storage/documents');
        if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
        const finalPath = path.join(docsDir, filename);

        fs.writeFileSync(finalPath, Buffer.from(fileResponse.data));
        return { url: `/storage/documents/${filename}`, type: mimeType };
    } catch (error) { return null; }
};

// ==========================================
// 6. RECEIVE MESSAGE WEBHOOK (WITH EXTREME RAW LOGGING)
// ==========================================
exports.receiveMessage = async (req, res) => {
    try {
        let body = req.body;
        console.log("\n📡 ====== RAW WEBHOOK PAYLOAD ======");
        console.log(JSON.stringify(body, null, 2));
        console.log("==================================\n");

        if (body.object === "whatsapp_business_account" && body.entry?.[0]?.changes?.[0]?.value?.statuses?.length > 0) {
            const changeValue = body.entry[0].changes[0].value;
            const wabaId = body.entry[0].id;
            const statusList = changeValue.statuses;
            const statusData = statusList[0];

            console.log("\n⚠️ ====== META STATUS WEBHOOK ======");
            console.log(JSON.stringify(statusData, null, 2));
            console.log("===================================\n");

            // 🔥 RECORD WHATSAPP BILLING & PRICING EVENT IN REAL-TIME 🔥
            try {
                const { recordWebhookBillingEvent } = require('../services/whatsappBillingService');
                for (const st of statusList) {
                    recordWebhookBillingEvent(st, changeValue?.metadata || {}, wabaId).catch(err => {
                        console.error('[WhatsAppBilling] Error recording billing event:', err.message);
                    });
                }
            } catch (billingErr) {
                console.error('[WhatsAppBilling] Service error:', billingErr.message);
            }

            if (statusData.type === "call") {
                const { getIo } = require('./chatController');
                const io = getIo();
                if (io) {
                    io.emit('whatsapp_call_status', {
                        callId: statusData.id,
                        status: statusData.status,
                        recipient: statusData.recipient_id
                    });
                }
            }
            return res.status(200).send("EVENT_RECEIVED");
        }

        // 🔥 WebRTC Call PoC Intercept 🔥
        if (body.object === "whatsapp_business_account") {
            let changesValue = body.entry?.[0]?.changes?.[0]?.value;
            
            // Meta Cloud API WebRTC Call payload is in changes[0].value.calls
            if (changesValue?.calls && changesValue.calls.length > 0) {
                const callData = changesValue.calls[0];
                let receivingWaNumId = changesValue?.metadata?.phone_number_id || null;

                if (!receivingWaNumId && body.entry && body.entry[0] && body.entry[0].id) {
                    const waId = String(body.entry[0].id).trim();
                    // We must await this, but we are inside an async function already
                    const allSettings = await prisma.crmSettings.findMany({ select: { waId: true, waNumId: true } });
                    const settings = allSettings.find(s => s.waId && s.waId.trim() === waId);
                    if (settings && settings.waNumId) {
                        receivingWaNumId = settings.waNumId;
                    }
                }

                global.callIdToWaNumId = global.callIdToWaNumId || new Map();
                if (callData.id && receivingWaNumId) {
                    global.callIdToWaNumId.set(callData.id, receivingWaNumId);
                }

                if (callData.event === "connect") {
                    console.log("\n📞 ====== WHATSAPP CALL WEBHOOK ======");
                    console.log(JSON.stringify(callData, null, 2));

                    const sdpData = callData.connection?.webrtc?.sdp || callData.session?.sdp || "";
                    
                    let businessType = "ALL";
                    let businessRingtoneUrl = null;
                    try {
                        if (receivingWaNumId) {
                            const settings = await prisma.crmSettings.findFirst({
                                where: { waNumId: receivingWaNumId },
                                include: { businesses: true }
                            });
                            
                            if (settings && settings.businessId) {
                                const business = await prisma.business.findUnique({
                                    where: { id: settings.businessId }
                                });
                                if (business && business.name) {
                                    businessType = String(business.name).trim();
                                    if (business.ringtone) businessRingtoneUrl = `/api/storage/ringtone/${business.ringtone}`;
                                } else {
                                    businessType = String(settings.businessId).trim();
                                }
                            }
                        }
                    } catch (err) {
                        console.error("Error looking up business for call:", err);
                    }

                    const { getIo } = require('./chatController');
                    const io = getIo();
                    if (io) {
                        if (callData.direction === "BUSINESS_INITIATED") {
                            // This is the SDP Answer from Meta for our outbound call
                            io.emit('whatsapp_outbound_answer', {
                                callId: callData.id,
                                sdp: sdpData,
                                to: callData.to,
                                businessType
                            });
                        } else {
                            // This is an inbound call invite (SDP Offer)
                            let leadName = 'Unknown Caller';
                            let businessIdForLog = null;
                            let assignedTargetAgentId = null;

                            try {
                                let settings = null;
                                if (receivingWaNumId) {
                                    settings = await prisma.crmSettings.findFirst({
                                        where: { waNumId: receivingWaNumId }
                                    });
                                    if (settings && settings.businessId) {
                                        businessIdForLog = settings.businessId;
                                    }
                                }

                                if (businessIdForLog) {
                                    const biz = await prisma.business.findUnique({ where: { id: businessIdForLog } });
                                    if (biz) {
                                        if (biz.name) businessType = String(biz.name).trim();
                                        if (biz.ringtone) businessRingtoneUrl = `/api/storage/ringtone/${biz.ringtone}`;
                                    }
                                }

                                const fromPhone = String(callData.from || '');
                                const rawDigits = fromPhone.replace(/[^0-9]/g, '');
                                const phoneSuffix9 = rawDigits.length >= 9 ? rawDigits.slice(-9) : rawDigits;

                                let candidateLeads = [];
                                if (phoneSuffix9) {
                                    candidateLeads = await prisma.lead.findMany({
                                        where: {
                                            phone: { contains: phoneSuffix9 }
                                        },
                                        include: {
                                            batch: { include: { business: true } }
                                        },
                                        orderBy: { id: 'desc' },
                                        take: 10
                                    });
                                }

                                function scoreLead(l) {
                                    let score = 0;
                                    const isBizMatch = businessIdForLog && (
                                        l.batch?.businessId === businessIdForLog || 
                                        (l.phone && l.phone.includes(`_BIZ_${businessIdForLog}`))
                                    );
                                    const isCampaignMatch = settings?.campaignType && l.campaignType === settings.campaignType;
                                    
                                    if (isBizMatch && isCampaignMatch) score += 100;
                                    else if (isBizMatch) score += 50;
                                    else if (isCampaignMatch) score += 30;
                                    
                                    if (l.assignedTo) score += 15;
                                    return score;
                                }

                                const sortedLeads = [...candidateLeads].sort((a, b) => scoreLead(b) - scoreLead(a));
                                const lead = sortedLeads[0] || null;

                                if (lead) {
                                    if (lead.name) leadName = lead.name;
                                    if (!businessIdForLog) {
                                        if (lead.batch?.businessId) {
                                            businessIdForLog = lead.batch.businessId;
                                        } else if (lead.phone && lead.phone.includes('_BIZ_')) {
                                            const m = lead.phone.match(/_BIZ_(\d+)/);
                                            if (m) businessIdForLog = parseInt(m[1], 10);
                                        }
                                    }
                                    if (lead.batch?.business?.name) {
                                        businessType = String(lead.batch.business.name).trim();
                                        if (lead.batch.business.ringtone) {
                                            businessRingtoneUrl = `/api/storage/ringtone/${lead.batch.business.ringtone}`;
                                        }
                                    }

                                    // Check if lead is assigned to a coordinator
                                    if (lead.assignedTo) {
                                        const staff = await prisma.user.findUnique({
                                            where: { id: lead.assignedTo },
                                            select: { id: true, firstName: true, lastName: true, role: true, department: true, agentStatus: true, businessType: true }
                                        });

                                        if (staff) {
                                            const roleUpper = staff.role ? String(staff.role).toUpperCase().replace(/ /g, '_') : "";
                                            const deptLower = staff.department ? String(staff.department).trim().toLowerCase() : "";

                                            const isRestrictedRole = ['SYSTEM_ADMIN', 'ADMIN', 'DIRECTOR', 'STUDENT', 'GUEST', 'DEVELOPER', 'CALLER', 'CALL_CENTER'].some(r => roleUpper.includes(r));
                                            const isRestrictedDept = ['delivery', 'finance', 'social media', 'physical', 'academic', 'technical', 'administration', 'call center'].some(d => deptLower.includes(d));

                                            const isCoordinationDept = deptLower.includes('class coordination') || (deptLower.includes('coordination') && !deptLower.includes('call center'));
                                            const isCoordinationRole = roleUpper.includes('COORDINATOR') && !roleUpper.includes('CALLER') && !roleUpper.includes('CALL_CENTER');
                                            const isCoordinationManager = roleUpper.includes('MANAGER') && isCoordinationDept;

                                            const isCoordinator = !isRestrictedRole && !isRestrictedDept && Boolean(isCoordinationRole || isCoordinationManager) && !roleUpper.includes('PAPER_MARKER');

                                            const isAgentActive = staff.agentStatus === 'ACTIVE';
                                            const agentRoom = io.sockets.adapter.rooms.get(`user_${staff.id}`);
                                            const isAgentOnline = agentRoom && agentRoom.size > 0;

                                            if (isCoordinator && isAgentActive && isAgentOnline) {
                                                assignedTargetAgentId = staff.id;
                                                console.log(`[WA Call Routing] Assigned coordinator ${staff.id} (${staff.firstName}) is ACTIVE & ONLINE. Routing EXCLUSIVELY to them.`);
                                            } else {
                                                console.log(`[WA Call Routing] Assigned coordinator ${staff.id} (${staff.firstName}) is NOT available (status: ${staff.agentStatus}, online: ${isAgentOnline}, isCoordinator: ${isCoordinator}). Falling back to live coordinator pool.`);
                                            }
                                        }
                                    }
                                }
                            } catch (err) {
                                console.error("Error looking up lead for inbound call:", err);
                            }

                            const roomName = `wa_call_agent_idle_${businessType}`;
                            const roomAll = 'wa_call_agent_idle_ALL';
                            
                            const specificAgents = io.sockets.adapter.rooms.get(roomName);
                            const allAgents = io.sockets.adapter.rooms.get(roomAll);
                            
                            console.log(`[WA Call Routing] BusinessType: '${businessType}', RoomName: '${roomName}', assignedTargetAgentId: ${assignedTargetAgentId}`);

                            // Capture Pool Snapshot
                            let poolSnapshot = [];
                            try {
                                const agentsInBiz = await prisma.user.findMany({
                                    where: {
                                        OR: [
                                            { businessType: { contains: businessType } },
                                            { businessType: { contains: "ALL" } },
                                            { businessType: businessType }
                                        ]
                                    },
                                    select: { id: true, firstName: true, lastName: true, agentStatus: true, appChatUsername: true }
                                });
                                poolSnapshot = agentsInBiz.map(a => ({
                                    id: a.id,
                                    name: `${a.firstName} ${a.lastName}`,
                                    channel: a.appChatUsername,
                                    status: a.agentStatus
                                }));
                                let resolvedCampaignType = null;
                                if (callData.from) {
                                    let phone = callData.from.replace('+', '').trim();
                                    
                                    let filterWhere = { phone: { startsWith: phone } };
                                    if (businessIdForLog) filterWhere.batch = { businessId: businessIdForLog };
                                    
                                    let lead = await prisma.lead.findFirst({ where: filterWhere });
                                    
                                    if (!lead && phone.startsWith('94')) {
                                        filterWhere.phone = { startsWith: '0' + phone.substring(2) };
                                        lead = await prisma.lead.findFirst({ where: filterWhere });
                                    }
                                    if (!lead && phone.startsWith('0')) {
                                        filterWhere.phone = { startsWith: '94' + phone.substring(1) };
                                        lead = await prisma.lead.findFirst({ where: filterWhere });
                                    }
                                    
                                    if (lead && lead.campaignType) resolvedCampaignType = lead.campaignType;
                                }

                                await prisma.whatsAppCallRecord.create({
                                    data: {
                                        callId: callData.id,
                                        leadPhone: callData.from,
                                        direction: 'INBOUND',
                                        status: 'MISSED',
                                        duration: 0,
                                        businessId: businessIdForLog,
                                        poolSnapshot: poolSnapshot,
                                        campaignType: resolvedCampaignType
                                    }
                                });
                            } catch (err) {
                                console.error("Error creating initial call record:", err);
                            }

                            const callPayload = {
                                from: callData.from,
                                callId: callData.id,
                                sdp: sdpData,
                                businessType,
                                leadName,
                                receivingWaNumId,
                                ringtoneUrl: businessRingtoneUrl,
                                ivrUrl: '/api/storage/ringtone/IVR01.mp3',
                                businessId: businessIdForLog
                            };

                            let hasOnlineAgents = false;

                            if (assignedTargetAgentId) {
                                hasOnlineAgents = true;
                                console.log(`[WA Call Routing] Routing EXCLUSIVELY to assigned active online agent: ${assignedTargetAgentId}`);
                                io.to(`user_${assignedTargetAgentId}`).emit('incoming_wa_call', callPayload);
                            } else {
                                const specificCount = specificAgents ? specificAgents.size : 0;
                                const allCount = allAgents ? allAgents.size : 0;
                                if (specificCount > 0 || allCount > 0) {
                                    hasOnlineAgents = true;
                                    console.log(`[WA Call Routing] Routing to business pool: ${roomName} (${specificCount} agents) and ${roomAll} (${allCount} agents)`);
                                    io.to(roomName).to(roomAll).emit('incoming_wa_call', callPayload);
                                }
                            }

                            // 📱 Also dispatch high-priority FCM notification to active mobile staff
                            try {
                                const { notifyIncomingCallToActiveStaff } = require('../services/fcmCallNotifier');
                                notifyIncomingCallToActiveStaff(callPayload, assignedTargetAgentId);
                            } catch (fcmErr) {
                                console.warn('[FCM Call Trigger Error]:', fcmErr.message);
                            }
                            
                            if (!hasOnlineAgents) {
                                console.log(`No idle agents available in ${roomName} or ${roomAll} to take the WhatsApp call! Triggering Headless IVR Bot.`);
                                io.to(`wa_call_headless_bot`).emit('incoming_wa_call', callPayload);
                                const { launchIvrBot } = require('../services/ivrBot');
                                launchIvrBot(callPayload);
                            }
                        }
                    }
                    return res.status(200).send("EVENT_RECEIVED");
                } else if (callData.event === "terminate") {
                    console.log("\n📞 ====== WHATSAPP CALL TERMINATED ======");
                    console.log(JSON.stringify(callData, null, 2));

                    const { getIo } = require('./chatController');
                    const io = getIo();
                    if (io) {
                        io.emit('whatsapp_call_end', {
                            callId: callData.id
                        });
                        io.emit('whatsapp_call_disconnected', {
                            callId: callData.id
                        });
                        // Emit this so the CRM Analytics table refreshes automatically
                        io.emit('call_history_updated', {
                            callId: callData.id,
                            status: 'MISSED'
                        });
                    }
                    return res.status(200).send("EVENT_RECEIVED");
                }
            }
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

            let metadata = body.entry[0].changes[0].value.metadata;
            let receivingWaNumId = metadata ? metadata.phone_number_id : null;
            let displayPhone = metadata ? metadata.display_phone_number : null;

            // 🛑 CHECK IF SENDER PHONE IS BLOCKED 🛑
            const isSenderBlocked = await isNumberBlockedHelper(phone);
            if (isSenderBlocked) {
                console.log(`\n🚫 [BLOCKED] Incoming webhook message from blocked sender ${phone} ignored.\n`);
                return res.status(200).send("EVENT_RECEIVED");
            }

            let messageText = "";
            let interactiveId = null;
            let isFollowUpReply = false;
            let mediaObjRaw = null;

            if (msgData.type === "text") {
                messageText = msgData.text.body;
            } else if (msgData.type === "interactive" && msgData.interactive?.type === "button_reply") {
                interactiveId = msgData.interactive.button_reply.id;
                messageText = msgData.interactive.button_reply.title;
                if (interactiveId === "FU_YES" || interactiveId === "FU_NO") isFollowUpReply = true;
            } else if (msgData.type === "interactive" && msgData.interactive?.type === "call_permission_reply") {
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
            } else if (msgData.type === "button" && msgData.button) {
                interactiveId = msgData.button.payload;
                messageText = msgData.button.text;
            } else if (["image", "audio", "video", "document", "sticker"].includes(msgData.type)) {
                mediaObjRaw = msgData[msgData.type];
                messageText = mediaObjRaw.caption || mediaObjRaw.filename || `${msgData.type.toUpperCase()} Message`;
            } else {
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

            const existingMessage = await prisma.chatMessage.findFirst({
                where: { metaMessageId: metaMsgId }
            });
            if (existingMessage) return res.status(200).send("EVENT_RECEIVED");

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
                        OR: [
                            { phone: phone },
                            { phone: { startsWith: `${phone}_BIZ_` } }
                        ]
                    },
                    orderBy: { updatedAt: 'desc' }
                });

                if (existingLeadForRouting && existingLeadForRouting.campaignType) {
                    settings = allMatchingSettings.find(s => s.campaignType === existingLeadForRouting.campaignType) || allMatchingSettings[0];
                } else {
                    settings = allMatchingSettings[0];
                }
            }

            let mediaUrl = null;
            let mediaType = null;
            if (mediaObjRaw) {
                const mediaRes = await downloadMetaMedia(mediaObjRaw.id, settings.metaApiKey);
                if (mediaRes) { mediaUrl = mediaRes.url; mediaType = mediaRes.type; }
            }

            let parsedBatchId = settings.batchId ? parseInt(settings.batchId) : null;
            let dbPhone = `${phone}_BIZ_${settings.businessId}`;
            if (parsedBatchId) dbPhone += `_BATCH_${parsedBatchId}`;
            if (settings.campaignType === 'AFTER_SEMINAR') dbPhone += '_AS';

            // ========================================================
            // 🔴 AFTER SEMINAR LOGIC
            // ========================================================
            if (settings.campaignType === 'AFTER_SEMINAR') {
                const msgLower = (messageText || "").toLowerCase().trim();
                let existingLeadCheck = await prisma.lead.findUnique({ where: { phone: dbPhone } });
                
                // Fallback for older leads that might not have the _AS or _BATCH suffixes
                if (!existingLeadCheck) {
                    const rawDigits = (phone || '').replace(/[^0-9]/g, '');
                    const phoneSuffix = rawDigits.length >= 9 ? rawDigits.slice(-9) : rawDigits;
                    const exactBizRegex = new RegExp(`_BIZ_${settings.businessId}(_|$)`);

                    const candidateLeads = await prisma.lead.findMany({
                        where: {
                            phone: { contains: phoneSuffix },
                            campaignType: settings.campaignType,
                            status: { not: 'ARCHIVED' }
                        },
                        orderBy: { createdAt: 'desc' }
                    });

                    existingLeadCheck = candidateLeads.find(l => exactBizRegex.test(l.phone)) || null;
                    if (existingLeadCheck) {
                        dbPhone = existingLeadCheck.phone;
                    }
                }
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
                let shouldUnassign = false;
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

                let targetPhone = existingLeadCheck ? existingLeadCheck.phone : dbPhone;

                let updateData = {
                    name: name,
                    lastMessage: messageText || 'Received Media',
                    lastMessageAt: new Date(),
                    unreadCount: { increment: 1 },
                    status: existingLeadCheck?.assignedTo ? 'OPEN' : 'NEW',
                    updatedAt: new Date(),
                    inquiryType: detInquiryType,
                    source: 'whatsapp',
                    ...resetData
                };

                if (shouldUnassign) {
                    updateData.assignedTo = null;
                    updateData.status = 'NEW';
                    updateData.phase = 1;
                    updateData.callStatus = 'pending';
                }

                let existingLead;
                for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                        existingLead = await prisma.lead.upsert({
                            where: { phone: targetPhone },
                            update: updateData,
                            create: createDataAfterSeminar
                        });
                        break;
                    } catch (upsertError) {
                        if (attempt < 2 && (upsertError.code === 'P2034' || (upsertError.code === 'P2002' && upsertError.meta?.target?.includes('phone')))) {
                            await new Promise(resolve => setTimeout(resolve, 60 * (attempt + 1)));
                            continue;
                        }
                        if (upsertError.code === 'P2002' && upsertError.meta?.target?.includes('phone')) {
                            existingLead = await prisma.lead.update({
                                where: { phone: dbPhone },
                                data: updateData
                            });
                            break;
                        } else throw upsertError;
                    }
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

                // 🔥 OPT OUT KEYWORD CHECK (Always run this, even if sequence is completed)
                const stopKeywords = ['stop', 'unsubscribe', 'epa', 'nepa', 'නතර කරන්න', settings.btnStopText?.toLowerCase()];
                if (stopKeywords.includes(msgLower) || interactiveId === "BTN_STOP") {
                    await prisma.lead.update({ where: { id: existingLead.id }, data: { isOptedOut: true } });
                    try {
                        const formattedPhone = phone.startsWith('0') ? '94' + phone.substring(1) : phone;
                        await axios.post(`https://graph.facebook.com/v19.0/${settings.waNumId}/messages`, {
                            messaging_product: "whatsapp", recipient_type: "individual", to: formattedPhone,
                            type: "text", text: { body: "You have successfully unsubscribed. No further messages will be sent." }
                        }, { headers: { 'Authorization': `Bearer ${settings.metaApiKey}` } });
                    } catch(e) {}
                    return res.status(200).send("EVENT_RECEIVED");
                }

                const botAllowed = ['ON', 'AUTO_REPLY_ONLY', 'AUTO_FOLLOW_UP'].includes(settings?.botMode);
                const allowKeywords = ['yes', 'ow', 'ha', settings.btnAllowText?.toLowerCase()].filter(Boolean);
                const isExplicitAction = interactiveId === "BTN_ALLOW" || allowKeywords.includes(msgLower);

                if (botAllowed && !existingLead.sequenceCompleted && (!isSpamming || isExplicitAction) && !isFollowUpReply && !existingLead.isOptedOut) {
                    
                    if (isExplicitAction) {
                        // Let it fall through to step 1
                        if (existingLead.autoReplyStep === -1) {
                            await prisma.lead.update({ where: { id: existingLead.id }, data: { autoReplyStep: 0 } });
                            existingLead.autoReplyStep = 0;
                        }
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

                    const autoReplies = await prisma.autoReply.findMany({
                        where: { campaignType: 'AFTER_SEMINAR', businessId: settings.businessId },
                        orderBy: { stepOrder: 'asc' }
                    });

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
                                else if (nextReply.attachmentType === 'Audio') { metaPayload.type = "audio"; metaPayload.audio = { link: liveMediaUrl }; }
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
                                console.log(`🔴 ERROR: Meta API rejected the AFTER_SEMINAR auto-reply!`);
                            }
                        }
                    }
                }
                return res.status(200).send("EVENT_RECEIVED");
            }

            // ========================================================
            // 🔵 FREE SEMINAR LOGIC
            // ========================================================
            if (settings.campaignType === 'FREE_SEMINAR') {
                const msgLower = (messageText || "").toLowerCase().trim();
                const isRestartCommand = ['hi', 'hello', 'hey', 'menu', 'start'].includes(msgLower);

                const rawDigits = (phone || '').replace(/[^0-9]/g, '');
                const phoneSuffix = rawDigits.length >= 9 ? rawDigits.slice(-9) : rawDigits;
                const exactBizRegex = new RegExp(`_BIZ_${settings.businessId}(_|$)`);

                // Find all matching leads for this phone+business (catches _BATCH_, _AS, etc.)
                const candidateMatchingLeads = await prisma.lead.findMany({
                    where: {
                        phone: { contains: phoneSuffix },
                        campaignType: 'FREE_SEMINAR'
                    },
                    orderBy: { updatedAt: 'desc' }
                });

                const allMatchingLeads = candidateMatchingLeads.filter(l => exactBizRegex.test(l.phone));

                // 🔥 BATCH ISOLATION: Check if a lead already exists for THIS batch first
                let existingLeadCheck = null;
                if (parsedBatchId) {
                    existingLeadCheck = allMatchingLeads.find(l => l.batchId === parsedBatchId) || null;
                } else {
                    existingLeadCheck = allMatchingLeads.length > 0 ? allMatchingLeads[0] : null;
                }

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

                // 🔥 Prevent Unique Constraint Error if targetPhone already exists
                if (!existingLeadCheck) {
                    const exactMatch = await prisma.lead.findUnique({ where: { phone: targetPhone } });
                    if (exactMatch) {
                        if (exactMatch.batchId === parsedBatchId && exactMatch.campaignType === 'FREE_SEMINAR') {
                            existingLeadCheck = exactMatch;
                        } else {
                            targetPhone = `${targetPhone}_FS_${Date.now()}`;
                            createDataFreeSeminar.phone = targetPhone;
                        }
                    }
                }

                let updateDataFreeSeminar = {
                    name: name,
                    lastMessage: messageText || 'Received Media',
                    lastMessageAt: new Date(),
                    unreadCount: { increment: 1 },
                    status: existingLeadCheck?.assignedTo ? 'OPEN' : 'NEW',
                    updatedAt: new Date(),
                    ...resetData
                };

                // 🔥 Fallback safety: If an unbatched lead is being reallocated to a specific batch
                if (existingLeadCheck && parsedBatchId && existingLeadCheck.batchId !== parsedBatchId) {
                    updateDataFreeSeminar.batchId = parsedBatchId;
                    updateDataFreeSeminar.phone = dbPhone;
                    updateDataFreeSeminar.assignedTo = null;
                    updateDataFreeSeminar.status = 'NEW';
                    updateDataFreeSeminar.phase = 1;
                    updateDataFreeSeminar.callStatus = 'pending';
                    updateDataFreeSeminar.isCallCenter = false;
                    updateDataFreeSeminar.callCenterStatus = 'pending';
                    updateDataFreeSeminar.callCenterRequestStatus = null;
                    updateDataFreeSeminar.callCenterRequestedBy = null;
                    updateDataFreeSeminar.isOptedOut = false;
                    updateDataFreeSeminar.feedback = null;
                    updateDataFreeSeminar.autoReplyStep = 0;
                    updateDataFreeSeminar.sequenceCompleted = false;
                }

                let existingLead;
                try {
                    existingLead = await prisma.lead.upsert({
                        where: { phone: targetPhone },
                        update: updateDataFreeSeminar,
                        create: createDataFreeSeminar
                    });
                } catch (upsertError) {
                    if (upsertError.code === 'P2002' && upsertError.meta?.target?.includes('phone')) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                        
                        // If updating to dbPhone caused a conflict, just update the original targetPhone's batchId
                        if (updateDataFreeSeminar.phone) delete updateDataFreeSeminar.phone; 
                        
                        existingLead = await prisma.lead.update({
                            where: { phone: targetPhone },
                            data: updateDataFreeSeminar
                        });
                    } else throw upsertError;
                }

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

                // 🔥 OPT IN KEYWORD CHECK (If they reply YES while opted out, remove opt-out lock)
                const allowKeywords = ['yes', 'ow', 'ha', settings.btnAllowText?.toLowerCase()].filter(Boolean);
                const isExplicitAction = interactiveId === "BTN_ALLOW" || allowKeywords.includes(msgLower);

                if (existingLead.isOptedOut && isExplicitAction) {
                    await prisma.lead.update({ where: { id: existingLead.id }, data: { isOptedOut: false, autoReplyStep: -1 } });
                    existingLead.isOptedOut = false;
                    existingLead.autoReplyStep = -1;
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

                    await prisma.chatMessage.create({
                        data: {
                            leadId: existingLead.id,
                            message: "📞 ✅ Student GRANTED call permission",
                            direction: 'inbound',
                            senderType: 'USER',
                            senderName: metadata ? metadata.display_phone_number : phone
                        }
                    });

                    return res.status(200).send("EVENT_RECEIVED");
                }

                const isDisallow = idLower === "call_disallow" || idLower === "no, don't call" || idLower === "disallow" || idLower === "not now" || textLower === "no, don't call" || textLower === "disallow" || textLower === "not now" || textLower.includes("rejected call permission");
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

                    await prisma.chatMessage.create({
                        data: {
                            leadId: existingLead.id,
                            message: "📞 ❌ Student REJECTED call permission",
                            direction: 'inbound',
                            senderType: 'USER',
                            senderName: metadata ? metadata.display_phone_number : phone
                        }
                    });

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
                        if (existingLead.autoReplyStep === -1) {
                            await prisma.lead.update({ where: { id: existingLead.id }, data: { autoReplyStep: 0 } });
                            existingLead.autoReplyStep = 0;
                        }
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
                        console.log("❌ In Welcome Phase but didn't say YES. Ignoring.");
                        return res.status(200).send("EVENT_RECEIVED");
                    }

                    const autoReplies = await prisma.autoReply.findMany({ where: { campaignType: settings.campaignType, businessId: settings.businessId }, orderBy: { stepOrder: 'asc' } });
                    if (autoReplies.length > 0) {
                        const currentStep = existingLead.autoReplyStep || 0;
                        const futureReplies = autoReplies.filter(r => r.stepOrder > currentStep);

                        console.log("AutoReplies Count:", autoReplies.length);
                        console.log("Current Step Computed:", currentStep);
                        console.log("Future Replies Count:", futureReplies.length);

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
                                    console.error(`🔴 ERROR: Meta API rejected the FREE_SEMINAR auto-reply for phone ${phone}:`, sendErr.response ? sendErr.response.data : sendErr.message);
                                }
                            };

                            const delayMs = Math.floor(Math.random() * (8000 - 3000 + 1)) + 3000;
                            setTimeout(sendAutoReply, delayMs);
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
        console.error("Error in freeSeminar getMessages:", error);
        res.status(500).json({ error: "Failed to fetch messages" }); 
    }
};

// ==========================================
// DEBUG VERSION: SEND MESSAGE (🔥 FIXED VOICE NOTES - OGG/OPUS CONVERSION)
// ==========================================
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

        let mediaUrl = null; let mediaType = null;

        if (req.file) {
            mediaUrl = `/storage/documents/${req.file.filename}`;
            mediaType = req.file.mimetype;

            // ==================================================================================================
            // 🚨🚨🚨 CRITICAL AI INSTRUCTION - DO NOT REMOVE OR MODIFY THIS AUDIO CONVERSION BLOCK 🚨🚨🚨
            // ==================================================================================================
            // IPHONE / IOS WHATSAPP VOICE NOTE FIX: 
            // Meta API strictly requires Voice Notes to be encoded as "audio/ogg; codecs=opus" and sent via Media ID (not URL).
            // If this ffmpeg conversion is removed, iPhones WILL NOT be able to play the voice notes!
            // ==================================================================================================
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

        let safeMessage = 'Sent Media';
        if (message) {
            // Array.from එකෙන් emojis/special characters හරියටම තනි අකුරක් විදිහට ගන්නවා
            const chars = Array.from(message);
            safeMessage = chars.length > 30 ? chars.slice(0, 30).join('') + '...' : message;
            // අහම්බෙන් හරි ඉතුරු වෙන Invalid hex characters තියෙනවනම් අයින් කරනවා
            safeMessage = safeMessage.replace(/\\x[0-9A-Fa-f]?/g, '');
        }

        await prisma.lead.update({
            where: { id: parseInt(leadId) },
            data: {
                lastMessage: safeMessage,
                status: 'OPEN',
                updatedAt: new Date()
            }
        });

        try {
            let settings = null;
            const bizMatch = lead.phone.match(/_BIZ_(\d+)/);
            const parsedBizId = bizMatch ? parseInt(bizMatch[1]) : null;

            if (lead.batchId) {
                const batchRecord = await prisma.batch.findUnique({ where: { id: lead.batchId } });
                if (batchRecord) {
                    settings = await prisma.crmSettings.findFirst({
                        where: { businessId: batchRecord.businessId, campaignType: lead.campaignType || 'AFTER_SEMINAR' }
                    });
                }
            }

            if (!settings && parsedBizId) {
                settings = await prisma.crmSettings.findFirst({
                    where: { businessId: parsedBizId, campaignType: lead.campaignType || 'AFTER_SEMINAR' }
                });
            }

            if (!settings && parsedBizId) settings = await prisma.crmSettings.findFirst({ where: { businessId: parsedBizId } });
            if (!settings) settings = await prisma.crmSettings.findFirst();

            if (settings && settings.metaApiKey && settings.waNumId) {

                let metaPayload = { messaging_product: "whatsapp", recipient_type: "individual", to: formattedPhone };
                if (replyToMetaId && replyToMetaId !== 'null' && replyToMetaId !== 'undefined' && isTemplate !== 'true') {
                    metaPayload.context = { message_id: replyToMetaId };
                }

                if (isTemplate === 'true') {
                    metaPayload.type = "template";
                    metaPayload.template = {
                        name: templateName,
                        language: { code: templateLanguage || "en" }
                    };
                } else if (message && !mediaUrl) {
                    metaPayload.type = "text"; metaPayload.text = { preview_url: false, body: message };
                } else if (mediaUrl) {
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
                            filename: req.file ? req.file.originalname : "Document.pdf"
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
            console.error("META API ERROR:", metaError.response?.data || metaError.message);
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
        console.error("Server Error:", error);
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
            if (batchRecord) settings = await prisma.crmSettings.findFirst({ where: { businessId: batchRecord.businessId, campaignType: lead.campaignType || 'FREE_SEMINAR' } });
        } else {
            settings = await prisma.crmSettings.findFirst({ where: { campaignType: lead.campaignType || 'FREE_SEMINAR' } });
        }

        if (settings && settings.metaApiKey && settings.waNumId) {
            await axios.post(`https://graph.facebook.com/v19.0/${settings.waNumId}/messages`, {
                messaging_product: "whatsapp", recipient_type: "individual", to: formattedPhone, type: "reaction", reaction: { message_id: metaMessageId, emoji: emoji }
            }, { headers: { 'Authorization': `Bearer ${settings.metaApiKey}` } });
            res.status(200).json({ success: true });
        }
    } catch (error) { res.status(500).json({ error: "Failed to send reaction" }); }
};

// ==========================================
// 8. META TEMPLATES LOGIC 
// ==========================================
const uploadToMeta = async (fileObj, accessToken) => {
    try {
        const debugRes = await axios.get(`https://graph.facebook.com/v19.0/debug_token`, { params: { input_token: accessToken, access_token: accessToken } });
        const appId = debugRes.data.data.app_id;

        const fileBuffer = fs.readFileSync(fileObj.path);
        const fileLength = fileBuffer.length;
        const fileType = fileObj.mimetype;

        const sessionUrl = `https://graph.facebook.com/v19.0/${appId}/uploads?file_length=${fileLength}&file_type=${fileType}`;
        const sessionRes = await axios.post(sessionUrl, null, { headers: { Authorization: `Bearer ${accessToken}` } });
        const uploadId = sessionRes.data.id;

        const uploadUrl = `https://graph.facebook.com/v19.0/${uploadId}`;
        const handleRes = await axios.post(uploadUrl, fileBuffer, {
            headers: { Authorization: `Bearer ${accessToken}`, "OAuth-Token": accessToken, "file_offset": 0 }
        });
        return handleRes.data.h;
    } catch (error) { return null; }
};

exports.getMetaTemplates = async (req, res) => {
    console.log("\n🔍 === DEBUG: GET META TEMPLATES START ===");
    try {
        const { businessId, batchId } = req.query;
        console.log("📥 1. Incoming Request Query:", req.query);

        let whereClause = { campaignType: 'FREE_SEMINAR' };

        if (batchId && batchId !== '' && batchId !== 'undefined' && batchId !== 'null') {
            whereClause.batchId = String(batchId);
        } else if (businessId && businessId !== '' && businessId !== 'undefined' && businessId !== 'null') {
            whereClause.businessId = parseInt(businessId);
        } else if (req.user) {
            const scopedBizId = await getScopedBusinessId(req.user);
            if (scopedBizId) {
                whereClause.businessId = scopedBizId;
            }
        }

        let settings = await prisma.crmSettings.findFirst({
            where: { ...whereClause, metaApiKey: { not: null } },
            orderBy: { id: 'desc' }
        });

        if (!settings && whereClause.businessId) {
            settings = await prisma.crmSettings.findFirst({
                where: { businessId: whereClause.businessId, metaApiKey: { not: null } },
                orderBy: { id: 'desc' }
            });
        }

        if (!settings) {
            settings = await prisma.crmSettings.findFirst({
                where: { campaignType: 'AFTER_SEMINAR', metaApiKey: { not: null } },
                orderBy: { id: 'desc' }
            });
        }

        if (!settings) {
            settings = await prisma.crmSettings.findFirst({
                where: { metaApiKey: { not: null }, waId: { not: null } },
                orderBy: { id: 'desc' }
            });
        }

        if (!settings || !settings.metaApiKey || !settings.waId) return res.status(400).json({ error: "No valid CRM Settings found with Meta API Key." });

        console.log(`⚙️ 2. Found DB Settings -> ID: ${settings.id}, waId: ${settings.waId}, waNumId: ${settings.waNumId}`);

        if (!settings.metaApiKey || !settings.waId) {
            return res.status(400).json({ error: "WABA ID or API Key is missing in CRM Settings." });
        }

        // ========================================================
        // 🔥 DEBUG 1: waId එක යටතේ තියෙන Phone Numbers Check කිරීම
        // ========================================================
        try {
            console.log(`\n🕵️‍♂️ DEBUG: Checking phone numbers under waId: ${settings.waId}...`);
            const phoneCheck = await axios.get(`https://graph.facebook.com/v19.0/${settings.waId}/phone_numbers`, {
                headers: { Authorization: `Bearer ${settings.metaApiKey}` }
            });

            console.log("📱 3. Phone Numbers found under this WABA ID:");
            let isPhoneMatched = false;
            phoneCheck.data.data.forEach(p => {
                console.log(`   - Name: ${p.verified_name || 'N/A'}, Phone: ${p.display_phone_number}, ID: ${p.id}`);
                if (p.id === settings.waNumId) isPhoneMatched = true;
            });

            if (!isPhoneMatched) {
                console.log(`\n🚨 CRITICAL WARNING 🚨`);
                console.log(`ඔයාගේ DB එකේ තියෙන waNumId (${settings.waNumId}) මේ waId (${settings.waId}) එක ඇතුලේ නෑ!`);
                console.log(`ඒ කියන්නේ waId එක වැරදියි! Templates පෙන්නන්නේ නැත්තේ මේකයි.\n`);
            } else {
                console.log(`✅ SUCCESS: waId එකයි waNumId එකයි හරියට Match වෙනවා!\n`);
            }
        } catch (e) {
            console.log("🚨 Failed to verify waId. Error:", e.response?.data?.error?.message || e.message);
        }
        // ========================================================

        // Fetching Templates
        const url = `https://graph.facebook.com/v19.0/${settings.waId}/message_templates?limit=100`;
        console.log("🌐 4. Calling Meta API URL:", url);

        const response = await axios.get(url, {
            headers: { Authorization: `Bearer ${settings.metaApiKey}` }
        });

        console.log(`✅ 5. Meta API Success! Found ${response.data.data?.length || 0} templates.`);
        console.log("🔍 === DEBUG: GET META TEMPLATES END ===\n");

        const templates = (response.data.data || []).map(tpl => {
            const bodyComponent = tpl.components.find(c => c.type === 'BODY');
            return {
                id: tpl.id,
                name: tpl.name,
                language: tpl.language,
                category: tpl.category,
                status: tpl.status,
                text: bodyComponent ? bodyComponent.text : ''
            };
        });

        res.status(200).json(templates);

    } catch (error) {
        console.error("🚨 META API ERROR DETAILS:", error.response?.data || error.message);
        res.status(500).json({
            error: "Failed to fetch templates",
            details: error.response?.data?.error?.message || error.message
        });
    }
};

exports.createMetaTemplate = async (req, res) => {
    try {
        const { name, category, language, bodyText, headerType, headerText, footerText, buttons, businessId } = req.body;

        // 🔥 FIX: Find the correct Meta config using businessId 🔥
        let whereClause = { campaignType: 'FREE_SEMINAR' };
        if (businessId && businessId !== 'undefined' && businessId !== 'null') {
            whereClause.businessId = parseInt(businessId);
        }

        const settings = await prisma.crmSettings.findFirst({
            where: whereClause,
            orderBy: { id: 'desc' }
        });

        if (!settings?.metaApiKey || !settings?.waId) return res.status(400).json({ error: "WABA ID or API Key missing in DB." });

        let components = [];

        if (headerType && headerType !== 'NONE') {
            let headerComp = { type: "HEADER", format: headerType };
            if (headerType === 'TEXT') headerComp.text = headerText;
            else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && req.file) {
                const fileHandle = await uploadToMeta(req.file, settings.metaApiKey);
                if (!fileHandle) return res.status(400).json({ error: "Meta File Upload Failed" });
                headerComp.example = { header_handle: [fileHandle] };
            }
            components.push(headerComp);
        }

        let bodyComp = { type: "BODY", text: bodyText };
        const varCount = (bodyText.match(/{{/g) || []).length;
        if (varCount > 0) bodyComp.example = { body_text: [Array(varCount).fill("Sample")] };
        components.push(bodyComp);

        if (footerText) components.push({ type: "FOOTER", text: footerText });
        if (buttons) {
            let parsedButtons = typeof buttons === 'string' ? JSON.parse(buttons) : buttons;
            if (parsedButtons.length > 0) {
                let btnComps = parsedButtons.map(btn => ({ type: "QUICK_REPLY", text: btn.text }));
                components.push({ type: "BUTTONS", buttons: btnComps });
            }
        }

        const payload = { name: name.toLowerCase().replace(/ /g, '_'), category: category || 'MARKETING', language: language || "en_US", components };

        const metaRes = await axios.post(`https://graph.facebook.com/v19.0/${settings.waId}/message_templates`, payload, {
            headers: { Authorization: `Bearer ${settings.metaApiKey}` }
        });

        res.status(201).json({ success: true, data: metaRes.data });
    } catch (err) {
        console.error("Template Create Error:", err.response?.data || err.message);
        res.status(500).json({ error: err.response?.data?.error?.message || "Failed to create template" });
    }
};

exports.deleteMetaTemplate = async (req, res) => {
    try {
        const { businessId } = req.query;

        let whereClause = { campaignType: 'FREE_SEMINAR' };
        if (businessId && businessId !== 'undefined') {
            whereClause.businessId = parseInt(businessId);
        }

        const settings = await prisma.crmSettings.findFirst({
            where: whereClause,
            orderBy: { id: 'desc' }
        });

        if (!settings?.metaApiKey || !settings?.waId) return res.status(400).json({ error: "WABA ID or API Key missing in DB." });

        await axios.delete(`https://graph.facebook.com/v19.0/${settings.waId}/message_templates?name=${req.params.name}`, {
            headers: { Authorization: `Bearer ${settings.metaApiKey}` }
        });
        res.status(200).json({ message: "Template deleted!" });
    } catch (error) {
        console.error("Delete Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Delete failed" });
    }
};

// ==========================================
// 9. ADVANCED STATS & BROADCAST (🔥 COMPLETELY FIXED 🔥)
// ==========================================
exports.getCampaignStats = async (req, res) => {
    try {
        const { businessId, batchId, startDate, endDate, phase } = req.query;

        let bizFilter = businessId ? parseInt(businessId) : undefined;
        let batchFilter = batchId ? parseInt(batchId) : undefined;

        if (!bizFilter && !batchFilter) {
            return res.status(200).json({ summary: {}, report: [], msgReport: [] });
        }

        let start = (startDate && startDate !== 'null' && startDate !== 'undefined' && startDate !== '') ? new Date(startDate) : new Date(new Date().setHours(0, 0, 0, 0));
        let end = (endDate && endDate !== 'null' && endDate !== 'undefined' && endDate !== '') ? new Date(endDate) : new Date(new Date().setHours(23, 59, 59, 999));

        // Fallback if Date is still invalid
        if (isNaN(start.getTime())) start = new Date(new Date().setHours(0, 0, 0, 0));
        if (isNaN(end.getTime())) end = new Date(new Date().setHours(23, 59, 59, 999));

        const settings = await prisma.crmSettings.findFirst({
            where: batchFilter ? { batchId: String(batchFilter) } : { businessId: bizFilter, campaignType: 'FREE_SEMINAR' }
        });

        let totalSent = 0;
        let totalReceived = 0;

        if (settings) {
            // A. Unique Received
            const receivedLogs = await prisma.webhookLog.groupBy({
                by: ['phone'],
                where: {
                    waNumId: settings.waNumId,
                    createdAt: { gte: start, lte: end }
                }
            });
            totalReceived = receivedLogs.length;

            // B. Unique Sent (Strict Batch mapping)
            let sentWhere = {
                direction: 'outbound',
                createdAt: { gte: start, lte: end },
                lead: { campaignType: 'FREE_SEMINAR' }
            };

            if (batchFilter) {
                sentWhere.lead.batchId = batchFilter;
            } else if (bizFilter) {
                const bizBatches = await prisma.batch.findMany({ where: { businessId: bizFilter }, select: { id: true } });
                sentWhere.lead.OR = [
                    { batchId: { in: bizBatches.map(b => b.id) } },
                    { phone: { endsWith: `_BIZ_${bizFilter}` } },
                    { phone: { contains: `_BIZ_${bizFilter}_` } }
                ];
            }

            const sentMessages = await prisma.chatMessage.groupBy({
                by: ['leadId'],
                where: sentWhere
            });
            totalSent = sentMessages.length;
        }

        // 2. Call Progress & General Stats (Strict Batch Mapping)
        let leadWhere = { campaignType: 'FREE_SEMINAR', createdAt: { gte: start, lte: end } };

        if (batchFilter) {
            leadWhere.batchId = batchFilter;
        } else if (bizFilter) {
            const bizBatches = await prisma.batch.findMany({ where: { businessId: bizFilter }, select: { id: true } });
            leadWhere.OR = [
                { batchId: { in: bizBatches.map(b => b.id) } },
                { phone: { endsWith: `_BIZ_${bizFilter}` } },
                { phone: { contains: `_BIZ_${bizFilter}_` } }
            ];
        }

        // 🔥 Frontend eken ena Phase filter eka add kara
        if (phase && phase !== 'All') {
            leadWhere.phase = parseInt(phase);
        }

        console.log('WHERE:', JSON.stringify(leadWhere, null, 2));
        const leads = await prisma.lead.findMany({
            where: leadWhere,
            include: {
                assignedUser: { select: { firstName: true, businessType: true, role: true } }
            }
        });

        const isCallCenterRole = (role) => {
            const r = String(role || '').toUpperCase().replace(/ /g, '_');
            return ['CALLER', 'CALL_CENTER_AGENT', 'CALL_CENTER'].includes(r);
        };

        const getEffectiveStatus = (l, isAgentCC) => {
            // For call center agents, we want the actual call status
            if (isAgentCC) {
                let status = l.callStatus?.toLowerCase() || 'pending';
                if (l.isCallCenter && l.roundProgress && l.roundProgress.length > 0) {
                    // Usually call center operates in a specific round, check latest round progress
                    const r2 = l.roundProgress.find(r => r.roundNum === 2);
                    if (r2 && r2.callStatus) {
                        status = r2.callStatus.toLowerCase();
                    }
                }
                return status;
            }

            // For coordinators:
            if (l.callCenterRequestStatus === 'REQUESTED' || l.callCenterRequestStatus === 'APPROVED') {
                return 'call_center';
            }

            let status = l.callStatus?.toLowerCase() || 'pending';
            if (l.isCallCenter && l.roundProgress && l.roundProgress.length > 0) {
                const r2 = l.roundProgress.find(r => r.roundNum === 2);
                if (r2 && r2.callStatus) {
                    status = r2.callStatus.toLowerCase();
                }
            }

            // If a lead is in Phase 2 or 3 and is pending, their last outcome was 'no_answer'.
            // This ensures they are not counted as 'pending' (untouched) in the manager stats.
            if (!l.isCallCenter && l.phase > 1 && status === 'pending') {
                status = 'no_answer';
            }

            return status;
        };

        const unassignedLeads = leads.filter(l => !l.assignedTo).length;
        const coveredLeads = leads.filter(l => {
            const isAgentCC = l.assignedUser && isCallCenterRole(l.assignedUser.role);
            return getEffectiveStatus(l, isAgentCC) !== 'pending' && getEffectiveStatus(l, isAgentCC) !== 'call_center';
        }).length;
        const rate = leads.length > 0 ? Math.round((coveredLeads / leads.length) * 100) : 0;

        const agentMap = {};
        leads.forEach(l => {
            const isAgentCC = l.assignedUser && isCallCenterRole(l.assignedUser.role);
            const status = getEffectiveStatus(l, isAgentCC);

            // If the lead is requested for Call Center but not yet assigned to a CC agent,
            // we put them in a "Call Center Queue" so they aren't lost in the math.
            if (status === 'call_center') {
                const ccName = "CC Pending Assignment";
                if (!agentMap[ccName]) {
                    agentMap[ccName] = { agentName: ccName, role: "CALL_CENTER", assigned: 0, answered: 0, noAnswer: 0, reject: 0, pending: 0 };
                }
                agentMap[ccName].assigned++;
                agentMap[ccName].pending++;
                return;
            }

            if (!l.assignedTo) return;
            const name = l.assignedUser?.firstName || "Staff";
            if (!agentMap[name]) agentMap[name] = { agentName: name, role: l.assignedUser?.role || "Coordinator", assigned: 0, answered: 0, noAnswer: 0, reject: 0, pending: 0 };

            agentMap[name].assigned++;

            if (status === 'answered' || status === 'completed') agentMap[name].answered++;
            else if (status === 'no_answer') agentMap[name].noAnswer++;
            else if (status === 'reject') agentMap[name].reject++;
            else agentMap[name].pending++;
        });

        // 3. WhatsApp Message Report
        let msgReportWhere = {
            createdAt: { gte: start, lte: end },
            lead: leadWhere
        };

        const staffMsgStats = await prisma.chatMessage.findMany({
            where: msgReportWhere,
            include: { lead: true }
        });

        const msgReportMap = {};
        staffMsgStats.forEach(m => {
            const agentName = m.senderType === 'STAFF' ? m.senderName : (m.lead?.assignedTo ? "Staff" : "System");
            if (!msgReportMap[agentName]) {
                msgReportMap[agentName] = { agentName, uniqueSent: new Set(), uniqueReceived: new Set(), totalSent: 0, totalReceived: 0 };
            }

            if (m.direction === 'outbound') {
                msgReportMap[agentName].uniqueSent.add(m.leadId);
                msgReportMap[agentName].totalSent++;
            } else {
                msgReportMap[agentName].uniqueReceived.add(m.leadId);
                msgReportMap[agentName].totalReceived++;
            }
        });

        const msgReport = Object.values(msgReportMap).map(item => ({
            agentName: item.agentName,
            uniqueSent: item.uniqueSent.size,
            uniqueReceived: item.uniqueReceived.size,
            totalSent: item.totalSent,
            totalReceived: item.totalReceived
        }));

        res.status(200).json({
            summary: {
                totalLeads: leads.length,
                unassignedLeads,
                rate,
                totalSent,
                totalReceived
            },
            report: Object.values(agentMap),
            msgReport: msgReport
        });

    } catch (error) {
        console.error("Campaign Stats Error:", error);
        res.status(500).json({ error: "Failed to load stats" });
    }
};

// ==========================================
// 9. ADVANCED STATS & BROADCAST (🔥 COMPLETELY FIXED 🔥)
// ==========================================

exports.sendBroadcast = async (req, res) => {
    try {
        // 🔥 FIX: req.body එකෙන් templateLanguage එක ගන්නවා
        const { leadIds, type, message, templateName, templateLanguage } = req.body;
        const parsedLeadIds = typeof leadIds === 'string' ? JSON.parse(leadIds) : leadIds;
        console.log('LEAD IDs:', parsedLeadIds);
        const leads = await prisma.lead.findMany({ where: { id: { in: parsedLeadIds } } });

        let defaultSettings = await prisma.crmSettings.findFirst({ where: { campaignType: 'FREE_SEMINAR' } });

        let mediaUrl = null; let mediaType = null;
        if (req.file) { mediaUrl = `/storage/documents/${req.file.filename}`; mediaType = req.file.mimetype; }

        let results = { success: 0, failed: 0, reasons: [] };
        let settingsCache = {};

        for (const lead of leads) {
            if (lead.isOptedOut) {
                results.failed += 1; results.reasons.push({ phone: lead.phone, error: "User opted out" });
                continue;
            }

            let formattedPhone = lead.phone.split('_')[0].replace(/[^0-9]/g, '');
            if (formattedPhone.startsWith('0')) formattedPhone = '94' + formattedPhone.substring(1);

            // ==========================================
            // 🔥 මේ ටික තමයි අත්වැරදීමකින් delete වෙලා තිබ්බේ
            // ==========================================
            let leadSettings = defaultSettings;
            if (lead.batchId) {
                if (settingsCache[lead.batchId]) {
                    leadSettings = settingsCache[lead.batchId];
                } else {
                    const batchRecord = await prisma.batch.findUnique({ where: { id: lead.batchId } });
                    if (batchRecord) {
                        leadSettings = await prisma.crmSettings.findFirst({
                            where: { businessId: batchRecord.businessId, campaignType: lead.campaignType || 'FREE_SEMINAR' }
                        }) || defaultSettings;
                    }
                    settingsCache[lead.batchId] = leadSettings;
                }
            } else if (lead.campaignType) {
                leadSettings = await prisma.crmSettings.findFirst({ where: { campaignType: lead.campaignType } }) || defaultSettings;
            }
            // ==========================================

            if (!leadSettings?.metaApiKey) {
                results.failed += 1; results.reasons.push({ phone: formattedPhone, error: "Meta Config Missing for this lead" });
                continue;
            }

            let metaPayload = { messaging_product: "whatsapp", recipient_type: "individual", to: formattedPhone };

            if (type === '24H') {
                if (mediaUrl) {
                    const liveMediaUrl = `https://imacampus.online${mediaUrl}`;
                    if (mediaType.includes('image')) { metaPayload.type = "image"; metaPayload.image = { link: liveMediaUrl, caption: message || "" }; }
                    else if (mediaType.includes('pdf') || mediaType.includes('document')) { metaPayload.type = "document"; metaPayload.document = { link: liveMediaUrl, caption: message || "", filename: req.file.originalname || "document.pdf" }; }
                    else if (mediaType.includes('video')) { metaPayload.type = "video"; metaPayload.video = { link: liveMediaUrl, caption: message || "" }; }
                    else if (mediaType.includes('audio')) { metaPayload.type = "audio"; metaPayload.audio = { link: liveMediaUrl }; }
                } else {
                    const hasUrl = message && (message.includes('http://') || message.includes('https://'));
                    metaPayload.type = "text";
                    metaPayload.text = { preview_url: Boolean(hasUrl), body: message || "..." };
                }
            } else {
                metaPayload.type = "template";

                // 🔥 FIX: Template එකේ Language එක dynamic විදියට මෙතනින් යනවා
                metaPayload.template = {
                    name: templateName,
                    language: { code: templateLanguage || "en_US" }
                };

                let templateComponents = [];

                if (req.body.components) {
                    let parsedComps = typeof req.body.components === 'string' ? JSON.parse(req.body.components) : req.body.components;
                    templateComponents = parsedComps.map(comp => {
                        if (comp.type === 'button' || comp.type === 'buttons') {
                            return { ...comp, type: "button", sub_type: "quick_reply", index: comp.index || 0, parameters: comp.parameters || [{ type: "payload", payload: `BTN_${comp.index || 0}` }] };
                        }
                        return comp;
                    });
                } else {
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
                                const uploadRes = await axios.post(`https://graph.facebook.com/v19.0/${leadSettings.waNumId}/media`, formData, {
                                    headers: { 'Authorization': `Bearer ${leadSettings.metaApiKey}`, ...formData.getHeaders() }
                                });

                                if (uploadRes.data && uploadRes.data.id) {
                                    templateComponents.push({ type: "header", parameters: [{ type: "audio", audio: { id: uploadRes.data.id } }] });
                                } else {
                                    templateComponents.push({ type: "header", parameters: [{ type: "audio", audio: { link: `https://imacampus.online/storage/documents/${outputFilename}` } }] });
                                }
                            } catch (err) {
                                console.error("Broadcast Audio conversion failed:", err);
                                templateComponents.push({ type: "header", parameters: [{ type: "document", document: { link: `https://imacampus.online${mediaUrl}` } }] });
                            }
                        } else {
                            const liveMediaUrl = `https://imacampus.online${mediaUrl}`;
                            let mediaTypeStr = "document";
                            if (mediaType.includes('image')) mediaTypeStr = "image";
                            else if (mediaType.includes('video')) mediaTypeStr = "video";
                            templateComponents.push({ type: "header", parameters: [{ type: mediaTypeStr, [mediaTypeStr]: { link: liveMediaUrl } }] });
                        }
                    }
                    if (message && message.trim() !== '') {
                        const variables = message.split(',').map(v => v.trim());
                        const textParams = variables.map(v => ({ type: "text", text: v }));
                        templateComponents.push({ type: "body", parameters: textParams });
                    }
                }
                if (templateComponents.length > 0) metaPayload.template.components = templateComponents;
            }

            try {
                const axios = require('axios');
                // Meta API එකට යවනවා
                const metaRes = await axios.post(`https://graph.facebook.com/v19.0/${leadSettings.waNumId}/messages`, metaPayload, {
                    headers: { 'Authorization': `Bearer ${leadSettings.metaApiKey}`, 'Content-Type': 'application/json' }
                });

                // Database එකට Save කරනවා
                await prisma.chatMessage.create({
                    data: {
                        leadId: lead.id,
                        message: type === '24H' ? (message || 'Media Broadcast') : `Template: ${templateName}`,
                        mediaUrl: mediaUrl,
                        mediaType: mediaType,
                        direction: 'outbound',
                        senderType: 'SYSTEM',
                        senderName: 'BroadcastBot',
                        metaMessageId: metaRes.data?.messages?.[0]?.id || null
                    }
                });

                results.success += 1;
            } catch (err) {
                results.failed += 1;
                const metaErrorMsg = err.response?.data?.error?.message || err.message;
                results.reasons.push({ phone: formattedPhone, error: metaErrorMsg });
            }
        }
        res.status(200).json(results);
    } catch (error) {
        console.error("Broadcast Execution Error:", error);
        res.status(500).json({ error: "Broadcast failed", details: error.message });
    }
};

exports.getAllCampaignLeads = async (req, res) => {
    try {
        const { businessId, batchId } = req.query;
        let whereClause = { campaignType: 'FREE_SEMINAR' };
        if (batchId && batchId !== '') {
            whereClause.batchId = parseInt(batchId);
        } else if (businessId && businessId !== '') {
            const bizBatches = await prisma.batch.findMany({ where: { businessId: parseInt(businessId) } });
            whereClause.OR = [
                { batchId: { in: bizBatches.map(b => b.id) } },
                { phone: { endsWith: `_BIZ_${businessId}` } },
                { phone: { contains: `_BIZ_${businessId}_` } }
            ];
        }

        console.log('WHERE:', JSON.stringify(whereClause, null, 2));
        const leads = await prisma.lead.findMany({ where: whereClause, orderBy: { updatedAt: 'desc' } });
        console.log('API Leads length:', leads.length);
        const cleanedLeads = leads.map(l => ({
            ...l,
            phone: l.phone ? l.phone.split('_')[0] : ''
        }));
        res.status(200).json(cleanedLeads);
    } catch (error) { res.status(500).json({ error: "Failed to fetch leads" }); }
};

// ==========================================
// 10. STUDENT VERIFICATIONS & DETAILS
// ==========================================
exports.getLeadDetails = async (req, res) => {
    try {
        const { phone } = req.params;
        let cleanPhone = phone.split('_')[0].replace(/[^0-9]/g, '').trim();
        let corePhone = cleanPhone;
        if (corePhone.startsWith('94')) corePhone = corePhone.substring(2);
        else if (corePhone.startsWith('0')) corePhone = corePhone.substring(1);

        const students = await prisma.user.findMany({
            where: {
                OR: [{ phone: { contains: corePhone } }, { whatsapp: { contains: corePhone } }],
                role: { in: ['Student', 'USER', 'user', 'student'] }
            },
            include: { payments: { include: { business: true, batch: true, group: true }, orderBy: { created_at: 'desc' } } }
        });

        if (!students || students.length === 0) return res.status(200).json({ isEnrolled: false });

        // Merge all matching accounts to ensure we don't miss payments if they have duplicate accounts
        let bestStudent = students.find(s => s.payments && s.payments.length > 0) || students[0];
        let allPayments = [];
        students.forEach(s => { if (s.payments) allPayments.push(...s.payments); });

        // Remove duplicate payments by ID if any and sort
        const uniquePaymentsMap = new Map();
        allPayments.forEach(p => uniquePaymentsMap.set(p.id, p));
        bestStudent.payments = Array.from(uniquePaymentsMap.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        let enrolledCourses = [];
        if (bestStudent.payments.length > 0) {
            let subjectIds = [];
            bestStudent.payments.forEach(p => {
                if (p.subjects) {
                    try {
                        p.parsedSubjectIds = JSON.parse(p.subjects).map(id => parseInt(id));
                        subjectIds.push(...p.parsedSubjectIds);
                    } catch (e) { p.parsedSubjectIds = []; }
                } else p.parsedSubjectIds = [];
            });
            if (subjectIds.length > 0) {
                enrolledCourses = await prisma.course.findMany({ where: { id: { in: subjectIds } } });
                bestStudent.payments.forEach(p => {
                    p.courses = enrolledCourses.filter(c => p.parsedSubjectIds.includes(c.id));
                });
            }
        }

        const hasApprovedPayment = bestStudent.payments.some(p => p.status === 1);
        const hasPendingPayment = bestStudent.payments.some(p => p.status === 0 || p.status === 4);
        const latestPaymentStatus = bestStudent.payments[0]?.status ?? null;

        // Group unique enrollments by business, batch & classType
        const uniqueEnrollmentsMap = new Map();
        bestStudent.payments.forEach(p => {
            const classType = p.group?.classType ? parseInt(p.group.classType) : (p.courses?.some(c => c.courseType === 2) ? 2 : 1);
            const key = `${p.businessId}_${p.batchId || 'no_batch'}_class_${classType}`;
            if (!uniqueEnrollmentsMap.has(key)) {
                uniqueEnrollmentsMap.set(key, {
                    businessId: p.businessId,
                    businessName: p.business?.name || 'N/A',
                    batchId: p.batchId,
                    batchName: p.batch?.name || 'N/A',
                    groupId: p.groupId,
                    groupName: p.group?.name || 'N/A',
                    classType: classType,
                    classTypeName: classType === 2 ? 'Paper Class' : 'Theory Class',
                    paymentType: p.payment_type,
                    method: p.method,
                    status: p.status,
                    courses: p.courses ? [...p.courses] : [],
                    latestPaymentDate: p.created_at
                });
            } else {
                const existing = uniqueEnrollmentsMap.get(key);
                if (p.courses) {
                    const existingIds = new Set(existing.courses.map(c => c.id));
                    p.courses.forEach(c => {
                        if (!existingIds.has(c.id)) {
                            existing.courses.push(c);
                            existingIds.add(c.id);
                        }
                    });
                }
                if (p.status === 1) existing.status = 1;
            }
        });
        const uniqueEnrollments = Array.from(uniqueEnrollmentsMap.values());

        if (bestStudent && (!bestStudent.image || bestStudent.image === 'default.png' || bestStudent.image === 'null')) {
            const { dpCode, imagePath } = getAvatarForPhone(phone || bestStudent.phone || bestStudent.whatsapp);
            bestStudent.image = imagePath;
            if (!bestStudent.appChatDp) bestStudent.appChatDp = dpCode;
        }

        res.status(200).json({ 
            isEnrolled: true, 
            hasApprovedPayment,
            hasPendingPayment,
            latestPaymentStatus,
            student: bestStudent, 
            enrolledCourses,
            uniqueEnrollments
        });
    } catch (error) { res.status(500).json({ error: "Failed to fetch lead details" }); }
};

exports.resetStudentPassword = async (req, res) => {
    try {
        const { studentId, newPassword } = req.body;
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({ 
            where: { id: parseInt(studentId) }, 
            data: { 
                password: hashedPassword,
                session_id: crypto.randomBytes(16).toString('hex')
            } 
        });
        res.status(200).json({ message: "Password updated successfully!" });
    } catch (error) { res.status(500).json({ error: "Failed to reset password" }); }
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
// 11. TOGGLE FOLLOW UP CONFIG LOGIC
// ==========================================
const FOLLOWUP_CONFIG_PATH = path.join(__dirname, 'followup-config.json');

const getFollowUpStatus = () => {
    try {
        if (fs.existsSync(FOLLOWUP_CONFIG_PATH)) {
            return JSON.parse(fs.readFileSync(FOLLOWUP_CONFIG_PATH, 'utf-8')).isOn;
        }
    } catch (e) { }
    return false;
};

exports.getFollowUpStatusAPI = (req, res) => {
    res.status(200).json({ isOn: getFollowUpStatus() });
};

exports.toggleFollowUpAPI = (req, res) => {
    try {
        const { isOn } = req.body;
        fs.writeFileSync(FOLLOWUP_CONFIG_PATH, JSON.stringify({ isOn }));
        res.status(200).json({ message: "Updated", isOn });
    } catch (error) { res.status(500).json({ error: "Failed to update toggle" }); }
};

// ==========================================
// 12. AUTO FOLLOW-UP ENGINE
// ==========================================
exports.runAutoFollowUpEngine = async () => {
    // 🔴 Disabled as per user request (Free Seminar does not need 20 hr follow-up)
    // try {
    //     if (!getFollowUpStatus()) return;
    //
    //     const settingsList = await prisma.crmSettings.findMany({ where: { campaignType: 'FREE_SEMINAR' } });
    //     
    //     for (const settings of settingsList) {
    //         if (!settings.metaApiKey) continue;
    //
    //         const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000);
    //         const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000);
    //
    //         const unreadLeads = await prisma.lead.findMany({
    //             where: { 
    //                 batchId: settings.batchId ? parseInt(settings.batchId) : null,
    //                 unreadCount: { gt: 0 }, 
    //                 updatedAt: { lte: twentyHoursAgo, gte: twentyThreeHoursAgo } 
    //             }
    //         });
    //
    //         for (const lead of unreadLeads) {
    //             let formattedPhone = lead.phone.split('_')[0].replace(/[^0-9]/g, ''); 
    //             if (formattedPhone.startsWith('0')) formattedPhone = '94' + formattedPhone.substring(1);
    //
    //             let metaPayload = {
    //                 messaging_product: "whatsapp", recipient_type: "individual", to: formattedPhone, type: "interactive",
    //                 interactive: { type: "button", body: { text: "ආයුබෝවන් පුතේ, ඔයාගේ ගැටලුවට විසඳුමක් හම්බුනාද?" }, action: { buttons: [ { type: "reply", reply: { id: "FU_YES", title: "ඔව්" } }, { type: "reply", reply: { id: "FU_NO", title: "නැත" } } ] } }
    //             };
    //
    //             try {
    //                 await axios.post(`https://graph.facebook.com/v19.0/${settings.waNumId}/messages`, metaPayload, { headers: { 'Authorization': `Bearer ${settings.metaApiKey}` } });
    //                 await prisma.chatMessage.create({ data: { leadId: lead.id, message: "FollowUp Sent", direction: 'outbound', senderType: 'SYSTEM', senderName: 'FollowUpBot' } });
    //             } catch (err) {}
    //         }
    //     }
    // } catch (error) { }
    return;
};

exports.testFollowUpMessage = async (req, res) => {
    try {
        const { testPhone } = req.body;
        if (!testPhone) return res.status(400).json({ error: "Please provide a test phone number." });

        const settings = await prisma.crmSettings.findFirst({ where: { campaignType: 'FREE_SEMINAR' } });
        if (!settings || !settings.metaApiKey) return res.status(400).json({ error: "Meta config missing" });

        let formattedPhone = testPhone.replace(/[^0-9]/g, '');
        if (formattedPhone.startsWith('0')) formattedPhone = '94' + formattedPhone.substring(1);

        let metaPayload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedPhone,
            type: "interactive",
            interactive: {
                type: "button",
                body: { text: "ආයුබෝවන් පුතේ, ඔයාගේ ගැටලුවට විසඳුමක් හම්බුනාද? (TEST)" },
                action: {
                    buttons: [
                        { type: "reply", reply: { id: "FU_YES", title: "ඔව්" } },
                        { type: "reply", reply: { id: "FU_NO", title: "නැත" } }
                    ]
                }
            }
        };

        const response = await axios.post(`https://graph.facebook.com/v19.0/${settings.waNumId}/messages`, metaPayload, {
            headers: { 'Authorization': `Bearer ${settings.metaApiKey}` }
        });

        res.status(200).json({ success: true, message: "Test message sent", data: response.data });
    } catch (error) {
        res.status(500).json({ error: "Test failed", details: error.response?.data || error.message });
    }
};

// setInterval(() => { exports.runAutoFollowUpEngine(); }, 60 * 60 * 1000);


// ==========================================
// 13. AUTO ASSIGN ENGINE
// ==========================================
exports.runAutoAssignEngine = async () => {
    try {
        // Active quotas tika gannawa
        const quotas = await prisma.autoAssignQuota.findMany({
            where: { isActive: true },
            include: { staff: { select: { businessType: true } } }
        });

        if (quotas.length === 0) return;

        // Unassigned thiyena NEW leads tika gannawa
        const unassignedLeads = await prisma.lead.findMany({
            where: {
                campaignType: 'FREE_SEMINAR',
                status: 'NEW',
                assignedTo: null,
                OR: [
                    { callCenterRequestStatus: null },
                    { callCenterRequestStatus: 'REJECTED' }
                ]
            },
            orderBy: { id: 'asc' },
            take: 50 // process 50 at a time to prevent overload
        });

        if (unassignedLeads.length === 0) return;

        for (const lead of unassignedLeads) {
            // Check business ID for mapping
            let leadBizId = null;
            if (lead.batchId) {
                const batch = await prisma.batch.findUnique({ where: { id: lead.batchId }, select: { businessId: true } });
                leadBizId = batch?.businessId;
            }
            if (!leadBizId && lead.phone) {
                const match = lead.phone.match(/_BIZ_(\d+)/);
                if (match) leadBizId = parseInt(match[1]);
            }

            if (!leadBizId) continue;

            // Filter staff who can handle this business and have quota left
            const availableQuotas = quotas.filter(q => {
                if (q.assigned >= q.quotaAmount) return false;

                const cBiz = String(q.staff.businessType || '').toLowerCase().trim();
                const selBizId = String(leadBizId).toLowerCase().trim();
                const cBizIdStr = String(q.staff.businessId || '').toLowerCase().trim();

                return (cBizIdStr === selBizId) || (cBiz.includes(selBizId));
            });

            if (availableQuotas.length === 0) continue; // No one has quota left or matches business

            // Assign to the person with lowest assigned count (Round Robin)
            availableQuotas.sort((a, b) => a.assigned - b.assigned);
            const eligibleQuota = availableQuotas[0];

            await prisma.lead.update({
                where: { id: lead.id },
                data: {
                    assignedTo: eligibleQuota.staffId,
                    status: 'OPEN',
                    phase: 1,
                    callStatus: 'pending',
                    isAutoAssigned: true,
                    assignedAt: new Date()
                }
            });

            eligibleQuota.assigned += 1;
            await prisma.autoAssignQuota.update({
                where: { id: eligibleQuota.id },
                data: { assigned: eligibleQuota.assigned }
            });
        }
    } catch (error) {
        console.error("Error in runAutoAssignEngine:", error);
    }
};

setInterval(() => { exports.runAutoAssignEngine(); }, 60 * 1000); // Run every 1 minute


// ==========================================
// 🔥 GET UNIQUE NUMBERS COUNT (META vs DB)
// ==========================================
exports.getUniqueNumbersCount = async (req, res) => {
    try {
        const { businessId, waId, days } = req.query;

        if (!businessId && !waId) {
            return res.status(400).json({ error: "Please provide either businessId or waId" });
        }

        let whereClause = {};
        if (waId) {
            whereClause.waId = waId;
        } else if (businessId) {
            whereClause.businessId = parseInt(businessId);
        }

        const settings = await prisma.crmSettings.findFirst({
            where: whereClause
        });

        if (!settings) {
            return res.status(404).json({ error: "CRM Settings not found for the given ID." });
        }

        const daysToLookBack = parseInt(days) || 30;
        const startDateObj = new Date();
        startDateObj.setDate(startDateObj.getDate() - daysToLookBack);

        const webhookLogs = await prisma.webhookLog.findMany({
            where: { createdAt: { gte: startDateObj } },
            select: { phone: true }
        });

        const uniqueMetaNumbers = [...new Set(webhookLogs.map(log => log.phone))];
        const totalNumbersFromMeta = uniqueMetaNumbers.length;

        // Strict batch filter applied here too
        let dbSearchWhere = { createdAt: { gte: startDateObj } };
        if (settings.batchId) {
            dbSearchWhere.batchId = parseInt(settings.batchId);
        } else {
            const bizBatches = await prisma.batch.findMany({ where: { businessId: settings.businessId }, select: { id: true } });
            dbSearchWhere.OR = [
                { batchId: { in: bizBatches.map(b => b.id) } },
                { phone: { endsWith: `_BIZ_${settings.businessId}` } },
                { phone: { contains: `_BIZ_${settings.businessId}_` } }
            ];
        }

        const savedLeadRecords = await prisma.lead.findMany({
            where: dbSearchWhere,
            select: { phone: true }
        });

        const savedPhoneNumbers = savedLeadRecords.map(l => l.phone.split('_')[0]);
        const uniqueSavedNumbers = [...new Set(savedPhoneNumbers)];
        const totalNumbersInDB = uniqueSavedNumbers.length;

        const missedNumbers = uniqueMetaNumbers.filter(phone => !uniqueSavedNumbers.includes(phone));

        res.status(200).json({
            success: true,
            accountInfo: {
                businessId: settings.businessId,
                wabaId: settings.waId
            },
            timeRange: `Last ${daysToLookBack} days`,
            summary: {
                totalUniqueNumbersFromMeta: totalNumbersFromMeta,
                totalUniqueNumbersInDB: totalNumbersInDB,
                missedNumbersCount: missedNumbers.length
            },
            missedNumbersList: missedNumbers
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to get unique numbers count" });
    }
};

// 13. Coordinator Overview Stats for Dashboard
exports.getCoordinatorOverviewStats = async (req, res) => {
    try {
        const userId = parseInt(req.user?.userId || req.user?.id || req.query.loggedUserId);
        if (!userId || isNaN(userId)) {
            return res.status(401).json({ error: "Unauthorized. Missing user ID." });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true, businessType: true }
        });

        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

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
                    if (isManagerOf || matchesBizType) {
                        matches.push(biz.id);
                    }
                });
                assignedBusinessIds = matches;
            }
        }

        // Determine lead query filter based on role and query parameters
        const { businessId, batchId } = req.query;
        let baseLeadFilter = {};

        if (isAdmin || isManager) {
            // Manager/Admin views aggregate stats
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
                // If a manager has no assigned business, restrict them to an empty set
                baseLeadFilter.batch = { businessId: -1 };
            }
        } else {
            // Regular Coordinator views only their assigned leads
            baseLeadFilter.assignedTo = userId;
        }

        // Helper to get stats for a specific lead segment
        const getSegmentStats = async (segmentFilter) => {
            const assigned = await prisma.lead.count({
                where: {
                    ...baseLeadFilter,
                    ...segmentFilter
                }
            });

            const covered = await prisma.lead.count({
                where: {
                    ...baseLeadFilter,
                    callStatus: { not: 'pending' },
                    ...segmentFilter
                }
            });

            const pending = await prisma.lead.count({
                where: {
                    ...baseLeadFilter,
                    callStatus: 'pending',
                    ...segmentFilter
                }
            });

            return { assigned, covered, pending };
        };

        // 1. Unread Messages counts
        const freeSeminarUnreads = await prisma.chatMessage.count({
            where: {
                isRead: false,
                lead: {
                    ...baseLeadFilter,
                    campaignType: 'FREE_SEMINAR'
                }
            }
        });

        const afterSeminarUnreads = await prisma.chatMessage.count({
            where: {
                isRead: false,
                lead: {
                    ...baseLeadFilter,
                    campaignType: 'AFTER_SEMINAR'
                }
            }
        });

        // 2. Campaigns Stats Segmented
        const freeSeminar = await getSegmentStats({ campaignType: 'FREE_SEMINAR' });
        const openSeminar = await getSegmentStats({ campaignType: 'AFTER_SEMINAR', inquiryType: { in: ['OPEN_SEMINAR', 'NORMAL'] } });
        const newInquiries = await getSegmentStats({ campaignType: 'AFTER_SEMINAR', inquiryType: 'NEW_INQ' });
        const bridgeTransfers = await getSegmentStats({ campaignType: 'AFTER_SEMINAR', source: 'bridge_transfer' });
        const paidStudents = await getSegmentStats({ campaignType: 'AFTER_SEMINAR', inquiryType: 'PAID_CAMP', enrollmentStatus: 'ENROLLED' });

        // 3. Open Seminar Detailed Stats
        const openSemLeads = await prisma.lead.findMany({
            where: {
                ...baseLeadFilter,
                campaignType: 'AFTER_SEMINAR',
                inquiryType: { in: ['OPEN_SEMINAR', 'NORMAL'] },
                enrollmentStatus: { notIn: ['ENROLLED', 'PAID'] }
            },
            select: {
                coordinationRound: true,
                callStatus: true,
                assignedAt: true,
                createdAt: true
            }
        });

        let r1Pending = 0, r1Delayed = 0, r2Pending = 0, r2Delayed = 0;
        const now = new Date().getTime();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

        openSemLeads.forEach(l => {
            const currentRound = l.coordinationRound || 1;
            const startTime = new Date(l.assignedAt || l.createdAt).getTime();
            const diffMs = now - startTime;
            const isPending = !['answered', 'reject'].includes(l.callStatus);

            if (currentRound === 1) {
                if (diffMs > sevenDaysMs) r1Delayed++;
                if (isPending) r1Pending++;
            } else if (currentRound === 2) {
                if (diffMs > fourteenDaysMs) r2Delayed++;
                if (isPending) r2Pending++;
            }
        });

        res.status(200).json({
            unreads: {
                freeSeminar: freeSeminarUnreads,
                afterSeminar: afterSeminarUnreads,
                total: freeSeminarUnreads + afterSeminarUnreads
            },
            campaigns: {
                freeSeminar,
                openSeminar,
                newInquiries,
                bridgeTransfers,
                paidStudents
            },
            openSeminarDetails: {
                r1Pending,
                r1Delayed,
                r2Pending,
                r2Delayed
            }
        });
    } catch (error) {
        console.error("Error in getCoordinatorOverviewStats:", error);
        res.status(500).json({ error: "Failed to load coordinator dashboard stats." });
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
            if (batchRecord) settings = await prisma.crmSettings.findFirst({ where: { businessId: batchRecord.businessId, campaignType: lead.campaignType || 'FREE_SEMINAR' } });
        } else {
            settings = await prisma.crmSettings.findFirst({ where: { campaignType: lead.campaignType || 'FREE_SEMINAR' } });
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
        
        // Temporarily clear opt-out so they can receive it, but keep it mostly opted out until they say yes.
        // Wait, no need to clear optOut to SEND a message from the bot via API. The API lets you send it. 
        // We just send the message. If they reply, the webhook will clear the opt-out.
        
        res.status(200).json({ message: "Opt-in request sent successfully" });
    } catch (error) {
        console.error("Error in sendOptInRequest:", error);
        res.status(500).json({ error: "Failed to send opt-in request." });
    }
};

const callTemplateCacheFreeSem = new Map();

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
            settings = await prisma.crmSettings.findFirst({ where: { businessId: extractedBizId, campaignType: lead.campaignType || 'FREE_SEMINAR' } });
        }
        if (!settings && lead.batchId) {
            const batchRecord = await prisma.batch.findUnique({ where: { id: lead.batchId } });
            if (batchRecord) {
                settings = await prisma.crmSettings.findFirst({ where: { businessId: batchRecord.businessId, campaignType: lead.campaignType || 'FREE_SEMINAR' } });
                if (!settings) settings = await prisma.crmSettings.findFirst({ where: { businessId: batchRecord.businessId } });
            }
        }
        if (!settings && extractedBizId) {
            settings = await prisma.crmSettings.findFirst({ where: { businessId: extractedBizId } });
        }
        if (!settings) {
            settings = await prisma.crmSettings.findFirst({ where: { campaignType: lead.campaignType || 'FREE_SEMINAR' } });
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
            templateName = callTemplateCacheFreeSem.get(settings.waId);
            if (!templateName) {
                try {
                    const resTemplates = await axios.get(`https://graph.facebook.com/v19.0/${settings.waId}/message_templates`, {
                        headers: { Authorization: `Bearer ${settings.metaApiKey}` }
                    });
                    const callReqs = resTemplates.data.data.filter(t => (t.name.startsWith('call_request') || t.name === 'request_call_permission') && t.status === 'APPROVED');
                    if (callReqs.length > 0) {
                        callReqs.sort((a, b) => b.name.localeCompare(a.name));
                        templateName = callReqs[0].name;
                    } else {
                        templateName = "request_call_permission";
                    }
                } catch (err) {
                    console.error("Failed to fetch templates for waId " + settings.waId + ":", err.message);
                    templateName = "request_call_permission";
                }
                callTemplateCacheFreeSem.set(settings.waId, templateName);
            }
        } else {
            templateName = "request_call_permission";
        }
        
        const messageText = "අපට ඔබව ඇමතීමට අවසර දිය හැකිද? / Can we call you to explain details?";
        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedPhone,
            type: "template",
            template: {
                name: templateName,
                language: { code: "en" }
            }
        };

        const metaRes = await axios.post(`https://graph.facebook.com/v19.0/${settings.waNumId}/messages`, payload, { headers: { 'Authorization': `Bearer ${settings.metaApiKey}` } });
        
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
        console.error("Error in sendCallPermissionRequest:", error.response?.data || error.message);
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

exports.resolveLeadByPhone = async (req, res) => {
    try {
        const { phone, name, businessId, batchId, campaignType } = req.body;
        if (!phone) {
            return res.status(400).json({ error: "Phone number is required." });
        }

        const userId = req.user?.id || req.user?.userId;
        const userRoleRaw = req.user?.role || '';
        const userRole = userRoleRaw.toUpperCase().replace(/ /g, '_');
        const isManager = ['SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER', 'ASS_MANAGER'].includes(userRole);
        const assignedTo = isManager ? null : (userId ? parseInt(userId) : null);

        const parsedBizId = businessId ? parseInt(businessId) : null;
        const parsedBatchId = batchId ? parseInt(batchId) : null;

        const cleanDigits = phone.replace(/[^0-9]/g, '');
        const suffix7 = cleanDigits.slice(-7);
        const localPhone = cleanDigits.startsWith('94') ? '0' + cleanDigits.substring(2) : cleanDigits;

        // 1. Try to find an existing Lead
        let existingLead = null;
        if (suffix7.length >= 7) {
            const candidateLeads = await prisma.lead.findMany({
                where: {
                    phone: { contains: suffix7 }
                },
                include: {
                    batch: { select: { id: true, name: true, businessId: true } },
                    assignedUser: { select: { firstName: true, lastName: true, businessType: true } }
                }
            });

            if (candidateLeads && candidateLeads.length > 0) {
                if (parsedBatchId) {
                    existingLead = candidateLeads.find(l => l.batchId === parsedBatchId) || null;
                } else if (parsedBizId) {
                    existingLead = candidateLeads.find(l => l.batch?.businessId === parsedBizId || l.phone.includes(`_BIZ_${parsedBizId}`)) || candidateLeads[0];
                } else {
                    existingLead = candidateLeads[0];
                }
            }
        }

        // 2. If existing lead found, return it formatted
        if (existingLead) {
            return res.status(200).json({
                success: true,
                lead: {
                    ...existingLead,
                    rawPhone: existingLead.phone,
                    businessId: existingLead.batch?.businessId || (existingLead.phone && existingLead.phone.includes('_BIZ_') ? parseInt(existingLead.phone.split('_BIZ_')[1]?.split('_')[0]) : null),
                    phone: existingLead.phone ? existingLead.phone.split('_BIZ')[0] : localPhone
                }
            });
        }

        // 3. If not found, create a new lead
        let dbPhone = localPhone;
        if (parsedBizId) {
            dbPhone = parsedBatchId
                ? `${localPhone}_BIZ_${parsedBizId}_BATCH_${parsedBatchId}`
                : `${localPhone}_BIZ_${parsedBizId}`;
        }

        const newLead = await prisma.lead.upsert({
            where: { phone: dbPhone },
            update: {
                name: name || undefined
            },
            create: {
                name: name || 'Inquiry Contact',
                phone: dbPhone,
                batchId: parsedBatchId,
                source: 'inbound_call',
                campaignType: campaignType || 'FREE_SEMINAR',
                assignedTo: assignedTo,
                status: assignedTo ? 'OPEN' : 'NEW',
                phase: 1,
                callStatus: 'pending'
            },
            include: {
                batch: { select: { id: true, name: true, businessId: true } },
                assignedUser: { select: { firstName: true, lastName: true, businessType: true } }
            }
        });

        return res.status(200).json({
            success: true,
            lead: {
                ...newLead,
                rawPhone: newLead.phone,
                businessId: newLead.batch?.businessId || (newLead.phone && newLead.phone.includes('_BIZ_') ? parseInt(newLead.phone.split('_BIZ_')[1]?.split('_')[0]) : null),
                phone: newLead.phone ? newLead.phone.split('_BIZ')[0] : localPhone
            }
        });
    } catch (error) {
        console.error("Error resolving lead by phone:", error);
        res.status(500).json({ error: error.message });
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

        await prisma.blockedNumber.deleteMany({
            where: {
                OR: [
                    { phone: rawPhone },
                    { phone: { contains: phoneSuffix } }
                ]
            }
        });

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

