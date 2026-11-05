const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const esmsService = require('../services/esmsService');
const { extractCallingName } = require('../utils/nameUtils');

// Helper to sanitize & extract identifier from raw USB/Camera scanned QR codes
const extractIdentifier = (rawInput) => {
    if (!rawInput) return '';
    let str = String(rawInput).trim();
    try {
        str = decodeURIComponent(str).trim();
    } catch (e) {}

    // 1. If scanned input is a URL (e.g., https://imacampus.lk/student/STU001 or ?studentId=STU001)
    if (str.startsWith('http://') || str.startsWith('https://')) {
        try {
            const url = new URL(str);
            const paramId = url.searchParams.get('studentId') || 
                            url.searchParams.get('search') || 
                            url.searchParams.get('id') || 
                            url.searchParams.get('rfid') ||
                            url.searchParams.get('code');
            if (paramId) return paramId.trim();

            const pathSegments = url.pathname.split('/').filter(Boolean);
            if (pathSegments.length > 0) {
                return decodeURIComponent(pathSegments[pathSegments.length - 1]).trim();
            }
        } catch (e) {
            // fallback to raw
        }
    }

    // 2. If scanned input is a JSON string (e.g., {"studentId":"STU001"} or {"id":"STU001"})
    if (str.startsWith('{') && str.endsWith('}')) {
        try {
            const parsed = JSON.parse(str);
            const val = parsed.studentId || parsed.id || parsed.rfid || parsed.card || parsed.code;
            if (val) return String(val).trim();
        } catch (e) {
            // fallback
        }
    }

    return str;
};

// 0. Search Students Autocomplete (Intelligent Scoring & Prioritization)
exports.searchStudents = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query || !query.trim()) {
            return res.json({ students: [] });
        }
        const term = extractIdentifier(query);
        const cleanNoPlus = term.replace(/^\+/, '').trim();
        const noPrefixPhy = term.replace(/^PHY-STU-|^PHY-|^STU-/i, '').trim();
        const withPlus = term.startsWith('+') ? term : `+${cleanNoPlus}`;
        const phyPrefixed = term.startsWith('PHY-STU-') ? term : `PHY-STU-${cleanNoPlus}`;
        const intId = parseInt(cleanNoPlus || noPrefixPhy, 10);
        const isValidInt = !isNaN(intId) && (String(intId) === cleanNoPlus || String(intId) === noPrefixPhy);

        const searchCandidates = Array.from(new Set([
            term,
            cleanNoPlus,
            withPlus,
            noPrefixPhy,
            phyPrefixed
        ])).filter(Boolean);

        const orConditions = [];
        searchCandidates.forEach(cand => {
            orConditions.push(
                { studentName: { contains: cand } },
                { firstName: { contains: cand } },
                { lastName: { contains: cand } },
                { studentId: { contains: cand } },
                { phone: { contains: cand } },
                { guardianPhone: { contains: cand } },
                { rfid: { contains: cand } },
                { nic: { contains: cand } }
            );
        });

        if (isValidInt) {
            orConditions.push({ id: intId });
        }

        const rawStudents = await prisma.physicalStudent.findMany({
            where: {
                OR: orConditions
            },
            include: {
                class: true,
                school: true,
                enrollments: { include: { class: true } }
            },
            take: 40
        });

        // Scoring function to prioritize EXACT RFID and EXACT Student ID matches at the top
        const getMatchScore = (s) => {
            const rfid = (s.rfid || '').trim();
            const stuId = (s.studentId || '').trim();
            const phone = (s.phone || '').trim();
            const gPhone = (s.guardianPhone || '').trim();
            const sName = (s.studentName || `${s.firstName || ''} ${s.lastName || ''}`).toLowerCase();
            const qLower = term.toLowerCase();
            const qClean = cleanNoPlus.toLowerCase();

            // 1. Exact RFID Match (Highest Priority)
            if (rfid && (rfid === term || rfid === cleanNoPlus || rfid === withPlus)) {
                return 10000;
            }

            // 2. Exact Student ID Match
            if (stuId && (stuId === term || stuId === phyPrefixed || stuId === cleanNoPlus)) {
                return 8000;
            }

            // 3. Exact ID integer
            if (isValidInt && s.id === intId) {
                return 7000;
            }

            // 4. Exact Phone Match
            if (phone === term || phone === cleanNoPlus || gPhone === term || gPhone === cleanNoPlus) {
                return 6000;
            }

            // 5. RFID starts with query
            if (rfid && (rfid.startsWith(term) || rfid.replace(/^\+/, '').startsWith(qClean))) {
                return 5000;
            }

            // 6. Student ID starts with query
            if (stuId && (stuId.toLowerCase().startsWith(qLower) || stuId.toLowerCase().includes(qClean))) {
                return 4000;
            }

            // 7. Student Name exact or starts with
            if (sName === qLower || sName.startsWith(qLower)) {
                return 3000;
            }

            // 8. Name contains query
            if (sName.includes(qLower)) {
                return 2000;
            }

            return 500;
        };

        const sortedStudents = rawStudents.sort((a, b) => getMatchScore(b) - getMatchScore(a)).slice(0, 20);

        res.json({ students: sortedStudents });
    } catch (error) {
        console.error('Error in searchStudents:', error);
        res.status(500).json({ error: error.message });
    }
};

// 1. Scan Student and Load Data (Strict Priority Order: RFID -> StudentID -> Phone -> Fuzzy)
exports.scanStudent = async (req, res) => {
    try {
        const rawStudentId = req.params.studentId;
        const studentId = extractIdentifier(rawStudentId);

        if (!studentId) {
            return res.status(400).json({ error: 'Valid Student ID / QR code is required' });
        }

        const cleanNoPlus = studentId.replace(/^\+/, '').trim();
        const withPlus = studentId.startsWith('+') ? studentId : `+${cleanNoPlus}`;
        const noPrefixPhy = studentId.replace(/^PHY-STU-|^PHY-|^STU-/i, '').trim();
        const phyStuPrefixed = studentId.startsWith('PHY-STU-') ? studentId : `PHY-STU-${cleanNoPlus || noPrefixPhy}`;
        const intId = parseInt(cleanNoPlus || noPrefixPhy, 10);
        const isValidIntId = !isNaN(intId) && (String(intId) === cleanNoPlus || String(intId) === noPrefixPhy);

        const includeRelations = {
            class: { include: { teachers: true } },
            school: true,
            enrollments: { include: { class: { include: { teachers: true } } } },
            feePayments: { orderBy: { month: 'desc' } }
        };

        // STEP 1: Check for EXACT RFID / Card match first!
        let student = await prisma.physicalStudent.findFirst({
            where: {
                OR: [
                    { rfid: studentId },
                    { rfid: cleanNoPlus },
                    { rfid: withPlus }
                ]
            },
            include: includeRelations
        });

        // STEP 2: If not matched by RFID, check for EXACT studentId or primary database id
        if (!student) {
            const exactIdMatches = [
                { studentId: studentId },
                { studentId: cleanNoPlus },
                { studentId: withPlus },
                { studentId: phyStuPrefixed },
                { studentId: `PHY-STU-${noPrefixPhy}` }
            ];
            if (isValidIntId) {
                exactIdMatches.push({ id: intId });
            }

            student = await prisma.physicalStudent.findFirst({
                where: {
                    OR: exactIdMatches
                },
                include: includeRelations
            });
        }

        // STEP 3: Check for EXACT Phone / Guardian Phone
        if (!student) {
            student = await prisma.physicalStudent.findFirst({
                where: {
                    OR: [
                        { phone: studentId },
                        { phone: cleanNoPlus },
                        { guardianPhone: studentId },
                        { guardianPhone: cleanNoPlus },
                        { nic: studentId },
                        { nic: cleanNoPlus }
                    ]
                },
                include: includeRelations
            });
        }

        // STEP 4: Fallback to fuzzy substring search if nothing exact matched
        if (!student) {
            const candidateTerms = Array.from(new Set([
                studentId,
                cleanNoPlus,
                withPlus,
                noPrefixPhy,
                phyStuPrefixed
            ])).filter(Boolean);

            const fuzzyMatches = [];
            candidateTerms.forEach(cand => {
                fuzzyMatches.push(
                    { studentName: { contains: cand } },
                    { firstName: { contains: cand } },
                    { lastName: { contains: cand } },
                    { studentId: { contains: cand } },
                    { rfid: { contains: cand } },
                    { phone: { contains: cand } },
                    { guardianPhone: { contains: cand } },
                    { nic: { contains: cand } }
                );
            });

            student = await prisma.physicalStudent.findFirst({
                where: {
                    OR: fuzzyMatches
                },
                include: includeRelations
            });
        }

        if (!student) {
            return res.status(404).json({ error: 'Student not found for the given Search / Card ID: ' + studentId });
        }

        // Fetch attendance (last 90 days) and available classes concurrently
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);

        const [attendances, availableClasses] = await Promise.all([
            prisma.physicalAttendance.findMany({
                where: {
                    studentId: student.id,
                    date: { gte: threeMonthsAgo }
                },
                orderBy: { date: 'asc' }
            }),
            prisma.physicalClass.findMany({ 
                include: { teachers: true },
                orderBy: { name: 'asc' } 
            })
        ]);

        res.json({
            student,
            attendances,
            availableClasses,
            feePayments: student.feePayments || []
        });

    } catch (error) {
        console.error('Error scanning student:', error);
        res.status(500).json({ error: 'Failed to fetch student data: ' + error.message });
    }
};

// 2. Allocate Class (Multi-class enrollment)
exports.allocateClass = async (req, res) => {
    try {
        const { id } = req.params;
        const { classId, cardType } = req.body;
        const sId = parseInt(id);
        const cId = parseInt(classId);

        if (!sId || !cId) {
            return res.status(400).json({ error: 'Valid student ID and class ID are required' });
        }

        // Upsert into PhysicalStudentClassEnrollment so student can have multiple classes
        await prisma.physicalStudentClassEnrollment.upsert({
            where: {
                studentId_classId: {
                    studentId: sId,
                    classId: cId
                }
            },
            update: {
                cardType: cardType || 'FULL'
            },
            create: {
                studentId: sId,
                classId: cId,
                cardType: cardType || 'FULL'
            }
        });

        // Also ensure primary classId is set if null
        const currentStudent = await prisma.physicalStudent.findUnique({ where: { id: sId } });
        if (currentStudent && !currentStudent.classId) {
            await prisma.physicalStudent.update({
                where: { id: sId },
                data: { classId: cId }
            });
        }

        const updatedStudent = await prisma.physicalStudent.findUnique({
            where: { id: sId },
            include: {
                class: { include: { teachers: true } },
                school: true,
                enrollments: { include: { class: { include: { teachers: true } } } },
                feePayments: { orderBy: { month: 'desc' } }
            }
        });

        res.json({ success: true, student: updatedStudent, message: 'Class allocated successfully' });
    } catch (error) {
        console.error('Error allocating class:', error);
        res.status(500).json({ error: 'Failed to allocate class: ' + error.message });
    }
};

// 2.1 Unallocate / Remove Class Enrollment
exports.unallocateClass = async (req, res) => {
    try {
        const { id, classId } = req.params;
        const sId = parseInt(id);
        const cId = parseInt(classId);

        if (!sId || !cId) {
            return res.status(400).json({ error: 'Valid student ID and class ID are required' });
        }

        // Delete enrollment record
        await prisma.physicalStudentClassEnrollment.deleteMany({
            where: {
                studentId: sId,
                classId: cId
            }
        });

        // If primary class was this class, reassign or set null
        const remainingEnrollment = await prisma.physicalStudentClassEnrollment.findFirst({
            where: { studentId: sId }
        });

        const currentStudent = await prisma.physicalStudent.findUnique({ where: { id: sId } });
        if (currentStudent && currentStudent.classId === cId) {
            await prisma.physicalStudent.update({
                where: { id: sId },
                data: { classId: remainingEnrollment ? remainingEnrollment.classId : null }
            });
        }

        const updatedStudent = await prisma.physicalStudent.findUnique({
            where: { id: sId },
            include: {
                class: { include: { teachers: true } },
                school: true,
                enrollments: { include: { class: { include: { teachers: true } } } },
                feePayments: { include: { class: true }, orderBy: { month: 'desc' } }
            }
        });

        res.json({ success: true, student: updatedStudent, message: 'Class de-allocated successfully. Historical fees and cashflow records are preserved.' });
    } catch (error) {
        console.error('Error removing class enrollment:', error);
        res.status(500).json({ error: 'Failed to remove class: ' + error.message });
    }
};

// 3. Mark Attendance
exports.markAttendance = async (req, res) => {
    try {
        const { studentId, date, classId } = req.body; 
        
        let normalizedDate;
        if (date && String(date).includes('T')) {
            normalizedDate = new Date(date);
        } else if (date) {
            normalizedDate = new Date(`${date}T12:00:00.000Z`);
        } else {
            normalizedDate = new Date();
        }

        const student = await prisma.physicalStudent.findUnique({
            where: { id: parseInt(studentId) },
            include: { 
                class: true,
                school: true,
                enrollments: {
                    include: { class: true }
                }
            }
        });

        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Determine specific target class for SMS & attendance session
        let targetClass = null;
        if (classId) {
            targetClass = await prisma.physicalClass.findUnique({
                where: { id: parseInt(classId) }
            });
        }
        
        if (!targetClass) {
            if (student.enrollments && student.enrollments.length > 0) {
                targetClass = student.enrollments[0].class;
            } else if (student.class) {
                targetClass = student.class;
            }
        }

        const targetClassId = targetClass?.id || (classId ? parseInt(classId) : (student.classId || null));

        // Check if attendance already exists for this exact class session today
        const startOfDay = new Date(normalizedDate);
        startOfDay.setUTCHours(0, 0, 0, 0);

        const endOfDay = new Date(normalizedDate);
        endOfDay.setUTCHours(23, 59, 59, 999);

        const attendanceWhere = {
            studentId: parseInt(studentId),
            date: {
                gte: startOfDay,
                lte: endOfDay
            }
        };

        if (targetClassId) {
            attendanceWhere.classId = targetClassId;
        }

        let attendance = await prisma.physicalAttendance.findFirst({
            where: attendanceWhere
        });

        let isNewAttendance = false;
        if (!attendance) {
            attendance = await prisma.physicalAttendance.create({
                data: {
                    studentId: parseInt(studentId),
                    classId: targetClassId,
                    date: normalizedDate,
                    status: 'PRESENT'
                }
            });
            isNewAttendance = true;

            // Trigger automated attendance SMS alert with exact attended class
            esmsService.triggerAttendanceSms({
                student,
                attendanceRecord: attendance,
                classId: targetClassId,
                classObj: targetClass || student.class
            }).catch(smsErr => {
                console.error('[Automated Attendance SMS Notification Error]:', smsErr.message);
            });
        }

        res.json({ 
            success: true, 
            attendance,
            isNewAttendance,
            className: targetClass?.name || student.class?.name || 'Class',
            studentName: student.studentName || student.firstName || 'Student'
        });

    } catch (error) {
        console.error('Error marking attendance:', error);
        res.status(500).json({ error: 'Failed to mark attendance: ' + error.message });
    }
};

// 4. Unmark Attendance
exports.unmarkAttendance = async (req, res) => {
    try {
        const { studentId, date, classId } = req.body;

        let normalizedDate;
        if (date && String(date).includes('T')) {
            normalizedDate = new Date(date);
        } else if (date) {
            normalizedDate = new Date(`${date}T12:00:00.000Z`);
        } else {
            normalizedDate = new Date();
        }

        const startOfDay = new Date(normalizedDate);
        startOfDay.setUTCHours(0, 0, 0, 0);

        const endOfDay = new Date(normalizedDate);
        endOfDay.setUTCHours(23, 59, 59, 999);

        const deleteWhere = {
            studentId: parseInt(studentId),
            date: {
                gte: startOfDay,
                lte: endOfDay
            }
        };

        if (classId) {
            deleteWhere.classId = parseInt(classId);
        }

        await prisma.physicalAttendance.deleteMany({
            where: deleteWhere
        });

        res.json({ success: true, message: 'Attendance unmarked' });
    } catch (error) {
        console.error('Error unmarking attendance:', error);
        res.status(500).json({ error: 'Failed to unmark attendance' });
    }
};

// 5. Get Student Attendance History
exports.getStudentAttendanceHistory = async (req, res) => {
    try {
        const { id } = req.params;

        const attendances = await prisma.physicalAttendance.findMany({
            where: { studentId: parseInt(id) },
            orderBy: { date: 'desc' }
        });

        res.json(attendances);
    } catch (error) {
        console.error('Error fetching attendance history:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
};

// 6. Entrance Gate Scanner: Instant Access & Fee Verification
exports.entranceScan = async (req, res) => {
    try {
        const { identifier, classId, gateMode } = req.body;
        const rawCode = extractIdentifier(identifier);

        if (!rawCode) {
            return res.status(400).json({ 
                success: false, 
                status: 'INVALID_INPUT', 
                message: 'No card code or student ID provided' 
            });
        }

        const cleanNoPlus = rawCode.replace(/^\+/, '').trim();
        const withPlus = rawCode.startsWith('+') ? rawCode : `+${cleanNoPlus}`;
        const noPrefixPhy = rawCode.replace(/^PHY-STU-|^PHY-|^STU-/i, '').trim();
        const phyStuPrefixed = rawCode.startsWith('PHY-STU-') ? rawCode : `PHY-STU-${cleanNoPlus || noPrefixPhy}`;
        const intId = parseInt(cleanNoPlus || noPrefixPhy, 10);
        const isValidIntId = !isNaN(intId) && (String(intId) === cleanNoPlus || String(intId) === noPrefixPhy);

        const includeRelations = {
            class: { include: { teachers: true } },
            school: true,
            enrollments: { include: { class: { include: { teachers: true } } } },
            feePayments: { orderBy: { month: 'desc' } }
        };

        // STEP 1: Strict match: RFID
        let student = await prisma.physicalStudent.findFirst({
            where: {
                OR: [
                    { rfid: rawCode },
                    { rfid: cleanNoPlus },
                    { rfid: withPlus }
                ]
            },
            include: includeRelations
        });

        // STEP 2: Exact Student ID or primary ID
        if (!student) {
            const exactIdMatches = [
                { studentId: rawCode },
                { studentId: cleanNoPlus },
                { studentId: withPlus },
                { studentId: phyStuPrefixed },
                { studentId: `PHY-STU-${noPrefixPhy}` }
            ];
            if (isValidIntId) {
                exactIdMatches.push({ id: intId });
            }
            student = await prisma.physicalStudent.findFirst({
                where: { OR: exactIdMatches },
                include: includeRelations
            });
        }

        // STEP 3: Phone / Guardian Phone / NIC
        if (!student) {
            student = await prisma.physicalStudent.findFirst({
                where: {
                    OR: [
                        { phone: rawCode },
                        { phone: cleanNoPlus },
                        { guardianPhone: rawCode },
                        { guardianPhone: cleanNoPlus },
                        { nic: rawCode },
                        { nic: cleanNoPlus }
                    ]
                },
                include: includeRelations
            });
        }

        // STEP 4: Fallback fuzzy
        if (!student) {
            const candidateTerms = Array.from(new Set([
                rawCode,
                cleanNoPlus,
                withPlus,
                noPrefixPhy,
                phyStuPrefixed
            ])).filter(Boolean);

            const fuzzyMatches = [];
            candidateTerms.forEach(cand => {
                fuzzyMatches.push(
                    { studentName: { contains: cand } },
                    { firstName: { contains: cand } },
                    { lastName: { contains: cand } },
                    { studentId: { contains: cand } },
                    { rfid: { contains: cand } }
                );
            });

            student = await prisma.physicalStudent.findFirst({
                where: { OR: fuzzyMatches },
                include: includeRelations
            });
        }

        if (!student) {
            return res.status(200).json({
                success: false,
                status: 'NOT_FOUND',
                scannedCode: rawCode,
                message: `No student found for card code: "${rawCode}". Please visit reception.`
            });
        }

        // Collect all enrolled classes
        const enrolledClassesMap = new Map();
        if (student.class) {
            enrolledClassesMap.set(student.class.id, student.class);
        }
        (student.enrollments || []).forEach(enr => {
            if (enr.class) {
                enrolledClassesMap.set(enr.class.id, enr.class);
            }
        });
        const enrolledClasses = Array.from(enrolledClassesMap.values());

        if (enrolledClasses.length === 0) {
            return res.status(200).json({
                success: false,
                status: 'NO_CLASS',
                student: {
                    id: student.id,
                    studentId: student.studentId,
                    studentName: student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim(),
                    callingName: extractCallingName(student),
                    phone: student.phone,
                    grade: student.grade,
                    school: student.school?.name,
                    cardType: student.cardType || 'FULL'
                },
                message: 'Student is not enrolled in any physical classes. Please register at counter.'
            });
        }

        // Determine target class
        let targetClass = null;
        const now = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayDayName = days[now.getDay()];

        if (classId) {
            const requestedClassId = parseInt(classId);
            targetClass = enrolledClasses.find(c => c.id === requestedClassId) || null;
            if (!targetClass) {
                // Not enrolled in this specific session
                const classDetails = await prisma.physicalClass.findUnique({ where: { id: requestedClassId } });
                return res.status(200).json({
                    success: false,
                    status: 'NOT_ENROLLED_IN_CLASS',
                    student: {
                        id: student.id,
                        studentId: student.studentId,
                        studentName: student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim(),
                        callingName: extractCallingName(student),
                        phone: student.phone,
                        grade: student.grade,
                        school: student.school?.name,
                        cardType: student.cardType || 'FULL'
                    },
                    class: classDetails,
                    message: `Student is not enrolled in ${classDetails?.name || 'this class'}. Please check at counter.`
                });
            }
        } else {
            // AUTO detect based on Timetable for today!
            const enrolledClassIds = enrolledClasses.map(c => c.id);
            const todayTimetables = await prisma.physicalTimetable.findMany({
                where: {
                    classId: { in: enrolledClassIds },
                    dayOfWeek: { in: [todayDayName, todayDayName.toLowerCase(), todayDayName.toUpperCase()] }
                },
                include: { class: true }
            });

            if (todayTimetables.length > 0) {
                targetClass = todayTimetables[0].class || enrolledClasses.find(c => c.id === todayTimetables[0].classId);
            } else {
                // If no timetable entry today, default to primary class or first enrollment
                targetClass = student.class || enrolledClasses[0];
            }
        }

        if (!targetClass) {
            targetClass = enrolledClasses[0];
        }

        // Current Month YYYY-MM
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // Determine card type for this class
        const enrollment = (student.enrollments || []).find(e => e.classId === targetClass.id);
        const effectiveCardType = enrollment?.cardType || student.cardType || 'FULL';

        // Calculate expected fee
        let expectedFee = targetClass.monthlyFee || 0;
        if (effectiveCardType === 'FREE') {
            expectedFee = 0;
        } else if (effectiveCardType === 'HALF') {
            expectedFee = (targetClass.monthlyFee || 0) / 2;
        }

        // Check fee payment in database
        let isPaid = false;
        let feeStatus = 'UNPAID';
        let paidAmount = 0;

        if (effectiveCardType === 'FREE') {
            isPaid = true;
            feeStatus = 'FREE_CARD';
        } else {
            const paymentRecord = await prisma.physicalClassFeePayment.findUnique({
                where: {
                    studentId_classId_month: {
                        studentId: student.id,
                        classId: targetClass.id,
                        month: currentMonth
                    }
                }
            });

            if (paymentRecord) {
                paidAmount = paymentRecord.amount || 0;
                if (paymentRecord.status === 'PAID' || paymentRecord.status === 'FREE_CARD') {
                    isPaid = true;
                    feeStatus = paymentRecord.status;
                } else if (effectiveCardType === 'HALF' && paymentRecord.status === 'HALF_PAYMENT') {
                    isPaid = true;
                    feeStatus = 'HALF_PAYMENT';
                } else if (paidAmount >= expectedFee && expectedFee > 0) {
                    isPaid = true;
                    feeStatus = 'PAID';
                } else if (paymentRecord.status === 'PARTIAL' || paidAmount > 0) {
                    isPaid = false;
                    feeStatus = 'PARTIAL';
                } else {
                    isPaid = false;
                    feeStatus = 'PENDING';
                }
            } else {
                isPaid = false;
                feeStatus = 'UNPAID';
            }
        }

        const dueAmount = Math.max(0, expectedFee - paidAmount);

        // Sanitize student payload
        const sanitizedStudent = {
            id: student.id,
            studentId: student.studentId,
            studentName: student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim(),
            firstName: student.firstName,
            lastName: student.lastName,
            callingName: extractCallingName(student),
            phone: student.phone,
            guardianPhone: student.guardianPhone,
            grade: student.grade,
            school: student.school?.name,
            cardType: effectiveCardType
        };

        const targetClassInfo = {
            id: targetClass.id,
            name: targetClass.name,
            grade: targetClass.grade,
            subject: targetClass.subject,
            monthlyFee: targetClass.monthlyFee || 0,
            expectedFee,
            teachers: (targetClass.teachers || []).map(t => ({ id: t.id, name: t.name }))
        };

        // IF NOT PAID -> ACCESS DENIED
        if (!isPaid) {
            return res.status(200).json({
                success: false,
                status: 'DENIED',
                reason: 'FEES_UNPAID',
                student: sanitizedStudent,
                class: targetClassInfo,
                feeStatus,
                paidAmount,
                dueAmount,
                expectedFee,
                month: currentMonth,
                message: `Class fees for ${currentMonth} are unpaid. Please proceed to the cashier counter.`,
                timestamp: new Date().toISOString()
            });
        }

        // IF PAID -> ACCESS GRANTED!
        // Check if already checked in today
        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setUTCHours(23, 59, 59, 999);

        let attendance = await prisma.physicalAttendance.findFirst({
            where: {
                studentId: student.id,
                classId: targetClass.id,
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        });

        let isNewAttendance = false;
        if (!attendance) {
            attendance = await prisma.physicalAttendance.create({
                data: {
                    studentId: student.id,
                    classId: targetClass.id,
                    date: new Date(),
                    status: 'PRESENT'
                }
            });
            isNewAttendance = true;

            // Trigger automated SMS alert
            esmsService.triggerAttendanceSms({
                student,
                attendanceRecord: attendance,
                classId: targetClass.id,
                classObj: targetClass
            }).catch(smsErr => {
                console.error('[Entrance Gate SMS Error]:', smsErr.message);
            });
        }

        return res.status(200).json({
            success: true,
            status: isNewAttendance ? 'GRANTED' : 'ALREADY_CHECKED_IN',
            isNewAttendance,
            student: sanitizedStudent,
            class: targetClassInfo,
            attendance,
            feeStatus,
            month: currentMonth,
            message: isNewAttendance 
                ? `Access Granted! Welcome to ${targetClass.name}.`
                : `Already Checked In! Attendance recorded for today.`,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error in entranceScan:', error);
        res.status(500).json({ success: false, error: 'Entrance scan failed: ' + error.message });
    }
};

// 7. Get Entrance Gate Stats & Live Feed
exports.getEntranceStats = async (req, res) => {
    try {
        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setUTCHours(23, 59, 59, 999);

        // Fetch today's attendances
        const todayAttendances = await prisma.physicalAttendance.findMany({
            where: {
                date: { gte: startOfDay, lte: endOfDay }
            },
            include: {
                student: {
                    include: { school: true }
                },
                class: true
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        const totalToday = await prisma.physicalAttendance.count({
            where: {
                date: { gte: startOfDay, lte: endOfDay }
            }
        });

        // Day of week
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayDayName = days[new Date().getDay()];

        const scheduledClasses = await prisma.physicalTimetable.findMany({
            where: {
                dayOfWeek: { in: [todayDayName, todayDayName.toLowerCase(), todayDayName.toUpperCase()] }
            },
            include: {
                class: { include: { teachers: true } },
                hall: true
            }
        });

        res.json({
            totalToday,
            recentScans: todayAttendances.map(att => ({
                id: att.id,
                status: 'GRANTED',
                studentName: att.student?.studentName || `${att.student?.firstName || ''} ${att.student?.lastName || ''}`.trim(),
                studentId: att.student?.studentId,
                className: att.class?.name || 'General Class',
                classId: att.classId,
                time: att.createdAt || att.date
            })),
            todayDayName,
            scheduledClasses: scheduledClasses.map(t => ({
                id: t.id,
                classId: t.classId,
                className: t.class?.name,
                startTime: t.startTime,
                endTime: t.endTime,
                hallName: t.hallName || t.hall?.name,
                teachers: t.class?.teachers || []
            }))
        });
    } catch (error) {
        console.error('Error fetching entrance stats:', error);
        res.status(500).json({ error: 'Failed to fetch entrance stats: ' + error.message });
    }
};
