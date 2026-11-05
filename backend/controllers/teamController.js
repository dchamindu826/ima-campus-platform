const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

exports.getCallers = async (req, res) => {
    try {
        const callers = await prisma.user.findMany({
            where: { role: 'CALLER' },
            select: { id: true, firstName: true, lastName: true, phone: true, createdAt: true }
        });
        res.status(200).json(callers);
    } catch (error) { res.status(500).json({ error: "Failed to fetch callers" }); }
};

exports.createCaller = async (req, res) => {
    try {
        const { firstName, lastName, phone, password } = req.body;
        const existingUser = await prisma.user.findUnique({ where: { phone } });
        if (existingUser) return res.status(400).json({ error: "Phone number already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newCaller = await prisma.user.create({
            data: { firstName, lastName, phone, password: hashedPassword, role: 'CALLER', department: 'Call Center' }
        });
        res.status(201).json({ message: "Caller added successfully", caller: newCaller });
    } catch (error) { res.status(500).json({ error: "Failed to create caller" }); }
};

exports.deleteCaller = async (req, res) => {
    try {
        await prisma.user.delete({ where: { id: parseInt(req.params.id) } });
        res.status(200).json({ message: "Caller deleted successfully" });
    } catch (error) { res.status(500).json({ error: "Failed to delete caller" }); }
};