const express = require('express');
const router = express.Router();
const teacherSalaryController = require('../controllers/teacherSalaryController');
const verifyToken = require('../middlewares/authMiddleware');

router.use(verifyToken);

// Teacher Salary / Lecturer Payment Breakdown
router.get('/breakdown', teacherSalaryController.getTeacherSalaryBreakdown);
router.get('/', teacherSalaryController.getTeacherSalaryBreakdown);

// Teacher Salary Configuration (Fixed vs Commission, Rates, Batches)
router.get('/config', teacherSalaryController.getTeacherSalaryConfig);
router.post('/config', teacherSalaryController.saveTeacherSalaryConfig);

// Teacher Salary Custom Payout Adjustments (Editable Duplicate Sheet)
router.get('/adjustments', teacherSalaryController.getTeacherSalaryAdjustments);
router.post('/adjustments', teacherSalaryController.saveTeacherSalaryAdjustments);

// Teacher Salary Cycle History & Management
router.get('/history', teacherSalaryController.getTeacherSalaryHistory);
router.post('/cycle-status', teacherSalaryController.saveTeacherSalaryCycleStatus);

module.exports = router;

