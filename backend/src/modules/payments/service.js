// Payments service: server-side record of online gateway payments, and safe
// status changes. Uses the existing AppSetting table (no schema change):
//   pg:<gateway>:<ref>          → { studentId, amount, verified, paidAmount, ... }
//   pg-used:<gateway>:<ref>     → paymentId that consumed it (unique key = used once)

const rules = require('./rules');

const db = () => require('../../core/db');
const recKey = (gateway, ref) => `pg:${gateway}:${String(ref).trim()}`;
const usedKey = (gateway, ref) => `pg-used:${gateway}:${String(ref).trim()}`;

async function readRecord(gateway, ref) {
    if (!gateway || !ref) return null;
    const row = await db().appSetting.findUnique({ where: { key: recKey(gateway, ref) } });
    if (!row) return null;
    try { return JSON.parse(row.value); } catch (e) { return null; }
}

async function writeRecord(gateway, ref, patch) {
    const key = recKey(gateway, ref);
    const current = (await readRecord(gateway, ref)) || {};
    const value = JSON.stringify({ ...current, ...patch, gateway, ref: String(ref).trim() });
    await db().appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

/** Called when the payment page is opened (hash / init). */
async function recordGatewayStart(gateway, ref, { studentId, amount }) {
    try {
        await writeRecord(gateway, ref, { studentId: Number(studentId) || null, amount: rules.toMoney(amount), startedAt: new Date().toISOString() });
    } catch (err) {
        console.error(`[payments] could not record ${gateway} start for ${ref}:`, err);
    }
}

/** Called only from server-to-server confirmation (PayHere notify, Paycorp complete). */
async function recordGatewayConfirmed(gateway, ref, { paidAmount, raw }) {
    await writeRecord(gateway, ref, { verified: true, paidAmount: rules.toMoney(paidAmount), confirmedAt: new Date().toISOString(), raw: raw || null });
}

/**
 * Enrollment / due payment asks: may this online payment be approved now?
 * If yes, the gateway payment is consumed so it can never approve a second payment.
 * @returns {Promise<{ approve: boolean, reason: string }>}
 */
async function claimOnlinePayment(method, ref, { studentId, amount }) {
    const gateway = rules.normGateway(method);
    if (!gateway) return { approve: false, reason: 'not-online' };
    if (!ref) return { approve: false, reason: 'no-reference' };

    const decision = rules.decideOnlineApproval(await readRecord(gateway, ref), { studentId, amount });
    if (!decision.approve) return decision;

    try {
        await db().appSetting.create({ data: { key: usedKey(gateway, ref), value: JSON.stringify({ studentId, at: new Date().toISOString() }) } });
    } catch (err) {
        if (err.code === 'P2002') return { approve: false, reason: 'gateway-payment-already-used' };
        throw err;
    }
    return decision;
}

/**
 * Atomically change a payment's status, but only if nobody changed it meanwhile.
 * Returns false if the payment was already changed (double click / two staff).
 */
async function changeStatusIfUnchanged(tx, paymentId, expectedStatus, data) {
    const r = await tx.payment.updateMany({ where: { id: Number(paymentId), status: Number(expectedStatus) }, data });
    return r.count === 1;
}

/**
 * Late PayHere confirmation: approve the pending payments created for this order.
 * @param {(payment) => Promise<void>} afterApprove side effects (delivery, CRM sync)
 * @returns {Promise<number>} how many payments were approved
 */
async function approvePendingForOrder(gateway, ref, afterApprove) {
    const record = await readRecord(gateway, ref);
    const pending = await db().payment.findMany({
        where: { status: rules.STATUS.PENDING, remark: { contains: rules.onlineMarker(gateway, ref) } },
    });
    if (pending.length === 0) return 0;

    const studentId = pending[0].studentId;
    const total = pending.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const decision = rules.decideOnlineApproval(record, { studentId, amount: total });
    if (!decision.approve) {
        console.warn(`[payments] ${gateway} ${ref}: pending payments not approved (${decision.reason})`);
        return 0;
    }
    try {
        await db().appSetting.create({ data: { key: usedKey(gateway, ref), value: JSON.stringify({ studentId, at: new Date().toISOString() }) } });
    } catch (err) {
        if (err.code === 'P2002') return 0; // already used by the enrollment itself
        throw err;
    }

    let approved = 0;
    for (const p of pending) {
        const ok = await changeStatusIfUnchanged(db(), p.id, rules.STATUS.PENDING, { status: 1 });
        if (!ok) continue;
        approved++;
        try {
            await afterApprove({ ...p, status: 1 });
        } catch (err) {
            console.error(`[payments] after-approve failed for payment ${p.id}:`, err);
        }
    }
    console.log(`[payments] ${gateway} ${ref}: approved ${approved} pending payment(s) after gateway confirmation`);
    return approved;
}

module.exports = {
    readRecord,
    recordGatewayStart,
    recordGatewayConfirmed,
    claimOnlinePayment,
    changeStatusIfUnchanged,
    approvePendingForOrder,
};
