// Entitlement service: loads data, applies rules.js. Other modules (and the old
// controllers) call these functions instead of writing their own access checks.

const rules = require('./rules');

// Loaded on first use, so unit tests with a fake repo never need a database client.
const defaultRepo = new Proxy({}, { get: (_, name) => require('./repository')[name] });

/**
 * @param {object} [repo] injectable for tests; defaults to the Prisma repository
 */
function createEntitlementService(repo = defaultRepo) {
    /** Everything the rules need about one student, loaded once. */
    async function loadStudentContext(studentId, now = new Date()) {
        const payments = await repo.findStudentPayments(studentId);
        const plans = await repo.findInstallmentPlans(
            payments.filter((p) => p.payment_type === rules.PAYMENT_TYPE.INSTALLMENT).map((p) => p.batchId)
        );
        const overdueBatchIds = rules.computeOverdueBatchIds(payments, plans, now);

        const paidIds = new Set();
        for (const p of payments) rules.parseSubjects(p.subjects).ids.forEach((id) => paidIds.add(id));
        const paidCourses = await repo.findCoursesByIds([...paidIds]);
        const paidCourseById = new Map(paidCourses.map((c) => [c.id, c]));

        return { payments, overdueBatchIds, paidCourseById, now };
    }

    /** Why can / can't this student open this course? */
    async function explainCourseAccess(studentId, courseId) {
        const course = await repo.findCourse(courseId);
        if (!course) return { allowed: false, reason: 'course-not-found', paymentId: null };
        const ctx = await loadStudentContext(studentId);
        return rules.explainCourseAccess(course, ctx.payments, ctx.paidCourseById, ctx.overdueBatchIds, ctx.now);
    }

    async function canAccessCourse(studentId, courseId) {
        return (await explainCourseAccess(studentId, courseId)).allowed;
    }

    /** Can this student open this content item (recording, live link, document)? */
    async function canAccessContent(studentId, contentId) {
        const content = await repo.findContentWithCourseIds(contentId);
        if (!content) return { allowed: false, reason: 'content-not-found' };
        if (content.isFree) return { allowed: true, reason: 'free-content' };
        if (content.courseIds.length === 0) return { allowed: false, reason: 'content-not-linked' };

        const [ctx, courses] = await Promise.all([
            loadStudentContext(studentId),
            repo.findCoursesByIds(content.courseIds),
        ]);
        for (const course of courses) {
            const r = rules.explainCourseAccess(course, ctx.payments, ctx.paidCourseById, ctx.overdueBatchIds, ctx.now);
            if (r.allowed) return r;
        }
        return { allowed: false, reason: 'not-enrolled-in-content-course' };
    }

    /** Every course id the student can open right now. */
    async function listAccessibleCourseIds(studentId) {
        const ctx = await loadStudentContext(studentId);
        const active = rules.activePayments(ctx.payments, ctx.overdueBatchIds, ctx.now);
        const candidates = await repo.findCoursesInBatches(active.map((p) => p.batchId));
        return rules.accessibleCourseIds(candidates, ctx.payments, ctx.paidCourseById, ctx.overdueBatchIds, ctx.now);
    }

    return { explainCourseAccess, canAccessCourse, canAccessContent, listAccessibleCourseIds };
}

module.exports = { createEntitlementService, ...createEntitlementService() };
