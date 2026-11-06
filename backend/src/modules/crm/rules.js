// CRM rules (pure). Lead enrollment is DERIVED from payments — same rule as class access
// (entitlement.statusGrantsAccess) — never guessed from partial phone digits.
//
// Old code matched people by the LAST 7 DIGITS of a phone (`phone contains '1234567'`).
// 077 1234567 and 071 1234567 are different people with the same last 7 digits, so one
// student's payment marked someone else's lead ENROLLED (and could reset another lead).
// Sri Lankan numbers are 9 digits after the 0 / 94, so we compare all 9.

const { statusGrantsAccess, STATUS, PAYMENT_TYPE } = require('../entitlement/rules');

// ---- Month logic (business rule) ----
// Monthly students are ENROLLED only for the month they paid. In the last week of a month
// everyone switches to the NEXT month: from ~24 Oct a student is ENROLLED only if they paid
// November. "Target month" = the month of (today + SWITCH_DAYS).
const SWITCH_DAYS = 7;
const EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sept?', 'oct', 'nov', 'dec'];
const SI = ['ජනවාරි', 'පෙබරවාරි', 'මාර්තු', 'අප්‍රේල්', 'මැයි', 'ජූනි', 'ජූලි', 'අගෝස්තු', 'සැප්තැම්බර්', 'ඔක්තෝබර්', 'නොවැම්බර්', 'දෙසැම්බර්'];
const DAY_MS = 24 * 60 * 60 * 1000;

/** Month (0-11) a group name refers to ("NOVEMBER MONTH", "Nov 2026", "නොවැම්බර්"), or null. */
function groupMonth(name) {
    const n = String(name || '').toLowerCase();
    for (let i = 0; i < 12; i++) if (n.includes(EN[i])) return i;
    for (let i = 0; i < 12; i++) if (new RegExp(`(^|[^a-z])${SHORT[i]}([^a-z]|$)`).test(n)) return i;
    for (let i = 0; i < 12; i++) if (n.includes(SI[i])) return i;
    return null;
}

const ym = (y, m) => y * 12 + m; // comparable month number
const ymOf = (d) => ym(d.getUTCFullYear(), d.getUTCMonth());

/** The month students must have paid to count as ENROLLED now. */
function targetMonth(now = new Date(), switchDays = SWITCH_DAYS) {
    return ymOf(new Date(now.getTime() + switchDays * DAY_MS));
}

/**
 * The month a monthly payment pays for: the group's month (the year nearest to when it was
 * paid), else the month of (paid date + SWITCH_DAYS).
 */
function paymentMonth(payment, groupName, switchDays = SWITCH_DAYS) {
    const paid = new Date(payment.created_at || Date.now());
    const shifted = ymOf(new Date(paid.getTime() + switchDays * DAY_MS));
    const m = groupMonth(groupName);
    if (m === null) return shifted;
    const y = paid.getUTCFullYear();
    return [ym(y - 1, m), ym(y, m), ym(y + 1, m)].sort((a, b) => Math.abs(a - shifted) - Math.abs(b - shifted))[0];
}

/** "0771234567", "+94 77 123 4567", "94771234567_BIZ_2_BATCH_5" → "771234567". null if not a phone. */
function normPhone(raw) {
    if (raw === null || raw === undefined) return null;
    let d = String(raw).split('_')[0].replace(/[^0-9]/g, '');
    if (d.length === 11 && d.startsWith('94')) d = d.slice(2);
    if (d.length === 10 && d.startsWith('0')) d = d.slice(1);
    if (d.length === 12 && d.startsWith('0094')) d = d.slice(4);
    return d.length >= 9 ? d.slice(-9) : null;
}

/**
 * All normalized phones of a student. addressHouseNo is included because the old sync
 * read it (some records keep a 2nd number there); normPhone drops anything that is not
 * a 9+ digit phone, so real house numbers never match.
 */
function studentPhones(student) {
    return [...new Set([student.phone, student.whatsapp, student.optionalPhone, student.addressHouseNo].map(normPhone).filter(Boolean))];
}

/** Old matching key (kept only to measure how often it differs). */
const last7 = (raw) => {
    const d = String(raw || '').split('_')[0].replace(/[^0-9]/g, '');
    return d.length >= 7 ? d.slice(-7) : null;
};

const intentionOf = (paymentType) => {
    const t = parseInt(paymentType, 10);
    return t === 3 ? 'FULL' : t === 2 ? 'INSTALLMENT' : 'MONTHLY';
};

const PENDING_STATUSES = [STATUS.PENDING, STATUS.POST_PAY, -2];

/**
 * What the lead's enrollment should be, from the matched students' payments.
 *   FULL        → ENROLLED for the whole batch
 *   INSTALLMENT → ENROLLED while no installment is overdue (same rule as class access:
 *                 batch 9 months / 3 installments → 2nd unpaid ⇒ not enrolled from month 4)
 *   MONTHLY     → ENROLLED only if the TARGET month is paid (see targetMonth)
 * @param {{ batchId?: number|null, businessId?: number|null }} lead
 * @param {object[]} payments payments of students with the same phone
 * @param {Date} now
 * @param {{ overdueBatchIds?: Set<number>, groupNames?: Map<number,string>, switchDays?: number }} ctx
 * @returns {{ status, intention, paymentId?, evidence: boolean, reason?: string }}
 *   evidence=false → no payment for that batch/business at all (do not change the lead)
 */
function deriveLeadEnrollment(lead, payments, now = new Date(), ctx = {}) {
    const overdue = ctx.overdueBatchIds || new Set();
    const groupNames = ctx.groupNames || new Map();
    const relevant = (payments || []).filter((p) =>
        lead.batchId ? Number(p.batchId) === Number(lead.batchId) : (lead.businessId ? Number(p.businessId) === Number(lead.businessId) : false));
    if (relevant.length === 0) return { status: 'NON_ENROLLED', intention: null, evidence: false };

    const target = targetMonth(now, ctx.switchDays);
    const type = (p) => parseInt(p.payment_type, 10) || PAYMENT_TYPE.MONTHLY;
    const coversNow = (p) => {
        if (type(p) === PAYMENT_TYPE.FULL) return true;
        if (type(p) === PAYMENT_TYPE.INSTALLMENT) return !overdue.has(Number(p.batchId));
        return paymentMonth(p, groupNames.get(Number(p.groupId)), ctx.switchDays) >= target;
    };
    const byStrength = (a, b) => [3, 2, 1].indexOf(type(a)) - [3, 2, 1].indexOf(type(b));

    const active = relevant.filter((p) => statusGrantsAccess(p, now) && coversNow(p)).sort(byStrength)[0];
    if (active) return { status: 'ENROLLED', intention: intentionOf(active.payment_type), paymentId: active.id, evidence: true };
    const pending = relevant.filter((p) => PENDING_STATUSES.includes(Number(p.status)) && coversNow(p)).sort(byStrength)[0];
    if (pending) return { status: 'PAYMENT_PROCESSING', intention: intentionOf(pending.payment_type), paymentId: pending.id, evidence: true };

    const everPaid = relevant.filter((p) => statusGrantsAccess(p, now) || Number(p.status) === STATUS.APPROVED).sort(byStrength)[0];
    if (everPaid) {
        const t = type(everPaid);
        return {
            status: 'NON_ENROLLED', intention: intentionOf(t), evidence: true,
            reason: t === PAYMENT_TYPE.INSTALLMENT ? 'installment-overdue' : 'monthly-not-paid-this-month',
        };
    }
    return { status: 'NON_ENROLLED', intention: null, evidence: true }; // only rejected / trashed payments
}

/** Statuses staff set by hand that the system must not overwrite. */
const MANUAL_STATUSES = ['PAID'];

/**
 * Change to apply to a lead, or null.
 *  - only when there is payment evidence for the lead's batch/business
 *  - ENROLLED that has no evidence at all is reported (maybe a last-7-digit mistake) but not changed
 */
function leadChange(lead, derived) {
    const current = lead.enrollmentStatus || 'NON_ENROLLED';
    if (MANUAL_STATUSES.includes(current)) return null;
    if (!derived.evidence) {
        return current === 'ENROLLED' ? { kind: 'enrolled-without-payment', from: current, to: null } : null;
    }
    if (current === derived.status && (!derived.intention || lead.paymentIntention === derived.intention || current !== 'ENROLLED')) return null;
    if (current === derived.status) {
        return { kind: 'intention-update', from: current, to: derived.status, intention: derived.intention, paymentId: derived.paymentId };
    }
    const kind = derived.status === 'ENROLLED' ? 'should-be-enrolled'
        : derived.status === 'PAYMENT_PROCESSING' ? 'should-be-processing'
            : (derived.reason || 'should-not-be-enrolled');
    return { kind, from: current, to: derived.status, intention: derived.intention, paymentId: derived.paymentId };
}

/** Lead business from batch or from the "_BIZ_<id>" phone suffix the old code uses. */
function leadBusinessId(lead) {
    if (lead.batch && lead.batch.businessId) return Number(lead.batch.businessId);
    const m = String(lead.phone || '').match(/_BIZ_(\d+)/);
    return m ? Number(m[1]) : null;
}

module.exports = { groupMonth, targetMonth, paymentMonth, normPhone, last7, studentPhones, intentionOf, deriveLeadEnrollment, leadChange, leadBusinessId, MANUAL_STATUSES };
