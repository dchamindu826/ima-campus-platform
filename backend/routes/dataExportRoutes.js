const express = require('express');
const router = express.Router();
const { verifyToken, requireStaff } = require('../middlewares/authMiddleware');

const dataExportController = require('../controllers/dataExportController'); 
const financeController = require('../controllers/financeController'); 

router.use(verifyToken);
router.use(requireStaff); 

// Route: GET /api/admin/data-export/module-one
router.get('/module-one', dataExportController.getModuleOneAnalytics);

// Route: GET /api/admin/data-export/compare-batches
router.get('/compare-batches', dataExportController.getBatchComparison);

// Route: GET /api/admin/data-export/coordinator-kpi
router.get('/coordinator-kpi', dataExportController.getCoordinatorKPI);

// Route: GET /api/admin/data-export/finance-matrix
router.get('/finance-matrix', financeController.getFinanceMatrix);

// Route: GET /api/admin/data-export/paid-campaign
router.get('/paid-campaign', financeController.getPaidCampaignDropMatrix);

module.exports = router;