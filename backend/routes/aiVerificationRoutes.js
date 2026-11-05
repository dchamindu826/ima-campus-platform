const express = require('express');
const router = express.Router();
const aiVerificationController = require('../controllers/aiVerificationController');
const verifyToken = require('../middlewares/authMiddleware');
const multer = require('multer');
const path = require('path');

// Memory storage for Excel/CSV statement files
const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
            'text/csv', 
            'application/vnd.ms-excel', 
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        if (allowedMimeTypes.includes(file.mimetype) || file.originalname.match(/\.(csv|xlsx|xls)$/)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type. Only CSV and Excel files are allowed."), false);
        }
    }
});

// Disk storage for Reference Slip uploads
const documentStorage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'storage/documents/'); },
    filename: (req, file, cb) => { cb(null, 'REF_SLIP_' + Date.now() + '_' + Math.round(Math.random() * 1E9) + path.extname(file.originalname)); }
});
const uploadDocument = multer({ 
    storage: documentStorage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Existing routes
router.post('/upload-bank-statement', verifyToken, upload.single('statementFile'), aiVerificationController.uploadBankStatement);
router.delete('/bank-statements/:month', verifyToken, aiVerificationController.clearBankStatements);
router.post('/process-verification', verifyToken, aiVerificationController.processAIVerification);
router.get('/transactions', verifyToken, aiVerificationController.getBankTransactions);
router.get('/months', verifyToken, aiVerificationController.getBankStatementMonths);
router.get('/pending-slips', verifyToken, aiVerificationController.getPendingSlips);

// Bulk Auto-Verification
router.post('/bulk-start', verifyToken, aiVerificationController.startBulkVerification);
router.get('/bulk-status', verifyToken, aiVerificationController.getBulkStatus);
router.post('/bulk-stop', verifyToken, aiVerificationController.stopBulkVerification);
router.get('/history', verifyToken, aiVerificationController.getHistory);
router.post('/schedule', verifyToken, aiVerificationController.toggleSchedule);

router.get('/settings', verifyToken, aiVerificationController.getSettings);
router.post('/settings', verifyToken, aiVerificationController.saveSettings);

// Control Panel routes
router.post('/verify-password', verifyToken, aiVerificationController.verifyPassword);
router.post('/change-password', verifyToken, aiVerificationController.changePassword);
router.get('/config', verifyToken, aiVerificationController.getConfig);
router.post('/config', verifyToken, aiVerificationController.saveConfig);
router.get('/schedule-config', verifyToken, aiVerificationController.getScheduleConfig);
router.post('/schedule-config', verifyToken, aiVerificationController.saveScheduleConfig);
router.post('/settings-active', verifyToken, aiVerificationController.saveActiveSettings);
router.post('/upload-ref-slip', verifyToken, uploadDocument.single('refSlipFile'), aiVerificationController.uploadRefSlip);
router.post('/verify-single', verifyToken, aiVerificationController.verifySinglePayment);
router.post('/add-manual-transaction', verifyToken, aiVerificationController.addManualTransaction);

// Command Console & AI Filtering
router.post('/execute-command', verifyToken, aiVerificationController.executeCommand);

// Bank Template Management
router.get('/templates', verifyToken, aiVerificationController.getTemplates);
router.post('/templates', verifyToken, uploadDocument.single('templateImage'), aiVerificationController.saveTemplate);
router.delete('/templates/:id', verifyToken, aiVerificationController.deleteTemplate);

router.post('/months', verifyToken, aiVerificationController.createMonth);
router.delete('/months/:month', verifyToken, aiVerificationController.deleteMonth);


router.get('/gsheet-config/tree', verifyToken, aiVerificationController.getGsheetConfigTree);
router.post('/gsheet-config/tree', verifyToken, aiVerificationController.saveGsheetConfigTree);

module.exports = router;

