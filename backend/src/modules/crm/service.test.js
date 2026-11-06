const test = require('node:test');
const assert = require('node:assert/strict');

const SL = (s) => new Date(`${s}+05:30`);
function fake() {
    const leads = [
        { id: 1, phone: '0771234567_BIZ_2_BATCH_5_AS', batchId: 5, campaignType: 'AFTER_SEMINAR', enrollmentStatus: 'ENROLLED', paymentIntention: 'MONTHLY', createdAt: SL('2026-04-01T00:00:00'), batch: { businessId: 2 } },
        { id: 2, phone: '0711234567', batchId: 5, campaignType: 'AFTER_SEMINAR', enrollmentStatus: 'ENROLLED', paymentIntention: 'MONTHLY', createdAt: SL('2026-04-01T00:00:00'), batch: { businessId: 2 } },
        { id: 3, phone: '0779999999', batchId: 5, campaignType: 'FREE_SEMINAR', enrollmentStatus: 'NON_ENROLLED', createdAt: SL('2026-03-01T00:00:00'), batch: { businessId: 2 } },
        { id: 4, phone: '0779999999_AS', batchId: 5, campaignType: 'AFTER_SEMINAR', enrollmentStatus: 'NON_ENROLLED', createdAt: SL('2026-04-01T00:00:00'), batch: { businessId: 2 } },
    ];
    const db = {
        lead: { findMany: async () => leads, updateMany: async ({ where, data }) => { const l = leads.find((x) => x.id === where.id); Object.assign(l, data); return { count: 1 }; } },
        user: { findMany: async () => [{ id: 70, phone: '0771234567' }, { id: 80, whatsapp: '94779999999' }] },
        group: { findMany: async () => [{ id: 1, name: 'APRIL MONTH', batchId: 5, createdAt: SL('2026-04-01T00:00:00') }, { id: 2, name: 'MAY MONTH', batchId: 5, createdAt: SL('2026-05-01T00:00:00') }] },
        course: { findMany: async () => [{ id: 11, name: 'ICT' }, { id: 12, name: 'ET' }, { id: 13, name: 'SFT' }, { id: 21, name: 'ICT' }, { id: 22, name: 'ET' }] },
        installment: { findMany: async () => [] },
        payment: { findMany: async () => [
            { id: 1, studentId: 70, batchId: 5, groupId: 1, status: 1, payment_type: 1, subjects: '[11,12,13]', created_at: SL('2026-04-03T10:00:00') },
            { id: 2, studentId: 70, batchId: 5, groupId: 2, status: 1, payment_type: 1, subjects: '[21,22]', created_at: SL('2026-05-02T10:00:00') },
            { id: 3, studentId: 80, batchId: 5, groupId: 2, status: 1, payment_type: 1, subjects: '[21]', created_at: SL('2026-05-02T10:00:00') },
        ] },
    };
    return { db, leads };
}
const load = (db) => {
    globalThis.__imaPrisma = db;
    delete require.cache[require.resolve('../../core/db')];
    delete require.cache[require.resolve('./service')];
    return require('./service');
};
test.after(() => { delete globalThis.__imaPrisma; });

test('report on the owner example (May, April intake)', async () => {
    const { db } = fake();
    const r = await load(db).enrollmentReport({ now: SL('2026-05-10T10:00:00') });
    const byLead = Object.fromEntries(r.changes.map((c) => [c.leadId, c]));
    assert.equal(byLead[1].kind, 'should-be-non-paid-dropped-subject', 'dropped SFT');
    assert.deepEqual(byLead[1].dropped, ['sft']);
    assert.equal(byLead[2].kind, 'enrolled-by-lookalike-number', '071 lead enrolled only because 077 paid');
    assert.equal(byLead[4].kind, 'should-be-enrolled', 'WhatsApp number matches; newest lead');
    assert.equal(byLead[3], undefined, 'older lead of the same person is secondary');
    assert.equal(r.secondaryLeads, 1);
    assert.deepEqual(r.droppedSubjects, { sft: 1 });
});

test('nothing is written without CRM_AUTOFIX; with it only upgrades', async () => {
    const { db, leads } = fake();
    const svc = load(db);
    delete process.env.CRM_AUTOFIX;
    const o = console.log; console.log = () => {};
    await svc.dailyReconcile();
    assert.deepEqual(leads.map((l) => l.enrollmentStatus), ['ENROLLED', 'ENROLLED', 'NON_ENROLLED', 'NON_ENROLLED']);
    console.log = o;
    const r = await svc.enrollmentReport({ now: SL('2026-05-10T10:00:00') });
    assert.equal(await svc.applySafeChanges(r.changes), 1);
    assert.deepEqual(leads.map((l) => l.enrollmentStatus), ['ENROLLED', 'ENROLLED', 'NON_ENROLLED', 'ENROLLED'], 'downgrade of lead 1 is NOT applied');
});
