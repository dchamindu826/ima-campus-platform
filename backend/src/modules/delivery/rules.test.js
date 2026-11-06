const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('./rules');

test('report: rejected/trashed payment with a delivery not yet shipped is an orphan', () => {
    assert.equal(R.orphanReason({ status: 'Pending' }, { status: 2 }), 'payment-rejected');
    assert.equal(R.orphanReason({ status: 'Hold' }, { status: 5 }), 'payment-trashed');
    assert.equal(R.orphanReason({ status: 'Packed' }, { status: 5 }), 'payment-trashed');
});

test('shipped / finished deliveries and valid payments are never orphans', () => {
    for (const s of ['On the way', 'Delivered', 'Received', 'Returned', 'Cancelled']) {
        assert.equal(R.orphanReason({ status: s }, { status: 2 }), null, s);
    }
    for (const ps of [0, 1, 4]) assert.equal(R.orphanReason({ status: 'Pending' }, { status: ps }), null);
});

test('free cards (amount 0) are not auto-delivered; normal approved payments are', () => {
    assert.equal(R.autoFixable({ status: 1, amount: 6500 }), true);
    assert.equal(R.autoFixable({ status: 1, amount: 0 }), false);
    assert.equal(R.autoFixable({ status: 0, amount: 6500 }), false);
});

test('rule: Discount and Free Card approvals are manual-only, never auto-delivered', () => {
    assert.equal(R.manualOnlyReason({ amount: 0, remark: '[Free Card Granted]\nReason: x' }), 'free-card');
    assert.equal(R.manualOnlyReason({ amount: 0, remark: null }), 'free-card');
    assert.equal(R.manualOnlyReason({ amount: 3000, remark: '[ADMIN]: Custom Breakdown: [ICT: LKR 3000]\nReason: sibling' }), 'discount');
    assert.equal(R.manualOnlyReason({ amount: 6500, remark: '[SYSTEM]: Wallet adjusted by LKR +500' }), null);
    assert.equal(R.autoFixable({ status: 1, amount: 3000, remark: 'Custom Breakdown: [ICT: LKR 3000]' }), false);
    assert.equal(R.autoFixable({ status: 1, amount: 6500, remark: '' }), true);
});
