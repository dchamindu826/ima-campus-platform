const express = require('express');
const router = express.Router();
const controller = require('../controllers/socialMediaController');
const taskController = require('../controllers/socialMediaTaskController');
const aiVideoController = require('../controllers/aiVideoGeneratorController');
const aiImageController = require('../controllers/aiImageGeneratorController');
const musicController = require('../controllers/socialMediaMusicController');
const verifyToken = require('../middlewares/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../public/uploads/social-media');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '_' + file.originalname.replace(/\s+/g, '_'));
    }
});

const upload = multer({ storage });

// 🎨 AI Image Generator Routes (Latest Gemini Image Model)
router.post('/ai-image/generate', verifyToken, upload.array('referenceImages', 3), aiImageController.generateAiImage);
router.get('/ai-image/history', verifyToken, aiImageController.getImageHistory);
router.post('/ai-image/enhance-prompt', verifyToken, aiImageController.enhancePrompt);

// 🎵 LUMI AI Reel Music & BGM Finder Route
router.post('/recommend-music', verifyToken, musicController.recommendSongMatches);
router.post('/transcribe-media', verifyToken, upload.single('media'), musicController.transcribeMedia);

// AI Video Editor (Captioning) Routes
router.post('/video-editor/upload', verifyToken, upload.any(), controller.uploadAndTranscribe);
router.post('/video-editor/export', verifyToken, upload.any(), controller.exportVideo);

// 🎬 Automated AI Video Generator Routes
router.post('/ai-video/generate-storyboard', verifyToken, aiVideoController.generateStoryboard);
router.post('/ai-video/search-footages', verifyToken, aiVideoController.searchStockFootages);
router.post('/ai-video/generate-tts', verifyToken, aiVideoController.generateTTS);
router.post('/ai-video/render-video', verifyToken, aiVideoController.renderAIVideo);
router.get('/ai-video/bgm-tracks', verifyToken, aiVideoController.getBgmTracks);

// Custom Footage Upload for Scene
router.post('/ai-video/upload-footage', verifyToken, upload.single('footage'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No video footage uploaded' });
    const videoUrl = `/uploads/social-media/${req.file.filename}`;
    return res.status(200).json({ message: 'Footage uploaded successfully', videoUrl });
});

// Image File Upload Route
router.post('/upload-image', verifyToken, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image file uploaded' });
    const imageUrl = `/uploads/social-media/${req.file.filename}`;
    return res.status(200).json({ message: 'Image uploaded successfully', imageUrl });
});

// Multiple Images / Files Upload Route (Supports up to 5 attachments)
router.post('/upload-files', verifyToken, upload.array('files', 5), (req, res) => {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
    const fileUrls = req.files.map(f => `/uploads/social-media/${f.filename}`);
    return res.status(200).json({ message: 'Files uploaded successfully', fileUrls });
});

// Task Delegation & Stage Tracking Routes
router.post('/tasks', verifyToken, taskController.createTask);
router.get('/tasks', verifyToken, taskController.getTasks);
router.put('/tasks/assign', verifyToken, taskController.approveAndAssignTask);
router.put('/tasks/reject', verifyToken, taskController.rejectTask);
router.put('/tasks/stage', verifyToken, taskController.updateTaskStage);
router.get('/staff', verifyToken, taskController.getSocialMediaStaff);

// Calendar Overview Routes
router.post('/calendar', verifyToken, taskController.createCalendarPost);
router.get('/calendar', verifyToken, taskController.getCalendarPosts);
router.delete('/calendar/:id', verifyToken, taskController.deleteCalendarPost);

module.exports = router;

