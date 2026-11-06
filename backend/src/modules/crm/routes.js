// /api/v2/crm — staff only.

const express = require('express');
const { authenticate, requireStaff } = require('../../core/auth');
const service = require('./service');

const router = express.Router();
router.use(authenticate, requireStaff);

// Leads whose enrollment status does not match the student's payments. ?batchId=&businessId=&kind=
router.get('/enrollment-report', async (req, res) => {
    const r = await service.enrollmentReport({
        batchId: parseInt(req.query.batchId, 10) || undefined,
        businessId: parseInt(req.query.businessId, 10) || undefined,
    });
    const kind = req.query.kind;
    const changes = kind ? r.changes.filter((c) => c.kind === kind) : r.changes;
    res.json({ ...r, changes: changes.slice(0, 500), total: changes.length });
});

module.exports = router;
