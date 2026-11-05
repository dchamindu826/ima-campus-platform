const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const verifyToken = require('../middlewares/authMiddleware');
const paperController = require('../controllers/paperController');

// Ensure destination folder exists
const uploadDir = path.join(__dirname, '../storage/documents');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'paper-answer-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 35 * 1024 * 1024 } // 35MB max
});

// Storage Configuration for Question Images / Figures
const questionImageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'question-fig-' + uniqueSuffix + ext);
    }
});

const uploadQuestionImagesMulter = multer({
    storage: questionImageStorage,
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

// Storage Configuration for Master Question Paper PDF
const masterPaperStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'master-paper-' + uniqueSuffix + ext);
    }
});

const uploadMasterPaperMulter = multer({
    storage: masterPaperStorage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

// All paper routes require authentication
router.use(verifyToken);

// Direct Upload Master Question Paper PDF
router.post('/upload-master-sheet', uploadMasterPaperMulter.single('file'), paperController.uploadMasterSheet);

// Upload & Pre-Parse PDF for AI MCQ Extraction
router.post('/ai-upload-mcq-pdf', uploadMasterPaperMulter.single('pdf'), paperController.aiUploadMcqPdf);

// AI MCQ Extraction from PDF (Streaming SSE - accepts JSON { fileId, customApiKey } OR direct multipart upload)
router.post('/ai-extract-mcq-stream', (req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
        return uploadMasterPaperMulter.single('pdf')(req, res, next);
    }
    next();
}, paperController.aiExtractMcqStream);

// Test Gemini API Key
router.post('/gemini-key/test', paperController.testGeminiKey);

// Save Gemini API Key to System AppSetting
router.post('/gemini-key', paperController.saveGeminiApiKey);

// Upload Question Images / Figures (up to 10 images at once)
router.post('/upload-question-images', uploadQuestionImagesMulter.array('images', 10), paperController.uploadQuestionImages);

// 1. Get paper details by contentId
router.get('/content/:contentId', paperController.getPaperByContentId);

// 2. Student progress across tests
router.get('/student/progress', paperController.getStudentPaperProgress);

// 3. Marker queue (pending submissions to evaluate)
router.get('/marker/queue', paperController.getMarkerSubmissionsList);

// 4. Save paper configuration (Timer mode, duration, pass marks, etc.)
router.post('/config', paperController.savePaperConfig);

// 5. Save questions and options
router.post('/questions', paperController.saveQuestions);

// 6. Start paper session
router.post('/:paperId/start', paperController.startPaper);

// 7. Submit paper (MCQ JSON answers or Structured multipart PDF / multiple images)
router.post('/:paperId/submit', upload.any(), paperController.submitPaper);

// 8. Get all submissions for a paper
router.get('/:paperId/submissions', paperController.getPaperSubmissions);

// 9. Get leaderboard for a paper
router.get('/:paperId/leaderboard', paperController.getPaperLeaderboard);

// 10. Grade a structured submission
router.put('/submissions/:submissionId/grade', paperController.gradeStructuredSubmission);

// 11. Student Paper Class enrollment verification & available paper classes
router.get('/student/paper-classes', paperController.getStudentPaperClassAccess);

module.exports = router;

