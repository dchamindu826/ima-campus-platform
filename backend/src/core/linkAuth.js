// Auth for links a browser / <audio> tag / app WebView opens directly, where no
// Authorization header can be sent. The token may come from the header OR ?token=.
//
//   readUser(req)          → { id, role } or null (never throws)
//   requireStaffLink       → middleware: staff token required (401/403 otherwise)

const jwt = require('jsonwebtoken');
const { isStudent } = require('./auth');

const db = () => require('./db');

function tokenOf(req) {
    const h = req.headers && req.headers.authorization;
    if (h && /^Bearer\s+/i.test(h)) return h.replace(/^Bearer\s+/i, '').trim();
    const q = req.query && req.query.token;
    return typeof q === 'string' && q.trim() ? q.trim() : null;
}

/** The logged-in user for this request, or null. Uses the role stored in the DB. */
async function readUser(req) {
    if (req.user && req.user.id) return req.user;
    const token = tokenOf(req);
    if (!token || !process.env.JWT_SECRET) return null;
    try {
        const v = jwt.verify(token, process.env.JWT_SECRET);
        const id = parseInt(v.userId || v.id, 10);
        if (!id) return null;
        const u = await db().user.findUnique({ where: { id }, select: { id: true, role: true } });
        if (!u) return null;
        req.user = { ...v, id: u.id, userId: u.id, role: u.role };
        return req.user;
    } catch (e) {
        return null;
    }
}

/** Staff-only file links (call recordings). */
async function requireStaffLink(req, res, next) {
    const user = await readUser(req);
    if (!user) return res.status(401).json({ error: 'LOGIN_REQUIRED' });
    if (isStudent(user)) return res.status(403).json({ error: 'FORBIDDEN', message: 'Staff account required' });
    return next();
}

module.exports = { tokenOf, readUser, requireStaffLink };
