const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const libraryController = require('../controllers/libraryController');
const verifyToken = require('../middlewares/authMiddleware');

// Multer Storage for Library PDFs
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../uploads/library');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `lib_${uniqueSuffix}_${cleanName}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedExtensions = ['.pdf', '.docx', '.doc', '.zip', '.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext) || file.mimetype.includes('pdf')) {
        cb(null, true);
    } else {
        cb(new Error('Only PDF and academic document files are allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
    fileFilter: fileFilter
});

// ==========================================
// 🌐 PUBLIC STUDENT PORTAL ROUTES
// ==========================================
router.get('/categories', libraryController.getCategories);
router.get('/grades', libraryController.getGrades);
router.get('/streams', libraryController.getStreams);
router.get('/subjects', libraryController.getSubjects);
router.get('/resources', libraryController.getResources);
router.get('/resources/:id', libraryController.getResourceById);
router.post('/resources/:id/download', libraryController.trackDownload);

// ==========================================
// 🏢 ADMIN & MANAGER ROUTES (STRUCTURE READ & PROTECTED MUTATIONS)
// ==========================================
router.get('/admin/structure', libraryController.getAdminStructure);
router.get('/admin/analytics', libraryController.getLibraryAnalytics);

// Categories
router.post('/admin/categories', verifyToken, libraryController.createCategory);
router.put('/admin/categories/:id', verifyToken, libraryController.updateCategory);
router.delete('/admin/categories/:id', verifyToken, libraryController.deleteCategory);

// Grades
router.post('/admin/grades', verifyToken, libraryController.createGrade);
router.put('/admin/grades/:id', verifyToken, libraryController.updateGrade);
router.delete('/admin/grades/:id', verifyToken, libraryController.deleteGrade);

// Streams
router.post('/admin/streams', verifyToken, libraryController.createStream);
router.put('/admin/streams/:id', verifyToken, libraryController.updateStream);
router.delete('/admin/streams/:id', verifyToken, libraryController.deleteStream);

// Subjects
router.post('/admin/subjects', verifyToken, libraryController.createSubject);
router.put('/admin/subjects/:id', verifyToken, libraryController.updateSubject);
router.delete('/admin/subjects/:id', verifyToken, libraryController.deleteSubject);

// Resources
router.post('/admin/resources/upload', verifyToken, upload.fields([
    { name: 'paper', maxCount: 1 },
    { name: 'markingScheme', maxCount: 1 }
]), libraryController.uploadResource);

router.put('/admin/resources/:id', verifyToken, libraryController.updateResource);
router.delete('/admin/resources/:id', verifyToken, libraryController.deleteResource);

module.exports = router;
