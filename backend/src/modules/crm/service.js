// CRM enrollment reconciliation.
//
// One rule for "is this lead enrolled": the payments of the student with the SAME phone
// (all 9 digits) for the lead's batch (or business, when the lead has no batch), judged
// like class access. Report first; with CRM_AUTOFIX=true the daily job also applies the
// safe changes (marking leads ENROLLED / PAYMENT_PROCESSING). Downgrades are only reported.

const rules = require('./rules');

const db = () => require('../../core/db');
const CAMPAIGNS = ['AFTER_SEMINAR', 'FREE_SEMINAR', 'OPEN_SEMINAR'];
const AUTOFIX_KINDS = ['should-be-enrolled', 'should-be-processing', 'intention-update'];

const autofixEnabled = () => String(process.env.CRM_AUTOFIX || '').toLowerCase() === 'true';

async function loadIndex() {
    const students = await db().user.findMany({
        where: { role: { in: ['Student', 'student', 'STUDENT', 'USER', 'user'] } },
        select: { id: true, phone: true, whatsapp: true, optionalPhone: true, addressHouseNo: true },
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
        select: { id: true, studentId: true, batchId: true, businessId: true, status: true, payment_type: true, valid_until: true },
    });
    const paysByStudent = new Map();
    for (const p of payments) {
        if (!paysByStudent.has(p.studentId)) paysByStudent.set(p.studentId, []);
        paysByStudent.get(p.studentId).push(p);
    }
    return { byPhone, byLast7, paysByStudent };
}

/**
 * @param {{ batchId?: number, businessId?: number, now?: Date }} opts
 * @returns {Promise<{ scanned, counts, changes, duplicates, last7OnlyMatches }>}
 */
async function enrollmentReport({ batchId, businessId, now = new Date() } = {}) {
    const where = { campaignType: { in: CAMPAIGNS } };
    if (batchId) where.batchId = Number(batchId);
    const leads = await db().lead.findMany({
        where,
        select: { id: true, phone: true, batchId: true, campaignType: true, enrollmentStatus: true, paymentIntention: true, createdAt: true, batch: { select: { businessId: true } } },
    });
    const idx = await loadIndex();
    const changes = [];
    const counts = {};
    const dupKeys = new Map();
    let last7OnlyMatches = 0;

    // One person counts once per batch: the stats pages give the enrollment to ONE lead
    // (the newest). Leads of a person who already has an ENROLLED lead in that batch are
    // "secondary" and are left alone, so conversions are not counted twice.
    const personKey = (lead) => `${lead.batchId || 'none'}|${rules.normPhone(lead.phone)}`;
    const enrolledPeople = new Set(leads.filter((l) => l.enrollmentStatus === 'ENROLLED' && rules.normPhone(l.phone)).map(personKey));
    const candidates = new Map(); // personKey → newest should-be-enrolled change
    let secondaryLeads = 0;

    for (const lead of leads) {
        const bizId = rules.leadBusinessId(lead);
        if (businessId && bizId !== Number(businessId)) continue;
        const ph = rules.normPhone(lead.phone);
        if (ph) {
            const k = `${lead.campaignType}|${lead.batchId || 'none'}|${ph}`;
            dupKeys.set(k, (dupKeys.get(k) || 0) + 1);
        }
        const exactStudents = ph ? [...(idx.byPhone.get(ph) || [])] : [];
        if (ph && exactStudents.length === 0 && idx.byLast7.has(ph.slice(-7))) last7OnlyMatches++;
        const payments = exactStudents.flatMap((sid) => idx.paysByStudent.get(sid) || []);
        const derived = rules.deriveLeadEnrollment({ batchId: lead.batchId, businessId: bizId }, payments, now);
        const change = rules.leadChange(lead, derived);
        if (!change) continue;
        const row = { leadId: lead.id, batchId: lead.batchId, campaignType: lead.campaignType, studentIds: exactStudents, createdAt: lead.createdAt, ...change };

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
            // Did someone with a DIFFERENT number but the same last 7 digits pay? → old matching mistake.
            const look = [...(idx.byLast7.get(ph.slice(-7)) || [])].filter((sid) => !exactStudents.includes(sid));
            const lookPaid = look.some((sid) => (idx.paysByStudent.get(sid) || []).some((p) =>
                Number(p.batchId) === Number(lead.batchId) && [1, 4].includes(Number(p.status))));
            if (lookPaid) { row.kind = 'enrolled-by-lookalike-number'; row.lookalikeStudentIds = look; }
        }
        changes.push(row);
    }
    changes.push(...candidates.values());
    for (const c of changes) counts[c.kind] = (counts[c.kind] || 0) + 1;
    const duplicates = [...dupKeys.values()].filter((n) => n > 1).length;
    return { scanned: leads.length, counts, changes, duplicates, last7OnlyMatches, secondaryLeads };
}

/** Apply only the safe kinds (mark ENROLLED / PAYMENT_PROCESSING). Returns how many were updated. */
async function applySafeChanges(changes) {
    let n = 0;
    for (const c of changes.filter((x) => AUTOFIX_KINDS.includes(x.kind))) {
        const data = { enrollmentStatus: c.to };
        if (c.intention) data.paymentIntention = c.intention;
        // only if nobody changed it meanwhile
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
    console.log(`[crm:reconcile] leads=${r.scanned} ${JSON.stringify(r.counts)} secondary=${r.secondaryLeads} duplicates=${r.duplicates} last7OnlyMatches=${r.last7OnlyMatches} autofix=${autofixEnabled()} updated=${fixed}`);
    return { ...r.counts, updated: fixed };
}

module.exports = { enrollmentReport, applySafeChanges, dailyReconcile, AUTOFIX_KINDS };
