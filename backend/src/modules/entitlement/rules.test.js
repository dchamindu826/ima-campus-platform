// Entitlement rule tests. Each case comes from a real report in the staff
// "Web & App Errors" group or from the old controller behaviour we must keep.
// Run: npm test

const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('./rules');

const NOW = new Date('2026-10-15T10:00:00+05:30');
const days = (n) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

// --- A small fake batch: 2027 July batch (id 10), theory (classType 1) ---
// Monthly groups per month + a full-payment group, with duplicate course rows like prod.
const G = { SEP: 101, OCT: 102, FULL: 103, PAPER_OCT: 104 };
const course = (id, name, groupId, extra = {}) => ({
    id, name, groupId, code: extra.code || null, courseType: extra.courseType || 1,
    group: { batchId: extra.batchId || 10, classType: extra.courseType || 1 },
});
const C = {
    ictSep: course(1, 'ICT', G.SEP),
    ictOct: course(2, 'ICT', G.OCT),
    etOct: course(3, 'ET', G.OCT),
    ictFull: course(4, 'ICT', G.FULL),
    etFull: course(5, 'ET', G.FULL),
    ictOctDup: course(6, 'ICT', G.OCT), // duplicate DB row for the same subject
    ictPaperOct: course(7, 'ICT', G.PAPER_OCT, { courseType: 2 }),
    ictOtherBatch: course(8, 'ICT', 201, { batchId: 20 }),
};
const byId = new Map(Object.values(C).map((c) => [c.id, c]));

const pay = (o) => ({
    id: o.id || 1, studentId: 1, batchId: 10, status: R.STATUS.APPROVED,
    payment_type: R.PAYMENT_TYPE.MONTHLY, subjects: null, valid_until: null,
    due_date: null, installment_no: 1, created_at: days(-40), updatedAt: days(-40), ...o,
});

const can = (courseObj, payments, overdue = new Set()) =>
    R.explainCourseAccess(courseObj, payments, byId, overdue, NOW);

test('report: "Sept witharak gewwa lamayata Oct live eka pennawa" — monthly never leaks to another month', () => {
    const p = [pay({ groupId: G.SEP, subjects: '[1]' })];
    assert.equal(can(C.ictSep, p).allowed, true);
    assert.equal(can(C.ictOct, p).allowed, false);
    assert.equal(can(C.ictOct, p).reason, 'subject-or-month-not-paid');
});

test('monthly payment only covers the paid subjects of that month', () => {
    const p = [pay({ groupId: G.OCT, subjects: '[2]' })];
    assert.equal(can(C.ictOct, p).allowed, true);
    assert.equal(can(C.etOct, p).allowed, false);
});

test('monthly payment covers duplicate DB rows of the same subject in the same month', () => {
    const p = [pay({ groupId: G.OCT, subjects: '[2]' })];
    assert.equal(can(C.ictOctDup, p).allowed, true);
});

test('report (shadow logs): October paid with a course row made in September still opens October', () => {
    // Payment for the OCTOBER group, but the subject id is the September ICT row (course re-used across months).
    const p = [pay({ groupId: G.OCT, subjects: '[1]' })];
    assert.equal(can(C.ictOct, p).allowed, true);
    assert.equal(can(C.ictOct, p).reason, 'monthly:same-subject-this-month');
    assert.equal(can(C.etOct, p).allowed, false, 'other subject still locked');
    assert.equal(can(C.ictSep, p).allowed, false, 'September content still needs a September payment');
    assert.equal(can(C.ictPaperOct, p).allowed, false, 'paper class not opened by theory payment');
    assert.equal(can(C.ictOtherBatch, p).allowed, false, 'other batch never');
});

test('report (pricing shadow): app adds OLD months ids — they do not open other subjects this month', () => {
    // October payment for ET only (course 3, own group OCT); the app also sent the September ICT row (1).
    const p = [pay({ groupId: G.OCT, subjects: '[3,1]' })];
    assert.equal(can(C.etOct, p).allowed, true);
    assert.equal(can(C.ictOct, p).allowed, false, 'September ICT id does not open October ICT');
});

test('report (replay): same re-used rows every month + one new row — amount decides, regular student not blocked', () => {
    const c = (id, name, groupId, price) => ({ ...course(id, name, groupId), price });
    const local = new Map([
        [31, c(31, 'Economics', G.SEP, 2500)], [32, c(32, 'Accounting', G.SEP, 2500)],
        [33, c(33, 'Business Studies', G.OCT, 2500)],
        [34, c(34, 'Economics', G.OCT, 2500)], [35, c(35, 'Accounting', G.OCT, 2500)],
    ]);
    const canL = (co, p) => R.explainCourseAccess(co, p, local, new Set(), NOW);
    // paid all three for October (7500): two re-used September rows + one October row
    assert.equal(canL(local.get(34), [pay({ groupId: G.OCT, subjects: '[31,32,33]', amount: 7500 })]).allowed, true);
    // paid only the October row (2500) — the app also sent the old rows → Economics stays locked
    assert.equal(canL(local.get(34), [pay({ groupId: G.OCT, subjects: '[31,32,33]', amount: 2500 })]).allowed, false);
    assert.equal(canL(local.get(33), [pay({ groupId: G.OCT, subjects: '[31,32,33]', amount: 2500 })]).allowed, true);
});

test('payment with no subject list covers the whole group only', () => {
    const p = [pay({ groupId: G.OCT, subjects: '[]' })];
    assert.equal(can(C.etOct, p).allowed, true);
    assert.equal(can(C.ictSep, p).allowed, false);
});

test('old data: subjects saved as names still work', () => {
    const p = [pay({ groupId: G.OCT, subjects: '["ICT"]' })];
    assert.equal(can(C.ictOct, p).allowed, true);
    assert.equal(can(C.etOct, p).allowed, false);
});

test('report: "full payment karala Access Locked" — full payment opens the subject across the batch', () => {
    const p = [pay({ groupId: G.FULL, payment_type: R.PAYMENT_TYPE.FULL, subjects: '[4]' })];
    assert.equal(can(C.ictFull, p).allowed, true);
    assert.equal(can(C.ictSep, p).allowed, true);
    assert.equal(can(C.ictOct, p).allowed, true);
    assert.equal(can(C.etOct, p).allowed, false, 'unpaid subject stays locked');
});

test('full payment does not cross class type (theory vs paper) or batch', () => {
    const p = [pay({ groupId: G.FULL, payment_type: R.PAYMENT_TYPE.FULL, subjects: '[4]' })];
    assert.equal(can(C.ictPaperOct, p).allowed, false);
    assert.equal(can(C.ictOtherBatch, p).allowed, false);
});

test('pending, rejected and trashed payments give no access', () => {
    for (const status of [R.STATUS.PENDING, R.STATUS.REJECTED, R.STATUS.TRASH, -2]) {
        const p = [pay({ groupId: G.OCT, subjects: '[2]', status })];
        assert.equal(can(C.ictOct, p).allowed, false, `status ${status}`);
    }
    const pending = [pay({ groupId: G.OCT, subjects: '[2]', status: R.STATUS.PENDING })];
    assert.equal(can(C.ictOct, pending).reason, 'payment-pending-approval');
});

test('post-pay gives access only until valid_until', () => {
    const active = [pay({ groupId: G.OCT, subjects: '[2]', status: R.STATUS.POST_PAY, valid_until: days(3) })];
    const expired = [pay({ groupId: G.OCT, subjects: '[2]', status: R.STATUS.POST_PAY, valid_until: days(-1) })];
    const noDate = [pay({ groupId: G.OCT, subjects: '[2]', status: R.STATUS.POST_PAY, valid_until: null })];
    assert.equal(can(C.ictOct, active).allowed, true);
    assert.equal(can(C.ictOct, expired).allowed, false);
    assert.equal(can(C.ictOct, expired).reason, 'post-pay-expired');
    assert.equal(can(C.ictOct, noDate).allowed, false);
});

test('overdue installment blocks access', () => {
    const inst = pay({ id: 1, groupId: G.FULL, payment_type: R.PAYMENT_TYPE.INSTALLMENT, subjects: '[4]' });
    const overdue = new Set([10]);
    assert.equal(can(C.ictFull, [inst], overdue).allowed, false);
    assert.equal(can(C.ictFull, [inst], overdue).reason, 'installment-overdue');
    assert.equal(can(C.ictFull, [inst]).allowed, true, 'not overdue = access');
});

test('overdue installment is ignored when the student also has an approved monthly payment', () => {
    const inst = pay({ id: 1, groupId: G.FULL, payment_type: R.PAYMENT_TYPE.INSTALLMENT, subjects: '[4]' });
    const monthly = pay({ id: 2, groupId: G.OCT, subjects: '[2]' });
    assert.equal(can(C.ictFull, [inst, monthly], new Set([10])).allowed, true);
});

test('student with no payment for the batch is told why', () => {
    assert.deepEqual(can(C.ictOct, []), { allowed: false, reason: 'no-payment-for-batch', paymentId: null });
});

test('accessibleCourseIds returns exactly the paid courses', () => {
    const p = [pay({ groupId: G.OCT, subjects: '[2]' })];
    const ids = R.accessibleCourseIds(Object.values(C), p, byId, new Set(), NOW);
    assert.deepEqual(ids.sort(), [2, 6]);
});

// --- Overdue calculation (ported from the old controller) ---
const plan = new Map([[10, [{ subjectCount: 1, details: JSON.stringify([{ gapDays: 30 }, { gapDays: 30 }, { gapDays: 30 }]) }]]]);

test('overdue: pending installment past due date', () => {
    const p = [pay({ payment_type: 2, status: R.STATUS.PENDING, installment_no: 2, due_date: days(-1), subjects: '[4]' })];
    assert.deepEqual([...R.computeOverdueBatchIds(p, plan, NOW)], [10]);
});

test('overdue: pending installment not yet due is fine', () => {
    const p = [
        pay({ id: 1, payment_type: 2, installment_no: 1, subjects: '[4]' }),
        pay({ id: 2, payment_type: 2, status: R.STATUS.PENDING, installment_no: 2, due_date: days(5), subjects: '[4]' }),
    ];
    assert.equal(R.computeOverdueBatchIds(p, plan, NOW).size, 0);
});

test('overdue: approved phase 1, no next phase record, gap days passed', () => {
    const p = [pay({ payment_type: 2, installment_no: 1, subjects: '[4]', updatedAt: days(-31) })];
    assert.deepEqual([...R.computeOverdueBatchIds(p, plan, NOW)], [10]);
    const fresh = [pay({ payment_type: 2, installment_no: 1, subjects: '[4]', updatedAt: days(-5) })];
    assert.equal(R.computeOverdueBatchIds(fresh, plan, NOW).size, 0);
});

test('overdue: last phase paid is never overdue', () => {
    const p = [pay({ payment_type: 2, installment_no: 3, subjects: '[4]', updatedAt: days(-90) })];
    assert.equal(R.computeOverdueBatchIds(p, plan, NOW).size, 0);
});

test('parseSubjects handles ids, names, bad JSON', () => {
    assert.deepEqual(R.parseSubjects('[1,"2","ICT"]'), { ids: [1, 2], strings: ['ict'] });
    assert.deepEqual(R.parseSubjects('not json'), { ids: [], strings: [] });
    assert.deepEqual(R.parseSubjects(null), { ids: [], strings: [] });
});
