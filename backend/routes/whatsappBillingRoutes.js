const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/authMiddleware');
const whatsappBillingController = require('../controllers/whatsappBillingController');

// All endpoints protected with JWT verifyToken
router.get('/overview', verifyToken, whatsappBillingController.getOverview);
router.get('/rates', verifyToken, whatsappBillingController.getRates);
router.put('/rates', verifyToken, whatsappBillingController.updateRates);
router.get('/health', verifyToken, whatsappBillingController.getMetaHealth);
router.get('/export', verifyToken, whatsappBillingController.exportBillingCsv);

module.exports = router;
