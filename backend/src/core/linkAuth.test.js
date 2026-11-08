const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const users = { 7: { id: 7, role: 'student', session_id: 's-new' }, 9: { id: 9, role: 'Coordinator' } };
globalThis.__imaPrisma = { user: { findUnique: async ({ where }) => users[where.id] || null } };
delete require.cache[require.resolve('./db')];
const { tokenOf, readUser, requireStaffLink } = require('./linkAuth');
const tok = (id) => jwt.sign({ userId: id }, process.env.JWT_SECRET);
const run = async (mw, req) => {
    const out = { status: 200, next: false };
    const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
    await mw(req, res, () => { out.next = true; });
    return out;
};

test('token from header or ?token=', () => {
    assert.equal(tokenOf({ headers: { authorization: 'Bearer abc' }, query: {} }), 'abc');
    assert.equal(tokenOf({ headers: {}, query: { token: 'xyz' } }), 'xyz');
    assert.equal(tokenOf({ headers: {}, query: {} }), null);
});

test('readUser: bad / missing token → null, never throws', async () => {
    assert.equal(await readUser({ headers: {}, query: { token: 'garbage' } }), null);
    assert.equal((await readUser({ headers: {}, query: { token: tok(7) } })).id, 7);
});

test('report: call recordings were public — now staff token required', async () => {
    assert.equal((await run(requireStaffLink, { headers: {}, query: {} })).status, 401);
    assert.equal((await run(requireStaffLink, { headers: {}, query: { token: tok(7) } })).status, 403, 'student');
    assert.equal((await run(requireStaffLink, { headers: {}, query: { token: tok(9) } })).next, true, 'staff');
});

test('student token from an older login (other device) no longer opens links', async () => {
    const t = (sessionId) => jwt.sign({ userId: 7, sessionId }, process.env.JWT_SECRET);
    assert.equal(await readUser({ headers: {}, query: { token: t('s-old') } }), null);
    assert.equal((await readUser({ headers: {}, query: { token: t('s-new') } })).id, 7);
});
