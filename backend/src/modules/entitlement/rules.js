// Entitlement rules — the ONE place that decides what a student can access.
//
// Pure functions only: no database, no Express. Everything here is unit-tested in
// rules.test.js. If an access rule changes, change it here (and add a test).
//
// DB codes (see ARCHITECTURE.md):
//   payment_type: 1 Monthly, 2 Installment, 3 Full
//   status:       0 Pending, 1 Approved, 2 Rejected, 4 Post-pay, 5 Trash, -2 Under-paid

const PAYMENT_TYPE = Object.freeze({ MONTHLY: 1, INSTALLMENT: 2, FULL: 3 });
const STATUS = Object.freeze({ PENDING: 0, APPROVED: 1, REJECTED: 2, POST_PAY: 4, TRASH: 5 });
const DAY_MS = 24 * 60 * 60 * 1000;

const norm = (s) => String(s || '').trim().toLowerCase();
const toDate = (d) => (d ? new Date(d) : null);

/**
 * Payment.subjects is a JSON array of course ids, or (old data) course names/codes.
 * @returns {{ ids: number[], strings: string[] }}
 */
function parseSubjects(subjects) {
    if (!subjects) return { ids: [], strings: [] };
    let raw;
    try {
        raw = typeof subjects === 'string' ? JSON.parse(subjects) : subjects;
    } catch (e) {
        return { ids: [], strings: [] };
    }
    if (!Array.isArray(raw)) return { ids: [], strings: [] };
    const ids = [];
    const strings = [];
    for (const item of raw) {
        const n = parseInt(item, 10);
        if (!isNaN(n) && n > 0 && String(item).trim() === String(n)) ids.push(n);
        else if (typeof item === 'string' && item.trim()) strings.push(norm(item));
    }
    return { ids, strings };
}

const coversWholeGroup = (payment) => {
    const { ids, strings } = parseSubjects(payment.subjects);
    return ids.length === 0 && strings.length === 0;
};

/** Course class type: 1 = theory, 2 = paper. */
const classTypeOf = (course) =>
    parseInt(course.courseType || (course.group && course.group.classType) || 1, 10);

const batchIdOf = (course) => course.batchId ?? (course.group && course.group.batchId) ?? null;

/**
 * Does this payment's status give access right now?
 * Post-pay only counts until valid_until — expired post-pay gives nothing,
 * whether or not an admin has opened the payments page.
 */
function statusGrantsAccess(payment, now) {
    if (payment.status === STATUS.APPROVED) return true;
    if (payment.status === STATUS.POST_PAY) {
        const until = toDate(payment.valid_until);
        return Boolean(until) && until > now;
    }
    return false;
}

/**
 * Batches where the student has an overdue installment.
 * Ported from the old getStudentOverdueInstallmentBatchIds so behaviour stays the same.
 *
 * @param {object[]} payments       all of the student's payments
 * @param {Map<number, object[]>} plansByBatchId installment plans per batch
 *        (each { subjectCount, details }, details = JSON array of phases with gapDays)
 * @param {Date} now
 * @returns {Set<number>}
 */
function computeOverdueBatchIds(payments, plansByBatchId, now) {
    const overdue = new Set();
    const inst = payments.filter((p) => p.payment_type === PAYMENT_TYPE.INSTALLMENT);

    // 1. A pending/rejected installment whose due date has passed.
    for (const p of inst) {
        const due = toDate(p.due_date);
        if ([STATUS.PENDING, STATUS.REJECTED].includes(p.status) && due && due < now && p.batchId) {
            overdue.add(p.batchId);
        }
    }

    // 2. An approved installment whose next phase is unpaid and its window has closed.
    const approved = inst.filter((p) => p.status === STATUS.APPROVED);
    for (const p of approved) {
        if (!p.batchId || overdue.has(p.batchId) || !p.subjects) continue;
        const subjectCount = parseSubjects(p.subjects).ids.length;
        const plan = (plansByBatchId.get(p.batchId) || [])
            .filter((pl) => pl.subjectCount <= subjectCount)
            .sort((a, b) => b.subjectCount - a.subjectCount)[0];
        if (!plan || !plan.details) continue;

        let phases;
        try {
            phases = JSON.parse(plan.details);
        } catch (e) {
            continue;
        }
        const step = p.installment_no || 1;
        if (step >= phases.length) continue; // last phase paid

        const nextPaid = approved.some((o) => o.batchId === p.batchId && (o.installment_no || 1) > step);
        if (nextPaid) continue;

        const nextPending = inst.find(
            (o) => o.batchId === p.batchId && o.installment_no === step + 1 &&
                [STATUS.PENDING, STATUS.REJECTED].includes(o.status)
        );
        if (nextPending && nextPending.due_date) {
            if (toDate(nextPending.due_date) < now) overdue.add(p.batchId);
            continue;
        }
        if (p.due_date) {
            if (toDate(p.due_date) < now) overdue.add(p.batchId);
            continue;
        }
        const gapDays = parseInt((phases[step - 1] && phases[step - 1].gapDays) || '30', 10);
        const base = toDate(p.updatedAt || p.created_at);
        if (base && base.getTime() + gapDays * DAY_MS < now.getTime()) overdue.add(p.batchId);
    }
    return overdue;
}

/**
 * Payments that give access right now.
 * An installment in an overdue batch gives nothing, unless the student also has an
 * approved monthly/full payment for that batch.
 */
function activePayments(payments, overdueBatchIds, now) {
    const granting = payments.filter((p) => statusGrantsAccess(p, now));
    return granting.filter((p) => {
        if (p.payment_type !== PAYMENT_TYPE.INSTALLMENT || !overdueBatchIds.has(p.batchId)) return true;
        return granting.some(
            (o) => o.id !== p.id && o.batchId === p.batchId && o.status === STATUS.APPROVED &&
                [PAYMENT_TYPE.MONTHLY, PAYMENT_TYPE.FULL].includes(o.payment_type)
        );
    });
}

/**
 * Same subject? Duplicate course rows exist in the DB, so match by name, and by code
 * too when both sides have a code. Class type (theory/paper) must match.
 */
function sameSubject(a, b) {
    if (classTypeOf(a) !== classTypeOf(b)) return false;
    const nameMatch = norm(a.name) && norm(a.name) === norm(b.name);
    if (a.code && b.code) return nameMatch && norm(a.code) === norm(b.code);
    return nameMatch;
}

/**
 * Looser match used for full/installment payments across a batch (ported from the
 * old getCourseModules): same name, or same code with the same first word of the name.
 */
function sameSubjectInBatch(a, b) {
    if (classTypeOf(a) !== classTypeOf(b)) return false;
    if (norm(a.name) && norm(a.name) === norm(b.name)) return true;
    const firstWord = (s) => norm(s).split(/[\s-]+/)[0];
    return Boolean(a.code && b.code && norm(a.code) === norm(b.code) && firstWord(a.name) === firstWord(b.name));
}

/**
 * Courses of a monthly payment that really belong to the paid month: the ones whose own
 * group is the payment's group, if there are any; otherwise all (re-used rows only).
 */
function thisMonthCourses(payment, paidCourses) {
    const own = paidCourses.filter((pc) => pc.groupId === payment.groupId);
    return own.length ? own : paidCourses;
}

/**
 * Does one payment cover this course? Returns a reason string, or null.
 *
 * @param {object} payment
 * @param {object} course  { id, name, code, groupId, courseType, group: { batchId, classType } }
 * @param {Map<number, object>} paidCourseById  courses referenced by payment subject ids
 */
function paymentCoversCourse(payment, course, paidCourseById) {
    const { ids, strings } = parseSubjects(payment.subjects);
    const paidCourses = ids.map((id) => paidCourseById.get(id)).filter(Boolean);
    const matchesStrings = strings.includes(norm(course.name)) || (course.code && strings.includes(norm(course.code)));

    if (payment.payment_type === PAYMENT_TYPE.MONTHLY) {
        // Monthly = one month (group). Never leaks into other months.
        if (payment.groupId !== course.groupId) return null;
        if (coversWholeGroup(payment)) return 'monthly:whole-group';
        if (ids.includes(course.id)) return 'monthly:subject';
        if (matchesStrings) return 'monthly:subject-name';
        if (paidCourses.some((pc) => pc.groupId === course.groupId && sameSubject(pc, course))) {
            return 'monthly:duplicate-course';
        }
        // The payment IS for this month (same group). Course rows are re-used across months
        // (course 545 made in August is priced in the September/October groups), so the paid
        // course's own groupId can be another month. Same subject + same class type is enough.
        // BUT the mobile app also sends the student's OLD months' course ids with a new payment
        // (paid Rs.8000 = Nov Media+Sinhala+Geo, list also had Sept Political). When the payment
        // has courses of its own month, only those count.
        if (thisMonthCourses(payment, paidCourses).some((pc) => batchIdOf(pc) === batchIdOf(course) && sameSubjectInBatch(pc, course))) {
            return 'monthly:same-subject-this-month';
        }
        return null;
    }

    // Full / installment = the paid subjects across the whole batch, same class type.
    if (!payment.batchId || payment.batchId !== batchIdOf(course)) return null;
    if (coversWholeGroup(payment)) {
        return payment.groupId === course.groupId ? 'full:whole-group' : null;
    }
    if (ids.includes(course.id)) return 'full:subject';
    if (matchesStrings && payment.groupId === course.groupId) return 'full:subject-name';
    if (paidCourses.some((pc) => batchIdOf(pc) === batchIdOf(course) && sameSubjectInBatch(pc, course))) {
        return 'full:same-subject-in-batch';
    }
    return null;
}

/**
 * Explain whether a student can access a course.
 * @returns {{ allowed: boolean, reason: string, paymentId: number|null }}
 */
function explainCourseAccess(course, payments, paidCourseById, overdueBatchIds, now) {
    const active = activePayments(payments, overdueBatchIds, now);
    for (const p of active) {
        const reason = paymentCoversCourse(p, course, paidCourseById);
        if (reason) return { allowed: true, reason, paymentId: p.id };
    }

    // Explain the denial so support staff can answer "why can't this student see X?"
    const batchId = batchIdOf(course);
    const related = payments.filter((p) => p.batchId === batchId);
    if (related.length === 0) return { allowed: false, reason: 'no-payment-for-batch', paymentId: null };
    if (overdueBatchIds.has(batchId) && related.some((p) => p.payment_type === PAYMENT_TYPE.INSTALLMENT)) {
        return { allowed: false, reason: 'installment-overdue', paymentId: null };
    }
    const expiredPostPay = related.find((p) => p.status === STATUS.POST_PAY && !statusGrantsAccess(p, now));
    if (expiredPostPay) return { allowed: false, reason: 'post-pay-expired', paymentId: expiredPostPay.id };
    const pending = related.find((p) => p.status === STATUS.PENDING);
    if (pending) return { allowed: false, reason: 'payment-pending-approval', paymentId: pending.id };
    return { allowed: false, reason: 'subject-or-month-not-paid', paymentId: null };
}

/** Course ids (from a candidate list) that the student can access. */
function accessibleCourseIds(candidateCourses, payments, paidCourseById, overdueBatchIds, now) {
    const active = activePayments(payments, overdueBatchIds, now);
    if (active.length === 0) return [];
    return candidateCourses
        .filter((c) => active.some((p) => paymentCoversCourse(p, c, paidCourseById)))
        .map((c) => c.id);
}

module.exports = {
    thisMonthCourses,
    PAYMENT_TYPE,
    STATUS,
    parseSubjects,
    statusGrantsAccess,
    computeOverdueBatchIds,
    activePayments,
    paymentCoversCourse,
    explainCourseAccess,
    accessibleCourseIds,
    classTypeOf,
};
