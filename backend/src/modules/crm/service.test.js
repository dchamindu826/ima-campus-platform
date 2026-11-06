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
        group: { findMany: async () => [] }, installment: { findMany: async () => [] },
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
    assert.equal(byLead[2], 'enrolled-by-lookalike-number', '071 1234567 enrolled only because 077 1234567 paid');
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

test('report: a person already ENROLLED via another lead is not enrolled again (no double counting); newest lead wins', async () => {
    const leads = [
        { id: 10, phone: '0771234567', batchId: 5, campaignType: 'FREE_SEMINAR', enrollmentStatus: 'ENROLLED', createdAt: new Date('2026-09-01'), batch: { businessId: 2 } },
        { id: 11, phone: '0771234567_BIZ_2_AS', batchId: 5, campaignType: 'AFTER_SEMINAR', enrollmentStatus: 'NON_ENROLLED', createdAt: new Date('2026-10-01'), batch: { businessId: 2 } },
        { id: 20, phone: '0779999999', batchId: 5, campaignType: 'FREE_SEMINAR', enrollmentStatus: 'NON_ENROLLED', createdAt: new Date('2026-09-01'), batch: { businessId: 2 } },
        { id: 21, phone: '0779999999_AS', batchId: 5, campaignType: 'AFTER_SEMINAR', enrollmentStatus: 'NON_ENROLLED', createdAt: new Date('2026-10-01'), batch: { businessId: 2 } },
        { id: 30, phone: '0711234567', batchId: 5, campaignType: 'AFTER_SEMINAR', enrollmentStatus: 'ENROLLED', createdAt: new Date('2026-10-01'), batch: { businessId: 2 } },
    ];
    const db = {
        lead: { findMany: async () => leads },
        user: { findMany: async () => [{ id: 70, phone: '0771234567' }, { id: 80, phone: '0779999999' }] },
        group: { findMany: async () => [] }, installment: { findMany: async () => [] },
        payment: { findMany: async () => [{ id: 1, studentId: 70, batchId: 5, status: 1, payment_type: 1 }, { id: 2, studentId: 80, batchId: 5, status: 1, payment_type: 1 }] },
    };
    const r = await load(db).enrollmentReport();
    const byLead = Object.fromEntries(r.changes.map((c) => [c.leadId, c.kind]));
    assert.equal(byLead[11], undefined, 'person already enrolled via lead 10');
    assert.equal(byLead[21], 'should-be-enrolled', 'newest lead of the person');
    assert.equal(byLead[20], undefined);
    assert.equal(r.secondaryLeads, 2);
    assert.equal(byLead[30], 'enrolled-by-lookalike-number', '071 1234567 enrolled only because 077 1234567 paid');
});

test('report: monthly reset is respected — paid October only, it is the last week of October → not enrolled (non-paid call)', async () => {
    const leads = [
        { id: 1, phone: '0771234567', batchId: 5, campaignType: 'AFTER_SEMINAR', enrollmentStatus: 'NON_ENROLLED', paymentIntention: 'MONTHLY', createdAt: new Date('2026-08-01'), batch: { businessId: 2 } },
        { id: 2, phone: '0779999999', batchId: 5, campaignType: 'AFTER_SEMINAR', enrollmentStatus: 'NON_ENROLLED', paymentIntention: 'MONTHLY', createdAt: new Date('2026-08-01'), batch: { businessId: 2 } },
    ];
    const db = {
        lead: { findMany: async () => leads },
        user: { findMany: async () => [{ id: 70, phone: '0771234567' }, { id: 80, phone: '0779999999' }] },
        group: { findMany: async () => [{ id: 10, name: 'OCTOBER MONTH' }, { id: 11, name: 'NOVEMBER MONTH' }] },
        installment: { findMany: async () => [] },
        payment: { findMany: async () => [
            { id: 1, studentId: 70, batchId: 5, groupId: 10, status: 1, payment_type: 1, created_at: new Date('2026-10-02') },
            { id: 2, studentId: 80, batchId: 5, groupId: 10, status: 1, payment_type: 1, created_at: new Date('2026-10-02') },
            { id: 3, studentId: 80, batchId: 5, groupId: 11, status: 1, payment_type: 1, created_at: new Date('2026-10-28') },
        ] },
    };
    const r = await load(db).enrollmentReport({ now: new Date('2026-10-27') });
    const byLead = Object.fromEntries(r.changes.map((c) => [c.leadId, c.kind]));
    assert.equal(byLead[1], undefined, 'October-only payer stays NON_ENROLLED (no change)');
    assert.equal(byLead[2], 'should-be-enrolled', 'paid November → enrolled');
});
