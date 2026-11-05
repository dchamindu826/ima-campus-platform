// Authentication + role checks for the new modules.
//
// Every v2 route must use `authenticate` plus one of the role guards below.
// A route without a guard is a bug (see ARCHITECTURE.md, rule 4).

const verifyToken = require('../../middlewares/authMiddleware');

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR'];

const normRole = (role) => String(role || '').trim().toUpperCase().replace(/[\s-]+/g, '_');

const isAdmin = (user) => ADMIN_ROLES.includes(normRole(user?.role));
const isStudent = (user) => normRole(user?.role) === 'STUDENT';
// Staff = any logged-in non-student account (same meaning as the old requireStaff).
const isStaff = (user) => Boolean(user) && !isStudent(user);

const guard = (check, message) => (req, res, next) =>
    check(req.user) ? next() : res.status(403).json({ error: 'FORBIDDEN', message });

module.exports = {
    authenticate: verifyToken,
    requireStudent: guard(isStudent, 'Student account required'),
    requireStaff: guard(isStaff, 'Staff account required'),
    requireAdmin: guard(isAdmin, 'Administrator account required'),
    isAdmin,
    isStaff,
    isStudent,
    normRole,
};
