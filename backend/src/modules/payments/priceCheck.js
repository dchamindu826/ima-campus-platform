// Server-side price check for enrollments (step 2b).
//
// SHADOW mode by default: never changes a payment, only logs
//   [pricing:shadow] student=.. claimed=.. expected=.. (underpriced) ...
// With PRICING_ENFORCE=true, an underpriced ONLINE payment is not auto-approved
// (it stays pending for staff), and every underpriced payment gets a remark note.

const pricing = require('./pricing');

const enforcing = () => String(process.env.PRICING_ENFORCE || '').toLowerCase() === 'true';

const parseIds = (subjects) => {
    let raw = subjects;
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (e) { raw = []; } }
    return (Array.isArray(raw) ? raw : []).map((x) => parseInt(x, 10)).filter((n) => !isNaN(n) && n > 0);
};

/**
 * @param {object} p { studentId, body, userAgent }
 * @returns {Promise<{ supported: boolean, ok: boolean, expected?: number, claimed: number, reason?: string }>}
 */
async function checkEnrollmentPrice({ studentId, body, userAgent }, db = require('../../core/db')) {
    const claimed = parseFloat(body.amount) || 0;
    const result = (r) => {
        const out = { claimed, ...r };
        const client = /okhttp|expo|reactnative|darwin|cfnetwork/i.test(userAgent || '') ? 'app' : 'web';
        if (!out.supported) {
            console.log(`[pricing:${enforcing() ? 'enforce' : 'shadow'}] skipped student=${studentId} client=${client} reason=${out.reason}`);
        } else if (!out.ok) {
            console.warn(`[pricing:${enforcing() ? 'enforce' : 'shadow'}] UNDERPRICED student=${studentId} client=${client} plan=${body.paymentMethodChosen} group=${body.groupId} subjects=${body.subjects} claimed=${claimed} expected=${out.expected}`);
        } else if (Math.abs(claimed - out.expected) > 1) {
            console.log(`[pricing:${enforcing() ? 'enforce' : 'shadow'}] overpriced student=${studentId} client=${client} claimed=${claimed} expected=${out.expected}`);
        }
        return out;
    };

    try {
        if (body.upgrades) return result({ supported: false, ok: true, reason: 'multi-upgrade-flow' });
        if (String(body.remark || '').includes('[UPGRADE]')) return result({ supported: false, ok: true, reason: 'monthly-to-full-upgrade' });

        const plan = String(body.paymentMethodChosen || '').toLowerCase().trim();
        const ids = parseIds(body.subjects);
        const groupId = parseInt(body.groupId, 10);
        if (ids.length === 0 || isNaN(groupId)) return result({ supported: false, ok: true, reason: 'missing-subjects-or-group' });

        const [courses, group, user, plans] = await Promise.all([
            db.course.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, price: true, groupId: true, groupPrices: true, isDiscountExcluded: true } }),
            db.group.findUnique({ where: { id: groupId }, select: { discount_rules: true } }),
            db.user.findUnique({ where: { id: parseInt(studentId, 10) }, select: { walletBalance: true } }),
            plan === 'installment' && body.batchId
                ? db.installment.findMany({ where: { batchId: parseInt(body.batchId, 10) }, select: { subjectCount: true, details: true } })
                : Promise.resolve([]),
        ]);
        if (courses.length !== ids.length) return result({ supported: false, ok: true, reason: 'unknown-course-id' });

        const r = pricing.expectedEnrollmentAmount({
            courses, groupId, discountRules: group && group.discount_rules, plan,
            installmentPlans: plans, walletBalance: user ? user.walletBalance : 0,
        });
        if (!r.supported) return result({ supported: false, ok: true, reason: r.reason });
        return result({ supported: true, ok: !pricing.isUnderpriced(claimed, r.expected), expected: r.expected });
    } catch (err) {
        // A bug in the price check must never break enrollment.
        console.error('[pricing] check failed, allowing:', err);
        return { supported: false, ok: true, claimed, reason: 'check-error' };
    }
}

module.exports = { checkEnrollmentPrice, enforcing };
