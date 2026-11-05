const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');
const bcrypt = require('bcryptjs');

const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

const getContextData = async (req, res) => {
    try {
        const businesses = await prisma.business.findMany({
            where: { status: 1 },
            select: { id: true, name: true, streams: true, logo: true, batches: { select: { id: true, name: true } } }
        });
        
        const coordinators = await prisma.user.findMany({
            where: { role: 'Coordinator' },
            select: { id: true, firstName: true, lastName: true }
        });
        
        const installments = await prisma.installment.findMany();
        const upgradePricing = await prisma.upgradePricing.findMany();

        const batches = await prisma.batch.findMany({
            where: { status: 1 },
            select: { 
                id: true, 
                name: true, 
                businessId: true,
                logo: true, 
                groups: { 
                    select: { 
                        id: true, 
                        name: true, 
                        type: true,
                        discount_rules: true,
                        itemOrder: true,
                        courses: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                stream: true,
                                streams: true,
                                price: true,
                                isDiscountExcluded: true,
                                lecturerName: true,
                                groupPrices: true,
                                groupId: true
                            }
                        }
                    } 
                } 
            }
        });

        const batchesWithInstallments = batches.map(b => ({
            ...b,
            installment_plans_parsed: installments.filter(i => i.batchId === b.id),
            upgrade_pricing: upgradePricing.filter(u => u.batchId === b.id)
        }));

        res.status(200).json(safeJson({ success: true, businesses, batches: batchesWithInstallments, coordinators }));
    } catch (error) {
        console.error("Test Injector Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getMockStudentData = async (req, res) => {
    try {
        const { phone } = req.params;
        const student = await prisma.user.findUnique({ 
            where: { phone },
            include: {
                payments: true
            }
        });

        if (!student) {
            return res.status(200).json(safeJson({ success: true, exists: false }));
        }

        const enrolledSubjects = [];
        let walletBalance = student.walletBalance || 0;

        for (const payment of student.payments) {
            if (payment.status === 1) { // Approved
                try {
                    const parsedSubjects = JSON.parse(payment.subjects || '[]');
                    if (Array.isArray(parsedSubjects)) {
                        enrolledSubjects.push(...parsedSubjects);
                    }
                } catch(e) {}
            }
        }

        res.status(200).json(safeJson({ 
            success: true, 
            exists: true, 
            student,
            enrolledSubjects: [...new Set(enrolledSubjects)],
            walletBalance
        }));
    } catch (error) {
        console.error("Get Mock Student Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteMockData = async (req, res) => {
    try {
        const { phone } = req.params;
        const student = await prisma.user.findUnique({ where: { phone } });
        if (!student) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }

        // Only delete payments
        await prisma.bankTransaction.deleteMany({ where: { payment: { studentId: student.id } } });
        await prisma.payment.deleteMany({ where: { studentId: student.id } });
        
        const lead = await prisma.lead.findUnique({ where: { phone } });
        if (lead) {
            await prisma.leadRoundProgress.deleteMany({ where: { leadId: lead.id } });
            await prisma.chatMessage.deleteMany({ where: { leadId: lead.id } });
            await prisma.lead.delete({ where: { id: lead.id } });
        }

        await prisma.user.delete({ where: { id: student.id } });

        res.status(200).json({ success: true, message: "Mock data successfully deleted" });
    } catch (error) {
        console.error("Delete Mock Data Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const injectPayment = async (req, res) => {
    try {
        const { paymentId, phone, businessId, batchId, groupId, amount, payment_type, subjects, customDate, method } = req.body;

        if (!phone || !businessId || !batchId || !groupId || amount === undefined || !customDate) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        // 1. Find or Create Student
        let student = await prisma.user.findUnique({ where: { phone } });
        if (!student) {
            const hashedPassword = await bcrypt.hash('123456', 10);
            const randomAvatarNum = Math.floor(Math.random() * 20) + 1;
            const dpCode = `${String(randomAvatarNum).padStart(2, '0')}.jpg`;
            student = await prisma.user.create({
                data: {
                    firstName: "Mock",
                    lastName: "Student " + Math.floor(Math.random() * 1000),
                    phone: phone,
                    password: hashedPassword,
                    role: "Student",
                    image: `chat_dps/${dpCode}`,
                    appChatDp: dpCode,
                    createdAt: new Date(customDate),
                    updatedAt: new Date(customDate)
                }
            });
            console.log("Mock student created:", student.id);
        }

        // 2. Create or Update Payment
        const paymentDate = new Date(customDate);
        let payment;

        if (paymentId) {
            payment = await prisma.payment.update({
                where: { id: parseInt(paymentId) },
                data: {
                    amount: parseFloat(amount),
                    payment_type: parseInt(payment_type) || 1,
                    method: method || "MockCash",
                    status: 1, // Approved
                    remark: req.body.isUpgrade ? '[UPGRADE] Mock Upgrade' : '',
                    created_at: paymentDate,
                    valid_until: new Date(paymentDate.getTime() + 30 * 24 * 60 * 60 * 1000)
                }
            });
        } else {
            payment = await prisma.payment.create({
                data: {
                    studentId: student.id,
                    businessId: parseInt(businessId),
                    batchId: parseInt(batchId),
                    groupId: parseInt(groupId),
                    amount: parseFloat(amount),
                    payment_type: parseInt(payment_type) || 1,
                    method: method || "MockCash",
                    status: 1, // Approved
                    subjects: subjects || "[]",
                    remark: req.body.isUpgrade ? '[UPGRADE] Mock Upgrade' : '',
                    created_at: paymentDate,
                    valid_until: new Date(paymentDate.getTime() + 30 * 24 * 60 * 60 * 1000) // +30 days
                }
            });
        }
        // 🔥 Trigger Core CRM/Business Logic Sync 🔥
        try {
            const { syncLeadEnrollment } = require('./paymentController');
            await syncLeadEnrollment(student.id, payment.payment_type, payment);
            console.log(`Successfully synced lead enrollment for student ${student.id} with payment type ${payment.payment_type}`);
            
            // Mark the PAID lead created by sync as MOCK_INJECTOR so it appears in the Test Injector UI
            const dbPhoneSuffix = `_BIZ_${businessId}` + (batchId ? `_BATCH_${batchId}` : '') + `_PAID`;
            const paidPhone = `${phone}${dbPhoneSuffix}`;
            await prisma.lead.updateMany({
                where: { phone: paidPhone },
                data: { source: "MOCK_INJECTOR" }
            });
        } catch (syncError) {
            console.error("Error syncing lead enrollment during payment injection:", syncError);
        }

        // 🔥 LEAD CREATION FOR MOCK (Fallback)
        if (req.body.createLead) {
            try {
                const existingLead = await prisma.lead.findUnique({ where: { phone } });
                if (!existingLead) {
                    await prisma.lead.create({
                        data: {
                            name: student.firstName + ' ' + student.lastName,
                            phone: phone,
                            source: "MOCK_INJECTOR",
                            campaignType: "AFTER_SEMINAR",
                            status: "NEW",
                            batchId: parseInt(batchId)
                        }
                    });
                    console.log("Mock fallback lead created for student:", phone);
                }
            } catch(e) { console.error("Auto-Generate Mock Lead Error:", e); }
        }

        // 🔥 NEXT PHASE GENERATION LOGIC (For Installments)
        if (parseInt(payment_type) === 2 && payment.subjects && payment.subjects !== "[]") {
            try {
                const subIds = JSON.parse(payment.subjects);
                const plan = await prisma.installment.findFirst({
                    where: { batchId: parseInt(batchId), subjectCount: { lte: subIds.length } },
                    orderBy: { subjectCount: 'desc' }
                });

                if (plan && plan.details) {
                    const phases = JSON.parse(plan.details);
                    const currentInstallment = payment.installment_no || 1;
                    const currentPhaseIndex = currentInstallment - 1;

                    if (currentPhaseIndex + 1 < phases.length) {
                        const nextPhase = phases[currentPhaseIndex + 1];
                        let nextDueDate = new Date(paymentDate);
                        nextDueDate.setDate(nextDueDate.getDate() + 30);
                        
                        await prisma.payment.create({
                            data: {
                                studentId: student.id,
                                businessId: parseInt(businessId),
                                batchId: parseInt(batchId),
                                groupId: parseInt(groupId),
                                subjects: payment.subjects,
                                payment_type: 2,
                                method: 'Upcoming',
                                status: 0,
                                amount: parseFloat(nextPhase.price || nextPhase.amount || 0),
                                installment_no: currentPhaseIndex + 2,
                                due_date: nextDueDate
                            }
                        });
                        console.log("Auto-generated Next Installment for Mock Student.");
                    }
                }
            } catch (e) { console.error("Auto-Generate Next Installment Error:", e); }
        }

        res.status(200).json(safeJson({
            success: true,
            message: "Payment successfully injected!",
            payment,
            student
        }));
    } catch (error) {
        console.error("Inject Payment Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getMockList = async (req, res) => {
    try {
        const mockPayments = await prisma.payment.findMany({
            where: { method: { startsWith: 'Mock' } },
            orderBy: { created_at: 'desc' },
            include: {
                student: { select: { id: true, firstName: true, lastName: true, phone: true } },
                business: { select: { name: true } },
                batch: { select: { name: true } }
            }
        });
        res.status(200).json(safeJson({ success: true, mockPayments }));
    } catch (error) {
        console.error("Get Mock List Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteSingleMock = async (req, res) => {
    try {
        const { id } = req.params;
        const payment = await prisma.payment.findUnique({ where: { id: parseInt(id) }, include: { student: true } });
        if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

        await prisma.bankTransaction.deleteMany({ where: { paymentId: payment.id } });
        await prisma.payment.delete({ where: { id: payment.id } });

        // If student has no more payments and is a Mock student, maybe delete student too
        const remaining = await prisma.payment.count({ where: { studentId: payment.studentId } });
        if (remaining === 0 && payment.student.firstName === 'Mock') {
            const lead = await prisma.lead.findUnique({ where: { phone: payment.student.phone } });
            if (lead) {
                await prisma.leadRoundProgress.deleteMany({ where: { leadId: lead.id } });
                await prisma.chatMessage.deleteMany({ where: { leadId: lead.id } });
                await prisma.lead.delete({ where: { id: lead.id } });
            }
            await prisma.user.delete({ where: { id: payment.studentId } });
        }

        res.status(200).json({ success: true, message: "Mock deleted successfully" });
    } catch (error) {
        console.error("Delete Single Mock Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getMockLeads = async (req, res) => {
    try {
        const leads = await prisma.lead.findMany({
            where: { source: "MOCK_INJECTOR" },
            orderBy: { createdAt: 'desc' },
            include: {
                batch: { select: { name: true } },
                assignedUser: { select: { firstName: true, lastName: true } }
            }
        });
        res.status(200).json(safeJson({ success: true, leads }));
    } catch (error) {
        console.error("Get Mock Leads Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const assignMockLead = async (req, res) => {
    try {
        const { leadId, coordinatorId, inquiryType } = req.body;
        if (!leadId || !coordinatorId || !inquiryType) return res.status(400).json({ success: false, message: "Missing required fields" });

        const lead = await prisma.lead.update({
            where: { id: parseInt(leadId) },
            data: {
                assignedTo: parseInt(coordinatorId),
                inquiryType,
                isAutoAssigned: true,
                assignedAt: new Date()
            }
        });

        const existingProgress = await prisma.leadRoundProgress.findFirst({
            where: { leadId: lead.id, roundNum: 1 }
        });
        if (!existingProgress) {
            await prisma.leadRoundProgress.create({
                data: {
                    leadId: lead.id,
                    roundNum: 1,
                    phase: 1,
                    callStatus: "pending"
                }
            });
        }
        
        // Ensure campaign specific fields are initialized
        await prisma.lead.update({
            where: { id: lead.id },
            data: {
                newInqRound: inquiryType === 'NEW_INQ' ? 1 : lead.newInqRound,
                newInqPhase: inquiryType === 'NEW_INQ' ? 1 : lead.newInqPhase,
                newInqCallStatus: inquiryType === 'NEW_INQ' ? 'pending' : lead.newInqCallStatus,
                openSemRound: inquiryType === 'OPEN_SEMINAR' ? 1 : lead.openSemRound,
                openSemPhase: inquiryType === 'OPEN_SEMINAR' ? 1 : lead.openSemPhase,
                openSemCallStatus: inquiryType === 'OPEN_SEMINAR' ? 'pending' : lead.openSemCallStatus,
            }
        });

        res.status(200).json({ success: true, message: "Lead assigned successfully", lead });
    } catch (error) {
        console.error("Assign Mock Lead Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const createOpenSemLead = async (req, res) => {
    try {
        const { phone, businessId, batchId, name, leadType = 'OPEN_SEMINAR', assignToMe } = req.body;
        
        let businessTag = '';
        if (businessId) {
            businessTag = `_BIZ_${businessId}`;
        }
        
        const fullPhone = phone + businessTag;
        
        let lead = await prisma.lead.findFirst({ where: { phone: fullPhone } });
        if (lead) {
            return res.status(400).json({ success: false, message: "A mock lead already exists with this phone number." });
        }

        let inquiryType = leadType;
        let campaignType = 'AFTER_SEMINAR';
        
        lead = await prisma.lead.create({
            data: {
                name: name || `Test Mock Lead (${leadType})`,
                phone: fullPhone,
                source: "MOCK_INJECTOR",
                campaignType,
                inquiryType,
                status: "OPEN",
                batchId: batchId ? parseInt(batchId) : null,
                callMethod: "direct",
                callStatus: "pending",
                callAttempt: 1,
                phase: 1,
                coordinationRound: 1,
                newInqRound: inquiryType === 'NEW_INQ' ? 1 : 1,
                newInqPhase: 1,
                newInqCallStatus: 'pending',
                openSemRound: inquiryType === 'OPEN_SEMINAR' ? 1 : 1,
                openSemPhase: 1,
                openSemCallStatus: 'pending',
                enrollmentStatus: "NON_ENROLLED",
                paymentIntention: "NOT_DECIDED",
                ...(assignToMe && {
                    assignedTo: req.user?.id,
                    isAutoAssigned: true,
                    assignedAt: new Date()
                })
            }
        });
        
        res.status(200).json({ success: true, message: `${leadType} Lead created successfully`, lead });
    } catch (error) {
        console.error("Create Mock Lead Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const shiftLeadDates = async (req, res) => {
    try {
        const { leadId, daysToShift } = req.body;
        const id = parseInt(leadId);
        const days = parseInt(daysToShift);
        
        if (isNaN(id) || isNaN(days)) {
            return res.status(400).json({ success: false, message: "Invalid parameters." });
        }
        
        const lead = await prisma.lead.findUnique({ where: { id } });
        if (!lead) {
            return res.status(404).json({ success: false, message: "Lead not found." });
        }
        
        const shiftMs = days * 24 * 60 * 60 * 1000;
        
        const newAssignedAt = lead.assignedAt ? new Date(lead.assignedAt.getTime() - shiftMs) : null;
        const newUpdatedAt = lead.updatedAt ? new Date(lead.updatedAt.getTime() - shiftMs) : null;
        const newCreatedAt = lead.createdAt ? new Date(lead.createdAt.getTime() - shiftMs) : null;

        await prisma.lead.update({
            where: { id },
            data: {
                assignedAt: newAssignedAt,
                updatedAt: newUpdatedAt,
                createdAt: newCreatedAt
            }
        });
        
        res.status(200).json({ success: true, message: `Successfully shifted lead ${id} back by ${days} days.` });
    } catch (error) {
        console.error("Shift Lead Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteSingleMockLead = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid ID" });
        
        await prisma.reminder.deleteMany({ where: { leadId: id } });
        // leadRoundProgress and chatMessage will be deleted by Cascade if they have the relation
        await prisma.leadRoundProgress.deleteMany({ where: { leadId: id } });
        await prisma.chatMessage.deleteMany({ where: { leadId: id } });
        await prisma.lead.deleteMany({ where: { id } });
        
        res.status(200).json({ success: true, message: "Mock lead deleted successfully." });
    } catch (error) {
        console.error("Delete Mock Lead Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getContextData, getMockStudentData, deleteMockData, injectPayment, getMockList, deleteSingleMock, getMockLeads, assignMockLead, createOpenSemLead, shiftLeadDates, deleteSingleMockLead };
