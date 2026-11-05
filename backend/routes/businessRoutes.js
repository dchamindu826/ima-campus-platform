const express = require('express');
const router = express.Router();
const businessController = require('../controllers/businessController');
const multer = require('multer');
const verifyToken = require('../middlewares/authMiddleware');

const upload = multer({ dest: 'storage/icons/' });

// Business routes
router.get('/admin/businesses', verifyToken, businessController.getBusinesses);
router.get('/businesses', verifyToken, businessController.getBusinesses);
router.get('/business/my-businesses', verifyToken, businessController.getBusinesses);
router.get('/my-businesses', verifyToken, businessController.getBusinesses);

router.post('/course-setup/business', upload.single('logo'), businessController.createBusiness);
router.put('/admin/business/update', upload.single('logo'), businessController.updateBusiness);
router.delete('/admin/business/delete', businessController.deleteBusiness);
router.put('/course-setup/business/toggle-status', businessController.toggleBusinessStatus);
router.put('/admin/businesses/reorder', verifyToken, businessController.reorderBusinesses);
router.put('/admin/businesses/:id/assign', businessController.assignManagers);

module.exports = router;