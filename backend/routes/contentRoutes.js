const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { verifyToken, requireStaff, requireAdmin } = require('../middlewares/authMiddleware');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const controller = require('../controllers/contentController'); 

// Upload Configs
const iconStorage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'storage/icons/'); },
    filename: (req, file, cb) => { cb(null, Date.now() + '_' + Math.round(Math.random() * 1E9) + path.extname(file.originalname)); }
});
const uploadIcon = multer({ storage: iconStorage });

const docStorage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'storage/documents/'); },
    filename: (req, file, cb) => { cb(null, Date.now() + '_' + Math.round(Math.random() * 1E9) + path.extname(file.originalname)); }
});
const uploadDoc = multer({ storage: docStorage });

const postStorage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'storage/posts/'); },
    filename: (req, file, cb) => { cb(null, 'post_' + Date.now() + '_' + Math.round(Math.random() * 1E9) + path.extname(file.originalname)); }
});
const uploadPost = multer({ storage: postStorage });

// ================= ROUTES =================

// Content Hub
router.post('/admin/manager/content-group/add', verifyToken, requireStaff, controller.addContentGroup);
router.put('/admin/content-group/update', verifyToken, requireStaff, controller.updateContentGroup);
router.delete('/admin/content-group/delete', verifyToken, requireStaff, controller.deleteContentGroup);
router.post('/admin/manager/contents/mass-assign', verifyToken, requireStaff, uploadDoc.fields([
    { name: 'file', maxCount: 20 }, 
    { name: 'thumbnail', maxCount: 1 },
    { name: 'mcqFile', maxCount: 1 },
    { name: 'structuredFile', maxCount: 1 }
]), controller.addContentMassAssign);

router.put('/admin/manager/contents/update', verifyToken, requireStaff, uploadDoc.fields([
    { name: 'file', maxCount: 20 }, 
    { name: 'thumbnail', maxCount: 1 },
    { name: 'mcqFile', maxCount: 1 },
    { name: 'structuredFile', maxCount: 1 }
]), controller.updateContentMassAssign);
router.delete('/admin/content/delete', verifyToken, requireStaff, controller.deleteContent);
router.post('/admin/content/unlink-course', verifyToken, requireStaff, controller.unlinkContentCourse);
router.get('/admin/manager/get-contents', verifyToken, requireStaff, controller.getContents); 

// Groups
router.post('/course-setup/group', verifyToken, requireStaff, controller.createGroup);
router.put('/course-setup/group/update', verifyToken, requireStaff, controller.updateGroup);
// 🔥 FIX: Group eka delete karana route eka 🔥
router.delete('/course-setup/group', verifyToken, requireStaff, controller.deleteGroup); 

// Posts 
router.post('/admin/manager/post/create', verifyToken, requireStaff, uploadPost.single('image'), controller.createAdminPost);
router.get('/admin/manager/posts', verifyToken, requireStaff, controller.getPosts);
router.delete('/admin/manager/post/delete', verifyToken, requireStaff, controller.deletePost);

// Batches Data Load
router.get('/admin/manager/batches-full', verifyToken, requireStaff, controller.getBatchesFull);

// Get Batches by Business ID
router.get('/admin/batches/:bizId', verifyToken, requireStaff, async (req, res) => {
    try {
        const parsedBizId = parseInt(req.params.bizId);
        if (isNaN(parsedBizId)) return res.status(400).json({ error: "Invalid business ID" });
        const batches = await prisma.batch.findMany({
            where: { businessId: parsedBizId },
            include: { 
                groups: { include: { courses: true } },
                business: true
            },
            orderBy: [
                { itemOrder: 'asc' },
                { id: 'asc' }
            ]
        });
        const safeData = JSON.parse(JSON.stringify(batches, (k, v) => typeof v === 'bigint' ? v.toString() : v));
        res.status(200).json({ batches: safeData });
    } catch (error) { res.status(500).json({ error: "Failed to fetch batches" }); }
});

// Businesses Setup
router.post('/course-setup/business', verifyToken, requireStaff, uploadIcon.single('logo'), controller.createBusiness);
router.put('/admin/business/update', verifyToken, requireStaff, uploadIcon.single('logo'), controller.updateBusiness);
router.delete('/admin/business/delete', verifyToken, requireAdmin, controller.deleteBusiness); // 🔥 NEW

// Batches Setup
router.post('/course-setup/batch', verifyToken, requireStaff, uploadIcon.single('logo'), controller.createBatch);
router.put('/admin/batch/update', verifyToken, requireStaff, uploadIcon.single('logo'), controller.updateBatch);
router.delete('/admin/batch/delete', verifyToken, requireAdmin, controller.deleteBatch);
router.put('/admin/batch/lecturers', verifyToken, requireStaff, controller.updateBatchLecturers);

// Subjects Setup (🔥 FIX: uploadIcon.any() damma images ganna puluwan wenna 🔥)
router.post('/course-setup/subject', verifyToken, requireStaff, uploadIcon.any(), controller.createSubject);
router.put('/admin/course/update', verifyToken, requireStaff, uploadIcon.any(), controller.updateSubject);
router.delete('/admin/course/delete', verifyToken, requireAdmin, controller.deleteSubject); 
router.put('/admin/course/assign-lecturer', verifyToken, requireStaff, controller.assignLecturer); // 🔥 NEW LECTURER ROUTE 🔥

// Installments Setup
router.post('/course-setup/installment', verifyToken, requireStaff, controller.createInstallment);
router.get('/course-setup/installment/:batchId', verifyToken, requireStaff, controller.getInstallments);
router.put('/course-setup/installment', verifyToken, requireStaff, controller.updateInstallment);
router.delete('/course-setup/installment', verifyToken, requireAdmin, controller.deleteInstallment);


// Update these paths based on your actual route file structure
router.put('/course-setup/business/toggle-status', verifyToken, requireStaff, controller.toggleBusinessStatus);
router.put('/course-setup/batch/toggle-status', verifyToken, requireStaff, controller.toggleBatchStatus);

// ================= ZOOM DYNAMIC DOWNLOAD ROUTE =================
// 🔥 NEW: Zoom API එක හරහා fresh MP4 ලින්ක් එකක් අරන් App එකට JSON එකක් විදිහට දෙන Route එක 🔥
router.get('/mobile/zoom-direct-link/:contentId', controller.getZoomDirectLinkJson);
router.get('/zoom-direct-link/:contentId', controller.getZoomDirectLinkJson);

// ================= APP EVENTS (ANIMATIONS) =================
// 🔥 Admin Panel එකෙන් Animation එක Set කරන්න සහ බලන්න 🔥
router.get('/admin/settings/app-event', verifyToken, requireStaff, controller.getAppEvent);
router.put('/admin/settings/app-event', verifyToken, requireAdmin, controller.setAppEvent);

// ================= SYSTEM MAINTENANCE MODE =================
// 🔥 Admin Panel එකෙන් System Update Banner එක Set කරන්න සහ බලන්න 🔥
router.get('/admin/settings/maintenance-mode', verifyToken, requireStaff, controller.getMaintenanceMode);
router.put('/admin/settings/maintenance-mode', verifyToken, requireAdmin, controller.setMaintenanceMode);

// 🔥 Mobile App එකෙන් Active Animation එක මොකක්ද කියලා අහන්න 🔥
router.get('/mobile/app-event', controller.getAppEvent);

module.exports = router;