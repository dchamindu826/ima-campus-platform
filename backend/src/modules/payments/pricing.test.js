const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./pricing');

const c = (id, name, price, extra = {}) => ({ id, name, price, groupPrices: null, isDiscountExcluded: false, ...extra });
const ICT = c(1, 'ICT', 3000);
const ET = c(2, 'ET', 3000);
const SFT = c(3, 'SFT', 3000);
const ENG = c(4, 'English', 1500, { isDiscountExcluded: true });

test('no discount: sum of course prices', () => {
    assert.equal(P.coursesTotal([ICT, ET], 10, null).total, 6000);
});

test('groupPrices override the course price for that group only', () => {
    const ictGrp = c(1, 'ICT', 3000, { groupPrices: JSON.stringify([{ groupId: 10, price: 2500 }, { groupId: 11, price: 2800 }]) });
    assert.equal(P.coursePrice(ictGrp, 10), 2500);
    assert.equal(P.coursePrice(ictGrp, 11), 2800);
    assert.equal(P.coursePrice(ictGrp, 99), 3000);
});

test('pricePerCourse rule applies to non-excluded courses; excluded keep their price', () => {
    const rules = JSON.stringify([{ courseCount: 2, pricePerCourse: 2500 }]);
    assert.equal(P.coursesTotal([ICT, ET, ENG], 10, rules).total, 2500 + 2500 + 1500);
});

test('packagePrice rule: package + excluded courses', () => {
    const rules = [{ courseCount: 3, packagePrice: 8000 }];
    assert.equal(P.coursesTotal([ICT, ET, SFT, ENG], 10, rules).total, 8000 + 1500);
});

test('highest qualifying rule wins; excluded courses do not count towards it', () => {
    const rules = [{ courseCount: 2, pricePerCourse: 2800 }, { courseCount: 3, pricePerCourse: 2500 }];
    assert.equal(P.coursesTotal([ICT, ET, ENG], 10, rules).total, 2800 * 2 + 1500, 'only 2 eligible');
    assert.equal(P.coursesTotal([ICT, ET, SFT], 10, rules).total, 2500 * 3);
});

test('fixed discount, never below zero', () => {
    assert.equal(P.coursesTotal([ICT, ET], 10, [{ courseCount: 2, fixedDiscount: 1000 }]).total, 5000);
    assert.equal(P.coursesTotal([ICT], 10, [{ courseCount: 1, fixedDiscount: 99999 }]).total, 0);
});

test('duplicate course rows of the same subject are charged once', () => {
    assert.equal(P.coursesTotal([ICT, c(9, ' ict ', 3000)], 10, null).total, 3000);
});

test('installment: first phase of the best plan the student qualifies for', () => {
    const plans = [
        { subjectCount: 1, details: JSON.stringify([{ amount: 5000 }, { amount: 5000 }]) },
        { subjectCount: 3, details: JSON.stringify([{ amount: 12000 }, { amount: 12000 }]) },
    ];
    assert.equal(P.installmentFirstPhase(plans, 3), 12000);
    assert.equal(P.installmentFirstPhase(plans, 2), 5000);
    assert.equal(P.installmentFirstPhase(plans, 0), null);
    assert.equal(P.installmentFirstPhase([{ subjectCount: 1, details: '[{"price": 4000}]' }], 1), 4000);
});

test('wallet credit lowers, wallet due raises the amount (min 0)', () => {
    const base = { courses: [ICT, ET], groupId: 10, discountRules: null, plan: 'monthly' };
    assert.equal(P.expectedEnrollmentAmount({ ...base, walletBalance: 1000 }).expected, 5000);
    assert.equal(P.expectedEnrollmentAmount({ ...base, walletBalance: -500 }).expected, 6500);
    assert.equal(P.expectedEnrollmentAmount({ ...base, walletBalance: 99999 }).expected, 0);
});

test('unsupported cases are reported, not guessed', () => {
    assert.equal(P.expectedEnrollmentAmount({ courses: [], plan: 'monthly' }).supported, false);
    assert.equal(P.expectedEnrollmentAmount({ courses: [ICT], plan: 'installment', installmentPlans: [] }).reason, 'no-installment-plan');
    assert.equal(P.expectedEnrollmentAmount({ courses: [ICT], plan: 'weird' }).supported, false);
});

test('underpriced check allows Rs.1 rounding', () => {
    assert.equal(P.isUnderpriced(5999.5, 6000), false);
    assert.equal(P.isUnderpriced(10, 6000), true);
    assert.equal(P.isUnderpriced(6500, 6000), false);
});
