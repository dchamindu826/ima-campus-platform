const express = require('express');
const router = express.Router();
const controller = require('../controllers/timetableController');
const verifyToken = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.get('/timetable', controller.getSchedule);
router.post('/timetable', controller.createSchedule);
router.put('/timetable/:id', controller.updateSchedule);
router.delete('/timetable/:id', controller.deleteSchedule);

module.exports = router;