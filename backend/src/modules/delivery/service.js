// Delivery reconciliation: finds what the one-shot "create delivery on approve"
// missed, and deliveries whose payment was later rejected/trashed.
//
//   missing — approved payment, tutes configured, no delivery
//             ("approve wela delivery hub eke na")
//   orphans — delivery not shipped yet, payment rejected/trashed

const rules = require('./rules');

const db = () => require('../../core/db');
const paymentCtl = () => require('../../../controllers/paymentController');

const MAX_SCAN = 1000;

/** @returns {Promise<{ missing: object[], scanned: number, truncated: boolean }>} */
async function findMissingDeliveries({ days = 90 } = {}) {
    const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
    const candidates = await db().payment.findMany({
        where: { status: 1, created_at: { gte: since }, subjects: { not: null }, delivery: { is: null } },
        select: { id: true, studentId: true, businessId: true, batchId: true, groupId: true, subjects: true, payment_type: true, amount: true, status: true, created_at: true, method: true },
        orderBy: { created_at: 'desc' },
        take: MAX_SCAN,
    });

    const missing = [];
    for (const p of candidates) {
        let plan = null;
        try {
            plan = await paymentCtl().createAutoDeliveryForPayment(p, false, { dryRun: true });
        } catch (err) {
            console.error(`[delivery:reconcile] dry run failed for payment ${p.id}:`, err);
        }
        if (plan && Array.isArray(plan.plannedItems) && plan.plannedItems.length > 0) {
            missing.push({
                paymentId: p.id, studentId: p.studentId, businessId: p.businessId, batchId: p.batchId, groupId: p.groupId,
                paymentType: plan.paymentType, amount: p.amount, method: p.method, approvedAt: p.created_at,
                autoFixable: rules.autoFixable(p),
                tutes: plan.plannedItems.map((i) => i.tuteName),
            });
        }
    }
    return { missing, scanned: candidates.length, truncated: candidates.length === MAX_SCAN };
}

async function findOrphanDeliveries() {
    const rows = await db().delivery.findMany({
        where: { status: { in: rules.NOT_SHIPPED }, payment: { status: { in: [2, 5] } } },
        select: { id: true, status: true, studentId: true, paymentId: true, createdAt: true, payment: { select: { status: true, amount: true } } },
        take: MAX_SCAN,
    });
    return rows
        .map((d) => ({ deliveryId: d.id, deliveryStatus: d.status, studentId: d.studentId, paymentId: d.paymentId, createdAt: d.createdAt, reason: rules.orphanReason(d, d.payment) }))
        .filter((d) => d.reason);
}

/** Create the missing delivery for one payment (same dedupe rules as approve). */
async function createMissingDelivery(paymentId) {
    const p = await db().payment.findUnique({ where: { id: Number(paymentId) } });
    if (!p) return { created: false, reason: 'payment-not-found' };
    if (p.status !== 1) return { created: false, reason: 'payment-not-approved' };
    const existing = await db().delivery.findFirst({ where: { paymentId: p.id, status: { notIn: ['Trash', 'Cancelled', 'Rejected'] } } });
    if (existing) return { created: false, reason: 'already-exists', deliveryId: existing.id };
    const d = await paymentCtl().createAutoDeliveryForPayment(p);
    if (!d) return { created: false, reason: 'nothing-to-deliver' };
    return { created: true, deliveryId: d.id };
}

/** Daily job: report, and (only with DELIVERY_AUTOFIX=true) create the missing ones. */
async function dailyReconcile() {
    const autofix = String(process.env.DELIVERY_AUTOFIX || '').toLowerCase() === 'true';
    const { missing, scanned, truncated } = await findMissingDeliveries({ days: 90 });
    const orphans = await findOrphanDeliveries();
    let fixed = 0;
    if (autofix) {
        for (const m of missing.filter((x) => x.autoFixable)) {
            const r = await createMissingDelivery(m.paymentId);
            if (r.created) fixed++;
        }
    }
    console.log(`[delivery:reconcile] scanned=${scanned}${truncated ? '+' : ''} missing=${missing.length} orphans=${orphans.length} autofix=${autofix} created=${fixed}`);
    for (const m of missing.slice(0, 20)) console.log(`[delivery:reconcile] missing payment=${m.paymentId} student=${m.studentId} tutes=${JSON.stringify(m.tutes)}`);
    for (const o of orphans.slice(0, 20)) console.log(`[delivery:reconcile] orphan delivery=${o.deliveryId} (${o.deliveryStatus}) payment=${o.paymentId} ${o.reason}`);
    return { missing: missing.length, orphans: orphans.length, created: fixed };
}

module.exports = { findMissingDeliveries, findOrphanDeliveries, createMissingDelivery, dailyReconcile };
