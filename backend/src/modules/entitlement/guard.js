// Entitlement guards for OLD controllers (strangler step).
//
// Safe rollout: by default the guard runs in SHADOW mode — it never blocks, it only
// logs "[entitlement:shadow] would deny ..." lines. After checking those logs on
// production for a few days, set ENTITLEMENT_ENFORCE=true to start blocking.

const service = require('./service');
const { normRole } = require('../../core/auth');

const enforcing = () => String(process.env.ENTITLEMENT_ENFORCE || '').toLowerCase() === 'true';

const studentIdOf = (req) => req.user?.id || req.user?.userId;

/**
 * Decide whether to continue. Returns true if the request may proceed.
 * On deny in enforce mode, sends 403 itself.
 */
async function check(req, res, what, id, decide) {
    // Staff (coordinators previewing a class) are not limited by student payments.
    const role = normRole(req.user?.role);
    if (role && role !== 'STUDENT') return true;

    const studentId = studentIdOf(req);
    let result;
    try {
        result = await decide(studentId, id);
    } catch (err) {
        // A bug in the new check must never lock students out.
        console.error(`[entitlement] check failed for ${what} ${id}, allowing:`, err);
        return true;
    }
    if (result.allowed) return true;

    if (!enforcing()) {
        console.warn(`[entitlement:shadow] would deny student=${studentId} ${what}=${id} reason=${result.reason}`);
        return true;
    }
    res.status(403).json({
        error: 'NOT_ENROLLED',
        reason: result.reason,
        message: 'You do not have access to this class. Please contact your coordinator.',
    });
    return false;
}

/** Express middleware: guard a route by a course id param. */
const guardCourseParam = (param = 'id') => async (req, res, next) => {
    if (await check(req, res, 'course', req.params[param], service.explainCourseAccess)) next();
};

/** Express middleware: guard a route by a content id param. */
const guardContentParam = (param = 'contentId') => async (req, res, next) => {
    if (await check(req, res, 'content', req.params[param], service.canAccessContent)) next();
};

/**
 * Guard for content LINKS opened straight from a browser / WebView (live class
 * redirect, Zoom MP4 link). The token may be in the header or ?token=.
 * Shadow mode: requests without login are only logged; ENTITLEMENT_ENFORCE=true
 * makes them 401 and non-enrolled students 403.
 * @param {(req) => any} getId  where the content id is
 */
const guardContentLink = (getId) => async (req, res, next) => {
    const { readUser } = require('../../core/linkAuth');
    const id = getId(req);
    const user = await readUser(req);
    if (!user) {
        if (enforcing()) return res.status(401).json({ error: 'LOGIN_REQUIRED', message: 'Please log in to open this class.' });
        console.warn(`[entitlement:shadow] would deny no-login content=${id} path=${req.path}`);
        return next();
    }
    if (await check(req, res, 'content', id, service.canAccessContent)) next();
};

module.exports = { guardCourseParam, guardContentParam, guardContentLink, enforcing };
