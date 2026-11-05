const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// ============================================================================
// 📦 CONTROLLERS IMPORT
// ============================================================================
const afterSeminarInquiryController = require('../controllers/afterSeminarInquiryController'); 
const afterSeminarBridgeController = require('../controllers/afterSeminarBridgeController');
const afterSeminarRetentionController = require('../controllers/afterSeminarRetentionController');
const afterSeminarManagerStatsController = require('../controllers/afterSeminarManagerStatsController');
const verifyToken = require('../middlewares/authMiddleware');

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'storage/documents'),
    filename: (req, file, cb) => cb(null, 'CHAT_' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ============================================================================
// 🌐 WEBHOOKS (Public, NO AUTH)
// ============================================================================
router.get('/webhook', afterSeminarInquiryController.verifyWebhook);
router.post('/webhook', afterSeminarInquiryController.receiveMessage);

// ============================================================================
// 🔒 SECURE ALL ROUTES BELOW THIS POINT
// ============================================================================
router.use(verifyToken);

// ============================================================================
// 🟢 MODULE 1: INQUIRIES (Direct & Open Seminar)
// ============================================================================


// Settings & Config
router.post('/settings', afterSeminarInquiryController.saveCrmSettings);
router.get('/settings/:businessId/:campaignType', afterSeminarInquiryController.getCrmSettings);
router.get('/followup-status', afterSeminarInquiryController.getFollowUpStatus);
router.post('/toggle-followup', afterSeminarInquiryController.toggleFollowUpStatus);

router.get('/opensem-status', afterSeminarInquiryController.getOpenSemStatus);
router.post('/toggle-opensem', afterSeminarInquiryController.toggleOpenSemStatus);

// Campaign Lock / Unlock System (Manager / Super Admin)
router.get('/campaign-lock-status', afterSeminarInquiryController.getCampaignLockStatus);
router.post('/campaign-toggle-lock', afterSeminarInquiryController.toggleCampaignLock);

// Leads & Bulk Actions
router.get('/leads', afterSeminarInquiryController.getLeads);
router.post('/leads/import', afterSeminarInquiryController.importLead);
router.post('/leads/bulk-action', afterSeminarInquiryController.bulkActions);
router.post('/leads/assign', afterSeminarInquiryController.assignLeads); 
router.get('/leads/auto-assign-quotas', afterSeminarInquiryController.getAutoAssignQuotas);
router.post('/leads/update-call', afterSeminarInquiryController.updateCallCampaign);
router.post('/leads/update-batch', afterSeminarInquiryController.updateLeadBatch);
router.post('/leads/revert-round', afterSeminarInquiryController.revertDeletedRound);

// Webhook routes moved to top
router.get('/meta-templates', afterSeminarInquiryController.getMetaTemplates);

// Chat Messages & Broadcast
router.get('/messages/:leadId', afterSeminarInquiryController.getMessages);
router.post('/messages', upload.single('media'), afterSeminarInquiryController.sendMessage);
router.post('/messages/react', afterSeminarInquiryController.sendReaction);
router.post('/messages/send-opt-in', afterSeminarInquiryController.sendOptInRequest);
router.post('/leads/send-call-request', afterSeminarInquiryController.sendCallPermissionRequest);
router.get('/leads/unnotified-permissions', afterSeminarInquiryController.getUnnotifiedPermissions);
router.get('/leads/call-permissions', afterSeminarInquiryController.getCallPermissions);
router.post('/leads/mark-permission-notified', afterSeminarInquiryController.markPermissionNotified);
router.post('/broadcast', upload.single('media'), afterSeminarInquiryController.sendBroadcast);

// Stats, Test & Next Round
router.get('/all-leads', afterSeminarInquiryController.getAllCampaignLeads);
router.post('/start-coordination', afterSeminarInquiryController.startNewCoordination);
router.post('/leads/test-followup', afterSeminarInquiryController.testDirectFollowUp);

// 🛑 Block Number Routes
router.post('/leads/block', afterSeminarInquiryController.blockNumber);
router.post('/leads/unblock', afterSeminarInquiryController.unblockNumber);
router.get('/leads/blocked-list', afterSeminarInquiryController.getBlockedNumbers);


// ============================================================================
// 🌉 MODULE 2: THE BRIDGE (Free Seminar -> After Seminar Transfer)
// ============================================================================
router.get('/bridge/pending', afterSeminarBridgeController.getPendingBridgeLeads);
router.post('/bridge/push', afterSeminarBridgeController.pushToAfterSeminar);
router.post('/bridge/revert-pending', afterSeminarBridgeController.revertPendingBridgeLeads);

// 📞 MODULE 2.1: BRIDGE CALL CENTER HANDOVERS
router.get('/bridge/call-center/handovers', afterSeminarBridgeController.getCallCenterHandovers);
router.post('/bridge/call-center/approve', afterSeminarBridgeController.approveAndAssignHandovers);
router.post('/bridge/call-center/start-round-two', afterSeminarBridgeController.startBridgeRoundTwo);

// ============================================================================
// 🏆 MODULE 3: THE FINALE (Enrolled Retention & Monthly Tracking)
// ============================================================================
router.get('/retention/stats', afterSeminarRetentionController.getRetentionDashboardStats);
router.get('/retention/leads', afterSeminarRetentionController.getRetentionLeads);
router.post('/retention/trigger-reset', afterSeminarRetentionController.manualTriggerMonthlyReset); 

// ============================================================================
// 📊 MODULE 4: MANAGER STATS (🔥 FIXED ERROR HERE 🔥)
// ============================================================================
router.get('/manager-dashboard-stats', afterSeminarManagerStatsController.getManagerDashboardStats);
router.get('/stats/new-inquiries', afterSeminarManagerStatsController.getNewInquiryStats);
router.get('/stats/open-seminar', afterSeminarManagerStatsController.getOpenSeminarStats);
router.get('/stats/bridge', afterSeminarManagerStatsController.getBridgePerformanceStats);
router.get('/stats/paid-campaign', afterSeminarManagerStatsController.getPaidCampaignStats);
router.get('/stats/coordinator-progress', afterSeminarManagerStatsController.getCoordinatorProgressSheetStats);
router.get('/export-coordinator-word-doc', afterSeminarManagerStatsController.exportCoordinatorWordDoc);
router.get('/unassigned-batch-leads', afterSeminarManagerStatsController.getUnassignedBatchLeads);
router.get('/business-batches', afterSeminarManagerStatsController.getBusinessBatches);
router.get('/coordinators', afterSeminarManagerStatsController.getCoordinators);
router.get('/lead-chat/:leadId', afterSeminarManagerStatsController.getLeadChatHistory);
router.post('/assign-leads-to-batch', afterSeminarManagerStatsController.assignLeadsToBatch);
router.get('/missing-paid-students', afterSeminarManagerStatsController.getMissingPaidStudents);
router.post('/push-missing-student-to-crm', afterSeminarManagerStatsController.pushMissingStudentToCrm);
router.post('/update-missing-student-phone', afterSeminarManagerStatsController.updateMissingStudentPhone);
router.get('/search-crm-leads-for-merge', afterSeminarManagerStatsController.searchCrmLeadsForMerge);
router.post('/merge-missing-student-with-lead', afterSeminarManagerStatsController.mergeMissingStudentWithLead);
router.post('/batch-goals', afterSeminarManagerStatsController.updateBatchGoals);

router.get('/retention/campaign-data', afterSeminarRetentionController.getRetentionCampaignData);

// ============================================================================
// 🔄 MODULE 5: B2B LEAD TRANSFERS
// ============================================================================
router.post('/leads/b2b-transfer', afterSeminarManagerStatsController.transferB2BLeads);
router.get('/leads/b2b-history', afterSeminarManagerStatsController.getB2BTransferHistory);

module.exports = router; // (මේක දැනටමත් ඇති, ඒකට උඩින් දාන්න)