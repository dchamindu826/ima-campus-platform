// Standard errors + Express helpers for the new modules.
//
// Throw an AppError from a service; the v2 router turns it into a clean JSON
// response. Unexpected errors become a 500 without leaking internals.

class AppError extends Error {
    /**
     * @param {number} status HTTP status code
     * @param {string} code   stable machine-readable code, e.g. "NOT_ENROLLED"
     * @param {string} message human-readable message
     */
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

const notFound = (msg = 'Not found') => new AppError(404, 'NOT_FOUND', msg);
const forbidden = (code = 'FORBIDDEN', msg = 'Access denied') => new AppError(403, code, msg);
const badRequest = (msg = 'Invalid request') => new AppError(400, 'BAD_REQUEST', msg);

/** Final error handler for v2 routes. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    if (err instanceof AppError) {
        return res.status(err.status).json({ error: err.code, message: err.message });
    }
    console.error(`[v2] ${req.method} ${req.originalUrl} failed:`, err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong' });
}

module.exports = { AppError, notFound, forbidden, badRequest, errorHandler };
