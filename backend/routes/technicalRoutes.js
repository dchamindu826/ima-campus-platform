const express = require('express');
const router = express.Router();
const technicalController = require('../controllers/technicalController');
const verifyToken = require('../middlewares/authMiddleware');

// Ensure only authorized technical staff/admins can access
const checkTechRole = (req, res, next) => {
    const role = (req.user.role || '').toUpperCase();
    const dept = req.user.department || '';
    if (['SYSTEM_ADMIN', 'DIRECTOR', 'TECH_MANAGER'].includes(role) || (role === 'MANAGER' && dept === 'Technical')) {
        next();
    } else {
        res.status(403).json({ error: "Access Denied. Technical role required." });
    }
};

router.use(verifyToken);
router.use(checkTechRole);

// Hall Management
router.get('/halls', technicalController.getHalls);
router.post('/halls', technicalController.createHall);
router.put('/halls/:id', technicalController.updateHall);
router.delete('/halls/:id', technicalController.deleteHall);

// Technical Timetable
router.get('/timetable', technicalController.getTechnicalTimetable);
router.put('/timetable/:id/allocate-hall', technicalController.allocateHall);

module.exports = router;
