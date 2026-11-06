// /api/v2/delivery — reconciliation for the delivery team (staff only).

const express = require('express');
const { authenticate, requireStaff } = require('../../core/auth');
const { badRequest } = require('../../core/errors');
const service = require('./service');

const router = express.Router();
router.use(authenticate, requireStaff);

// What's missing / what shouldn't ship. ?days=90
router.get('/reconcile', async (req, res) => {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 90, 1), 365);
    const [m, orphans] = await Promise.all([service.findMissingDeliveries({ days }), service.findOrphanDeliveries()]);
    res.json({ days, scanned: m.scanned, truncated: m.truncated, missing: m.missing, awaitingManual: m.awaitingManual, orphans });
});

// Create the missing delivery for one payment.
router.post('/reconcile/:paymentId/create', async (req, res) => {
    const id = parseInt(req.params.paymentId, 10);
    if (isNaN(id) || id <= 0) throw badRequest('Invalid payment id');
    res.json(await service.createMissingDelivery(id));
});

module.exports = router;
