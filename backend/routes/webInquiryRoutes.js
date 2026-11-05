const express = require('express');
const router = express.Router();
const webInquiryController = require('../controllers/webInquiryController');
const verifyToken = require('../middlewares/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../storage/images/chat_uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Student Side Routes
router.post('/start', verifyToken, webInquiryController.startInquiry);
router.post('/upload', verifyToken, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: "No file provided" });
    return res.json({ success: true, fileUrl: req.file.filename });
});
router.get('/my-inquiries', verifyToken, webInquiryController.getMyInquiries);

// Staff Side Routes
router.get('/', verifyToken, webInquiryController.getInquiries);
router.get('/:inquiryId/messages', verifyToken, webInquiryController.getMessages);
router.get('/:inquiryId/student-info', verifyToken, webInquiryController.getStudentInfo);
router.post('/assign', verifyToken, webInquiryController.assignInquiry);
router.post('/resolve', verifyToken, webInquiryController.resolveInquiry);
router.post('/mark-read', verifyToken, webInquiryController.markAsRead);
router.get('/search-students', verifyToken, webInquiryController.searchStudents);
router.post('/create-or-get', verifyToken, webInquiryController.createOrGetInquiry);

router.post('/student-mark-read', verifyToken, webInquiryController.studentMarkAsRead);

module.exports = router;
