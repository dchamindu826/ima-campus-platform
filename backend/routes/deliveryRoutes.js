const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');
const verifyToken = require('../middlewares/authMiddleware');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'storage/documents/'),
    filename: (req, file, cb) => cb(null, 'TUTE_' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });


// Admin POS and Delivery Actions
router.get('/pending', deliveryController.getPendingDeliveries);
router.post('/pack', deliveryController.packDelivery);
router.post('/hold', deliveryController.holdDelivery);
router.get('/payment-details', deliveryController.getDeliveryPaymentDetails);

router.put('/:id/label', deliveryController.updateDeliveryLabel);

// Tute Stock Actions
router.get('/stock', deliveryController.getTuteStocks);
router.post('/stock/add', deliveryController.addTuteStock);
router.delete('/stock/clear-all', verifyToken, deliveryController.clearAllTuteStock);

// ================= TUTE STOCK MANAGEMENT =================
router.get('/master-tutes', deliveryController.getMasterTutes);
router.post('/master-tutes/lecturer', upload.fields([{ name: 'image', maxCount: 1 }]), deliveryController.saveMasterLecturer);
router.delete('/master-tutes/lecturer/:id', deliveryController.deleteMasterLecturer);
router.post('/master-tutes/tute', upload.fields([{ name: 'image', maxCount: 1 }]), deliveryController.saveMasterTute);
router.delete('/master-tutes/tute/:lecturerId/:tuteId', deliveryController.deleteMasterTute);

router.get('/stock/global', deliveryController.getGlobalStock); // 🔥 අලුත්
router.get('/stock/history/global', deliveryController.getGlobalStockHistory); // 🔥 අලුත්
router.get('/stock/batch/:batchId', deliveryController.getBatchStock); 
router.post('/stock/add', deliveryController.addTuteStock);
router.post('/stock/custom', upload.single('tuteCover'), deliveryController.addCustomTute);
router.put('/stock/edit', deliveryController.editTuteStock);
router.delete('/stock/delete/:id', deliveryController.deleteTuteStock);
router.get('/stock/history/:courseIds', deliveryController.getStockHistory);
router.get('/stats', deliveryController.getDeliveryStats);
router.get('/stock/analytics', deliveryController.getStockAnalytics);

// Delivery History (Delivered & Returned Tab එකට)
router.get('/history', async (req, res) => {
    try {
        const history = await prisma.delivery.findMany({
            where: { status: { notIn: ['Pending', 'Hold'] } },
            include: { 
                payment: { 
                    include: { student: true } 
                } 
            },
            orderBy: { updatedAt: 'desc' }
        });
        
        const formatted = history.map(h => ({
            id: `ORD-${h.id}`,
            studentName: h.payment?.student ? `${h.payment.student.firstName} ${h.payment.student.lastName}` : 'Unknown',
            trackingNumber: h.trackingNumber || 'N/A',
            status: h.status === 'Received' ? 'Delivered' : h.status,
            date: new Date(h.updatedAt).toISOString().split('T')[0]
        }));
        
        res.status(200).json(formatted);
    } catch (error) {
        console.error("History fetch error:", error);
        res.status(500).json([]);
    }
});

router.get('/dispatch', deliveryController.getDispatchDeliveries);
router.get('/history-advanced', deliveryController.getAdvancedHistory);
router.put('/manual-confirm/:deliveryId', deliveryController.manualConfirmDelivery);
router.put('/update-tracking/:deliveryId', deliveryController.updateTracking);

router.get('/stock/report', deliveryController.getTuteDeliveryReport);

// ================= CC BUSINESS MANAGER & SUPER ADMIN ROUTES =================
router.get('/manager/lecturer-stock', verifyToken, deliveryController.getManagerLecturerTuteStock);
router.get('/manager/packing-calendar', verifyToken, deliveryController.getPackingCalendarHistory);
router.get('/manager/packing-day-details', verifyToken, deliveryController.getPackingDayDetails);

module.exports = router;