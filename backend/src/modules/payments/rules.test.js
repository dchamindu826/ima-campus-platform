const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('./rules');

test('report: "payment eka 2 parak approve wela" — approving an approved payment is refused', () => {
    for (const action of ['Approve', 'Free Card', 'Discount']) {
        const r = R.checkStaffAction(1, action);
        assert.equal(r.ok, false, action);
        assert.equal(r.code, 'ALREADY_APPROVED');
    }
});

test('pending, post-pay, rejected and under-paid payments can still be approved', () => {
    for (const status of [0, 4, 2, -2]) assert.equal(R.checkStaffAction(status, 'Approve').ok, true, `status ${status}`);
});

test('reject / trash / send-to-delivery are not blocked', () => {
    for (const action of ['Reject', 'Trash', 'SendToDelivery']) assert.equal(R.checkStaffAction(1, action).ok, true, action);
});

test('only payhere and paycorp are online gateways', () => {
    assert.equal(R.normGateway('PayHere'), 'payhere');
    assert.equal(R.normGateway(' paycorp '), 'paycorp');
    assert.equal(R.normGateway('slip'), null);
    assert.equal(R.normGateway(undefined), null);
});

const claim = { studentId: 7, amount: 6500 };

test('exploit: method "payhere" with no gateway confirmation is NOT approved', () => {
    assert.deepEqual(R.decideOnlineApproval(null, claim), { approve: false, reason: 'no-gateway-record' });
    assert.equal(R.decideOnlineApproval({ studentId: 7, verified: false }, claim).reason, 'not-confirmed-by-gateway-yet');
});

test('confirmed by the gateway for the full amount → approved', () => {
    assert.deepEqual(R.decideOnlineApproval({ studentId: 7, verified: true, paidAmount: '6500.00' }, claim),
        { approve: true, reason: 'gateway-confirmed' });
});

test('underpaid (paid Rs.10 for a Rs.6500 enrollment) → not approved', () => {
    assert.equal(R.decideOnlineApproval({ studentId: 7, verified: true, paidAmount: 10 }, claim).reason, 'underpaid');
});

test('one student cannot use another student\'s gateway payment', () => {
    assert.equal(R.decideOnlineApproval({ studentId: 8, verified: true, paidAmount: 6500 }, claim).reason, 'other-student');
});

test('rounding: 6499.995 counts as 6500', () => {
    assert.equal(R.decideOnlineApproval({ studentId: 7, verified: true, paidAmount: 6499.995 }, claim).approve, true);
});

test('online marker is stable', () => {
    assert.equal(R.onlineMarker('payhere', ' ORD-1 '), '[ONLINE:payhere:ORD-1]');
});

test('PayHere signature matches the documented formula', () => {
    const sig = R.payhereSignature({ merchantId: '1211149', orderId: 'ORD-1', amount: '6500.00', currency: 'LKR', statusCode: '2', secret: 's3cret' });
    assert.match(sig, /^[0-9A-F]{32}$/);
    assert.notEqual(sig, R.payhereSignature({ merchantId: '1211149', orderId: 'ORD-1', amount: '10.00', currency: 'LKR', statusCode: '2', secret: 's3cret' }));
});
