const express = require('express');
const router = express.Router();
const physicalCrmController = require('../controllers/physicalCrmController');
const physicalAttendanceController = require('../controllers/physicalAttendanceController');
const physicalStudentReportController = require('../controllers/physicalStudentReportController');
const { verifyToken, requireStaff } = require('../middlewares/authMiddleware');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.use(verifyToken);
router.use(requireStaff);

// Schools
router.get('/schools', physicalCrmController.getSchools);
router.post('/schools', physicalCrmController.createSchool);
router.put('/schools/:id', physicalCrmController.updateSchool);
router.delete('/schools/:id', physicalCrmController.deleteSchool);

// Students
router.get('/students', physicalCrmController.getStudents);
router.post('/students', physicalCrmController.createStudent);
router.post('/students/import-excel', upload.any(), physicalCrmController.bulkImportStudents);
router.post('/students/allocate-excel', upload.any(), physicalCrmController.allocateExcelToClass);
router.put('/students/:id/allocate-card', physicalCrmController.allocateCard);
router.put('/students/:id/allocate-class', physicalAttendanceController.allocateClass);
router.delete('/students/:id/classes/:classId', physicalAttendanceController.unallocateClass);
router.put('/students/:id', physicalCrmController.updateStudent);
router.delete('/students/:id', physicalCrmController.deleteStudent);

// Student Reports & Matrix
router.get('/student-reports', physicalStudentReportController.getStudentReports);
router.get('/student-reports/:id', physicalStudentReportController.getStudentFullDetails);
router.get('/attendance-sessions-report', physicalStudentReportController.getAttendanceSessionsReport);
router.get('/class-followup-report', physicalStudentReportController.getClassFollowUpReport);

// SMS Gateway & Broadcast
router.get('/sms/settings', physicalStudentReportController.getSmsSettings);
router.post('/sms/settings', physicalStudentReportController.saveSmsSettings);
router.post('/sms/test', physicalStudentReportController.sendTestSms);
router.post('/sms/send-bulk', physicalStudentReportController.sendBulkSms);
router.get('/sms/logs', physicalStudentReportController.getSmsLogs);

// Classes
router.get('/classes', physicalCrmController.getClasses);
router.get('/classes/compare', physicalCrmController.compareClasses);
router.post('/classes', physicalCrmController.createClass);
router.put('/classes/:id', physicalCrmController.updateClass);
router.delete('/classes/:id', physicalCrmController.deleteClass);

// Halls
router.get('/halls', physicalCrmController.getHalls);
router.post('/halls', physicalCrmController.createHall);

// Teachers
router.get('/teachers', physicalCrmController.getTeachers);
router.post('/teachers', physicalCrmController.createTeacher);
router.put('/teachers/:id', physicalCrmController.updateTeacher);
router.delete('/teachers/:id', physicalCrmController.deleteTeacher);

// Class Fee Matrix & Payment
router.get('/classes/:classId/fee-matrix', physicalCrmController.getClassFeeMatrix);
router.post('/classes/toggle-fee', physicalCrmController.toggleStudentFeePayment);
router.post('/classes/reverse-fee', physicalCrmController.reverseStudentFeePayment);
router.post('/classes/move-fee-month', physicalCrmController.moveStudentFeePaymentMonth);
router.post('/classes/bulk-fee-payment', physicalCrmController.bulkStudentFeePayment);

// Teacher Reports & Invoices
router.get('/teachers/:teacherId/reports', physicalCrmController.getTeacherReport);

// Attendance Portal & Entrance Gate
router.get('/students-search', physicalAttendanceController.searchStudents);
router.get('/student-scan/:studentId', physicalAttendanceController.scanStudent);
router.post('/attendance', physicalAttendanceController.markAttendance);
router.post('/attendance/unmark', physicalAttendanceController.unmarkAttendance);
router.post('/entrance/scan', physicalAttendanceController.entranceScan);
router.get('/entrance/stats', physicalAttendanceController.getEntranceStats);

module.exports = router;

