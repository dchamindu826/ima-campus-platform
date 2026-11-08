// Authentication + role checks for the new modules.
//
// Every v2 route must use `authenticate` plus one of the role guards below.
// A route without a guard is a bug (see ARCHITECTURE.md, rule 4).

// Loaded on first use so pure modules (and tests) can use normRole/isStudent without a DB client.
const verifyToken = (req, res, next) => require('../../middlewares/authMiddleware')(req, res, next);

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR'];

const normRole = (role) => String(role || '').trim().toUpperCase().replace(/[\s-]+/g, '_');

const isAdmin = (user) => ADMIN_ROLES.includes(normRole(user?.role));
const isStudent = (user) => normRole(user?.role) === 'STUDENT';
// Staff = any logged-in non-student account (same meaning as the old requireStaff).
const isStaff = (user) => Boolean(user) && !isStudent(user);

const guard = (check, message) => (req, res, next) =>
    check(req.user) ? next() : res.status(403).json({ error: 'FORBIDDEN', message });

/**
 * Routes that create a payment / enrollment FOR THE LOGGED-IN ACCOUNT. A staff token must
 * never get here: during ghost login the coordinator's own token can come back into the
 * browser (another tab closes the ghost, a page refresh), and the payment was then saved on
 * the COORDINATOR's account instead of the student's. Students have role STUDENT (old ones USER).
 */
const PAYING_ROLES = ['STUDENT', 'USER', ''];
const requirePayingStudent = (req, res, next) => {
    const role = normRole(req.user && req.user.role);
    if (req.user && PAYING_ROLES.includes(role)) return next();
    console.warn(`[ghost-guard] blocked ${req.method} ${req.originalUrl || req.url} by staff user=${req.user && req.user.id} role=${role}`);
    return res.status(403).json({
        error: 'STAFF_ACCOUNT_CANNOT_PAY',
        message: 'This is a staff account, not the student. If you are in Ghost Login, close it and open Ghost Login for the student again, then pay.',
    });
};

module.exports = {
    authenticate: verifyToken,
    requirePayingStudent,
    requireStudent: guard(isStudent, 'Student account required'),
    requireStaff: guard(isStaff, 'Staff account required'),
    requireAdmin: guard(isAdmin, 'Administrator account required'),
    isAdmin,
    isStaff,
    isStudent,
    normRole,
};
