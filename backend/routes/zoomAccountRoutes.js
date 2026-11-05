const express = require('express');
const router = express.Router();
const zoomAccountController = require('../controllers/zoomAccountController');

router.use((req, res, next) => require('../middlewares/authMiddleware')(req, res, next));
router.use((req, res, next) => {
    const role = req.user.role ? req.user.role.toUpperCase().replace(/ /g, '_') : '';
    if (!['SYSTEM_ADMIN', 'DIRECTOR'].includes(role)) {
        return res.status(403).json({ error: "Access Denied. Insufficient permissions." });
    }
    next();
});

router.get('/', zoomAccountController.getAllZoomAccounts);
router.post('/', zoomAccountController.createZoomAccount);
router.put('/:id', zoomAccountController.updateZoomAccount);
router.delete('/:id', zoomAccountController.deleteZoomAccount);

module.exports = router;
