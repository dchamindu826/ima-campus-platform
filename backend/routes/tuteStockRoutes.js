const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/authMiddleware');
const deliveryController = require('../controllers/deliveryController');
const multer = require('multer');
const path = require('path');

const docStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'storage/documents/'),
    filename: (req, file, cb) => cb(null, 'TUTE_' + Date.now() + '_' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
});
const uploadDoc = multer({ storage: docStorage });

// Routes for physical tute stock management
router.post('/create-tute', verifyToken, uploadDoc.fields([{ name: 'tuteImage', maxCount: 1 }, { name: 'tuteImage2', maxCount: 1 }]), deliveryController.createTuteStock);
router.put('/edit-tute', verifyToken, uploadDoc.fields([{ name: 'tuteImage', maxCount: 1 }, { name: 'tuteImage2', maxCount: 1 }]), deliveryController.updateTuteStock);
router.delete('/delete-tute/:id', verifyToken, deliveryController.deleteTuteStock);

// Routes for lecturer management
router.put('/lecturer/update', verifyToken, uploadDoc.single('image'), deliveryController.updateLecturerInfo);
router.delete('/lecturer/delete/:oldName', verifyToken, deliveryController.deleteLecturerGlobal);

module.exports = router;
