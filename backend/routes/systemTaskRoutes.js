const express = require('express');
const router = express.Router();
const systemTaskController = require('../controllers/systemTaskController');
const verifyToken = require('../middlewares/authMiddleware');
const multer = require('multer');
const path = require('path');

// Multer Storage Configuration (stores in storage/documents)
const documentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'storage/documents/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '_' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});

// Clean up/validate upload filters TODO(security)
const fileFilter = (req, file, cb) => {
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only image attachments (.png, .jpg, .jpeg, .webp) are allowed!'), false);
    }
};

const uploadDocument = multer({ 
    storage: documentStorage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB size limit
});

// All routes are authenticated
router.use(verifyToken);

// 1. Staff submits reported issue
router.post('/', uploadDocument.array('images', 5), systemTaskController.createStaffTask);

// 2. Get pending task counts (widget dot)
router.get('/pending-count', systemTaskController.getPendingTasksCount);

// 3. Admin retrieves all system tasks
router.get('/admin', systemTaskController.getAdminTasks);

// 3. Admin creates manual task
router.post('/admin', uploadDocument.array('images', 5), systemTaskController.createAdminTask);

// 4. Admin updates task (status / remarks)
router.put('/admin/:id', systemTaskController.updateAdminTask);

module.exports = router;
