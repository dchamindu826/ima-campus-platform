const express = require('express');
const router = express.Router();
const aiAgentController = require('../controllers/aiAgentController');
const verifyToken = require('../middlewares/authMiddleware');

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'SYSTEM_ADMIN') {
        next();
    } else {
        res.status(403).json({ error: 'Access denied. System Admin only.' });
    }
};

router.post('/chat', verifyToken, isAdmin, aiAgentController.handleChat);

module.exports = router;
