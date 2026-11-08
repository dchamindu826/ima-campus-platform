const test = require('node:test');
const assert = require('node:assert/strict');
const { requirePayingStudent } = require('./auth');

const run = (user) => {
    const out = { next: false, status: 200 };
    const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
    const o = console.warn; console.warn = () => {};
    requirePayingStudent({ user, method: 'POST', url: '/enroll-with-slip' }, res, () => { out.next = true; });
    console.warn = o;
    return out;
};

test('report: coordinator ghost-login payment saved on the COORDINATOR account — staff token is refused', () => {
    assert.equal(run({ id: 54, role: 'Coordinator' }).status, 403);
    assert.equal(run({ id: 54, role: 'Coordinator' }).body.error, 'STAFF_ACCOUNT_CANNOT_PAY');
    assert.equal(run({ id: 1, role: 'SYSTEM_ADMIN' }).status, 403);
});

test('students (STUDENT / old USER) can still pay', () => {
    assert.equal(run({ id: 7, role: 'STUDENT' }).next, true);
    assert.equal(run({ id: 8, role: 'student' }).next, true);
    assert.equal(run({ id: 9, role: 'USER' }).next, true);
});
