// Entitlement data access. The only file in this module that talks to Prisma.

const prisma = require('../../core/db');

const COURSE_SELECT = {
    id: true, name: true, code: true, groupId: true, courseType: true,
    group: { select: { batchId: true, classType: true } },
};

/** All of a student's payments (every status — rules decide what counts). */
function findStudentPayments(studentId) {
    return prisma.payment.findMany({
        where: { studentId: Number(studentId) },
        select: {
            id: true, payment_type: true, status: true, valid_until: true, due_date: true,
            installment_no: true, batchId: true, groupId: true, subjects: true,
            created_at: true, updatedAt: true,
        },
    });
}

/** Installment plans for the given batches, grouped by batchId. */
async function findInstallmentPlans(batchIds) {
    const ids = [...new Set(batchIds.filter(Boolean))];
    const map = new Map();
    if (ids.length === 0) return map;
    const plans = await prisma.installment.findMany({
        where: { batchId: { in: ids } },
        select: { batchId: true, subjectCount: true, details: true },
    });
    for (const p of plans) {
        if (!map.has(p.batchId)) map.set(p.batchId, []);
        map.get(p.batchId).push(p);
    }
    return map;
}

function findCourse(courseId) {
    return prisma.course.findUnique({ where: { id: Number(courseId) }, select: COURSE_SELECT });
}

function findCoursesByIds(ids) {
    if (ids.length === 0) return Promise.resolve([]);
    return prisma.course.findMany({ where: { id: { in: ids.map(Number) } }, select: COURSE_SELECT });
}

function findCoursesInBatches(batchIds) {
    const ids = [...new Set(batchIds.filter(Boolean))];
    if (ids.length === 0) return Promise.resolve([]);
    return prisma.course.findMany({ where: { group: { batchId: { in: ids } } }, select: COURSE_SELECT });
}

/** Content + every course it is linked to (Content.courseId and ContentCourse rows). */
async function findContentWithCourseIds(contentId) {
    const content = await prisma.content.findUnique({
        where: { id: Number(contentId) },
        select: { id: true, isFree: true, courseId: true, batchId: true },
    });
    if (!content) return null;
    const links = await prisma.contentCourse.findMany({
        where: { content_id: content.id },
        select: { course_id: true },
    });
    const courseIds = new Set(links.map((l) => Number(l.course_id)));
    if (content.courseId) courseIds.add(Number(content.courseId));
    return { ...content, courseIds: [...courseIds] };
}

module.exports = {
    findStudentPayments,
    findInstallmentPlans,
    findCourse,
    findCoursesByIds,
    findCoursesInBatches,
    findContentWithCourseIds,
};
