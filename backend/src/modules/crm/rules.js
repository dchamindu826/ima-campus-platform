// CRM rules (pure). The owner's business rule, agreed on 2026-11-06:
//
//  1. Everything is per INTAKE (batch). A lead is allocated to one intake; only that
//     intake's payments count. The same number in two intakes / businesses = two leads.
//  2. A lead matches a student when the number that messaged the CRM is the student's
//     registered phone or WhatsApp — all 9 digits (not the last 7, not NIC, not address).
//  3. Active month = calendar month (Sri Lanka time). On the LAST DAY of a month the CRM
//     already moves to the next month. Advance payments count (paying November in October
//     makes the student enrolled for November).
//  4. FULL (all months at once) → ENROLLED for the whole intake.
//  5. INSTALLMENT (full payment in parts) → ENROLLED until an installment is overdue, then NON-PAID.
//  6. MONTHLY, for the active month M:
//       - M is the intake's base (first) month: any payment → ENROLLED (no non-paid in the base month)
//       - every subject paid for M−1 is paid for M → ENROLLED   (M−1 A,B ; M A,B → ENROLLED)
//       - a subject of M−1 is missing, or nothing paid for M → NON-PAID (dropped subjects listed)
//       - never paid this intake → NON_ENROLLED (still being followed up to enroll)
//  7. Nobody sets the status by hand: payment approval + the daily check update it.
//
// In the database NON-PAID is enrollmentStatus NON_ENROLLED with a known paymentIntention
// (the monthly reset moves those leads to the non-paid call round).

const { statusGrantsAccess, STATUS, PAYMENT_TYPE, parseSubjects } = require('../entitlement/rules');

const DAY_MS = 24 * 60 * 60 * 1000;
const SL_OFFSET_MS = 5.5 * 60 * 60 * 1000; // Asia/Colombo, no DST

// ---- phone ----

/** "0771234567", "+94 77 123 4567", "94771234567_BIZ_2_BATCH_5" → "771234567". null if not a phone. */
function normPhone(raw) {
    if (raw === null || raw === undefined) return null;
    let d = String(raw).split('_')[0].replace(/[^0-9]/g, '');
    if (d.length === 12 && d.startsWith('0094')) d = d.slice(4);
    if (d.length === 11 && d.startsWith('94')) d = d.slice(2);
    if (d.length === 10 && d.startsWith('0')) d = d.slice(1);
    return d.length >= 9 ? d.slice(-9) : null;
}

/** The student's registered numbers: phone and WhatsApp only (rule 2). */
function studentPhones(student) {
    return [...new Set([student.phone, student.whatsapp].map(normPhone).filter(Boolean))];
}

/** Old matching key — only used to measure how often the old rule was wrong. */
const last7 = (raw) => {
    const d = String(raw || '').split('_')[0].replace(/[^0-9]/g, '');
    return d.length >= 7 ? d.slice(-7) : null;
};

// ---- months ----

const EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sept?', 'oct', 'nov', 'dec'];
const SI = ['ජනවාරි', 'පෙබරවාරි', 'මාර්තු', 'අප්‍රේල්', 'මැයි', 'ජූනි', 'ජූලි', 'අගෝස්තු', 'සැප්තැම්බර්', 'ඔක්තෝබර්', 'නොවැම්බර්', 'දෙසැම්බර්'];

/** Month (0-11) a group / course name refers to ("NOVEMBER MONTH", "Nov 2026", "නොවැම්බර්"), or null. */
function groupMonth(name) {
    const n = String(name || '').toLowerCase();
    for (let i = 0; i < 12; i++) if (n.includes(EN[i])) return i;
    for (let i = 0; i < 12; i++) if (new RegExp(`(^|[^a-z])${SHORT[i]}([^a-z]|$)`).test(n)) return i;
    for (let i = 0; i < 12; i++) if (n.includes(SI[i])) return i;
    return null;
}

const ym = (y, m) => y * 12 + m; // comparable month number
const slDate = (d) => new Date(new Date(d).getTime() + SL_OFFSET_MS); // read with getUTC* = Sri Lanka time
const ymOf = (d) => { const s = slDate(d); return ym(s.getUTCFullYear(), s.getUTCMonth()); };

/** Active month now (rule 3): calendar month in Sri Lanka, next month already on the last day. */
function activeMonth(now = new Date()) {
    return ymOf(new Date(new Date(now).getTime() + DAY_MS));
}

/** Month a monthly group pays for: its month name (year nearest to when it was paid), else the paid date's month. */
function paymentMonth(payment, groupName) {
    const paidAt = payment.created_at || Date.now();
    const paidYm = ymOf(paidAt);
    const m = groupMonth(groupName);
    if (m === null) return paidYm;
    const y = slDate(paidAt).getUTCFullYear();
    return [ym(y - 1, m), ym(y, m), ym(y + 1, m)].sort((a, b) => Math.abs(a - paidYm) - Math.abs(b - paidYm))[0];
}

/** Base (first) month of an intake: the earliest monthly group month. */
function intakeBaseMonth(groups, createdAt) {
    const ref = createdAt || Date.now();
    const months = (groups || [])
        .filter((g) => !/full|installment/i.test(g.name || ''))
        .map((g) => paymentMonth({ created_at: g.createdAt || ref }, g.name))
        .filter((x) => x !== null);
    return months.length ? Math.min(...months) : null;
}

// ---- subjects ----

/** Same subject across month groups: name without month words, years, punctuation. */
function subjectKey(courseName) {
    let n = String(courseName || '').toLowerCase();
    for (const w of SI) n = n.split(w).join(' ');
    n = n.replace(new RegExp(`\\b(${EN.join('|')}|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec|month|monthly)\\b`, 'g'), ' ');
    n = n.replace(/\b(19|20)\d{2}\b/g, ' ');
    return n.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

// ---- types ----

const intentionOf = (t) => (t === PAYMENT_TYPE.FULL ? 'FULL' : t === PAYMENT_TYPE.INSTALLMENT ? 'INSTALLMENT' : 'MONTHLY');
const PENDING_STATUSES = [STATUS.PENDING, STATUS.POST_PAY, -2];

/**
 * What the lead's status should be (rules 4–6).
 * @param {{ batchId?: number|null }} lead
 * @param {object[]} payments  payments of the student(s) with the lead's number
 * @param {Date} now
 * @param {{ groupNames: Map<number,string>, courseNames: Map<number,string>,
 *           baseMonthByBatch: Map<number,number>, overdueBatchIds: Set<number> }} ctx
 * @returns {{ status: 'ENROLLED'|'PAYMENT_PROCESSING'|'NON_PAID'|'NON_ENROLLED', intention: string|null,
 *            evidence: boolean, dropped?: string[], reason?: string }}
 */
function deriveLeadEnrollment(lead, payments, now = new Date(), ctx = {}) {
    const groupNames = ctx.groupNames || new Map();
    const courseNames = ctx.courseNames || new Map();
    const overdue = ctx.overdueBatchIds || new Set();
    if (!lead.batchId) return { status: 'NON_ENROLLED', intention: null, evidence: false, reason: 'lead-has-no-intake' };

    const mine = (payments || []).filter((p) => Number(p.batchId) === Number(lead.batchId));
    if (mine.length === 0) return { status: 'NON_ENROLLED', intention: null, evidence: false };

    const typeOf = (p) => {
        const g = String(groupNames.get(Number(p.groupId)) || '').toUpperCase();
        if (g.includes('FULL')) return PAYMENT_TYPE.FULL;
        if (g.includes('INSTALLMENT')) return PAYMENT_TYPE.INSTALLMENT;
        return parseInt(p.payment_type, 10) || PAYMENT_TYPE.MONTHLY;
    };
    const paid = mine.filter((p) => statusGrantsAccess(p, now));
    const pending = mine.filter((p) => PENDING_STATUSES.includes(Number(p.status)) && !statusGrantsAccess(p, now));

    // 4. FULL
    if (paid.some((p) => typeOf(p) === PAYMENT_TYPE.FULL)) return { status: 'ENROLLED', intention: 'FULL', evidence: true };

    // 5. INSTALLMENT
    const inst = paid.filter((p) => typeOf(p) === PAYMENT_TYPE.INSTALLMENT);
    if (inst.length) {
        if (!overdue.has(Number(lead.batchId))) return { status: 'ENROLLED', intention: 'INSTALLMENT', evidence: true };
        if (pending.some((p) => typeOf(p) === PAYMENT_TYPE.INSTALLMENT)) return { status: 'PAYMENT_PROCESSING', intention: 'INSTALLMENT', evidence: true };
        return { status: 'NON_PAID', intention: 'INSTALLMENT', evidence: true, reason: 'installment-overdue' };
    }

    // 6. MONTHLY
    const M = activeMonth(now);
    const monthOf = (p) => paymentMonth(p, groupNames.get(Number(p.groupId)));
    const subjectsOf = (list) => new Set(list.flatMap((p) => parseSubjects(p.subjects).ids.map((id) => subjectKey(courseNames.get(Number(id)) || `course-${id}`))).filter(Boolean));
    const monthly = paid.filter((p) => typeOf(p) === PAYMENT_TYPE.MONTHLY);
    const nowPaid = monthly.filter((p) => monthOf(p) >= M);           // advance payments count
    const prevPaid = monthly.filter((p) => monthOf(p) === M - 1);
    const nowSubjects = subjectsOf(nowPaid);
    const prevSubjects = subjectsOf(prevPaid);
    const pendingNow = pending.filter((p) => typeOf(p) === PAYMENT_TYPE.MONTHLY && monthOf(p) >= M);
    const pendingSubjects = subjectsOf(pendingNow);

    if (monthly.length === 0) {
        // only pending / rejected payments in this intake
        if (pendingNow.length || pending.length) return { status: 'PAYMENT_PROCESSING', intention: 'MONTHLY', evidence: true };
        return { status: 'NON_ENROLLED', intention: null, evidence: true, reason: 'never-paid' };
    }

    const base = ctx.baseMonthByBatch ? ctx.baseMonthByBatch.get(Number(lead.batchId)) : null;
    if (base !== null && base !== undefined && M <= base) {
        if (nowPaid.length) return { status: 'ENROLLED', intention: 'MONTHLY', evidence: true, reason: 'base-month' };
        if (pendingNow.length) return { status: 'PAYMENT_PROCESSING', intention: 'MONTHLY', evidence: true };
        return { status: 'NON_ENROLLED', intention: 'MONTHLY', evidence: true, reason: 'base-month-not-paid' };
    }

    const dropped = [...prevSubjects].filter((s) => !nowSubjects.has(s));
    if (nowPaid.length && dropped.length === 0) return { status: 'ENROLLED', intention: 'MONTHLY', evidence: true };
    if (dropped.length && dropped.every((s) => pendingSubjects.has(s))) return { status: 'PAYMENT_PROCESSING', intention: 'MONTHLY', evidence: true };
    if (!nowPaid.length && pendingNow.length && prevSubjects.size === 0) return { status: 'PAYMENT_PROCESSING', intention: 'MONTHLY', evidence: true };
    return {
        status: 'NON_PAID', intention: 'MONTHLY', evidence: true,
        dropped: dropped.length ? dropped : [...prevSubjects],
        reason: nowPaid.length ? 'dropped-subject' : 'not-paid-this-month',
    };
}

/** DB status → the same words (old "PAID" means enrolled; NON_ENROLLED + intention = non-paid). */
function currentStatus(lead) {
    const s = lead.enrollmentStatus || 'NON_ENROLLED';
    if (s === 'PAID') return 'ENROLLED';
    return s;
}

/**
 * Change to report for a lead, or null.
 * NON_PAID and NON_ENROLLED are both NON_ENROLLED in the DB, so they compare equal.
 */
function leadChange(lead, derived) {
    const current = currentStatus(lead);
    if (!derived.evidence) {
        return current === 'ENROLLED' ? { kind: 'enrolled-without-payment', from: current, to: null } : null;
    }
    const dbTarget = derived.status === 'NON_PAID' ? 'NON_ENROLLED' : derived.status;
    if (current === dbTarget) {
        if (dbTarget === 'ENROLLED' && derived.intention && lead.paymentIntention !== derived.intention) {
            return { kind: 'intention-update', from: current, to: dbTarget, intention: derived.intention };
        }
        return null;
    }
    const kind = derived.status === 'ENROLLED' ? 'should-be-enrolled'
        : derived.status === 'PAYMENT_PROCESSING' ? 'should-be-processing'
            : derived.status === 'NON_PAID' ? (derived.reason === 'installment-overdue' ? 'should-be-non-paid-installment'
                : derived.reason === 'dropped-subject' ? 'should-be-non-paid-dropped-subject' : 'should-be-non-paid-not-paid-this-month')
                : 'should-not-be-enrolled';
    return { kind, from: current, to: dbTarget, intention: derived.intention, dropped: derived.dropped };
}

/** Lead business from batch or from the "_BIZ_<id>" phone suffix the old code uses. */
function leadBusinessId(lead) {
    if (lead.batch && lead.batch.businessId) return Number(lead.batch.businessId);
    const m = String(lead.phone || '').match(/_BIZ_(\d+)/);
    return m ? Number(m[1]) : null;
}

module.exports = {
    normPhone, last7, studentPhones,
    groupMonth, activeMonth, paymentMonth, intakeBaseMonth, subjectKey,
    deriveLeadEnrollment, currentStatus, leadChange, leadBusinessId, intentionOf,
};
