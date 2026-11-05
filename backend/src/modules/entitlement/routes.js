// /api/v2/entitlements — student access, from the single source of truth.

const express = require('express');
const { authenticate, requireStudent, requireStaff } = require('../../core/auth');
const { badRequest } = require('../../core/errors');
const service = require('./service');

const router = express.Router();

const idParam = (value) => {
    const n = parseInt(value, 10);
    if (isNaN(n) || n <= 0) throw badRequest('Invalid id');
    return n;
};

// Student: which courses can I open?
router.get('/me/courses', authenticate, requireStudent, async (req, res) => {
    const courseIds = await service.listAccessibleCourseIds(req.user.id);
    res.json({ courseIds });
});

// Student: can I open this course?
router.get('/me/courses/:courseId', authenticate, requireStudent, async (req, res) => {
    res.json(await service.explainCourseAccess(req.user.id, idParam(req.params.courseId)));
});

// Staff support tool: "why can't student X see course Y?" — answers without ghost login.
router.get('/students/:studentId/courses/:courseId', authenticate, requireStaff, async (req, res) => {
    res.json(await service.explainCourseAccess(idParam(req.params.studentId), idParam(req.params.courseId)));
});

router.get('/students/:studentId/contents/:contentId', authenticate, requireStaff, async (req, res) => {
    res.json(await service.canAccessContent(idParam(req.params.studentId), idParam(req.params.contentId)));
});

router.get('/students/:studentId/courses', authenticate, requireStaff, async (req, res) => {
    const courseIds = await service.listAccessibleCourseIds(idParam(req.params.studentId));
    res.json({ courseIds });
});

module.exports = router;
