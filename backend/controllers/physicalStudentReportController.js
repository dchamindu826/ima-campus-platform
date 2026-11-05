const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');
const esmsService = require('../services/esmsService');

// Helper: Calculate scheduled class dates in a given month based on timetables
function getScheduledSessionsForClass(classObj, monthStr) {
  if (!monthStr || !monthStr.includes('-')) return 4;
  const [yearStr, mStr] = monthStr.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(mStr) - 1;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const scheduledDaysOfWeek = (classObj.timetables || []).map(t => t.dayOfWeek.toLowerCase());
  if (scheduledDaysOfWeek.length === 0) return 4;

  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const dayName = dayNames[d.getDay()].toLowerCase();
    if (scheduledDaysOfWeek.includes(dayName)) {
      count++;
    }
  }

  return count > 0 ? count : 4;
}

// ============================================================================
// 1. GET COMPREHENSIVE STUDENT REPORTS MATRIX
// ============================================================================
exports.getStudentReports = async (req, res) => {
  try {
    const { classId, schoolId, search, startMonth, endMonth, segment } = req.query;

    const baseWhere = {
      NOT: [
        { studentName: 'id_number' },
        { studentName: 'student_name' },
        { studentName: 'Name' }
      ]
    };

    const whereClause = { ...baseWhere };

    if (schoolId && schoolId !== 'ALL') {
      whereClause.schoolId = parseInt(schoolId);
    }

    if (classId && classId !== 'ALL') {
      const parsedClassId = parseInt(classId);
      whereClause.OR = [
        { classId: parsedClassId },
        { enrollments: { some: { classId: parsedClassId } } }
      ];
    } else if (segment === 'ENROLLED') {
      whereClause.OR = [
        { classId: { not: null } },
        { enrollments: { some: {} } }
      ];
    } else if (segment === 'UNALLOCATED') {
      whereClause.classId = null;
      whereClause.enrollments = { none: {} };
    }

    if (search && search.trim()) {
      const term = search.trim();
      whereClause.AND = [
        ...(whereClause.AND || []),
        {
          OR: [
            { studentName: { contains: term } },
            { firstName: { contains: term } },
            { lastName: { contains: term } },
            { studentId: { contains: term } },
            { phone: { contains: term } },
            { guardianPhone: { contains: term } },
            { rfid: { contains: term } },
            { nic: { contains: term } },
            { school: { name: { contains: term } } }
          ]
        }
      ];
    }

    const [students, globalTotalCount, globalEnrolledCount, allClasses, allSchools, settings] = await Promise.all([
      prisma.physicalStudent.findMany({
        where: whereClause,
        include: {
          school: true,
          class: { include: { timetables: true } },
          enrollments: { include: { class: { include: { timetables: true } } } },
          feePayments: true,
          attendances: { orderBy: { date: 'asc' } }
        },
        orderBy: { id: 'asc' }
      }),
      prisma.physicalStudent.count({ where: baseWhere }),
      prisma.physicalStudent.count({
        where: {
          ...baseWhere,
          OR: [
            { classId: { not: null } },
            { enrollments: { some: {} } }
          ]
        }
      }),
      prisma.physicalClass.findMany({
        include: { teachers: true, timetables: true },
        orderBy: { name: 'asc' }
      }),
      prisma.physicalSchool.findMany({
        orderBy: { name: 'asc' }
      }),
      prisma.physicalCrmSetting.findFirst()
    ]);

    const allMonthsSet = new Set();
    const currentYear = new Date().getFullYear();
    const currentMonthNum = new Date().getMonth() + 1;

    allClasses.forEach(cls => {
      if (Array.isArray(cls.activeMonths) && cls.activeMonths.length > 0) {
        cls.activeMonths.forEach(m => allMonthsSet.add(m));
      }
      if (cls.startMonth) {
        allMonthsSet.add(cls.startMonth);
      }
    });

    students.forEach(s => {
      s.feePayments.forEach(fp => {
        if (fp.month) allMonthsSet.add(fp.month);
      });
      s.attendances.forEach(att => {
        const attMonth = new Date(att.date).toISOString().slice(0, 7);
        allMonthsSet.add(attMonth);
      });
    });

    if (allMonthsSet.size === 0) {
      for (let m = Math.max(1, currentMonthNum - 3); m <= currentMonthNum; m++) {
        allMonthsSet.add(`${currentYear}-${String(m).padStart(2, '0')}`);
      }
    }

    let sortedMonths = Array.from(allMonthsSet).sort();

    if (startMonth && endMonth) {
      sortedMonths = sortedMonths.filter(m => m >= startMonth && m <= endMonth);
    }

    const studentMatrix = students.map(student => {
      const studentName = student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unnamed Student';

      const enrolledClassesMap = new Map();
      if (student.class) {
        enrolledClassesMap.set(student.class.id, {
          ...student.class,
          enrolledAt: student.createdAt,
          cardType: student.cardType || 'FULL'
        });
      }
      (student.enrollments || []).forEach(e => {
        if (e.class) {
          enrolledClassesMap.set(e.class.id, {
            ...e.class,
            enrolledAt: e.createdAt || student.createdAt,
            cardType: e.cardType || student.cardType || 'FULL'
          });
        }
      });

      const enrolledClassesList = Array.from(enrolledClassesMap.values());

      const paymentLookup = {};
      (student.feePayments || []).forEach(p => {
        const key = `${p.classId}_${p.month}`;
        paymentLookup[key] = p;
      });

      const attendanceByMonth = {};
      const attendanceDatesByMonth = {};
      (student.attendances || []).forEach(att => {
        if (att.status === 'PRESENT' || !att.status) {
          const mStr = new Date(att.date).toISOString().slice(0, 7);
          attendanceByMonth[mStr] = (attendanceByMonth[mStr] || 0) + 1;
          if (!attendanceDatesByMonth[mStr]) attendanceDatesByMonth[mStr] = [];
          attendanceDatesByMonth[mStr].push(new Date(att.date).toISOString().slice(0, 10));
        }
      });

      let totalStudentFeesPaid = 0;
      let totalStudentFeesPending = 0;

      const classBreakdown = enrolledClassesList.map(cls => {
        const clsEnrollDate = cls.enrolledAt || student.createdAt;
        let clsEnrollMonth = null;
        if (clsEnrollDate) {
          const ed = new Date(clsEnrollDate);
          if (!isNaN(ed.getTime())) {
            clsEnrollMonth = `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, '0')}`;
          }
        }

        const effectiveCardType = cls.cardType || student.cardType || 'FULL';
        const standardFee = cls.monthlyFee || 0;
        const expectedMonthlyFee = effectiveCardType === 'FREE' ? 0 : (effectiveCardType === 'HALF' ? standardFee / 2 : standardFee);

        const classMonthsData = sortedMonths.map(month => {
          const pKey = `${cls.id}_${month}`;
          const payment = paymentLookup[pKey] || null;

          const isPaid = payment && (payment.status === 'PAID' || payment.status === 'FREE_CARD' || payment.status === 'HALF_PAYMENT');
          const isBeforeEnrollment = !payment && clsEnrollMonth && month < clsEnrollMonth;

          let status = 'UNPAID';
          let amountPaid = 0;

          if (payment) {
            status = payment.status;
            amountPaid = payment.amount || 0;
            if (isPaid) {
              totalStudentFeesPaid += (payment.status === 'FREE_CARD' ? 0 : (amountPaid || expectedMonthlyFee));
            } else {
              totalStudentFeesPending += Math.max(0, expectedMonthlyFee - amountPaid);
            }
          } else if (isBeforeEnrollment) {
            status = 'NOT_ENROLLED';
            amountPaid = 0;
            // Crucial: Student was NOT enrolled before this month. Do not add to pending fees!
          } else if (effectiveCardType === 'FREE') {
            status = 'FREE_CARD';
            amountPaid = 0;
          } else {
            status = 'UNPAID';
            totalStudentFeesPending += expectedMonthlyFee;
          }

          const scheduledSessions = isBeforeEnrollment ? 0 : getScheduledSessionsForClass(cls, month);
          const attendedSessions = attendanceByMonth[month] || 0;
          const attendedDates = attendanceDatesByMonth[month] || [];

          return {
            month,
            monthLabel: formatMonthLabel(month),
            feeStatus: status,
            amountPaid,
            monthlyFee: expectedMonthlyFee,
            isBeforeEnrollment,
            enrollmentMonth: clsEnrollMonth,
            paidDate: payment ? payment.paidDate : null,
            paymentMethod: payment ? payment.paymentMethod : null,
            remark: payment ? payment.remark : null,
            attendedSessions,
            scheduledSessions,
            attendedDates,
            attendanceRate: scheduledSessions > 0 ? Math.min(100, Math.round((attendedSessions / scheduledSessions) * 100)) : 0
          };
        });

        return {
          classId: cls.id,
          className: cls.name,
          grade: cls.grade,
          stream: cls.stream,
          subject: cls.subject,
          monthlyFee: cls.monthlyFee || 0,
          cardType: effectiveCardType,
          enrolledAt: clsEnrollDate,
          enrollmentMonth: clsEnrollMonth,
          months: classMonthsData
        };
      });

      return {
        id: student.id,
        studentId: student.studentId,
        studentName,
        firstName: student.firstName,
        lastName: student.lastName,
        phone: student.phone,
        whatsapp: student.whatsapp,
        guardianName: student.guardianName,
        guardianPhone: student.guardianPhone,
        guardianWhatsapp: student.guardianWhatsapp,
        nic: student.nic,
        rfid: student.rfid,
        address: student.address,
        gender: student.gender,
        dob: student.dob,
        school: student.school ? { id: student.school.id, name: student.school.name } : null,
        cardType: student.cardType || 'FULL',
        registrationFeeAmount: student.registrationFeeAmount,
        registrationFeeStatus: student.registrationFeeStatus || 'PENDING',
        totalClassesEnrolled: enrolledClassesList.length,
        classes: classBreakdown,
        totalFeesPaid: totalStudentFeesPaid,
        totalFeesPending: totalStudentFeesPending,
        totalAttendanceDays: student.attendances?.length || 0
      };
    });

    studentMatrix.sort((a, b) => {
      if (a.totalClassesEnrolled > 0 && b.totalClassesEnrolled === 0) return -1;
      if (a.totalClassesEnrolled === 0 && b.totalClassesEnrolled > 0) return 1;
      return a.id - b.id;
    });

    const regFeePaidCount = studentMatrix.filter(s => s.registrationFeeStatus === 'PAID').length;
    const totalAttendancesRecorded = studentMatrix.reduce((acc, s) => acc + s.totalAttendanceDays, 0);

    return res.json({
      success: true,
      stats: {
        totalStudents: globalTotalCount,
        enrolledStudentsCount: globalEnrolledCount,
        unallocatedStudentsCount: globalTotalCount - globalEnrolledCount,
        totalEnrollments: studentMatrix.reduce((acc, s) => acc + s.totalClassesEnrolled, 0),
        regFeePaidCount,
        regFeePendingCount: studentMatrix.length - regFeePaidCount,
        totalAttendancesRecorded
      },
      months: sortedMonths.map(m => ({ monthKey: m, label: formatMonthLabel(m) })),
      classes: allClasses.map(c => ({ id: c.id, name: c.name, grade: c.grade, stream: c.stream, subject: c.subject, monthlyFee: c.monthlyFee })),
      schools: allSchools,
      isSmsConfigured: Boolean(settings?.esmsUsername && settings?.esmsPassword),
      isAttendanceSmsEnabled: Boolean(settings?.isAttendanceSmsEnabled),
      students: studentMatrix
    });

  } catch (error) {
    console.error('[Student Reports Controller Error]:', error);
    return res.status(500).json({ error: 'Failed to generate student reports: ' + error.message });
  }
};

// ============================================================================
// 2. GET IN-DEPTH STUDENT FULL DETAILS
// ============================================================================
exports.getStudentFullDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await prisma.physicalStudent.findUnique({
      where: { id: parseInt(id) },
      include: {
        school: true,
        class: { include: { timetables: true, teachers: true } },
        enrollments: { include: { class: { include: { timetables: true, teachers: true } } } },
        feePayments: { include: { class: true }, orderBy: { month: 'desc' } },
        attendances: { 
          include: { 
            class: { 
              select: { id: true, name: true, grade: true } 
            } 
          }, 
          orderBy: { date: 'desc' } 
        }
      }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    const [smsLogs, transactions] = await Promise.all([
      prisma.physicalSmsLog.findMany({
        where: { studentId: student.id },
        orderBy: { createdAt: 'desc' },
        take: 50
      }),
      prisma.physicalTransaction.findMany({
        where: { studentId: student.id, isDeleted: false },
        orderBy: { date: 'desc' }
      })
    ]);

    return res.json({
      success: true,
      student,
      transactions,
      smsLogs
    });

  } catch (error) {
    console.error('[Student Full Details Error]:', error);
    return res.status(500).json({ error: 'Failed to fetch student details: ' + error.message });
  }
};

// ============================================================================
// 3. SMS GATEWAY SETTINGS & TEST DISPATCH
// ============================================================================
exports.getSmsSettings = async (req, res) => {
  try {
    const settings = await esmsService.getSettings();
    return res.json({ success: true, settings });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load SMS settings: ' + error.message });
  }
};

exports.saveSmsSettings = async (req, res) => {
  try {
    const {
      esmsApiUrl,
      esmsUsername,
      esmsPassword,
      esmsSenderId,
      isAttendanceSmsEnabled,
      attendanceSmsTemplate,
      isFeePaymentSmsEnabled,
      feePaymentSmsTemplate
    } = req.body;

    const existing = await prisma.physicalCrmSetting.findFirst();

    const data = {
      esmsApiUrl: esmsApiUrl || existing?.esmsApiUrl || 'https://esms.dialog.lk/api/sms/send',
      esmsUsername: esmsUsername !== undefined ? esmsUsername : (existing?.esmsUsername || 'imaarts'),
      esmsPassword: (esmsPassword !== undefined && esmsPassword.trim() !== '') ? esmsPassword.trim() : (existing?.esmsPassword || ''),
      esmsSenderId: esmsSenderId || existing?.esmsSenderId || 'IMA',
      isAttendanceSmsEnabled: isAttendanceSmsEnabled !== undefined ? Boolean(isAttendanceSmsEnabled) : (existing?.isAttendanceSmsEnabled ?? false),
      attendanceSmsTemplate: attendanceSmsTemplate || existing?.attendanceSmsTemplate || 'Dear Parent, {student_name} ({student_id}) has attended {class_name} class on {date} at {time}. - IMA Campus',
      isFeePaymentSmsEnabled: isFeePaymentSmsEnabled !== undefined ? Boolean(isFeePaymentSmsEnabled) : (existing?.isFeePaymentSmsEnabled ?? true),
      feePaymentSmsTemplate: feePaymentSmsTemplate || existing?.feePaymentSmsTemplate || 'Dear Parent, Payment of Rs. {amount} for {student_name} ({student_id}) has been received for {class_details} ({month}) on {date} at {time}. {receipt_ref} - IMA Campus'
    };

    let updated;
    if (existing) {
      updated = await prisma.physicalCrmSetting.update({
        where: { id: existing.id },
        data
      });
    } else {
      updated = await prisma.physicalCrmSetting.create({ data });
    }

    return res.json({ success: true, settings: updated, message: 'SMS Settings saved successfully!' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to save SMS settings: ' + error.message });
  }
};

exports.sendTestSms = async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Please provide a test phone number.' });
    }
    const result = await esmsService.sendSingleSms({
      phone,
      message: message || 'Test message from IMA Campus Physical CRM Dialog eSMS Gateway Integration.',
      type: 'TEST'
    });
    if (result.success) {
      return res.json({ success: true, message: 'Test SMS sent successfully!' });
    } else {
      return res.status(400).json({ error: result.error || 'Failed to send test SMS via Gateway' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// ============================================================================
// 4. SEND BULK SMS
// ============================================================================
exports.sendBulkSms = async (req, res) => {
  try {
    const { studentIds, classId, message, type } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Please provide a message to send.' });
    }

    const result = await esmsService.sendBulkBroadcast({
      studentIds,
      classId,
      customMessage: message.trim(),
      type: type || 'BULK'
    });

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    return res.status(500).json({ error: 'Failed to send bulk SMS: ' + error.message });
  }
};

// ============================================================================
// ============================================================================
// 5. GET SMS LOGS & PARENT SMS AUDIT REPORT
// ============================================================================
exports.getSmsLogs = async (req, res) => {
  try {
    const { page = 1, limit = 100, type, status, classId, date, startDate, endDate, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (type && type !== 'ALL') where.type = type;
    if (status && status !== 'ALL') where.status = status;
    if (classId && classId !== 'ALL') where.classId = parseInt(classId);

    // Date range filter
    if (startDate && endDate) {
      const s = new Date(startDate);
      s.setUTCHours(0, 0, 0, 0);
      const e = new Date(endDate);
      e.setUTCHours(23, 59, 59, 999);
      where.createdAt = { gte: s, lte: e };
    } else if (date) {
      const s = new Date(date);
      s.setUTCHours(0, 0, 0, 0);
      const e = new Date(date);
      e.setUTCHours(23, 59, 59, 999);
      where.createdAt = { gte: s, lte: e };
    }

    // Search query
    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { phone: { contains: term } },
        { studentName: { contains: term } },
        { guardianName: { contains: term } },
        { message: { contains: term } }
      ];
    }

    // Fetch logs, total count, and summary stats
    const [rawLogs, total, allStatusCounts, attendanceCount, bulkCount] = await Promise.all([
      prisma.physicalSmsLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.physicalSmsLog.count({ where }),
      prisma.physicalSmsLog.groupBy({
        by: ['status'],
        where,
        _count: { status: true }
      }),
      prisma.physicalSmsLog.count({ where: { ...where, type: 'ATTENDANCE' } }),
      prisma.physicalSmsLog.count({ where: { ...where, type: 'BULK' } })
    ]);

    // Gather student IDs and class IDs to enrich logs
    const studentIds = Array.from(new Set(rawLogs.map(l => l.studentId).filter(Boolean)));
    const classIds = Array.from(new Set(rawLogs.map(l => l.classId).filter(Boolean)));

    const [students, classes] = await Promise.all([
      studentIds.length > 0 
        ? prisma.physicalStudent.findMany({
            where: { id: { in: studentIds } },
            select: { id: true, studentId: true, studentName: true, firstName: true, lastName: true, phone: true, guardianPhone: true }
          })
        : [],
      classIds.length > 0
        ? prisma.physicalClass.findMany({
            where: { id: { in: classIds } },
            select: { id: true, name: true, grade: true, stream: true, monthlyFee: true }
          })
        : []
    ]);

    const studentMap = new Map(students.map(s => [s.id, s]));
    const classMap = new Map(classes.map(c => [c.id, c]));

    const logs = rawLogs.map(log => {
      const stu = log.studentId ? studentMap.get(log.studentId) : null;
      const cls = log.classId ? classMap.get(log.classId) : null;

      return {
        ...log,
        studentCustomId: stu?.studentId || null,
        studentDisplayName: log.studentName || stu?.studentName || (stu ? `${stu.firstName || ''} ${stu.lastName || ''}`.trim() : 'Student'),
        className: cls?.name || 'General Class',
        classGrade: cls?.grade || '',
        classStream: cls?.stream || ''
      };
    });

    let sentCount = 0;
    let failedCount = 0;
    allStatusCounts.forEach(item => {
      if (item.status === 'SENT') sentCount = item._count.status;
      if (item.status === 'FAILED') failedCount = item._count.status;
    });

    const successRate = total > 0 ? Math.round((sentCount / total) * 100) : 100;

    return res.json({
      success: true,
      logs,
      total,
      summary: {
        total,
        sentCount,
        failedCount,
        successRate,
        attendanceCount,
        bulkCount
      },
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching SMS logs:', error);
    return res.status(500).json({ error: 'Failed to fetch SMS logs: ' + error.message });
  }
};

// ============================================================================
// 6. GET DATE-WISE & CLASS-WISE ATTENDANCE SESSIONS REPORT
// ============================================================================
exports.getAttendanceSessionsReport = async (req, res) => {
  try {
    const { date, classId } = req.query;
    
    // Normalize target date
    const targetDateStr = date || new Date().toISOString().slice(0, 10);
    const startDate = new Date(`${targetDateStr}T00:00:00.000Z`);
    const endDate = new Date(`${targetDateStr}T23:59:59.999Z`);
    const targetMonth = targetDateStr.slice(0, 7);

    // Class filter
    const classWhere = {};
    if (classId && classId !== 'ALL') {
      classWhere.id = parseInt(classId);
    }

    const classes = await prisma.physicalClass.findMany({
      where: classWhere,
      include: {
        teachers: true,
        timetables: true
      },
      orderBy: { name: 'asc' }
    });

    const sessions = [];
    let totalEnrolledAcrossSessions = 0;
    let totalPresentAcrossSessions = 0;
    let totalAbsentAcrossSessions = 0;

    for (const cls of classes) {
      // Find all students enrolled in this class
      const enrolledStudents = await prisma.physicalStudent.findMany({
        where: {
          NOT: [
            { studentName: 'id_number' },
            { studentName: 'student_name' },
            { studentName: 'Name' }
          ],
          OR: [
            { classId: cls.id },
            { enrollments: { some: { classId: cls.id } } }
          ]
        },
        include: {
          school: true,
          enrollments: {
            where: { classId: cls.id }
          },
          attendances: {
            where: {
              date: {
                gte: startDate,
                lte: endDate
              },
              OR: [
                { classId: cls.id },
                { classId: null }
              ]
            },
            orderBy: { createdAt: 'desc' }
          },
          feePayments: {
            where: {
              classId: cls.id,
              month: targetMonth
            }
          }
        },
        orderBy: [{ studentName: 'asc' }, { firstName: 'asc' }]
      });

      const enrolledCount = enrolledStudents.length;
      if (enrolledCount === 0 && (!classId || classId === 'ALL')) {
        // Skip classes with 0 enrolled students if looking at all classes
        continue;
      }

      const presentStudents = [];
      const absentStudents = [];

      enrolledStudents.forEach(student => {
        const studentDisplayName = student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student';
        const enrollment = student.enrollments?.[0];
        const cardType = enrollment?.cardType || student.cardType || 'FULL';
        const isAttended = student.attendances && student.attendances.length > 0;
        const attRecord = isAttended ? student.attendances[0] : null;
        const feePayment = student.feePayments?.[0];
        
        const studentInfo = {
          id: student.id,
          studentId: student.studentId,
          studentName: studentDisplayName,
          phone: student.phone || '',
          guardianPhone: student.guardianPhone || student.guardianWhatsapp || '',
          schoolName: student.school?.name || '-',
          rfid: student.rfid || '',
          cardType,
          isPresent: isAttended,
          attendanceTime: attRecord?.createdAt ? new Date(attRecord.createdAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit', hour12: true }) : null,
          feeStatus: feePayment ? feePayment.status : (cardType === 'FREE' ? 'FREE_CARD' : 'PENDING'),
          feeAmountPaid: feePayment?.amount || 0,
          monthlyFee: cls.monthlyFee || 0
        };

        if (isAttended) {
          presentStudents.push(studentInfo);
        } else {
          absentStudents.push(studentInfo);
        }
      });

      const presentCount = presentStudents.length;
      const absentCount = absentStudents.length;
      const attendanceRate = enrolledCount > 0 ? Math.round((presentCount / enrolledCount) * 100) : 0;

      totalEnrolledAcrossSessions += enrolledCount;
      totalPresentAcrossSessions += presentCount;
      totalAbsentAcrossSessions += absentCount;

      sessions.push({
        classId: cls.id,
        className: cls.name,
        grade: cls.grade,
        stream: cls.stream || 'General',
        subject: cls.subject || 'General',
        monthlyFee: cls.monthlyFee || 0,
        teachers: cls.teachers.map(t => ({ id: t.id, name: t.name })),
        timetables: cls.timetables.map(tt => ({ dayOfWeek: tt.dayOfWeek, startTime: tt.startTime, endTime: tt.endTime, hall: tt.hall })),
        enrolledCount,
        presentCount,
        absentCount,
        attendanceRate,
        presentStudents,
        absentStudents
      });
    }

    const overallAttendanceRate = totalEnrolledAcrossSessions > 0
      ? Math.round((totalPresentAcrossSessions / totalEnrolledAcrossSessions) * 100)
      : 0;

    return res.json({
      success: true,
      date: targetDateStr,
      targetMonth,
      summary: {
        totalSessions: sessions.length,
        totalEnrolledAcrossSessions,
        totalPresentAcrossSessions,
        totalAbsentAcrossSessions,
        overallAttendanceRate
      },
      sessions
    });

  } catch (error) {
    console.error('[Attendance Sessions Report Error]:', error);
    return res.status(500).json({ error: 'Failed to generate attendance sessions report: ' + error.message });
  }
};

function formatMonthLabel(monthStr) {
  if (!monthStr || !monthStr.includes('-')) return monthStr;
  const [y, m] = monthStr.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mIdx = parseInt(m) - 1;
  return `${monthNames[mIdx] || m} ${y}`;
}

// ============================================================================
// 4. CLASS FOLLOW-UP & MONITORING REPORT (Student Fees + Attendance + Contact)
// ============================================================================
exports.getClassFollowUpReport = async (req, res) => {
  try {
    const { classId, teacherId, month, status, search } = req.query;

    // Load all classes with teachers and timetables for dropdown navigation
    const allClasses = await prisma.physicalClass.findMany({
      include: {
        teachers: true,
        timetables: true
      },
      orderBy: { name: 'asc' }
    });

    if (allClasses.length === 0) {
      return res.json({
        success: true,
        class: null,
        allClasses: [],
        teachers: [],
        months: [],
        summary: { totalStudents: 0, filteredCount: 0, fullyPaidCount: 0, unpaidFollowUpCount: 0, totalClassDueAmount: 0, totalClassCollectedAmount: 0, averageAttendanceRate: 0 },
        students: []
      });
    }

    // Extract unique teachers across all classes
    const teacherMap = new Map();
    allClasses.forEach(cls => {
      (cls.teachers || []).forEach(t => {
        if (!teacherMap.has(t.id)) teacherMap.set(t.id, t);
      });
    });
    const teachersList = Array.from(teacherMap.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    // Determine target class
    let targetClass = null;
    if (classId && classId !== 'ALL') {
      targetClass = allClasses.find(c => c.id === parseInt(classId));
    }
    if (!targetClass && teacherId && teacherId !== 'ALL') {
      const tId = parseInt(teacherId);
      targetClass = allClasses.find(c => c.teachers?.some(t => t.id === tId));
    }
    if (!targetClass) {
      targetClass = allClasses[0];
    }

    const clsId = targetClass.id;

    // Parse active months for this class
    let activeMonths = [];
    if (Array.isArray(targetClass.activeMonths)) {
      activeMonths = [...targetClass.activeMonths];
    } else if (typeof targetClass.activeMonths === 'string') {
      try { activeMonths = JSON.parse(targetClass.activeMonths); } catch (e) { activeMonths = [targetClass.activeMonths]; }
    } else if (targetClass.startMonth) {
      activeMonths = [targetClass.startMonth];
    }

    // Include any months recorded in payments for this class
    const paymentMonthsRaw = await prisma.physicalClassFeePayment.findMany({
      where: { classId: clsId },
      select: { month: true },
      distinct: ['month']
    });
    paymentMonthsRaw.forEach(p => {
      if (p.month && !activeMonths.includes(p.month)) {
        activeMonths.push(p.month);
      }
    });

    // If still empty, guarantee recent months
    if (activeMonths.length === 0) {
      const now = new Date();
      for (let offset = -1; offset <= 3; offset++) {
        const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        activeMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    }
    activeMonths.sort(); // Ascending chronological order: older months to current

    // Fetch enrolled students
    const [enrollments, primaryStudents, payments] = await Promise.all([
      prisma.physicalStudentClassEnrollment.findMany({
        where: { classId: clsId },
        include: {
          student: {
            include: { school: true }
          }
        }
      }),
      prisma.physicalStudent.findMany({
        where: { classId: clsId },
        include: { school: true }
      }),
      prisma.physicalClassFeePayment.findMany({
        where: { classId: clsId }
      })
    ]);

    const enrolledMap = new Map();
    enrollments.forEach(e => {
      if (e.student) {
        enrolledMap.set(e.student.id, {
          ...e.student,
          cardType: e.cardType || e.student.cardType || 'FULL',
          enrolledAt: e.createdAt || e.student.createdAt
        });
      }
    });
    primaryStudents.forEach(s => {
      if (!enrolledMap.has(s.id)) {
        enrolledMap.set(s.id, {
          ...s,
          cardType: s.cardType || 'FULL',
          enrolledAt: s.createdAt
        });
      }
    });

    const enrolledStudents = Array.from(enrolledMap.values()).filter(s => {
      const name = (s.studentName || `${s.firstName || ''} ${s.lastName || ''}`).trim().toLowerCase();
      return name !== 'id_number' && name !== 'student_name' && name !== 'name';
    });

    // Sort students by name
    enrolledStudents.sort((a, b) => {
      const nameA = (a.studentName || `${a.firstName || ''} ${a.lastName || ''}`).toLowerCase();
      const nameB = (b.studentName || `${b.firstName || ''} ${b.lastName || ''}`).toLowerCase();
      return nameA.localeCompare(nameB);
    });

    const studentIds = enrolledStudents.map(s => s.id);

    // Fetch attendances for these students for this class or gate attendance
    const attendances = studentIds.length > 0 ? await prisma.physicalAttendance.findMany({
      where: {
        studentId: { in: studentIds },
        status: 'PRESENT',
        OR: [
          { classId: clsId },
          { classId: null }
        ]
      },
      select: { studentId: true, date: true, classId: true }
    }) : [];

    // Map attendances: `${studentId}_${mStr}` -> Set of dates
    const attendanceMap = new Map();
    attendances.forEach(att => {
      const mStr = new Date(att.date).toISOString().slice(0, 7);
      const dStr = new Date(att.date).toISOString().slice(0, 10);
      const key = `${att.studentId}_${mStr}`;
      if (!attendanceMap.has(key)) {
        attendanceMap.set(key, new Set());
      }
      attendanceMap.get(key).add(dStr);
    });

    // Map payments: `${studentId}_${month}`
    const paymentMap = new Map();
    payments.forEach(p => {
      paymentMap.set(`${p.studentId}_${p.month}`, p);
    });

    // Calculate scheduled sessions per month
    const scheduledSessionsMap = {};
    activeMonths.forEach(m => {
      scheduledSessionsMap[m] = getScheduledSessionsForClass(targetClass, m);
    });

    const standardClassFee = targetClass.monthlyFee || 0;
    const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const targetEvalMonth = month || (activeMonths.includes(currentMonthStr) ? currentMonthStr : activeMonths[activeMonths.length - 1]);

    let totalClassDueAmount = 0;
    let totalClassCollectedAmount = 0;
    let fullyPaidStudentsCount = 0;
    let unpaidFollowUpCount = 0;

    const studentRows = enrolledStudents.map(student => {
      const studentName = student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student';
      const cType = student.cardType || 'FULL';
      const effectiveFee = cType === 'FREE' ? 0 : (cType === 'HALF' ? standardClassFee / 2 : standardClassFee);

      const enrollDate = student.enrolledAt || student.createdAt;
      let enrollMonth = null;
      if (enrollDate) {
        const ed = new Date(enrollDate);
        if (!isNaN(ed.getTime())) {
          enrollMonth = `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, '0')}`;
        }
      }

      let totalStudentPaid = 0;
      let totalStudentDue = 0;
      let paidMonthsCount = 0;
      let unpaidMonthsCount = 0;
      let eligibleMonthsCount = 0;
      let totalAttendedDays = 0;
      let totalScheduledDays = 0;

      const monthsData = {};

      activeMonths.forEach(m => {
        const pay = paymentMap.get(`${student.id}_${m}`);
        const isBeforeEnrollment = !pay && enrollMonth && m < enrollMonth;
        const attendedDatesSet = attendanceMap.get(`${student.id}_${m}`);
        const attendedDays = attendedDatesSet ? attendedDatesSet.size : 0;
        const scheduledDays = isBeforeEnrollment ? 0 : (scheduledSessionsMap[m] || 0);

        totalAttendedDays += attendedDays;
        totalScheduledDays += scheduledDays;

        if (pay && (pay.status === 'PAID' || pay.status === 'FREE_CARD' || pay.status === 'HALF_PAYMENT')) {
          const paidAmt = pay.status === 'FREE_CARD' ? 0 : (pay.amount !== undefined ? pay.amount : effectiveFee);
          totalStudentPaid += paidAmt;
          paidMonthsCount++;
          eligibleMonthsCount++;

          monthsData[m] = {
            month: m,
            status: pay.status,
            isPaid: true,
            amountPaid: paidAmt,
            feeAmount: effectiveFee,
            dueAmount: 0,
            paidDate: pay.paidDate,
            paymentMethod: pay.paymentMethod,
            attendedDays,
            scheduledDays,
            isBeforeEnrollment: false
          };
        } else if (pay && pay.status === 'PARTIAL') {
          const paidAmt = pay.amount || 0;
          const dueAmt = Math.max(0, effectiveFee - paidAmt);
          totalStudentPaid += paidAmt;
          totalStudentDue += dueAmt;
          eligibleMonthsCount++;
          if (dueAmt > 0) unpaidMonthsCount++;
          else paidMonthsCount++;

          monthsData[m] = {
            month: m,
            status: 'PARTIAL',
            isPaid: false,
            amountPaid: paidAmt,
            feeAmount: effectiveFee,
            dueAmount: dueAmt,
            paidDate: pay.paidDate,
            paymentMethod: pay.paymentMethod,
            attendedDays,
            scheduledDays,
            isBeforeEnrollment: false
          };
        } else if (isBeforeEnrollment) {
          monthsData[m] = {
            month: m,
            status: 'NOT_ENROLLED',
            isPaid: false,
            amountPaid: 0,
            feeAmount: 0,
            dueAmount: 0,
            paidDate: null,
            attendedDays: 0,
            scheduledDays: 0,
            isBeforeEnrollment: true,
            enrollMonth
          };
        } else if (cType === 'FREE') {
          paidMonthsCount++;
          eligibleMonthsCount++;

          monthsData[m] = {
            month: m,
            status: 'FREE_CARD',
            isPaid: true,
            amountPaid: 0,
            feeAmount: 0,
            dueAmount: 0,
            paidDate: null,
            attendedDays,
            scheduledDays,
            isBeforeEnrollment: false
          };
        } else {
          totalStudentDue += effectiveFee;
          unpaidMonthsCount++;
          eligibleMonthsCount++;

          monthsData[m] = {
            month: m,
            status: 'UNPAID',
            isPaid: false,
            amountPaid: 0,
            feeAmount: effectiveFee,
            dueAmount: effectiveFee,
            paidDate: null,
            attendedDays,
            scheduledDays,
            isBeforeEnrollment: false
          };
        }
      });

      totalClassDueAmount += totalStudentDue;
      totalClassCollectedAmount += totalStudentPaid;

      const hasUnpaidFees = totalStudentDue > 0 || unpaidMonthsCount > 0;
      if (hasUnpaidFees) {
        unpaidFollowUpCount++;
      } else {
        fullyPaidStudentsCount++;
      }

      const attendanceRate = totalScheduledDays > 0 ? Math.min(100, Math.round((totalAttendedDays / totalScheduledDays) * 100)) : 0;
      const targetMonthData = monthsData[targetEvalMonth] || null;
      const targetMonthPaid = targetMonthData ? (targetMonthData.isPaid || targetMonthData.status === 'NOT_ENROLLED') : false;

      return {
        id: student.id,
        studentId: student.studentId,
        studentName,
        firstName: student.firstName,
        lastName: student.lastName,
        phone: student.phone || '',
        whatsapp: student.whatsapp || student.phone || '',
        guardianName: student.guardianName || '',
        guardianPhone: student.guardianPhone || '',
        guardianWhatsapp: student.guardianWhatsapp || student.guardianPhone || '',
        address: student.address || '',
        nic: student.nic || '',
        rfid: student.rfid || '',
        gender: student.gender || '',
        dob: student.dob || '',
        schoolName: student.school?.name || '',
        cardType: cType,
        registrationFeeStatus: student.registrationFeeStatus || 'PENDING',
        enrolledAt: student.enrolledAt,
        enrollmentMonth: enrollMonth,
        totalPaidAmount: totalStudentPaid,
        totalDueAmount: totalStudentDue,
        paidMonthsCount,
        unpaidMonthsCount,
        eligibleMonthsCount,
        totalAttendedDays,
        totalScheduledDays,
        attendanceRate,
        hasUnpaidFees,
        targetMonthPaid,
        months: monthsData
      };
    });

    // Client/Server filter by status or search
    let filteredStudents = studentRows;
    if (status === 'UNPAID') {
      filteredStudents = filteredStudents.filter(s => s.hasUnpaidFees);
    } else if (status === 'PAID') {
      filteredStudents = filteredStudents.filter(s => !s.hasUnpaidFees);
    } else if (status === 'TARGET_UNPAID') {
      filteredStudents = filteredStudents.filter(s => !s.targetMonthPaid);
    }

    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      filteredStudents = filteredStudents.filter(s => 
        s.studentName.toLowerCase().includes(term) ||
        s.studentId.toLowerCase().includes(term) ||
        s.phone.includes(term) ||
        s.guardianPhone.includes(term) ||
        s.guardianName.toLowerCase().includes(term) ||
        s.address.toLowerCase().includes(term) ||
        s.schoolName.toLowerCase().includes(term)
      );
    }

    const avgAttendanceRate = studentRows.length > 0 
      ? Math.round(studentRows.reduce((sum, s) => sum + s.attendanceRate, 0) / studentRows.length)
      : 0;

    return res.json({
      success: true,
      class: {
        id: targetClass.id,
        name: targetClass.name,
        grade: targetClass.grade,
        stream: targetClass.stream,
        subject: targetClass.subject,
        monthlyFee: standardClassFee,
        teachers: targetClass.teachers || [],
        timetables: targetClass.timetables || []
      },
      allClasses: allClasses.map(c => ({
        id: c.id,
        name: c.name,
        grade: c.grade,
        stream: c.stream,
        subject: c.subject,
        monthlyFee: c.monthlyFee || 0,
        teachers: c.teachers || []
      })),
      teachers: teachersList,
      months: activeMonths.map(m => ({
        monthKey: m,
        label: formatMonthLabel(m),
        scheduledSessions: scheduledSessionsMap[m] || 0
      })),
      targetMonth: targetEvalMonth,
      summary: {
        totalStudents: studentRows.length,
        filteredCount: filteredStudents.length,
        fullyPaidCount: fullyPaidStudentsCount,
        unpaidFollowUpCount,
        totalClassDueAmount,
        totalClassCollectedAmount,
        averageAttendanceRate: avgAttendanceRate
      },
      students: filteredStudents
    });

  } catch (error) {
    console.error('[Class Follow-up Report Error]:', error);
    return res.status(500).json({ error: 'Failed to generate class follow-up report: ' + error.message });
  }
};
