const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// 🔥 අපි ෆයිල් එකේ නම වෙනස් කරපු නිසා මෙතන නමත් 'freeSeminarController' කියලා හැදුවා 
const freeSeminarController = require('../controllers/freeSeminarController'); 
const verifyToken = require('../middlewares/authMiddleware'); 

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'storage/documents'),
    filename: (req, file, cb) => cb(null, 'CHAT_' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// (අර වැඩකට නැති getMetaAnalyticsDirect පේළිය මෙතනින් අයින් කළා)

// ==========================================================
// FREE SEMINAR ROUTES
// ==========================================================

router.get('/leads', verifyToken, freeSeminarController.getLeads);
router.post('/leads/resolve', verifyToken, freeSeminarController.resolveLeadByPhone);
router.post('/leads/import', verifyToken, freeSeminarController.importLead);
router.post('/leads/assign', verifyToken, freeSeminarController.assignLeads); 
router.post('/leads/update-batch', verifyToken, freeSeminarController.updateLeadBatch);

router.post('/leads/update-call', verifyToken, freeSeminarController.updateCallCampaign); 

router.post('/leads/bulk-action', verifyToken, freeSeminarController.bulkActions);
router.get('/leads/auto-assign-quotas', verifyToken, freeSeminarController.getAutoAssignQuotas);

router.get('/lead-details/:phone', verifyToken, freeSeminarController.getLeadDetails);
router.post('/reset-password', verifyToken, freeSeminarController.resetStudentPassword);

router.get('/messages/:leadId', verifyToken, freeSeminarController.getMessages);
router.post('/messages', verifyToken, upload.single('media'), freeSeminarController.sendMessage);
router.post('/messages/react', verifyToken, freeSeminarController.sendReaction);
router.post('/messages/send-opt-in', verifyToken, freeSeminarController.sendOptInRequest);
router.post('/leads/send-call-request', verifyToken, freeSeminarController.sendCallPermissionRequest);

// Meta Templates Routes
router.get('/meta-templates', verifyToken, freeSeminarController.getMetaTemplates);
router.post('/meta-templates', verifyToken, upload.single('media'), freeSeminarController.createMetaTemplate);
router.delete('/meta-templates/:name', verifyToken, freeSeminarController.deleteMetaTemplate);

// Broadcast & Leads
router.post('/broadcast', verifyToken, upload.single('media'), freeSeminarController.sendBroadcast);
router.get('/all-leads', verifyToken, freeSeminarController.getAllCampaignLeads);

// Webhook
router.get('/webhook', freeSeminarController.verifyWebhook); 
router.post('/webhook', freeSeminarController.receiveMessage);

router.get('/campaign-stats', verifyToken, freeSeminarController.getCampaignStats);

router.get('/overview-stats', verifyToken, freeSeminarController.getCoordinatorOverviewStats);

router.get('/followup-status', verifyToken, freeSeminarController.getFollowUpStatusAPI);
router.post('/toggle-followup', verifyToken, freeSeminarController.toggleFollowUpAPI);
router.post('/test-followup', verifyToken, freeSeminarController.testFollowUpMessage);

router.get('/meta-analytics', verifyToken, freeSeminarController.getUniqueNumbersCount);

// 🛑 Block Number Routes
router.post('/leads/block', verifyToken, freeSeminarController.blockNumber);
router.post('/leads/unblock', verifyToken, freeSeminarController.unblockNumber);
router.get('/leads/blocked-list', verifyToken, freeSeminarController.getBlockedNumbers);

const coordinatorOverviewV2Controller = require('../controllers/coordinatorOverviewV2Controller');
const todoStatsController = require('../controllers/todoStatsController');
const quickReplyController = require('../controllers/quickReplyController');

// V2 Dashboard Routes
router.get('/v2-overview-stats', verifyToken, coordinatorOverviewV2Controller.getCoordinatorV2Stats);
router.get('/v2-daily-logs', verifyToken, coordinatorOverviewV2Controller.getCoordinatorDailyLogs);
router.post('/v2-daily-logs', verifyToken, coordinatorOverviewV2Controller.saveCoordinatorDailyLog);

// Master Todo Stats
router.get('/master-todo-stats', verifyToken, todoStatsController.getMasterTodoStats);

// Quick Reply Routes
router.get('/quick-replies', verifyToken, quickReplyController.getQuickReplies);
router.post('/quick-replies', verifyToken, quickReplyController.createQuickReply);
router.delete('/quick-replies/:id', verifyToken, quickReplyController.deleteQuickReply);

module.exports = router;
