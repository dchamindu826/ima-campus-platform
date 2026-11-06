// Payment service tests against an in-memory database (no MySQL needed).

const test = require('node:test');
const assert = require('node:assert/strict');
const { createFakeDb } = require('./testing/fakeDb');

let db;
let service;
test.beforeEach(() => {
    db = createFakeDb();
    globalThis.__imaPrisma = db; // src/core/db.js returns this client
    delete require.cache[require.resolve('../../core/db')];
    delete require.cache[require.resolve('./service')];
    service = require('./service');
});
test.after(() => { delete globalThis.__imaPrisma; });

test('report: "payhere" enrollment without gateway confirmation stays unapproved', async () => {
    await service.recordGatewayStart('payhere', 'ORD-1', { studentId: 7, amount: 6500 });
    const r = await service.claimOnlinePayment('payhere', 'ORD-1', { studentId: 7, amount: 6500 });
    assert.equal(r.approve, false);
    assert.equal(r.reason, 'not-confirmed-by-gateway-yet');
});

test('a made-up order id (no payment page ever opened) is not approved', async () => {
    const r = await service.claimOnlinePayment('payhere', 'ORD-FAKE', { studentId: 7, amount: 6500 });
    assert.equal(r.reason, 'no-gateway-record');
});

test('confirmed by PayHere notify → approved once; the same order cannot approve a second enrollment', async () => {
    await service.recordGatewayStart('payhere', 'ORD-2', { studentId: 7, amount: 6500 });
    await service.recordGatewayConfirmed('payhere', 'ORD-2', { paidAmount: '6500.00' });
    assert.equal((await service.claimOnlinePayment('payhere', 'ORD-2', { studentId: 7, amount: 6500 })).approve, true);
    const again = await service.claimOnlinePayment('payhere', 'ORD-2', { studentId: 7, amount: 6500 });
    assert.equal(again.approve, false);
    assert.equal(again.reason, 'gateway-payment-already-used');
});

test('report: "salli kapila, web eka ok wenne na" — notify arriving AFTER enrollment approves the pending payment', async () => {
    await service.recordGatewayStart('payhere', 'ORD-3', { studentId: 7, amount: 6500 });
    // enrollment came first → saved as pending with the marker
    await db.payment.create({ data: { studentId: 7, amount: 6500, status: 0, payment_type: 1, remark: '[ONLINE:payhere:ORD-3] Waiting' } });
    await service.recordGatewayConfirmed('payhere', 'ORD-3', { paidAmount: '6500.00' });

    const seen = [];
    const n = await service.approvePendingForOrder('payhere', 'ORD-3', async (p) => seen.push(p.id));
    assert.equal(n, 1);
    assert.equal(db.payment.rows[0].status, 1);
    assert.deepEqual(seen, [db.payment.rows[0].id], 'delivery/CRM side effects ran once');

    // PayHere retries the notify → nothing happens twice
    assert.equal(await service.approvePendingForOrder('payhere', 'ORD-3', async () => seen.push('again')), 0);
    assert.equal(seen.length, 1);
});

test('upgrade flow: several pending payments for one order are approved together only if the total was paid', async () => {
    await service.recordGatewayStart('payhere', 'ORD-4', { studentId: 7, amount: 9000 });
    await db.payment.create({ data: { studentId: 7, amount: 6000, status: 0, remark: '[ONLINE:payhere:ORD-4]' } });
    await db.payment.create({ data: { studentId: 7, amount: 3000, status: 0, remark: '[ONLINE:payhere:ORD-4]' } });
    await service.recordGatewayConfirmed('payhere', 'ORD-4', { paidAmount: '5000.00' });
    assert.equal(await service.approvePendingForOrder('payhere', 'ORD-4', async () => {}), 0, 'underpaid');
    assert.deepEqual(db.payment.rows.map((p) => p.status), [0, 0]);

    await service.recordGatewayConfirmed('payhere', 'ORD-4', { paidAmount: '9000.00' });
    assert.equal(await service.approvePendingForOrder('payhere', 'ORD-4', async () => {}), 2);
});

test('report: double click / two staff approving — only the first status change wins', async () => {
    const p = await db.payment.create({ data: { studentId: 7, amount: 6500, status: 0 } });
    const first = await service.changeStatusIfUnchanged(db, p.id, 0, { status: 1 });
    const second = await service.changeStatusIfUnchanged(db, p.id, 0, { status: 1 });
    assert.equal(first, true);
    assert.equal(second, false);
});
