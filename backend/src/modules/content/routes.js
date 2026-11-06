// /api/v2/content — content reports for coordinators (staff only).

const express = require('express');
const { authenticate, requireStaff } = require('../../core/auth');
const service = require('./service');

const router = express.Router();
router.use(authenticate, requireStaff);

// Recordings / lives in a folder of another batch or wrong type. ?days=120&batchId=
router.get('/misfiled', async (req, res) => {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 120, 1), 730);
    const batchId = parseInt(req.query.batchId, 10) || undefined;
    res.json(await service.findMisfiledContents({ days, batchId }));
});

module.exports = router;
