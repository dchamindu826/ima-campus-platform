const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');

const auditMiddleware = (req, res, next) => {
    // Skip read-only requests (GET, OPTIONS, HEAD) to save database space and avoid bottlenecking the database
    if (['GET', 'OPTIONS', 'HEAD'].includes(req.method)) {
        return next();
    }

    // Skip routes that shouldn't be logged like login, generic metrics, or high-frequency polling endpoints
    const skippedRoutes = [
        '/login', '/auth', '/metrics', 
        '/admin/overview', '/admin/logs', '/admin/settings/maintenance-mode'
    ];
    if (skippedRoutes.some(route => req.originalUrl.includes(route))) {
        return next();
    }

    // Capture the request start time and payload
    // We clone the body so we can sanitize it
    let sanitizedPayload = null;
    if (req.body && typeof req.body === 'object') {
        sanitizedPayload = { ...req.body };
        // Remove sensitive fields
        const sensitiveKeys = ['password', 'token', 'refreshToken', 'secret'];
        sensitiveKeys.forEach(key => {
            if (sanitizedPayload[key]) {
                sanitizedPayload[key] = '[REDACTED]';
            }
        });
    }

    // Listen to the finish event so we have req.user from auth middleware
    res.on('finish', async () => {
        try {
            const userId = req.user?.userId || req.user?.id || req.query?.loggedUserId || null;
            const role = req.user?.role || req.query?.loggedUserRole || null;

            // Extract IP Address
            const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

            // Prepare the payload JSON string
            const payloadData = sanitizedPayload ? sanitizedPayload : null;

            await prisma.systemAuditLog.create({
                data: {
                    userId: userId ? parseInt(userId) : null,
                    role: role ? String(role) : null,
                    method: req.method,
                    endpoint: req.originalUrl || req.url,
                    payload: payloadData,
                    ipAddress: ipAddress ? String(ipAddress).split(',')[0] : null,
                    statusCode: res.statusCode
                }
            });
        } catch (error) {
            // Do not break the app if logging fails, but print to console
            console.error('Failed to write audit log:', error);
        }
    });

    next();
};

module.exports = auditMiddleware;
