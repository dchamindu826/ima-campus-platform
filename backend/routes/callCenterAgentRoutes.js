const express = require('express');
const router = express.Router();
const callCenterAgentController = require('../controllers/callCenterAgentController');
const verifyToken = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.get('/overview', callCenterAgentController.getOverview);
router.get('/business-leads', callCenterAgentController.getBusinessLeads);
router.post('/update-progress', callCenterAgentController.updateProgress);

module.exports = router;
