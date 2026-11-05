const axios = require('axios');

const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');

const { launchIvrBot } = require('../services/ivrBot');

// Fallback hardcoded credentials
const FALLBACK_WA_PHONE_ID = "1208424262355917";
const FALLBACK_WA_TOKEN = "EAAZAqcbObykgBSOwd3VRsafnLCI8CIs6DJpZB5g2CJoF5cMReZBLhC5hEnGTbpZBDINZB43qFIofy11YYAysc3cvU2Jwv5nwbZBqNM07NoZCANZBFEY5CqrTZApLi2YPDiiRIEvgsSsm2QFHpynt9ilvMZC10uD1aFq51EVqmIzfE822W3eVE6kuXlyQvpj3l8HXSarwZDZD";

global.callIdToWaNumId = global.callIdToWaNumId || new Map();
const callIdToWaNumId = global.callIdToWaNumId;

async function getMetaCredentials(businessType, receivingWaNumId, businessId, campaignType) {
    if (receivingWaNumId) {
        const cleanWa = String(receivingWaNumId).trim();
        const settings = await prisma.crmSettings.findFirst({ where: { waNumId: cleanWa } });
        if (settings && settings.metaApiKey) {
            return { phoneId: settings.waNumId.trim(), token: settings.metaApiKey.trim(), waId: settings.waId };
        }
    }
    if (businessId && businessId !== 'ALL' && !isNaN(parseInt(businessId))) {
        const bId = parseInt(businessId);
        let whereClause = { businessId: bId };
        if (campaignType) {
            whereClause.campaignType = campaignType;
        }
        
        let settings = await prisma.crmSettings.findFirst({ where: whereClause });
        
        // Fallback to any if campaignType specific not found
        if (!settings && campaignType) {
            settings = await prisma.crmSettings.findFirst({ where: { businessId: bId } });
        }
        
        if (settings && settings.metaApiKey && settings.waNumId) {
            return { phoneId: settings.waNumId, token: settings.metaApiKey, waId: settings.waId };
        }
    }
    if (businessType && businessType !== 'ALL') {
        const business = await prisma.business.findFirst({ where: { name: businessType } });
        if (business) {
            let whereClause = { businessId: business.id };
            if (campaignType) whereClause.campaignType = campaignType;
            let settings = await prisma.crmSettings.findFirst({ where: whereClause });
            
            if (!settings && campaignType) {
                settings = await prisma.crmSettings.findFirst({ where: { businessId: business.id } });
            }
            
            if (settings && settings.metaApiKey && settings.waNumId) {
                return { phoneId: settings.waNumId, token: settings.metaApiKey, waId: settings.waId };
            }
        }
    }
    return { phoneId: FALLBACK_WA_PHONE_ID, token: FALLBACK_WA_TOKEN, waId: null };
}

// ================= WEBHOOKS FOR META =================

// Verification endpoint for Meta App Dashboard
exports.verifyWebhook = (req, res) => {
    const VERIFY_TOKEN = process.env.WA_WEBHOOK_VERIFY_TOKEN || "happy"; // Or any string you prefer to set in Meta dashboard
    
    let mode = req.query["hub.mode"];
    let token = req.query["hub.verify_token"];
    let challenge = req.query["hub.challenge"];

    if (mode && token) {
        if (mode === "subscribe" && token === VERIFY_TOKEN) {
            console.log("[WhatsApp Webhook] WEBHOOK_VERIFIED");
            res.status(200).send(challenge);
        } else {
            console.log("[WhatsApp Webhook] Verification failed. Token mismatch.");
            res.sendStatus(403);
        }
    } else {
        res.status(400).send("Missing parameters");
    }
};

// Event endpoint for Meta to send calls/messages
exports.handleWebhookEvent = async (req, res) => {
    let body = req.body;
    
    console.log("[WhatsApp Webhook] Received Event:", JSON.stringify(body, null, 2));

    if (body.object) {
        // Return a '200 OK' response to all requests to prevent Meta from retrying
        res.status(200).send('EVENT_RECEIVED');
        
        // Handle specific calling/messaging/alert events here
        if (body.entry && body.entry[0].changes && body.entry[0].changes[0]) {
            const change = body.entry[0].changes[0];
            const field = change.field;
            
            // Check for Account Alerts or Phone Number Quality updates
            if (field === 'account_update' || field === 'account_alerts' || 
                field === 'phone_number_quality_update' || field === 'business_status_update' || field === 'message_template_status_update') {
                
                try {
                    // Extract a readable message
                    let alertMsg = `Update for ${field}`;
                    if (change.value.event) alertMsg = `Event: ${change.value.event}`;
                    if (change.value.decision) alertMsg = `Decision: ${change.value.decision}`;
                    if (change.value.rejection_reason) alertMsg += ` - Reason: ${change.value.rejection_reason}`;
                    
                    const newAlert = await prisma.whatsAppAlert.create({
                        data: {
                            alertType: field,
                            message: alertMsg,
                            payload: change.value
                        }
                    });

                    // Emit to admins via Socket.io
                    const { getIo } = require('./chatController');
                    const io = getIo();
                    if (io) {
                        io.emit('whatsapp_alert', newAlert);
                    }
                } catch (err) {
                    console.error("[WhatsApp Webhook] Error saving alert:", err);
                }
            }
            
            // Check for incoming messages/calls
            if (field === 'messages' && change.value.messages) {
                const { getIo } = require('./chatController');
                const io = getIo();
                
                for (const msg of change.value.messages) {
                    if (msg.type === 'webrtc' && msg.webrtc && msg.webrtc.action === 'offer') {
                        const from = msg.from;
                        const callId = msg.webrtc.call_id || msg.id;
                        const sdp = msg.webrtc.sdp;
                        let receivingWaNumId = change.value.metadata?.phone_number_id;
                        
                        
                        if (msg.webrtc.action === 'offer') {
                            const from = msg.from;
                            const sdp = msg.webrtc.sdp;
                            
                            // Optionally extract receiving number (waNumId) from the webhook payload structure
                            let receivingWaNumId = null;
                            if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.metadata) {
                                receivingWaNumId = body.entry[0].changes[0].value.metadata.phone_number_id;
                            } 
                            
                            if (!receivingWaNumId && body.entry && body.entry[0] && body.entry[0].id) {
                                const waId = String(body.entry[0].id).trim();
                                const allSettings = await prisma.crmSettings.findMany({ select: { waId: true, waNumId: true } });
                                const settings = allSettings.find(s => s.waId && s.waId.trim() === waId);
                                if (settings && settings.waNumId) {
                                    receivingWaNumId = settings.waNumId;
                                }
                            }
                            
                            if (receivingWaNumId) {
                                callIdToWaNumId.set(callId, receivingWaNumId);
                            }
                            
                            console.log(`[WhatsApp Incoming Call] Received call from ${from}, CallID: ${callId}, ReceivingWaNumId: ${receivingWaNumId}`);
                            
                            try {
                                // Find which business received the call
                                let businessIdToMatch = null;
                                let businessRingtoneUrl = '/storage/ringtone/01.mp3';
                                let businessType = 'ALL';
                                
                                if (receivingWaNumId) {
                                    const settings = await prisma.crmSettings.findFirst({
                                        where: { waNumId: receivingWaNumId }
                                    });
                                    if (settings && settings.businessId) {
                                        businessIdToMatch = settings.businessId;
                                        const b = await prisma.business.findUnique({ where: { id: businessIdToMatch } });
                                        if (b) {
                                            businessType = b.name.trim();
                                            if (b.ringtone) businessRingtoneUrl = `/storage/ringtone/${b.ringtone}`;
                                        }
                                    }
                                }

                                const fromPhone = String(from || '');
                                const rawDigits = fromPhone.replace(/[^0-9]/g, '');
                                const phoneSuffix9 = rawDigits.length >= 9 ? rawDigits.slice(-9) : rawDigits;

                                let candidateLeads = [];
                                if (phoneSuffix9) {
                                    candidateLeads = await prisma.lead.findMany({
                                        where: {
                                            phone: { contains: phoneSuffix9 }
                                        },
                                        include: {
                                            assignedUser: true,
                                            batch: { include: { business: true } }
                                        },
                                        orderBy: { id: 'desc' },
                                        take: 10
                                    });
                                }

                                function scoreLead(l) {
                                    let score = 0;
                                    const isBizMatch = businessIdToMatch && (
                                        l.batch?.businessId === businessIdToMatch || 
                                        (l.phone && l.phone.includes(`_BIZ_${businessIdToMatch}`))
                                    );
                                    
                                    if (isBizMatch) score += 50;
                                    if (l.assignedTo) score += 15;
                                    return score;
                                }

                                const sortedLeads = [...candidateLeads].sort((a, b) => scoreLead(b) - scoreLead(a));
                                const lead = sortedLeads[0] || null;
                                
                                let targetAgentId = null;
                                let leadName = 'Unknown Caller';
                                let isNewInquiry = true;
                                
                                if (lead) {
                                    isNewInquiry = false;
                                    leadName = lead.name || 'Unknown Caller';
                                    
                                    if (!businessIdToMatch) {
                                        if (lead.batch?.businessId) {
                                            businessIdToMatch = lead.batch.businessId;
                                        } else if (lead.phone && lead.phone.includes('_BIZ_')) {
                                            const m = lead.phone.match(/_BIZ_(\d+)/);
                                            if (m) businessIdToMatch = parseInt(m[1], 10);
                                        }
                                    }
                                    if (lead.batch?.business) {
                                        businessType = lead.batch.business.name.trim();
                                        if (lead.batch.business.ringtone) {
                                            businessRingtoneUrl = `/storage/ringtone/${lead.batch.business.ringtone}`;
                                        }
                                    }
                                    if (lead.assignedTo) {
                                        // Check if assigned staff is an eligible COORDINATOR and ACTIVE and ONLINE
                                        const staff = await prisma.user.findUnique({
                                            where: { id: lead.assignedTo }
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
                                                targetAgentId = staff.id;
                                                console.log(`[WhatsApp Incoming Call] Assigned coordinator ${staff.id} (${staff.firstName}) is ACTIVE & ONLINE. Routing EXCLUSIVELY to them.`);
                                            } else {
                                                console.log(`[WhatsApp Incoming Call] Assigned coordinator ${staff.id} (${staff.firstName}) is NOT available (status: ${staff.agentStatus}, online: ${isAgentOnline}, isCoordinator: ${isCoordinator}). Falling back to live coordinator pool.`);
                                            }
                                        }
                                    }
                                }
                                
                                const payload = {
                                    callId,
                                    from,
                                    leadName,
                                    businessType,
                                    sdp,
                                    receivingWaNumId,
                                    ringtoneUrl: businessRingtoneUrl,
                                    ivrUrl: '/api/storage/ringtone/IVR01.mp3',
                                    isNewInquiry,
                                    businessId: businessIdToMatch
                                };

                                // Immediately record incoming call as MISSED (will be changed to COMPLETED upon answer)
                                try {
                                    await prisma.whatsAppCallRecord.upsert({
                                        where: { callId: callId },
                                        update: {
                                            leadPhone: from,
                                            direction: 'INBOUND',
                                            isNewInquiry,
                                            businessId: businessIdToMatch,
                                            agentId: targetAgentId || undefined
                                        },
                                        create: {
                                            callId: callId,
                                            leadPhone: from,
                                            direction: 'INBOUND',
                                            status: 'MISSED',
                                            duration: 0,
                                            isNewInquiry,
                                            businessId: businessIdToMatch,
                                            agentId: targetAgentId || null
                                        }
                                    });
                                } catch (dbErr) {
                                    console.error("[WhatsApp Incoming Call] Error logging initial call record:", dbErr);
                                }

                                if (io) {
                                    let hasOnlineAgents = false;

                                    if (targetAgentId) {
                                        hasOnlineAgents = true;
                                        console.log(`[WhatsApp Incoming Call] Routing EXCLUSIVELY to assigned active online agent: ${targetAgentId}`);
                                        io.to(`user_${targetAgentId}`).emit('incoming_wa_call', payload);
                                    } else {
                                        const idleRoom = io.sockets.adapter.rooms.get(`wa_call_agent_idle_${businessType}`);
                                        const allRoom = io.sockets.adapter.rooms.get('wa_call_agent_idle_ALL');
                                        const idleCount = idleRoom ? idleRoom.size : 0;
                                        const allCount = allRoom ? allRoom.size : 0;
                                        
                                        if (idleCount > 0 || allCount > 0) {
                                            hasOnlineAgents = true;
                                            console.log(`[WhatsApp Incoming Call] Routing to business pool: wa_call_agent_idle_${businessType} (${idleCount}) and wa_call_agent_idle_ALL (${allCount})`);
                                            io.to(`wa_call_agent_idle_${businessType}`).to('wa_call_agent_idle_ALL').emit('incoming_wa_call', payload);
                                        }
                                    }

                                    // 📱 Also dispatch high-priority FCM notification to active mobile staff
                                    try {
                                        const { notifyIncomingCallToActiveStaff } = require('../services/fcmCallNotifier');
                                        notifyIncomingCallToActiveStaff(payload, targetAgentId);
                                    } catch (fcmErr) {
                                        console.warn('[FCM Call Trigger Error]:', fcmErr.message);
                                    }

                                    // If still no online agents, trigger Headless IVR Bot
                                    if (!hasOnlineAgents) {
                                        console.log(`[WhatsApp Incoming Call] NO agents online for ${businessType} or ALL. Triggering Headless IVR Bot.`);
                                        io.to(`wa_call_headless_bot`).emit('incoming_wa_call', payload);
                                        launchIvrBot(payload);
                                    }
                                }
                            } catch (err) {
                                console.error("[WhatsApp Incoming Call] Error routing call:", err);
                            }
                        } else if (msg.webrtc.action === 'answer' || msg.webrtc.sdp_type === 'answer' || (msg.webrtc.sdp && msg.webrtc.action !== 'offer')) {
                            console.log(`[WhatsApp Webhook] Received SDP Answer from Meta for Outbound Call: ${callId}`);
                            if (io) {
                                io.emit('whatsapp_outbound_answer', {
                                    callId,
                                    sdp: msg.webrtc.sdp,
                                    to: msg.from
                                });
                                io.emit('whatsapp_call_status', {
                                    callId,
                                    status: 'RINGING'
                                });
                            }
                        } else if (msg.webrtc.action === 'ringing') {
                            console.log(`[WhatsApp Webhook] Outbound Call is RINGING at recipient phone: ${callId}`);
                            if (io) {
                                io.emit('whatsapp_call_status', {
                                    callId,
                                    status: 'RINGING'
                                });
                            }
                        } else if (msg.webrtc.action === 'accept' || msg.webrtc.action === 'connect') {
                            console.log(`[WhatsApp Webhook] Outbound Call CONNECTED: ${callId}`);
                            if (io) {
                                io.emit('whatsapp_call_status', {
                                    callId,
                                    status: 'CONNECTED'
                                });
                            }
                        } else if (msg.webrtc.action === 'terminate' || msg.webrtc.action === 'cancel' || msg.webrtc.action === 'rejected') {
                            console.log(`[WhatsApp Webhook] Call disconnected or cancelled: ${callId}`);
                            if (io) {
                                io.emit('whatsapp_call_end', { callId });
                                io.emit('whatsapp_call_disconnected', { callId });
                                io.emit('call_history_updated', { callId });
                            }
                        }
                    }
                }
            }

            // Also check for calls payload structure from Meta (calls: [...])
            if (change.value.calls && change.value.calls.length > 0) {
                const { getIo } = require('./chatController');
                const io = getIo();
                for (const callData of change.value.calls) {
                    const sdpData = callData.connection?.webrtc?.sdp || callData.session?.sdp || "";
                    const callId = callData.id || callData.call_id;
                    console.log(`[WhatsApp Webhook] Meta Calls Event: ${callData.event}, direction: ${callData.direction}, callId: ${callId}`);
                    
                    if (io) {
                        if (callData.event === 'connect' && callData.direction === 'BUSINESS_INITIATED') {
                            io.emit('whatsapp_outbound_answer', {
                                callId,
                                sdp: sdpData,
                                to: callData.to
                            });
                            io.emit('whatsapp_call_status', {
                                callId,
                                status: 'RINGING'
                            });
                        } else if (callData.event === 'ringing') {
                            io.emit('whatsapp_call_status', {
                                callId,
                                status: 'RINGING'
                            });
                        } else if (callData.event === 'accepted' || callData.event === 'accept') {
                            io.emit('whatsapp_call_status', {
                                callId,
                                status: 'CONNECTED'
                            });
                        } else if (callData.event === 'terminate') {
                            io.emit('whatsapp_call_end', { callId });
                            io.emit('whatsapp_call_disconnected', { callId });
                            io.emit('call_history_updated', { callId });
                        }
                    }
                }
            }
        }
    } else {
        res.sendStatus(404);
    }
};

// Get Alerts for Dashboard
exports.getAlerts = async (req, res) => {
    try {
        const alerts = await prisma.whatsAppAlert.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        res.status(200).json({ success: true, alerts });
    } catch (error) {
        console.error('Error fetching alerts', error);
        res.status(500).json({ error: error.message });
    }
};

// Get Live WhatsApp Number Status from Meta, Billing & Messaging Limits
exports.getStatus = async (req, res) => {
    try {
        const { businessId, businessIds } = req.query;

        // Build where clause for crmSettings and WhatsAppBillingRecord
        let settingsWhere = { metaApiKey: { not: null }, waId: { not: null } };
        let billingWhere = {};

        if (businessId && businessId !== 'ALL') {
            const bId = parseInt(businessId);
            if (!isNaN(bId)) {
                settingsWhere.businessId = bId;
                billingWhere.businessId = bId;
            }
        } else if (businessIds) {
            const idList = String(businessIds)
                .split(',')
                .map(id => parseInt(id.trim()))
                .filter(id => !isNaN(id));
            if (idList.length > 0) {
                settingsWhere.businessId = { in: idList };
                billingWhere.businessId = { in: idList };
            }
        }

        const settings = await prisma.crmSettings.findMany({
            where: settingsWhere,
            select: { waId: true, metaApiKey: true, businessId: true }
        });
        
        // Deduplicate by waId
        const uniqueWABAs = Array.from(new Map(settings.map(s => [s.waId.trim(), s])).values());
        
        // Fetch Meta WABA and Phone Numbers concurrently
        const metaResults = await Promise.allSettled(
            uniqueWABAs.map(async (s) => {
                const waId = s.waId.trim();
                const token = s.metaApiKey.trim();
                const [wabaRes, numRes] = await Promise.all([
                    axios.get(`https://graph.facebook.com/v20.0/${waId}?fields=id,name,account_review_status,currency&access_token=${token}`).catch(() => null),
                    axios.get(`https://graph.facebook.com/v20.0/${waId}/phone_numbers?fields=quality_rating,status,verified_name,display_phone_number,messaging_limit_tier,code_verification_status,name_status,throughput&access_token=${token}`).catch(() => null)
                ]);
                return {
                    waba: wabaRes?.data || { id: waId, name: 'Unknown WABA', account_review_status: 'UNKNOWN', currency: 'USD' },
                    numbers: numRes?.data?.data || []
                };
            })
        );
        
        const wabaAccounts = [];
        let allNumbers = [];
        
        metaResults.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
                const { waba, numbers } = result.value;
                if (waba) wabaAccounts.push(waba);
                if (Array.isArray(numbers)) {
                    numbers.forEach(n => {
                        allNumbers.push({
                            ...n,
                            waba_id: waba?.id,
                            waba_name: waba?.name,
                            waba_status: waba?.account_review_status
                        });
                    });
                }
            }
        });
        
        // Calculate Month Start
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const billingQueryWhere = {
            createdAt: { gte: startOfMonth },
            ...billingWhere
        };
        
        // Parallel queries to database for billing and alerts
        const [billingSum, categoryStats, phoneSpendStats, recentAlerts] = await Promise.all([
            prisma.whatsAppBillingRecord.aggregate({
                _sum: { costUsd: true },
                _count: { id: true },
                where: billingQueryWhere
            }).catch(() => ({ _sum: { costUsd: 0 }, _count: { id: 0 } })),

            prisma.whatsAppBillingRecord.groupBy({
                by: ['category'],
                _sum: { costUsd: true },
                _count: { id: true },
                where: billingQueryWhere
            }).catch(() => []),

            prisma.whatsAppBillingRecord.groupBy({
                by: ['phoneNumberId'],
                _sum: { costUsd: true },
                _count: { id: true },
                where: billingQueryWhere
            }).catch(() => []),

            prisma.whatsAppAlert.findMany({
                where: {
                    createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                },
                orderBy: { createdAt: 'desc' },
                take: 30
            }).catch(() => [])
        ]);

        const phoneSpendMap = new Map();
        phoneSpendStats.forEach(stat => {
            if (stat.phoneNumberId) {
                phoneSpendMap.set(String(stat.phoneNumberId), {
                    costUsd: stat._sum?.costUsd || 0,
                    messages: stat._count?.id || 0
                });
            }
        });

        // Helper to format messaging limit tier
        const formatMessagingTier = (rawTier, nameStatus) => {
            if (rawTier) {
                const upper = String(rawTier).toUpperCase();
                if (upper.includes('250')) return { tier: 'TIER_250', label: 'Tier 250', limit: '250 / Day' };
                if (upper.includes('1K') || upper.includes('1000') || upper.includes('1_K')) return { tier: 'TIER_1K', label: 'Tier 1K', limit: '1,000 / Day' };
                if (upper.includes('10K') || upper.includes('10000') || upper.includes('10_K')) return { tier: 'TIER_10K', label: 'Tier 10K', limit: '10,000 / Day' };
                if (upper.includes('100K') || upper.includes('100000') || upper.includes('100_K')) return { tier: 'TIER_100K', label: 'Tier 100K', limit: '100,000 / Day' };
                if (upper.includes('UNLIMITED')) return { tier: 'TIER_UNLIMITED', label: 'Unlimited', limit: 'Unlimited / Day' };
                return { tier: upper, label: upper, limit: upper };
            }
            if (nameStatus === 'APPROVED') {
                return { tier: 'TIER_1K', label: 'Tier 1K', limit: '1,000 / Day' };
            }
            return { tier: 'TIER_250', label: 'Tier 250', limit: '250 / Day' };
        };

        // Deduplicate numbers and enrich with spend & limits
        const uniqueNumbersMap = new Map();
        for (const num of allNumbers) {
            if (!uniqueNumbersMap.has(num.id)) {
                const spendInfo = phoneSpendMap.get(String(num.id)) || { costUsd: 0, messages: 0 };
                const tierInfo = formatMessagingTier(num.messaging_limit_tier, num.name_status);
                
                uniqueNumbersMap.set(num.id, {
                    ...num,
                    quality_rating: num.quality_rating || 'GREEN',
                    status: num.status || 'CONNECTED',
                    name_status: num.name_status || 'APPROVED',
                    tier: tierInfo.tier,
                    tier_label: tierInfo.label,
                    tier_limit: tierInfo.limit,
                    month_spend_usd: Number((spendInfo.costUsd || 0).toFixed(2)),
                    month_spend_lkr: Math.round((spendInfo.costUsd || 0) * 305),
                    month_messages: spendInfo.messages || 0
                });
            }
        }
        const uniqueNumbers = Array.from(uniqueNumbersMap.values());

        // Check for payment failures in alerts
        const paymentAlerts = recentAlerts.filter(a => {
            const lowerMsg = (a.message || '').toLowerCase();
            const lowerType = (a.alertType || '').toLowerCase();
            return lowerMsg.includes('payment') || lowerMsg.includes('card') || lowerMsg.includes('decline') || 
                   lowerMsg.includes('failed') || lowerMsg.includes('limit') || lowerType.includes('payment');
        });

        const totalCostUsd = Number((billingSum._sum?.costUsd || 0).toFixed(2));
        const totalCostLkr = Math.round(totalCostUsd * 305);
        const totalMessages = billingSum._count?.id || 0;

        // Payment status check
        const hasPaymentIssue = paymentAlerts.length > 0;

        // Restriction check
        const restrictedAccounts = wabaAccounts.filter(w => w.account_review_status && w.account_review_status !== 'APPROVED');
        const restrictedNumbers = uniqueNumbers.filter(n => (n.status && n.status !== 'CONNECTED') || (n.name_status && n.name_status === 'DECLINED'));

        res.status(200).json({
            success: true,
            data: uniqueNumbers,
            billing: {
                totalMonthCostUsd: totalCostUsd,
                totalMonthCostLkr: totalCostLkr,
                totalMessagesThisMonth: totalMessages,
                outstandingDueUsd: totalCostUsd,
                outstandingDueLkr: totalCostLkr,
                paymentMethodStatus: hasPaymentIssue ? 'FAILED' : 'ACTIVE',
                paymentMethodLabel: hasPaymentIssue ? 'Payment Failed / Action Required' : 'Active & Healthy (Card Linked)',
                categories: categoryStats.map(c => ({
                    category: c.category || 'OTHER',
                    costUsd: Number((c._sum?.costUsd || 0).toFixed(2)),
                    costLkr: Math.round((c._sum?.costUsd || 0) * 305),
                    count: c._count?.id || 0
                })),
                wabaAccounts,
                restrictedAccounts,
                restrictedNumbersCount: restrictedNumbers.length,
                paymentAlerts
            }
        });
    } catch (error) {
        console.error('Error fetching WA status', error.message);
        res.status(500).json({ error: error.message });
    }
};

// ================= CALLING METHODS =================

// Handles ICE Candidates from the frontend and sends to Meta
exports.sendIceCandidate = async (req, res) => {
    try {
        const { callId, candidate } = req.body;
        console.log(`[WhatsApp Call Test] Sending ICE Candidate for Call ${callId}`, candidate);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error sending ICE candidate', error);
        res.status(500).json({ error: error.message });
    }
};

// Handles WebRTC SDP Answer from the frontend and sends to Meta
exports.answerCall = async (req, res) => {
    try {
        const { callId, sdp, businessType, businessId } = req.body;
        let receivingWaNumId = req.body.receivingWaNumId || callIdToWaNumId.get(callId);

        if (!receivingWaNumId && global.callIdToWaNumId) {
            receivingWaNumId = global.callIdToWaNumId.get(callId);
        }

        let resolvedBusinessId = businessId;
        if (!receivingWaNumId && callId) {
            try {
                const callRec = await prisma.whatsAppCallRecord.findUnique({ where: { callId } });
                if (callRec && callRec.businessId) {
                    resolvedBusinessId = resolvedBusinessId || callRec.businessId;
                    const s = await prisma.crmSettings.findFirst({ where: { businessId: callRec.businessId } });
                    if (s && s.waNumId) receivingWaNumId = s.waNumId;
                }
            } catch (dbLookupErr) {
                console.warn("[answerCall] Failed DB lookup for missing receivingWaNumId:", dbLookupErr.message);
            }
        }
        
        console.log(`[WhatsApp Call Test] Sending SDP Answer for Call ${callId} (Business: ${businessType}, NumId: ${receivingWaNumId}, BizId: ${resolvedBusinessId})`);
        
        const creds = await getMetaCredentials(businessType, receivingWaNumId, resolvedBusinessId);
        
        // POST to Meta Cloud API to accept the call
        await axios.post(`https://graph.facebook.com/v20.0/${creds.phoneId}/calls`, {
            messaging_product: 'whatsapp',
            call_id: callId,
            action: 'accept',
            session: {
                sdp_type: 'answer',
                sdp: sdp
            }
        }, { headers: { Authorization: `Bearer ${creds.token}` }});

        // Notify other agents to stop ringing
        try {
            const { getIo } = require('./chatController');
            const io = getIo();
            if (io && req.user) {
                const userId = req.user.id || req.user.userId || req.user.studentId;
                if (!userId) {
                    console.warn("No userId found in req.user for answerCall notification");
                    return;
                }
                const user = await prisma.user.findUnique({ where: { id: parseInt(userId, 10) } });
                const businessType = user?.businessType ? String(user.businessType).trim() : "ALL";
                
                const payload = {
                    callId: callId,
                    answeredBy: userId
                };
                io.to(`wa_call_agent_idle_${businessType}`).to('wa_call_agent_idle_ALL').emit('whatsapp_call_answered_by_other', payload);
                io.emit('whatsapp_call_answered_by_other', payload);
                console.log(`[WhatsApp Call Answered] Broadcast whatsapp_call_answered_by_other for callId: ${callId} answered by user: ${userId}`);
            }
        } catch (err) {
            console.error("Error notifying other agents of answered call:", err);
        }

        // Update call record to COMPLETED and set answering agent
        try {
            const userId = req.user ? (req.user.id || req.user.userId) : null;
            if (callId) {
                await prisma.whatsAppCallRecord.upsert({
                    where: { callId: callId },
                    update: {
                        agentId: userId ? parseInt(userId) : null,
                        status: userId ? 'COMPLETED' : 'MISSED'
                    },
                    create: {
                        callId: callId,
                        agentId: userId ? parseInt(userId) : null,
                        leadPhone: req.body.leadPhone || '',
                        direction: 'INBOUND',
                        status: userId ? 'COMPLETED' : 'MISSED',
                        duration: 0,
                        businessId: req.body.businessId ? parseInt(req.body.businessId) : null
                    }
                });
            }
        } catch (recErr) {
            console.error("Error updating call record on answer:", recErr);
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error answering call', error.response ? error.response.data : error.message);
        res.status(500).json({ error: error.message });
    }
};

// Rejects an incoming call
exports.rejectCall = async (req, res) => {
    try {
        const { callId, businessType } = req.body;
        const receivingWaNumId = req.body.receivingWaNumId || callIdToWaNumId.get(callId);
        
        console.log(`[WhatsApp Call Test] Rejecting Call ${callId} (Business: ${businessType}, NumId: ${receivingWaNumId})`);
        
        const creds = await getMetaCredentials(businessType, receivingWaNumId);
        
        // POST to Meta Cloud API to reject the call
        await axios.post(`https://graph.facebook.com/v20.0/${creds.phoneId}/calls`, {
            messaging_product: 'whatsapp',
            call_id: callId,
            action: 'reject'
        }, { headers: { Authorization: `Bearer ${creds.token}` }});
        // Log the rejected call
        const { leadPhone, isNewInquiry, businessId, passedByUserId, passReason } = req.body;
        const agentId = req.user ? (req.user.id || req.user.userId) : null;
        if (agentId && leadPhone && callId) {
            await prisma.whatsAppCallRecord.upsert({
                where: { callId: callId },
                update: {
                    agentId: parseInt(agentId),
                    status: 'REJECTED',
                    duration: 0,
                    isNewInquiry: isNewInquiry || false,
                    passedByUserId: passedByUserId ? parseInt(passedByUserId) : null,
                    passReason: passReason || null
                },
                create: {
                    callId: callId,
                    agentId: parseInt(agentId),
                    leadPhone,
                    direction: 'INBOUND',
                    status: 'REJECTED',
                    duration: 0,
                    isNewInquiry: isNewInquiry || false,
                    businessId: businessId ? parseInt(businessId) : null,
                    passedByUserId: passedByUserId ? parseInt(passedByUserId) : null,
                    passReason: passReason || null
                }
            });
        }

        const io = req.app.get('io');
        if (io) {
            io.emit('call_history_updated', { callId, status: 'REJECTED' });
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error rejecting call', error.response ? error.response.data : error.message);
        res.status(500).json({ error: error.message });
    }
};

// Terminates an active call
exports.terminateCall = async (req, res) => {
    try {
        const { callId, businessType, businessId, campaignType, leadPhone, duration, isNewInquiry, passedByUserId, passReason } = req.body;
        
        let storedDetails = callId ? callIdToWaNumId.get(callId) : null;
        let phoneId = req.body.receivingWaNumId || (typeof storedDetails === 'string' ? storedDetails : storedDetails?.phoneId || storedDetails?.receivingWaNumId);
        let token = typeof storedDetails === 'object' ? storedDetails?.token : null;
        let resolvedBizId = businessId || (typeof storedDetails === 'object' ? storedDetails?.businessId : null);

        if (!phoneId || !token) {
            const cleanPhone = leadPhone ? leadPhone.replace('+', '').trim() : '';
            if (!resolvedBizId && cleanPhone) {
                const lead = await prisma.lead.findFirst({
                    where: { phone: { startsWith: cleanPhone } },
                    include: { batch: true }
                });
                if (lead && lead.batch?.businessId) resolvedBizId = lead.batch.businessId;
            }
            const creds = await getMetaCredentials(businessType, phoneId, resolvedBizId, campaignType);
            phoneId = creds.phoneId;
            token = creds.token;
        }

        console.log(`[WhatsApp Call] Terminating Active Call ${callId} (PhoneId: ${phoneId}, BizId: ${resolvedBizId})`);

        if (callId && phoneId && token) {
            try {
                await axios.post(`https://graph.facebook.com/v20.0/${phoneId}/calls`, {
                    messaging_product: 'whatsapp',
                    call_id: callId,
                    action: 'terminate'
                }, { headers: { Authorization: `Bearer ${token}` }});
                console.log(`[WhatsApp Call] Successfully sent terminate to Meta Cloud API for call ${callId}`);
            } catch (err) {
                console.error("[WhatsApp Call] Meta API error terminating call:", err.response?.data || err.message);
            }
            callIdToWaNumId.delete(callId);
        }

        // Log the terminated call
        const agentId = req.user ? (req.user.id || req.user.userId) : null;
        if (callId) {
            let finalDuration = duration ? parseInt(duration) : 0;
            if (finalDuration > 0 && finalDuration < 60) {
                finalDuration = 60;
            }
            const cleanPhone = leadPhone ? leadPhone.replace('+', '').trim() : undefined;
            const parsedAgentId = agentId ? parseInt(agentId) : undefined;
            const parsedBizId = resolvedBizId ? parseInt(resolvedBizId) : undefined;

            await prisma.whatsAppCallRecord.upsert({
                where: { callId: callId },
                update: {
                    agentId: parsedAgentId,
                    status: parsedAgentId ? 'COMPLETED' : 'MISSED',
                    duration: finalDuration,
                    isNewInquiry: typeof isNewInquiry === 'boolean' ? isNewInquiry : undefined,
                    passedByUserId: passedByUserId ? parseInt(passedByUserId) : null,
                    passReason: passReason || null,
                    businessId: parsedBizId
                },
                create: {
                    callId: callId,
                    agentId: parsedAgentId || null,
                    leadPhone: cleanPhone || 'Unknown',
                    direction: 'OUTBOUND',
                    status: parsedAgentId ? 'COMPLETED' : 'MISSED',
                    duration: finalDuration,
                    isNewInquiry: typeof isNewInquiry === 'boolean' ? isNewInquiry : false,
                    businessId: parsedBizId || null,
                    passedByUserId: passedByUserId ? parseInt(passedByUserId) : null,
                    passReason: passReason || null
                }
            }).catch(e => console.error("Error upserting terminateCall record:", e.message));
        }

        const io = req.app.get('io');
        if (io) {
            io.emit('call_history_updated', { callId, status: parsedAgentId ? 'COMPLETED' : 'MISSED' });
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error terminating call', error.response ? error.response.data : error.message);
        res.status(500).json({ error: error.message });
    }
};

// Sends the dynamic call permission request template (call_request, call_request_01, request_call_permission)
exports.sendPermissionRequest = async (req, res) => {
    let matchedLead = null;
    let cleanPhone = '';
    let rawPhone = '';
    let formattedTo = '';
    try {
        let { to, businessType, businessId, campaignType } = req.body;
        rawPhone = String(to || '').trim();
        cleanPhone = rawPhone.split('_')[0].replace(/[^0-9]/g, '');
        formattedTo = cleanPhone.startsWith('0') ? '94' + cleanPhone.substring(1) : cleanPhone;

        let resolvedBusinessId = businessId ? parseInt(businessId) : null;
        let resolvedCampaignType = campaignType || null;
        let resolvedBusinessType = businessType || null;

        if (!resolvedBusinessId && rawPhone.includes('_BIZ_')) {
            try {
                const bId = parseInt(rawPhone.split('_BIZ_')[1]?.split('_')[0]);
                if (!isNaN(bId) && bId > 0) resolvedBusinessId = bId;
            } catch (e) {}
        }

        if (rawPhone) {
            matchedLead = await prisma.lead.findUnique({
                where: { phone: rawPhone },
                include: { batch: { include: { business: true } } }
            });

            if (!matchedLead && resolvedBusinessId) {
                matchedLead = await prisma.lead.findFirst({
                    where: {
                        phone: { startsWith: cleanPhone },
                        batch: { businessId: resolvedBusinessId }
                    },
                    include: { batch: { include: { business: true } } }
                });
            }

            if (!matchedLead) {
                matchedLead = await prisma.lead.findFirst({
                    where: {
                        OR: [
                            { phone: rawPhone },
                            { phone: { startsWith: cleanPhone } }
                        ]
                    },
                    include: { batch: { include: { business: true } } }
                });
            }

            if (matchedLead) {
                if (!resolvedBusinessId && matchedLead.batch?.businessId) resolvedBusinessId = matchedLead.batch.businessId;
                if (!resolvedCampaignType && matchedLead.campaignType) resolvedCampaignType = matchedLead.campaignType;
                if (!resolvedBusinessType && matchedLead.batch?.business?.name) resolvedBusinessType = matchedLead.batch.business.name;

                // If already allowed, no need to send again
                if (matchedLead.waCallPermissionStatus === 'ALLOWED') {
                    return res.status(200).json({
                        success: true,
                        alreadyAllowed: true,
                        status: 'ALLOWED',
                        message: 'Call permission is already approved by this student! You can place calls directly via WA.'
                    });
                }

                // If already pending within last 24h, no need to send again
                if (matchedLead.waCallPermissionStatus === 'PENDING' && matchedLead.waCallPermissionRequestedAt) {
                    const hoursSinceReq = (Date.now() - new Date(matchedLead.waCallPermissionRequestedAt).getTime()) / (1000 * 60 * 60);
                    if (hoursSinceReq < 24) {
                        return res.status(200).json({
                            success: true,
                            alreadySent: true,
                            status: 'PENDING',
                            message: 'Call permission request was already sent to this student. Waiting for student to accept on WhatsApp.'
                        });
                    }
                }
            }
        }

        const creds = await getMetaCredentials(resolvedBusinessType, null, resolvedBusinessId, resolvedCampaignType);
        
        // Dynamically find approved call template for this WhatsApp Business Account
        let templateName = 'call_request';
        let templateLang = 'en';

        if (creds.waId) {
            try {
                const resTemplates = await axios.get(`https://graph.facebook.com/v20.0/${creds.waId}/message_templates`, {
                    headers: { Authorization: `Bearer ${creds.token}` }
                });
                const callReqs = (resTemplates.data?.data || []).filter(t => 
                    (t.name.startsWith('call_request') || t.name === 'request_call_permission' || t.name.includes('call_perm')) && 
                    t.status === 'APPROVED'
                );
                if (callReqs.length > 0) {
                    callReqs.sort((a, b) => b.name.localeCompare(a.name));
                    templateName = callReqs[0].name;
                    templateLang = callReqs[0].language || 'en';
                }
            } catch (err) {
                console.warn("[WhatsApp Call] Could not fetch templates dynamically, falling back to call_request:", err.message);
            }
        }

        console.log(`[WhatsApp Call] Sending permission template '${templateName}' (${templateLang}) to ${formattedTo}`);

        await axios.post(`https://graph.facebook.com/v20.0/${creds.phoneId}/messages`, {
            messaging_product: 'whatsapp',
            to: formattedTo,
            type: 'template',
            template: {
                name: templateName,
                language: {
                    code: templateLang
                }
            }
        }, { headers: { Authorization: `Bearer ${creds.token}` }});

        // Update lead status in CRM for all matching leads
        if (cleanPhone) {
            await prisma.lead.updateMany({
                where: { phone: { contains: cleanPhone.slice(-9) } },
                data: {
                    waCallPermissionStatus: 'PENDING',
                    waCallPermissionRequestedAt: new Date()
                }
            }).catch(() => {});
        }

        res.status(200).json({ 
            success: true, 
            status: 'PENDING', 
            message: "Call permission request template successfully sent to student's WhatsApp! 📩", 
            template: templateName 
        });
    } catch (error) {
        if (error.response?.data?.error?.code === 138017) {
            if (cleanPhone) {
                await prisma.lead.updateMany({
                    where: { phone: { contains: cleanPhone.slice(-9) } },
                    data: {
                        waCallPermissionStatus: 'ALLOWED',
                        waCallPermissionExpiry: null
                    }
                }).catch(() => {});
            }
            return res.status(200).json({ 
                success: true, 
                alreadyAllowed: true,
                status: 'ALLOWED', 
                message: 'Call permission is already approved by student! You can place calls directly via WA.' 
            });
        }
        if (error.response?.data?.error?.code === 138009) {
            if (cleanPhone) {
                await prisma.lead.updateMany({
                    where: { phone: { contains: cleanPhone.slice(-9) } },
                    data: {
                        waCallPermissionStatus: 'PENDING'
                    }
                }).catch(() => {});
            }
            return res.status(200).json({ 
                success: true, 
                alreadySent: true, 
                status: 'PENDING', 
                message: 'A call permission request has already been sent to this student recently. Waiting for student to accept on WhatsApp.' 
            });
        }
        console.error('Error sending permission request', error.response ? error.response.data : error.message);
        const metaError = error.response?.data?.error?.error_user_msg || error.response?.data?.error?.message || "Failed to send permission request via Meta.";
        res.status(400).json({ success: false, error: metaError, message: metaError, details: error.response?.data });
    }
};

// Initiates a new outbound WebRTC Call
exports.initiateCall = async (req, res) => {
    try {
        let { to, sdp, businessType, receivingWaNumId, businessId, campaignType } = req.body;
        const rawPhone = String(to || '').trim();
        const cleanPhone = rawPhone.split('_')[0].replace(/[^0-9]/g, '');
        const formattedTo = cleanPhone.startsWith('0') ? '94' + cleanPhone.substring(1) : cleanPhone;

        let resolvedBusinessId = businessId ? parseInt(businessId) : null;
        let resolvedCampaignType = campaignType || null;
        let resolvedBusinessType = businessType || null;
        let matchedLead = null;

        if (!resolvedBusinessId && rawPhone.includes('_BIZ_')) {
            try {
                const bId = parseInt(rawPhone.split('_BIZ_')[1]?.split('_')[0]);
                if (!isNaN(bId) && bId > 0) resolvedBusinessId = bId;
            } catch (e) {}
        }

        if (rawPhone) {
            // 1. Try exact phone match
            matchedLead = await prisma.lead.findUnique({
                where: { phone: rawPhone },
                include: { batch: { include: { business: true } } }
            });

            // 2. Try match for cleanPhone + resolvedBusinessId
            if (!matchedLead && resolvedBusinessId) {
                matchedLead = await prisma.lead.findFirst({
                    where: {
                        phone: { startsWith: cleanPhone },
                        batch: { businessId: resolvedBusinessId }
                    },
                    include: { batch: { include: { business: true } } }
                });
            }

            // 3. Fallback match
            if (!matchedLead) {
                matchedLead = await prisma.lead.findFirst({
                    where: {
                        OR: [
                            { phone: rawPhone },
                            { phone: { startsWith: cleanPhone } }
                        ]
                    },
                    include: { batch: { include: { business: true } } }
                });
            }

            if (matchedLead) {
                if (matchedLead.isBlocked) {
                    return res.status(400).json({ error: "Cannot initiate call: This phone number is blocked in CRM." });
                }
                if (!resolvedBusinessId && matchedLead.batch?.businessId) {
                    resolvedBusinessId = matchedLead.batch.businessId;
                }
                if (!resolvedCampaignType && matchedLead.campaignType) {
                    resolvedCampaignType = matchedLead.campaignType;
                }
                if (!resolvedBusinessType && matchedLead.batch?.business?.name) {
                    resolvedBusinessType = matchedLead.batch.business.name;
                }
            }
            
            const phoneSuffix = cleanPhone.length >= 9 ? cleanPhone.slice(-9) : cleanPhone;
            const isBlockedRec = await prisma.blockedNumber.findFirst({
                where: {
                    OR: [
                        { phone: cleanPhone },
                        { phone: { contains: phoneSuffix } }
                    ]
                }
            });
            if (isBlockedRec) {
                return res.status(400).json({ error: "Cannot initiate call: This phone number is blocked." });
            }
        }

        const agentId = req.user ? (req.user.id || req.user.userId) : null;
        if (!resolvedBusinessId && agentId) {
            const agent = await prisma.user.findUnique({ where: { id: parseInt(agentId) } });
            if (agent && agent.businessType && agent.businessType !== 'ALL') {
                const b = await prisma.business.findFirst({ where: { name: agent.businessType } });
                if (b) {
                    resolvedBusinessId = b.id;
                    if (!resolvedBusinessType) resolvedBusinessType = b.name;
                }
            }
        }

        console.log(`[WhatsApp Call] Initiating Outbound Call to ${formattedTo} (Business: ${resolvedBusinessType || businessType}, ID: ${resolvedBusinessId}, Campaign: ${resolvedCampaignType || campaignType})`);
        
        const creds = await getMetaCredentials(resolvedBusinessType || businessType, receivingWaNumId, resolvedBusinessId, resolvedCampaignType || campaignType);
        
        const response = await axios.post(`https://graph.facebook.com/v20.0/${creds.phoneId}/calls`, {
            messaging_product: 'whatsapp',
            to: formattedTo,
            action: 'connect',
            session: {
                sdp_type: 'offer',
                sdp: sdp
            }
        }, { headers: { Authorization: `Bearer ${creds.token}` }});

        const callId = response.data.calls && response.data.calls[0] ? response.data.calls[0].id : null;
        
        if (callId) {
            callIdToWaNumId.set(callId, { phoneId: creds.phoneId, token: creds.token, businessId: resolvedBusinessId, receivingWaNumId: creds.phoneId });
            try {
                let isNewInquiry = !matchedLead;

                await prisma.whatsAppCallRecord.upsert({
                    where: { callId },
                    update: {
                        direction: 'OUTBOUND',
                        status: 'INITIATED',
                        agentId: agentId ? parseInt(agentId) : null,
                        businessId: resolvedBusinessId,
                        campaignType: resolvedCampaignType,
                        isNewInquiry: isNewInquiry
                    },
                    create: {
                        callId,
                        leadPhone: cleanPhone || formattedTo,
                        direction: 'OUTBOUND',
                        status: 'INITIATED',
                        duration: 0,
                        agentId: agentId ? parseInt(agentId) : null,
                        businessId: resolvedBusinessId,
                        campaignType: resolvedCampaignType,
                        isNewInquiry: isNewInquiry
                    }
                });
                console.log(`[WhatsApp Outbound Call Logged] Record created/updated for callId: ${callId}, agent: ${agentId}, lead: ${cleanPhone}, biz: ${resolvedBusinessId}`);
            } catch (recordError) {
                console.error("Error creating/updating initial outbound call record:", recordError.message);
            }
        }

        res.status(200).json({ success: true, callId: callId });
    } catch (error) {
        console.error('Error initiating outbound call', error.response ? error.response.data : error.message);
        const metaError = error.response?.data?.error?.error_user_msg || error.response?.data?.error?.message || "Failed to initiate call via Meta.";
        const isPermError = error.response?.data?.error?.code === 138006 || String(metaError).toLowerCase().includes("permission");
        const friendlyMsg = isPermError 
            ? "WhatsApp Call Permission required from student. Please click 'Req Perm' first." 
            : metaError;
        res.status(400).json({ error: friendlyMsg, message: friendlyMsg, code: error.response?.data?.error?.code, details: error.response?.data });
    }
};

const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');

const processAiAnalysisInBackground = async (filePath, filename, callId, leadPhone, duration, agentId, prompt, reqDirection) => {
    try {
        
        console.log(`[WhatsApp Call Background] Starting AI analysis for ${filename}`);
        const base64Data = fs.readFileSync(filePath, { encoding: 'base64' });

        let rawText = "";

        // 1. Try Gemini API Keys from DB / env first
        let apiKeys = [];
        try {
            const setting1 = await prisma.appSetting.findUnique({ where: { key: 'GEMINI_API_KEY' } });
            const setting2 = await prisma.appSetting.findUnique({ where: { key: 'GEMINI_API_KEY_2' } });
            if (setting1 && setting1.value) apiKeys.push(setting1.value);
            if (setting2 && setting2.value) apiKeys.push(setting2.value);
        } catch (dbErr) {
            console.error("[WhatsApp Call Background] Error fetching Gemini keys from AppSetting:", dbErr.message);
        }

        if (process.env.GEMINI_API_KEY && !apiKeys.includes(process.env.GEMINI_API_KEY)) {
            apiKeys.push(process.env.GEMINI_API_KEY);
        }

        if (apiKeys.length > 0) {
            const { GoogleGenAI } = require('@google/genai');
            for (const key of apiKeys) {
                try {
                    const ai = new GoogleGenAI({ apiKey: key });
                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: [
                            {
                                role: 'user',
                                parts: [
                                    { inlineData: { mimeType: 'audio/webm', data: base64Data } },
                                    { text: prompt }
                                ]
                            }
                        ]
                    });
                    if (response && response.text) {
                        rawText = response.text;
                        console.log(`[WhatsApp Call Background] Successfully analyzed call using Gemini API Key.`);
                        break;
                    }
                } catch (apiKeyErr) {
                    console.error("[WhatsApp Call Background] Gemini API Key attempt failed:", apiKeyErr.message);
                }
            }
        }

        // 2. If API Key didn't succeed, fallback to service account if available
        if (!rawText) {
            const saPath = require('path').join(__dirname, '..', 'gemini-service-account.json');
            if (fs.existsSync(saPath)) {
                try {
                    const { GoogleAuth } = require('google-auth-library');
                    const axios = require('axios');
                    const auth = new GoogleAuth({
                        keyFile: saPath,
                        scopes: ['https://www.googleapis.com/auth/generative-language']
                    });
                    const client = await auth.getClient();
                    const tokenInfo = await client.getAccessToken();
                    const token = tokenInfo.token;

                    const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
                    const resData = await axios.post(apiUrl, {
                        contents: [
                            { 
                                role: "user", 
                                parts: [ 
                                    { inlineData: { mimeType: "audio/webm", data: base64Data } },
                                    { text: prompt } 
                                ] 
                            }
                        ]
                    }, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    rawText = resData.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
                } catch (saErr) {
                    console.error("[WhatsApp Call Background] Service account fallback also failed:", saErr.message);
                }
            }
        }

        if (!rawText) {
            console.error("[WhatsApp Call Background] Failed to generate AI analysis: No working Gemini API key or credentials.");
            return;
        }

        const jsonText = rawText.replace(/```json\n?|\n?```/g, '').trim();
        let aiData = {};
        try {
            aiData = JSON.parse(jsonText);
        } catch (e) {
            console.error("Failed to parse AI JSON:", jsonText);
        }

        const updateData = {
            aiTone: String(aiData.tone || "Unknown"),
            aiMood: String(aiData.mood || "Unknown"),
            aiSummary: String(aiData.summary || "No summary generated"),
            aiSummarySinhala: String(aiData.summarySinhala || "Sinhala summary not available"),
            aiNotes: Array.isArray(aiData.notes) ? aiData.notes.join('\n') : String(aiData.notes || "No notes generated"),
            aiVibe: String(aiData.vibe || "Unknown"),
            aiIsGoodCall: typeof aiData.isGoodCall === 'boolean' ? aiData.isGoodCall : null,
            aiStudentQuestions: Array.isArray(aiData.studentQuestions) ? aiData.studentQuestions.join('\n') : String(aiData.studentQuestions || "None"),
            aiFullAnalysis: aiData.fullAnalysis || "No analysis available",
            transcription: aiData.transcription || "Transcription not available"
        };

        if (callId) {
            await prisma.whatsAppCallRecord.updateMany({
                where: { callId: callId },
                data: updateData
            });
            console.log(`[WhatsApp Call Background] AI analysis saved for CallID: ${callId}`);
        } else {
            console.log(`[WhatsApp Call Background] No callId provided, skipping DB update for AI analysis`);
        }
    } catch (error) {
        console.error('Error in background AI analysis:', error);
    }
};

exports.uploadRecording = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: "No audio file uploaded" });
        }

        const { leadPhone, duration, callId } = req.body;
        const agentId = req.user ? (req.user.id || req.user.userId) : 1;

        console.log(`[WhatsApp Call Test] Processing recording for lead: ${leadPhone}, CallID received: "${callId}" (typeof: ${typeof callId})`);
        
        const reqDirection = req.body.direction ? String(req.body.direction).toUpperCase() : null;
        
        let finalDuration = duration ? parseInt(duration) : 0;
        if (finalDuration > 0 && finalDuration < 60) {
            finalDuration = 60;
        }

        let record;
        const initialUpdateData = {
            recordingUrl: req.file.filename,
        };
        if (reqDirection) {
            initialUpdateData.direction = reqDirection;
        }
        if (finalDuration) {
            initialUpdateData.duration = finalDuration;
        }
        
        let resolvedCampaignType = null;
        let resolvedBusinessId = null;
        if (leadPhone) {
            let phone = leadPhone.replace('+', '').trim();
            let lead = await prisma.lead.findFirst({ where: { phone: { startsWith: phone } }, include: { batch: true } });
            if (!lead && phone.startsWith('94')) lead = await prisma.lead.findFirst({ where: { phone: { startsWith: '0' + phone.substring(2) } }, include: { batch: true } });
            if (!lead && phone.startsWith('0')) lead = await prisma.lead.findFirst({ where: { phone: { startsWith: '94' + phone.substring(1) } }, include: { batch: true } });
            if (lead) {
                if (lead.campaignType) resolvedCampaignType = lead.campaignType;
                if (lead.batch?.businessId) resolvedBusinessId = lead.batch.businessId;
            }
        }

        if (callId) {
            if (resolvedCampaignType) {
                initialUpdateData.campaignType = resolvedCampaignType;
            }
            if (resolvedBusinessId) {
                initialUpdateData.businessId = resolvedBusinessId;
            }
            
            const createData = { 
                callId: callId,
                recordingUrl: req.file.filename,
                duration: finalDuration,
                direction: reqDirection || "OUTBOUND",
                leadPhone: leadPhone ? leadPhone.replace('+', '').trim() : "Unknown",
                agentId: parseInt(agentId) || 1,
                status: "COMPLETED"
            };
            if (resolvedCampaignType) {
                createData.campaignType = resolvedCampaignType;
            }
            if (resolvedBusinessId) {
                createData.businessId = resolvedBusinessId;
            }

            record = await prisma.whatsAppCallRecord.upsert({
                where: { callId: callId },
                update: initialUpdateData,
                create: createData
            });
        }
        
        res.status(200).json({ success: true, record, message: "Recording uploaded, AI analysis running in background" });
        const prompt = `You are a Customer Service QA Analyst. Listen to this call recording. The audio is in Sinhala or a mix of Sinhala and English (Singlish).
Do NOT attempt to write a word-for-word transcript, as it leads to inaccuracies. Instead, deeply understand the conversation and provide a highly accurate analysis. 
IMPORTANT: All text fields (tone, mood, vibe, notes, fullAnalysis) MUST be written in BOTH Sinhala and English, separated by a slash (/) or in a bilingual format (e.g. "English Text / සිංහල අදහස").
Provide the summary specifically in two separate fields: one for English and one for Sinhala.

Output a JSON object with the following fields:
{
  "tone": "Brief description of the conversation tone in both English and Sinhala (e.g., Professional / වෘත්තීය, Friendly / මිත්‍රශීලී)",
  "mood": "Brief description of the customer's mood in both English and Sinhala (e.g., Happy / සතුටුයි, Confused / පැටලිලි සහගතයි)",
  "vibe": "The overall vibe of the call in both English and Sinhala (e.g., Positive / ධනාත්මක, Relaxed / සැහැල්ලු)",
  "isGoodCall": boolean (true if it was a successful, polite, or productive call, false otherwise),
  "studentQuestions": "List of questions the student asked in both languages. If none, state 'None / ප්‍රශ්න නැත'",
  "fullAnalysis": "A comprehensive analysis of the call, including how the agent handled it and the overall outcome, in both languages.",
  "summary": "A concise 2-3 sentence summary of the call in strictly English",
  "summarySinhala": "A concise 2-3 sentence summary of the call in strictly Sinhala",
  "notes": "Bullet points of key topics discussed, agreements made, or next steps in both languages"
}
Ensure the output is strictly valid JSON without any markdown formatting block.`;

        processAiAnalysisInBackground(req.file.path, req.file.filename, callId, leadPhone, duration, agentId, prompt, reqDirection);

    } catch (error) {
        console.error('Error in uploadRecording', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getRecording = (req, res) => {
    const filename = req.params.filename;
    // Sanitize filename to prevent directory traversal
    const safeFilename = filename.replace(/[^a-zA-Z0-9_-]/g, '');
    const filePath = require('path').join(__dirname, '..', '..', 'storage', 'recordings', safeFilename);
    
    if (require('fs').existsSync(filePath)) {
        res.setHeader('Content-Type', 'audio/webm');
        res.sendFile(filePath);
    } else {
        res.status(404).json({ success: false, error: 'Recording not found' });
    }
};

// Get Call Logs for Data Center & CRM
exports.getCallLogs = async (req, res) => {
    try {
        const { date, startDate, endDate, businessId, batchId, campaignType, agentId, direction, isNewInquiry, callTab } = req.query;
        let where = {};
        
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                const sDate = new Date(startDate);
                sDate.setHours(0, 0, 0, 0);
                where.createdAt.gte = sDate;
            }
            if (endDate) {
                const eDate = new Date(endDate);
                eDate.setHours(23, 59, 59, 999);
                where.createdAt.lte = eDate;
            }
        } else if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            where.createdAt = { gte: startOfDay, lte: endOfDay };
        }
        if (businessId) {
            where.businessId = parseInt(businessId);
        }
        if (campaignType) {
            where.campaignType = campaignType;
        }

        if (callTab === 'INBOUND') {
            where.direction = 'INBOUND';
            where.isNewInquiry = false;
        } else if (callTab === 'OUTBOUND') {
            where.direction = 'OUTBOUND';
        } else if (callTab === 'MISSED') {
            where.status = { in: ['MISSED', 'REJECTED', 'NO_ANSWER'] };
        } else if (callTab === 'NEW_INQUIRY') {
            where.isNewInquiry = true;
            where.direction = 'INBOUND';
        } else {
            if (direction) {
                where.direction = String(direction).toUpperCase();
            }
            if (isNewInquiry !== undefined && isNewInquiry !== '') {
                where.isNewInquiry = isNewInquiry === 'true' || isNewInquiry === true;
            }
        }
        
        // Role-based access control
        const userId = parseInt(req.user.id || req.user.userId);
        const role = String(req.user.role || '').toUpperCase().replace(/[\s_-]+/g, '_');
        const isSuperAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER_ADMIN', 'SUPERADMIN', 'ADMIN'].includes(role);
        const isManager = ['MANAGER', 'ASS_MANAGER', 'SUPER'].includes(role);
        
        if (!isSuperAdmin && !isManager) {
            // Coordinator: see calls they handled OR calls with their assigned students OR inbound/missed calls for their business context!
            const myLeads = await prisma.lead.findMany({
                where: { assignedTo: userId },
                select: { phone: true }
            });
            const myPhones = new Set();
            myLeads.forEach(l => {
                const raw = l.phone ? l.phone.split('_BIZ')[0].split('_')[0].replace(/[^0-9]/g, '') : '';
                if (raw) {
                    myPhones.add(raw);
                    if (raw.startsWith('0')) myPhones.add('94' + raw.substring(1));
                    if (raw.startsWith('94')) myPhones.add('0' + raw.substring(2));
                }
            });

            const coordinatorConditions = [
                { agentId: userId }
            ];
            if (myPhones.size > 0) {
                coordinatorConditions.push({ leadPhone: { in: Array.from(myPhones) } });
            }
            if (businessId && businessId !== 'ALL' && businessId !== '') {
                coordinatorConditions.push({ businessId: parseInt(businessId), direction: 'INBOUND' });
            } else if (req.user.businessType && req.user.businessType !== 'ALL') {
                const userBiz = await prisma.business.findFirst({
                    where: { name: { equals: String(req.user.businessType).trim() } }
                });
                if (userBiz) {
                    coordinatorConditions.push({ businessId: userBiz.id, direction: 'INBOUND' });
                }
            } else {
                // Also include inbound calls where coordinator was unassigned or in pool
                coordinatorConditions.push({ direction: 'INBOUND' });
            }

            where.OR = coordinatorConditions;
        } else if (isManager) {
            // Manager: only see calls within their managed businesses
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

            if (businessId && businessId !== 'ALL' && businessId !== '') {
                const targetBizId = parseInt(businessId);
                if (managedBizIds.length === 0 || managedBizIds.includes(targetBizId)) {
                    where.businessId = targetBizId;
                } else {
                    return res.status(200).json({ logs: [], counts: { inbound: 0, outbound: 0, missed: 0, newInquiries: 0 } });
                }
            } else if (managedBizIds.length > 0) {
                where.businessId = { in: managedBizIds };
            }

            if (agentId && agentId !== 'ALL' && agentId !== '') {
                where.agentId = parseInt(agentId);
            }
        } else if (agentId && agentId !== 'ALL' && agentId !== '') {
            where.agentId = parseInt(agentId);
        }

        // If batchId is specified, restrict by batch leads' phone numbers
        let batchLeadMap = null;
        if (batchId && batchId !== '' && batchId !== 'all') {
            const parsedBatchId = parseInt(batchId);
            const batchLeads = await prisma.lead.findMany({
                where: {
                    OR: [
                        { batchId: parsedBatchId },
                        { phone: { endsWith: `_BATCH_${parsedBatchId}` } },
                        { phone: { contains: `_BATCH_${parsedBatchId}_` } }
                    ]
                },
                include: {
                    batch: { select: { id: true, name: true } },
                    assignedUser: { select: { firstName: true, lastName: true } }
                }
            });

            if (!batchLeads || batchLeads.length === 0) {
                // Allow new inquiries to show up even if the batch has no leads
                where.AND = [ { isNewInquiry: true } ];
                batchLeadMap = {};
            } else {
                const exactPhones = new Set();
                batchLeadMap = {};
                batchLeads.forEach(l => {
                    const raw = l.phone.split('_BIZ')[0].split('_')[0].replace(/[^0-9]/g, '');
                    if (raw) {
                        exactPhones.add(raw);
                        if (raw.startsWith('0')) exactPhones.add('94' + raw.substring(1));
                        if (raw.startsWith('94')) exactPhones.add('0' + raw.substring(2));
                        if (raw.length >= 7) {
                            batchLeadMap[raw.slice(-7)] = l;
                        }
                    }
                });

                where.AND = [
                    {
                        OR: [
                            { leadPhone: { in: Array.from(exactPhones) } },
                            { isNewInquiry: true }
                        ]
                    }
                ];
            }
        }
        
        const logs = await prisma.whatsAppCallRecord.findMany({
            where,
            include: {
                agent: { select: { firstName: true, lastName: true } },
                business: { select: { name: true, logo: true } },
                passedByUser: { select: { firstName: true, lastName: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 200
        });

        // Enrich call logs with matching Lead and Batch details
        let leadBySuffix = batchLeadMap || {};
        if (!batchLeadMap && logs.length > 0) {
            const phones = logs.map(c => c.leadPhone).filter(Boolean);
            const suffixes = Array.from(new Set(phones.map(p => p.replace(/[^0-9]/g, '').slice(-7)).filter(s => s.length >= 7)));
            
            if (suffixes.length > 0) {
                const orConditions = suffixes.map(s => ({ phone: { contains: s } }));
                const matchedLeads = await prisma.lead.findMany({
                    where: {
                        OR: orConditions
                    },
                    include: {
                        batch: { select: { id: true, name: true } },
                        assignedUser: { select: { firstName: true, lastName: true } }
                    }
                });

                matchedLeads.forEach(l => {
                    const raw = l.phone.split('_BIZ')[0].split('_')[0].replace(/[^0-9]/g, '');
                    if (raw.length >= 7) {
                        const s = raw.slice(-7);
                        if (!leadBySuffix[s] || (businessId && l.batch?.businessId === parseInt(businessId))) {
                            leadBySuffix[s] = l;
                        }
                    }
                });
            }
        }

        const enrichedLogs = logs.map(c => {
            const s = c.leadPhone ? c.leadPhone.replace(/[^0-9]/g, '').slice(-7) : '';
            const l = s ? leadBySuffix[s] : null;
            return {
                ...c,
                leadName: l?.name || null,
                batchName: l?.batch?.name || null,
                batchId: l?.batchId || null,
                lead: l ? {
                    id: l.id,
                    name: l.name,
                    phone: l.phone ? l.phone.split('_BIZ')[0] : '',
                    rawPhone: l.phone,
                    batchId: l.batchId,
                    batchName: l.batch?.name || null,
                    assignedTo: l.assignedTo,
                    assignedUser: l.assignedUser || null,
                    status: l.status,
                    unreadCount: l.unreadCount || 0
                } : null
            };
        });
        
        const baseWhere = { ...where };
        delete baseWhere.direction;
        delete baseWhere.isNewInquiry;
        delete baseWhere.status;

        const [inboundCount, outboundCount, missedCount, newInqCount] = await Promise.all([
            prisma.whatsAppCallRecord.count({
                where: { ...baseWhere, direction: 'INBOUND', isNewInquiry: false }
            }),
            prisma.whatsAppCallRecord.count({
                where: { ...baseWhere, direction: 'OUTBOUND' }
            }),
            prisma.whatsAppCallRecord.count({
                where: { ...baseWhere, status: { in: ['MISSED', 'REJECTED', 'NO_ANSWER'] } }
            }),
            prisma.whatsAppCallRecord.count({
                where: { ...baseWhere, isNewInquiry: true, direction: 'INBOUND' }
            })
        ]);

        res.status(200).json({
            logs: enrichedLogs,
            counts: {
                INBOUND: inboundCount,
                OUTBOUND: outboundCount,
                MISSED: missedCount,
                NEW_INQUIRY: newInqCount
            }
        });
    } catch (error) {
        console.error("Error fetching call logs", error);
        res.status(500).json({ error: error.message });
    }
};

exports.manualGrantPermission = async (req, res) => {
    try {
        const { leadId, phone, allowType } = req.body; // allowType: 'ALWAYS' or 'TEMP'
        let leadIdToUpdate = leadId;
        if (!leadIdToUpdate && phone) {
            const cleanPhone = phone.replace('+', '').trim();
            const lead = await prisma.lead.findFirst({ where: { phone: { contains: cleanPhone } } });
            if (lead) leadIdToUpdate = lead.id;
        }

        if (leadIdToUpdate) {
            let expiryDate = null;
            if (allowType === 'TEMP') {
                expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + 7);
            }

            const updated = await prisma.lead.update({
                where: { id: parseInt(leadIdToUpdate) },
                data: {
                    waCallPermissionStatus: 'ALLOWED',
                    waCallPermissionExpiry: expiryDate,
                    waCallPermissionNotified: false
                }
            });

            // Also update all duplicate leads with the same base phone
            const basePhone = updated.phone.split('_')[0];
            await prisma.lead.updateMany({
                where: {
                    OR: [
                        { phone: basePhone },
                        { phone: { startsWith: `${basePhone}_` } }
                    ],
                    id: { not: updated.id }
                },
                data: {
                    waCallPermissionStatus: 'ALLOWED',
                    waCallPermissionExpiry: expiryDate,
                    waCallPermissionNotified: true
                }
            });

            try {
                const { getIo } = require('./chatController');
                const io = getIo();
                if (io) {
                    io.emit('wa_call_permission_granted', {
                        leadId: updated.id,
                        phone: updated.phone,
                        name: updated.name,
                        status: 'ALLOWED',
                        expiry: expiryDate
                    });
                }
            } catch (err) { console.error("Socket emit failed in manualGrantPermission:", err); }

            console.log(`[Call Permission] Manually granted for lead: ${updated.id} (${updated.phone}), type: ${allowType || 'ALWAYS'}`);
            return res.status(200).json({ success: true, lead: updated });
        }
        res.status(404).json({ error: "Lead not found" });
    } catch (e) {
        console.error("Error in manualGrantPermission:", e);
        res.status(500).json({ error: e.message });
    }
};

exports.getCallReport = async (req, res) => {
    try {
        const { startDate, endDate, startTime, endTime, businessId, batchId, agentId, status, direction } = req.query;
        
        let where = {};
        
        // Date range filtering
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                const parts = String(startDate).trim().includes('-') ? startDate.trim().split('-') : startDate.trim().split('/');
                let sDate;
                if (parts.length === 3 && parts[0].length === 4) {
                    sDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
                } else if (parts.length === 3) {
                    sDate = new Date(Number(parts[2]), Number(parts[0]) - 1, Number(parts[1]), 0, 0, 0, 0);
                } else {
                    sDate = new Date(startDate);
                }
                if (startTime) {
                    const [sh, sm] = startTime.split(':').map(Number);
                    sDate.setHours(sh || 0, sm || 0, 0, 0);
                } else {
                    sDate.setHours(0, 0, 0, 0);
                }
                if (!isNaN(sDate.getTime())) {
                    where.createdAt.gte = sDate;
                }
            }
            if (endDate) {
                const parts = String(endDate).trim().includes('-') ? endDate.trim().split('-') : endDate.trim().split('/');
                let eDate;
                if (parts.length === 3 && parts[0].length === 4) {
                    eDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 23, 59, 59, 999);
                } else if (parts.length === 3) {
                    eDate = new Date(Number(parts[2]), Number(parts[0]) - 1, Number(parts[1]), 23, 59, 59, 999);
                } else {
                    eDate = new Date(endDate);
                }
                if (endTime) {
                    const [eh, em] = endTime.split(':').map(Number);
                    eDate.setHours(eh || 23, em || 59, 59, 999);
                } else {
                    eDate.setHours(23, 59, 59, 999);
                }
                if (!isNaN(eDate.getTime())) {
                    where.createdAt.lte = eDate;
                }
            }
        }

        // Role-based access control
        const userId = parseInt(req.user.id || req.user.userId);
        const role = String(req.user.role || '').toUpperCase().replace(/[\s_-]+/g, '_');
        const isSuperAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER_ADMIN', 'SUPERADMIN', 'ADMIN'].includes(role);
        const isManager = ['MANAGER', 'ASS_MANAGER', 'SUPER'].includes(role);

        if (!isSuperAdmin && !isManager) {
            // Coordinator: only see their calls or calls from their assigned leads
            const myLeads = await prisma.lead.findMany({
                where: { assignedTo: userId },
                select: { phone: true }
            });
            const myPhones = new Set();
            myLeads.forEach(l => {
                const raw = l.phone ? l.phone.split('_BIZ')[0].split('_')[0].replace(/[^0-9]/g, '') : '';
                if (raw) {
                    myPhones.add(raw);
                    if (raw.startsWith('0')) myPhones.add('94' + raw.substring(1));
                    if (raw.startsWith('94')) myPhones.add('0' + raw.substring(2));
                }
            });

            if (myPhones.size > 0) {
                where.OR = [
                    { agentId: userId },
                    { leadPhone: { in: Array.from(myPhones) } }
                ];
            } else {
                where.agentId = userId;
            }
        } else if (isManager) {
            // Manager: restrict to managed businesses
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

            if (businessId && businessId !== 'ALL' && businessId !== '') {
                const targetBizId = parseInt(businessId);
                if (managedBizIds.length === 0 || managedBizIds.includes(targetBizId)) {
                    where.businessId = targetBizId;
                } else {
                    return res.status(200).json({
                        summary: { totalCalls: 0, inboundTotal: 0, outboundTotal: 0, completedCalls: 0, missedCalls: 0, rejectedCalls: 0, missedRate: 0, totalDuration: 0, avgDuration: 0 },
                        logs: [],
                        hourlyBreakdown: [],
                        agentBreakdown: [],
                        batchBreakdown: []
                    });
                }
            } else if (managedBizIds.length > 0) {
                where.businessId = { in: managedBizIds };
            }

            if (agentId && agentId !== 'ALL' && agentId !== '') {
                where.agentId = parseInt(agentId);
            }
        } else {
            if (businessId && businessId !== 'ALL' && businessId !== '') {
                where.businessId = parseInt(businessId);
            }
            if (agentId && agentId !== 'ALL' && agentId !== '') {
                where.agentId = parseInt(agentId);
            }
        }

        if (direction && direction !== 'ALL' && direction !== '') {
            where.direction = String(direction).toUpperCase();
        }

        if (status && status !== 'ALL' && status !== '') {
            if (status === 'MISSED') {
                where.status = { in: ['MISSED', 'NO_ANSWER', 'REJECTED'] };
            } else {
                where.status = String(status).toUpperCase();
            }
        }

        // If batchId is specified, restrict by batch leads' phone numbers
        let batchLeadMap = null;
        if (batchId && batchId !== '' && batchId !== 'all' && batchId !== 'ALL') {
            const parsedBatchId = parseInt(batchId);
            const batchLeads = await prisma.lead.findMany({
                where: {
                    OR: [
                        { batchId: parsedBatchId },
                        { phone: { endsWith: `_BATCH_${parsedBatchId}` } },
                        { phone: { contains: `_BATCH_${parsedBatchId}_` } }
                    ]
                },
                include: {
                    batch: { select: { id: true, name: true } },
                    assignedUser: { select: { firstName: true, lastName: true } }
                }
            });

            if (!batchLeads || batchLeads.length === 0) {
                return res.status(200).json({
                    summary: { totalCalls: 0, inboundTotal: 0, outboundTotal: 0, completedCalls: 0, missedCalls: 0, rejectedCalls: 0, missedRate: 0, totalDuration: 0, avgDuration: 0 },
                    logs: [],
                    hourlyBreakdown: [],
                    agentBreakdown: [],
                    batchBreakdown: []
                });
            }

            const exactPhones = new Set();
            batchLeadMap = {};
            batchLeads.forEach(l => {
                const raw = l.phone.split('_BIZ')[0].split('_')[0].replace(/[^0-9]/g, '');
                if (raw) {
                    exactPhones.add(raw);
                    if (raw.startsWith('0')) exactPhones.add('94' + raw.substring(1));
                    if (raw.startsWith('94')) exactPhones.add('0' + raw.substring(2));
                    if (raw.length >= 7) {
                        batchLeadMap[raw.slice(-7)] = l;
                    }
                }
            });

            where.leadPhone = { in: Array.from(exactPhones) };
        }

        // Fetch logs (up to 2000 for reports)
        console.log("=== GET CALL REPORT ===", { startDate, endDate, where });
        const logs = await prisma.whatsAppCallRecord.findMany({
            where,
            include: {
                agent: { select: { id: true, firstName: true, lastName: true, role: true } },
                business: { select: { id: true, name: true, logo: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 2000
        });
        console.log("=== PRISMA RETURNED LOGS COUNT ===", logs.length);

        // Optional time-of-day filter if user specified time range across multi-day span
        let filteredLogs = logs;
        if (startTime && endTime) {
            const [sh, sm] = startTime.split(':').map(Number);
            const [eh, em] = endTime.split(':').map(Number);
            const startMinutes = (sh || 0) * 60 + (sm || 0);
            const endMinutes = (eh || 23) * 60 + (em || 59);

            filteredLogs = logs.filter(c => {
                const callDate = new Date(c.createdAt);
                const callMinutes = callDate.getHours() * 60 + callDate.getMinutes();
                return callMinutes >= startMinutes && callMinutes <= endMinutes;
            });
        }

        // Match with leads
        let leadBySuffix = batchLeadMap || {};
        if (!batchLeadMap && filteredLogs.length > 0) {
            const phones = filteredLogs.map(c => c.leadPhone).filter(Boolean);
            const suffixes = Array.from(new Set(phones.map(p => p.replace(/[^0-9]/g, '').slice(-7)).filter(s => s.length >= 7)));
            if (suffixes.length > 0) {
                const matchedLeads = await prisma.lead.findMany({
                    where: {
                        OR: suffixes.map(s => ({ phone: { contains: s } }))
                    },
                    include: {
                        batch: { select: { id: true, name: true } },
                        assignedUser: { select: { id: true, firstName: true, lastName: true } }
                    }
                });

                matchedLeads.forEach(l => {
                    const raw = l.phone.split('_BIZ')[0].split('_')[0].replace(/[^0-9]/g, '');
                    if (raw.length >= 7) {
                        const s = raw.slice(-7);
                        if (!leadBySuffix[s] || (businessId && l.batch?.businessId === parseInt(businessId))) {
                            leadBySuffix[s] = l;
                        }
                    }
                });
            }
        }

        let totalDuration = 0;
        let completedCount = 0;
        let missedCount = 0;
        let rejectedCount = 0;
        let inboundCount = 0;
        let outboundCount = 0;

        const hourlyMap = Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            label: `${i.toString().padStart(2, '0')}:00`,
            total: 0,
            missed: 0,
            completed: 0
        }));

        const agentMap = {};
        const batchMap = {};

        const enrichedLogs = filteredLogs.map(c => {
            const s = c.leadPhone ? c.leadPhone.replace(/[^0-9]/g, '').slice(-7) : '';
            const l = s ? leadBySuffix[s] : null;

            const isCompleted = c.status === 'COMPLETED';
            const isMissed = c.status === 'MISSED' || c.status === 'NO_ANSWER';
            const isRejected = c.status === 'REJECTED';

            if (c.direction === 'INBOUND') inboundCount++;
            if (c.direction === 'OUTBOUND') outboundCount++;

            if (isCompleted) {
                completedCount++;
                totalDuration += (c.duration || 0);
            }
            if (isMissed) missedCount++;
            if (isRejected) rejectedCount++;

            // Hourly breakdown
            const hour = new Date(c.createdAt).getHours();
            if (hourlyMap[hour]) {
                hourlyMap[hour].total++;
                if (isMissed || isRejected) hourlyMap[hour].missed++;
                if (isCompleted) hourlyMap[hour].completed++;
            }

            // Agent breakdown
            const agentKey = c.agentId ? String(c.agentId) : 'unassigned';
            const agentName = c.agent ? `${c.agent.firstName || ''} ${c.agent.lastName || ''}`.trim() : 'System / Unassigned';
            if (!agentMap[agentKey]) {
                agentMap[agentKey] = { agentId: c.agentId, name: agentName, total: 0, missed: 0, completed: 0, duration: 0 };
            }
            agentMap[agentKey].total++;
            if (isMissed || isRejected) agentMap[agentKey].missed++;
            if (isCompleted) {
                agentMap[agentKey].completed++;
                agentMap[agentKey].duration += (c.duration || 0);
            }

            // Batch breakdown
            const batchName = l?.batch?.name || 'No Batch';
            const batchKey = l?.batchId ? String(l.batchId) : 'none';
            if (!batchMap[batchKey]) {
                batchMap[batchKey] = { batchId: l?.batchId || null, name: batchName, total: 0, missed: 0, completed: 0 };
            }
            batchMap[batchKey].total++;
            if (isMissed || isRejected) batchMap[batchKey].missed++;
            if (isCompleted) batchMap[batchKey].completed++;

            return {
                ...c,
                leadName: l?.name || null,
                batchName: l?.batch?.name || null,
                batchId: l?.batchId || null,
                lead: l ? {
                    id: l.id,
                    name: l.name,
                    phone: l.phone ? l.phone.split('_BIZ')[0] : '',
                    rawPhone: l.phone,
                    batchId: l.batchId,
                    batchName: l.batch?.name || null,
                    assignedTo: l.assignedTo,
                    assignedUser: l.assignedUser || null,
                    status: l.status
                } : null
            };
        });

        const totalCalls = filteredLogs.length;
        const totalMissedAndRejected = missedCount + rejectedCount;
        const missedRate = totalCalls > 0 ? ((totalMissedAndRejected / totalCalls) * 100).toFixed(1) : 0;
        const avgDuration = completedCount > 0 ? Math.round(totalDuration / completedCount) : 0;

        console.log("=== SENDING RESPONSE WITH LOGS ===", enrichedLogs.length);
        res.status(200).json({
            summary: {
                totalCalls: inboundCount + outboundCount,
                inboundTotal: inboundCount,
                outboundTotal: outboundCount,
                completedCalls: completedCount,
                missedCalls: missedCount,
                rejectedCalls: rejectedCount,
                missedRate: Number(missedRate),
                totalDuration,
                avgDuration
            },
            logs: enrichedLogs,
            hourlyBreakdown: hourlyMap,
            agentBreakdown: Object.values(agentMap),
            batchBreakdown: Object.values(batchMap)
        });
    } catch (error) {
        console.error("Error generating call report:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.getBatches = async (req, res) => {
    try {
        const userDepartment = req.user.department ? req.user.department.toUpperCase() : '';
        const role = String(req.user.role || '').toUpperCase().replace(/[\s_-]+/g, '_');
        const isSuperAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER_ADMIN', 'SUPERADMIN', 'ADMIN', 'FINANCE'].includes(role) || 
                             userDepartment === 'FINANCE' || 
                             userDepartment === 'CALL_CENTER' || 
                             userDepartment === 'DELIVERY';
        const isManager = ['MANAGER', 'ASS_MANAGER', 'SUPER'].includes(role);

        let where = {};
        if (isManager) {
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
            if (managedBizIds.length > 0) {
                where.businessId = { in: managedBizIds };
            }
        } else if (!isSuperAdmin && req.user.businessType && req.user.businessType !== 'ALL') {
            const biz = await prisma.business.findFirst({
                where: { name: { equals: String(req.user.businessType).trim() } }
            });
            if (biz) {
                where.businessId = biz.id;
            }
        }

        if (req.query.businessId && req.query.businessId !== 'ALL' && req.query.businessId !== '') {
            where.businessId = parseInt(req.query.businessId);
        }

        const batches = await prisma.batch.findMany({
            where,
            select: {
                id: true,
                name: true,
                businessId: true,
                business: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: { id: 'desc' }
        });
        const safeData = JSON.parse(JSON.stringify(batches, (k, v) => typeof v === 'bigint' ? v.toString() : v));
        res.json(safeData);
    } catch (error) {
        console.error("Error fetching batches:", error);
        res.status(500).json({ error: "Failed to fetch batches" });
    }
};

exports.getBusinesses = async (req, res) => {
    try {
        const userId = Number(req.user?.id || req.user?.userId);
        const userDepartment = req.user.department ? req.user.department.toUpperCase() : '';
        const role = String(req.user.role || '').toUpperCase().replace(/[\s_-]+/g, '_');
        const isSuperAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER_ADMIN', 'SUPERADMIN', 'ADMIN', 'FINANCE'].includes(role) || 
                             userDepartment === 'FINANCE' || 
                             userDepartment === 'CALL_CENTER' || 
                             userDepartment === 'DELIVERY';
        const isManager = ['MANAGER', 'ASS_MANAGER', 'SUPER'].includes(role);

        let where = {};
        if (isManager) {
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
            if (managedBizIds.length > 0) {
                where.id = { in: managedBizIds };
            }
        } else if (!isSuperAdmin && req.user.businessType && req.user.businessType !== 'ALL') {
            where.name = { equals: String(req.user.businessType).trim() };
        }

        const businesses = await prisma.business.findMany({
            where,
            select: {
                id: true,
                name: true,
                category: true,
                logo: true
            },
            orderBy: { name: 'asc' }
        });
        const safeData = JSON.parse(JSON.stringify(businesses, (k, v) => typeof v === 'bigint' ? v.toString() : v));
        res.json(safeData);
    } catch (error) {
        console.error("Error fetching businesses:", error);
        res.status(500).json({ error: "Failed to fetch businesses" });
    }
};

const waPhoneCache = new Map();

exports.getBusinessPhoneInfo = async (req, res) => {
    try {
        const { businessId, campaignType } = req.query;
        if (!businessId || businessId === 'ALL' || isNaN(parseInt(businessId))) {
            return res.json({ success: true, phoneInfo: null });
        }

        const bId = parseInt(businessId);
        const camp = campaignType ? String(campaignType).toUpperCase() : 'FREE_SEMINAR';
        const cacheKey = `${bId}_${camp}`;

        const cached = waPhoneCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return res.json({ success: true, phoneInfo: cached.data });
        }

        let whereClause = { businessId: bId };
        if (camp) {
            whereClause.campaignType = camp;
        }

        let settings = await prisma.crmSettings.findFirst({ where: whereClause });
        if (!settings && camp) {
            settings = await prisma.crmSettings.findFirst({ where: { businessId: bId } });
        }

        if (!settings || !settings.waNumId || !settings.metaApiKey) {
            const result = {
                displayPhoneNumber: null,
                waNumId: settings?.waNumId ? String(settings.waNumId).trim() : null,
                waId: settings?.waId ? String(settings.waId).trim() : null,
                verifiedName: null,
                qualityRating: null
            };
            return res.json({ success: true, phoneInfo: result });
        }

        const cleanWaNumId = String(settings.waNumId).trim();
        const cleanApiKey = String(settings.metaApiKey).trim();

        let displayPhoneNumber = null;
        let verifiedName = null;
        let qualityRating = null;

        try {
            const metaRes = await axios.get(`https://graph.facebook.com/v21.0/${cleanWaNumId}`, {
                headers: { Authorization: `Bearer ${cleanApiKey}` },
                params: { fields: 'display_phone_number,verified_name,quality_rating' },
                timeout: 5000
            });
            displayPhoneNumber = metaRes.data?.display_phone_number || null;
            verifiedName = metaRes.data?.verified_name || null;
            qualityRating = metaRes.data?.quality_rating || null;
        } catch (metaErr) {
            console.error(`[WA Phone Info] Meta API error for setting ${settings.id}:`, metaErr.response?.data?.error?.message || metaErr.message);
        }

        const phoneInfo = {
            displayPhoneNumber,
            verifiedName,
            qualityRating,
            waNumId: cleanWaNumId,
            waId: settings.waId ? String(settings.waId).trim() : null
        };

        // Cache for 15 minutes
        waPhoneCache.set(cacheKey, { data: phoneInfo, expiresAt: Date.now() + 15 * 60 * 1000 });

        return res.json({ success: true, phoneInfo });
    } catch (error) {
        console.error("Error fetching business phone info:", error);
        return res.status(500).json({ error: "Failed to fetch business phone info" });
    }
};
