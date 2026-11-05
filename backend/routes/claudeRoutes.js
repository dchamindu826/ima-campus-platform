const express = require('express');
const router = express.Router();
const claudeController = require('../controllers/claudeController');
const verifyToken = require('../middlewares/authMiddleware');

const isAdmin = (req, res, next) => {
    const role = req.user?.role;
    if (role === 'SYSTEM_ADMIN' || role === 'System Admin' || role === 'DIRECTOR' || role === 'SUPER' || role === 'ADMIN') {
        next();
    } else {
        res.status(403).json({ error: 'Access denied. System Admin only.' });
    }
};

router.post('/chat', verifyToken, isAdmin, claudeController.handleChat);
router.post('/generate-image', verifyToken, isAdmin, claudeController.generateImage);
router.get('/status', verifyToken, isAdmin, claudeController.getStatus);

module.exports = router;
