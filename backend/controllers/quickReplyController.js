const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get Quick Replies for the logged-in user
exports.getQuickReplies = async (req, res) => {
    try {
        const userId = parseInt(req.user?.userId || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const replies = await prisma.quickReply.findMany({
            where: { userId: userId },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json(replies);
    } catch (error) {
        console.error("Error fetching quick replies:", error);
        res.status(500).json({ error: "Failed to fetch quick replies" });
    }
};

// Create a new Quick Reply
exports.createQuickReply = async (req, res) => {
    try {
        const userId = parseInt(req.user?.userId || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { name, message, attachment } = req.body;

        if (!name || (!message && !attachment)) {
            return res.status(400).json({ error: "Name and either message or attachment are required" });
        }

        const reply = await prisma.quickReply.create({
            data: {
                userId,
                name: name.replace('/', ''),
                message,
                attachment
            }
        });

        res.status(201).json(reply);
    } catch (error) {
        console.error("Error creating quick reply:", error);
        res.status(500).json({ error: "Failed to create quick reply. File might be too large." });
    }
};

// Delete a Quick Reply
exports.deleteQuickReply = async (req, res) => {
    try {
        const userId = parseInt(req.user?.userId || req.user?.id);
        const replyId = parseInt(req.params.id);

        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        // Ensure the reply belongs to the user
        const reply = await prisma.quickReply.findUnique({ where: { id: replyId } });
        if (!reply || reply.userId !== userId) {
            return res.status(404).json({ error: "Quick reply not found" });
        }

        await prisma.quickReply.delete({ where: { id: replyId } });

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error deleting quick reply:", error);
        res.status(500).json({ error: "Failed to delete quick reply" });
    }
};
