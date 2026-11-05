const express = require('express');
const router = express.Router();
const callCenterController = require('../controllers/callCenterController');
const verifyToken = require('../middlewares/authMiddleware');

// All Call Center routes are protected by JWT verification
router.use(verifyToken);

// 1. Handover queue & coordinator allocation
router.post('/request-transfer', callCenterController.requestTransfer);
router.get('/pending-requests', callCenterController.getPendingRequests);
router.post('/process-transfer', callCenterController.processTransferRequest);

// 2. Manager bulk assignments & active stream buckets
router.get('/manager/leads', callCenterController.getManagerLeads);
router.get('/manager/staff', callCenterController.getCallCenterStaff);
router.post('/manager/assign', callCenterController.assignLeadsToAgent);
router.post('/manager/start-round', callCenterController.startRound);

// 3. Agent calls workspace & updates
router.get('/agent/leads', callCenterController.getAgentLeads);
router.post('/agent/update-lead', callCenterController.updateLeadCallingStatus);

// 4. Integrated performance metrics
router.get('/stats', callCenterController.getCallCenterStats);
router.get('/bridge-progress', callCenterController.getBridgeCallProgress);

module.exports = router;
