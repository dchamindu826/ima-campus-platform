const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');

exports.createReminder = async (req, res) => {
    try {
        const { leadId, agentId, leadType, phone, name, round, phase, remindAt, note, isPersonal, isRepeat, repeatTime } = req.body;
        
        if (!agentId) return res.status(400).json({ error: "Agent ID is required" });

        const reminder = await prisma.reminder.create({
            data: {
                leadId: leadId && !isNaN(parseInt(leadId)) ? parseInt(leadId) : null,
                agentId: parseInt(agentId), // 🔥 දැන් මේක කෙලින්ම Frontend එකෙන් ගන්නවා
                leadType: leadType || null,
                phone: phone || null,
                name: name || null,
                round: round && !isNaN(parseInt(round)) ? parseInt(round) : 1,
                phase: phase && !isNaN(parseInt(phase)) ? parseInt(phase) : 1,
                remindAt: new Date(remindAt),
                note,
                isPersonal: isPersonal || false,
                isRepeat: isRepeat || false,
                repeatTime: repeatTime || null
            }
        });

        res.status(201).json({ message: "Reminder created successfully", reminder });
    } catch (error) {
        console.error("Create Reminder Error:", error);
        res.status(500).json({ error: "Failed to create reminder" });
    }
};

exports.getMyReminders = async (req, res) => {
    try {
        const agentId = req.query.agentId; 
        const status = req.query.status; // 'active', 'completed', 'all'
        if (!agentId) return res.status(400).json({ error: "Agent ID is required" });

        let where = { agentId: parseInt(agentId) };
        if (status === 'completed') {
            where.isCompleted = true;
        } else if (status !== 'all') {
            where.isCompleted = false;
        }

        const reminders = await prisma.reminder.findMany({
            where,
            orderBy: { remindAt: status === 'completed' ? 'desc' : 'asc' }
        });
        res.status(200).json(reminders);
    } catch (error) {
        console.error("Get Reminders Error:", error);
        res.status(500).json({ error: "Failed to fetch reminders" });
    }
};

// Reminder එකක් Done (Complete) කිරීම
exports.markAsDone = async (req, res) => {
    try {
        const { reminderId } = req.body;
        
        if (!reminderId) return res.status(400).json({ error: "Reminder ID missing" });

        // Database එකේ ඒ ID එක තියෙනවද කියලා ඉස්සෙල්ලා බලනවා
        const existing = await prisma.reminder.findUnique({
            where: { id: parseInt(reminderId) }
        });

        // ඒක දැනටමත් මැකිලා නම්, Error ගහන්නෙ නැතුව Success කියලා යවනවා (එතකොට Widget එකෙන් අයින් වෙලා යනවා)
        if (!existing) {
            return res.status(200).json({ message: "Already removed or not found" });
        }

        if (existing.isRepeat) {
            const nextDate = new Date(existing.remindAt);
            nextDate.setDate(nextDate.getDate() + 1);
            
            await prisma.reminder.update({
                where: { id: parseInt(reminderId) },
                data: { remindAt: nextDate }
            });
            return res.status(200).json({ message: "Reminder scheduled for tomorrow" });
        }

        // තියෙනවා නම් Update කරනවා
        await prisma.reminder.update({
            where: { id: parseInt(reminderId) },
            data: { isCompleted: true }
        });

        res.status(200).json({ message: "Reminder marked as completed" });
    } catch (error) {
        console.error("Mark Reminder Error:", error);
        res.status(500).json({ error: "Failed to update reminder" });
    }
};

// 🔥 අලුත්: Reminder එක Edit කිරීම 🔥
exports.editReminder = async (req, res) => {
    try {
        const { reminderId, remindAt, note, isPersonal, isRepeat, repeatTime } = req.body;
        const dataToUpdate = { remindAt: new Date(remindAt), note };
        
        if (isPersonal !== undefined) dataToUpdate.isPersonal = isPersonal;
        if (isRepeat !== undefined) dataToUpdate.isRepeat = isRepeat;
        if (repeatTime !== undefined) dataToUpdate.repeatTime = repeatTime;

        const reminder = await prisma.reminder.update({
            where: { id: parseInt(reminderId) },
            data: dataToUpdate
        });
        res.status(200).json({ message: "Reminder updated successfully", reminder });
    } catch (error) {
        console.error("Edit Reminder Error:", error);
        res.status(500).json({ error: "Failed to update reminder" });
    }
};

// 🔥 අලුත්: Reminder එක සම්පූර්ණයෙන්ම Delete කිරීම 🔥
exports.deleteReminder = async (req, res) => {
    try {
        const { reminderId } = req.params;
        await prisma.reminder.delete({
            where: { id: parseInt(reminderId) }
        });
        res.status(200).json({ message: "Reminder deleted successfully" });
    } catch (error) {
        console.error("Delete Reminder Error:", error);
        res.status(500).json({ error: "Failed to delete reminder" });
    }
};