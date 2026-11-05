const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');

// Get all zoom accounts
exports.getAllZoomAccounts = async (req, res) => {
    try {
        const accounts = await prisma.zoomAccount.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(accounts);
    } catch (error) {
        console.error("Error fetching Zoom Accounts:", error);
        res.status(500).json({ error: "Failed to fetch Zoom Accounts." });
    }
};

// Create a new zoom account
exports.createZoomAccount = async (req, res) => {
    try {
        const { name, accountId, clientId, clientSecret, isActive } = req.body;
        
        if (!name || !accountId || !clientId || !clientSecret) {
            return res.status(400).json({ error: "All fields are required." });
        }

        const newAccount = await prisma.zoomAccount.create({
            data: {
                name,
                accountId,
                clientId,
                clientSecret,
                isActive: isActive !== undefined ? isActive : true
            }
        });

        res.status(201).json({ message: "Zoom account added successfully", account: newAccount });
    } catch (error) {
        console.error("Error creating Zoom Account:", error);
        res.status(500).json({ error: "Failed to create Zoom Account." });
    }
};

// Update an existing zoom account
exports.updateZoomAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, accountId, clientId, clientSecret, isActive } = req.body;

        const updatedAccount = await prisma.zoomAccount.update({
            where: { id: parseInt(id) },
            data: {
                name,
                accountId,
                clientId,
                clientSecret,
                isActive
            }
        });

        res.status(200).json({ message: "Zoom account updated successfully", account: updatedAccount });
    } catch (error) {
        console.error("Error updating Zoom Account:", error);
        res.status(500).json({ error: "Failed to update Zoom Account." });
    }
};

// Delete a zoom account
exports.deleteZoomAccount = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.zoomAccount.delete({
            where: { id: parseInt(id) }
        });
        res.status(200).json({ message: "Zoom account deleted successfully." });
    } catch (error) {
        console.error("Error deleting Zoom Account:", error);
        res.status(500).json({ error: "Failed to delete Zoom Account." });
    }
};
