const admin = require('firebase-admin');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Dispatches high-priority push notifications to active staff members
 * when an incoming WhatsApp call is detected.
 * This rings staff devices even if the mobile app is backgrounded or killed.
 */
async function notifyIncomingCallToActiveStaff(callPayload, targetAgentId = null) {
    try {
        let eligibleStaff = [];

        if (targetAgentId) {
            const staff = await prisma.user.findUnique({
                where: { id: parseInt(targetAgentId, 10) },
                select: { id: true, firstName: true, agentStatus: true, fcmToken: true, role: true, department: true }
            });
            if (staff && staff.agentStatus === 'ACTIVE' && staff.fcmToken) {
                eligibleStaff.push(staff);
            }
        } else {
            const rawBiz = String(callPayload.businessType || '').trim().toLowerCase();
            const allActiveStaff = await prisma.user.findMany({
                where: {
                    agentStatus: 'ACTIVE',
                    fcmToken: { not: null }
                },
                select: { id: true, firstName: true, agentStatus: true, fcmToken: true, role: true, department: true, businessType: true }
            });

            eligibleStaff = allActiveStaff.filter(staff => {
                if (!staff.fcmToken) return false;
                const roleUpper = String(staff.role || '').toUpperCase().replace(/[\s-]/g, '_');
                const deptLower = String(staff.department || '').trim().toLowerCase();

                // Exclude students, callers, non-coordination depts
                const isStudent = roleUpper === 'STUDENT' || roleUpper === 'USER';
                const isCallCenter = deptLower.includes('call center') || roleUpper.includes('CALLER');
                if (isStudent || isCallCenter) return false;

                const bizList = String(staff.businessType || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                const isAll = bizList.length === 0 || bizList.includes('all');
                if (isAll) return true;

                if (!rawBiz || rawBiz === 'all') return true;
                return bizList.some(b => b === rawBiz || rawBiz.includes(b) || b.includes(rawBiz));
            });
        }

        if (eligibleStaff.length === 0) {
            console.log(`[FCM Call Notifier] No active staff with FCM tokens found for call ${callPayload.callId}`);
            return;
        }

        console.log(`[FCM Call Notifier] Sending incoming call push to ${eligibleStaff.length} active staff members.`);

        const callerName = callPayload.leadName || callPayload.from || 'Student';
        const callerPhone = callPayload.from || '';
        const businessName = callPayload.businessType || 'IMA Campus';

        for (const staff of eligibleStaff) {
            const message = {
                token: staff.fcmToken,
                notification: {
                    title: `📞 WhatsApp Call: ${callerName}`,
                    body: `Incoming call from ${callerPhone} (${businessName}). Tap to answer.`
                },
                data: {
                    type: 'INCOMING_CALL',
                    callId: String(callPayload.callId || ''),
                    from: String(callPayload.from || ''),
                    leadName: String(callerName),
                    businessType: String(businessName),
                    ringtoneUrl: String(callPayload.ringtoneUrl || ''),
                    receivingWaNumId: String(callPayload.receivingWaNumId || ''),
                    sdp: String(callPayload.sdp || ''),
                    businessId: String(callPayload.businessId || '')
                },
                android: {
                    priority: 'high',
                    ttl: 45 * 1000, // 45 seconds ringing lifetime
                    notification: {
                        channelId: 'calls_channel',
                        sound: 'default',
                        priority: 'max',
                        visibility: 'public'
                    }
                },
                apns: {
                    headers: {
                        'apns-priority': '10',
                        'apns-push-type': 'alert'
                    },
                    payload: {
                        aps: {
                            sound: 'default',
                            'content-available': 1
                        }
                    }
                }
            };

            admin.messaging().send(message)
                .then(() => {
                    console.log(`[FCM Call Notifier] Successfully alerted staff ID ${staff.id} (${staff.firstName})`);
                })
                .catch(err => {
                    console.warn(`[FCM Call Notifier] Push failed for staff ID ${staff.id}:`, err?.message);
                    // If token invalid, optionally clear it
                    if (err?.code === 'messaging/registration-token-not-registered') {
                        prisma.user.update({ where: { id: staff.id }, data: { fcmToken: null } }).catch(() => {});
                    }
                });
        }
    } catch (error) {
        console.error('[FCM Call Notifier] Error in notifyIncomingCallToActiveStaff:', error);
    }
}

module.exports = { notifyIncomingCallToActiveStaff };
