const express = require('express');
const router = express.Router();
const youtubeTranscribeController = require('../controllers/youtubeTranscribeController');
const verifyToken = require('../middlewares/authMiddleware');

const isAdmin = (req, res, next) => {
    const role = (req.user?.role || '').toUpperCase().replace(/[\s_-]+/g, '_');
    if (['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER', 'SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role)) {
        next();
    } else {
        res.status(403).json({ error: 'Access denied. System Admin only.' });
    }
};

const multer = require('multer');
const path = require('path');

const upload = multer({
    dest: path.join(__dirname, '../temp_transcripts'),
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

router.get('/info', verifyToken, isAdmin, youtubeTranscribeController.getVideoInfo);
router.post('/start', verifyToken, isAdmin, youtubeTranscribeController.startTranscription);
router.post('/upload-audio', verifyToken, isAdmin, upload.single('audio'), youtubeTranscribeController.transcribeUploadedAudio);
router.get('/status/:jobId', verifyToken, isAdmin, youtubeTranscribeController.getJobStatus);
router.post('/export-docx', verifyToken, isAdmin, youtubeTranscribeController.exportDocx);
router.get('/cookies-status', verifyToken, isAdmin, youtubeTranscribeController.getCookiesStatus);
router.post('/update-cookies', verifyToken, isAdmin, upload.single('cookieFile'), youtubeTranscribeController.updateCookies);

module.exports = router;

