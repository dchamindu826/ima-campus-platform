const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController'); // 🔥 මේක විතරයි දැන් ඕනේ
const paycorpController = require('../controllers/paycorpController');
const multer = require('multer');
const path = require('path');


// 🔥 1. Middleware එක import කරගන්න (එක පාරක් පමණයි!)
const { verifyToken, requireStudentDeleteAccess } = require('../middlewares/authMiddleware');

// Storage Configs
const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'storage/images/'); },
    filename: (req, file, cb) => { cb(null, Date.now() + '_' + Math.round(Math.random() * 1E9) + path.extname(file.originalname)); }
});
const uploadImage = multer({ storage: imageStorage });

const documentStorage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'storage/documents/'); },
    filename: (req, file, cb) => { cb(null, Date.now() + '_' + Math.round(Math.random() * 1E9) + path.extname(file.originalname)); }
});
const uploadDocument = multer({ storage: documentStorage });

// ==========================================
// 🔓 STUDENT WEB ROUTES
// ==========================================

router.get('/dashboard', verifyToken, studentController.getStudentDashboard);
router.get('/available-enrollments', verifyToken, studentController.getAvailableEnrollments);
router.get('/my-enrolled-subjects', verifyToken, studentController.getMyEnrolledSubjects);

router.post('/payhere-hash', verifyToken, studentController.generatePayHereHash);

// Paycorp test routes
router.post('/paycorp-init', verifyToken, paycorpController.initPayment);
router.post('/paycorp-complete', verifyToken, paycorpController.completePayment);

// Slips upload (Web එකෙන්)
router.post('/enroll-with-slip', verifyToken, uploadDocument.array('slipImages', 4), studentController.enrollStudent);
router.post('/upload-due-slip', verifyToken, uploadDocument.array('slipImages', 4), studentController.uploadDueSlip);
router.post('/pay-due-online', verifyToken, studentController.payDueOnline);

router.get('/classroom', verifyToken, studentController.getStudentClassroom);
router.get('/module/:id', verifyToken, studentController.getCourseModules);
router.get('/my-payments', verifyToken, studentController.getMyPayments);

router.get('/getVideoStream/:videoId', verifyToken, studentController.getVideoStream);

router.post('/profile/update', verifyToken, uploadImage.single('image'), studentController.updateProfile);
router.post('/profile/password', verifyToken, studentController.updatePassword);

// PayHere Webhook (මේකට Token ඕනේ නැහැ PayHere එකෙන් එවන නිසා)
router.post('/payhere-notify', studentController.payhereNotify);

// ==========================================
// 🚚 STUDENT DELIVERY ROUTES (NEW)
// ==========================================

router.get('/deliveries', verifyToken, studentController.getMyDeliveries);
router.post('/deliveries/confirm', verifyToken, studentController.confirmDelivery);

// ==========================================
// 🏢 DATA CENTER & GHOST LOGIN
// ==========================================

router.get('/data-center', verifyToken, studentController.getStudentsDataCenter);
router.post('/admin-update', verifyToken, studentController.updateStudentByAdmin);
router.post('/admin-reset-password', verifyToken, studentController.resetStudentPassword);
router.post('/ghost-login', verifyToken, studentController.ghostLogin);

// 🔥 Delete Student Account 🔥
router.post('/admin-delete', verifyToken, requireStudentDeleteAccess, studentController.deleteStudentAccount);

module.exports = router;