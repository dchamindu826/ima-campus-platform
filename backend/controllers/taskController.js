const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');

// SLT time conversion helper
const getSLTDate = (timeString) => {
    if (!timeString) return null;
    const today = new Date();
    const [hours, minutes] = timeString.split(':');
    today.setHours(parseInt(hours) + 5, parseInt(minutes) + 30, 0, 0); // Adjusted for SLT
    return today;
};

exports.getTasks = async (req, res) => {
    try {
        const { businessId, batchId, status, assignedTo, role } = req.query;
        
        const userId = req.user.userId || req.user.id;
        const userRole = req.user.role;
        const businessType = req.user.businessType;
        
        const roleUpper = userRole ? userRole.toUpperCase().replace(/ /g, '_') : '';
        const isAdmin = ['SYSTEM_ADMIN', 'DIRECTOR'].includes(roleUpper);
        
        let allowedBizIds = null;
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
            allowedBizIds = myBizs.map(b => b.id);
        }

        let whereClause = { parentId: null }; 

        if (businessId) {
            const parsedBizId = parseInt(businessId);
            if (allowedBizIds && !allowedBizIds.includes(parsedBizId)) {
                return res.status(403).json({ error: "Access Denied. You are not allowed to view tasks for this business." });
            }
            whereClause.businessId = parsedBizId;
        } else if (allowedBizIds) {
            whereClause.businessId = { in: allowedBizIds };
        }
        if (batchId) whereClause.batchId = parseInt(batchId);
        if (status) whereClause.status = status;
        
        if (role && role.toUpperCase() === 'COORDINATOR' && assignedTo) {
             whereClause.assignedTo = parseInt(assignedTo);
        } else if (assignedTo) {
             whereClause.assignedTo = parseInt(assignedTo);
        }

        const tasks = await prisma.task.findMany({
            where: whereClause,
            include: {
                timetable: true,
                subTasks: { orderBy: { id: 'asc' } },
                assignedUser: { select: { id: true, firstName: true, lastName: true } },
                business: { select: { id: true, name: true } },
                batch: { select: { id: true, name: true } },
                content: true // Include created content for Manager Overview
            },
            orderBy: { createdAt: 'desc' }
        });

        const now = new Date();
        const tasksWithTime = tasks.map(task => {
            let isOverdue = false;
            let timeDiff = null;
            let finalStatus = task.status;

            if (task.deadline) {
                const deadline = new Date(task.deadline);
                timeDiff = deadline.getTime() - now.getTime();
                isOverdue = timeDiff < 0 && task.status !== 'COMPLETED';
                
                if (isOverdue && (task.status === 'PENDING' || task.status === 'IN_PROGRESS')) {
                    finalStatus = 'LOCKED';
                }
            }

            const processedSubTasks = task.subTasks.map(sub => {
                let subOverdue = false;
                if(sub.deadline){
                     subOverdue = new Date(sub.deadline).getTime() - now.getTime() < 0 && sub.status !== 'COMPLETED';
                }
                return { ...sub, status: sub.status, isOverdue: subOverdue };
            });

            return {
                ...task,
                subTasks: processedSubTasks,
                status: finalStatus,
                isOverdue,
                timeRemainingMs: timeDiff
            };
        });

        res.status(200).json(tasksWithTime);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch tasks" });
    }
};

exports.assignTask = async (req, res) => {
    try {
        const { taskId, assignedTo } = req.body;
        const updatedTask = await prisma.task.update({
            where: { id: parseInt(taskId) },
            data: { assignedTo: parseInt(assignedTo), status: "IN_PROGRESS" }
        });
        await prisma.task.updateMany({
            where: { parentId: parseInt(taskId) },
            data: { assignedTo: parseInt(assignedTo), status: "IN_PROGRESS" }
        });
        res.status(200).json({ message: "Task Assigned", task: updatedTask });
    } catch (error) { res.status(500).json({ error: "Failed to assign task" }); }
};

exports.requestUnlock = async (req, res) => {
    try {
        const { taskId, reason } = req.body;
        const updatedTask = await prisma.task.update({
            where: { id: parseInt(taskId) },
            data: { status: "REQ_UNLOCK", unlockReason: reason }
        });
        res.status(200).json({ message: "Unlock request sent", task: updatedTask });
    } catch (error) { res.status(500).json({ error: "Failed to request unlock" }); }
};

exports.approveUnlock = async (req, res) => {
    try {
        const { taskId, additionalHours, managerId } = req.body;
        const hoursNum = parseInt(additionalHours);
        const validHours = (!isNaN(hoursNum) && hoursNum > 0) ? hoursNum : 12;
        const newDeadline = new Date(Date.now() + validHours * 60 * 60 * 1000);
        
        const updatedTask = await prisma.task.update({
            where: { id: parseInt(taskId) },
            data: { 
                status: "IN_PROGRESS", 
                isUnlocked: true, 
                unlockedBy: managerId ? parseInt(managerId) : null,
                deadline: newDeadline, 
                unlockReason: null 
            }
        });
        
        // Also update any subtasks under this parent task
        await prisma.task.updateMany({
            where: { parentId: parseInt(taskId) },
            data: { 
                status: "IN_PROGRESS", 
                isUnlocked: true, 
                deadline: newDeadline 
            }
        });

        res.status(200).json({ message: "Task Unlocked", task: updatedTask });
    } catch (error) { 
        console.error("Error unlocking task:", error);
        res.status(500).json({ error: "Failed to unlock task" }); 
    }
};

exports.getTaskTemplates = async (req, res) => {
    try {
        const templates = await prisma.taskTemplate.findMany({ where: { businessId: parseInt(req.params.businessId) } });
        res.status(200).json(templates);
    } catch (error) { res.status(500).json({ error: "Failed to fetch templates" }); }
};

exports.saveTaskTemplates = async (req, res) => {
    try {
         const { businessId, templates } = req.body;
         const upsertPromises = templates.map(t => 
             prisma.taskTemplate.upsert({
                 where: { businessId_taskType: { businessId: parseInt(businessId), taskType: t.taskType } },
                 update: { deadlineHours: parseInt(t.deadlineHours), isRequired: t.isRequired },
                 create: { businessId: parseInt(businessId), taskType: t.taskType, deadlineHours: parseInt(t.deadlineHours), isRequired: t.isRequired }
             })
         );
         await Promise.all(upsertPromises);
         res.status(200).json({ message: "Templates saved" });
    } catch (error) { res.status(500).json({ error: "Failed to save templates" }); }
};

exports.completeTask = async (req, res) => {
    try {
        const { taskId, contentId } = req.body;
        const updatedTask = await prisma.task.update({
            where: { id: parseInt(taskId) },
            data: { status: "COMPLETED", completedAt: new Date(), contentId: parseInt(contentId) },
            include: { content: true }
        });

        // 🔥 TECHNICAL DEPARTMENT SYNC: Update Timetable Delivery Status
        if (updatedTask.timetableId) {
            if (updatedTask.taskType === 'LIVE_LINK' && updatedTask.content) {
                const linkToSync = updatedTask.content.link || updatedTask.content.youtubeLink || updatedTask.content.meetingId || "Delivered (Check Content)";
                await prisma.timetable.update({
                    where: { id: updatedTask.timetableId },
                    data: { 
                        liveLink: linkToSync,
                        deliveryStatus: "DELIVERED"
                    }
                });
            } else if (updatedTask.taskType === 'NOTES') {
                // If notes are delivered, we can just update status if it's still pending
                await prisma.timetable.update({
                    where: { id: updatedTask.timetableId, deliveryStatus: "PENDING" },
                    data: { deliveryStatus: "DELIVERED" }
                }).catch(() => {}); // ignore if already delivered or not found
            }
        }

        res.status(200).json({ message: "Task completed", task: updatedTask });
    } catch (error) { 
        console.error("Task Complete Error:", error);
        res.status(500).json({ error: "Failed to complete task" }); 
    }
};

exports.rejectTask = async (req, res) => {
    try {
        const { taskId, reason } = req.body;
        const task = await prisma.task.findUnique({ where: { id: parseInt(taskId) } });
        if (!task) return res.status(404).json({ error: "Task not found" });

        if (task.contentId) {
            await prisma.content.delete({ where: { id: task.contentId } }).catch(()=>console.log("Content already deleted"));
        }

        // NOTE: a "-1 KPI mark on rejection" was intended here, but there is no StaffKpi
        // table in the database, so it never saved anything. Add the table first if needed.

        await prisma.task.update({
            where: { id: parseInt(taskId) },
            data: { status: "PENDING", completedAt: null, contentId: null, proofUrl: null }
        });

        res.status(200).json({ message: "Task rejected & negative KPI logged." });
    } catch (error) { 
        res.status(500).json({ error: "Failed to reject task" }); 
    }
};

exports.createCustomTask = async (req, res) => {
    try {
        const { businessId, customTitle, customDesc, subTasks } = req.body;

        const mainTask = await prisma.task.create({
            data: { businessId: parseInt(businessId), taskType: "CUSTOM", customTitle, customDesc }
        });

        if (subTasks && subTasks.length > 0) {
            const subTaskData = subTasks.map(sub => ({
                businessId: parseInt(businessId), taskType: "CUSTOM", customTitle: sub.title,
                parentId: mainTask.id, deadline: getSLTDate(sub.endTime)
            }));
            await prisma.task.createMany({ data: subTaskData });
        }

        res.status(201).json({ message: "Custom Task Created" });
    } catch (error) { res.status(500).json({ error: "Failed to create custom task" }); }
};

exports.completeCustomTask = async (req, res) => {
    try {
        const { taskId } = req.body;
        let proofUrl = null;
        let proofType = null;

        if (req.file) {
            proofUrl = req.file.filename;
            proofType = req.file.mimetype.includes('pdf') ? 'pdf' : 'image';
        }

        await prisma.task.update({
            where: { id: parseInt(taskId) },
            data: { status: "COMPLETED", completedAt: new Date(), proofUrl, proofType }
        });

        const task = await prisma.task.findUnique({ where: { id: parseInt(taskId) }});
        if (task.parentId) {
            const pendingSiblings = await prisma.task.count({
                where: { parentId: task.parentId, status: { not: "COMPLETED" } }
            });
            if (pendingSiblings === 0) {
                await prisma.task.update({
                    where: { id: task.parentId },
                    data: { status: "COMPLETED", completedAt: new Date() }
                });
            }
        }

        res.status(200).json({ message: "Custom Task Completed" });
    } catch (error) { res.status(500).json({ error: "Failed to complete custom task" }); }
};

exports.completeTechnicalDeliverables = async (req, res) => {
    try {
        const { taskId, liveLink, notes } = req.body;
        let attachmentUrl = null;

        if (req.file) {
            attachmentUrl = req.file.filename;
        }

        // We will store the form data in the task's customDesc or create a Content record if needed.
        // The most straightforward way is to save it in customDesc as a JSON string so the Tech Dept can read it,
        // OR save the proofUrl as attachmentUrl, and customDesc as a JSON of { liveLink, notes }.

        const updatedTask = await prisma.task.update({
            where: { id: parseInt(taskId) },
            data: { 
                status: "COMPLETED", 
                completedAt: new Date(), 
                proofUrl: attachmentUrl, 
                proofType: req.file ? (req.file.mimetype.includes('pdf') ? 'pdf' : 'image') : null,
                customDesc: JSON.stringify({ liveLink, notes })
            }
        });

        if (updatedTask.timetableId) {
            await prisma.timetable.update({
                where: { id: updatedTask.timetableId },
                data: { 
                    liveLink: liveLink,
                    deliveryStatus: "DELIVERED"
                }
            });
        }

        res.status(200).json({ message: "Technical Deliverables Completed" });
    } catch (error) { 
        console.error("Tech Deliverables Error:", error);
        res.status(500).json({ error: "Failed to complete tech deliverables" }); 
    }
};

// ================= CUSTOM TASK TEMPLATE CONTROLLERS =================

exports.getCustomTaskTemplates = async (req, res) => {
    try {
        const templates = await prisma.customTaskTemplate.findMany({
            where: { businessId: parseInt(req.params.businessId) }
        });
        res.status(200).json(templates);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch custom templates" });
    }
};

// taskController.js eke athule thiyena:

exports.saveCustomTaskTemplate = async (req, res) => {
    try {
        const { id, businessId, title, description, dayOfMonth, allocationType, autoAssignTo, subTasks } = req.body;
        
        const data = {
            business: { connect: { id: parseInt(businessId) } },
            title,
            description,
            dayOfMonth: dayOfMonth ? parseInt(dayOfMonth) : null,
            startTime: "", 
            endTime: "",   
            allocationType: allocationType || 'MANUAL',
            subTasks: subTasks && subTasks.length > 0 ? JSON.stringify(subTasks) : null
        };

        // 👇 autoAssignTo eka relation eken connect kireema 👇
        if (autoAssignTo) {
            data.assignedUser = { connect: { id: parseInt(autoAssignTo) } };
        } else if (id) {
            // Update ekedi user assign nokara thiyanawanam (remove karanna oni nam)
            data.assignedUser = { disconnect: true };
        }
        // 👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆

        let template;
        if (id) {
            template = await prisma.customTaskTemplate.update({ where: { id: parseInt(id) }, data });
        } else {
            template = await prisma.customTaskTemplate.create({ data });
        }

        res.status(200).json({ message: "Template saved successfully", template });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to save template" });
    }
};

exports.deleteCustomTaskTemplate = async (req, res) => {
    try {
        await prisma.customTaskTemplate.delete({ where: { id: parseInt(req.params.id) } });
        res.status(200).json({ message: "Template deleted" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete template" });
    }
};