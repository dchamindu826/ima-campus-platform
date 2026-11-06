// Delivery reconciliation: finds what the one-shot "create delivery on approve"
// missed, and deliveries whose payment was later rejected/trashed.
//
//   missing — normal approved payment, tutes configured, no delivery
//             ("approve wela delivery hub eke na")
//   awaitingManual — Discount / Free Card approvals with no delivery yet. By business
//             rule these are sent by staff ("Send to Delivery"), never automatically,
//             so they are listed separately and never auto-created.
//   orphans — delivery not shipped yet, payment rejected/trashed

const rules = require('./rules');

const db = () => require('../../core/db');
const paymentCtl = () => require('../../../controllers/paymentController');

const MAX_SCAN = 1000;
const LIVE = { notIn: ['Trash', 'Cancelled', 'Rejected'] };

/** Tute names this student already has in any live delivery (any payment, any group). */
async function studentTuteHistory(studentId) {
    const ds = await db().delivery.findMany({ where: { studentId: String(studentId), status: LIVE }, include: { items: true } });
    return ds.flatMap((d) => (d.items || []).map((i) => i.tuteName)).filter(Boolean);
}

/** @returns {Promise<{ missing: object[], awaitingManual: object[], scanned: number, truncated: boolean }>} */
async function findMissingDeliveries({ days = 90 } = {}) {
    const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
    const candidates = await db().payment.findMany({
        where: { status: 1, created_at: { gte: since }, subjects: { not: null }, delivery: { is: null } },
        select: { id: true, studentId: true, businessId: true, batchId: true, groupId: true, subjects: true, payment_type: true, amount: true, status: true, created_at: true, method: true, remark: true },
        orderBy: { created_at: 'desc' },
        take: MAX_SCAN,
    });

    const missing = [];
    const awaitingManual = [];
    for (const p of candidates) {
        let plan = null;
        try {
            const skipTuteNames = await studentTuteHistory(p.studentId);
            plan = await paymentCtl().createAutoDeliveryForPayment(p, false, { dryRun: true, skipTuteNames });
        } catch (err) {
            console.error(`[delivery:reconcile] dry run failed for payment ${p.id}:`, err);
        }
        if (plan && Array.isArray(plan.plannedItems) && plan.plannedItems.length > 0) {
            const manual = rules.manualOnlyReason(p);
            (manual ? awaitingManual : missing).push({
                paymentId: p.id, studentId: p.studentId, businessId: p.businessId, batchId: p.batchId, groupId: p.groupId,
                paymentType: plan.paymentType, amount: p.amount, method: p.method, approvedAt: p.created_at,
                autoFixable: rules.autoFixable(p),
                ...(manual ? { kind: manual } : {}),
                tutes: plan.plannedItems.map((i) => i.tuteName),
            });
        }
    }
    return { missing, awaitingManual, scanned: candidates.length, truncated: candidates.length === MAX_SCAN };
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
    const manual = rules.manualOnlyReason(p);
    if (manual) return { created: false, reason: `manual-only:${manual}` }; // staff use "Send to Delivery"
    const existing = await db().delivery.findFirst({ where: { paymentId: p.id, status: LIVE } });
    if (existing) return { created: false, reason: 'already-exists', deliveryId: existing.id };
    // Only the tutes the student has not received through any other payment.
    const skipTuteNames = await studentTuteHistory(p.studentId);
    const plan = await paymentCtl().createAutoDeliveryForPayment(p, false, { dryRun: true, skipTuteNames });
    if (!plan || !Array.isArray(plan.plannedItems) || plan.plannedItems.length === 0) return { created: false, reason: 'already-delivered-elsewhere' };
    const d = await paymentCtl().createAutoDeliveryForPayment(p, false, { skipTuteNames });
    if (!d) return { created: false, reason: 'nothing-to-deliver' };
    return { created: true, deliveryId: d.id };
}

/** Daily job: report, and (only with DELIVERY_AUTOFIX=true) create the missing ones. */
async function dailyReconcile() {
    const autofix = String(process.env.DELIVERY_AUTOFIX || '').toLowerCase() === 'true';
    const { missing, awaitingManual, scanned, truncated } = await findMissingDeliveries({ days: 90 });
    const orphans = await findOrphanDeliveries();
    const windowDays = parseInt(process.env.DELIVERY_AUTOFIX_DAYS, 10) || 7;
    let fixed = 0;
    if (autofix) {
        // Usual cause: the tute was set in Content Hub AFTER the payment was approved.
        // Only recent normal approvals are created; Discount/Free Card never (autoFixable).
        for (const m of missing.filter((x) => x.autoFixable && rules.withinAutofixWindow(x.approvedAt, new Date(), windowDays))) {
            const r = await createMissingDelivery(m.paymentId);
            if (r.created) fixed++;
        }
    }
    console.log(`[delivery:reconcile] scanned=${scanned}${truncated ? '+' : ''} missing=${missing.length} awaitingManual=${awaitingManual.length} orphans=${orphans.length} autofix=${autofix}(${windowDays}d) created=${fixed}`);
    for (const m of missing.slice(0, 20)) console.log(`[delivery:reconcile] missing payment=${m.paymentId} student=${m.studentId} tutes=${JSON.stringify(m.tutes)}`);
    for (const o of orphans.slice(0, 20)) console.log(`[delivery:reconcile] orphan delivery=${o.deliveryId} (${o.deliveryStatus}) payment=${o.paymentId} ${o.reason}`);
    return { missing: missing.length, awaitingManual: awaitingManual.length, orphans: orphans.length, created: fixed };
}

module.exports = { studentTuteHistory, findMissingDeliveries, findOrphanDeliveries, createMissingDelivery, dailyReconcile };
