const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

exports.getNotes = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const notes = await prisma.note.findMany({
            where: { userId: parseInt(userId) },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json(safeJson(notes));
    } catch (error) {
        console.error("Error fetching notes:", error);
        res.status(500).json({ error: "Failed to fetch notes" });
    }
};

exports.createNote = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { title, content } = req.body;
        if (!content) return res.status(400).json({ error: "Note content is required" });

        const newNote = await prisma.note.create({
            data: {
                userId: parseInt(userId),
                title: title || null,
                content: content
            }
        });

        res.status(201).json(safeJson(newNote));
    } catch (error) {
        console.error("Error creating note:", error);
        res.status(500).json({ error: "Failed to create note" });
    }
};

exports.updateNote = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { id } = req.params;
        const { title, content } = req.body;

        const existingNote = await prisma.note.findFirst({
            where: { id: parseInt(id), userId: parseInt(userId) }
        });

        if (!existingNote) return res.status(404).json({ error: "Note not found or unauthorized" });

        const updatedNote = await prisma.note.update({
            where: { id: parseInt(id) },
            data: {
                title: title !== undefined ? title : existingNote.title,
                content: content !== undefined ? content : existingNote.content
            }
        });

        res.status(200).json(safeJson(updatedNote));
    } catch (error) {
        console.error("Error updating note:", error);
        res.status(500).json({ error: "Failed to update note" });
    }
};

exports.deleteNote = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { id } = req.params;

        const existingNote = await prisma.note.findFirst({
            where: { id: parseInt(id), userId: parseInt(userId) }
        });

        if (!existingNote) return res.status(404).json({ error: "Note not found or unauthorized" });

        await prisma.note.delete({
            where: { id: parseInt(id) }
        });

        res.status(200).json({ message: "Note deleted successfully" });
    } catch (error) {
        console.error("Error deleting note:", error);
        res.status(500).json({ error: "Failed to delete note" });
    }
};
