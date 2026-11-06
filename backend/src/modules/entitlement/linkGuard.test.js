const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const users = { 7: { id: 7, role: 'student' }, 9: { id: 9, role: 'Coordinator' } };
globalThis.__imaPrisma = { user: { findUnique: async ({ where }) => users[where.id] || null } };
delete require.cache[require.resolve('../../core/db')];
const service = require('./service');
service.canAccessContent = async (studentId) => (studentId === 7 ? { allowed: false, reason: 'not-enrolled-in-content-course' } : { allowed: true });
const { guardContentLink } = require('./guard');
const tok = (id) => jwt.sign({ userId: id }, process.env.JWT_SECRET);
const guard = guardContentLink((req) => req.query.id);
const run = async (req) => {
    const out = { status: 200, next: false };
    const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
    const o = console.warn; console.warn = () => {};
    try { await guard({ headers: {}, path: '/live-portal', ...req }, res, () => { out.next = true; }); } finally { console.warn = o; }
    return out;
};

test('report: live/zoom links opened without login — shadow logs, enforce blocks', async () => {
    delete process.env.ENTITLEMENT_ENFORCE;
    assert.equal((await run({ query: { id: '55' } })).next, true, 'shadow: allowed, logged');
    process.env.ENTITLEMENT_ENFORCE = 'true';
    assert.equal((await run({ query: { id: '55' } })).status, 401);
    assert.equal((await run({ query: { id: '55', token: tok(7) } })).status, 403, 'not enrolled');
    assert.equal((await run({ query: { id: '55', token: tok(9) } })).next, true, 'staff');
    delete process.env.ENTITLEMENT_ENFORCE;
});
