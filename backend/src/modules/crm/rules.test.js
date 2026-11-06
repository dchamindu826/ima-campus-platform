const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('./rules');

const SL = (s) => new Date(`${s}+05:30`); // Sri Lanka time

test('rule 2: same 9 digits match, last-7 look-alikes do not, only phone + WhatsApp', () => {
    for (const p of ['0771234567', '+94 77 123 4567', '94771234567', '0771234567_BIZ_2_BATCH_5_AS']) assert.equal(R.normPhone(p), '771234567');
    assert.notEqual(R.normPhone('0771234567'), R.normPhone('0711234567'));
    assert.deepEqual(R.studentPhones({ phone: '0771234567', whatsapp: '0712222222', optionalPhone: '0759999999', addressHouseNo: '0719999999' }), ['771234567', '712222222']);
});

test('rule 3: active month switches on the LAST DAY of the month (Sri Lanka time)', () => {
    const oct = 2026 * 12 + 9;
    assert.equal(R.activeMonth(SL('2026-10-29T12:00:00')), oct);
    assert.equal(R.activeMonth(SL('2026-10-30T23:00:00')), oct, '30 Oct still October');
    assert.equal(R.activeMonth(SL('2026-10-31T00:30:00')), oct + 1, '31 Oct = November');
    assert.equal(R.activeMonth(SL('2026-11-30T10:00:00')), oct + 2, '30 Nov (last day) = December');
});

test('subject names compare across month groups', () => {
    assert.equal(R.subjectKey('ICT - November 2026'), R.subjectKey('ICT October'));
    assert.equal(R.subjectKey('ICT (නොවැම්බර්)'), 'ict');
    assert.equal(R.subjectKey('Mayan ICT'), 'mayan ict', '"may" inside a word stays');
});

const groupNames = new Map([[1, 'APRIL MONTH'], [2, 'MAY MONTH'], [3, 'JUNE MONTH'], [9, '2027 FULL PAYMENT'], [8, 'INSTALLMENT']]);
const courseNames = new Map([[11, 'ICT'], [12, 'ET'], [13, 'SFT'], [21, 'ICT'], [22, 'ET'], [23, 'SFT'], [31, 'ICT'], [32, 'ET']]);
const baseMonthByBatch = new Map([[5, 2026 * 12 + 3]]); // April intake
const ctx = { groupNames, courseNames, baseMonthByBatch };
const pay = (o) => ({ id: Math.random(), batchId: 5, status: 1, payment_type: 1, ...o });
const derive = (pays, when, extra = {}) => R.deriveLeadEnrollment({ batchId: 5 }, pays, SL(when), { ...ctx, ...extra });
const april = pay({ groupId: 1, subjects: '[11,12,13]', created_at: SL('2026-04-03T10:00:00') });

test('rule 6 (owner example): April A,B,C → May A,B → NON-PAID for C', () => {
    const may = pay({ groupId: 2, subjects: '[21,22]', created_at: SL('2026-05-02T10:00:00') });
    const r = derive([april, may], '2026-05-10T10:00:00');
    assert.deepEqual([r.status, r.dropped], ['NON_PAID', ['sft']]);
});

test('rule 6 (owner example): May A,B → June A,B → ENROLLED (compared with last month only)', () => {
    const may = pay({ groupId: 2, subjects: '[21,22]', created_at: SL('2026-05-02T10:00:00') });
    const june = pay({ groupId: 3, subjects: '[31,32]', created_at: SL('2026-06-02T10:00:00') });
    assert.equal(derive([april, may, june], '2026-06-10T10:00:00').status, 'ENROLLED');
});

test('rule 6: paid May, nothing for June yet → NON-PAID', () => {
    const may = pay({ groupId: 2, subjects: '[21,22]', created_at: SL('2026-05-02T10:00:00') });
    const r = derive([april, may], '2026-06-05T10:00:00');
    assert.deepEqual([r.status, r.reason], ['NON_PAID', 'not-paid-this-month']);
});

test('rule 6: base month of the intake — any payment is ENROLLED, never non-paid', () => {
    assert.equal(derive([april], '2026-04-20T10:00:00').status, 'ENROLLED');
    assert.equal(derive([pay({ groupId: 1, subjects: '[11]', status: 0, created_at: SL('2026-04-03T10:00:00') })], '2026-04-20T10:00:00').status, 'PAYMENT_PROCESSING');
});

test('rule 3: advance payment — paying May in April counts for May', () => {
    const mayEarly = pay({ groupId: 2, subjects: '[21,22,23]', created_at: SL('2026-04-25T10:00:00') });
    assert.equal(derive([april, mayEarly], '2026-05-03T10:00:00').status, 'ENROLLED');
    assert.equal(derive([april, mayEarly], '2026-04-30T10:00:00').status, 'ENROLLED', 'on the last day of April');
});

test('pending payment for the missing subject → PAYMENT_PROCESSING', () => {
    const may = pay({ groupId: 2, subjects: '[21,22,23]', status: 0, created_at: SL('2026-05-02T10:00:00') });
    assert.equal(derive([april, may], '2026-05-10T10:00:00').status, 'PAYMENT_PROCESSING');
});

test('rule 4 and 5: full = whole intake; installment = until overdue', () => {
    assert.deepEqual(Object.values((({ status, intention }) => ({ status, intention }))(derive([pay({ groupId: 9, payment_type: 1, created_at: SL('2026-04-01T10:00:00') })], '2026-08-10T10:00:00'))), ['ENROLLED', 'FULL']);
    const inst = pay({ groupId: 8, payment_type: 2, created_at: SL('2026-04-01T10:00:00') });
    assert.equal(derive([inst], '2026-05-10T10:00:00').status, 'ENROLLED');
    const od = derive([inst], '2026-07-10T10:00:00', { overdueBatchIds: new Set([5]) });
    assert.deepEqual([od.status, od.reason], ['NON_PAID', 'installment-overdue']);
});

test('rule 1: payment of ANOTHER intake does not count; never paid → NON_ENROLLED', () => {
    assert.equal(R.deriveLeadEnrollment({ batchId: 9 }, [april], SL('2026-05-10T10:00:00'), ctx).evidence, false);
    const rej = derive([pay({ groupId: 1, status: 2, created_at: SL('2026-04-03T10:00:00') })], '2026-05-10T10:00:00');
    assert.equal(rej.status, 'NON_ENROLLED');
});

test('report kinds; old "PAID" counts as ENROLLED; NON_PAID equals NON_ENROLLED in the DB', () => {
    assert.equal(R.leadChange({ enrollmentStatus: 'PAID', paymentIntention: 'MONTHLY' }, { status: 'ENROLLED', intention: 'MONTHLY', evidence: true }), null);
    assert.equal(R.leadChange({ enrollmentStatus: 'NON_ENROLLED' }, { status: 'NON_PAID', evidence: true, reason: 'dropped-subject' }), null);
    assert.equal(R.leadChange({ enrollmentStatus: 'ENROLLED' }, { status: 'NON_PAID', evidence: true, reason: 'dropped-subject', dropped: ['sft'] }).kind, 'should-be-non-paid-dropped-subject');
    assert.equal(R.leadChange({ enrollmentStatus: 'NON_ENROLLED' }, { status: 'ENROLLED', intention: 'MONTHLY', evidence: true }).kind, 'should-be-enrolled');
    assert.equal(R.leadChange({ enrollmentStatus: 'ENROLLED' }, { status: 'NON_ENROLLED', evidence: false }).kind, 'enrolled-without-payment');
});

test('intake months walk forward across the year end', () => {
    const at = SL('2026-09-01T00:00:00');
    const gs = ['SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER', 'JANUARY', 'FEBRUARY'].map((n, i) => ({ id: i + 1, itemOrder: i + 1, name: `${n} MONTH`, createdAt: at }))
        .concat([{ id: 99, itemOrder: 0, name: 'FULL PAYMENT', createdAt: at }]);
    assert.deepEqual(R.intakeMonths(gs), { base: 2026 * 12 + 8, last: 2027 * 12 + 1 });
});

test('finished intake: no non-paid after its last month', () => {
    const intakeByBatch = new Map([[5, { base: 2026 * 12 + 3, last: 2026 * 12 + 5 }]]); // April–June
    const may = pay({ groupId: 2, subjects: '[21,22]', created_at: SL('2026-05-02T10:00:00') });
    const r = R.deriveLeadEnrollment({ batchId: 5 }, [april, may], SL('2026-08-10T10:00:00'), { ...ctx, intakeByBatch });
    assert.deepEqual([r.reason, r.evidence], ['intake-ended', false]);
});

test('Sinhala subject names stay readable', () => {
    assert.equal(R.subjectKey('Accounting (ගිණුම්කරණය) - October'), 'accounting ගිණුම්කරණය');
});
