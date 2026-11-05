const express = require('express');
const router = express.Router();
const missedCallTaskController = require('../controllers/missedCallTaskController');
const verifyToken = require('../middlewares/authMiddleware');

// Manager routes: Daily list, task distribution & analytics
router.get('/daily', verifyToken, missedCallTaskController.getDailyMissedCalls);
router.post('/distribute', verifyToken, missedCallTaskController.distributeTasks);
router.get('/analytics', verifyToken, missedCallTaskController.getAnalyticsReport);

// Lightweight navbar counts badge route
router.get('/nav-counts', verifyToken, missedCallTaskController.getNavCounts);

// Staff routes: My tasks & Outcome updates
router.get('/my-tasks', verifyToken, missedCallTaskController.getMyTasks);
router.post('/update-outcome', verifyToken, missedCallTaskController.updateTaskOutcome);

module.exports = router;
