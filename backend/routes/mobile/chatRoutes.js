const express = require('express');
const router = express.Router();
const verifyToken = require('../../middlewares/authMiddleware');
const chatController = require('../../controllers/chatController');

// All chat routes require authentication
router.use(verifyToken);

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../../storage/images/chat_uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

router.get('/profile', chatController.getProfile);
router.post('/profile', chatController.updateProfile);
router.get('/history/:businessId', chatController.getHistory);
router.get('/businesses', chatController.getMyBusinesses);
router.post('/upload', upload.single('image'), chatController.uploadAttachment);

module.exports = router;
