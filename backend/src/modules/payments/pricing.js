// Enrollment price — pure functions, no database. Tested in pricing.test.js.
//
// Mirrors the WEB enrollment page (frontend/src/pages/student/components/EnrollmentTab.jsx:
// getActiveDiscount / calculateTotal / getBasePayable / getFinalPayable), which is the
// most complete version:
//   - a course's price for a group comes from course.groupPrices, else course.price
//   - the group's discount_rules: the rule with the highest courseCount the student
//     qualifies for (counting only courses NOT marked isDiscountExcluded) applies:
//       packagePrice → total = packagePrice + prices of excluded courses
//       pricePerCourse → each non-excluded course costs pricePerCourse
//       fixedDiscount → subtracted from the total (never below 0)
//   - installment: the first phase amount of the batch plan with the highest
//     subjectCount the student qualifies for
//   - wallet: total − walletBalance (excess credit lowers it, dues raise it), min 0
//
// NOTE: the mobile app currently ignores groupPrices and the wallet, so app prices
// can differ from web prices for the same selection. Shadow mode logs show where.

const num = (v) => {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
};
const present = (v) => v !== undefined && v !== null && v !== '';

const parseJson = (v, fallback) => {
    if (v === null || v === undefined || v === '') return fallback;
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch (e) { return fallback; }
};

/** A course's price in this group. */
function coursePrice(course, groupId) {
    const prices = parseJson(course.groupPrices, []);
    if (Array.isArray(prices)) {
        const g = prices.find((p) => parseInt(p.groupId, 10) === parseInt(groupId, 10));
        if (g) return num(g.price);
    }
    return num(course.price);
}

/** Same name = same subject (duplicate course rows exist); keep the first. */
function dedupeByName(courses) {
    const seen = new Set();
    return courses.filter((c) => {
        const key = String(c.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/** The discount rule that applies, or null. */
function activeDiscount(discountRules, eligibleCount) {
    const rules = parseJson(discountRules, []);
    if (!Array.isArray(rules) || rules.length === 0) return null;
    const sorted = [...rules].sort((a, b) => num(b.courseCount) - num(a.courseCount));
    for (const rule of sorted) {
        if (eligibleCount >= num(rule.courseCount)) {
            return {
                packagePrice: present(rule.packagePrice) ? num(rule.packagePrice) : null,
                pricePerCourse: present(rule.pricePerCourse) ? num(rule.pricePerCourse) : null,
                fixedDiscount: num(rule.fixedDiscount),
                courseCount: num(rule.courseCount),
            };
        }
    }
    return null;
}

/** Monthly / full price for the selected courses in a group (before wallet). */
function coursesTotal(courses, groupId, discountRules) {
    const selected = dedupeByName(courses);
    if (selected.length === 0) return { total: 0, discount: null };
    const eligible = selected.filter((c) => !c.isDiscountExcluded);
    const discount = activeDiscount(discountRules, eligible.length);

    let total = 0;
    if (discount && discount.packagePrice !== null) {
        total = discount.packagePrice + selected.filter((c) => c.isDiscountExcluded).reduce((s, c) => s + coursePrice(c, groupId), 0);
    } else {
        for (const c of selected) {
            total += discount && discount.pricePerCourse !== null && !c.isDiscountExcluded ? discount.pricePerCourse : coursePrice(c, groupId);
        }
        if (discount && discount.fixedDiscount > 0) total = Math.max(0, total - discount.fixedDiscount);
    }
    return { total, discount };
}

/** First phase of the installment plan the student qualifies for, or null. */
function installmentFirstPhase(plans, subjectCount) {
    const sorted = [...(plans || [])].sort((a, b) => num(b.subjectCount) - num(a.subjectCount));
    for (const plan of sorted) {
        if (subjectCount >= num(plan.subjectCount)) {
            const phases = parseJson(plan.details, []);
            const first = Array.isArray(phases) ? phases[0] : null;
            if (!first) return null;
            return num(present(first.amount) ? first.amount : first.price);
        }
    }
    return null;
}

/**
 * Expected amount the student should pay for this enrollment.
 * @param {object} p
 * @param {object[]} p.courses       selected courses { id, name, price, groupPrices, isDiscountExcluded }
 * @param {number} p.groupId         group the student enrolled from
 * @param {string|object[]} p.discountRules   that group's discount_rules
 * @param {'monthly'|'full'|'installment'} p.plan
 * @param {object[]} [p.installmentPlans]   batch installment plans
 * @param {number} [p.walletBalance]
 * @returns {{ supported: boolean, reason?: string, expected?: number, base?: number }}
 */
function expectedEnrollmentAmount({ courses, groupId, discountRules, plan, installmentPlans, walletBalance }) {
    if (!courses || courses.length === 0) return { supported: false, reason: 'no-courses' };
    let base;
    if (plan === 'installment') {
        base = installmentFirstPhase(installmentPlans, courses.length);
        if (base === null) return { supported: false, reason: 'no-installment-plan' };
    } else if (plan === 'monthly' || plan === 'full') {
        base = coursesTotal(courses, groupId, discountRules).total;
    } else {
        return { supported: false, reason: `unknown-plan:${plan}` };
    }
    const expected = Math.max(0, Math.round((base - num(walletBalance)) * 100) / 100);
    return { supported: true, expected, base };
}

/** Allow Rs.1 rounding difference. */
const isUnderpriced = (claimed, expected) => num(claimed) + 1 < num(expected);

module.exports = { coursePrice, dedupeByName, activeDiscount, coursesTotal, installmentFirstPhase, expectedEnrollmentAmount, isUnderpriced };
