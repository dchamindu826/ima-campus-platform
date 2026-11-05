const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper to format duration
function formatDuration(ms) {
    if (!ms || ms < 0) return '0 mins';
    const totalMinutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    const remMins = totalMinutes % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (remHours > 0 || days > 0) parts.push(`${remHours}h`);
    parts.push(`${remMins}m`);
    return parts.join(' ');
}

// ==========================================
// 1. CREATE DELEGATED TASK (By Business Manager)
// ==========================================
exports.createTask = async (req, res) => {
    try {
        const { title, description, businessId, dueDate, attachmentUrl, attachments, taskType } = req.body;
        const loggedUser = req.user || {};
        
        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Task title is required' });
        }

        let businessName = null;
        if (businessId) {
            const biz = await prisma.business.findUnique({ where: { id: parseInt(businessId) } });
            if (biz) businessName = biz.name;
        }

        const requesterName = `${loggedUser.firstName || ''} ${loggedUser.lastName || ''}`.trim() || `User #${loggedUser.id || 0}`;

        // Format attachments as JSON string if array, or use provided URL
        let finalAttachments = attachmentUrl || null;
        if (Array.isArray(attachments) && attachments.length > 0) {
            finalAttachments = JSON.stringify(attachments);
        }

        const initialHistory = [{
            stage: 'REQUESTED',
            stageLabel: 'Work Requested by Business Team',
            actor: requesterName,
            actorRole: loggedUser.role || 'Manager',
            timestamp: new Date().toISOString(),
            note: description || 'Work delegated to Social Media team',
            attachments: Array.isArray(attachments) ? attachments : (attachmentUrl ? [attachmentUrl] : [])
        }];

        const newTask = await prisma.socialMediaTask.create({
            data: {
                title: title.trim(),
                description: description || '',
                businessId: businessId ? parseInt(businessId) : null,
                businessName,
                requestedById: loggedUser.id || 1,
                requestedByName: requesterName,
                dueDate: dueDate ? new Date(dueDate) : null,
                attachmentUrl: finalAttachments,
                taskType: taskType === 'VIDEO' ? 'VIDEO' : 'POST',
                status: 'PENDING_APPROVAL',
                requestDate: new Date(),
                history: initialHistory
            }
        });

        return res.status(201).json({ message: 'Task delegated to Social Media team successfully!', task: newTask });
    } catch (error) {
        console.error('Error creating delegated social media task:', error);
        return res.status(500).json({ error: 'Failed to create delegated task' });
    }
};

// ==========================================
// 2. GET ALL DELEGATED TASKS
// ==========================================
exports.getTasks = async (req, res) => {
    try {
        const { status, businessId, taskType } = req.query;
        let whereClause = {};

        if (status) {
            if (status === 'ONGOING') {
                whereClause.status = { in: ['ASSIGNED', 'IN_PROGRESS', 'FINISHED_REVIEW', 'CORRECTION_REQUESTED'] };
            } else if (status === 'PENDING') {
                whereClause.status = 'PENDING_APPROVAL';
            } else if (status === 'COMPLETED') {
                whereClause.status = 'COMPLETED';
            } else if (status === 'CANCELLED' || status === 'REJECTED') {
                whereClause.status = { in: ['REJECTED', 'CANCELLED'] };
            } else {
                whereClause.status = status;
            }
        }
        if (businessId && businessId !== 'ALL') whereClause.businessId = parseInt(businessId);
        if (taskType && taskType !== 'ALL') whereClause.taskType = taskType;

        const tasks = await prisma.socialMediaTask.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' }
        });

        return res.status(200).json(tasks);
    } catch (error) {
        console.error('Error fetching social media tasks:', error);
        return res.status(500).json({ error: 'Failed to fetch tasks' });
    }
};

// ==========================================
// 3. APPROVE & ASSIGN TASK (By Social Media Manager)
// ==========================================
exports.approveAndAssignTask = async (req, res) => {
    try {
        const { taskId, assignedToId, dueDate, note } = req.body;
        const loggedUser = req.user || {};

        if (!taskId || !assignedToId) {
            return res.status(400).json({ error: 'Task ID and Assignee are required' });
        }

        const staffUser = await prisma.user.findUnique({
            where: { id: parseInt(assignedToId) }
        });

        if (!staffUser) {
            return res.status(404).json({ error: 'Assigned staff user not found' });
        }

        const assigneeName = `${staffUser.firstName} ${staffUser.lastName}`.trim();
        const managerName = `${loggedUser.firstName || ''} ${loggedUser.lastName || ''}`.trim() || 'Social Media Manager';

        const existingTask = await prisma.socialMediaTask.findUnique({
            where: { id: parseInt(taskId) }
        });

        if (!existingTask) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const now = new Date();
        let historyLogs = Array.isArray(existingTask.history) ? existingTask.history : [];
        historyLogs.push({
            stage: 'ASSIGNED',
            stageLabel: 'Task Approved & Handed Over to Editor',
            actor: managerName,
            actorRole: loggedUser.role || 'Social Media Manager',
            timestamp: now.toISOString(),
            note: note || `Approved and allocated to ${assigneeName}. Target deadline: ${dueDate ? new Date(dueDate).toLocaleDateString() : 'N/A'}`
        });

        const updatedTask = await prisma.socialMediaTask.update({
            where: { id: parseInt(taskId) },
            data: {
                status: 'ASSIGNED',
                assignedToId: parseInt(assignedToId),
                assignedToName: assigneeName,
                assignedDate: now,
                dueDate: dueDate ? new Date(dueDate) : existingTask.dueDate,
                history: historyLogs
            }
        });

        return res.status(200).json({ message: 'Task approved and assigned to editor successfully!', task: updatedTask });
    } catch (error) {
        console.error('Error assigning social media task:', error);
        return res.status(500).json({ error: 'Failed to assign task' });
    }
};

// ==========================================
// 4. REJECT / CANCEL TASK (By Social Media Manager)
// ==========================================
exports.rejectTask = async (req, res) => {
    try {
        const { taskId, reason } = req.body;
        const loggedUser = req.user || {};
        const managerName = `${loggedUser.firstName || ''} ${loggedUser.lastName || ''}`.trim() || 'Social Media Manager';

        if (!taskId) return res.status(400).json({ error: 'Task ID is required' });

        const existingTask = await prisma.socialMediaTask.findUnique({
            where: { id: parseInt(taskId) }
        });

        if (!existingTask) return res.status(404).json({ error: 'Task not found' });

        const now = new Date();
        let historyLogs = Array.isArray(existingTask.history) ? existingTask.history : [];
        historyLogs.push({
            stage: 'REJECTED',
            stageLabel: 'Task Rejected / Cancelled',
            actor: managerName,
            actorRole: loggedUser.role || 'Social Media Manager',
            timestamp: now.toISOString(),
            note: reason || 'Task rejected by Social Media Manager'
        });

        const updatedTask = await prisma.socialMediaTask.update({
            where: { id: parseInt(taskId) },
            data: {
                status: 'REJECTED',
                correctionNote: reason || 'Task Rejected',
                history: historyLogs
            }
        });

        return res.status(200).json({ message: 'Task rejected / cancelled successfully', task: updatedTask });
    } catch (error) {
        console.error('Error rejecting social media task:', error);
        return res.status(500).json({ error: 'Failed to reject task' });
    }
};

// ==========================================
// 5. UPDATE TASK STAGE & AUDIT TIMELINE
// ==========================================
exports.updateTaskStage = async (req, res) => {
    try {
        const { taskId, action, note, deliverableUrl } = req.body; 
        // action: 'START', 'FINISH_DRAFT', 'APPROVE_OK', 'REQUEST_CORRECTION', 'SUBMIT_CORRECTION', 'CANCEL'
        const loggedUser = req.user || {};
        const actorName = `${loggedUser.firstName || ''} ${loggedUser.lastName || ''}`.trim() || `User #${loggedUser.id || 0}`;

        const task = await prisma.socialMediaTask.findUnique({
            where: { id: parseInt(taskId) }
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        let updateData = {};
        let stageName = '';
        let stageLabel = '';
        let extraHistoryFields = {};
        const now = new Date();

        if (action === 'START') {
            stageName = 'IN_PROGRESS';
            stageLabel = 'Editing Work Started';
            updateData = { status: 'IN_PROGRESS', startedDate: now };
        } else if (action === 'FINISH_DRAFT') {
            stageName = 'FINISHED_REVIEW';
            stageLabel = 'Work Completed by Editor (Sent to Business for Review) 🔔';
            updateData = { 
                status: 'FINISHED_REVIEW', 
                finishedDate: now,
                attachmentUrl: deliverableUrl ? deliverableUrl : task.attachmentUrl
            };
            if (deliverableUrl) extraHistoryFields.deliverableUrl = deliverableUrl;
        } else if (action === 'APPROVE_OK') {
            stageName = 'COMPLETED';
            stageLabel = 'Work Verified, Approved & Completed ✅';
            updateData = { status: 'COMPLETED', completedDate: now };
        } else if (action === 'REQUEST_CORRECTION') {
            stageName = 'CORRECTION_REQUESTED';
            stageLabel = 'Correction / Revision Requested 🔄';
            updateData = { 
                status: 'CORRECTION_REQUESTED', 
                correctionRequestedDate: now,
                correctionNote: note || 'Correction requested by manager'
            };
        } else if (action === 'SUBMIT_CORRECTION') {
            stageName = 'FINISHED_REVIEW';
            stageLabel = 'Correction Completed & Re-submitted 🚀';
            
            // Calculate time spent in this correction cycle
            let correctionDurationMs = 0;
            let correctionDurationText = '';
            if (task.correctionRequestedDate) {
                correctionDurationMs = now.getTime() - new Date(task.correctionRequestedDate).getTime();
                correctionDurationText = formatDuration(correctionDurationMs);
                extraHistoryFields.correctionDurationMs = correctionDurationMs;
                extraHistoryFields.correctionDurationText = correctionDurationText;
            }

            updateData = { 
                status: 'FINISHED_REVIEW', 
                correctionCompletedDate: now,
                attachmentUrl: deliverableUrl ? deliverableUrl : task.attachmentUrl
            };
            if (deliverableUrl) extraHistoryFields.deliverableUrl = deliverableUrl;
        } else if (action === 'CANCEL') {
            stageName = 'CANCELLED';
            stageLabel = 'Task Cancelled';
            updateData = { status: 'CANCELLED' };
        } else {
            return res.status(400).json({ error: 'Invalid stage action' });
        }

        let historyLogs = Array.isArray(task.history) ? task.history : [];
        historyLogs.push({
            stage: stageName,
            stageLabel,
            actor: actorName,
            actorRole: loggedUser.role || 'Staff',
            timestamp: now.toISOString(),
            note: note || stageLabel,
            ...extraHistoryFields
        });

        updateData.history = historyLogs;

        const updatedTask = await prisma.socialMediaTask.update({
            where: { id: parseInt(taskId) },
            data: updateData
        });

        return res.status(200).json({ 
            message: action === 'FINISH_DRAFT' 
                ? 'Work marked as completed! Notification sent to the Business team for review.' 
                : 'Task stage updated successfully!', 
            task: updatedTask 
        });
    } catch (error) {
        console.error('Error updating task stage:', error);
        return res.status(500).json({ error: 'Failed to update task stage' });
    }
};

// ==========================================
// 6. GET SOCIAL MEDIA STAFF / EDITORS LIST
// ==========================================
exports.getSocialMediaStaff = async (req, res) => {
    try {
        const staff = await prisma.user.findMany({
            where: {
                OR: [
                    { department: 'Social Media' },
                    { role: { in: ['SOCIAL_MEDIA_STAFF', 'SOCIAL MEDIA STAFF', 'Social Media Staff', 'SOCIAL_MEDIA_MANAGER', 'SOCIAL MEDIA MANAGER', 'Social Media Manager', 'Editor', 'Video Editor', 'Graphic Designer'] } }
                ],
                role: { notIn: ['Student', 'STUDENT', 'USER', 'user'] }
            },
            select: { id: true, firstName: true, lastName: true, role: true, department: true, image: true, phone: true }
        });

        // Fallback: If no staff explicitly in Social Media department, include all staff members
        if (!staff || staff.length === 0) {
            const allStaff = await prisma.user.findMany({
                where: {
                    role: { notIn: ['Student', 'STUDENT', 'USER', 'user'] }
                },
                select: { id: true, firstName: true, lastName: true, role: true, department: true, image: true, phone: true },
                take: 20
            });
            return res.status(200).json(allStaff);
        }

        return res.status(200).json(staff);
    } catch (error) {
        console.error('Error fetching social media staff:', error);
        return res.status(500).json({ error: 'Failed to fetch staff' });
    }
};

// ==========================================
// 7. CALENDAR POST CRUD
// ==========================================
exports.createCalendarPost = async (req, res) => {
    try {
        const { title, description, imageUrl, scheduledDate } = req.body;
        const loggedUser = req.user || {};

        if (!title || !scheduledDate) {
            return res.status(400).json({ error: 'Title and scheduled date are required' });
        }

        const newPost = await prisma.socialMediaCalendarPost.create({
            data: {
                title,
                description: description || '',
                imageUrl: imageUrl || null,
                scheduledDate: new Date(scheduledDate),
                createdById: loggedUser.id || null
            }
        });

        return res.status(201).json({ message: 'Calendar post created successfully!', post: newPost });
    } catch (error) {
        console.error('Error creating calendar post:', error);
        return res.status(500).json({ error: 'Failed to create calendar post' });
    }
};

exports.getCalendarPosts = async (req, res) => {
    try {
        const posts = await prisma.socialMediaCalendarPost.findMany({
            orderBy: { scheduledDate: 'asc' }
        });
        return res.status(200).json(posts);
    } catch (error) {
        console.error('Error fetching calendar posts:', error);
        return res.status(500).json({ error: 'Failed to fetch calendar posts' });
    }
};

exports.deleteCalendarPost = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.socialMediaCalendarPost.delete({
            where: { id: parseInt(id) }
        });
        return res.status(200).json({ message: 'Calendar post deleted successfully' });
    } catch (error) {
        console.error('Error deleting calendar post:', error);
        return res.status(500).json({ error: 'Failed to delete calendar post' });
    }
};

