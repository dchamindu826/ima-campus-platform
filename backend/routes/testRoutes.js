const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/authMiddleware');
const testController = require('../controllers/testController');

// Only allow admin (we can add verifyToken if needed, but since this is for testing, let's secure it with the standard// Test Injector Routes
router.get('/context', verifyToken, testController.getContextData);
router.post('/inject-payment', verifyToken, testController.injectPayment);
router.get('/student/:phone', verifyToken, testController.getMockStudentData);
router.delete('/student/:phone', verifyToken, testController.deleteMockData);
router.get('/mock-payments', verifyToken, testController.getMockList);
router.delete('/mock-payments/:id', verifyToken, testController.deleteSingleMock);
router.get('/mock-leads', verifyToken, testController.getMockLeads);
router.post('/assign-mock-lead', verifyToken, testController.assignMockLead);
router.post('/create-open-sem-lead', verifyToken, testController.createOpenSemLead);
router.post('/shift-lead', verifyToken, testController.shiftLeadDates);
router.delete('/mock-leads/:id', verifyToken, testController.deleteSingleMockLead);

module.exports = router;
