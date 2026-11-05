const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 🔥 Robust SLT Time Parser (Server Timezone අවුල් සදහටම විසඳන කෑල්ල) 🔥
const parseSLTDate = (dateStr, timeStr = "00:00") => {
    // උදා: dateStr = "2026-05-12", timeStr = "20:00"
    const [year, month, day] = dateStr.split('-').map(Number);
    const timeParts = timeStr.split(':');
    const hours = Number(timeParts[0] || 0);
    const minutes = Number(timeParts[1] || 0);
    
    // ලංකාවේ වෙලාව (SLT) කියන්නේ UTC + 05:30
    // ඒ නිසා අපි පැය 5කුයි විනාඩි 30කුයි අඩු කරලා කෙලින්ම UTC වෙලාව හදලා DB එකට දෙනවා
    return new Date(Date.UTC(year, month - 1, day, hours - 5, minutes - 30, 0));
};

// Helper to format date object to SLT (UTC+5:30) date string YYYY-MM-DD
const getSLTDateStr = (d) => {
    if (!d) return '';
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return '';
    const sltObj = new Date(dateObj.getTime() + (330 * 60 * 1000));
    return sltObj.toISOString().split('T')[0];
};

exports.getSchedule = async (req, res) => {
    try {
        const { batchId, businessId, year, month } = req.query;
        const now = new Date();
        const curYear = (year && !isNaN(parseInt(year))) ? parseInt(year) : now.getFullYear();
        const curMonth = (month && !isNaN(parseInt(month))) ? parseInt(month) : (now.getMonth() + 1);

        const startDate = parseSLTDate(`${curYear}-${String(curMonth).padStart(2, '0')}-01`);
        const nextMonthDays = new Date(Date.UTC(curYear, curMonth, 0)).getUTCDate(); 
        const endDate = parseSLTDate(`${curYear}-${String(curMonth).padStart(2, '0')}-${String(nextMonthDays).padStart(2, '0')}`, "23:59");

        let whereClause = {
            date: {
                gte: startDate,
                lte: endDate,
            }
        };
        if (businessId) {
            whereClause.businessId = parseInt(businessId);
        } else if (batchId) {
            const bIdNum = parseInt(batchId);
            whereClause.OR = [
                { batchId: bIdNum },
                { additionalBatchIds: { contains: `${bIdNum}` } }
            ];
        }

        const schedule = await prisma.timetable.findMany({
            where: whereClause,
            include: { hall: true, batch: true },
            orderBy: { startTime: 'asc' }
        });

        // Helper to extract all batch IDs covered by a Timetable record
        const getCoveredBatchIds = (s) => {
            const bIds = [s.batchId];
            if (s.additionalBatchIds) {
                try {
                    const parsed = typeof s.additionalBatchIds === 'string' ? JSON.parse(s.additionalBatchIds) : s.additionalBatchIds;
                    if (Array.isArray(parsed)) {
                        bIds.push(...parsed.map(Number));
                    }
                } catch (e) {}
            }
            return [...new Set(bIds.filter(Boolean))];
        };

        // Normalize string for fuzzy comparison
        const norm = (str) => (str || '').toLowerCase().replace(/[\s\-_]+/g, ' ').trim();

        // 1. Deduplicate schedule (Timetable records themselves) when viewing a Business or multiple batches
        // If the same class was created multiple times for different batches on the same date/time, unify them
        const unifiedScheduleList = [];
        schedule.forEach(s => {
            const sDateStr = getSLTDateStr(s.date);
            const sCleanMeetingId = s.liveLink ? String(s.liveLink).replace(/\D/g, '') : null;
            const sNormTitle = norm(s.title);
            const sNormSub = norm(s.subjectName);
            const sNormLec = norm(s.lecturerName);

            // Find if there is an existing timetable record in unifiedScheduleList representing this same session
            const matchIndex = unifiedScheduleList.findIndex(existing => {
                const exDateStr = getSLTDateStr(existing.date);
                if (exDateStr !== sDateStr) return false;
                if (existing.startTime !== s.startTime) return false;

                const exCleanMeetingId = existing.liveLink ? String(existing.liveLink).replace(/\D/g, '') : null;
                const exNormTitle = norm(existing.title);
                const exNormSub = norm(existing.subjectName);
                const exNormLec = norm(existing.lecturerName);

                // Check 1: Same Zoom Meeting ID
                if (sCleanMeetingId && exCleanMeetingId && (sCleanMeetingId === exCleanMeetingId || sCleanMeetingId.includes(exCleanMeetingId) || exCleanMeetingId.includes(sCleanMeetingId))) {
                    return true;
                }

                // Check 2: Same Title or high title overlap (same class title)
                if (sNormTitle && exNormTitle && (sNormTitle === exNormTitle || (sNormTitle.length > 8 && exNormTitle.length > 8 && (sNormTitle.includes(exNormTitle) || exNormTitle.includes(sNormTitle))))) {
                    return true;
                }

                // Check 3: Same Lecturer AND same Subject
                if (sNormLec && exNormLec && sNormLec === exNormLec && sNormSub && exNormSub && sNormSub === exNormSub) {
                    return true;
                }

                return false;
            });

            if (matchIndex !== -1) {
                const existing = unifiedScheduleList[matchIndex];
                const existingBatches = getCoveredBatchIds(existing);
                const newBatches = getCoveredBatchIds(s);
                const mergedBatches = [...new Set([...existingBatches, ...newBatches])];
                const others = mergedBatches.filter(id => id !== existing.batchId);
                existing.additionalBatchIds = others.length > 0 ? JSON.stringify(others) : null;
                if (!existing.liveLink && s.liveLink) existing.liveLink = s.liveLink;
                if (!existing.hallId && s.hallId) {
                    existing.hallId = s.hallId;
                    existing.hall = s.hall;
                }
                if (existing.deliveryStatus !== 'DELIVERED' && s.deliveryStatus === 'DELIVERED') {
                    existing.deliveryStatus = 'DELIVERED';
                }
            } else {
                unifiedScheduleList.push({ ...s });
            }
        });

        const deduplicatedSchedule = unifiedScheduleList;

        let contentWhereClause = {
            contentType: { in: ['live', '1'] },
            date: {
                gte: startDate,
                lte: endDate,
            }
        };
        if (businessId) {
            const bizBatches = await prisma.batch.findMany({ where: { businessId: parseInt(businessId) } });
            contentWhereClause.batchId = { in: bizBatches.map(b => b.id) };
        } else if (batchId) {
            contentWhereClause.batchId = parseInt(batchId);
        }

        const contentClasses = await prisma.content.findMany({
            where: contentWhereClause,
            include: { group: true }
        });

        // 2. Filter and map Content classes
        // Content classes should NOT duplicate an existing Timetable record, AND
        // if the same Content class is assigned to 2 or 3 batches, it must be unified into ONE class!
        const uniqueContentClassesList = [];

        contentClasses.forEach(c => {
            const dateStr = getSLTDateStr(c.date);
            const normTitle = norm(c.title);
            const cleanMeetingId = (c.meetingId || c.link) ? String(c.meetingId || c.link).replace(/\D/g, '') : null;

            // Check if ANY Timetable record in deduplicatedSchedule covers this class
            const matchingTimetable = deduplicatedSchedule.find(s => {
                const sDateStr = getSLTDateStr(s.date);
                if (sDateStr !== dateStr) return false;
                if (s.startTime !== c.startTime) return false;

                const coveredBatches = getCoveredBatchIds(s);
                const isBatchCovered = coveredBatches.includes(c.batchId);

                const sNormSub = norm(s.subjectName);
                const sNormTitle = norm(s.title);
                const sCleanMeetingId = s.liveLink ? String(s.liveLink).replace(/\D/g, '') : null;

                const isMeetingMatch = cleanMeetingId && sCleanMeetingId && (cleanMeetingId.includes(sCleanMeetingId) || sCleanMeetingId.includes(cleanMeetingId));
                const isTitleMatch = normTitle && sNormTitle && (normTitle === sNormTitle || (normTitle.length > 8 && sNormTitle.length > 8 && (normTitle.includes(sNormTitle) || sNormTitle.includes(normTitle))));

                // 1) Same zoom meeting ID -> definitely the same class
                if (isMeetingMatch) return true;

                // 2) Same title -> definitely the same class
                if (isTitleMatch) return true;

                // Check if one is paper and the other is theory
                const sIsPaper = sNormSub.includes('paper') || (sNormTitle && sNormTitle.includes('paper'));
                const cIsPaper = normTitle.includes('paper') || (c.group?.classType === 2);
                if (sIsPaper !== cIsPaper) return false;

                // 3) Batch is covered AND (title contains subject name or subject matches)
                if (isBatchCovered && sNormSub && normTitle && (normTitle.includes(sNormSub) || sNormSub.includes(normTitle))) {
                    return true;
                }

                return false;
            });

            if (matchingTimetable) {
                // Attach live link / delivery status to timetable if missing
                if (!matchingTimetable.liveLink && (c.link || c.meetingId)) {
                    matchingTimetable.liveLink = c.link || c.meetingId;
                }
                if (matchingTimetable.deliveryStatus !== 'DELIVERED' && (c.link || c.meetingId)) {
                    matchingTimetable.deliveryStatus = 'DELIVERED';
                }
                // Ensure c.batchId is registered in matchingTimetable
                const covered = getCoveredBatchIds(matchingTimetable);
                if (!covered.includes(c.batchId)) {
                    covered.push(c.batchId);
                    const others = covered.filter(id => id !== matchingTimetable.batchId);
                    matchingTimetable.additionalBatchIds = others.length > 0 ? JSON.stringify(others) : null;
                }
            } else {
                // Standalone Content Hub class: Unify Content classes across multiple batches for the same session
                const matchIndex = uniqueContentClassesList.findIndex(existing => {
                    const exDateStr = getSLTDateStr(existing.date);
                    if (exDateStr !== dateStr) return false;
                    if (existing.startTime !== c.startTime) return false;

                    const exCleanMeetingId = (existing.link || existing.meetingId) ? String(existing.link || existing.meetingId).replace(/\D/g, '') : null;
                    const exNormTitle = norm(existing.title);

                    if (cleanMeetingId && exCleanMeetingId && (cleanMeetingId === exCleanMeetingId || cleanMeetingId.includes(exCleanMeetingId) || exCleanMeetingId.includes(cleanMeetingId))) {
                        return true;
                    }
                    if (normTitle && exNormTitle && (normTitle === exNormTitle || (normTitle.length > 8 && exNormTitle.length > 8 && (normTitle.includes(exNormTitle) || exNormTitle.includes(normTitle))))) {
                        return true;
                    }
                    return false;
                });

                if (matchIndex !== -1) {
                    const existing = uniqueContentClassesList[matchIndex];
                    let existingBatches = [];
                    if (existing.additionalBatchIds) {
                        try { existingBatches = JSON.parse(existing.additionalBatchIds); } catch(e){}
                    }
                    if (c.batchId !== existing.batchId && !existingBatches.includes(c.batchId)) {
                        existingBatches.push(c.batchId);
                        existing.additionalBatchIds = JSON.stringify(existingBatches);
                    }
                    if (!existing.link && c.link) existing.link = c.link;
                    if (!existing.meetingId && c.meetingId) existing.meetingId = c.meetingId;
                } else {
                    const subjectName = (c.title && c.title.trim() !== '' && c.title !== 'null') ? c.title : 'Content Hub Live Class';
                    uniqueContentClassesList.push({
                        id: `content_${c.id}`,
                        businessId: businessId ? parseInt(businessId) : 0,
                        batchId: c.batchId,
                        additionalBatchIds: null,
                        batch: c.batch || null,
                        date: c.date,
                        subjectName: subjectName,
                        title: c.title || 'Content Hub Live Class',
                        startTime: c.startTime || '00:00',
                        endTime: c.endTime || '00:00',
                        lecturerName: 'Content Hub',
                        hall: null,
                        deliveryStatus: c.link || c.meetingId ? 'DELIVERED' : 'PENDING',
                        isFromContentHub: true
                    });
                }
            }
        });

        const mappedContentClasses = uniqueContentClassesList;

        const mergedSchedule = [...deduplicatedSchedule, ...mappedContentClasses].sort((a, b) => {
            if (!a.startTime || !b.startTime) return 0;
            return a.startTime.localeCompare(b.startTime);
        });

        res.status(200).json(mergedSchedule);
    } catch (error) {
        console.error("Timetable getSchedule error:", error);
        res.status(500).json({ error: "Failed to load schedule" });
    }
};

exports.createSchedule = async (req, res) => {
    try {
        const { businessId, batchId, batchIds, date, subjectName, title, startTime, endTime, lecturerName, optionalMCQ, optionalPaper } = req.body;
        
        let primaryBatchId = batchId ? parseInt(batchId) : null;
        let additionalBatchIds = null;

        if (batchIds && Array.isArray(batchIds) && batchIds.length > 0) {
            primaryBatchId = parseInt(batchIds[0]);
            if (batchIds.length > 1) {
                additionalBatchIds = JSON.stringify(batchIds.slice(1).map(id => parseInt(id)));
            }
        }

        const userId = req.user.userId || req.user.id;
        const userRole = req.user.role;
        const businessType = req.user.businessType;
        
        const roleUpper = userRole ? userRole.toUpperCase().replace(/ /g, '_') : '';
        const isAdmin = ['SYSTEM_ADMIN', 'DIRECTOR'].includes(roleUpper);
        
        if (!isAdmin) {
            const allBiz = await prisma.business.findMany();
            const myBizs = allBiz.filter(biz => {
                const isManagerOf = biz.head_manager_id === userId || biz.ass_manager_id === userId;
                const matchesBizType = businessType && (
                    String(biz.id) === String(businessType).trim() ||
                    biz.name.toLowerCase().trim() === String(businessType).toLowerCase().trim() ||
                    biz.name.toLowerCase().includes(String(businessType).toLowerCase().trim()) ||
                    String(businessType).toLowerCase().trim().includes(biz.name.toLowerCase().trim())
                );
                return isManagerOf || matchesBizType;
            });
            const myBizIds = myBizs.map(b => b.id);
            if (!myBizIds.includes(parseInt(businessId))) {
                return res.status(403).json({ error: "Access Denied. You cannot schedule classes for this business." });
            }
        }
        
        if (!primaryBatchId) {
            return res.status(400).json({ error: "At least one batch must be selected." });
        }

        // 100% ක් නිවැරදි ලංකාවේ වෙලාවන් (SLT Timestamps)
        const classDateSLT = parseSLTDate(date, "00:00");
        const classStartDateTime = parseSLTDate(date, startTime);
        const classEndDateTime = parseSLTDate(date, endTime);

        const newClass = await prisma.timetable.create({
            data: {
                businessId: parseInt(businessId),
                batchId: primaryBatchId,
                additionalBatchIds: additionalBatchIds,
                date: classDateSLT,
                subjectName,
                title,
                startTime,
                endTime,
                lecturerName
            }
        });

        // 🔥 1. Default System Timers Generation (හරිම ගණනය කිරීම) 🔥
        const templates = await prisma.taskTemplate.findMany({ where: { businessId: parseInt(businessId) } });
        const tasksToCreate = [];
        
        const defaultTemplates = [
            { taskType: 'LIVE_LINK', isRequired: true, deadlineHours: 1 }, 
            { taskType: 'TECH_DELIVERABLES', isRequired: true, deadlineHours: 2 }, 
            { taskType: 'RECORDING', isRequired: true, deadlineHours: 24 }, 
            { taskType: 'NOTES', isRequired: true, deadlineHours: 24 }      
        ];

        const finalTemplates = defaultTemplates.map(def => {
            const dbTpl = templates.find(t => t.taskType === def.taskType);
            return dbTpl || def; 
        });

        const isMCQ = optionalMCQ === true || optionalMCQ === 'true' || optionalMCQ === '1';
        const isPaper = optionalPaper === true || optionalPaper === 'true' || optionalPaper === '1';

        if (isMCQ) finalTemplates.push(templates.find(t => t.taskType === 'MCQ') || { taskType: 'MCQ', isRequired: true, deadlineHours: 48 });
        if (isPaper) finalTemplates.push(templates.find(t => t.taskType === 'STRUCTURED_PAPER') || { taskType: 'STRUCTURED_PAPER', isRequired: true, deadlineHours: 48 });

        for (const template of finalTemplates) {
            if (template.isRequired) {
                let deadline;
                const hoursInMs = parseFloat(template.deadlineHours || 0) * 60 * 60 * 1000;

                // 🔥 RULES FOR DEADLINES (පන්තියට කලින්ද? පස්සෙද? කියලා බලලා හදනවා) 🔥
                if (['RECORDING', 'MCQ', 'STRUCTURED_PAPER'].includes(template.taskType)) {
                    // පන්තිය ඉවර වුණාට පස්සේ (AFTER End Time)
                    // උදා: පන්තිය 10:00 ට ඉවරයි. පැය 24ක් දුන්නොත් පහුවදා 10:00 වෙනවා.
                    deadline = new Date(classEndDateTime.getTime() + hoursInMs);
                } else {
                    // පන්තිය පටන් ගන්න කලින් (BEFORE Start Time) - Live Links & Notes
                    // උදා: පන්තිය රෑ 8:00 යි. පැය 4ක් දුන්නොත් හවස 4:00 වෙනවා.
                    deadline = new Date(classStartDateTime.getTime() - hoursInMs);
                }

                tasksToCreate.push({ 
                    businessId: parseInt(businessId), 
                    batchId: primaryBatchId, 
                    additionalBatchIds: additionalBatchIds,
                    timetableId: newClass.id, 
                    taskType: template.taskType, 
                    deadline: deadline 
                });
            }
        }
        
        if (tasksToCreate.length > 0) await prisma.task.createMany({ data: tasksToCreate });

        // 🔥 2. AUTO-ALLOCATE CUSTOM TASKS (Linked to Timetable) 🔥
        try {
            const customLinkedTemplates = await prisma.customTaskTemplate.findMany({
                where: { businessId: parseInt(businessId), allocationType: 'CLASS_LINKED' }
            });

            for (const ct of customLinkedTemplates) {
                // Custom Task වල වෙලාවත් SLT වලින්ම හදනවා
                const customDeadline = parseSLTDate(date, ct.endTime);

                const mainCtTask = await prisma.task.create({
                    data: {
                        businessId: parseInt(businessId), batchId: primaryBatchId, additionalBatchIds: additionalBatchIds, timetableId: newClass.id,
                        taskType: "CUSTOM", customTitle: ct.title, customDesc: ct.description,
                        assignedTo: ct.autoAssignTo || null, status: ct.autoAssignTo ? "IN_PROGRESS" : "PENDING",
                        deadline: customDeadline
                    }
                });

                if (ct.subTasks) {
                    const subTasksArray = typeof ct.subTasks === 'string' ? JSON.parse(ct.subTasks) : ct.subTasks;
                    if (Array.isArray(subTasksArray) && subTasksArray.length > 0) {
                        const subsData = subTasksArray.map(sub => ({
                            businessId: parseInt(businessId), batchId: primaryBatchId, additionalBatchIds: additionalBatchIds, timetableId: newClass.id,
                            taskType: "CUSTOM", customTitle: sub.title, parentId: mainCtTask.id,
                            deadline: parseSLTDate(date, sub.endTime), status: "PENDING"
                        }));
                        await prisma.task.createMany({ data: subsData });
                    }
                }
            }
        } catch (err) { console.error("Failed to generate custom class linked tasks", err); }

        res.status(201).json(newClass);
    } catch (error) { 
        console.error("Timetable Creation Error:", error);
        res.status(500).json({ error: "Failed to schedule class" }); 
    }
};

exports.deleteSchedule = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.id;
        const userRole = req.user.role;
        const businessType = req.user.businessType;
        
        const roleUpper = userRole ? userRole.toUpperCase().replace(/[\s_-]+/g, '_') : '';
        const isAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER', 'ASS_MANAGER', 'ADMIN', 'PHYSICAL_MANAGER', 'SOCIAL_MEDIA_MANAGER', 'CALL_CENTER_SUPERVISOR'].includes(roleUpper) || roleUpper.includes('MANAG');
        
        const rawId = String(req.params.id);

        if (rawId.startsWith('content_')) {
            const contentId = parseInt(rawId.replace('content_', ''));
            await prisma.content.delete({ where: { id: contentId } });
            await prisma.contentCourse.deleteMany({ where: { content_id: contentId } });
            return res.status(200).json({ message: "Content class removed from schedule" });
        }

        const scheduleItem = await prisma.timetable.findUnique({ where: { id: parseInt(rawId) } });
        if (!scheduleItem) return res.status(404).json({ error: "Schedule not found" });
        
        if (!isAdmin) {
            const allBiz = await prisma.business.findMany();
            const userBizList = businessType ? String(businessType).split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
            const myBizs = allBiz.filter(biz => {
                const isManagerOf = (biz.head_manager_id && String(biz.head_manager_id) === String(userId)) ||
                                    (biz.ass_manager_id && String(biz.ass_manager_id) === String(userId));
                const matchesBizType = userBizList.some(b => 
                    b === String(biz.id) ||
                    b === biz.name.toLowerCase().trim() ||
                    biz.name.toLowerCase().trim().includes(b) ||
                    b.includes(biz.name.toLowerCase().trim())
                );
                return isManagerOf || matchesBizType;
            });
            const myBizIds = myBizs.map(b => b.id);
            if (!myBizIds.includes(scheduleItem.businessId)) {
                return res.status(403).json({ error: "Access Denied. You cannot delete schedule items for this business." });
            }
        }

        await prisma.timetable.delete({ where: { id: parseInt(rawId) } });
        res.status(200).json({ message: "Class removed from schedule" });
    } catch (error) {
        console.error("Delete timetable error:", error);
        res.status(500).json({ error: "Failed to delete schedule" });
    }
};

exports.updateSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const { subjectName, title, startTime, endTime, lecturerName, date, batchIds } = req.body;
        const userId = req.user.userId || req.user.id;
        const userRole = req.user.role;
        const roleUpper = userRole ? userRole.toUpperCase().replace(/[\s_-]+/g, '_') : '';
        const isAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER', 'ASS_MANAGER', 'ADMIN', 'PHYSICAL_MANAGER', 'SOCIAL_MEDIA_MANAGER', 'CALL_CENTER_SUPERVISOR'].includes(roleUpper) || roleUpper.includes('MANAG');

        const rawId = String(id);
        if (rawId.startsWith('content_')) {
            const contentId = parseInt(rawId.replace('content_', ''));
            await prisma.content.update({
                where: { id: contentId },
                data: {
                    title: subjectName || title,
                    startTime,
                    endTime
                }
            });
            return res.status(200).json({ message: "Content class updated" });
        }

        const scheduleItem = await prisma.timetable.findUnique({ where: { id: parseInt(rawId) } });
        if (!scheduleItem) return res.status(404).json({ error: "Schedule not found" });

        if (!isAdmin) {
            return res.status(403).json({ error: "Access Denied." });
        }

        let updateData = {};
        if (subjectName) updateData.subjectName = subjectName;
        if (title) updateData.title = title;
        if (startTime) updateData.startTime = startTime;
        if (endTime) updateData.endTime = endTime;
        if (lecturerName !== undefined) updateData.lecturerName = lecturerName;
        if (date) updateData.date = parseSLTDate(date, "00:00");

        if (batchIds && Array.isArray(batchIds) && batchIds.length > 0) {
            updateData.batchId = parseInt(batchIds[0]);
            updateData.additionalBatchIds = batchIds.length > 1 ? JSON.stringify(batchIds.slice(1).map(id => parseInt(id))) : null;
        }

        const updated = await prisma.timetable.update({
            where: { id: parseInt(rawId) },
            data: updateData,
            include: { hall: true, batch: true }
        });

        if (batchIds && Array.isArray(batchIds) && batchIds.length > 0) {
            await prisma.task.updateMany({
                where: { timetableId: parseInt(rawId) },
                data: {
                    batchId: parseInt(batchIds[0]),
                    additionalBatchIds: batchIds.length > 1 ? JSON.stringify(batchIds.slice(1).map(id => parseInt(id))) : null
                }
            });
        }

        res.status(200).json(updated);
    } catch (error) {
        console.error("Update timetable error:", error);
        res.status(500).json({ error: "Failed to update schedule" });
    }
};