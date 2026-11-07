const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');

// Helper to get formatted date string YYYY-MM-DD in Colombo time (UTC+5:30)
function getColomboDateString(d = new Date()) {
    const colomboTime = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
    return colomboTime.toISOString().split('T')[0];
}

// Helper to extract clean 9-digit mobile suffix without BIZ/BATCH suffix
function getCleanPhoneSuffix(raw) {
    const main = String(raw || '').split('_')[0].replace(/[^0-9]/g, '');
    return main.slice(-9);
}

function matchesBusinessLead(lead, bId) {
    if (!lead) return false;
    if (lead.batch?.businessId === bId) return true;
    if (lead.phone) {
        const regex = new RegExp(`_BIZ_${bId}(?:_|$)`);
        if (regex.test(lead.phone)) return true;
    }
    return false;
}

function extractBizFromLead(lead) {
    if (!lead) return null;
    if (lead.batch?.businessId) return lead.batch.businessId;
    if (lead.phone) {
        const match = String(lead.phone).match(/_BIZ_(\d+)(?:_|$)/);
        if (match) return parseInt(match[1]);
    }
    return null;
}

async function findMatchingLeadForBusiness(phoneSuffix, bId) {
    const cleanPhone = String(phoneSuffix || '').replace(/[^0-9]/g, '').slice(-9);
    if (!cleanPhone) return { leadMatch: null, isLeadFromSameBiz: false, detectedBizId: null };

    // Use fast indexed query first for instant response
    let candidateLeads = await prisma.lead.findMany({
        where: {
            OR: [
                { phone: { startsWith: '94' + cleanPhone } },
                { phone: { startsWith: '0' + cleanPhone } },
                { phone: { startsWith: cleanPhone } }
            ]
        },
        include: {
            batch: { select: { id: true, name: true, businessId: true } },
            assignedUser: { select: { id: true, firstName: true, lastName: true, role: true, businessType: true } }
        },
        take: 10
    });

    // Fallback to contains query if no matches found via startsWith
    if (candidateLeads.length === 0) {
        candidateLeads = await prisma.lead.findMany({
            where: {
                phone: { contains: cleanPhone }
            },
            include: {
                batch: { select: { id: true, name: true, businessId: true } },
                assignedUser: { select: { id: true, firstName: true, lastName: true, role: true, businessType: true } }
            },
            take: 10
        });
    }

    const targetBId = (bId && bId !== 'ALL' && !isNaN(parseInt(bId))) ? parseInt(bId) : null;
    let exactBizLeads = [];
    if (targetBId) {
        exactBizLeads = candidateLeads.filter(l => matchesBusinessLead(l, targetBId));
    }

    // Sort leads: assigned first, then newest updatedAt
    const sortFn = (a, b) => {
        if (a.assignedTo && !b.assignedTo) return -1;
        if (!a.assignedTo && b.assignedTo) return 1;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
    };

    exactBizLeads.sort(sortFn);
    candidateLeads.sort(sortFn);

    const isLeadFromSameBiz = exactBizLeads.length > 0;
    const leadMatch = isLeadFromSameBiz ? exactBizLeads[0] : (candidateLeads[0] || null);
    const detectedBizId = isLeadFromSameBiz ? targetBId : extractBizFromLead(leadMatch);

    return { leadMatch, isLeadFromSameBiz, detectedBizId };
}

// ==========================================
// 1. GET DAILY MISSED CALLS (SMART DETECTION & SYNC)
// ==========================================
exports.getDailyMissedCalls = async (req, res) => {
    try {
        const { businessId, date, forceRefresh } = req.query;
        const targetDate = date || getColomboDateString();

        // Build start & end Date for target date (Colombo time converted to UTC)
        const dayStart = new Date(`${targetDate}T00:00:00.000Z`);
        const dayEnd = new Date(`${targetDate}T23:59:59.999Z`);
        dayStart.setHours(dayStart.getHours() - 5);
        dayStart.setMinutes(dayStart.getMinutes() - 30);
        dayEnd.setHours(dayEnd.getHours() - 5);
        dayEnd.setMinutes(dayEnd.getMinutes() - 30);

        const parsedTargetBiz = (businessId && businessId !== 'ALL' && !isNaN(parseInt(businessId))) ? parseInt(businessId) : null;

        // Fetch call records on target date.
        // If a specific business is requested, also include records where businessId is null
        // so that calls from that business's students with unassigned/unmapped WhatsApp lines can be dynamically resolved!
        let callLogWhere = {
            createdAt: {
                gte: dayStart,
                lte: dayEnd
            }
        };

        if (parsedTargetBiz) {
            callLogWhere.OR = [
                { businessId: parsedTargetBiz },
                { businessId: null }
            ];
        }

        const callLogs = await prisma.whatsAppCallRecord.findMany({
            where: callLogWhere,
            include: {
                business: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Track answered/completed calls by clean phone digits
        const answeredPhones = new Set();
        const outboundCallMap = new Map(); // phone -> list of outbound/completed timestamps

        for (const log of callLogs) {
            const phoneSuffix = getCleanPhoneSuffix(log.leadPhone);
            if (!phoneSuffix) continue;

            if (log.status === 'COMPLETED' || log.duration > 0) {
                answeredPhones.add(phoneSuffix);
            }
            if (log.direction === 'OUTBOUND' || log.status === 'COMPLETED') {
                if (!outboundCallMap.has(phoneSuffix)) outboundCallMap.set(phoneSuffix, []);
                outboundCallMap.get(phoneSuffix).push(new Date(log.createdAt).getTime());
            }
        }

        // Filter for true inbound missed calls
        const rawMissedCalls = [];
        for (const log of callLogs) {
            if (log.direction !== 'INBOUND') continue;
            const isMissed = ['MISSED', 'REJECTED', 'NO_ANSWER'].includes(log.status) || (log.duration === 0 && log.status !== 'COMPLETED');
            if (!isMissed) continue;

            const phoneSuffix = getCleanPhoneSuffix(log.leadPhone);
            if (!phoneSuffix) continue;
            const callTimeMs = new Date(log.createdAt).getTime();

            // Check if ANY subsequent outbound call or answered call was made to this phone
            const callbacks = outboundCallMap.get(phoneSuffix) || [];
            const hasSubsequentCallback = callbacks.some(ts => ts > callTimeMs);

            if (!hasSubsequentCallback) {
                rawMissedCalls.push(log);
            }
        }

        // Group by phone number (latest call time + count)
        const groupedMissed = new Map();

        for (const call of rawMissedCalls) {
            const phoneSuffix = getCleanPhoneSuffix(call.leadPhone);
            if (!phoneSuffix) continue;

            // Resolve caller's true business
            let callBizId = call.businessId;
            let leadInfo = null;

            if (!callBizId || (parsedTargetBiz && callBizId !== parsedTargetBiz)) {
                leadInfo = await findMatchingLeadForBusiness(phoneSuffix, parsedTargetBiz);
                if (leadInfo.isLeadFromSameBiz) {
                    callBizId = parsedTargetBiz;
                } else if (!callBizId && leadInfo.detectedBizId) {
                    callBizId = leadInfo.detectedBizId;
                }
            }

            // Self-heal WhatsAppCallRecord businessId if it was null
            if (!call.businessId && callBizId) {
                prisma.whatsAppCallRecord.update({
                    where: { id: call.id },
                    data: { businessId: callBizId }
                }).catch(() => {});
            }

            const effectiveBiz = callBizId || parsedTargetBiz || 1;

            // If user requested a specific business, strictly filter by effectiveBiz
            if (parsedTargetBiz && effectiveBiz !== parsedTargetBiz) {
                continue;
            }

            if (!groupedMissed.has(phoneSuffix)) {
                groupedMissed.set(phoneSuffix, {
                    latestCall: call,
                    count: 1,
                    businessId: effectiveBiz,
                    leadInfo
                });
            } else {
                const item = groupedMissed.get(phoneSuffix);
                item.count++;
                if (new Date(call.createdAt) > new Date(item.latestCall.createdAt)) {
                    item.latestCall = call;
                }
            }
        }

        // Sync or fetch from MissedCallTask table
        for (const [phoneSuffix, data] of groupedMissed.entries()) {
            const call = data.latestCall;
            const bId = data.businessId || (parsedTargetBiz || 1);
            const cleanPhone = String(call.leadPhone || '').split('_')[0].replace(/[^0-9]/g, '');

            // Find existing task for this phone on targetDate regardless of businessId to prevent duplicates and heal wrong business assignments
            const existingTask = await prisma.missedCallTask.findFirst({
                where: {
                    phone: { contains: phoneSuffix },
                    taskDate: targetDate
                }
            });

            const leadInfo = data.leadInfo || await findMatchingLeadForBusiness(phoneSuffix, bId);
            const { leadMatch, isLeadFromSameBiz } = leadInfo;
            const studentName = leadMatch?.name || null;
            const batchId = isLeadFromSameBiz ? (leadMatch?.batchId || null) : null;
            const existingLeadId = isLeadFromSameBiz ? (leadMatch?.id || null) : null;
            const existingAssigneeId = isLeadFromSameBiz ? (leadMatch?.assignedTo || null) : null;
            const existingAssigneeName = (isLeadFromSameBiz && leadMatch?.assignedUser) 
                ? `${leadMatch.assignedUser.firstName} (${leadMatch.assignedUser.role || 'Coordinator'})` 
                : null;
            const source = leadMatch?.campaignType || call.campaignType || 'CRM';

            if (!existingTask) {
                await prisma.missedCallTask.create({
                    data: {
                        callLogId: call.callId ? String(call.callId) : (call.id ? String(call.id) : null),
                        phone: cleanPhone || call.leadPhone,
                        studentName,
                        businessId: bId,
                        batchId,
                        callTime: new Date(call.createdAt),
                        source,
                        existingLeadId,
                        existingAssigneeId,
                        existingAssigneeName,
                        taskDate: targetDate,
                        status: 'PENDING_DISTRIBUTION'
                    }
                });
            } else {
                await prisma.missedCallTask.update({
                    where: { id: existingTask.id },
                    data: {
                        businessId: bId, // Auto-heals if previously wrongly saved under another business!
                        studentName: studentName || existingTask.studentName,
                        batchId: isLeadFromSameBiz ? batchId : existingTask.batchId,
                        source: (existingTask.source && existingTask.source !== 'CRM') ? existingTask.source : source,
                        existingLeadId: isLeadFromSameBiz ? existingLeadId : existingTask.existingLeadId,
                        existingAssigneeId: isLeadFromSameBiz ? existingAssigneeId : existingTask.existingAssigneeId,
                        existingAssigneeName: isLeadFromSameBiz ? existingAssigneeName : existingTask.existingAssigneeName
                    }
                });
            }
        }

        let taskWhere = {
            taskDate: targetDate
        };
        if (parsedTargetBiz) {
            taskWhere.businessId = parsedTargetBiz;
        }

        // Return all tasks for targetDate & business
        const tasks = await prisma.missedCallTask.findMany({
            where: taskWhere,
            include: {
                business: { select: { id: true, name: true } },
                batch: { select: { id: true, name: true } },
                taskAssignee: { select: { id: true, firstName: true, lastName: true, role: true, businessType: true } },
                assignedByManager: { select: { id: true, firstName: true, lastName: true, role: true } }
            },
            orderBy: { callTime: 'desc' }
        });

        // Summary counts
        const total = tasks.length;
        const pendingDist = tasks.filter(t => t.status === 'PENDING_DISTRIBUTION').length;
        const assigned = tasks.filter(t => t.status === 'ASSIGNED').length;
        const completed = tasks.filter(t => t.status === 'COMPLETED').length;
        const answered = tasks.filter(t => t.callOutcome === 'ANSWERED').length;

        res.status(200).json({
            success: true,
            date: targetDate,
            summary: {
                total,
                pendingDistribution: pendingDist,
                assigned,
                completed,
                answered,
                resolutionRate: total > 0 ? Math.round((answered / total) * 100) : 0
            },
            tasks
        });
    } catch (error) {
        console.error("Get daily missed calls error:", error);
        res.status(500).json({ error: "Failed to fetch daily missed calls", details: error.message });
    }
};

// ==========================================
// 2. DISTRIBUTE MISSED CALL TASKS (MANAGER ACTION)
// ==========================================
exports.distributeMissedCallTasks = async (req, res) => {
    try {
        const { assignments, taskIds, staffId, date, businessId } = req.body;
        // Normalize payload: support either assignments array OR { taskIds: [...], staffId: ... }
        let normalizedAssignments = assignments;
        if ((!normalizedAssignments || !Array.isArray(normalizedAssignments) || normalizedAssignments.length === 0) && Array.isArray(taskIds) && staffId) {
            normalizedAssignments = taskIds.map(tId => ({ taskId: tId, staffId }));
        }

        if (!normalizedAssignments || !Array.isArray(normalizedAssignments) || normalizedAssignments.length === 0) {
            return res.status(400).json({ error: "No assignments provided" });
        }

        const managerId = req.user?.id || req.user?.userId;
        const now = new Date();
        const updatedTasks = [];

        for (const item of normalizedAssignments) {
            if (!item.taskId || !item.staffId) continue;

            const updated = await prisma.missedCallTask.update({
                where: { id: parseInt(item.taskId) },
                data: {
                    taskAssigneeId: parseInt(item.staffId),
                    assignedByManagerId: managerId ? parseInt(managerId) : null,
                    assignedAt: now,
                    status: 'ASSIGNED'
                },
                include: {
                    business: { select: { id: true, name: true } },
                    batch: { select: { id: true, name: true } },
                    taskAssignee: { select: { id: true, firstName: true, lastName: true, role: true } }
                }
            });
            updatedTasks.push(updated);

            // Give the lead to the call assignee ONLY if nobody owns the chat yet.
            // Before: every missed-call distribution overwrote lead.assignedTo, so chats jumped
            // away from the coordinator who was handling them (one coordinator owns chat + calls).
            if (updated.existingLeadId) {
                prisma.lead.updateMany({
                    where: { id: updated.existingLeadId, assignedTo: null },
                    data: { assignedTo: updated.taskAssigneeId, assignedAt: now }
                }).then((r) => {
                    if (r.count === 0) console.log(`[missed-call] task ${updated.id}: lead ${updated.existingLeadId} already has a coordinator — chat owner kept`);
                }).catch(() => {});
            }
        }

        // Live notify assigned staff via socket
        try {
            const { getIo } = require('./chatController');
            const io = getIo();
            if (io) {
                for (const t of updatedTasks) {
                    if (t.taskAssigneeId) {
                        const payload = {
                            taskId: t.id,
                            assigneeId: t.taskAssigneeId,
                            task: t
                        };
                        io.emit('missed_call_task_assigned', payload);
                        io.to(`user_${t.taskAssigneeId}`).emit('missed_call_task_assigned', payload);
                    }
                }
            }
        } catch (sockErr) {
            console.error("Socket error on missed call task distribute:", sockErr);
        }

        res.status(200).json({
            success: true,
            message: `Successfully distributed ${updatedTasks.length} task(s)`,
            count: updatedTasks.length
        });
    } catch (error) {
        console.error("Distribute missed calls error:", error);
        res.status(500).json({ error: "Failed to distribute tasks", details: error.message });
    }
};

exports.distributeTasks = exports.distributeMissedCallTasks;

// ==========================================
// 3. GET MY ASSIGNED TASKS (STAFF ACTION)
// ==========================================
exports.getMyTasks = async (req, res) => {
    try {
        const staffId = req.user?.id || req.user?.userId;
        if (!staffId) return res.status(401).json({ error: "Unauthorized" });

        const { date, status } = req.query;
        const targetDate = date || getColomboDateString();

        let taskWhere = {
            taskAssigneeId: parseInt(staffId)
        };

        if (status === 'PENDING') {
            // Pending tasks must NEVER disappear on date changes; show ALL uncompleted tasks assigned to this staff
            taskWhere.status = { not: 'COMPLETED' };
        } else if (status === 'COMPLETED') {
            taskWhere.status = 'COMPLETED';
            if (date) taskWhere.taskDate = date;
        } else {
            // ALL tab: return all pending tasks, plus target date's completed tasks
            taskWhere.OR = [
                { status: { not: 'COMPLETED' } },
                { taskDate: targetDate }
            ];
        }

        const allTasks = await prisma.missedCallTask.findMany({
            where: taskWhere,
            include: {
                business: { select: { id: true, name: true } },
                batch: { select: { id: true, name: true } }
            },
            orderBy: { callTime: 'desc' }
        });

        const total = allTasks.length;
        const pending = allTasks.filter(t => t.status !== 'COMPLETED').length;
        const completed = allTasks.filter(t => t.status === 'COMPLETED').length;
        const answered = allTasks.filter(t => t.callOutcome === 'ANSWERED').length;

        // Enrich tasks with lead call permission status
        const phoneSuffixes = allTasks.map(t => getCleanPhoneSuffix(t.phone)).filter(Boolean);
        let leadMap = new Map();
        if (phoneSuffixes.length > 0) {
            const leads = await prisma.lead.findMany({
                where: {
                    OR: phoneSuffixes.map(s => ({ phone: { contains: s } }))
                },
                select: {
                    id: true,
                    phone: true,
                    name: true,
                    waCallPermissionStatus: true,
                    waCallPermissionRequestedAt: true,
                    waCallPermissionExpiry: true
                }
            });

            for (const l of leads) {
                const suffix = getCleanPhoneSuffix(l.phone);
                const existing = leadMap.get(suffix);
                const status = l.waCallPermissionStatus || 'NONE';

                if (!existing) {
                    leadMap.set(suffix, l);
                } else {
                    // Priority: ALLOWED > PENDING > NONE
                    if (status === 'ALLOWED') {
                        leadMap.set(suffix, l);
                    } else if (status === 'PENDING' && existing.waCallPermissionStatus !== 'ALLOWED') {
                        leadMap.set(suffix, l);
                    }
                }
            }
        }

        const enrichTask = (t) => {
            const suffix = getCleanPhoneSuffix(t.phone);
            const l = leadMap.get(suffix);
            return {
                ...t,
                studentName: t.studentName || l?.name || null,
                existingLeadId: t.existingLeadId || l?.id || null,
                waCallPermissionStatus: l?.waCallPermissionStatus || 'NONE',
                waCallPermissionRequestedAt: l?.waCallPermissionRequestedAt || null,
                waCallPermissionExpiry: l?.waCallPermissionExpiry || null
            };
        };

        const statusFilteredTasks = (status && status !== 'ALL') 
            ? (status === 'PENDING' ? allTasks.filter(t => t.status !== 'COMPLETED') : allTasks.filter(t => t.status === status))
            : allTasks;

        const enrichedTasks = statusFilteredTasks.map(enrichTask);

        res.status(200).json({
            success: true,
            pendingCount: pending,
            summary: {
                total,
                pending,
                completed,
                answered
            },
            tasks: enrichedTasks
        });
    } catch (error) {
        console.error("Get my tasks error:", error);
        res.status(500).json({ error: "Failed to fetch assigned tasks", details: error.message });
    }
};

// ==========================================
// 4. UPDATE TASK OUTCOME & REMARKS (STAFF ACTION)
// ==========================================
exports.updateTaskOutcome = async (req, res) => {
    try {
        const { taskId, callOutcome, outcome, callAttempts, remarks, isCompleted, status } = req.body;
        if (!taskId) return res.status(400).json({ error: "Missing taskId" });

        const existing = await prisma.missedCallTask.findUnique({
            where: { id: parseInt(taskId) }
        });
        if (!existing) return res.status(404).json({ error: "Task not found" });

        const now = new Date();
        const selectedOutcome = callOutcome || outcome || existing.callOutcome || 'ANSWERED';
        const attempts = callAttempts !== undefined ? parseInt(callAttempts) : (existing.callAttempts + 1);
        const shouldComplete = isCompleted !== undefined ? Boolean(isCompleted) : (status === 'COMPLETED' || selectedOutcome === 'ANSWERED');

        const updated = await prisma.missedCallTask.update({
            where: { id: parseInt(taskId) },
            data: {
                callOutcome: selectedOutcome,
                callAttempts: attempts,
                remarks: remarks !== undefined ? remarks : existing.remarks,
                lastAttemptAt: now,
                status: shouldComplete ? 'COMPLETED' : 'IN_PROGRESS',
                completedAt: shouldComplete ? now : existing.completedAt
            },
            include: {
                business: { select: { id: true, name: true } },
                batch: { select: { id: true, name: true } },
                taskAssignee: { select: { id: true, firstName: true } }
            }
        });

        res.status(200).json({
            success: true,
            message: "Task outcome recorded successfully",
            task: updated
        });
    } catch (error) {
        console.error("Update task outcome error:", error);
        res.status(500).json({ error: "Failed to update task outcome", details: error.message });
    }
};

// ==========================================
// 5. MISSED CALLS ANALYTICS & PERFORMANCE REPORT
// ==========================================
exports.getAnalyticsReport = async (req, res) => {
    try {
        const { startDate, endDate, businessId, staffId } = req.query;
        const today = getColomboDateString();
        const start = startDate || today;
        const end = endDate || today;

        let whereClause = {
            taskDate: {
                gte: start,
                lte: end
            }
        };

        if (businessId && businessId !== 'ALL' && !isNaN(parseInt(businessId))) {
            whereClause.businessId = parseInt(businessId);
        }
        if (staffId && staffId !== 'ALL' && !isNaN(parseInt(staffId))) {
            whereClause.taskAssigneeId = parseInt(staffId);
        }

        const tasks = await prisma.missedCallTask.findMany({
            where: whereClause,
            include: {
                business: { select: { id: true, name: true } },
                batch: { select: { id: true, name: true } },
                taskAssignee: { select: { id: true, firstName: true, lastName: true, role: true } },
                assignedByManager: { select: { id: true, firstName: true, role: true } }
            },
            orderBy: { callTime: 'desc' }
        });

        // Summary Calculations
        const total = tasks.length;
        const distributed = tasks.filter(t => t.taskAssigneeId !== null).length;
        const completed = tasks.filter(t => t.status === 'COMPLETED').length;
        const answered = tasks.filter(t => t.callOutcome === 'ANSWERED').length;
        const noAnswer = tasks.filter(t => t.callOutcome === 'NO_ANSWER').length;
        const rejected = tasks.filter(t => t.callOutcome === 'REJECTED').length;

        // Staff Performance Breakdown
        const staffMap = new Map();
        for (const t of tasks) {
            if (!t.taskAssignee) continue;
            const sId = t.taskAssignee.id;
            if (!staffMap.has(sId)) {
                staffMap.set(sId, {
                    staffId: sId,
                    name: `${t.taskAssignee.firstName} ${t.taskAssignee.lastName || ''}`.trim(),
                    role: t.taskAssignee.role,
                    assignedTasks: 0,
                    completedTasks: 0,
                    answered: 0,
                    noAnswer: 0,
                    rejected: 0,
                    totalAttempts: 0
                });
            }
            const s = staffMap.get(sId);
            s.assignedTasks++;
            s.totalAttempts += (t.callAttempts || 0);
            if (t.status === 'COMPLETED') s.completedTasks++;
            if (t.callOutcome === 'ANSWERED') s.answered++;
            else if (t.callOutcome === 'NO_ANSWER') s.noAnswer++;
            else if (t.callOutcome === 'REJECTED') s.rejected++;
        }

        const staffBreakdown = Array.from(staffMap.values()).map(s => ({
            ...s,
            successRate: s.assignedTasks > 0 ? Math.round((s.answered / s.assignedTasks) * 100) : 0,
            avgAttemptsPerTask: s.assignedTasks > 0 ? (s.totalAttempts / s.assignedTasks).toFixed(1) : '0'
        }));

        res.status(200).json({
            success: true,
            summary: {
                total,
                distributed,
                distributionRate: total > 0 ? Math.round((distributed / total) * 100) : 0,
                completed,
                answered,
                noAnswer,
                rejected,
                successRate: total > 0 ? Math.round((answered / total) * 100) : 0
            },
            staffBreakdown,
            tasks
        });
    } catch (error) {
        console.error("Get analytics report error:", error);
        res.status(500).json({ error: "Failed to load analytics report", details: error.message });
    }
};

// ==========================================
// 6. LIGHTWEIGHT NAV COUNTS (0ms LATENCY)
// ==========================================
exports.getNavCounts = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const role = (req.user?.role || '').toUpperCase().replace(/ /g, '_');
        const isManager = ['SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER', 'ASS_MANAGER', 'ADMIN'].includes(role);
        const targetDate = getColomboDateString();

        const [staffPending, managerPending] = await Promise.all([
            prisma.missedCallTask.count({
                where: { taskAssigneeId: parseInt(userId), status: { not: 'COMPLETED' } }
            }),
            isManager ? prisma.missedCallTask.count({
                where: { taskDate: targetDate, status: 'PENDING_DISTRIBUTION' }
            }) : Promise.resolve(0)
        ]);

        res.status(200).json({
            staffPending,
            dailyMissed: managerPending
        });
    } catch (e) {
        res.status(200).json({ staffPending: 0, dailyMissed: 0 });
    }
};

