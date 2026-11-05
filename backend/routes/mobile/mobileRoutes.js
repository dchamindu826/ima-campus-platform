const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client'); // 🔥 Database eka ona session check karanna
const prisma = new PrismaClient();
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // 🔥 අලුතෙන් එකතු කළා ෆෝල්ඩර් එක චෙක් කරන්න

const mobileStudentController = require('../../controllers/mobile/mobileStudentController');
const mobileStaffController = require('../../controllers/mobile/mobileStaffController');

// 🔥 FIX: Multer Configuration for Profile Images
// දැන් හරියටම backend/storage/images ෆෝල්ඩර් එකට යයි
const uploadDir = path.join(__dirname, '../../storage/images');

// ෆෝල්ඩර් එක නැත්නම් Auto හදන්න (Error එන එක නවත්වන්න)
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        cb(null, 'profile_' + Date.now() + path.extname(file.originalname))
    }
});
const upload = multer({ storage: storage });


// 🔥 FIX: Token Verification Middleware with Session Check
const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "Access Denied. No token provided." });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);

        const user = await prisma.user.findUnique({ where: { id: verified.userId || verified.id } });

        const roleUpper = String(user?.role || verified.role || '').trim().toUpperCase();
        const isExplicitStaff = [
            'ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'STAFF', 'COORDINATOR', 
            'CALLER', 'MANAGER', 'MANAGEMENT', 'TEACHER', 'INSTRUCTOR', 
            'TELECALLER', 'FINANCE', 'ASS MANAGER', 'SOCIAL MEDIA MANAGER', 'SOCIAL MEDIA STAFF'
        ].includes(roleUpper) || Boolean(user?.department) || Boolean(user?.businessType);

        const isStudentAccount = !isExplicitStaff && roleUpper === 'STUDENT';

        if (isStudentAccount && user && user.session_id && user.session_id !== verified.sessionId) {
            return res.status(401).json({ error: "Logged in from another device. Please log in again." });
        }

        req.user = verified;
        next();
    } catch (error) {
        return res.status(401).json({ error: "Invalid or Expired Token." });
    }
};

// 🔓 Public Routes
router.get('/businesses', mobileStudentController.getMobileBusinesses);
router.get('/installments/:batchId', mobileStudentController.getMobileInstallments);
router.post('/verify-student', mobileStudentController.verifyStudent);

// 🔒 Protected Routes (Requires Token)
router.post('/update-yt-cookies', verifyToken, mobileStudentController.updateYtCookies);
router.get('/my-payments', verifyToken, mobileStudentController.getMobilePayments);
router.get('/classroom', verifyToken, mobileStudentController.getMobileClassroom);
router.get('/module/:id', verifyToken, mobileStudentController.getCourseModules);
router.get('/classroom/lives', verifyToken, mobileStudentController.getMobileUpcomingLives);
router.post('/profile/password', verifyToken, mobileStudentController.updateMobilePassword);
router.get('/get-video-token', verifyToken, mobileStudentController.getVideoToken);

// 🔥 NEW: Profile Update Route (Image Upload එකත් එක්ක)
router.post('/profile/update', verifyToken, upload.single('image'), mobileStudentController.updateMobileProfile);

// 🔥 Proxy Download Route for Zoom Recordings (Using DB ID)
router.get('/download-rec/:contentId', verifyToken, mobileStudentController.downloadRecording);

// 🔥 Proxy Download Route for Direct Extracted MP4 (Bypass DB & Meeting ID entirely)
router.get('/proxy-stream', verifyToken, mobileStudentController.proxyStreamUrl);

// 🔥 NEW: Staff Dashboard Overview & Status
router.get('/staff/overview', verifyToken, mobileStaffController.getStaffOverview);
router.post('/staff/fcm-token', verifyToken, mobileStaffController.updateFcmToken);
router.post('/staff/agent-status', verifyToken, mobileStaffController.updateAgentStatus);

router.get('/yt-redirect', mobileStudentController.ytRedirect);
router.get('/live-portal', mobileStudentController.getLivePortal);
router.get('/app-event', mobileStudentController.getActiveAppEvent);

module.exports = router;
