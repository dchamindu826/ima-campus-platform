const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { parseStudentName, extractCallingName } = require('../utils/nameUtils');
const esmsService = require('../services/esmsService');

const saveBase64Image = (imageStr) => {
  if (!imageStr || typeof imageStr !== 'string' || !imageStr.startsWith('data:image')) return imageStr;
  try {
    const match = imageStr.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (!match) return imageStr;
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const base64Data = match[2];
    const dir = path.join(__dirname, '../storage/documents');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `teacher_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
    fs.writeFileSync(path.join(dir, filename), Buffer.from(base64Data, 'base64'));
    return `/api/storage/documents/${filename}`;
  } catch (e) {
    console.error("Error saving base64 image:", e);
    return imageStr;
  }
};

// Helper to safely get the next unique Physical Student ID (e.g. PHY-STU-14827)
const getNextPhysicalStudentId = async () => {
  try {
    const result = await prisma.$queryRaw`
      SELECT MAX(CAST(SUBSTRING(studentId, 9) AS UNSIGNED)) as maxId 
      FROM PhysicalStudent 
      WHERE studentId LIKE 'PHY-STU-%'
    `;
    let nextNum = (result && result[0] && result[0].maxId != null) 
      ? Number(result[0].maxId) + 1 
      : 10001;

    // Safety check to ensure no collision
    while (true) {
      const candidate = `PHY-STU-${nextNum}`;
      const existing = await prisma.physicalStudent.findUnique({
        where: { studentId: candidate },
        select: { id: true }
      });
      if (!existing) {
        return candidate;
      }
      nextNum++;
    }
  } catch (err) {
    console.error('Error computing next studentId:', err);
    const count = await prisma.physicalStudent.count();
    let fallbackNum = Math.max(15000, count + 10000 + 1);
    while (true) {
      const candidate = `PHY-STU-${fallbackNum}`;
      const existing = await prisma.physicalStudent.findUnique({
        where: { studentId: candidate },
        select: { id: true }
      });
      if (!existing) {
        return candidate;
      }
      fallbackNum++;
    }
  }
};

// SCHOOLS
exports.getSchools = async (req, res) => {
  try {
    const schools = await prisma.physicalSchool.findMany();
    res.json(schools);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createSchool = async (req, res) => {
  try {
    const { name } = req.body;
    const school = await prisma.physicalSchool.create({
      data: { name },
    });
    res.status(201).json(school);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateSchool = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const school = await prisma.physicalSchool.update({
      where: { id: parseInt(id) },
      data: { name },
    });
    res.json(school);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteSchool = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.physicalSchool.delete({
      where: { id: parseInt(id) },
    });
    res.json({ message: 'School deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// STUDENTS
exports.getStudents = async (req, res) => {
  try {
    const students = await prisma.physicalStudent.findMany({
      include: {
        school: true,
        class: {
          include: { teachers: true }
        },
        enrollments: {
          include: {
            class: {
              include: { teachers: true }
            }
          }
        }
      },
      orderBy: { id: 'desc' }
    });
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createStudent = async (req, res) => {
  try {
    const { studentName, firstName, lastName, grade, nic, phone, whatsapp, address, gender, dob, schoolId, classId, classIds, guardianName, guardianPhone, guardianWhatsapp, rfid, registrationFeeAmount, registrationFeeStatus, cardType, enrollmentCardTypes, classEnrollments } = req.body;
    
    const trimmedRfid = rfid && typeof rfid === 'string' && rfid.trim().length > 0 ? rfid.trim() : null;

    // Check for duplicate RFID/QR card
    if (trimmedRfid) {
      const existingWithCard = await prisma.physicalStudent.findFirst({
        where: { rfid: trimmedRfid }
      });
      if (existingWithCard) {
        return res.status(400).json({
          error: `Card/QR Code "${trimmedRfid}" is already allocated to "${existingWithCard.studentName || existingWithCard.firstName || existingWithCard.studentId}" (${existingWithCard.studentId})!`
        });
      }
    }

    // Generate unique studentId based on actual highest existing ID
    const studentId = await getNextPhysicalStudentId();

    const derivedStudentName = studentName || (firstName || lastName ? `${firstName || ''} ${lastName || ''}`.trim() : '');
    const parsedName = parseStudentName(derivedStudentName, firstName, lastName);
    const finalFirstName = parsedName.firstName;
    const finalLastName = parsedName.lastName;

    // Handle classIds array
    let selectedClassIds = Array.isArray(classIds) ? classIds.map(c => parseInt(c)).filter(Boolean) : [];
    if (classId && !selectedClassIds.includes(parseInt(classId))) {
      selectedClassIds.unshift(parseInt(classId));
    }

    const primaryClassId = selectedClassIds.length > 0 ? selectedClassIds[0] : (classId ? parseInt(classId) : null);
    const globalCardType = cardType || 'FULL';

    const student = await prisma.physicalStudent.create({
      data: {
        studentId,
        studentName: derivedStudentName,
        firstName: finalFirstName,
        lastName: finalLastName,
        grade,
        nic,
        phone,
        whatsapp,
        address,
        gender,
        dob,
        schoolId: schoolId ? parseInt(schoolId) : null,
        classId: primaryClassId,
        guardianName,
        guardianPhone,
        guardianWhatsapp,
        rfid: trimmedRfid,
        cardType: globalCardType,
        registrationFeeAmount: registrationFeeAmount ? parseFloat(registrationFeeAmount) : null,
        registrationFeeStatus: registrationFeeStatus || 'PENDING'
      }
    });

    // Build enrollment card type map if passed
    const cardMap = {};
    if (enrollmentCardTypes && typeof enrollmentCardTypes === 'object') {
      Object.keys(enrollmentCardTypes).forEach(k => {
        cardMap[parseInt(k)] = enrollmentCardTypes[k];
      });
    }
    if (Array.isArray(classEnrollments)) {
      classEnrollments.forEach(item => {
        if (item.classId) cardMap[parseInt(item.classId)] = item.cardType || globalCardType;
      });
    }

    // Create enrollments for all selected classIds
    if (selectedClassIds.length > 0) {
      await prisma.physicalStudentClassEnrollment.createMany({
        data: selectedClassIds.map(cId => ({
          studentId: student.id,
          classId: cId,
          cardType: cardMap[cId] || globalCardType
        })),
        skipDuplicates: true
      });
    }

    // Refetch student with school, class, and enrollments
    const fullStudent = await prisma.physicalStudent.findUnique({
      where: { id: student.id },
      include: {
        school: true,
        class: true,
        enrollments: { include: { class: true } }
      }
    });

    // If fee is PAID, immediately create an INCOME transaction
    if (registrationFeeStatus === 'PAID') {
      const feeVal = (registrationFeeAmount && parseFloat(registrationFeeAmount) > 0)
        ? parseFloat(registrationFeeAmount)
        : 1000;
      const sName = student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student';

      await prisma.physicalTransaction.create({
        data: {
          type: 'INCOME',
          category: 'Registration',
          amount: feeVal,
          description: `Registration Fee - ${student.studentId} (${sName})`,
          studentId: student.id
        }
      });
    }

    res.status(201).json(fullStudent);
  } catch (error) {
    if (error.code === 'P2002' && error.meta?.target?.includes('rfid')) {
      return res.status(400).json({ error: 'This Card/RFID is already allocated to another student.' });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentName, firstName, lastName, grade, nic, phone, whatsapp, address, gender, dob, schoolId, classId, classIds, guardianName, guardianPhone, guardianWhatsapp, rfid, registrationFeeAmount, registrationFeeStatus, cardType, enrollmentCardTypes, classEnrollments } = req.body;
    
    const oldStudent = await prisma.physicalStudent.findUnique({ where: { id: parseInt(id) }});
    if (!oldStudent) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const trimmedRfid = rfid !== undefined ? (rfid && typeof rfid === 'string' && rfid.trim().length > 0 ? rfid.trim() : null) : oldStudent.rfid;

    // Check for duplicate RFID/QR card on other students
    if (trimmedRfid) {
      const existingWithCard = await prisma.physicalStudent.findFirst({
        where: {
          rfid: trimmedRfid,
          NOT: { id: parseInt(id) }
        }
      });
      if (existingWithCard) {
        return res.status(400).json({
          error: `Card/QR Code "${trimmedRfid}" is already allocated to "${existingWithCard.studentName || existingWithCard.firstName || existingWithCard.studentId}" (${existingWithCard.studentId})!`
        });
      }
    }

    const derivedStudentName = studentName || (firstName || lastName ? `${firstName || ''} ${lastName || ''}`.trim() : '');
    const parsedName = parseStudentName(derivedStudentName, firstName, lastName);
    const finalFirstName = parsedName.firstName;
    const finalLastName = parsedName.lastName;

    // Handle classIds array
    let selectedClassIds = Array.isArray(classIds) ? classIds.map(c => parseInt(c)).filter(Boolean) : [];
    if (classId && !selectedClassIds.includes(parseInt(classId))) {
      selectedClassIds.unshift(parseInt(classId));
    }

    const primaryClassId = selectedClassIds.length > 0 ? selectedClassIds[0] : (classId ? parseInt(classId) : null);
    const globalCardType = cardType !== undefined ? cardType : (oldStudent?.cardType || 'FULL');

    const student = await prisma.physicalStudent.update({
      where: { id: parseInt(id) },
      data: {
        studentName: derivedStudentName,
        firstName: finalFirstName,
        lastName: finalLastName,
        grade,
        nic,
        phone,
        whatsapp,
        address,
        gender,
        dob,
        schoolId: schoolId ? parseInt(schoolId) : null,
        classId: primaryClassId,
        guardianName,
        guardianPhone,
        guardianWhatsapp,
        rfid: trimmedRfid,
        cardType: globalCardType,
        registrationFeeAmount: registrationFeeAmount ? parseFloat(registrationFeeAmount) : null,
        registrationFeeStatus: registrationFeeStatus || 'PENDING'
      }
    });

    // Build enrollment card type map if passed
    const cardMap = {};
    if (enrollmentCardTypes && typeof enrollmentCardTypes === 'object') {
      Object.keys(enrollmentCardTypes).forEach(k => {
        cardMap[parseInt(k)] = enrollmentCardTypes[k];
      });
    }
    if (Array.isArray(classEnrollments)) {
      classEnrollments.forEach(item => {
        if (item.classId) cardMap[parseInt(item.classId)] = item.cardType || globalCardType;
      });
    }

    // Update enrollments if classIds is explicitly passed
    if (Array.isArray(classIds)) {
      const existingEnrollments = await prisma.physicalStudentClassEnrollment.findMany({
        where: { studentId: student.id }
      });
      const existingMap = new Map();
      existingEnrollments.forEach(e => {
        existingMap.set(e.classId, e);
      });

      // Remove enrollments that are no longer selected
      const toDeleteClassIds = existingEnrollments
        .filter(e => !selectedClassIds.includes(e.classId))
        .map(e => e.classId);

      if (toDeleteClassIds.length > 0) {
        await prisma.physicalStudentClassEnrollment.deleteMany({
          where: { studentId: student.id, classId: { in: toDeleteClassIds } }
        });
      }

      // Add new or update cardType without resetting original createdAt
      for (const cId of selectedClassIds) {
        const existing = existingMap.get(cId);
        const cType = cardMap[cId] || globalCardType;
        if (existing) {
          if (existing.cardType !== cType) {
            await prisma.physicalStudentClassEnrollment.update({
              where: { id: existing.id },
              data: { cardType: cType }
            });
          }
        } else {
          await prisma.physicalStudentClassEnrollment.create({
            data: {
              studentId: student.id,
              classId: cId,
              cardType: cType
            }
          });
        }
      }
    }

    // Refetch updated student with enrollments
    const fullStudent = await prisma.physicalStudent.findUnique({
      where: { id: student.id },
      include: {
        school: true,
        class: true,
        enrollments: { include: { class: true } }
      }
    });

    // If it was just updated to PAID, create an INCOME transaction
    if (oldStudent && oldStudent.registrationFeeStatus !== 'PAID' && registrationFeeStatus === 'PAID') {
      const feeVal = (registrationFeeAmount && parseFloat(registrationFeeAmount) > 0)
        ? parseFloat(registrationFeeAmount)
        : (oldStudent.registrationFeeAmount && parseFloat(oldStudent.registrationFeeAmount) > 0
          ? parseFloat(oldStudent.registrationFeeAmount)
          : 1000);
      const sName = student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student';

      await prisma.physicalTransaction.create({
        data: {
          type: 'INCOME',
          category: 'Registration',
          amount: feeVal,
          description: `Registration Fee - ${student.studentId} (${sName})`,
          studentId: student.id
        }
      });
    }

    res.json(fullStudent);
  } catch (error) {
    if (error.code === 'P2002' && error.meta?.target?.includes('rfid')) {
      return res.status(400).json({ error: 'This Card/RFID is already allocated to another student.' });
    }
    res.status(500).json({ error: error.message });
  }
};

// Allocate / Bind Card directly to a student
exports.allocateCard = async (req, res) => {
  try {
    const { id } = req.params;
    const { rfid } = req.body;
    const studentId = parseInt(id);

    if (!studentId) {
      return res.status(400).json({ error: 'Valid student ID is required' });
    }

    const trimmedRfid = rfid && typeof rfid === 'string' && rfid.trim().length > 0 ? rfid.trim() : null;

    if (trimmedRfid) {
      const existingWithCard = await prisma.physicalStudent.findFirst({
        where: {
          rfid: trimmedRfid,
          NOT: { id: studentId }
        }
      });
      if (existingWithCard) {
        return res.status(400).json({
          error: `Card/QR Code "${trimmedRfid}" is already allocated to "${existingWithCard.studentName || existingWithCard.firstName || existingWithCard.studentId}" (${existingWithCard.studentId})!`
        });
      }
    }

    const updatedStudent = await prisma.physicalStudent.update({
      where: { id: studentId },
      data: {
        rfid: trimmedRfid
      },
      include: {
        school: true,
        class: { include: { teachers: true } },
        enrollments: { include: { class: { include: { teachers: true } } } },
        feePayments: { orderBy: { month: 'desc' } }
      }
    });

    res.json({
      success: true,
      message: trimmedRfid ? `Card "${trimmedRfid}" successfully allocated!` : 'Card removed successfully!',
      student: updatedStudent
    });
  } catch (error) {
    console.error('Error allocating card:', error);
    if (error.code === 'P2002' && error.meta?.target?.includes('rfid')) {
      return res.status(400).json({ error: 'This Card/RFID is already allocated to another student.' });
    }
    res.status(500).json({ error: 'Failed to allocate card: ' + error.message });
  }
};

const XLSX = require('xlsx');

exports.bulkImportStudents = async (req, res) => {
  try {
    const file = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);
    if (!file) {
      console.error('[Bulk Excel Import] No file uploaded in request.');
      return res.status(400).json({ error: 'Please select and upload an Excel (.xlsx, .csv) file.' });
    }

    let fileBuffer = file.buffer;
    if (!fileBuffer && file.path && fs.existsSync(file.path)) {
      fileBuffer = fs.readFileSync(file.path);
    }
    if (!fileBuffer) {
      return res.status(400).json({ error: 'Could not read uploaded file content.' });
    }

    console.log(`[Bulk Excel Import] Processing file: ${file.originalname || 'unknown'}, Size: ${file.size || fileBuffer.length} bytes`);

    let workbook;
    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch (readErr) {
      console.error('[Bulk Excel Import] Failed to read Excel workbook:', readErr);
      return res.status(400).json({ error: 'Could not parse Excel file format. Please upload a valid .xlsx or .csv file.' });
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return res.status(400).json({ error: 'The uploaded Excel file contains no worksheets.' });
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert sheet to 2D matrix to find exact header row dynamically
    const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!rawMatrix || rawMatrix.length === 0) {
      return res.status(400).json({ error: 'The uploaded Excel sheet contains no data.' });
    }

    // Dynamic header row detection (scans first 10 rows for column keywords)
    let headerRowIndex = 0;
    const headerKeywords = ['name', 'student', 'phone', 'mobile', 'address', 'gender', 'dob', 'birth', 'parent', 'guardian', 'id_number', 'nic'];

    for (let r = 0; r < Math.min(10, rawMatrix.length); r++) {
      const rowCells = (rawMatrix[r] || []).map(cell => String(cell).toLowerCase().trim());
      const matchCount = rowCells.filter(cell => headerKeywords.some(kw => cell.includes(kw))).length;
      if (matchCount >= 2) {
        headerRowIndex = r;
        break;
      }
    }

    console.log(`[Bulk Excel Import] Detected header row at line ${headerRowIndex + 1}:`, rawMatrix[headerRowIndex]);

    const rawRows = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex, defval: '' });
    if (!rawRows || rawRows.length === 0) {
      return res.status(400).json({ error: 'The uploaded Excel sheet contains no data rows below header.' });
    }

    const { defaultClassId, defaultSchoolId } = req.body;
    const parsedClassId = defaultClassId ? parseInt(defaultClassId) : null;
    const parsedSchoolId = defaultSchoolId ? parseInt(defaultSchoolId) : null;

    // Load existing database students for in-memory matching (Upsert support)
    const existingStudents = await prisma.physicalStudent.findMany();
    const existingByNameMap = new Map();
    const existingByPhoneMap = new Map();

    for (const s of existingStudents) {
      const cleanName = (s.studentName || `${s.firstName || ''} ${s.lastName || ''}`).trim().toLowerCase().replace(/\s+/g, ' ');
      if (cleanName) existingByNameMap.set(cleanName, s);
      if (s.phone) existingByPhoneMap.set(s.phone.trim(), s);
    }

    let nextStudentNum = 10001;
    try {
      const maxRes = await prisma.$queryRaw`
        SELECT MAX(CAST(SUBSTRING(studentId, 9) AS UNSIGNED)) as maxId 
        FROM PhysicalStudent 
        WHERE studentId LIKE 'PHY-STU-%'
      `;
      if (maxRes && maxRes[0] && maxRes[0].maxId != null) {
        nextStudentNum = Number(maxRes[0].maxId) + 1;
      }
    } catch (e) {
      nextStudentNum = Math.max(15000, existingStudents.length + 10000 + 1);
    }
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (let idx = 0; idx < rawRows.length; idx++) {
      const row = rawRows[idx];

      // Exact & Permissive Header Key Matcher
      const getValue = (...keys) => {
        for (const k of keys) {
          const target = k.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          const matchedKey = Object.keys(row).find(rk => {
            const cleanKey = rk.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanKey === target || (cleanKey.length > 3 && target.includes(cleanKey)) || (target.length > 3 && cleanKey.includes(target));
          });
          if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
            const val = String(row[matchedKey]).trim();
            if (val && val.toLowerCase() !== 'null' && val.toLowerCase() !== 'undefined') {
              return val;
            }
          }
        }
        return '';
      };

      const idNumber = getValue('id_number', 'idnumber', 'nic', 'id');
      let studentName = getValue('student_name', 'studentname', 'name', 'full_name', 'fullname', 'student');
      let phone = getValue('phone_number', 'phonenumber', 'phone', 'mobile', 'mobile_number', 'contact', 'tel');
      const address = getValue('address', 'addr', 'residence');
      const gender = getValue('gender', 'sex');
      const dob = getValue('date_of_birth', 'dateofbirth', 'dob', 'birth_date', 'birthdate');
      const parentName = getValue('parent_name', 'parentname', 'guardian_name', 'guardianname', 'parent');
      let parentMobile = getValue('parent_mobile', 'parentmobile', 'guardian_phone', 'guardianphone', 'parent_phone');

      // Fallback if row is empty
      const nonArrayValues = Object.values(row).map(v => String(v).trim()).filter(v => v && v.toLowerCase() !== 'null' && v.toLowerCase() !== 'undefined');
      if (nonArrayValues.length === 0) {
        skippedCount++;
        continue;
      }

      if (!studentName) {
        const textValue = nonArrayValues.find(v => isNaN(v) && v.length > 2);
        if (textValue) studentName = textValue;
      }

      if (!studentName && !phone && !idNumber) {
        skippedCount++;
        continue;
      }

      if (phone && /^\d{9}$/.test(phone)) {
        phone = '0' + phone;
      }
      if (parentMobile && /^\d{9}$/.test(parentMobile)) {
        parentMobile = '0' + parentMobile;
      }

      const cleanName = studentName ? studentName.trim().toLowerCase().replace(/\s+/g, ' ') : '';
      let existingRecord = cleanName ? existingByNameMap.get(cleanName) : (phone ? existingByPhoneMap.get(phone) : null);

      const parsedName = parseStudentName(studentName);
      const firstName = parsedName.firstName;
      const lastName = parsedName.lastName;

      if (existingRecord) {
        // UPDATE existing student record with all detailed fields
        await prisma.physicalStudent.update({
          where: { id: existingRecord.id },
          data: {
            studentName: studentName || existingRecord.studentName,
            firstName: firstName || existingRecord.firstName,
            lastName: lastName || existingRecord.lastName,
            nic: idNumber || existingRecord.nic,
            phone: phone || existingRecord.phone,
            address: address || existingRecord.address,
            gender: gender || existingRecord.gender,
            dob: dob || existingRecord.dob,
            guardianName: parentName || existingRecord.guardianName,
            guardianPhone: parentMobile || existingRecord.guardianPhone,
            classId: parsedClassId || existingRecord.classId,
            schoolId: parsedSchoolId || existingRecord.schoolId
          }
        });
        updatedCount++;
      } else {
        // CREATE new student record
        const generatedStudentId = `PHY-STU-${nextStudentNum++}`;
        const newStu = await prisma.physicalStudent.create({
          data: {
            studentId: generatedStudentId,
            studentName: studentName || `${firstName} ${lastName}`.trim(),
            firstName,
            lastName,
            nic: idNumber || null,
            phone: phone || null,
            address: address || null,
            gender: gender || null,
            dob: dob || null,
            guardianName: parentName || null,
            guardianPhone: parentMobile || null,
            classId: parsedClassId,
            schoolId: parsedSchoolId,
            registrationFeeStatus: 'PENDING'
          }
        });
        if (cleanName) existingByNameMap.set(cleanName, newStu);
        if (phone) existingByPhoneMap.set(phone, newStu);
        importedCount++;
      }
    }

    console.log(`[Bulk Excel Import] Upsert Complete! New: ${importedCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`);

    return res.json({
      success: true,
      importedCount,
      updatedCount,
      skippedCount
    });

  } catch (error) {
    console.error('[Bulk Excel Import Error]:', error);
    return res.status(500).json({ error: 'Bulk import failed: ' + error.message });
  }
};

exports.allocateExcelToClass = async (req, res) => {
  try {
    const file = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);
    if (!file) {
      return res.status(400).json({ error: 'Please upload an Excel file (.xlsx, .xls, .csv).' });
    }

    const { classId, autoCreateUnmatched } = req.body;
    if (!classId) {
      return res.status(400).json({ error: 'Please select a target Class to allocate students to.' });
    }

    const targetClassId = parseInt(classId);
    const targetClass = await prisma.physicalClass.findUnique({
      where: { id: targetClassId },
      include: { teachers: true }
    });

    if (!targetClass) {
      return res.status(404).json({ error: 'Target Class not found in database.' });
    }

    let fileBuffer = file.buffer;
    if (!fileBuffer && file.path && fs.existsSync(file.path)) {
      fileBuffer = fs.readFileSync(file.path);
    }
    if (!fileBuffer) {
      return res.status(400).json({ error: 'Could not read uploaded file content.' });
    }

    let workbook;
    try {
      workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    } catch (readErr) {
      console.error('[Class Allocator] Failed to read Excel workbook:', readErr);
      return res.status(400).json({ error: 'Could not parse Excel file format. Please upload a valid .xlsx or .csv file.' });
    }
    const sheetName = workbook.SheetNames[0];
    const rawRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      return res.status(400).json({ error: 'The uploaded Excel sheet is empty.' });
    }

    // Helper: Normalize phone to 9 digits (e.g. 0771234567, 94771234567, 771234567 -> 771234567)
    const normalizePhone = (p) => {
      if (!p) return '';
      const digits = String(p).replace(/\D/g, '');
      if (digits.length >= 9) {
        return digits.slice(-9);
      }
      return digits;
    };

    // Helper: Normalize name
    const normalizeName = (n) => {
      if (!n) return '';
      return String(n)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    // Load all existing students with their enrollments
    const existingStudents = await prisma.physicalStudent.findMany({
      include: {
        enrollments: true,
        class: true
      }
    });

    // Build fast lookup maps
    const phoneMap = new Map();
    const nameMap = new Map();

    for (const s of existingStudents) {
      const p1 = normalizePhone(s.phone);
      if (p1) phoneMap.set(p1, s);
      const p2 = normalizePhone(s.guardianPhone);
      if (p2 && !phoneMap.has(p2)) phoneMap.set(p2, s);
      const p3 = normalizePhone(s.whatsapp);
      if (p3 && !phoneMap.has(p3)) phoneMap.set(p3, s);
      const p4 = normalizePhone(s.guardianWhatsapp);
      if (p4 && !phoneMap.has(p4)) phoneMap.set(p4, s);

      const n1 = normalizeName(s.studentName);
      if (n1) nameMap.set(n1, s);
      const n2 = normalizeName(`${s.firstName || ''} ${s.lastName || ''}`);
      if (n2 && !nameMap.has(n2)) nameMap.set(n2, s);
    }

    let nextStudentNum = 10001;
    try {
      const maxRes = await prisma.$queryRaw`
        SELECT MAX(CAST(SUBSTRING(studentId, 9) AS UNSIGNED)) as maxId 
        FROM PhysicalStudent 
        WHERE studentId LIKE 'PHY-STU-%'
      `;
      if (maxRes && maxRes[0] && maxRes[0].maxId != null) {
        nextStudentNum = Number(maxRes[0].maxId) + 1;
      }
    } catch (e) {
      nextStudentNum = Math.max(15000, existingStudents.length + 10000 + 1);
    }
    let matchedCount = 0;
    let allocatedCount = 0;
    let alreadyEnrolledCount = 0;
    let unmatchedCount = 0;
    let autoCreatedCount = 0;

    const allocatedList = [];
    const alreadyEnrolledList = [];
    const unmatchedList = [];

    // Header value extractor
    const getRowValue = (row, ...keys) => {
      for (const k of keys) {
        const target = k.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchedKey = Object.keys(row).find(rk => {
          const cleanKey = rk.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          return cleanKey === target || (cleanKey.length >= 3 && target.includes(cleanKey)) || (target.length >= 3 && cleanKey.includes(target));
        });
        if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
          const val = String(row[matchedKey]).trim();
          if (val && val.toLowerCase() !== 'null' && val.toLowerCase() !== 'undefined') {
            return val;
          }
        }
      }
      return '';
    };

    const shouldAutoCreate = autoCreateUnmatched === true || autoCreateUnmatched === 'true';

    for (let idx = 0; idx < rawRows.length; idx++) {
      const row = rawRows[idx];

      const rawName = getRowValue(row, 'student_name', 'studentname', 'name', 'full_name', 'fullname', 'student', 'student name', 'p.name', 'p_name');
      const rawPhone = getRowValue(row, 'p.phone', 'pphone', 'p_phone', 'phone', 'phone_number', 'phonenumber', 'mobile', 'mobile_number', 'contact', 'parent_phone', 'parent_mobile', 'guardian_phone', 'tel');
      const rawNic = getRowValue(row, 'id_number', 'idnumber', 'nic', 'id', 'student_id');

      // Skip row if completely blank
      if (!rawName && !rawPhone && !rawNic) {
        continue;
      }

      const normP = normalizePhone(rawPhone);
      const normN = normalizeName(rawName);

      let matchedStudent = null;
      if (normP && phoneMap.has(normP)) {
        matchedStudent = phoneMap.get(normP);
      } else if (normN && nameMap.has(normN)) {
        matchedStudent = nameMap.get(normN);
      }

      if (matchedStudent) {
        matchedCount++;

        // Check if student is already enrolled in this class
        const isAlreadyEnrolled = 
          matchedStudent.classId === targetClassId || 
          (matchedStudent.enrollments && matchedStudent.enrollments.some(e => e.classId === targetClassId));

        if (isAlreadyEnrolled) {
          alreadyEnrolledCount++;
          alreadyEnrolledList.push({
            id: matchedStudent.id,
            studentId: matchedStudent.studentId,
            studentName: matchedStudent.studentName,
            phone: matchedStudent.phone || rawPhone,
            guardianPhone: matchedStudent.guardianPhone,
            excelName: rawName,
            excelPhone: rawPhone
          });
        } else {
          // Allocate student to this class
          if (!matchedStudent.classId) {
            await prisma.physicalStudent.update({
              where: { id: matchedStudent.id },
              data: { classId: targetClassId }
            });
            matchedStudent.classId = targetClassId;
          }

          // Create enrollment in PhysicalStudentClassEnrollment
          await prisma.physicalStudentClassEnrollment.upsert({
            where: {
              studentId_classId: {
                studentId: matchedStudent.id,
                classId: targetClassId
              }
            },
            create: {
              studentId: matchedStudent.id,
              classId: targetClassId
            },
            update: {}
          });

          if (!matchedStudent.enrollments) matchedStudent.enrollments = [];
          matchedStudent.enrollments.push({ classId: targetClassId });

          allocatedCount++;
          allocatedList.push({
            id: matchedStudent.id,
            studentId: matchedStudent.studentId,
            studentName: matchedStudent.studentName,
            phone: matchedStudent.phone || rawPhone,
            guardianPhone: matchedStudent.guardianPhone,
            excelName: rawName,
            excelPhone: rawPhone
          });
        }
      } else {
        if (shouldAutoCreate && (rawName || rawPhone)) {
          const parsedName = parseStudentName(rawName);
          const firstName = parsedName.firstName;
          const lastName = parsedName.lastName;
          let formattedPhone = rawPhone;
          if (formattedPhone && /^\d{9}$/.test(formattedPhone)) {
            formattedPhone = '0' + formattedPhone;
          }

          const generatedStudentId = `PHY-STU-${nextStudentNum++}`;
          const newStu = await prisma.physicalStudent.create({
            data: {
              studentId: generatedStudentId,
              studentName: rawName || `${firstName} ${lastName}`.trim(),
              firstName,
              lastName,
              phone: formattedPhone || null,
              guardianPhone: formattedPhone || null,
              classId: targetClassId,
              registrationFeeStatus: 'PENDING',
              enrollments: {
                create: { classId: targetClassId }
              }
            }
          });

          if (normP) phoneMap.set(normP, newStu);
          if (normN) nameMap.set(normN, newStu);

          autoCreatedCount++;
          allocatedCount++;
          allocatedList.push({
            id: newStu.id,
            studentId: newStu.studentId,
            studentName: newStu.studentName,
            phone: newStu.phone,
            excelName: rawName,
            excelPhone: rawPhone,
            isNew: true
          });
        } else {
          unmatchedCount++;
          unmatchedList.push({
            rowIdx: idx + 1,
            name: rawName || 'No Name',
            phone: rawPhone || 'No Phone'
          });
        }
      }
    }

    return res.json({
      success: true,
      totalInExcel: rawRows.length,
      matchedCount,
      allocatedCount,
      alreadyEnrolledCount,
      unmatchedCount,
      autoCreatedCount,
      targetClass: {
        id: targetClass.id,
        name: targetClass.name,
        grade: targetClass.grade,
        stream: targetClass.stream,
        subject: targetClass.subject,
        teachers: targetClass.teachers || []
      },
      allocatedList,
      alreadyEnrolledList,
      unmatchedList
    });

  } catch (error) {
    console.error('[Allocate Excel To Class Error]:', error);
    return res.status(500).json({ error: 'Failed to allocate students: ' + error.message });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const sId = parseInt(id);

    // Safeguard: Check if student has fee payments or active financial transactions
    const hasPayments = await prisma.physicalClassFeePayment.count({
      where: { studentId: sId }
    });
    const hasTransactions = await prisma.physicalTransaction.count({
      where: { studentId: sId, isDeleted: false }
    });

    const force = req.query.force === 'true';

    if ((hasPayments > 0 || hasTransactions > 0) && !force) {
      return res.status(400).json({
        error: `Cannot delete student because they have ${hasPayments} historical fee payment(s) and ${hasTransactions} cashflow transaction(s). Deleting the student would permanently wipe these accounting records. Please de-allocate/drop the student's classes instead to preserve cashflow integrity.`,
        hasFinancialRecords: true
      });
    }

    await prisma.physicalStudent.delete({
      where: { id: sId },
    });
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// CLASSES
exports.getClasses = async (req, res) => {
  try {
    const classes = await prisma.physicalClass.findMany({
      include: { 
        teachers: true, 
        timetables: { 
          include: { hall: true } 
        } 
      },
      orderBy: { id: 'desc' }
    });
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createClass = async (req, res) => {
  try {
    const { name, grade, stream, subject, monthlyFee, fee, startMonth, activeMonths, timetables } = req.body;
    const feeVal = monthlyFee !== undefined && monthlyFee !== null && monthlyFee !== ''
      ? parseFloat(monthlyFee)
      : (fee !== undefined && fee !== null && fee !== '' ? parseFloat(fee) : 0);

    let parsedActiveMonths = activeMonths;
    if (typeof activeMonths === 'string') {
      try { parsedActiveMonths = JSON.parse(activeMonths); } catch (e) { parsedActiveMonths = [activeMonths]; }
    }

    const phyClass = await prisma.physicalClass.create({
      data: {
        name,
        grade,
        stream,
        subject,
        monthlyFee: isNaN(feeVal) ? 0 : feeVal,
        startMonth: startMonth || null,
        activeMonths: parsedActiveMonths || (startMonth ? [startMonth] : null),
        ...(timetables && timetables.length > 0 && {
          timetables: {
            create: timetables.map(t => ({
              dayOfWeek: t.dayOfWeek,
              startTime: t.startTime,
              endTime: t.endTime,
              hallId: t.hallId ? parseInt(t.hallId) : null,
              hallName: t.hallName || (t.hall ? t.hall.name : null) || null
            }))
          }
        })
      },
      include: { teachers: true, timetables: { include: { hall: true } } }
    });
    res.status(201).json(phyClass);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, grade, stream, subject, monthlyFee, fee, startMonth, activeMonths, timetables } = req.body;
    const feeVal = monthlyFee !== undefined && monthlyFee !== null && monthlyFee !== ''
      ? parseFloat(monthlyFee)
      : (fee !== undefined && fee !== null && fee !== '' ? parseFloat(fee) : 0);

    let parsedActiveMonths = activeMonths;
    if (typeof activeMonths === 'string') {
      try { parsedActiveMonths = JSON.parse(activeMonths); } catch (e) { parsedActiveMonths = [activeMonths]; }
    }

    if (timetables) {
      await prisma.physicalTimetable.deleteMany({
        where: { classId: parseInt(id) }
      });
    }

    const phyClass = await prisma.physicalClass.update({
      where: { id: Number(id) },
      data: {
        name,
        grade,
        stream,
        subject,
        monthlyFee: isNaN(feeVal) ? 0 : feeVal,
        startMonth: startMonth !== undefined ? startMonth : undefined,
        activeMonths: parsedActiveMonths !== undefined ? parsedActiveMonths : undefined,
        ...(timetables && {
          timetables: {
            create: timetables.map(t => ({
              dayOfWeek: t.dayOfWeek,
              startTime: t.startTime,
              endTime: t.endTime,
              hallId: t.hallId ? parseInt(t.hallId) : null,
              hallName: t.hallName || (t.hall ? t.hall.name : null) || null
            }))
          }
        })
      },
      include: { teachers: true, timetables: { include: { hall: true } } }
    });
    res.json(phyClass);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// HALLS
exports.getHalls = async (req, res) => {
  try {
    const halls = await prisma.hall.findMany({
      orderBy: { id: 'asc' }
    });
    res.json(halls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createHall = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Hall name is required' });
    const hall = await prisma.hall.create({
      data: { name: name.trim() }
    });
    res.status(201).json(hall);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.physicalClass.delete({
      where: { id: parseInt(id) },
    });
    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// TEACHERS
exports.getTeachers = async (req, res) => {
  try {
    const teachers = await prisma.physicalTeacher.findMany({
      include: {
        classes: {
          include: { timetables: { include: { hall: true } } }
        },
        timetables: { include: { hall: true } }
      },
      orderBy: { id: 'desc' }
    });
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createTeacher = async (req, res) => {
  try {
    const { lecturerId, name, image, address, whatsapp, phone, classIds, instituteCut, timetables } = req.body;
    const processedImage = saveBase64Image(image);
    
    // Auto-generate lecturerId if not explicitly provided (e.g. IMA-LEC-1026)
    let assignedLecturerId = lecturerId ? lecturerId.trim().toUpperCase() : null;
    if (!assignedLecturerId) {
      const maxTeacher = await prisma.physicalTeacher.findFirst({
        orderBy: { id: 'desc' },
        select: { id: true }
      });
      const nextNum = (maxTeacher ? maxTeacher.id : 0) + 1;
      assignedLecturerId = `IMA-LEC-${1000 + nextNum}`;
    }

    const teacher = await prisma.physicalTeacher.create({
      data: {
        lecturerId: assignedLecturerId,
        name,
        image: processedImage,
        address,
        whatsapp,
        phone,
        instituteCut: instituteCut ? parseFloat(instituteCut) : 0,
        classes: {
          connect: classIds && classIds.length > 0 ? classIds.map(id => ({ id: parseInt(id) })) : []
        },
        timetables: {
          create: timetables || [] // [{ dayOfWeek, startTime, endTime }]
        }
      },
      include: { classes: true, timetables: true }
    });
    res.status(201).json(teacher);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const { lecturerId, name, image, address, whatsapp, phone, classIds, instituteCut, timetables } = req.body;
    const processedImage = saveBase64Image(image);
    
    // Simplest way to update timetables: delete old and create new
    if (timetables) {
        await prisma.physicalTimetable.deleteMany({
            where: { teacherId: parseInt(id) }
        });
    }

    const updateData = {
      name,
      image: processedImage,
      address,
      whatsapp,
      phone,
      instituteCut: instituteCut ? parseFloat(instituteCut) : 0,
      classes: {
        set: classIds && classIds.length > 0 ? classIds.map(id => ({ id: parseInt(id) })) : []
      },
      ...(timetables && {
        timetables: {
          create: timetables
        }
      })
    };

    if (lecturerId && lecturerId.trim()) {
      updateData.lecturerId = lecturerId.trim().toUpperCase();
    }

    const teacher = await prisma.physicalTeacher.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: { classes: true, timetables: true }
    });
    res.json(teacher);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.physicalTeacher.delete({
      where: { id: parseInt(id) },
    });
    res.json({ message: 'Teacher deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- CLASS FEE MATRIX & PAYMENT MANAGEMENT ---
exports.getClassFeeMatrix = async (req, res) => {
  try {
    const { classId } = req.params;
    const clsId = parseInt(classId);

    const phyClass = await prisma.physicalClass.findUnique({
      where: { id: clsId },
      include: {
        teachers: true,
        timetables: true
      }
    });

    if (!phyClass) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Get all students enrolled in this class
    const enrollments = await prisma.physicalStudentClassEnrollment.findMany({
      where: { classId: clsId },
      include: {
        student: {
          include: {
            school: true
          }
        }
      }
    });

    // Also include students who have this class as their primary classId
    const primaryStudents = await prisma.physicalStudent.findMany({
      where: {
        classId: clsId,
        id: { notIn: enrollments.map(e => e.studentId) }
      },
      include: { school: true }
    });

    const allStudents = [
      ...enrollments.map(e => ({
        ...e.student,
        enrollmentCreatedAt: e.createdAt || e.student.createdAt,
        enrollmentCardType: e.cardType || e.student.cardType
      })),
      ...primaryStudents.map(s => ({
        ...s,
        enrollmentCreatedAt: s.createdAt,
        enrollmentCardType: s.cardType
      }))
    ].filter(s => s && s.id);

    // Sort students by name
    allStudents.sort((a, b) => {
      const nameA = (a.studentName || `${a.firstName || ''} ${a.lastName || ''}`).toLowerCase();
      const nameB = (b.studentName || `${b.firstName || ''} ${b.lastName || ''}`).toLowerCase();
      return nameA.localeCompare(nameB);
    });

    // Get all fee payments recorded for this class
    const payments = await prisma.physicalClassFeePayment.findMany({
      where: { classId: clsId }
    });

    // Parse active months
    let activeMonths = [];
    if (Array.isArray(phyClass.activeMonths)) {
      activeMonths = [...phyClass.activeMonths];
    } else if (typeof phyClass.activeMonths === 'string') {
      try { activeMonths = JSON.parse(phyClass.activeMonths); } catch (e) { activeMonths = [phyClass.activeMonths]; }
    } else if (phyClass.startMonth) {
      activeMonths = [phyClass.startMonth];
    }

    // Also include any months recorded in payments for this class
    payments.forEach(p => {
      if (p.month && !activeMonths.includes(p.month)) {
        activeMonths.push(p.month);
      }
    });

    // If still empty or limited, guarantee recent months
    if (activeMonths.length === 0) {
      const now = new Date();
      for (let offset = -1; offset <= 3; offset++) {
        const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        activeMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    }
    activeMonths.sort().reverse();

    // Map payments by `${studentId}_${month}`
    const paymentMap = new Map();
    payments.forEach(p => {
      paymentMap.set(`${p.studentId}_${p.month}`, p);
    });

    // Monthly summary stats - calculated dynamically based on student active enrollment
    const monthlySummary = {};
    activeMonths.forEach(m => {
      monthlySummary[m] = {
        month: m,
        totalEnrolled: 0,
        paidCount: 0,
        unpaidCount: 0,
        freeCount: 0,
        grossAmount: 0,
        expectedGross: 0
      };
    });

    // Format students with their month breakdown
    const studentsWithMonths = allStudents.map(student => {
      const monthsData = {};
      let totalPaidForStudent = 0;
      let totalPendingForStudent = 0;

      const enrollDate = student.enrollmentCreatedAt || student.createdAt;
      let enrollMonth = null;
      if (enrollDate) {
        const ed = new Date(enrollDate);
        if (!isNaN(ed.getTime())) {
          enrollMonth = `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, '0')}`;
        }
      }

      const effectiveCardType = student.enrollmentCardType || student.cardType || 'FULL';
      const standardMonthlyFee = phyClass.monthlyFee || 0;
      const expectedStudentFee = effectiveCardType === 'FREE' ? 0 : (effectiveCardType === 'HALF' ? standardMonthlyFee / 2 : standardMonthlyFee);

      activeMonths.forEach(m => {
        const pay = paymentMap.get(`${student.id}_${m}`);
        const isBeforeEnrollment = !pay && enrollMonth && m < enrollMonth;

        if (pay && (pay.status === 'PAID' || pay.status === 'HALF_PAYMENT')) {
          monthsData[m] = {
            status: pay.status,
            amount: pay.amount !== undefined ? pay.amount : expectedStudentFee,
            paidDate: pay.paidDate,
            paymentMethod: pay.paymentMethod,
            id: pay.id,
            isBeforeEnrollment: false
          };
          totalPaidForStudent++;
          if (monthlySummary[m]) {
            monthlySummary[m].totalEnrolled++;
            monthlySummary[m].paidCount++;
            monthlySummary[m].grossAmount += (pay.amount !== undefined ? pay.amount : expectedStudentFee);
            monthlySummary[m].expectedGross += expectedStudentFee;
          }
        } else if (pay && pay.status === 'FREE_CARD') {
          monthsData[m] = {
            status: 'FREE_CARD',
            amount: 0,
            paidDate: pay.paidDate,
            id: pay.id,
            isBeforeEnrollment: false
          };
          if (monthlySummary[m]) {
            monthlySummary[m].totalEnrolled++;
            monthlySummary[m].freeCount++;
          }
        } else if (isBeforeEnrollment) {
          monthsData[m] = {
            status: 'NOT_ENROLLED',
            amount: 0,
            paidDate: null,
            id: null,
            isBeforeEnrollment: true,
            enrollMonth
          };
          // Student was NOT enrolled in this class in month m.
          // Do NOT count as unpaid or pending.
        } else {
          const isStudentFree = effectiveCardType === 'FREE';
          monthsData[m] = {
            status: isStudentFree ? 'FREE_CARD' : 'PENDING',
            amount: isStudentFree ? 0 : expectedStudentFee,
            paidDate: null,
            id: pay ? pay.id : null,
            isBeforeEnrollment: false
          };
          if (isStudentFree) {
            if (monthlySummary[m]) {
              monthlySummary[m].totalEnrolled++;
              monthlySummary[m].freeCount++;
            }
          } else {
            totalPendingForStudent++;
            if (monthlySummary[m]) {
              monthlySummary[m].totalEnrolled++;
              monthlySummary[m].unpaidCount++;
              monthlySummary[m].expectedGross += expectedStudentFee;
            }
          }
        }
      });

      const totalEligibleMonths = activeMonths.filter(m => !enrollMonth || m >= enrollMonth).length;

      return {
        id: student.id,
        studentId: student.studentId,
        studentName: student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim(),
        firstName: student.firstName,
        lastName: student.lastName,
        phone: student.phone,
        whatsapp: student.whatsapp,
        guardianName: student.guardianName,
        guardianPhone: student.guardianPhone,
        school: student.school ? student.school.name : null,
        registrationFeeStatus: student.registrationFeeStatus || 'PENDING',
        registrationFeeAmount: student.registrationFeeAmount || 1000,
        cardType: effectiveCardType,
        enrollmentCreatedAt: student.enrollmentCreatedAt,
        enrollmentMonth: enrollMonth,
        months: monthsData,
        totalPaidMonths: totalPaidForStudent,
        totalPendingMonths: totalPendingForStudent,
        totalEligibleMonths
      };
    });

    res.json({
      class: {
        id: phyClass.id,
        name: phyClass.name,
        grade: phyClass.grade,
        stream: phyClass.stream,
        subject: phyClass.subject,
        monthlyFee: phyClass.monthlyFee || 0,
        startMonth: phyClass.startMonth,
        activeMonths,
        teachers: phyClass.teachers,
        timetables: phyClass.timetables
      },
      activeMonths,
      monthlySummary,
      totalStudents: allStudents.length,
      students: studentsWithMonths
    });

  } catch (error) {
    console.error('Error fetching class fee matrix:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.toggleStudentFeePayment = async (req, res) => {
  try {
    const { studentId, classId, month, status, amount, isIncremental, paymentMethod, remark } = req.body;

    if (!studentId || !classId || !month) {
      return res.status(400).json({ error: 'studentId, classId, and month are required' });
    }

    const sId = parseInt(studentId);
    const cId = parseInt(classId);
    const targetStatus = (status || 'PAID').toUpperCase();

    const targetClass = await prisma.physicalClass.findUnique({
      where: { id: cId }
    });

    const targetStudent = await prisma.physicalStudent.findUnique({
      where: { id: sId }
    });

    if (!targetClass || !targetStudent) {
      return res.status(404).json({ error: 'Student or Class not found' });
    }

    // Check enrollment specific cardType or student default cardType
    const enrollment = await prisma.physicalStudentClassEnrollment.findUnique({
      where: {
        studentId_classId: {
          studentId: sId,
          classId: cId
        }
      }
    });

    const effectiveCardType = enrollment?.cardType || targetStudent.cardType || 'FULL';

    // Calculate full expected fee based on card type
    let expectedFee = 0;
    if (effectiveCardType === 'FREE') {
      expectedFee = 0;
    } else if (effectiveCardType === 'HALF') {
      expectedFee = (targetClass.monthlyFee || 0) / 2;
    } else {
      expectedFee = targetClass.monthlyFee || 0;
    }

    if (targetStatus === 'PENDING' || targetStatus === 'UNPAID') {
      // Remove payment record or set status PENDING
      await prisma.physicalClassFeePayment.deleteMany({
        where: {
          studentId: sId,
          classId: cId,
          month
        }
      });

      // NOTE: Attendance Portal status changes must NEVER delete historical PhysicalTransaction records.
      // Physical cash collected at the counter on historical dates belongs to the cash register/drawer history.
      // Cash adjustments/refunds are handled exclusively via the Cash Flow Portal.

      return res.json({
        success: true,
        status: 'PENDING',
        paidAmount: 0,
        dueAmount: expectedFee,
        expectedFee,
        message: `Payment for ${month} marked as PENDING`
      });
    }

    // Find existing payment record to compute incremental amount if any
    const existingPayment = await prisma.physicalClassFeePayment.findUnique({
      where: {
        studentId_classId_month: {
          studentId: sId,
          classId: cId,
          month
        }
      }
    });

    // If class fee is already fully paid for this month, lock it against duplicate payments
    const isAlreadyFullyPaid = existingPayment && 
      (existingPayment.status === 'PAID' || existingPayment.status === 'FREE_CARD' || existingPayment.status === 'HALF_PAYMENT') &&
      ((existingPayment.amount || 0) >= expectedFee || effectiveCardType === 'FREE');

    if (isAlreadyFullyPaid && targetStatus !== 'PENDING' && targetStatus !== 'UNPAID' && !isIncremental && (amount === undefined || amount === null || amount === '')) {
      return res.status(400).json({
        error: `Class fee for ${month} is already fully paid. To adjust the amount, please enter a custom amount or mark as unpaid.`,
        payment: existingPayment
      });
    }

    let paidAmount = 0;
    if (amount !== undefined && amount !== null && amount !== '') {
      const inputAmount = parseFloat(amount);
      if (isIncremental && existingPayment) {
        paidAmount = (existingPayment.amount || 0) + inputAmount;
      } else {
        paidAmount = inputAmount;
      }
    } else {
      paidAmount = expectedFee;
    }

    let finalStatus = 'PAID';
    if (effectiveCardType === 'FREE') {
      finalStatus = 'FREE_CARD';
      paidAmount = 0;
    } else if (effectiveCardType === 'HALF') {
      if (paidAmount >= expectedFee) {
        finalStatus = 'HALF_PAYMENT';
      } else if (paidAmount > 0) {
        finalStatus = 'PARTIAL';
      } else {
        finalStatus = 'PENDING';
      }
    } else if (paidAmount >= expectedFee) {
      finalStatus = 'PAID';
    } else if (paidAmount > 0 && paidAmount < expectedFee) {
      finalStatus = 'PARTIAL';
    } else {
      finalStatus = 'PENDING';
    }

    const dueAmount = Math.max(0, expectedFee - paidAmount);

    // Upsert payment record
    const payment = await prisma.physicalClassFeePayment.upsert({
      where: {
        studentId_classId_month: {
          studentId: sId,
          classId: cId,
          month
        }
      },
      update: {
        status: finalStatus,
        amount: paidAmount,
        paidDate: (existingPayment && (existingPayment.status === 'PAID' || existingPayment.status === 'HALF_PAYMENT') && existingPayment.paidDate) ? existingPayment.paidDate : new Date(),
        paymentMethod: paymentMethod || 'CASH',
        remark: remark || null
      },
      create: {
        studentId: sId,
        classId: cId,
        month,
        status: finalStatus,
        amount: paidAmount,
        paidDate: new Date(),
        paymentMethod: paymentMethod || 'CASH',
        remark: remark || null
      }
    });

    // Compute delta amount for PhysicalTransaction cash flow
    const previousAmount = existingPayment ? (existingPayment.amount || 0) : 0;
    const deltaAmount = Math.max(0, paidAmount - previousAmount);

    let transaction = null;
    const sName = targetStudent.studentName || `${targetStudent.firstName || ''} ${targetStudent.lastName || ''}`.trim() || 'Student';

    if (deltaAmount > 0) {
      const transDesc = finalStatus === 'PARTIAL'
        ? `Class Fee Partial (${month}) - ${targetClass.name} - ${targetStudent.studentId} (${sName}) [Paid: Rs. ${paidAmount.toLocaleString()} / Total: Rs. ${expectedFee.toLocaleString()} (Due: Rs. ${dueAmount.toLocaleString()})]`
        : `Class Fee (${month}) - ${targetClass.name} - ${targetStudent.studentId} (${sName}) [${effectiveCardType} CARD]`;

      transaction = await prisma.physicalTransaction.create({
        data: {
          type: 'INCOME',
          category: 'Class Fee',
          amount: deltaAmount,
          description: transDesc,
          studentId: sId,
          isDeleted: false
        }
      });
    }

    const receiptNo = transaction ? `REC-${transaction.id}` : `CF-${payment.id}`;

    // Trigger automated fee payment SMS notification
    if (deltaAmount > 0 || paidAmount > 0) {
      esmsService.triggerFeePaymentSms({
        student: targetStudent,
        studentId: sId,
        paidAmount: deltaAmount > 0 ? deltaAmount : paidAmount,
        expectedFee,
        dueAmount,
        month,
        className: targetClass.name,
        classNames: [targetClass.name],
        receiptNo,
        paymentMethod: paymentMethod || 'CASH',
        cardType: effectiveCardType,
        isBulk: false
      }).catch(smsErr => {
        console.error('[Automated Fee Payment SMS Error]:', smsErr.message);
      });
    }

    res.json({
      success: true,
      payment,
      transaction,
      expectedFee,
      paidAmount,
      dueAmount,
      status: finalStatus,
      receiptData: {
        receiptNo: transaction ? `REC-${transaction.id}` : `CF-${payment.id}`,
        studentId: targetStudent.studentId,
        studentName: sName,
        guardianPhone: targetStudent.guardianPhone || targetStudent.phone || '',
        className: targetClass.name,
        month,
        cardType: effectiveCardType,
        amount: paidAmount,
        deltaAmount: deltaAmount > 0 ? deltaAmount : paidAmount,
        expectedFee,
        dueAmount,
        paymentMethod: paymentMethod || 'CASH',
        paidDate: payment.paidDate || new Date(),
        status: finalStatus,
        items: [
          {
            description: `Class Fee - ${targetClass.name}`,
            month,
            cardType: `${effectiveCardType} CARD`,
            amount: paidAmount,
            expectedFee,
            dueAmount
          }
        ],
        totalAmount: paidAmount
      },
      message: `Payment for ${month} saved successfully as ${finalStatus}!`
    });

  } catch (error) {
    console.error('Error toggling fee payment:', error);
    res.status(500).json({ error: error.message });
  }
};

// --- BULK MULTI-CLASS FEE PAYMENT & CONSOLIDATED RECEIPT ---
exports.bulkStudentFeePayment = async (req, res) => {
  try {
    const { studentId, month, paymentMethod = 'CASH', remark, payments } = req.body;

    if (!studentId || !month) {
      return res.status(400).json({ error: 'studentId and month are required' });
    }

    const sId = parseInt(studentId);
    const targetStudent = await prisma.physicalStudent.findUnique({
      where: { id: sId },
      include: {
        enrollments: {
          include: { class: true }
        },
        class: true
      }
    });

    if (!targetStudent) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const sName = targetStudent.studentName || `${targetStudent.firstName || ''} ${targetStudent.lastName || ''}`.trim() || 'Student';

    // If payments array is provided, use it; otherwise, collect all enrolled classes
    let itemsToProcess = [];
    if (Array.isArray(payments) && payments.length > 0) {
      itemsToProcess = payments;
    } else {
      const classMap = new Map();
      if (targetStudent.class) {
        classMap.set(targetStudent.class.id, {
          classId: targetStudent.class.id,
          cardType: targetStudent.cardType || 'FULL',
          monthlyFee: targetStudent.class.monthlyFee || 0,
          class: targetStudent.class
        });
      }
      if (targetStudent.enrollments) {
        targetStudent.enrollments.forEach(e => {
          if (e.class) {
            classMap.set(e.class.id, {
              classId: e.class.id,
              cardType: e.cardType || targetStudent.cardType || 'FULL',
              monthlyFee: e.class.monthlyFee || 0,
              class: e.class
            });
          }
        });
      }
      itemsToProcess = Array.from(classMap.values());
    }

    if (itemsToProcess.length === 0) {
      return res.status(400).json({ error: 'No classes to process payment for' });
    }

    const processedPayments = [];
    const receiptItems = [];
    let totalPaidAmount = 0;
    let totalExpectedFee = 0;
    let totalDueAmount = 0;
    let totalDeltaAmount = 0;
    const classNames = [];

    for (const item of itemsToProcess) {
      const cId = parseInt(item.classId);
      if (!cId) continue;

      const targetClass = await prisma.physicalClass.findUnique({
        where: { id: cId }
      });

      if (!targetClass) continue;

      // Check enrollment specific cardType or student default cardType
      const enrollment = await prisma.physicalStudentClassEnrollment.findUnique({
        where: {
          studentId_classId: {
            studentId: sId,
            classId: cId
          }
        }
      });

      const effectiveCardType = enrollment?.cardType || item.cardType || targetStudent.cardType || 'FULL';

      let expectedFee = 0;
      if (effectiveCardType === 'FREE') {
        expectedFee = 0;
      } else if (effectiveCardType === 'HALF') {
        expectedFee = (targetClass.monthlyFee || 0) / 2;
      } else {
        expectedFee = targetClass.monthlyFee || 0;
      }

      // Existing payment
      const existingPayment = await prisma.physicalClassFeePayment.findUnique({
        where: {
          studentId_classId_month: {
            studentId: sId,
            classId: cId,
            month
          }
        }
      });

      // If class fee is already fully paid for this month, skip to avoid double payment
      const isAlreadyFullyPaid = existingPayment && 
        (existingPayment.status === 'PAID' || existingPayment.status === 'FREE_CARD' || existingPayment.status === 'HALF_PAYMENT') &&
        ((existingPayment.amount || 0) >= expectedFee || effectiveCardType === 'FREE');

      if (isAlreadyFullyPaid && !item.isIncremental) {
        continue;
      }

      let paidAmount = 0;
      if (item.amount !== undefined && item.amount !== null && item.amount !== '') {
        const inputAmount = parseFloat(item.amount);
        if (item.isIncremental && existingPayment) {
          paidAmount = (existingPayment.amount || 0) + inputAmount;
        } else {
          paidAmount = inputAmount;
        }
      } else {
        paidAmount = expectedFee;
      }

      let finalStatus = 'PAID';
      if (effectiveCardType === 'FREE') {
        finalStatus = 'FREE_CARD';
        paidAmount = 0;
      } else if (effectiveCardType === 'HALF') {
        if (paidAmount >= expectedFee) {
          finalStatus = 'HALF_PAYMENT';
        } else if (paidAmount > 0) {
          finalStatus = 'PARTIAL';
        } else {
          finalStatus = 'PENDING';
        }
      } else if (paidAmount >= expectedFee) {
        finalStatus = 'PAID';
      } else if (paidAmount > 0 && paidAmount < expectedFee) {
        finalStatus = 'PARTIAL';
      } else {
        finalStatus = 'PENDING';
      }

      const dueAmount = Math.max(0, expectedFee - paidAmount);

      // Upsert payment record
      const payment = await prisma.physicalClassFeePayment.upsert({
        where: {
          studentId_classId_month: {
            studentId: sId,
            classId: cId,
            month
          }
        },
        update: {
          status: finalStatus,
          amount: paidAmount,
          paidDate: (existingPayment && (existingPayment.status === 'PAID' || existingPayment.status === 'HALF_PAYMENT') && existingPayment.paidDate) ? existingPayment.paidDate : new Date(),
          paymentMethod: paymentMethod || 'CASH',
          remark: remark || item.remark || null
        },
        create: {
          studentId: sId,
          classId: cId,
          month,
          status: finalStatus,
          amount: paidAmount,
          paidDate: new Date(),
          paymentMethod: paymentMethod || 'CASH',
          remark: remark || item.remark || null
        }
      });

      const previousAmount = existingPayment ? (existingPayment.amount || 0) : 0;
      const deltaAmount = Math.max(0, paidAmount - previousAmount);

      totalPaidAmount += paidAmount;
      totalExpectedFee += expectedFee;
      totalDueAmount += dueAmount;
      totalDeltaAmount += deltaAmount;
      classNames.push(targetClass.name);

      processedPayments.push(payment);
      receiptItems.push({
        classId: targetClass.id,
        className: targetClass.name,
        description: `Class Fee - ${targetClass.name}`,
        month,
        cardType: `${effectiveCardType} CARD`,
        amount: paidAmount,
        expectedFee,
        dueAmount,
        status: finalStatus
      });
    }

    // Single consolidated PhysicalTransaction for cash flow
    let transaction = null;
    if (totalDeltaAmount > 0) {
      const classSummaryStr = classNames.length <= 3 
        ? classNames.join(', ') 
        : `${classNames.length} Classes (${classNames.slice(0, 2).join(', ')} +${classNames.length - 2} more)`;

      const transDesc = `Multi-Class Fee (${month}) - ${classSummaryStr} - ${targetStudent.studentId} (${sName})`;

      transaction = await prisma.physicalTransaction.create({
        data: {
          type: 'INCOME',
          category: 'Class Fee',
          amount: totalDeltaAmount,
          description: transDesc,
          studentId: sId,
          isDeleted: false
        }
      });
    }

    const overallStatus = totalDueAmount === 0 ? 'PAID' : (totalPaidAmount > 0 ? 'PARTIAL' : 'PENDING');

    const receiptData = {
      receiptNo: transaction ? `REC-${transaction.id}` : `CF-${Date.now().toString().slice(-6)}`,
      studentId: targetStudent.studentId,
      studentName: sName,
      guardianPhone: targetStudent.guardianPhone || targetStudent.phone || '',
      className: classNames.length > 1 ? `Multi-Class Payment (${classNames.length} Classes)` : (classNames[0] || 'Class Fee'),
      month,
      cardType: 'MULTIPLE',
      amount: totalPaidAmount,
      totalAmount: totalPaidAmount,
      deltaAmount: totalDeltaAmount > 0 ? totalDeltaAmount : totalPaidAmount,
      expectedFee: totalExpectedFee,
      dueAmount: totalDueAmount,
      paymentMethod: paymentMethod || 'CASH',
      paidDate: new Date(),
      status: overallStatus,
      items: receiptItems,
      notes: `Keep this receipt for entrance & card verification (${receiptItems.length} classes).`
    };

    // Trigger automated bulk fee payment SMS notification
    if (totalDeltaAmount > 0 || totalPaidAmount > 0) {
      esmsService.triggerFeePaymentSms({
        student: targetStudent,
        studentId: sId,
        paidAmount: totalDeltaAmount > 0 ? totalDeltaAmount : totalPaidAmount,
        expectedFee: totalExpectedFee,
        dueAmount: totalDueAmount,
        month,
        className: classNames.length > 1 ? `Multi-Class Payment (${classNames.length} Classes)` : (classNames[0] || 'Class Fee'),
        classNames,
        receiptNo: receiptData.receiptNo,
        paymentMethod: paymentMethod || 'CASH',
        cardType: 'MULTIPLE',
        isBulk: true
      }).catch(smsErr => {
        console.error('[Automated Bulk Fee Payment SMS Error]:', smsErr.message);
      });
    }

    res.json({
      success: true,
      processedCount: processedPayments.length,
      payments: processedPayments,
      transaction,
      expectedFee: totalExpectedFee,
      paidAmount: totalPaidAmount,
      dueAmount: totalDueAmount,
      status: overallStatus,
      receiptData,
      message: `Multi-class payment recorded successfully for ${processedPayments.length} classes!`
    });

  } catch (error) {
    console.error('Error in bulk student fee payment:', error);
    res.status(500).json({ error: error.message });
  }
};

// --- REVERSE ACCIDENTAL / FUTURE MONTH CLASS FEE PAYMENT ---
exports.reverseStudentFeePayment = async (req, res) => {
  try {
    const { studentId, classId, month, reason } = req.body;
    const sId = parseInt(studentId);
    const cId = parseInt(classId);

    if (!sId || !cId || !month) {
      return res.status(400).json({ error: 'Valid studentId, classId, and month are required' });
    }

    const existingPayment = await prisma.physicalClassFeePayment.findUnique({
      where: {
        studentId_classId_month: {
          studentId: sId,
          classId: cId,
          month
        }
      },
      include: {
        class: true,
        student: true
      }
    });

    if (!existingPayment) {
      return res.status(404).json({ error: `No fee payment record found for ${month}` });
    }

    const targetClass = existingPayment.class || await prisma.physicalClass.findUnique({ where: { id: cId } });
    const targetStudent = existingPayment.student || await prisma.physicalStudent.findUnique({ where: { id: sId } });
    const sName = targetStudent?.studentName || `${targetStudent?.firstName || ''} ${targetStudent?.lastName || ''}`.trim() || 'Student';
    const sIdCode = targetStudent?.studentId || String(sId);
    const staffName = req.user?.name || req.user?.username || 'Staff';
    const reversalReason = reason?.trim() || 'Accidental/future month class fee entry reversed';
    const previousAmount = existingPayment.amount || 0;

    // 1. Delete the physicalClassFeePayment so student is UNPAID for that month
    await prisma.physicalClassFeePayment.delete({
      where: {
        id: existingPayment.id
      }
    });

    // 2. Adjust Cash Flow cleanly
    if (previousAmount > 0) {
      // Find the matching INCOME PhysicalTransaction created for this student, category 'Class Fee', and month
      const matchingTx = await prisma.physicalTransaction.findFirst({
        where: {
          studentId: sId,
          type: 'INCOME',
          category: 'Class Fee',
          isDeleted: false,
          description: { contains: month }
        },
        orderBy: { date: 'desc' }
      });

      if (matchingTx) {
        // Soft delete the mistaken transaction so cashflow calculation ignores it
        await prisma.physicalTransaction.update({
          where: { id: matchingTx.id },
          data: {
            isDeleted: true,
            deletedReason: `Reversed: ${reversalReason} [Class: ${targetClass?.name || cId}, Month: ${month}]`,
            deletedAt: new Date(),
            deletedBy: staffName
          }
        });
      } else {
        // If not found (e.g. older date or merged transaction), create an offsetting REFUND expense transaction
        await prisma.physicalTransaction.create({
          data: {
            type: 'EXPENSE',
            category: 'Refund',
            amount: previousAmount,
            description: `Reversal of accidental Class Fee (${month}) - ${targetClass?.name || 'Class'} - ${sIdCode} (${sName}) - Reason: ${reversalReason}`,
            studentId: sId,
            affectsCash: true,
            isVerified: true
          }
        });
      }
    }

    // Refetch student's remaining fee payments
    const updatedFeePayments = await prisma.physicalClassFeePayment.findMany({
      where: { studentId: sId },
      include: { class: true },
      orderBy: { month: 'desc' }
    });

    return res.json({
      success: true,
      status: 'PENDING',
      message: `Fee payment for ${month} reversed successfully! Cashflow adjusted.`,
      feePayments: updatedFeePayments
    });
  } catch (error) {
    console.error('Error reversing class fee payment:', error);
    return res.status(500).json({ error: 'Failed to reverse payment: ' + error.message });
  }
};

// Move accidental fee payment to correct target month
exports.moveStudentFeePaymentMonth = async (req, res) => {
  try {
    const { studentId, classId, currentMonth, targetMonth, reason } = req.body;
    const sId = parseInt(studentId);
    const cId = parseInt(classId);

    if (!sId || !cId || !currentMonth || !targetMonth) {
      return res.status(400).json({ error: 'Valid studentId, classId, currentMonth, and targetMonth are required' });
    }

    if (currentMonth === targetMonth) {
      return res.status(400).json({ error: 'Current month and target month cannot be the same' });
    }

    // 1. Check if payment exists in currentMonth
    const existingPayment = await prisma.physicalClassFeePayment.findUnique({
      where: {
        studentId_classId_month: {
          studentId: sId,
          classId: cId,
          month: currentMonth
        }
      },
      include: { class: true, student: true }
    });

    if (!existingPayment) {
      return res.status(404).json({ error: `No fee payment record found for ${currentMonth}` });
    }

    // 2. Check if a payment already exists for targetMonth
    const targetPayment = await prisma.physicalClassFeePayment.findUnique({
      where: {
        studentId_classId_month: {
          studentId: sId,
          classId: cId,
          month: targetMonth
        }
      }
    });

    if (targetPayment) {
      return res.status(400).json({ error: `A fee payment record already exists for ${targetMonth}` });
    }

    // 3. Update the month on the payment record
    const updatedPayment = await prisma.physicalClassFeePayment.update({
      where: { id: existingPayment.id },
      data: {
        month: targetMonth,
        remark: [existingPayment.remark, `[Moved from ${currentMonth} to ${targetMonth}: ${reason || 'Month correction'}]`].filter(Boolean).join(' ')
      }
    });

    // 4. Update matching PhysicalTransaction description & billingMonth if any
    const matchingTx = await prisma.physicalTransaction.findFirst({
      where: {
        studentId: sId,
        type: 'INCOME',
        category: 'Class Fee',
        isDeleted: false,
        OR: [
          { billingMonth: currentMonth },
          { description: { contains: currentMonth } }
        ]
      },
      orderBy: { date: 'desc' }
    });

    if (matchingTx) {
      await prisma.physicalTransaction.update({
        where: { id: matchingTx.id },
        data: {
          billingMonth: targetMonth,
          description: matchingTx.description.replace(currentMonth, targetMonth)
        }
      });
    }

    const updatedFeePayments = await prisma.physicalClassFeePayment.findMany({
      where: { studentId: sId },
      include: { class: true },
      orderBy: { month: 'desc' }
    });

    return res.json({
      success: true,
      message: `Fee payment moved successfully from ${currentMonth} to ${targetMonth}!`,
      payment: updatedPayment,
      feePayments: updatedFeePayments
    });
  } catch (error) {
    console.error('Error moving fee payment month:', error);
    return res.status(500).json({ error: 'Failed to move payment month: ' + error.message });
  }
};

// --- CLASS COMPARISON & REPORT CONTROLLER ---
exports.compareClasses = async (req, res) => {
  try {
    const { classIds } = req.query;
    if (!classIds) {
      return res.status(400).json({ error: 'classIds query parameter is required (e.g. ?classIds=1,2)' });
    }

    let parsedIds = [];
    if (typeof classIds === 'string') {
      parsedIds = classIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id) && id > 0);
    } else if (Array.isArray(classIds)) {
      parsedIds = classIds.map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0);
    }

    if (parsedIds.length < 1) {
      return res.status(400).json({ error: 'At least one valid class ID must be provided' });
    }

    // Parallel optimized fetch: classes info, enrollments, and direct students with exact field selections
    const [classes, enrollments, directStudents] = await Promise.all([
      prisma.physicalClass.findMany({
        where: { id: { in: parsedIds } },
        select: {
          id: true,
          name: true,
          grade: true,
          stream: true,
          subject: true,
          monthlyFee: true,
          teachers: {
            select: { id: true, name: true, phone: true }
          }
        }
      }),
      prisma.physicalStudentClassEnrollment.findMany({
        where: { classId: { in: parsedIds } },
        select: {
          classId: true,
          cardType: true,
          student: {
            select: {
              id: true,
              studentId: true,
              studentName: true,
              firstName: true,
              lastName: true,
              phone: true,
              whatsapp: true,
              guardianName: true,
              guardianPhone: true,
              nic: true,
              rfid: true,
              address: true,
              cardType: true,
              registrationFeeStatus: true,
              registrationFeeAmount: true,
              school: {
                select: { id: true, name: true }
              }
            }
          }
        }
      }),
      prisma.physicalStudent.findMany({
        where: {
          classId: { in: parsedIds }
        },
        select: {
          id: true,
          studentId: true,
          studentName: true,
          firstName: true,
          lastName: true,
          phone: true,
          whatsapp: true,
          guardianName: true,
          guardianPhone: true,
          nic: true,
          rfid: true,
          address: true,
          classId: true,
          cardType: true,
          registrationFeeStatus: true,
          registrationFeeAmount: true,
          school: {
            select: { id: true, name: true }
          }
        }
      })
    ]);

    if (classes.length === 0) {
      return res.status(404).json({ error: 'No classes found for the provided IDs' });
    }

    // Build unique students map
    const studentMap = new Map();

    const processStudentEnrollment = (student, clsId, enrollmentCardType) => {
      if (!student || !student.id) return;
      if (['id_number', 'student_name', 'Name'].includes(student.studentName)) return;

      if (!studentMap.has(student.id)) {
        const studentName = student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student';
        studentMap.set(student.id, {
          id: student.id,
          studentId: student.studentId,
          studentName,
          firstName: student.firstName,
          lastName: student.lastName,
          phone: student.phone,
          whatsapp: student.whatsapp,
          guardianName: student.guardianName,
          guardianPhone: student.guardianPhone,
          nic: student.nic,
          rfid: student.rfid,
          address: student.address,
          school: student.school ? { id: student.school.id, name: student.school.name } : null,
          cardType: student.cardType || 'FULL',
          registrationFeeStatus: student.registrationFeeStatus || 'PENDING',
          registrationFeeAmount: student.registrationFeeAmount,
          enrolledClasses: {}
        });
      }

      const sObj = studentMap.get(student.id);
      const effectiveCardType = enrollmentCardType || sObj.cardType || student.cardType || 'FULL';
      sObj.enrolledClasses[clsId] = {
        enrolled: true,
        cardType: effectiveCardType
      };
    };

    // Process enrollments table
    enrollments.forEach(en => {
      processStudentEnrollment(en.student, en.classId, en.cardType);
    });

    // Process direct classId students
    directStudents.forEach(st => {
      processStudentEnrollment(st, st.classId, st.cardType);
    });

    const allStudentsList = Array.from(studentMap.values());

    // Categorize students
    const enhancedStudents = allStudentsList.map(st => {
      const enrolledInIds = Object.keys(st.enrolledClasses).map(Number);
      const enrolledCount = enrolledInIds.length;
      const isCommonInAll = parsedIds.every(id => st.enrolledClasses[id]?.enrolled);
      const isExclusive = enrolledCount === 1;
      const exclusiveClassId = isExclusive ? enrolledInIds[0] : null;

      return {
        ...st,
        enrolledCount,
        isCommonInAll,
        isExclusive,
        exclusiveClassId,
        enrolledClassIds: enrolledInIds
      };
    });

    // Sort students: common in all first, then by name
    enhancedStudents.sort((a, b) => {
      if (a.isCommonInAll && !b.isCommonInAll) return -1;
      if (!a.isCommonInAll && b.isCommonInAll) return 1;
      if (b.enrolledCount !== a.enrolledCount) return b.enrolledCount - a.enrolledCount;
      return (a.studentName || '').localeCompare(b.studentName || '');
    });

    const commonStudents = enhancedStudents.filter(s => s.isCommonInAll);

    // Exclusive students by class
    const exclusiveStudentsByClass = {};
    const classEnrollmentCounts = {};

    parsedIds.forEach(cId => {
      exclusiveStudentsByClass[cId] = enhancedStudents.filter(s => s.exclusiveClassId === cId);
      classEnrollmentCounts[cId] = enhancedStudents.filter(s => s.enrolledClasses[cId]?.enrolled).length;
    });

    // Pairwise overlap matrix
    const pairwiseOverlap = {};
    for (let i = 0; i < parsedIds.length; i++) {
      for (let j = i + 1; j < parsedIds.length; j++) {
        const idA = parsedIds[i];
        const idB = parsedIds[j];
        const overlapKey = `${idA}_${idB}`;
        const overlapList = enhancedStudents.filter(s => s.enrolledClasses[idA]?.enrolled && s.enrolledClasses[idB]?.enrolled);
        pairwiseOverlap[overlapKey] = {
          classAId: idA,
          classBId: idB,
          count: overlapList.length,
          studentIds: overlapList.map(s => s.id)
        };
      }
    }

    // Card Type distribution
    const cardDistribution = {
      overall: {
        FULL: enhancedStudents.filter(s => s.cardType === 'FULL').length,
        HALF: enhancedStudents.filter(s => s.cardType === 'HALF').length,
        FREE: enhancedStudents.filter(s => s.cardType === 'FREE').length
      },
      common: {
        FULL: commonStudents.filter(s => s.cardType === 'FULL').length,
        HALF: commonStudents.filter(s => s.cardType === 'HALF').length,
        FREE: commonStudents.filter(s => s.cardType === 'FREE').length
      }
    };

    return res.json({
      success: true,
      classes: classes.map(c => ({
        id: c.id,
        name: c.name,
        grade: c.grade,
        stream: c.stream,
        subject: c.subject,
        monthlyFee: c.monthlyFee || 0,
        teachers: (c.teachers || []).map(t => ({ id: t.id, name: t.name, phone: t.phone })),
        totalStudentsCount: classEnrollmentCounts[c.id] || 0,
        exclusiveStudentsCount: (exclusiveStudentsByClass[c.id] || []).length
      })),
      stats: {
        totalSelectedClasses: parsedIds.length,
        totalUniqueStudents: enhancedStudents.length,
        commonInAllCount: commonStudents.length,
        commonInAllPercentage: enhancedStudents.length > 0
          ? Math.round((commonStudents.length / enhancedStudents.length) * 100)
          : 0,
        cardDistribution,
        classEnrollmentCounts,
        exclusiveCounts: Object.keys(exclusiveStudentsByClass).reduce((acc, cId) => {
          acc[cId] = exclusiveStudentsByClass[cId].length;
          return acc;
        }, {})
      },
      pairwiseOverlap,
      students: enhancedStudents,
      commonStudents,
      exclusiveStudentsByClass
    });
  } catch (error) {
    console.error('Error comparing classes:', error);
    return res.status(500).json({ error: 'Failed to compare classes: ' + error.message });
  }
};

// --- TEACHER COMPREHENSIVE REPORTS & INVOICE DATA ---
exports.getTeacherReport = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { month, classId, startDate, endDate } = req.query;

    const tId = parseInt(teacherId);
    const teacher = await prisma.physicalTeacher.findUnique({
      where: { id: tId },
      include: {
        classes: {
          include: {
            timetables: true
          }
        },
        timetables: true
      }
    });

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    // Filter classes if classId is passed
    let relevantClasses = teacher.classes;
    if (classId && classId !== 'ALL') {
      relevantClasses = teacher.classes.filter(c => c.id === parseInt(classId));
    }

    const classIds = relevantClasses.map(c => c.id);

    // Get all enrollments for these classes
    const enrollments = await prisma.physicalStudentClassEnrollment.findMany({
      where: { classId: { in: classIds } },
      include: {
        student: {
          include: { school: true }
        },
        class: true
      }
    });

    const primaryStudents = await prisma.physicalStudent.findMany({
      where: {
        classId: { in: classIds },
        id: { notIn: enrollments.map(e => e.studentId) }
      },
      include: { school: true, class: true }
    });

    // Merge students with their class associations
    const classStudentMap = new Map();
    classIds.forEach(cid => classStudentMap.set(cid, []));

    enrollments.forEach(e => {
      if (classStudentMap.has(e.classId)) {
        classStudentMap.get(e.classId).push(e.student);
      }
    });

    primaryStudents.forEach(s => {
      if (s.classId && classStudentMap.has(s.classId)) {
        classStudentMap.get(s.classId).push(s);
      }
    });

    // Get all active months across classes, recorded payments, transactions, and calendar window
    const allMonthsSet = new Set();
    relevantClasses.forEach(cls => {
      let months = [];
      if (Array.isArray(cls.activeMonths)) months = cls.activeMonths;
      else if (typeof cls.activeMonths === 'string') {
        try { months = JSON.parse(cls.activeMonths); } catch (e) { months = [cls.activeMonths]; }
      } else if (cls.startMonth) months = [cls.startMonth];

      months.forEach(m => {
        if (m && typeof m === 'string' && m.trim()) allMonthsSet.add(m.trim());
      });
    });

    // Also get months that have fee payments for these classes
    if (classIds.length > 0) {
      const classPaymentMonths = await prisma.physicalClassFeePayment.findMany({
        where: { classId: { in: classIds } },
        select: { month: true, paidDate: true }
      });
      classPaymentMonths.forEach(p => {
        if (p.month && p.month.trim()) allMonthsSet.add(p.month.trim());
        if (p.paidDate) {
          const pdStr = p.paidDate.toISOString().slice(0, 7);
          allMonthsSet.add(pdStr);
        }
      });
    }

    // Also get months with fee payments across the physical CRM system (up to 24)
    const systemPaymentMonths = await prisma.physicalClassFeePayment.findMany({
      select: { month: true },
      distinct: ['month'],
      take: 24
    });
    systemPaymentMonths.forEach(p => {
      if (p.month && p.month.trim()) allMonthsSet.add(p.month.trim());
    });

    // Also include months where this teacher has cash flow advances/deductions
    const teacherTxMonths = await prisma.physicalTransaction.findMany({
      where: { teacherId: tId, isDeleted: false },
      select: { billingMonth: true },
      distinct: ['billingMonth']
    });
    teacherTxMonths.forEach(t => {
      if (t.billingMonth && t.billingMonth.trim()) allMonthsSet.add(t.billingMonth.trim());
    });

    // Always guarantee current month and standard active window (past 6 months + current + next 2 months)
    const now = new Date();
    for (let offset = -2; offset <= 6; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      allMonthsSet.add(mStr);
    }
    if (month && typeof month === 'string' && month.trim()) {
      allMonthsSet.add(month.trim());
    }

    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const availableMonths = Array.from(allMonthsSet).sort().reverse();
    const selectedMonth = (month && month.trim()) ? month.trim() : (allMonthsSet.has(currentMonthStr) ? currentMonthStr : (availableMonths[0] || currentMonthStr));

    // Date range calculation: defaults to full month or uses custom range if provided
    const [selYear, selMonthNum] = selectedMonth.split('-').map(Number);
    const defaultStartOfMonth = new Date(Date.UTC(selYear, selMonthNum - 1, 1, 0, 0, 0));
    const defaultEndOfMonth = new Date(Date.UTC(selYear, selMonthNum, 0, 23, 59, 59, 999));

    let effectiveStartDate = defaultStartOfMonth;
    let effectiveEndDate = defaultEndOfMonth;
    const isCustomDateRange = Boolean(startDate || endDate);

    if (startDate && typeof startDate === 'string' && startDate.trim()) {
      const [sy, sm, sd] = startDate.trim().split('-').map(Number);
      if (!isNaN(sy) && !isNaN(sm) && !isNaN(sd)) {
        effectiveStartDate = new Date(Date.UTC(sy, sm - 1, sd, 0, 0, 0));
      }
    }

    if (endDate && typeof endDate === 'string' && endDate.trim()) {
      const [ey, em, ed] = endDate.trim().split('-').map(Number);
      if (!isNaN(ey) && !isNaN(em) && !isNaN(ed)) {
        effectiveEndDate = new Date(Date.UTC(ey, em - 1, ed, 23, 59, 59, 999));
      }
    }

    // 1. Fetch Regular Payments for selectedMonth
    const regularPaymentWhere = {
      classId: { in: classIds },
      month: selectedMonth
    };

    if (isCustomDateRange) {
      regularPaymentWhere.paidDate = {
        gte: effectiveStartDate,
        lte: effectiveEndDate
      };
    } else {
      regularPaymentWhere.paidDate = {
        lte: effectiveEndDate
      };
    }

    const regularFeePayments = await prisma.physicalClassFeePayment.findMany({
      where: regularPaymentWhere,
      include: {
        student: true,
        class: true
      }
    });

    // 2. Fetch Late Class Fees: Payments for past months (month < selectedMonth) collected during date range
    const lateFeePaymentsRaw = await prisma.physicalClassFeePayment.findMany({
      where: {
        classId: { in: classIds },
        month: { lt: selectedMonth },
        paidDate: { gte: effectiveStartDate, lte: effectiveEndDate },
        status: { in: ['PAID', 'HALF_PAYMENT', 'PARTIAL'] }
      },
      include: {
        student: true,
        class: true
      },
      orderBy: { paidDate: 'desc' }
    });

    const validLatePayments = lateFeePaymentsRaw.filter(p => (p.amount || 0) > 0);

    const regularPaymentKeyMap = new Map();
    regularFeePayments.forEach(p => {
      regularPaymentKeyMap.set(`${p.studentId}_${p.classId}`, p);
    });

    // Group late payments by class and by student
    const latePaymentsByClass = new Map();
    classIds.forEach(cid => latePaymentsByClass.set(cid, []));

    const latePaymentsByStudentClass = new Map();
    validLatePayments.forEach(p => {
      if (latePaymentsByClass.has(p.classId)) {
        latePaymentsByClass.get(p.classId).push(p);
      }
      const key = `${p.studentId}_${p.classId}`;
      if (!latePaymentsByStudentClass.has(key)) {
        latePaymentsByStudentClass.set(key, []);
      }
      latePaymentsByStudentClass.get(key).push(p);
    });

    // Fetch physical attendance records for these classes within the date range
    const monthAttendances = await prisma.physicalAttendance.findMany({
      where: {
        classId: { in: classIds },
        date: { gte: effectiveStartDate, lte: effectiveEndDate }
      },
      select: {
        studentId: true,
        classId: true,
        date: true,
        status: true
      }
    });

    // Fetch historical physical attendance records across all months to identify active students (attendance in >= 2 distinct months)
    const historicalAttendances = await prisma.physicalAttendance.findMany({
      where: {
        classId: { in: classIds },
        status: 'PRESENT'
      },
      select: {
        studentId: true,
        classId: true,
        date: true
      }
    });

    const studentActiveMonthsMap = new Map();
    historicalAttendances.forEach(att => {
      if (!att.date) return;
      const mStr = att.date.toISOString().slice(0, 7);
      if (!studentActiveMonthsMap.has(att.studentId)) {
        studentActiveMonthsMap.set(att.studentId, new Set());
      }
      studentActiveMonthsMap.get(att.studentId).add(mStr);
    });

    // Day of week mapping helper
    const DAYS_OF_WEEK_MAP = {
      'sunday': 0, 'sun': 0,
      'monday': 1, 'mon': 1,
      'tuesday': 2, 'tue': 2,
      'wednesday': 3, 'wed': 3,
      'thursday': 4, 'thu': 4,
      'friday': 5, 'fri': 5,
      'saturday': 6, 'sat': 6
    };

    const getScheduledDaysForClass = (cls) => {
      const days = new Set();
      if (cls.timetables && cls.timetables.length > 0) {
        cls.timetables.forEach(t => {
          if (t.dayOfWeek) {
            const d = DAYS_OF_WEEK_MAP[t.dayOfWeek.toLowerCase().trim()];
            if (d !== undefined) days.add(d);
          }
        });
      }
      if (days.size === 0 && cls.name) {
        const lower = cls.name.toLowerCase();
        for (const [dayName, dayIdx] of Object.entries(DAYS_OF_WEEK_MAP)) {
          const reg = new RegExp('\\b' + dayName + '\\b', 'i');
          if (reg.test(lower)) days.add(dayIdx);
        }
      }
      return days;
    };

    // Track headcount per date per class and student attendance
    const classDateCountsMap = new Map();
    classIds.forEach(cid => classDateCountsMap.set(cid, new Map()));
    const studentAttendanceMap = new Map();

    monthAttendances.forEach(att => {
      const dStr = att.date ? new Date(att.date).toISOString().slice(0, 10) : '';
      if (!dStr) return;

      if (att.status === 'PRESENT') {
        const counts = classDateCountsMap.get(att.classId);
        if (counts) {
          counts.set(dStr, (counts.get(dStr) || 0) + 1);
        }

        const key = `${att.studentId}_${att.classId}`;
        if (!studentAttendanceMap.has(key)) {
          studentAttendanceMap.set(key, new Set());
        }
        studentAttendanceMap.get(key).add(dStr);
      }
    });

    let totalEnrolled = 0;
    let totalActiveStudents = 0;
    let totalRegularPaidStudents = 0;
    let totalRegularGrossRevenue = 0;
    let totalLateFeeGrossRevenue = 0;
    let totalLateFeePaymentsCount = validLatePayments.length;

    const classBreakdowns = relevantClasses.map(cls => {
      const students = classStudentMap.get(cls.id) || [];
      const enrolledCount = students.length;
      totalEnrolled += enrolledCount;

      let clsActiveCount = 0;
      let clsRegularPaidCount = 0;
      let clsRegularGross = 0;

      // Identify legitimate conducted sessions for this class (filtering out gate stray scans and cross-batch makeup noise)
      const scheduledDays = getScheduledDaysForClass(cls);
      const dateCounts = classDateCountsMap.get(cls.id) || new Map();
      const validDates = [];

      for (const [dStr, count] of dateCounts.entries()) {
        const dObj = new Date(`${dStr}T12:00:00.000Z`);
        const dayOfWeek = dObj.getUTCDay();
        const pct = enrolledCount > 0 ? (count / enrolledCount) : 0;

        let isValidSession = false;
        if (scheduledDays.size > 0) {
          if (scheduledDays.has(dayOfWeek)) {
            // Scheduled lecture day: valid session if attendance exists
            isValidSession = count >= 1;
          } else {
            // Non-scheduled day: only legitimate if substantial quorum (>= 30% of class or >= 25 students)
            isValidSession = pct >= 0.30 || count >= 25;
          }
        } else {
          // No schedule specified: require at least 15% quorum or >= 10 students
          isValidSession = pct >= 0.15 || count >= 10;
        }

        if (isValidSession) {
          validDates.push(dStr);
        }
      }
      validDates.sort();
      const clsDatesArray = validDates;

      const studentList = students.map(st => {
        const pay = regularPaymentKeyMap.get(`${st.id}_${cls.id}`);
        const isPaid = pay && (pay.status === 'PAID' || pay.status === 'HALF_PAYMENT' || pay.status === 'PARTIAL') && ((pay.amount || 0) > 0 || pay.status === 'PAID');
        const isFree = pay && pay.status === 'FREE_CARD';
        const fee = isPaid ? ((pay.amount !== undefined && pay.amount !== null) ? pay.amount : (cls.monthlyFee || 0)) : (cls.monthlyFee || 0);

        if (isPaid) {
          clsRegularPaidCount++;
          clsRegularGross += fee;
        }

        // Active student determination: attendance in >= 2 distinct months
        const activeMonthsSet = studentActiveMonthsMap.get(st.id) || new Set();
        const activeMonthsCount = activeMonthsSet.size;
        const isActive = activeMonthsCount >= 2;
        if (isActive) {
          clsActiveCount++;
        }

        const lateFeesForStudent = latePaymentsByStudentClass.get(`${st.id}_${cls.id}`) || [];

        const rawAttendedDatesSet = studentAttendanceMap.get(`${st.id}_${cls.id}`) || new Set();
        // Valid conducted sessions attended by this student
        const validAttendedDates = Array.from(rawAttendedDatesSet)
          .filter(d => clsDatesArray.includes(d))
          .sort();
        const attendedCount = validAttendedDates.length;
        const totalConducted = clsDatesArray.length;
        const attRate = totalConducted > 0 ? Math.round((attendedCount / totalConducted) * 100) : 0;

        return {
          id: st.id,
          studentId: st.studentId,
          studentName: st.studentName || `${st.firstName || ''} ${st.lastName || ''}`.trim(),
          phone: st.phone,
          guardianPhone: st.guardianPhone,
          school: st.school ? st.school.name : null,
          registrationFeeStatus: st.registrationFeeStatus || 'PENDING',
          feeStatus: isPaid ? (pay.status === 'HALF_PAYMENT' ? 'HALF_PAYMENT' : (pay.status === 'PARTIAL' ? 'PARTIAL' : 'PAID')) : (isFree ? 'FREE_CARD' : 'PENDING'),
          amount: fee,
          paidDate: pay ? pay.paidDate : null,
          paymentMethod: pay ? pay.paymentMethod : null,
          isActive,
          activeMonthsCount,
          lateFees: lateFeesForStudent.map(lf => ({
            id: lf.id,
            feeMonth: lf.month,
            amount: lf.amount || 0,
            paidDate: lf.paidDate,
            paymentMethod: lf.paymentMethod || 'CASH',
            status: lf.status,
            remark: lf.remark
          })),
          attendance: {
            attendedSessions: attendedCount,
            totalSessions: totalConducted,
            attendanceRate: attRate,
            attendedDates: validAttendedDates
          }
        };
      });

      // Class late fee calculations
      const clsLatePayments = latePaymentsByClass.get(cls.id) || [];
      const clsLateGross = clsLatePayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const clsLatePaidCount = clsLatePayments.length;

      const clsTotalGross = clsRegularGross + clsLateGross;
      const instCutPct = teacher.instituteCut || 0;
      const instCutAmt = (clsTotalGross * instCutPct) / 100;
      const netPayout = clsTotalGross - instCutAmt;

      totalActiveStudents += clsActiveCount;
      totalRegularPaidStudents += clsRegularPaidCount;
      totalRegularGrossRevenue += clsRegularGross;
      totalLateFeeGrossRevenue += clsLateGross;

      return {
        classId: cls.id,
        className: cls.name,
        grade: cls.grade,
        stream: cls.stream,
        subject: cls.subject,
        monthlyFee: cls.monthlyFee || 0,
        enrolledCount,
        activeCount: clsActiveCount,
        paidCount: clsRegularPaidCount,
        unpaidCount: enrolledCount - clsRegularPaidCount,
        regularPaidCount: clsRegularPaidCount,
        regularGrossRevenue: clsRegularGross,
        lateFeePaidCount: clsLatePaidCount,
        lateFeeGrossRevenue: clsLateGross,
        lateFeePayments: clsLatePayments.map(p => ({
          id: p.id,
          studentId: p.studentId,
          studentRegId: p.student?.studentId,
          studentName: p.student?.studentName || `${p.student?.firstName || ''} ${p.student?.lastName || ''}`.trim(),
          feeMonth: p.month,
          amount: p.amount || 0,
          status: p.status,
          paidDate: p.paidDate,
          paymentMethod: p.paymentMethod || 'CASH',
          remark: p.remark
        })),
        grossRevenue: clsTotalGross,
        instituteCutPercent: instCutPct,
        instituteCutAmount: instCutAmt,
        netTeacherPayout: netPayout,
        conductedSessionDates: clsDatesArray,
        conductedSessionsCount: clsDatesArray.length,
        students: studentList
      };
    });

    const totalGrossRevenue = totalRegularGrossRevenue + totalLateFeeGrossRevenue;
    const overallInstCutPct = teacher.instituteCut || 0;
    const overallInstCutAmt = (totalGrossRevenue * overallInstCutPct) / 100;
    const netPayoutBeforeDeductions = totalGrossRevenue - overallInstCutAmt;

    // Fetch Teacher Advances / Expense Deductions / Incomes for this month / date range from PhysicalTransaction
    let txnWhere = {
      teacherId: tId,
      isDeleted: false
    };

    if (isCustomDateRange) {
      txnWhere.date = { gte: effectiveStartDate, lte: effectiveEndDate };
    } else {
      txnWhere.OR = [
        { billingMonth: selectedMonth },
        {
          AND: [
            { billingMonth: null },
            { date: { gte: effectiveStartDate, lte: effectiveEndDate } }
          ]
        }
      ];
    }

    const teacherTxns = await prisma.physicalTransaction.findMany({
      where: txnWhere,
      orderBy: { date: 'desc' }
    });

    // BOTH Teacher Advances (Cash Outflow) and Institute Income Charges (Deducted from Teacher) reduce teacher payout
    let totalTeacherAdvances = 0;
    let totalInstituteIncomeDeductions = 0;

    teacherTxns.forEach(d => {
      const amt = Number(d.amount) || 0;
      if (d.type === 'INCOME') {
        totalInstituteIncomeDeductions += amt;
      } else {
        totalTeacherAdvances += amt;
      }
    });

    const totalDeductions = totalTeacherAdvances + totalInstituteIncomeDeductions;
    const overallNetPayout = Math.max(0, netPayoutBeforeDeductions - totalDeductions);

    res.json({
      teacher: {
        id: teacher.id,
        lecturerId: teacher.lecturerId || `IMA-LEC-${1000 + teacher.id}`,
        name: teacher.name,
        image: teacher.image,
        address: teacher.address,
        whatsapp: teacher.whatsapp,
        phone: teacher.phone,
        instituteCut: teacher.instituteCut || 0,
        classes: teacher.classes
      },
      selectedMonth,
      availableMonths,
      dateRange: {
        startDate: effectiveStartDate.toISOString().slice(0, 10),
        endDate: effectiveEndDate.toISOString().slice(0, 10),
        isCustom: isCustomDateRange
      },
      summary: {
        totalClasses: relevantClasses.length,
        totalEnrolledStudents: totalEnrolled,
        totalActiveStudents: totalActiveStudents,
        totalPaidStudents: totalRegularPaidStudents,
        totalUnpaidStudents: totalEnrolled - totalRegularPaidStudents,
        regularGrossRevenue: totalRegularGrossRevenue,
        lateFeeGrossRevenue: totalLateFeeGrossRevenue,
        lateFeePaymentsCount: totalLateFeePaymentsCount,
        grossRevenue: totalGrossRevenue,
        instituteCutPercent: overallInstCutPct,
        instituteCutAmount: overallInstCutAmt,
        netTeacherPayoutBeforeDeductions: netPayoutBeforeDeductions,
        totalDeductions,
        totalTeacherAdvances,
        totalInstituteIncomeDeductions,
        netTeacherPayout: overallNetPayout
      },
      lateFeeCollections: validLatePayments.map(p => ({
        id: p.id,
        studentId: p.studentId,
        studentRegId: p.student?.studentId,
        studentName: p.student?.studentName || `${p.student?.firstName || ''} ${p.student?.lastName || ''}`.trim(),
        classId: p.classId,
        className: p.class?.name,
        feeMonth: p.month,
        amount: p.amount || 0,
        status: p.status,
        paidDate: p.paidDate,
        paymentMethod: p.paymentMethod || 'CASH',
        remark: p.remark
      })),
      deductions: teacherTxns.map(d => ({
        id: d.id,
        recordType: d.type === 'INCOME' ? 'INSTITUTE_INCOME' : 'TEACHER_ADVANCE',
        type: d.type || 'EXPENSE',
        category: d.category,
        amount: d.amount,
        description: d.description,
        date: d.date,
        billingMonth: d.billingMonth || selectedMonth,
        paymentMethod: 'CASH',
        affectsCash: true
      })),
      classes: classBreakdowns
    });

  } catch (error) {
    console.error('Error generating teacher report:', error);
    res.status(500).json({ error: error.message });
  }
};

