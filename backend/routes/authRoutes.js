const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const { verifyToken, requireAdmin, requireAdminOrManager } = require('../middlewares/authMiddleware');
const { loginLimiter, registerLimiter } = require('../middlewares/rateLimiter');

// Frontend eke idan ena POST requests
router.post('/register', registerLimiter, authController.registerStudent);
router.post('/login', loginLimiter, authController.loginUser);

// 🔒 Ghost Login - Protected for Admin and authorized Managers (subordinate impersonation only)
router.post('/ghost-login/:id', verifyToken, requireAdminOrManager, authController.ghostLogin);

module.exports = router;