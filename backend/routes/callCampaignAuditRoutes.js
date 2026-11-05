const express = require('express');
const router = express.Router();
const callCampaignAuditController = require('../controllers/callCampaignAuditController');
const verifyToken = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.get('/live', callCampaignAuditController.getLiveCampaignLeads);
router.get('/logs', callCampaignAuditController.getAuditLogs);

module.exports = router;
