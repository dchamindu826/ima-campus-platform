const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');

// ==========================================
// STUDENT SIDE API
// ==========================================

// Start or get existing open inquiry for a student
exports.startInquiry = async (req, res) => {
    try {
        const studentId = req.user.userId || req.user.id;
        const { businessId, courseId } = req.body;

        if (!businessId) {
            return res.status(400).json({ success: false, error: "Business ID is required" });
        }

        const student = await prisma.user.findUnique({
            where: { id: parseInt(studentId) },
            select: { id: true, firstName: true, lastName: true, phone: true, optionalPhone: true }
        });

        if (!student) {
            return res.status(404).json({ success: false, error: "Student not found" });
        }

        // Check if there is already an OPEN inquiry for this business and student
        let inquiry = await prisma.webInquiry.findFirst({
            where: {
                studentId: parseInt(studentId),
                businessId: parseInt(businessId),
                status: "OPEN"
            },
            include: {
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 50,
                    include: { senderUser: { select: { firstName: true, lastName: true, role: true } } }
                }
            }
        });

        if (!inquiry) {
            // Create a new inquiry
            inquiry = await prisma.webInquiry.create({
                data: {
                    studentId: parseInt(studentId),
                    businessId: parseInt(businessId),
                    courseId: courseId ? parseInt(courseId) : null,
                    name: `${student.firstName} ${student.lastName}`.trim(),
                    phone: student.phone,
                    optionalPhone: student.optionalPhone,
                    status: "OPEN"
                },
                include: {
                    messages: true
                }
            });
        } else {
            // If exists, just reverse messages for chronological order
            inquiry.messages = inquiry.messages.reverse();
        }

        res.json({ success: true, inquiry });
    } catch (error) {
        console.error("Error in startInquiry:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// ==========================================
// STAFF SIDE API
// ==========================================

// Get list of inquiries (Filtered by Business, Status, etc)
exports.getInquiries = async (req, res) => {
    try {
        const { businessId, status = "OPEN", search } = req.query;
        // Staff validation should be done via middleware
        
        const where = {};
        
        if (businessId && businessId !== 'ALL' && businessId !== 'undefined') {
            where.businessId = parseInt(businessId);
        }

        if (status !== 'ALL') {
            where.status = status;
        }

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { phone: { contains: search } }
            ];
        }

        const inquiries = await prisma.webInquiry.findMany({
            where,
            orderBy: { lastMessageAt: 'desc' },
            include: {
                student: { select: { image: true, appChatDp: true } },
                course: { select: { name: true, code: true } },
                assignedUser: { select: { firstName: true, lastName: true } }
            }
        });

        res.json({ success: true, inquiries });
    } catch (error) {
        console.error("Error in getInquiries:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// Get messages for a specific inquiry
exports.getMessages = async (req, res) => {
    try {
        const { inquiryId } = req.params;
        const parsedInquiryId = parseInt(inquiryId);
        if (isNaN(parsedInquiryId)) return res.status(400).json({ success: false, error: "Invalid inquiry ID" });

        const messages = await prisma.webInquiryMessage.findMany({
            where: { inquiryId: parsedInquiryId },
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: {
                senderUser: { select: { firstName: true, lastName: true, role: true } },
                replyTo: { select: { message: true, mediaUrl: true, senderName: true } }
            }
        });

        res.json({ success: true, messages: messages.reverse() });
    } catch (error) {
        console.error("Error in getMessages:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// Assign inquiry to a staff member
exports.assignInquiry = async (req, res) => {
    try {
        const { inquiryId, staffId } = req.body;
        
        const updated = await prisma.webInquiry.update({
            where: { id: parseInt(inquiryId) },
            data: { assignedTo: staffId ? parseInt(staffId) : null }
        });

        res.json({ success: true, inquiry: updated });
    } catch (error) {
        console.error("Error in assignInquiry:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// Mark inquiry as resolved
exports.resolveInquiry = async (req, res) => {
    try {
        const { inquiryId } = req.body;
        
        const updated = await prisma.webInquiry.update({
            where: { id: parseInt(inquiryId) },
            data: { status: "RESOLVED" }
        });

        res.json({ success: true, inquiry: updated });
    } catch (error) {
        console.error("Error in resolveInquiry:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// Mark messages as read (clear unread count)
exports.markAsRead = async (req, res) => {
    try {
        const { inquiryId } = req.body;
        
        await prisma.webInquiry.update({
            where: { id: parseInt(inquiryId) },
            data: { unreadCount: 0 }
        });

        const { getIo } = require('./chatController');
        const io = getIo();
        if (io) {
            io.emit('web_inquiry_notification');
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Error in markAsRead:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// Mark messages as read by student
exports.studentMarkAsRead = async (req, res) => {
    try {
        const { inquiryId } = req.body;
        
        await prisma.webInquiry.update({
            where: { id: parseInt(inquiryId) },
            data: { studentUnreadCount: 0 }
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Error in studentMarkAsRead:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// Fetch specific student information for the CRM right panel
exports.getStudentInfo = async (req, res) => {
    try {
        const { inquiryId } = req.params;
        const inquiry = await prisma.webInquiry.findUnique({
            where: { id: parseInt(inquiryId) },
            select: { studentId: true }
        });

        if (!inquiry || !inquiry.studentId) {
            return res.status(404).json({ success: false, error: "Student not found" });
        }

        const student = await prisma.user.findUnique({
            where: { id: parseInt(inquiry.studentId) },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                optionalPhone: true,
                image: true,
                appChatDp: true,
                payments: {
                    where: { status: { in: [0, 1, 4] } },
                    include: {
                        business: { select: { id: true, name: true, logo: true } },
                        batch: { select: { id: true, name: true } },
                        group: { select: { id: true, name: true } }
                    },
                    orderBy: { created_at: 'desc' }
                }
            }
        });

        res.json({ success: true, student });
    } catch (error) {
        console.error("Error in getStudentInfo:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// Fetch inquiries for a specific student (to count unreads)
exports.getMyInquiries = async (req, res) => {
    try {
        const studentId = req.user.id || req.user.userId;

        const inquiries = await prisma.webInquiry.findMany({
            where: { studentId: parseInt(studentId) },
            select: {
                id: true,
                businessId: true,
                studentUnreadCount: true,
                status: true,
                lastMessage: true,
                lastMessageAt: true
            }
        });

        res.json({ success: true, inquiries });
    } catch (error) {
        console.error("Error in getMyInquiries:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// Search all registered students (Global Search for CRM)
exports.searchStudents = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query || query.length < 3) {
            return res.json({ success: true, students: [] });
        }

        const students = await prisma.user.findMany({
            where: {
                role: "STUDENT",
                OR: [
                    { firstName: { contains: query } },
                    { lastName: { contains: query } },
                    { phone: { contains: query } },
                    { whatsapp: { contains: query } },
                    { nic: { contains: query } }
                ]
            },
            take: 10,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                image: true,
                appChatDp: true
            }
        });

        res.json({ success: true, students });
    } catch (error) {
        console.error("Error in searchStudents:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// Create or get an inquiry for a student from the staff side
exports.createOrGetInquiry = async (req, res) => {
    try {
        const { studentId, businessId } = req.body;

        if (!studentId || !businessId) {
            return res.status(400).json({ success: false, error: "Student ID and Business ID are required" });
        }

        const student = await prisma.user.findUnique({
            where: { id: parseInt(studentId) },
            select: { id: true, firstName: true, lastName: true, phone: true, optionalPhone: true }
        });

        if (!student) {
            return res.status(404).json({ success: false, error: "Student not found" });
        }

        // Try to find an existing OPEN inquiry
        let inquiry = await prisma.webInquiry.findFirst({
            where: {
                studentId: parseInt(studentId),
                businessId: parseInt(businessId),
                status: "OPEN"
            },
            include: {
                student: { select: { image: true, appChatDp: true } },
                assignedUser: { select: { firstName: true, lastName: true } }
            }
        });

        if (!inquiry) {
            // Create new inquiry
            inquiry = await prisma.webInquiry.create({
                data: {
                    studentId: parseInt(studentId),
                    businessId: parseInt(businessId),
                    name: `${student.firstName} ${student.lastName}`.trim(),
                    phone: student.phone,
                    optionalPhone: student.optionalPhone,
                    status: "OPEN"
                },
                include: {
                    student: { select: { image: true, appChatDp: true } },
                    assignedUser: { select: { firstName: true, lastName: true } }
                }
            });
        }

        res.json({ success: true, inquiry });
    } catch (error) {
        console.error("Error in createOrGetInquiry:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};
