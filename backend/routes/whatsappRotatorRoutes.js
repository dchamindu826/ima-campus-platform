const express = require('express');
const router = express.Router();
const whatsappRotatorController = require('../controllers/whatsappRotatorController');

// ================= PUBLIC REDIRECT ROUTES =================
// Immediate 1-click redirect to active WhatsApp Community (Zero UI / Zero delay)
router.get('/join', whatsappRotatorController.redirectJoin);
router.get('/join/:campaign', whatsappRotatorController.redirectJoin);

// Alias under /api/join for API-based routing if needed
router.get('/api/join', whatsappRotatorController.redirectJoin);
router.get('/api/join/:campaign', whatsappRotatorController.redirectJoin);

// ================= ADMIN MANAGEMENT ROUTES =================
// List all links, click statistics, active status
router.get('/api/admin/whatsapp-rotator', whatsappRotatorController.getAllLinks);

// Create a new WhatsApp Community link
router.post('/api/admin/whatsapp-rotator', whatsappRotatorController.createLink);

// Update link, toggle status, update maxLimit, reset click count
router.put('/api/admin/whatsapp-rotator/:id', whatsappRotatorController.updateLink);

// Delete link
router.delete('/api/admin/whatsapp-rotator/:id', whatsappRotatorController.deleteLink);

// Seed initial communities
router.post('/api/admin/whatsapp-rotator/seed', whatsappRotatorController.seedCommunities);

module.exports = router;
