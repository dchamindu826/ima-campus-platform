const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: "Access Denied. No token provided." });
    }

    try {
        const secretKey = process.env.JWT_SECRET;
        if (!secretKey) {
            console.error("FATAL: JWT_SECRET environment variable is missing.");
            return res.status(500).json({ error: "Authentication configuration error." });
        }
        const verified = jwt.verify(token, secretKey);
        const userId = verified.userId || verified.id;

        if (!userId) {
            return res.status(401).json({ error: "Invalid token payload." });
        }

        const user = await prisma.user.findUnique({ 
            where: { id: parseInt(userId) },
            select: { id: true, session_id: true, role: true, department: true, businessType: true } 
        });

        if (!user) {
            return res.status(401).json({ error: "User account no longer exists." });
        }

        // Single session check: ONLY apply to actual Student accounts. Staff/Coordinators/Admins bypass session restrictions completely.
        const roleUpper = String(user.role || verified.role || '').trim().toUpperCase();
        const isExplicitStaff = [
            'ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'STAFF', 'COORDINATOR', 
            'CALLER', 'MANAGER', 'MANAGEMENT', 'TEACHER', 'INSTRUCTOR', 
            'TELECALLER', 'FINANCE', 'ASS MANAGER', 'SOCIAL MEDIA MANAGER', 'SOCIAL MEDIA STAFF',
            'LECTURE', 'LECTURER', 'PAPER_GUIDER', 'PAPER GUIDER', 'PAPER_MARKER', 'PAPER MARKER'
        ].includes(roleUpper) || Boolean(user.department) || Boolean(user.businessType);

        const isStudentAccount = !isExplicitStaff && roleUpper === 'STUDENT';

        if (isStudentAccount && verified.sessionId && user.session_id && user.session_id !== verified.sessionId) {
            return res.status(401).json({ error: "Logged in from another device. Please log in again." });
        }

        req.user = {
            ...verified,
            id: parseInt(userId),
            userId: parseInt(userId),
            role: user.role,
            department: user.department,
            businessType: user.businessType
        }; 
        next();
        
    } catch (error) {
        return res.status(401).json({ error: "Invalid or Expired Token." });
    }
};

const requireAdmin = (req, res, next) => {
    const roleUpper = String(req.user?.role || '').trim().toUpperCase();
    if (['SYSTEM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR'].includes(roleUpper)) {
        return next();
    }
    return res.status(403).json({ error: "Access denied. Administrator privileges required." });
};

const requireStaff = (req, res, next) => {
    const roleUpper = String(req.user?.role || '').trim().toUpperCase();
    const isStaff = [
        'ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'DIRECTOR', 'STAFF', 'COORDINATOR', 
        'CALLER', 'MANAGER', 'MANAGEMENT', 'TEACHER', 'INSTRUCTOR', 
        'TELECALLER', 'FINANCE', 'ASS MANAGER', 'SOCIAL MEDIA MANAGER', 'SOCIAL MEDIA STAFF',
        'LECTURE', 'LECTURER', 'PAPER_GUIDER', 'PAPER GUIDER', 'PAPER_MARKER', 'PAPER MARKER'
    ].includes(roleUpper) || Boolean(req.user?.department) || Boolean(req.user?.businessType);

    if (isStaff) {
        return next();
    }
    return res.status(403).json({ error: "Access denied. Staff privileges required." });
};

const requireAdminOrManager = (req, res, next) => {
    const roleUpper = String(req.user?.role || '').trim().toUpperCase().replace(/[\s-]/g, '_');
    const isAdmin = ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR'].includes(roleUpper);
    const isManager = ['MANAGER', 'ASS_MANAGER', 'HEAD_MANAGER', 'SOCIAL_MEDIA_MANAGER', 'TECH_MANAGER'].includes(roleUpper) || roleUpper.includes('MANAGER');

    if (isAdmin || isManager) {
        return next();
    }
    return res.status(403).json({ error: "Access denied. Administrator or Manager privileges required." });
};

const requireStudentDeleteAccess = (req, res, next) => {
    const roleUpper = String(req.user?.role || '').trim().toUpperCase().replace(/[\s-]/g, '_');
    const isAdmin = ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR'].includes(roleUpper);
    const isManager = ['MANAGER', 'ASS_MANAGER', 'HEAD_MANAGER', 'SOCIAL_MEDIA_MANAGER', 'TECH_MANAGER', 'SUPER'].includes(roleUpper) || roleUpper.includes('MANAGER');
    const isCoordinator = ['COORDINATOR', 'CLASS_COORDINATOR', 'CALLER'].includes(roleUpper) || roleUpper.includes('COORDINATOR');

    if (isAdmin || isManager || isCoordinator) {
        return next();
    }
    return res.status(403).json({ error: "Access denied. Administrator, Manager, or Coordinator privileges required." });
};

verifyToken.verifyToken = verifyToken;
verifyToken.requireAdmin = requireAdmin;
verifyToken.requireStaff = requireStaff;
verifyToken.requireAdminOrManager = requireAdminOrManager;
verifyToken.requireStudentDeleteAccess = requireStudentDeleteAccess;

module.exports = verifyToken;
module.exports.verifyToken = verifyToken;
module.exports.requireAdmin = requireAdmin;
module.exports.requireStaff = requireStaff;
module.exports.requireAdminOrManager = requireAdminOrManager;
module.exports.requireStudentDeleteAccess = requireStudentDeleteAccess;