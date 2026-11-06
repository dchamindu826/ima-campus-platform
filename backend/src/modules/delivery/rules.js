// Delivery reconciliation rules — pure, tested in rules.test.js.

// Not shipped yet: can still be stopped.
const NOT_SHIPPED = ['Pending', 'Hold', 'Packed'];
// Payment no longer valid.
const DEAD_PAYMENT = { 2: 'payment-rejected', 5: 'payment-trashed' };

/** A delivery that should not go out, or null. */
function orphanReason(delivery, payment) {
    if (!delivery || !payment) return null;
    if (!NOT_SHIPPED.includes(delivery.status)) return null;
    return DEAD_PAYMENT[Number(payment.status)] || null;
}

/**
 * Should reconciliation auto-create this missing delivery?
 * Free cards (amount 0) are skipped: staff send those to delivery by hand.
 */
function autoFixable(payment) {
    return Number(payment.status) === 1 && Number(payment.amount) > 0;
}

module.exports = { NOT_SHIPPED, orphanReason, autoFixable };
