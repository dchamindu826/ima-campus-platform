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
 * Business rule: Free Card and Discount approvals are NEVER auto-delivered.
 * Staff send those with the "Send to Delivery" button (paymentController SendToDelivery).
 * Markers come from the admin UI (PaymentManagement.jsx):
 *   Free Card → amount 0, remark "[Free Card Granted] ..."
 *   Discount  → remark "Custom Breakdown: [...]"
 * @returns {'free-card'|'discount'|null}
 */
function manualOnlyReason(payment) {
    const remark = String((payment && payment.remark) || '');
    if (Number(payment && payment.amount) === 0 || /Free Card/i.test(remark)) return 'free-card';
    if (/Custom Breakdown/i.test(remark)) return 'discount';
    return null;
}

/** Should reconciliation auto-create this missing delivery? Only normal approved payments. */
function autoFixable(payment) {
    return Number(payment.status) === 1 && Number(payment.amount) > 0 && manualOnlyReason(payment) === null;
}

module.exports = { NOT_SHIPPED, orphanReason, manualOnlyReason, autoFixable };
