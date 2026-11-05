const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const verifyToken = require('../middlewares/authMiddleware');

const multer = require('multer');
const path = require('path');
const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'storage/users/'); },
    filename: (req, file, cb) => { cb(null, 'user_' + Date.now() + path.extname(file.originalname)); }
});
const uploadImage = multer({ storage: imageStorage });

router.use(verifyToken);

// 🔥 IMPORTANT: /businesses eka /:id ekata udin danna ona
router.get('/lumi-stats', staffController.getLumiStats);
router.get('/lumi-missed-calls', staffController.getLumiMissedCalls);
router.get('/lumi-invoice-data', staffController.getLumiInvoiceData);
router.get('/businesses', staffController.getBusinesses); 
router.get('/', staffController.getStaff);
router.post('/', staffController.createStaff);
router.post('/profile-picture', uploadImage.single('image'), staffController.uploadProfilePicture);
router.put('/:id/channel', staffController.allocateChannel);
router.put('/:id', staffController.updateStaff);
router.delete('/:id', staffController.deleteStaff);

module.exports = router;