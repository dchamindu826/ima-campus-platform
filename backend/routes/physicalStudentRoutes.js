const express = require('express');
const router = express.Router();
const physicalStudentController = require('../controllers/physicalStudentController');
const { verifyToken, requireStaff } = require('../middlewares/authMiddleware');

router.use(verifyToken);
router.use(requireStaff);

router.post('/', physicalStudentController.createPhysicalStudent);
router.get('/', physicalStudentController.getAllPhysicalStudents);

module.exports = router;
