const express = require('express');
const router = express.Router();
const controller = require('../controllers/taskController');
const multer = require('multer');
const path = require('path');
const verifyToken = require('../middlewares/authMiddleware');

const proofStorage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'storage/documents/'); },
    filename: (req, file, cb) => { cb(null, 'proof_' + Date.now() + path.extname(file.originalname)); }
});
const uploadProof = multer({ storage: proofStorage });

router.use(verifyToken);

router.get('/tasks', controller.getTasks);
router.post('/tasks/assign', controller.assignTask);
router.post('/tasks/request-unlock', controller.requestUnlock);
router.post('/tasks/approve-unlock', controller.approveUnlock);
router.get('/tasks/templates/:businessId', controller.getTaskTemplates);
router.post('/tasks/templates', controller.saveTaskTemplates);
router.post('/tasks/complete', controller.completeTask);

// Reject task route
router.post('/tasks/reject', controller.rejectTask);

router.post('/tasks/custom', controller.createCustomTask);
router.post('/tasks/complete-custom', uploadProof.single('proof'), controller.completeCustomTask);
router.post('/tasks/complete-technical-deliverables', uploadProof.single('attachment'), controller.completeTechnicalDeliverables);

// Add these with your other routes
router.get('/tasks/custom-templates/:businessId', controller.getCustomTaskTemplates);
router.post('/tasks/custom-templates', controller.saveCustomTaskTemplate);
router.delete('/tasks/custom-templates/:id', controller.deleteCustomTaskTemplate);

module.exports = router;