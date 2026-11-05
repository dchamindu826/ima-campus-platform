const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

const DIALOG_STATUS_MESSAGES = {
  '1': 'Success - Message sent successfully',
  '2001': 'Error occurred during campaign creation',
  '2002': 'Bad request - check parameters',
  '2003': 'Empty number list',
  '2004': 'Empty message body',
  '2005': 'Invalid number list format',
  '2006': 'Not eligible to send messages via GET requests',
  '2007': 'Invalid URL Message Key (Please copy and paste the URL Message Key from your Dialog eSMS portal)',
  '2008': 'Insufficient balance or package quota in Dialog account',
  '2009': 'No valid numbers after mask-block removal',
  '2010': 'Not eligible to consume packaging',
  '2011': 'Transactional error on Dialog server'
};

class EsmsService {
  /**
   * Helper: Normalize Sri Lankan phone numbers
   * Converts 0712345678 -> 94712345678, +94712345678 -> 94712345678, 712345678 -> 94712345678
   */
  formatPhone(rawPhone) {
    if (!rawPhone) return '';
    let cleanDigits = String(rawPhone).replace(/\D/g, '');
    if (cleanDigits.startsWith('94') && cleanDigits.length === 11) {
      return cleanDigits;
    }
    if (cleanDigits.startsWith('0') && cleanDigits.length === 10) {
      return '94' + cleanDigits.substring(1);
    }
    if (cleanDigits.length === 9 && (cleanDigits.startsWith('7') || cleanDigits.startsWith('1'))) {
      return '94' + cleanDigits;
    }
    return cleanDigits;
  }

  /**
   * Get or initialize SMS Settings
   */
  async getSettings() {
    let settings = await prisma.physicalCrmSetting.findFirst();
    if (!settings) {
      settings = await prisma.physicalCrmSetting.create({
        data: {
          esmsApiUrl: 'https://e-sms.dialog.lk/api/v1/message-via-url/create/url-campaign',
          esmsUsername: 'imaarts',
          esmsPassword: '',
          esmsSenderId: 'IMA ARTS',
          isAttendanceSmsEnabled: false,
          attendanceSmsTemplate: 'Dear Parent, {student_name} ({student_id}) has attended {class_name} class on {date} at {time}. - IMA Campus'
        }
      });
    }
    return settings;
  }

  /**
   * Send a Single SMS via configured E-SMS Gateway (Dialog eSMS / Mobitel / Generic)
   */
  async sendSingleSms({ phone, message, studentId = null, classId = null, studentName = null, guardianName = null, type = 'ATTENDANCE' }) {
    try {
      const formattedPhone = this.formatPhone(phone);
      if (!formattedPhone || formattedPhone.length < 9) {
        console.warn(`[E-SMS Service] Invalid phone number provided: "${phone}"`);
        return { success: false, error: 'Invalid phone number' };
      }

      const settings = await this.getSettings();
      const apiKeyOrPassword = (settings.esmsPassword || '').trim();

      if (!apiKeyOrPassword) {
        console.warn('[E-SMS Service] Dialog eSMS URL Message Key / Password missing in Settings.');
        await prisma.physicalSmsLog.create({
          data: {
            studentId: studentId ? parseInt(studentId) : null,
            classId: classId ? parseInt(classId) : null,
            phone: formattedPhone,
            guardianName: guardianName || null,
            studentName: studentName || null,
            message,
            type,
            status: 'FAILED',
            gatewayResponse: 'Dialog eSMS URL Message Key / Password is missing'
          }
        });
        return { success: false, error: 'Please enter your Dialog eSMS URL Message Key in SMS Settings.' };
      }

      const senderId = (settings.esmsSenderId || 'IMA ARTS').trim();

      console.log(`[E-SMS Service] Dispatching ${type} SMS to ${formattedPhone} (Mask: "${senderId}")...`);

      let responseText = '';
      let isSuccess = false;

      // 1. Official Dialog eSMS URL Message Key (esmsqk) Protocol
      const isDialog = (settings.esmsApiUrl || '').includes('dialog.lk') || apiKeyOrPassword.startsWith('eyJ') || apiKeyOrPassword.length > 20;

      if (isDialog) {
        const dialogUrls = [
          'https://e-sms.dialog.lk/api/v1/message-via-url/create/url-campaign',
          'https://esms.dialog.lk/api/v1/message-via-url/create/url-campaign'
        ];

        let lastDialogCode = '';

        for (const url of dialogUrls) {
          try {
            const res = await axios.get(url, {
              params: {
                esmsqk: apiKeyOrPassword,
                source_address: senderId,
                message: message,
                list: formattedPhone
              },
              timeout: 12000
            });

            const code = String(res.data).trim();
            lastDialogCode = code;
            if (code === '1') {
              isSuccess = true;
              responseText = 'Success (Code 1)';
              break;
            } else {
              responseText = DIALOG_STATUS_MESSAGES[code] || `Dialog Error Code ${code}`;
              isSuccess = false;
            }
          } catch (err) {
            responseText = err.response?.data ? String(err.response.data) : err.message;
            isSuccess = false;
          }
        }

      } else {
        // Generic / Mobitel eSMS Gateway Format
        const apiUrl = settings.esmsApiUrl || 'https://e-sms.dialog.lk/api/v1/message-via-url/create/url-campaign';
        const cleanUsername = (settings.esmsUsername || '').trim();

        const standardParams = {
          username: cleanUsername,
          user: cleanUsername,
          password: apiKeyOrPassword,
          src: senderId,
          source_address: senderId,
          sender: senderId,
          dst: formattedPhone,
          destination_addresses: formattedPhone,
          to: formattedPhone,
          list: formattedPhone,
          msg: message,
          message: message,
          text: message
        };

        try {
          const res = await axios.get(apiUrl, { params: standardParams, timeout: 12000 });
          responseText = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data);
          isSuccess = res.status >= 200 && res.status < 300;
        } catch (getErr) {
          try {
            const postRes = await axios.post(apiUrl, standardParams, { timeout: 12000 });
            responseText = typeof postRes.data === 'object' ? JSON.stringify(postRes.data) : String(postRes.data);
            isSuccess = postRes.status >= 200 && postRes.status < 300;
          } catch (postErr) {
            responseText = postErr.response?.data ? (typeof postErr.response.data === 'object' ? JSON.stringify(postErr.response.data) : String(postErr.response.data)) : postErr.message;
            isSuccess = false;
          }
        }
      }

      // Record in SMS Log
      const log = await prisma.physicalSmsLog.create({
        data: {
          studentId: studentId ? parseInt(studentId) : null,
          classId: classId ? parseInt(classId) : null,
          phone: formattedPhone,
          guardianName: guardianName || null,
          studentName: studentName || null,
          message,
          type,
          status: isSuccess ? 'SENT' : 'FAILED',
          gatewayResponse: responseText.slice(0, 500)
        }
      });

      console.log(`[E-SMS Service] SMS result for ${formattedPhone}: ${isSuccess ? 'SENT' : 'FAILED'} -> ${responseText}`);
      return { success: isSuccess, response: responseText, logId: log.id, error: isSuccess ? null : responseText };

    } catch (error) {
      console.error('[E-SMS Service Error]:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Automated Attendance SMS Notification for a Student
   */
  async triggerAttendanceSms({ studentId, student: rawStudent, classId = null, classObj = null, attendanceDate = new Date(), attendanceRecord = null }) {
    try {
      const settings = await this.getSettings();
      if (!settings.isAttendanceSmsEnabled) {
        console.log('[E-SMS Attendance] Automated Attendance SMS is currently Disabled in settings.');
        return;
      }

      let student = rawStudent;
      const targetStudentId = studentId || (student ? student.id : null);

      if (!student && targetStudentId) {
        student = await prisma.physicalStudent.findUnique({
          where: { id: parseInt(targetStudentId) },
          include: { class: true, school: true }
        });
      } else if (student && (!student.school || !student.class)) {
        const enriched = await prisma.physicalStudent.findUnique({
          where: { id: student.id },
          include: { class: true, school: true }
        });
        if (enriched) student = enriched;
      }

      if (!student) {
        console.warn('[E-SMS Attendance] Student could not be found for SMS dispatch.');
        return;
      }

      const targetPhone = student.guardianPhone || student.guardianWhatsapp || student.phone || student.whatsapp;
      if (!targetPhone) {
        console.log(`[E-SMS Attendance] No phone number found for student ID: ${student.studentId}`);
        return;
      }

      let className = classObj?.name || student.class?.name || 'Class';
      if (!className || className === 'Class') {
        const cId = classId || student.classId;
        if (cId) {
          const cls = await prisma.physicalClass.findUnique({ where: { id: parseInt(cId) } });
          if (cls) className = cls.name;
        }
      }

      const dateObj = attendanceRecord?.date ? new Date(attendanceRecord.date) : new Date(attendanceDate);
      const formattedDate = dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit', hour12: true });

      let template = settings.attendanceSmsTemplate || 'Dear Parent, {student_name} ({student_id}) has attended {class_name} class on {date} at {time}. - IMA Campus';
      const studentDisplayName = student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student';

      const personalizedMessage = template
        .replace(/\{student_name\}/gi, studentDisplayName)
        .replace(/\{student_id\}/gi, student.studentId || '')
        .replace(/\{class_name\}/gi, className)
        .replace(/\{date\}/gi, formattedDate)
        .replace(/\{time\}/gi, timeStr)
        .replace(/\{school\}/gi, student.school?.name || '');

      console.log(`[E-SMS Attendance] Dispatching automated alert to ${targetPhone} for student ${studentDisplayName}...`);

      const result = await this.sendSingleSms({
        phone: targetPhone,
        message: personalizedMessage,
        studentId: student.id,
        classId: classId || student.classId,
        studentName: studentDisplayName,
        guardianName: student.guardianName,
        type: 'ATTENDANCE'
      });

      return result;

    } catch (error) {
      console.error('[E-SMS triggerAttendanceSms Error]:', error);
    }
  }

  /**
   * Automated Class Fee Payment SMS Notification (Single & Multi-Class Bulk)
   */
  async triggerFeePaymentSms({
    student,
    studentId,
    paidAmount,
    expectedFee,
    dueAmount,
    month,
    className,
    classNames = [],
    receiptNo,
    paymentMethod = 'CASH',
    cardType,
    isBulk = false
  }) {
    try {
      const settings = await this.getSettings();
      if (settings.isFeePaymentSmsEnabled === false) {
        console.log('[E-SMS Fee Payment] Automated Fee Payment SMS is currently Disabled in settings.');
        return;
      }

      let targetStudent = student;
      const targetStudentId = studentId || (targetStudent ? targetStudent.id : null);

      if (!targetStudent && targetStudentId) {
        targetStudent = await prisma.physicalStudent.findUnique({
          where: { id: parseInt(targetStudentId) },
          include: { class: true, school: true }
        });
      } else if (targetStudent && (!targetStudent.studentName && !targetStudent.firstName)) {
        const enriched = await prisma.physicalStudent.findUnique({
          where: { id: targetStudent.id },
          include: { class: true, school: true }
        });
        if (enriched) targetStudent = enriched;
      }

      if (!targetStudent) {
        console.warn('[E-SMS Fee Payment] Student could not be found for SMS dispatch.');
        return;
      }

      const targetPhone = targetStudent.guardianPhone || targetStudent.guardianWhatsapp || targetStudent.phone || targetStudent.whatsapp;
      if (!targetPhone) {
        console.log(`[E-SMS Fee Payment] No phone number found for student ID: ${targetStudent.studentId}`);
        return;
      }

      const now = new Date();
      const formattedDate = now.toLocaleDateString('en-GB', { timeZone: 'Asia/Colombo', day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit', hour12: true });
      const studentDisplayName = targetStudent.studentName || `${targetStudent.firstName || ''} ${targetStudent.lastName || ''}`.trim() || 'Student';
      const formattedAmount = Number(paidAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // Format Class details cleanly
      let classSummary = '';
      if (isBulk && classNames && classNames.length > 0) {
        const fullJoined = classNames.join(', ');
        if (fullJoined.length <= 50 || classNames.length <= 2) {
          classSummary = fullJoined;
        } else {
          classSummary = `${classNames.length} Classes (${classNames.slice(0, 2).join(', ')} +${classNames.length - 2} more)`;
        }
      } else {
        classSummary = className || targetStudent.class?.name || 'Class';
      }

      const receiptStr = receiptNo ? `[Ref: ${receiptNo}]` : '';
      const dueStr = dueAmount && Number(dueAmount) > 0 ? ` (Due: Rs. ${Number(dueAmount).toLocaleString()})` : '';

      let template = settings.feePaymentSmsTemplate || 'Dear Parent, Payment of Rs. {amount} for {student_name} ({student_id}) has been received for {class_details} ({month}) on {date} at {time}. {receipt_ref} - IMA Campus';

      const personalizedMessage = template
        .replace(/\{student_name\}/gi, studentDisplayName)
        .replace(/\{student_id\}/gi, targetStudent.studentId || '')
        .replace(/\{amount\}/gi, formattedAmount)
        .replace(/\{class_details\}/gi, classSummary)
        .replace(/\{class_name\}/gi, classSummary)
        .replace(/\{month\}/gi, month || '')
        .replace(/\{date\}/gi, formattedDate)
        .replace(/\{time\}/gi, timeStr)
        .replace(/\{receipt_ref\}/gi, receiptStr)
        .replace(/\{due_amount\}/gi, dueStr)
        .replace(/\{school\}/gi, targetStudent.school?.name || '')
        .replace(/\s+/g, ' ')
        .trim();

      console.log(`[E-SMS Fee Payment] Dispatching automated receipt SMS to ${targetPhone} for ${studentDisplayName} (Rs. ${formattedAmount})...`);

      const result = await this.sendSingleSms({
        phone: targetPhone,
        message: personalizedMessage,
        studentId: targetStudent.id,
        classId: !isBulk && targetStudent.classId ? targetStudent.classId : null,
        studentName: studentDisplayName,
        guardianName: targetStudent.guardianName,
        type: 'FEE_PAYMENT'
      });

      return result;

    } catch (error) {
      console.error('[E-SMS triggerFeePaymentSms Error]:', error);
    }
  }

  /**
   * Send Bulk Broadcast SMS
   */
  async sendBulkBroadcast({ studentIds = [], classId = null, customMessage, type = 'BULK' }) {
    try {
      const whereClause = {};
      if (studentIds && studentIds.length > 0) {
        whereClause.id = { in: studentIds.map(id => parseInt(id)) };
      } else if (classId && classId !== 'ALL') {
        const parsedClassId = parseInt(classId);
        whereClause.OR = [
          { classId: parsedClassId },
          { enrollments: { some: { classId: parsedClassId } } }
        ];
      }

      const students = await prisma.physicalStudent.findMany({
        where: whereClause,
        include: { school: true, class: true }
      });

      if (students.length === 0) {
        return { success: false, error: 'No students match the broadcast filter' };
      }

      console.log(`[E-SMS Broadcast] Starting bulk SMS send to ${students.length} students...`);

      let successCount = 0;
      let failedCount = 0;

      for (const student of students) {
        const phone = student.guardianPhone || student.guardianWhatsapp || student.phone || student.whatsapp;
        if (!phone) {
          failedCount++;
          continue;
        }

        const studentDisplayName = student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student';
        const personalized = customMessage
          .replace(/\{student_name\}/gi, studentDisplayName)
          .replace(/\{student_id\}/gi, student.studentId || '')
          .replace(/\{school\}/gi, student.school?.name || '')
          .replace(/\{class_name\}/gi, student.class?.name || 'Class');

        const res = await this.sendSingleSms({
          phone,
          message: personalized,
          studentId: student.id,
          classId: student.classId,
          studentName: studentDisplayName,
          guardianName: student.guardianName,
          type
        });

        if (res.success) {
          successCount++;
        } else {
          failedCount++;
        }
      }

      return {
        success: true,
        total: students.length,
        sent: successCount,
        failed: failedCount,
        message: `Bulk SMS completed: ${successCount} sent, ${failedCount} failed.`
      };

    } catch (error) {
      console.error('[E-SMS sendBulkBroadcast Error]:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EsmsService();
