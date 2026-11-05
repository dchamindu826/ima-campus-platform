// In-memory sliding window rate limiter
const createRateLimiter = ({ windowMs = 15 * 60 * 1000, max = 20, message = "Too many requests. Please try again later." }) => {
    const requests = new Map();

    // Periodic cleanup of stale records every 5 minutes
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, record] of requests.entries()) {
            if (now - record.startTime > windowMs) {
                requests.delete(key);
            }
        }
    }, 5 * 60 * 1000);
    
    // Ensure timer doesn't prevent Node process from exiting
    if (cleanupInterval.unref) {
        cleanupInterval.unref();
    }

    return (req, res, next) => {
        const clientIp = (req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || req.ip || 'unknown').trim();
        const now = Date.now();
        const record = requests.get(clientIp);

        if (!record || (now - record.startTime > windowMs)) {
            requests.set(clientIp, { count: 1, startTime: now });
            return next();
        }

        if (record.count >= max) {
            const retryAfterSec = Math.ceil((record.startTime + windowMs - now) / 1000);
            res.setHeader('Retry-After', retryAfterSec);
            return res.status(429).json({ 
                error: message,
                retryAfter: retryAfterSec 
            });
        }

        record.count += 1;
        next();
    };
};

const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 mins
    max: 20, // 20 login attempts per 15 minutes
    message: "Too many login attempts from this IP. Please wait 15 minutes before trying again."
});

const registerLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 15, // 15 registrations per hour
    message: "Too many registration attempts. Please wait an hour before trying again."
});

module.exports = {
    createRateLimiter,
    loginLimiter,
    registerLimiter
};
