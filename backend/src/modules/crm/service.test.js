const test = require('node:test');
const assert = require('node:assert/strict');

function fake() {
    const leads = [
        { id: 1, phone: '0771234567_BIZ_2_BATCH_5_AS', batchId: 5, campaignType: 'AFTER_SEMINAR', enrollmentStatus: 'NON_ENROLLED', paymentIntention: 'NOT_DECIDED', batch: { businessId: 2 } },
        { id: 2, phone: '0711234567', batchId: 5, campaignType: 'AFTER_SEMINAR', enrollmentStatus: 'ENROLLED', paymentIntention: 'MONTHLY', batch: { businessId: 2 } }, // same last 7, other person
        { id: 3, phone: '0779999999', batchId: 5, campaignType: 'AFTER_SEMINAR', enrollmentStatus: 'NON_ENROLLED', batch: { businessId: 2 } },
        { id: 4, phone: '0779999999_X', batchId: 5, campaignType: 'AFTER_SEMINAR', enrollmentStatus: 'PAID', batch: { businessId: 2 } },
    ];
    const db = {
        lead: { findMany: async () => leads, updateMany: async ({ where, data }) => { const l = leads.find((x) => x.id === where.id); if (!l) return { count: 0 }; Object.assign(l, data); return { count: 1 }; } },
        user: { findMany: async () => [{ id: 70, phone: '94771234567' }, { id: 80, phone: '0779999999' }] },
        payment: { findMany: async () => [{ id: 900, studentId: 70, batchId: 5, businessId: 2, status: 1, payment_type: 3 }, { id: 901, studentId: 80, batchId: 5, businessId: 2, status: 0, payment_type: 1 }] },
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

test('report: paid student lead NOT marked enrolled is found; last-7 look-alike is flagged, not trusted', async () => {
    const { db } = fake();
    const r = await load(db).enrollmentReport();
    const byLead = Object.fromEntries(r.changes.map((c) => [c.leadId, c.kind]));
    assert.equal(byLead[1], 'should-be-enrolled');
    assert.equal(byLead[2], 'enrolled-without-payment');
    assert.equal(byLead[3], 'should-be-processing');
    assert.equal(byLead[4], undefined, 'manual PAID untouched');
    assert.equal(r.last7OnlyMatches, 1);
    assert.equal(r.duplicates, 1, 'leads 3 and 4 are the same person in the same batch/campaign');
});

test('autofix applies only upgrades; downgrade is left for staff', async () => {
    const { db, leads } = fake();
    const svc = load(db);
    const r = await svc.enrollmentReport();
    assert.equal(await svc.applySafeChanges(r.changes), 2);
    assert.deepEqual(leads.map((l) => l.enrollmentStatus), ['ENROLLED', 'ENROLLED', 'PAYMENT_PROCESSING', 'PAID']);
    assert.equal(leads[0].paymentIntention, 'FULL');
});
