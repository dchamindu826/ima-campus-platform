// backend/routes/crmRoutes.js
const express = require('express');
const router = express.Router();
const crmController = require('../controllers/crmController');
const multer = require('multer');
const path = require('path');

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'storage/documents'),
    filename: (req, file, cb) => cb(null, 'KB_' + Date.now() + path.extname(file.originalname))
});

// 🔥 UPDATE: Set File Size Limit to 100MB 🔥
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100 MB Limit
});

// 1. Settings Routes
router.post('/settings', crmController.saveCrmSettings);
router.get('/settings/:businessId/:campaignType', crmController.getCrmSettings);

// 2. AI Knowledge Base (PDF Ingestion)
router.post('/knowledge-base', upload.single('pdfFile'), crmController.uploadKnowledge);

// 3. Campaign Archive
router.post('/archive', crmController.archiveCampaign);



// 4. Auto Reply Routes (With 100MB File limit)
router.post('/auto-reply', upload.single('attachment'), crmController.addAutoReply);
router.get('/auto-reply', crmController.getAutoReplies);
router.delete('/auto-reply/:id', crmController.deleteAutoReply);
router.put('/auto-reply/:id', upload.single('attachment'), crmController.updateAutoReply);

// 5. Meta OTP / Verification Routes
router.get('/meta-otps', crmController.getMetaOtps);

module.exports = router;