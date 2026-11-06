// CRM enrollment reconciliation — REPORT of what the owner's rule (see rules.js) says each
// lead's status should be, compared with the database. Nothing is written unless
// CRM_AUTOFIX=true, and even then only the safe upgrades (ENROLLED / PAYMENT_PROCESSING).

const rules = require('./rules');
const { computeOverdueBatchIds } = require('../entitlement/rules');

const db = () => require('../../core/db');
const CAMPAIGNS = ['AFTER_SEMINAR', 'FREE_SEMINAR', 'OPEN_SEMINAR'];
const AUTOFIX_KINDS = ['should-be-enrolled', 'should-be-processing'];

const autofixEnabled = () => String(process.env.CRM_AUTOFIX || '').toLowerCase() === 'true';

const pushTo = (map, key, value) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
};

async function loadIndex() {
    const students = await db().user.findMany({
        where: { role: { in: ['Student', 'student', 'STUDENT', 'USER', 'user'] } },
        select: { id: true, phone: true, whatsapp: true },
    });
    const byPhone = new Map();
    const byLast7 = new Map();
    for (const s of students) {
        for (const ph of rules.studentPhones(s)) {
            if (!byPhone.has(ph)) byPhone.set(ph, new Set());
            byPhone.get(ph).add(s.id);
            const k = ph.slice(-7);
            if (!byLast7.has(k)) byLast7.set(k, new Set());
            byLast7.get(k).add(s.id);
        }
    }
    const payments = await db().payment.findMany({
        where: { status: { in: [0, 1, 2, 4, -2] }, studentId: { not: null } },
        select: {
            id: true, studentId: true, batchId: true, businessId: true, groupId: true, status: true, payment_type: true,
            valid_until: true, due_date: true, installment_no: true, subjects: true, created_at: true, updatedAt: true,
        },
    });
    const paysByStudent = new Map();
    for (const p of payments) pushTo(paysByStudent, p.studentId, p);

    const groups = await db().group.findMany({ select: { id: true, name: true, batchId: true, itemOrder: true, createdAt: true } });
    const groupNames = new Map(groups.map((g) => [g.id, g.name]));
    const groupsByBatch = new Map();
    for (const g of groups) pushTo(groupsByBatch, g.batchId, g);
    const intakeByBatch = new Map();
    for (const [batchId, gs] of groupsByBatch) {
        const span = rules.intakeMonths(gs);
        if (span) intakeByBatch.set(Number(batchId), span);
    }

    const courses = await db().course.findMany({ select: { id: true, name: true } });
    const courseNames = new Map(courses.map((c) => [c.id, c.name]));

    const instBatchIds = [...new Set(payments.filter((p) => Number(p.payment_type) === 2).map((p) => p.batchId).filter(Boolean))];
    const plans = instBatchIds.length
        ? await db().installment.findMany({ where: { batchId: { in: instBatchIds } }, select: { batchId: true, subjectCount: true, details: true } })
        : [];
    const plansByBatchId = new Map();
    for (const pl of plans) pushTo(plansByBatchId, pl.batchId, pl);

    return { byPhone, byLast7, paysByStudent, groupNames, intakeByBatch, courseNames, plansByBatchId };
}

/**
 * @param {{ batchId?: number, businessId?: number, now?: Date }} opts
 */
async function enrollmentReport({ batchId, businessId, now = new Date() } = {}) {
    const where = { campaignType: { in: CAMPAIGNS } };
    if (batchId) where.batchId = Number(batchId);
    const leads = await db().lead.findMany({
        where,
        select: { id: true, phone: true, batchId: true, campaignType: true, enrollmentStatus: true, paymentIntention: true, createdAt: true, batch: { select: { businessId: true } } },
    });
    const idx = await loadIndex();
    const ctxBase = { groupNames: idx.groupNames, courseNames: idx.courseNames, intakeByBatch: idx.intakeByBatch };

    // One person counts once per intake: if the person already has an ENROLLED lead in that
    // intake, other leads are "secondary"; otherwise only the newest lead gets ENROLLED.
    const personKey = (lead) => `${lead.batchId}|${rules.normPhone(lead.phone)}`;
    const enrolledPeople = new Set(leads.filter((l) => l.batchId && rules.currentStatus(l) === 'ENROLLED' && rules.normPhone(l.phone)).map(personKey));
    const candidates = new Map();
    const changes = [];
    const statusNow = {};
    const droppedSubjects = {};
    let secondaryLeads = 0;
    let last7OnlyMatches = 0;
    let noIntake = 0;
    let intakeEnded = 0;

    for (const lead of leads) {
        if (businessId && rules.leadBusinessId(lead) !== Number(businessId)) continue;
        if (!lead.batchId) { noIntake++; continue; }
        const ph = rules.normPhone(lead.phone);
        const students = ph ? [...(idx.byPhone.get(ph) || [])] : [];
        if (ph && students.length === 0 && idx.byLast7.has(ph.slice(-7))) last7OnlyMatches++;
        const payments = students.flatMap((sid) => idx.paysByStudent.get(sid) || []);
        const overdueBatchIds = new Set(students.flatMap((sid) => [...computeOverdueBatchIds(idx.paysByStudent.get(sid) || [], idx.plansByBatchId, now)]));
        const derived = rules.deriveLeadEnrollment(lead, payments, now, { ...ctxBase, overdueBatchIds });
        if (derived.reason === 'intake-ended') { intakeEnded++; continue; }
        if (derived.evidence) statusNow[derived.status] = (statusNow[derived.status] || 0) + 1;
        for (const d of derived.dropped || []) droppedSubjects[d] = (droppedSubjects[d] || 0) + 1;

        const change = rules.leadChange(lead, derived);
        if (!change) continue;
        const row = { leadId: lead.id, batchId: lead.batchId, campaignType: lead.campaignType, studentIds: students, createdAt: lead.createdAt, ...change };

        if (change.kind === 'should-be-enrolled' && ph) {
            const key = personKey(lead);
            if (enrolledPeople.has(key)) { secondaryLeads++; continue; }
            const prev = candidates.get(key);
            if (prev && new Date(prev.createdAt) >= new Date(lead.createdAt)) { secondaryLeads++; continue; }
            if (prev) secondaryLeads++;
            candidates.set(key, row);
            continue;
        }
        if (change.kind === 'enrolled-without-payment' && ph) {
            const look = [...(idx.byLast7.get(ph.slice(-7)) || [])].filter((sid) => !students.includes(sid));
            const lookPaid = look.some((sid) => (idx.paysByStudent.get(sid) || []).some((p) => Number(p.batchId) === Number(lead.batchId) && [1, 4].includes(Number(p.status))));
            if (lookPaid) row.kind = 'enrolled-by-lookalike-number';
        }
        changes.push(row);
    }
    changes.push(...candidates.values());
    const counts = {};
    for (const c of changes) counts[c.kind] = (counts[c.kind] || 0) + 1;
    return { scanned: leads.length, noIntake, intakeEnded, statusNow, counts, changes, secondaryLeads, last7OnlyMatches, droppedSubjects };
}

/** Apply only the safe kinds (ENROLLED / PAYMENT_PROCESSING), only if nobody changed the lead meanwhile. */
async function applySafeChanges(changes) {
    let n = 0;
    for (const c of changes.filter((x) => AUTOFIX_KINDS.includes(x.kind))) {
        const data = { enrollmentStatus: c.to };
        if (c.intention) data.paymentIntention = c.intention;
        const where = c.from === 'NON_ENROLLED'
            ? { id: c.leadId, OR: [{ enrollmentStatus: 'NON_ENROLLED' }, { enrollmentStatus: null }] }
            : { id: c.leadId, enrollmentStatus: c.from };
        const r = await db().lead.updateMany({ where, data });
        n += r.count;
    }
    return n;
}

async function dailyReconcile() {
    const r = await enrollmentReport();
    const fixed = autofixEnabled() ? await applySafeChanges(r.changes) : 0;
    console.log(`[crm:reconcile] leads=${r.scanned} now=${JSON.stringify(r.statusNow)} changes=${JSON.stringify(r.counts)} secondary=${r.secondaryLeads} autofix=${autofixEnabled()} updated=${fixed}`);
    return { ...r.counts, updated: fixed };
}

module.exports = { enrollmentReport, applySafeChanges, dailyReconcile, AUTOFIX_KINDS };
