// CRM rules (pure). Lead enrollment is DERIVED from payments — same rule as class access
// (entitlement.statusGrantsAccess) — never guessed from partial phone digits.
//
// Old code matched people by the LAST 7 DIGITS of a phone (`phone contains '1234567'`).
// 077 1234567 and 071 1234567 are different people with the same last 7 digits, so one
// student's payment marked someone else's lead ENROLLED (and could reset another lead).
// Sri Lankan numbers are 9 digits after the 0 / 94, so we compare all 9.

const { statusGrantsAccess, STATUS } = require('../entitlement/rules');

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
 * @param {{ batchId?: number|null, businessId?: number|null }} lead
 * @param {object[]} payments payments of students with the same phone
 * @returns {{ status: 'ENROLLED'|'PAYMENT_PROCESSING'|'NON_ENROLLED', intention: string|null, paymentId?: number, evidence: boolean }}
 *   evidence=false → no payment for that batch/business at all (do not change the lead)
 */
function deriveLeadEnrollment(lead, payments, now = new Date()) {
    const relevant = (payments || []).filter((p) =>
        lead.batchId ? Number(p.batchId) === Number(lead.batchId) : (lead.businessId ? Number(p.businessId) === Number(lead.businessId) : false));
    if (relevant.length === 0) return { status: 'NON_ENROLLED', intention: null, evidence: false };
    const active = relevant.find((p) => statusGrantsAccess(p, now));
    if (active) return { status: 'ENROLLED', intention: intentionOf(active.payment_type), paymentId: active.id, evidence: true };
    const pending = relevant.find((p) => PENDING_STATUSES.includes(Number(p.status)));
    if (pending) return { status: 'PAYMENT_PROCESSING', intention: intentionOf(pending.payment_type), paymentId: pending.id, evidence: true };
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
    if (current === derived.status && (!derived.intention || lead.paymentIntention === derived.intention)) return null;
    if (current === derived.status) {
        return { kind: 'intention-update', from: current, to: derived.status, intention: derived.intention, paymentId: derived.paymentId };
    }
    const kind = derived.status === 'ENROLLED' ? 'should-be-enrolled'
        : derived.status === 'PAYMENT_PROCESSING' ? 'should-be-processing'
            : 'should-not-be-enrolled';
    return { kind, from: current, to: derived.status, intention: derived.intention, paymentId: derived.paymentId };
}

/** Lead business from batch or from the "_BIZ_<id>" phone suffix the old code uses. */
function leadBusinessId(lead) {
    if (lead.batch && lead.batch.businessId) return Number(lead.batch.businessId);
    const m = String(lead.phone || '').match(/_BIZ_(\d+)/);
    return m ? Number(m[1]) : null;
}

module.exports = { normPhone, last7, studentPhones, intentionOf, deriveLeadEnrollment, leadChange, leadBusinessId, MANUAL_STATUSES };
