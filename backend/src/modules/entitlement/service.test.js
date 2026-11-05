// Service wiring tests with an in-memory repository (no database needed).

const test = require('node:test');
const assert = require('node:assert/strict');
const { createEntitlementService } = require('./service');

const course = (id, name, groupId, batchId = 10) => ({
    id, name, code: null, groupId, courseType: 1, group: { batchId, classType: 1 },
});
const COURSES = [course(1, 'ICT', 101), course(2, 'ICT', 102), course(3, 'ET', 102)];

function fakeRepo({ payments = [], contents = [] }) {
    const byId = new Map(COURSES.map((c) => [c.id, c]));
    return {
        findStudentPayments: async (sid) => payments.filter((p) => p.studentId === sid),
        findInstallmentPlans: async () => new Map(),
        findCourse: async (id) => byId.get(Number(id)) || null,
        findCoursesByIds: async (ids) => ids.map((id) => byId.get(Number(id))).filter(Boolean),
        findCoursesInBatches: async (bids) => COURSES.filter((c) => bids.includes(c.group.batchId)),
        findContentWithCourseIds: async (id) => contents.find((c) => c.id === Number(id)) || null,
    };
}

const approvedOct = { id: 1, studentId: 7, batchId: 10, groupId: 102, payment_type: 1, status: 1, subjects: '[2]' };

test('listAccessibleCourseIds uses only the student\'s own payments', async () => {
    const svc = createEntitlementService(fakeRepo({ payments: [approvedOct] }));
    assert.deepEqual(await svc.listAccessibleCourseIds(7), [2]);
    assert.deepEqual(await svc.listAccessibleCourseIds(8), []);
});

test('explainCourseAccess for a missing course', async () => {
    const svc = createEntitlementService(fakeRepo({}));
    assert.equal((await svc.explainCourseAccess(7, 999)).reason, 'course-not-found');
});

test('canAccessContent: free content is open, unlinked content is closed', async () => {
    const svc = createEntitlementService(fakeRepo({
        contents: [
            { id: 50, isFree: true, courseIds: [] },
            { id: 51, isFree: false, courseIds: [] },
        ],
    }));
    assert.equal((await svc.canAccessContent(7, 50)).allowed, true);
    assert.equal((await svc.canAccessContent(7, 51)).reason, 'content-not-linked');
    assert.equal((await svc.canAccessContent(7, 52)).reason, 'content-not-found');
});

test('report: "download-rec" — recording opens only for students enrolled in one of its courses', async () => {
    const svc = createEntitlementService(fakeRepo({
        payments: [approvedOct],
        contents: [
            { id: 60, isFree: false, courseIds: [2] }, // October ICT
            { id: 61, isFree: false, courseIds: [1] }, // September ICT
            { id: 62, isFree: false, courseIds: [1, 2] }, // linked to both months
        ],
    }));
    assert.equal((await svc.canAccessContent(7, 60)).allowed, true);
    assert.equal((await svc.canAccessContent(7, 61)).allowed, false);
    assert.equal((await svc.canAccessContent(7, 62)).allowed, true);
    assert.equal((await svc.canAccessContent(8, 60)).allowed, false, 'other student');
});
