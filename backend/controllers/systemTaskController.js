const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');

// Helper to convert objects safely (including BigInt if any)
const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

// 1. Staff submissions of feedback / tasks / issues
exports.createStaffTask = async (req, res) => {
    try {
        const { topic, description } = req.body;
        
        if (!topic || !description) {
            return res.status(400).json({ error: "Topic and Description are required." });
        }

        const userId = req.user?.userId || req.user?.id;
        const user = await prisma.user.findUnique({
            where: { id: parseInt(userId) }
        });

        if (!user) {
            return res.status(404).json({ error: "Staff member not found." });
        }

        // Handle image attachments
        const imageNames = req.files && req.files.length > 0
            ? req.files.map(f => f.filename)
            : [];
        const images = JSON.stringify(imageNames);

        const newSystemTask = await prisma.systemTask.create({
            data: {
                topic,
                description,
                images,
                status: 'PENDING',
                staffId: user.id,
                staffName: `${user.firstName} ${user.lastName}`,
                department: user.department || "Other",
                businessName: user.businessType || "None"
            }
        });

        res.status(201).json(safeJson({
            message: "Issue reported successfully!",
            task: newSystemTask
        }));
    } catch (error) {
        console.error("Error creating staff task:", error);
        res.status(500).json({ error: "Failed to report issue. Server error." });
    }
};

// 2. Admin retrieving tasks with filtering, date history, and pagination
exports.getAdminTasks = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status; // Optional PENDING or RESOLVED
        const startDate = req.query.startDate; // Optional YYYY-MM-DD
        const endDate = req.query.endDate; // Optional YYYY-MM-DD
        const skip = (page - 1) * limit;

        const where = {};
        if (status) {
            where.status = status;
        }

        // Add date range filtering if provided
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                where.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
            }
            if (endDate) {
                where.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
            }
        }

        const totalTasks = await prisma.systemTask.count({ where });
        const tasks = await prisma.systemTask.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        });

        res.status(200).json(safeJson({
            tasks,
            pagination: {
                total: totalTasks,
                page,
                limit,
                pages: Math.ceil(totalTasks / limit)
            }
        }));
    } catch (error) {
        console.error("Error fetching admin tasks:", error);
        res.status(500).json({ error: "Failed to fetch system tasks." });
    }
};

// 3. Admin updates task remark and status (PENDING / RESOLVED)
exports.updateAdminTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, remark } = req.body;

        if (!status) {
            return res.status(400).json({ error: "Status is required." });
        }

        const updatedTask = await prisma.systemTask.update({
            where: { id: parseInt(id) },
            data: {
                status,
                remark: remark || null
            }
        });

        res.status(200).json(safeJson({
            message: "Task updated successfully",
            task: updatedTask
        }));
    } catch (error) {
        console.error("Error updating admin task:", error);
        res.status(500).json({ error: "Failed to update task. Server error." });
    }
};

// 4. Admin manual task creation
exports.createAdminTask = async (req, res) => {
    try {
        const { topic, description } = req.body;

        if (!topic || !description) {
            return res.status(400).json({ error: "Topic and Description are required." });
        }

        const userId = req.user?.userId || req.user?.id;
        const user = await prisma.user.findUnique({
            where: { id: parseInt(userId) }
        });

        // Handle image attachments
        const imageNames = req.files && req.files.length > 0
            ? req.files.map(f => f.filename)
            : [];
        const images = JSON.stringify(imageNames);

        const newAdminTask = await prisma.systemTask.create({
            data: {
                topic,
                description,
                images,
                status: 'PENDING',
                staffId: user?.id || null,
                staffName: user ? `${user.firstName} ${user.lastName}` : "System Admin",
                department: user?.department || "Administration",
                businessName: user?.businessType || "All"
            }
        });

        res.status(201).json(safeJson({
            message: "Admin manual task created successfully",
            task: newAdminTask
        }));
    } catch (error) {
        console.error("Error in createAdminTask:", error);
        res.status(500).json({ error: "Failed to create manual task." });
    }
};

// 5. Get pending task counts (for floating widget notification)
exports.getPendingTasksCount = async (req, res) => {
    try {
        const userId = parseInt(req.user?.userId || req.user?.id);
        const role = req.user?.role || '';
        const isAdmin = ['SYSTEM_ADMIN', 'SYSTEM ADMIN', 'Director', 'DIRECTOR', 'ADMIN', 'SUPER'].includes(role.toUpperCase());

        let where = { status: 'PENDING' };
        if (!isAdmin) {
            // Non-admin staff only see counts of their own reported pending tasks
            where.staffId = userId;
        }

        const count = await prisma.systemTask.count({ where });
        res.status(200).json({ count });
    } catch (error) {
        console.error("Error in getPendingTasksCount:", error);
        res.status(500).json({ error: "Failed to get pending tasks count." });
    }
};
