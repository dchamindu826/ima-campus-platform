const express = require('express');
const router = express.Router();
const pettyCashController = require('../controllers/pettyCashController');
const verifyToken = require('../middlewares/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure destination folder exists
const uploadDir = path.join(__dirname, '../storage/petty_cash');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage with extension whitelisting & filename sanitization
const receiptStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeName = `receipt_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}${ext}`;
        cb(null, safeName);
    }
});

const receiptFilter = (req, file, cb) => {
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file format. Only JPG, PNG, WEBP, and PDF receipts are allowed.'));
    }
};

const uploadReceipt = multer({
    storage: receiptStorage,
    fileFilter: receiptFilter,
    limits: { fileSize: 12 * 1024 * 1024 } // 12MB limit
});

// All routes require authenticated user
router.use(verifyToken);

// 1. Dashboard & Statistics
router.get('/dashboard', pettyCashController.getDashboardStats);

// 2. Accounts & Settings
router.get('/accounts', pettyCashController.getAccounts);
router.put('/accounts/:id', pettyCashController.updateAccountSettings);

// 3. Transactions Query
router.get('/transactions', pettyCashController.getTransactions);
router.get('/transactions/:id', pettyCashController.getTransactionById);

// 4. Request Lifecycle Actions
// Step 1: Create Request
router.post('/requests', pettyCashController.createRequest);

// Step 2: Admin Manager Review (Approve / Reject / Return for changes)
router.post('/requests/:id/review', pettyCashController.reviewRequest);

// Step 2b: Manager Resubmit modified request
router.put('/requests/:id/resubmit', pettyCashController.updateAndResubmitRequest);

// Step 3: Cash Issue (Petty Cash Officer / Finance)
router.post('/requests/:id/issue-cash', pettyCashController.issueCash);

// Step 3b: Manager Confirm Cash Received
router.post('/requests/:id/confirm-receipt', pettyCashController.confirmCashReceived);

// Step 4: Expense & Mandatory Receipt Submission (Manager)
router.post('/requests/:id/submit-expense', uploadReceipt.single('receipt'), pettyCashController.submitExpenseReceipt);

// Step 5: Finance Verification & Final Settlement (Petty Cash Officer)
router.post('/requests/:id/verify-receipt', pettyCashController.verifyReceipt);

// 5. Reload Engine
router.post('/reload', pettyCashController.initiateReload);
router.get('/reload/history', pettyCashController.getReloadHistory);

// 6. Audit Trail (Immutable)
router.get('/audit-logs', pettyCashController.getAuditLogs);

module.exports = router;

