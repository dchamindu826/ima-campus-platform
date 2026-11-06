const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('./classTag');

const courses = new Map([
    [1, { id: 1, courseType: 1, groupId: 10 }],   // theory
    [2, { id: 2, courseType: 2, groupId: 10 }],   // paper by course type
    [3, { id: 3, courseType: 1, groupId: 20 }],   // paper by its group
]);
const groups = new Map([[10, 1], [20, 2], [30, 2]]);
const d = (ids, groupId = 10) => ({ items: ids.map((courseId) => ({ courseId })), payment: { groupId } });

test('theory only / paper only / both', () => {
    assert.equal(T.deliveryClassTag(d([1]), courses, groups), 'Theory');
    assert.equal(T.deliveryClassTag(d([2]), courses, groups), 'Paper');
    assert.equal(T.deliveryClassTag(d([3]), courses, groups), 'Paper');
    assert.equal(T.deliveryClassTag(d([1, 2]), courses, groups), 'Both');
});

test('paying from a paper-class month group makes it Paper', () => {
    assert.equal(T.deliveryClassTag(d([1], 30), courses, groups), 'Paper');
});

test('unknown course defaults to Theory, never crashes', () => {
    assert.equal(T.deliveryClassTag(d([999]), courses, groups), 'Theory');
    assert.equal(T.deliveryClassTag({}, courses, groups), 'Theory');
});

test('classTagger loads only what it needs', async () => {
    const prisma = {
        course: { findMany: async () => [{ id: 2, courseType: 2, groupId: 10 }] },
        group: { findMany: async () => [{ id: 10, classType: 1 }] },
    };
    const tag = await T.classTagger(prisma, [d([2])]);
    assert.equal(tag(d([2])), 'Paper');
});
