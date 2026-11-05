const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==========================================
// 1. HALL MANAGEMENT
// ==========================================
exports.getHalls = async (req, res) => {
    try {
        const halls = await prisma.hall.findMany({
            orderBy: { name: 'asc' }
        });
        res.status(200).json(halls);
    } catch (error) {
        console.error("Error fetching halls:", error);
        res.status(500).json({ error: "Failed to load halls" });
    }
};

exports.createHall = async (req, res) => {
    try {
        const { name } = req.body;
        const newHall = await prisma.hall.create({
            data: { name, isAvailable: true }
        });
        res.status(201).json(newHall);
    } catch (error) {
        console.error("Error creating hall:", error);
        res.status(500).json({ error: "Failed to create hall" });
    }
};

exports.updateHall = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, isAvailable } = req.body;
        const updatedHall = await prisma.hall.update({
            where: { id: parseInt(id) },
            data: { name, isAvailable }
        });
        res.status(200).json(updatedHall);
    } catch (error) {
        console.error("Error updating hall:", error);
        res.status(500).json({ error: "Failed to update hall" });
    }
};

exports.deleteHall = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.hall.delete({
            where: { id: parseInt(id) }
        });
        res.status(200).json({ message: "Hall deleted successfully" });
    } catch (error) {
        console.error("Error deleting hall:", error);
        res.status(500).json({ error: "Failed to delete hall" });
    }
};

// ==========================================
// 2. TECHNICAL TIMETABLE
// ==========================================

const parseSLTDate = (dateStr, timeStr = "00:00") => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const timeParts = timeStr.split(':');
    const hours = Number(timeParts[0] || 0);
    const minutes = Number(timeParts[1] || 0);
    return new Date(Date.UTC(year, month - 1, day, hours - 5, minutes - 30, 0));
};

exports.getTechnicalTimetable = async (req, res) => {
    try {
        const { date } = req.query; // date format: YYYY-MM-DD
        
        let startDate, endDate;
        if (date) {
            startDate = parseSLTDate(date, "00:00");
            endDate = parseSLTDate(date, "23:59");
        } else {
            // Default to today
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            startDate = parseSLTDate(dateStr, "00:00");
            endDate = parseSLTDate(dateStr, "23:59");
        }

        const schedule = await prisma.timetable.findMany({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate,
                }
            },
            include: {
                batch: {
                    include: {
                        business: true
                    }
                },
                hall: true,
                tasks: {
                    where: { taskType: 'TECH_DELIVERABLES', status: 'COMPLETED' },
                    take: 1
                }
            },
            orderBy: { startTime: 'asc' }
        });
        res.status(200).json(schedule);
    } catch (error) {
        console.error("Error fetching technical timetable:", error);
        res.status(500).json({ error: "Failed to load schedule" });
    }
};

exports.allocateHall = async (req, res) => {
    try {
        const { id } = req.params; // Timetable ID
        const { hallId } = req.body;

        if (hallId) {
            // Fetch the class we are allocating
            const targetClass = await prisma.timetable.findUnique({
                where: { id: parseInt(id) }
            });

            if (!targetClass) {
                return res.status(404).json({ error: "Class not found" });
            }

            // Check for overlapping classes
            const overlappingClasses = await prisma.timetable.findMany({
                where: {
                    hallId: parseInt(hallId),
                    date: targetClass.date,
                    id: { not: parseInt(id) }, // Exclude itself
                }
            });

            const hasOverlap = overlappingClasses.some(cls => {
                // String comparison works for HH:MM format
                return targetClass.startTime < cls.endTime && targetClass.endTime > cls.startTime;
            });

            if (hasOverlap) {
                return res.status(400).json({ error: "This hall is already booked for another class during this time." });
            }
        }

        const updatedClass = await prisma.timetable.update({
            where: { id: parseInt(id) },
            data: { hallId: hallId ? parseInt(hallId) : null },
            include: { hall: true }
        });

        res.status(200).json(updatedClass);
    } catch (error) {
        console.error("Error allocating hall:", error);
        res.status(500).json({ error: "Failed to allocate hall" });
    }
};
