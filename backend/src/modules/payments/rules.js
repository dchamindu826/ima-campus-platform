// Payment rules — pure functions, no database. Tested in rules.test.js.
//
// Status codes (see ARCHITECTURE.md):
//   0 Pending, 1 Approved, 2 Rejected, 4 Post-pay, 5 Trash, -2 Under-paid

const { STATUS } = require('../entitlement/rules');

const GRANTING_ACTIONS = ['Approve', 'Free Card', 'Discount'];

/**
 * Can staff run this action on a payment in this status?
 * Approving an already-approved payment is the bug that doubled wallet balances
 * and created duplicate deliveries/installments ("2 parak approve wela").
 * @returns {{ ok: boolean, code?: string, message?: string }}
 */
function checkStaffAction(currentStatus, action) {
    if (GRANTING_ACTIONS.includes(action) && Number(currentStatus) === STATUS.APPROVED) {
        return {
            ok: false,
            code: 'ALREADY_APPROVED',
            message: 'This payment is already approved. Refresh the list — someone may have approved it already.',
        };
    }
    return { ok: true };
}

const ONLINE_GATEWAYS = ['payhere', 'paycorp'];

const normGateway = (method) => {
    const m = String(method || '').trim().toLowerCase();
    return ONLINE_GATEWAYS.includes(m) ? m : null;
};

/** Tag written in Payment.remark so a late gateway confirmation can find the payment. */
const onlineMarker = (gateway, ref) => `[ONLINE:${gateway}:${String(ref).trim()}]`;

const toMoney = (v) => {
    const n = parseFloat(v);
    return isNaN(n) ? null : Math.round(n * 100) / 100;
};

/**
 * Should an online payment be approved right now?
 * Only a confirmation the SERVER received from the gateway counts — never the
 * browser/app saying "payment completed".
 *
 * @param {object|null} record  server-side gateway record { studentId, verified, paidAmount }
 * @param {{ studentId: number, amount: number }} claim  what the enrollment wants to approve
 * @returns {{ approve: boolean, reason: string }}
 */
function decideOnlineApproval(record, claim) {
    if (!record) return { approve: false, reason: 'no-gateway-record' };
    if (record.studentId && Number(record.studentId) !== Number(claim.studentId)) {
        return { approve: false, reason: 'other-student' };
    }
    if (!record.verified) return { approve: false, reason: 'not-confirmed-by-gateway-yet' };
    const paid = toMoney(record.paidAmount);
    const claimed = toMoney(claim.amount);
    if (paid === null || claimed === null) return { approve: false, reason: 'amount-unknown' };
    if (paid + 0.01 < claimed) return { approve: false, reason: 'underpaid' };
    return { approve: true, reason: 'gateway-confirmed' };
}

/** PayHere notify signature (md5sig) as documented by PayHere. */
function payhereSignature({ merchantId, orderId, amount, currency, statusCode, secret }) {
    const crypto = require('crypto');
    const md5 = (s) => crypto.createHash('md5').update(s).digest('hex').toUpperCase();
    return md5(`${merchantId}${orderId}${amount}${currency}${statusCode}${md5(secret)}`);
}

module.exports = {
    STATUS,
    GRANTING_ACTIONS,
    checkStaffAction,
    normGateway,
    onlineMarker,
    decideOnlineApproval,
    payhereSignature,
    toMoney,
};
