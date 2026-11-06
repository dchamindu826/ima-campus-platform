const test = require('node:test');
const assert = require('node:assert/strict');
const { createFakeDb } = require('./testing/fakeDb');
const { checkEnrollmentPrice } = require('./priceCheck');

function seed() {
    const db = createFakeDb();
    const t = (rows) => ({ ...createFakeDb().payment, rows, findMany: async ({ where }) => rows.filter((r) => (where.id ? where.id.in.includes(r.id) : r.batchId === where.batchId)), findUnique: async ({ where }) => rows.find((r) => r.id === where.id) || null });
    db.course = t([
        { id: 1, name: 'ICT', price: 3000, groupPrices: null, isDiscountExcluded: false },
        { id: 2, name: 'ET', price: 3000, groupPrices: JSON.stringify([{ groupId: 102, price: 2500 }]), isDiscountExcluded: false },
    ]);
    db.group = t([{ id: 102, discount_rules: JSON.stringify([{ courseCount: 2, fixedDiscount: 500 }]) }]);
    db.user = t([{ id: 7, walletBalance: 0 }, { id: 8, walletBalance: 1000 }]);
    db.installment = t([{ batchId: 10, subjectCount: 2, details: JSON.stringify([{ amount: 4000 }, { amount: 4000 }]) }]);
    return db;
}
const quiet = async (fn) => { const o = [console.log, console.warn]; console.log = console.warn = () => {}; try { return await fn(); } finally { [console.log, console.warn] = o; } };
const body = (o) => ({ groupId: '102', batchId: '10', subjects: '[1,2]', paymentMethodChosen: 'monthly', ...o });

test('correct amount (groupPrices + discount) is ok', async () => {
    const r = await quiet(() => checkEnrollmentPrice({ studentId: 7, body: body({ amount: '5000.00' }) }, seed()));
    assert.deepEqual([r.supported, r.ok, r.expected], [true, true, 5000]);
});

test('exploit: claiming Rs.10 is flagged underpriced', async () => {
    const r = await quiet(() => checkEnrollmentPrice({ studentId: 7, body: body({ amount: '10' }) }, seed()));
    assert.deepEqual([r.supported, r.ok, r.expected], [true, false, 5000]);
});

test('wallet credit is taken into account', async () => {
    const r = await quiet(() => checkEnrollmentPrice({ studentId: 8, body: body({ amount: '4000' }) }, seed()));
    assert.equal(r.ok, true);
    assert.equal(r.expected, 4000);
});

test('installment uses the first phase', async () => {
    const r = await quiet(() => checkEnrollmentPrice({ studentId: 7, body: body({ paymentMethodChosen: 'installment', amount: '4000' }) }, seed()));
    assert.deepEqual([r.ok, r.expected], [true, 4000]);
});

test('upgrade flows are skipped, not guessed', async () => {
    const a = await quiet(() => checkEnrollmentPrice({ studentId: 7, body: body({ amount: '1', upgrades: '[]' }) }, seed()));
    const b = await quiet(() => checkEnrollmentPrice({ studentId: 7, body: body({ amount: '1', remark: '[UPGRADE]: Transitioned' }) }, seed()));
    assert.deepEqual([a.supported, a.ok, b.supported, b.ok], [false, true, false, true]);
});

test('unknown course id or a crash never blocks enrollment', async () => {
    const r = await quiet(() => checkEnrollmentPrice({ studentId: 7, body: body({ subjects: '[1,999]', amount: '1' }) }, seed()));
    assert.deepEqual([r.supported, r.ok], [false, true]);
    const down = async () => { throw new Error('db down'); };
    const broken = { course: { findMany: down }, group: { findUnique: down }, user: { findUnique: down }, installment: { findMany: down } };
    const o = console.error; console.error = () => {};
    const r2 = await checkEnrollmentPrice({ studentId: 7, body: body({ amount: '1' }) }, broken);
    console.error = o;
    assert.deepEqual([r2.supported, r2.ok], [false, true]);
});
