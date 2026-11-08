// /api/v2/live — the page behind a student live-class link.
//   /live/z/<key>  one link per Zoom meeting (same Zoom link in 2-3 batches → same link)
//   /live/<id>     one class (older links)
// Login required (header or ?token=). Students get their payment check result;
// staff always see the class (they are previewing / testing the link).

const express = require('express');
const rules = require('./rules');

const db = () => require('../../core/db');
const router = express.Router();

const LIVE_TYPES = ['live', '1'];
const CONTENT_SELECT = { id: true, title: true, contentType: true, link: true, meetingId: true, date: true, startTime: true, endTime: true, courseId: true, batchId: true, createdAt: true };
const RECENT_DAYS = 180;

async function loginOr401(req, res) {
    const { readUser } = require('../../core/linkAuth');
    const user = await readUser(req);
    if (!user) res.status(401).json({ error: 'LOGIN_REQUIRED', message: 'Please log in to join this class.' });
    return user;
}

/** Payment check for one class. */
async function accessFor(user, contentId) {
    const { normRole } = require('../../core/auth');
    const entitlement = require('../entitlement/service');
    const { enforcing, denyMessage } = require('../entitlement/guard');
    const role = normRole(user.role);
    if (role && role !== 'STUDENT') return { allowed: true, reason: 'staff' };
    try {
        const r = await entitlement.canAccessContent(user.id, contentId);
        return r.allowed || !enforcing()
            ? { allowed: true, reason: r.reason }
            : { allowed: false, reason: r.reason, message: denyMessage(r.reason) };
    } catch (err) {
        console.error(`[live-link] access check failed content=${contentId}, allowing:`, err);
        return { allowed: true, reason: 'check-failed' };
    }
}

async function view(content, access) {
    const [course, batch] = await Promise.all([
        content.courseId ? db().course.findUnique({ where: { id: content.courseId }, select: { name: true } }) : null,
        content.batchId ? db().batch.findUnique({ where: { id: content.batchId }, select: { name: true } }) : null,
    ]);
    return rules.livePageView(content, { courseName: course?.name, batchName: batch?.name, access });
}

// One link per Zoom meeting: find every live class (any batch) with that Zoom link and
// let the student in through the first one they have paid for.
router.get('/z/:key', async (req, res) => {
    const key = String(req.params.key || '').toLowerCase();
    if (!/^[0-9a-z]{4,16}$/.test(key)) return res.status(400).json({ error: 'BAD_KEY' });
    const user = await loginOr401(req, res);
    if (!user) return;

    const since = new Date(Date.now() - RECENT_DAYS * 86400000);
    const lives = await db().content.findMany({
        where: { contentType: { in: LIVE_TYPES }, createdAt: { gte: since } },
        select: CONTENT_SELECT,
    });
    const matches = rules.sortByNearest(lives.filter((c) => rules.liveKey(c.link, c.meetingId) === key));
    if (matches.length === 0) return res.status(404).json({ error: 'LIVE_NOT_FOUND', message: 'This live class was not found.' });

    let firstDeny = null;
    for (const c of matches.slice(0, 10)) {
        const access = await accessFor(user, c.id);
        if (access.allowed) return res.json(await view(c, access));
        if (!firstDeny) firstDeny = { c, access };
    }
    res.json(await view(firstDeny.c, firstDeny.access));
});

router.get('/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'BAD_ID' });
    const user = await loginOr401(req, res);
    if (!user) return;
    const content = await db().content.findUnique({ where: { id }, select: CONTENT_SELECT });
    if (!content || !rules.isLiveContent(content)) return res.status(404).json({ error: 'LIVE_NOT_FOUND', message: 'This live class was not found.' });
    res.json(await view(content, await accessFor(user, id)));
});

module.exports = router;
