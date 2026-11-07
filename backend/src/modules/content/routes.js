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

// Content Hub ⬆ ⬇ buttons. Body: { folders: [[ids of folder 1], [ids of folder 2], ...] } top to bottom.
router.post('/folders/reorder', async (req, res) => {
    const folders = req.body && req.body.folders;
    if (!Array.isArray(folders) || folders.length === 0) return res.status(400).json({ error: 'folders required' });
    if (folders.length > 300) return res.status(400).json({ error: 'too many folders' });
    const updated = await service.reorderFolders(folders);
    res.json({ updated });
});

module.exports = router;
