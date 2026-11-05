const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');
const studentController = require('../controllers/studentController');
const adminController = require('../controllers/adminController'); 
const databaseController = require('../controllers/databaseController');
const managerDashboardController = require('../controllers/managerDashboardController');
const leadDataCenterController = require('../controllers/leadDataCenterController');
const adminAnalyticsController = require('../controllers/adminAnalyticsController');
const { verifyToken, requireAdmin, requireStaff, requireStudentDeleteAccess } = require('../middlewares/authMiddleware');

// 🔒 All routes under /api/admin strictly require at least staff privileges
router.use(verifyToken);
router.use(requireStaff);

// Executive All-in-One Analytics Hub
router.get('/all-in-one-analytics', adminAnalyticsController.getExecutiveAnalytics);

// Admin Profile
router.get('/profile', adminController.getAdminProfile);

// Admin Overview
router.get('/overview', adminController.getSystemOverview);
router.get('/logs', adminController.getLiveLogs);
router.post('/audit-logs', adminController.getAuditLogs);

// Lead Data Center
router.get('/lead-data-center', leadDataCenterController.getLeadDataCenterRecords);

// Manager Overview
router.get('/manager/overview', verifyToken, async (req, res) => {
  try {
      const userId = req.user?.userId || req.user?.id;
      const userRole = req.user?.role;
      const businessType = req.user?.businessType;

      const roleUpper = userRole ? userRole.toUpperCase().replace(/ /g, '_') : '';
      const isAdmin = ['SYSTEM_ADMIN', 'DIRECTOR'].includes(roleUpper);

      let matchedBusiness = null;

      if (!isAdmin) {
          const allBiz = await prisma.business.findMany();
          const userBizList = businessType ? String(businessType).split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];

          const myBizs = allBiz.filter(biz => {
              const isManagerOf = (biz.head_manager_id && String(biz.head_manager_id) === String(userId)) ||
                                  (biz.ass_manager_id && String(biz.ass_manager_id) === String(userId));
              const matchesBizType = userBizList.some(b => 
                  b === String(biz.id) ||
                  b === biz.name.toLowerCase().trim() ||
                  biz.name.toLowerCase().trim().includes(b) ||
                  b.includes(biz.name.toLowerCase().trim())
              );
              return isManagerOf || matchesBizType;
          });

          if (myBizs.length > 0) {
              matchedBusiness = myBizs[0];
          }
      }

      if (!matchedBusiness) {
          matchedBusiness = await prisma.business.findFirst();
      }

      const safeBusiness = matchedBusiness ? JSON.parse(JSON.stringify(matchedBusiness, (key, value) => typeof value === 'bigint' ? value.toString() : value)) : null;
      res.status(200).json({ business: safeBusiness, message: "Manager overview data loaded" });
  } catch (error) {
      console.error("Manager overview error:", error);
      res.status(500).json({ error: "Failed to load manager overview" });
  }
});

router.get('/manager/dashboard-stats', managerDashboardController.getManagerDashboardOverview);

// ==========================================
// 🔥 STUDENT DATA CENTER ROUTES 🔥
// ==========================================
router.get('/students-data-center', studentController.getStudentsDataCenter);
router.get('/student-inspect/:query', studentController.inspectStudentRecords);
router.put('/students/update', studentController.updateStudentByAdmin);
router.post('/students/reset-password', studentController.resetStudentPassword);
router.post('/ghost-login', studentController.ghostLogin);
router.post('/admin-delete', requireStudentDeleteAccess, studentController.deleteStudentAccount);

// Backup
router.get('/backup', requireAdmin, adminController.downloadDatabaseBackup);

// LUMI Caller Channels API
router.get('/whatsapp-call/channels', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: {
                role: {
                    in: ['COORDINATOR', 'MANAGER', 'ASS MANAGER']
                }
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true, // User has no username column (this route always returned 500)
                role: true,
                department: true,
                businessType: true,
                agentStatus: true,
            }
        });
        res.status(200).json({ success: true, channels: users });
    } catch (error) {
        console.error('Error fetching channels', error);
        res.status(500).json({ error: error.message });
    }
});

// 🔥 Database Manager Routes 🔥
router.get('/database/:model', requireAdmin, databaseController.getAllData);
router.put('/database/:model/:id', requireAdmin, databaseController.updateRecord);
router.delete('/database/:model/:id', requireAdmin, databaseController.deleteRecord);

// 🔥 Ringtone Management Routes 🔥
const ringtoneController = require('../controllers/ringtoneController');
const multer = require('multer');
const path = require('path');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../../storage/ringtone'));
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

router.get('/ringtones', ringtoneController.getRingtones);
router.post('/ringtones/upload', upload.single('ringtone'), ringtoneController.uploadRingtone);
router.post('/ringtones/assign', ringtoneController.assignRingtone);

// 🔥 LUMI AI ANALYSER & FORECASTING ROUTES 🔥
const lumiAiAnalyserController = require('../controllers/lumiAiAnalyserController');
router.post('/lumi-ai-analyser/chat', lumiAiAnalyserController.handleLumiAiChat);
router.post('/lumi-ai-analyser/forecast', lumiAiAnalyserController.generateBatchForecast);

module.exports = router;