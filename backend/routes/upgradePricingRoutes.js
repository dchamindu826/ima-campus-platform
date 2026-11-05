const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const upgradePricingController = require('../controllers/upgradePricingController');
const { verifyToken, requireStaff } = require('../middlewares/authMiddleware');

// Multer Storage Configuration for Upgrade Banner Images
const bannerStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'storage/posts/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E9);
        cb(null, 'upgrade_' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Strictly validate that uploaded files are only safe image formats
const imageFilter = (req, file, cb) => {
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only standard images (.png, .jpg, .jpeg, .webp, .gif) are allowed.'), false);
    }
};

const uploadBanner = multer({
    storage: bannerStorage,
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// All upgrade routing requires authentication
router.use(verifyToken);

// 1. Calculate student's personalized upgrade details
router.get('/calculate', upgradePricingController.calculateUpgrade);

// 2. Fetch manager-configured upgrade prices
router.get('/admin/prices', requireStaff, upgradePricingController.getAdminPrices);

// 3. Save / Update upgrade prices in bulk
router.post('/admin/set-prices', requireStaff, upgradePricingController.setAdminPrices);

// 4. Get visibility toggle status
router.get('/toggle-status', upgradePricingController.getUpgradeOfferToggle);

// 5. Save visibility toggle status
router.post('/toggle-status', requireStaff, upgradePricingController.setUpgradeOfferToggle);

// 6. Secure banner upload for special upgrade widget
router.post('/admin/upload-banner', requireStaff, uploadBanner.single('banner'), upgradePricingController.uploadBanner);

module.exports = router;
