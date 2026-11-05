const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const rosterController = require('../controllers/rosterController');

// Routes for Coordinators to view and update their own roster
router.get('/my-roster', authMiddleware, rosterController.getMonthlyRoster);
router.post('/update-day', authMiddleware, rosterController.updateDailyRoster);

module.exports = router;