// Staff gate: one app-level check in front of every staff-only API.
//
// Problem it fixes: many old staff routes only checked "is there a valid token?",
// and some had no check at all. Anyone can register a student account, so in
// practice any student (or anyone) could read payments, CRM leads, staff lists,
// delivery records, and even approve payments or create/delete staff accounts.
//
// Rule: a request whose path starts with a STAFF prefix must carry a valid token
// of a NON-student account. Student web/app only uses the STUDENT prefixes below
// (checked against frontend/src/pages/student, pages/web and MobileApp/src).

const STAFF_PREFIXES = [
    '/api/admin',               // payments, staff, crm settings, delivery (admin), rotator admin, ...
    '/api/delivery',            // delivery dashboard (had NO auth at all)
    '/api/team',                // create / delete caller accounts (had NO auth)
    '/api/reminders',           // staff reminders (had NO auth)
    '/api/after-seminar-crm',
    '/api/coordinator-crm',
    '/api/call-center',
    '/api/missed-call-tasks',
    '/api/system-tasks',
    '/api/zoom-accounts',
    '/api/technical',
    '/api/notes',
    '/api/roster',
    '/api/physical-crm',
    '/api/physical-finance',
    '/api/physical-students',
    '/api/petty-cash',
    '/api/social-media',
    '/api/ai-verification',
    '/api/ai-team',
    '/api/claude',
    '/api/youtube-transcribe',
    '/api/mobile/staff',
    '/api/library/admin',
    '/api/public/voice-agent/recent-bookings',
    '/api/public/voice-agent/booking',
    // Staff tools that also exist under /api/student (the staff UI uses the /api/admin
    // versions). A student could reset ANY student's password, change ANY user's phone
    // number (= take over the account) and download every student's details.
    '/api/student/admin-update',
    '/api/student/admin-reset-password',
    '/api/student/admin-delete',
    '/api/student/ghost-login',
    '/api/student/data-center',
];

// Paths that must stay reachable by external services (Meta / WhatsApp webhooks).
const isExempt = (path) => /\/webhook\/?$/.test(path);

const matchesPrefix = (path, prefix) => path === prefix || path.startsWith(prefix + '/');

/** Pure: does this request path need a staff account? */
function isStaffPath(rawPath) {
    const path = String(rawPath || '').split('?')[0].replace(/\/+/g, '/').toLowerCase();
    if (isExempt(path)) return false;
    return STAFF_PREFIXES.some((p) => matchesPrefix(path, p));
}

/**
 * Express middleware. Mount BEFORE the old routes in server.js.
 * @param {Function} [authenticate] token verifier (defaults to the real one)
 */
function staffGate(authenticate) {
    return (req, res, next) => {
        if (req.method === 'OPTIONS' || !isStaffPath(req.path || req.originalUrl)) return next();

        const verify = authenticate || require('../../middlewares/authMiddleware');
        verify(req, res, () => {
            const role = String(req.user?.role || '').trim().toUpperCase();
            if (role === 'STUDENT') {
                return res.status(403).json({ error: 'FORBIDDEN', message: 'Staff account required' });
            }
            next();
        });
    };
}

module.exports = { staffGate, isStaffPath, STAFF_PREFIXES };
