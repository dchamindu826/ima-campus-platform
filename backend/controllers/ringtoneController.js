const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');

const RINGTONE_DIR = path.join(__dirname, '../../storage/ringtone');

// Ensure directory exists
if (!fs.existsSync(RINGTONE_DIR)) {
    fs.mkdirSync(RINGTONE_DIR, { recursive: true });
}

exports.getRingtones = async (req, res) => {
    try {
        const files = fs.readdirSync(RINGTONE_DIR).filter(f => f.endsWith('.mp3'));
        
        // Find which business uses which ringtone
        const businesses = await prisma.business.findMany({
            select: { id: true, name: true, ringtone: true }
        });

        const ringtones = files.map(file => {
            const usedBy = businesses.find(b => b.ringtone === file);
            return {
                name: file,
                url: `/storage/ringtone/${file}`,
                usedBy: usedBy ? { id: usedBy.id, name: usedBy.name } : null
            };
        });

        res.json(ringtones);
    } catch (error) {
        console.error("Error getting ringtones:", error);
        res.status(500).json({ error: "Failed to get ringtones" });
    }
};

exports.uploadRingtone = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        res.json({ message: 'Ringtone uploaded successfully', filename: req.file.filename });
    } catch (error) {
        console.error("Error uploading ringtone:", error);
        res.status(500).json({ error: "Failed to upload ringtone" });
    }
};

exports.assignRingtone = async (req, res) => {
    try {
        console.log("assignRingtone payload:", req.body);
        const { businessId, ringtoneName } = req.body;
        
        if (!businessId || !ringtoneName) {
            return res.status(400).json({ error: "Missing businessId or ringtoneName", received: req.body });
        }

        // Check if ringtone exists
        if (!fs.existsSync(path.join(RINGTONE_DIR, ringtoneName))) {
            return res.status(404).json({ error: "Ringtone file not found" });
        }

        await prisma.business.update({
            where: { id: parseInt(businessId) },
            data: { ringtone: ringtoneName }
        });

        res.json({ message: "Ringtone assigned successfully" });
    } catch (error) {
        console.error("Error assigning ringtone:", error);
        res.status(500).json({ error: "Failed to assign ringtone" });
    }
};
