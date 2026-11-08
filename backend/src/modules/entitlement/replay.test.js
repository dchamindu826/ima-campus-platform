const test = require('node:test');
const assert = require('node:assert/strict');
const { parseLines, replay } = require('./replay');

test('replay parses shadow lines (dedup) and re-checks with the current rule', async () => {
    const text = [
        '0|ima-back | [entitlement:shadow] would deny student=1 course=10 reason=subject-or-month-not-paid',
        '0|ima-back | [entitlement:shadow] would deny student=1 course=10 reason=subject-or-month-not-paid',
        '0|ima-back | [entitlement:shadow] would deny student=2 course=11 reason=subject-or-month-not-paid',
        '0|ima-back | [entitlement:shadow] would deny student=3 content=99 reason=x',
        'noise',
    ].join('\n');
    const pairs = parseLines(text);
    assert.equal(pairs.length, 3);
    const svc = {
        explainCourseAccess: async (s) => (s === 1 ? { allowed: true, reason: 'monthly:same-subject-this-month' } : { allowed: false, reason: 'subject-or-month-not-paid' }),
        canAccessContent: async () => false,
    };
    const r = await replay(pairs, svc);
    assert.deepEqual([r.nowAllowed, r.stillDenied], [1, 2]);
    assert.deepEqual(r.byReason, { 'subject-or-month-not-paid': 1, 'content-denied': 1 });
});
