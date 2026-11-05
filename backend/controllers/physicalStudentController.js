const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');

// Create a new Physical Student
exports.createPhysicalStudent = async (req, res) => {
  try {
    const { firstName, lastName, nic, phone, address, guardianName, guardianPhone, rfid, cardType } = req.body;

    // Validation
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First name, and last name are required.' });
    }

    // Check if rfid already exists
    if (rfid) {
      const existingRfid = await prisma.physicalStudent.findUnique({
        where: { rfid }
      });
      if (existingRfid) {
        return res.status(400).json({ error: 'A physical student with this RFID card already exists.' });
      }
    }

    // Check if phone already exists
    const existingStudent = await prisma.physicalStudent.findUnique({
      where: { phone }
    });

    if (existingStudent) {
      return res.status(400).json({ error: 'A physical student with this phone number already exists.' });
    }

    // Generate unique Student ID (e.g., PHY-26-0001)
    const currentYear = new Date().getFullYear().toString().slice(-2); // "26"
    
    // Find the latest student to determine the next ID sequence
    const latestStudent = await prisma.physicalStudent.findFirst({
      orderBy: { id: 'desc' }
    });

    let nextSeq = 1;
    if (latestStudent && latestStudent.studentId) {
      const parts = latestStudent.studentId.split('-');
      if (parts.length === 3 && parts[1] === currentYear) {
        nextSeq = parseInt(parts[2], 10) + 1;
      }
    }

    const studentId = `PHY-${currentYear}-${nextSeq.toString().padStart(4, '0')}`;

    // Create the student
    const newStudent = await prisma.physicalStudent.create({
      data: {
        studentId,
        firstName,
        lastName,
        nic,
        phone,
        address,
        guardianName,
        guardianPhone,
        rfid: rfid || null,
        cardType: cardType || 'FULL'
      }
    });

    res.status(201).json({
      message: 'Physical student registered successfully',
      student: newStudent
    });

  } catch (error) {
    console.error('Error creating physical student:', error);
    res.status(500).json({ error: 'Failed to create physical student' });
  }
};

// Get all Physical Students
exports.getAllPhysicalStudents = async (req, res) => {
  try {
    const students = await prisma.physicalStudent.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(students);
  } catch (error) {
    console.error('Error fetching physical students:', error);
    res.status(500).json({ error: 'Failed to fetch physical students' });
  }
};
