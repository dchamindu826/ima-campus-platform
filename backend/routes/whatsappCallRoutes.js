const express = require('express');
const router = express.Router();
const whatsappCallController = require('../controllers/whatsappCallController');
// Webhook routes for Meta App Dashboard
router.get('/webhook', whatsappCallController.verifyWebhook);
router.post('/webhook', whatsappCallController.handleWebhookEvent);
router.get('/alerts', whatsappCallController.getAlerts);
router.get('/status', whatsappCallController.getStatus);

// PoC Call routes
const verifyToken = require('../middlewares/authMiddleware');
router.get('/logs', verifyToken, whatsappCallController.getCallLogs);
router.get('/report', verifyToken, whatsappCallController.getCallReport);
router.get('/batches', verifyToken, whatsappCallController.getBatches);
router.get('/businesses', verifyToken, whatsappCallController.getBusinesses);
router.get('/business-phone-info', verifyToken, whatsappCallController.getBusinessPhoneInfo);
router.post('/ice', verifyToken, whatsappCallController.sendIceCandidate);
router.post('/answer', verifyToken, whatsappCallController.answerCall);
router.post('/reject', verifyToken, whatsappCallController.rejectCall);
router.post('/terminate', verifyToken, whatsappCallController.terminateCall);

// Outbound Call routes
router.post('/send-permission-request', verifyToken, whatsappCallController.sendPermissionRequest);
router.post('/manual-grant-permission', verifyToken, whatsappCallController.manualGrantPermission);
router.post('/initiate', verifyToken, whatsappCallController.initiateCall);

const path = require('path');
const multer = require('multer');
const recordingStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../../storage/recordings'));
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: recordingStorage });
router.post('/upload-recording', upload.single('audio'), whatsappCallController.uploadRecording);
module.exports = router;
