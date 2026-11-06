const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('./rules');

test('phone formats normalize to the same 9 digits', () => {
    for (const p of ['0771234567', '+94 77 123 4567', '94771234567', '771234567', '0771234567_BIZ_2_BATCH_5_AS', '0094771234567']) {
        assert.equal(R.normPhone(p), '771234567', p);
    }
    assert.equal(R.normPhone('12345'), null);
    assert.equal(R.normPhone(null), null);
});

test('report: different people with the same LAST 7 digits are not matched any more', () => {
    assert.notEqual(R.normPhone('0771234567'), R.normPhone('0711234567'));
    assert.equal('0771234567'.slice(-7), '0711234567'.slice(-7), 'old rule matched these');
});

test('address field counts only when it really is a phone number', () => {
    assert.deepEqual(R.studentPhones({ phone: '0771234567', whatsapp: '94771234567', optionalPhone: null, addressHouseNo: '45/2' }), ['771234567']);
    assert.deepEqual(R.studentPhones({ phone: '0771234567', addressHouseNo: '0719999999' }), ['771234567', '719999999']);
});

const pay = (o) => ({ id: 1, batchId: 5, businessId: 2, status: 1, payment_type: 1, ...o });

test('approved / valid post-pay → ENROLLED; pending → PROCESSING; only rejected → NON_ENROLLED', () => {
    const now = new Date('2026-11-06');
    assert.equal(R.deriveLeadEnrollment({ batchId: 5 }, [pay({})], now).status, 'ENROLLED');
    assert.equal(R.deriveLeadEnrollment({ batchId: 5 }, [pay({ status: 4, valid_until: '2026-12-01' })], now).status, 'ENROLLED');
    assert.equal(R.deriveLeadEnrollment({ batchId: 5 }, [pay({ status: 4, valid_until: '2026-10-01' })], now).status, 'PAYMENT_PROCESSING');
    assert.equal(R.deriveLeadEnrollment({ batchId: 5 }, [pay({ status: 0 })], now).status, 'PAYMENT_PROCESSING');
    const rej = R.deriveLeadEnrollment({ batchId: 5 }, [pay({ status: 2 })], now);
    assert.deepEqual([rej.status, rej.evidence], ['NON_ENROLLED', true]);
});

test('payment for ANOTHER batch does not enroll this lead', () => {
    const d = R.deriveLeadEnrollment({ batchId: 9 }, [pay({ batchId: 5 })]);
    assert.deepEqual([d.status, d.evidence], ['NON_ENROLLED', false]);
});

test('lead without batch uses the business', () => {
    assert.equal(R.deriveLeadEnrollment({ batchId: null, businessId: 2 }, [pay({ batchId: 5 })]).status, 'ENROLLED');
    assert.equal(R.deriveLeadEnrollment({ batchId: null, businessId: 3 }, [pay({ batchId: 5 })]).evidence, false);
});

test('changes: fix with evidence, report enrolled-without-payment, never touch manual PAID', () => {
    const enrolled = { status: 'ENROLLED', intention: 'FULL', evidence: true, paymentId: 7 };
    assert.equal(R.leadChange({ enrollmentStatus: 'NON_ENROLLED' }, enrolled).kind, 'should-be-enrolled');
    assert.equal(R.leadChange({ enrollmentStatus: 'ENROLLED', paymentIntention: 'FULL' }, enrolled), null);
    assert.equal(R.leadChange({ enrollmentStatus: 'ENROLLED' }, { status: 'NON_ENROLLED', evidence: false }).kind, 'enrolled-without-payment');
    assert.equal(R.leadChange({ enrollmentStatus: 'NON_ENROLLED' }, { status: 'NON_ENROLLED', evidence: false }), null);
    assert.equal(R.leadChange({ enrollmentStatus: 'ENROLLED' }, { status: 'NON_ENROLLED', evidence: true }).kind, 'should-not-be-enrolled');
    assert.equal(R.leadChange({ enrollmentStatus: 'PAID' }, { status: 'NON_ENROLLED', evidence: true }), null);
});

test('business from batch or _BIZ_ suffix', () => {
    assert.equal(R.leadBusinessId({ batch: { businessId: 4 } }), 4);
    assert.equal(R.leadBusinessId({ phone: '0771234567_BIZ_3_BATCH_8' }), 3);
    assert.equal(R.leadBusinessId({ phone: '0771234567' }), null);
});
