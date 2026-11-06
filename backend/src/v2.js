// /api/v2 — entry point for the new modular backend.
// Each module adds its router here as it is migrated (see ARCHITECTURE.md).

const express = require('express');
const { errorHandler } = require('./core/errors');

const router = express.Router();

router.use('/entitlements', require('./modules/entitlement/routes'));
router.use('/delivery', require('./modules/delivery/routes'));
router.use('/content', require('./modules/content/routes'));

router.use(errorHandler);

module.exports = router;
