const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const verifyToken = require('../middlewares/authMiddleware');

router.use(verifyToken);

// Get all payments
router.get('/', paymentController.getPayments);

// Action for standard payments (Approve / Reject)
router.post('/action', paymentController.paymentAction);

// 🔥 මේක තමයි ඔයාගේ 404 ආපු අලුත් Installment Route එක
router.post('/action/installment', paymentController.approveInstallment);

// Grant Temporary Access (Post Pay)
router.post('/post-pay', paymentController.grantPostPay);

// Get all courses (subjects) for selection
router.get('/courses', paymentController.getAllCourses);

// Update payment details (subjects list & amount)
router.post('/update-details', paymentController.updatePaymentDetails);

// Get staff verification stats report
router.get('/staff-stats-report', paymentController.getStaffStatsReport);

// Teacher Salary / Lecturer Payment Breakdown
const teacherSalaryController = require('../controllers/teacherSalaryController');
router.get('/teacher-salary-breakdown', teacherSalaryController.getTeacherSalaryBreakdown);

module.exports = router;
// Permanent delete payment
// router.delete('/:id', paymentController.permanentDelete);
