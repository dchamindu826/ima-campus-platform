// /api/v2/live/:id — the page behind a student live-class link (/live/<id>).
// Login required (header or ?token=). Students get their payment check result;
// staff always see the class (they are previewing / testing the link).

const express = require('express');
const rules = require('./rules');

const db = () => require('../../core/db');
const router = express.Router();

router.get('/:id', async (req, res) => {
    const { readUser } = require('../../core/linkAuth');
    const { normRole } = require('../../core/auth');
    const entitlement = require('../entitlement/service');
    const { enforcing, denyMessage } = require('../entitlement/guard');

    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'BAD_ID' });
    const user = await readUser(req);
    if (!user) return res.status(401).json({ error: 'LOGIN_REQUIRED', message: 'Please log in to join this class.' });

    const content = await db().content.findUnique({
        where: { id },
        select: { id: true, title: true, contentType: true, link: true, date: true, startTime: true, endTime: true, courseId: true, batchId: true },
    });
    if (!content || !rules.isLiveContent(content)) return res.status(404).json({ error: 'LIVE_NOT_FOUND', message: 'This live class was not found.' });

    const [course, batch] = await Promise.all([
        content.courseId ? db().course.findUnique({ where: { id: content.courseId }, select: { name: true } }) : null,
        content.batchId ? db().batch.findUnique({ where: { id: content.batchId }, select: { name: true } }) : null,
    ]);

    let access = { allowed: true, reason: 'staff' };
    const role = normRole(user.role);
    if (!role || role === 'STUDENT') {
        try {
            const r = await entitlement.canAccessContent(user.id, id);
            access = r.allowed || !enforcing()
                ? { allowed: true, reason: r.reason }
                : { allowed: false, reason: r.reason, message: denyMessage(r.reason) };
        } catch (err) {
            console.error(`[live-link] access check failed content=${id}, allowing:`, err);
            access = { allowed: true, reason: 'check-failed' };
        }
    }
    res.json(rules.livePageView(content, { courseName: course?.name, batchName: batch?.name, access }));
});

module.exports = router;
