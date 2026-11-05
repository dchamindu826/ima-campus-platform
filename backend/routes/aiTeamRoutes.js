const express = require('express');
const router = express.Router();
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const aiTeamController = require('../controllers/aiTeamController');
const verifyToken = require('../middlewares/authMiddleware');

// Secure upload configuration
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'ai-team-avatars');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.svg'];

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return cb(new Error('Invalid file extension. Only PNG, JPG, WEBP, and SVG are allowed.'));
        }
        const uniqueName = `avatar-${crypto.randomUUID()}${ext}`;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid image type. Only JPEG, PNG, WEBP, and SVG files are allowed.'), false);
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    fileFilter
});

// Access middleware (Admin & Staff)
const isAuthorizedStaffOrAdmin = (req, res, next) => {
    const role = (req.user?.role || '').toUpperCase();
    if (role === 'STUDENT' || role === 'USER') {
        return res.status(403).json({ error: 'Access denied. Authorized staff and administrators only.' });
    }
    next();
};

// Member management
router.get('/members', verifyToken, isAuthorizedStaffOrAdmin, aiTeamController.getMembers);
router.post('/members', verifyToken, isAuthorizedStaffOrAdmin, aiTeamController.createMember);
router.put('/members/:id', verifyToken, isAuthorizedStaffOrAdmin, aiTeamController.updateMember);
router.delete('/members/:id', verifyToken, isAuthorizedStaffOrAdmin, aiTeamController.deleteMember);

// Team management
router.get('/teams', verifyToken, isAuthorizedStaffOrAdmin, aiTeamController.getTeams);
router.post('/teams', verifyToken, isAuthorizedStaffOrAdmin, aiTeamController.createTeam);
router.put('/teams/:id', verifyToken, isAuthorizedStaffOrAdmin, aiTeamController.updateTeam);
router.delete('/teams/:id', verifyToken, isAuthorizedStaffOrAdmin, aiTeamController.deleteTeam);

// Conversation management
router.get('/conversations/:id', verifyToken, isAuthorizedStaffOrAdmin, aiTeamController.getConversation);
router.delete('/conversations/:id', verifyToken, isAuthorizedStaffOrAdmin, aiTeamController.clearConversation);

// Avatar upload
router.post('/upload-avatar', verifyToken, isAuthorizedStaffOrAdmin, upload.single('avatar'), aiTeamController.uploadAvatar);

// Chat execution
router.post('/chat', verifyToken, isAuthorizedStaffOrAdmin, aiTeamController.handleChat);

module.exports = router;
