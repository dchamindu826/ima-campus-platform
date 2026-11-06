const test = require('node:test');
const assert = require('node:assert/strict');
const { isStaffPath, staffGate } = require('./staffGate');

// Every API the student web pages and the mobile app call (collected from
// frontend/src/pages/student, pages/web and MobileApp/src). None may be gated.
const STUDENT_PATHS = [
    '/api/auth/login', '/api/auth/register',
    '/api/student/classroom', '/api/student/dashboard', '/api/student/module/12',
    '/api/student/enroll-with-slip', '/api/student/my-payments', '/api/student/payhere-hash',
    '/api/student/payhere-notify', '/api/student/paycorp-init', '/api/student/deliveries/confirm',
    '/api/mobile/classroom', '/api/mobile/classroom/lives', '/api/mobile/module/12',
    '/api/mobile/businesses', '/api/mobile/my-payments', '/api/mobile/download-rec/5',
    '/api/mobile/chat/history/3', '/api/mobile/verify-student', '/api/mobile/live-portal',
    '/api/papers/9/start', '/api/papers/9/submit', '/api/papers/student/progress',
    '/api/web-inquiry/start', '/api/web-inquiry/my-inquiries',
    '/api/upgrade-pricing/calculate', '/api/library/resources', '/api/library/categories',
    '/api/public/landing-data', '/api/public/voice-agent/chat', '/api/v2/entitlements/me/courses',
    '/join/default', '/api/join',
];

const STAFF_PATHS = [
    '/api/admin/payments/action', '/api/admin/payments', '/api/admin/staff',
    '/api/admin/whatsapp-rotator', '/api/admin/whatsapp-rotator/3',
    '/api/delivery/manual-confirm/5', '/api/delivery/stock/delete/2',
    '/api/team', '/api/team/44', '/api/reminders/my-reminders',
    '/api/after-seminar-crm/leads/master-directory', '/api/coordinator-crm/quick-replies',
    '/api/petty-cash/requests', '/api/mobile/staff/overview', '/api/library/admin/structure',
    '/api/public/voice-agent/recent-bookings', '/api/public/voice-agent/booking/7',
    '/api/student/admin-reset-password', '/api/student/admin-update', '/api/student/data-center',
    '/api/student/ghost-login', '/api/student/admin-delete',
];

test('student web/app paths are never gated', () => {
    for (const p of STUDENT_PATHS) assert.equal(isStaffPath(p), false, p);
});

test('staff paths are gated (including the ones that had no auth at all)', () => {
    for (const p of STAFF_PATHS) assert.equal(isStaffPath(p), true, p);
});

test('webhooks stay public for Meta/WhatsApp', () => {
    assert.equal(isStaffPath('/api/coordinator-crm/webhook'), false);
    assert.equal(isStaffPath('/api/after-seminar-crm/webhook'), false);
});

test('prefix must match a whole segment, and query/case/double slashes do not bypass', () => {
    assert.equal(isStaffPath('/api/teamwork'), false);
    assert.equal(isStaffPath('/api/administrator-public'), false);
    assert.equal(isStaffPath('/api/TEAM'), true);
    assert.equal(isStaffPath('/api//admin/payments'), true);
    assert.equal(isStaffPath('/api/team?x=1'), true);
});

// --- middleware behaviour with a fake authenticator ---
function run(path, user) {
    const fakeAuth = (req, res, next) => {
        if (!user) return res.status(401).json({});
        req.user = user;
        next();
    };
    return new Promise((resolve) => {
        const req = { method: 'GET', path };
        const res = { status(code) { resolve(code); return { json() {} }; } };
        staffGate(fakeAuth)(req, res, () => resolve('next'));
    });
}

test('gate: no token → 401, student → 403, staff → passes, student path → passes', async () => {
    assert.equal(await run('/api/team', null), 401);
    assert.equal(await run('/api/admin/payments/action', { role: 'Student' }), 403);
    assert.equal(await run('/api/admin/payments/action', { role: 'STUDENT' }), 403);
    assert.equal(await run('/api/admin/payments/action', { role: 'COORDINATOR' }), 'next');
    assert.equal(await run('/api/student/classroom', null), 'next');
});
