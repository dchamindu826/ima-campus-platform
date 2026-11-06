// Theory / Paper tag for a delivery — so the delivery team can filter
// Pending / Hold / Dispatched by class type.
//
// Same rule finance uses (financeController): a course is a PAPER class when
// course.courseType === 2 or its group's classType === 2; otherwise THEORY.
// The payment's group (the month group the student paid for) also counts.
// A delivery with both kinds of tutes is "Both".

const PAPER = 2;

/** 'Paper' | 'Theory' for one course. */
function courseClassType(course, groupClassById = new Map(), paymentGroupClassType = null) {
    if (course && Number(course.courseType) === PAPER) return 'Paper';
    if (course && course.groupId && Number(groupClassById.get(Number(course.groupId))) === PAPER) return 'Paper';
    if (Number(paymentGroupClassType) === PAPER) return 'Paper';
    return 'Theory';
}

/** 'Theory' | 'Paper' | 'Both' for a delivery { items:[{courseId}], payment:{groupId} }. */
function deliveryClassTag(delivery, courseById = new Map(), groupClassById = new Map()) {
    const payGroup = delivery && delivery.payment ? groupClassById.get(Number(delivery.payment.groupId)) : null;
    const kinds = new Set();
    for (const item of (delivery && delivery.items) || []) {
        kinds.add(courseClassType(courseById.get(Number(item.courseId)), groupClassById, payGroup));
    }
    if (kinds.size === 0) kinds.add(courseClassType(null, groupClassById, payGroup));
    return kinds.size > 1 ? 'Both' : [...kinds][0];
}

/**
 * Loads what is needed (course types, group classTypes) and returns tag(delivery).
 * @param {object} prisma
 * @param {object[]} deliveries raw deliveries with items and payment.groupId
 */
async function classTagger(prisma, deliveries) {
    const courseIds = [...new Set(deliveries.flatMap((d) => (d.items || []).map((i) => Number(i.courseId))).filter(Boolean))];
    const courses = courseIds.length
        ? await prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, courseType: true, groupId: true } })
        : [];
    const groupIds = [...new Set([
        ...courses.map((c) => Number(c.groupId)),
        ...deliveries.map((d) => Number(d.payment && d.payment.groupId)),
    ].filter(Boolean))];
    const groups = groupIds.length
        ? await prisma.group.findMany({ where: { id: { in: groupIds } }, select: { id: true, classType: true } })
        : [];
    const courseById = new Map(courses.map((c) => [c.id, c]));
    const groupClassById = new Map(groups.map((g) => [g.id, g.classType]));
    return (delivery) => deliveryClassTag(delivery, courseById, groupClassById);
}

module.exports = { courseClassType, deliveryClassTag, classTagger };
