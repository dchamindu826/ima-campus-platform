// In-process event bus so modules don't call each other's internals.
//
//   events.emit('payment.approved', { paymentId, studentId });   // payments module
//   events.on('payment.approved', async (e) => { ... });          // delivery / crm modules
//
// Listener errors are logged and never crash the emitter or the server.

const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(50);

function on(eventName, handler) {
    bus.on(eventName, (payload) => {
        Promise.resolve()
            .then(() => handler(payload))
            .catch((err) => console.error(`[events] listener for "${eventName}" failed:`, err));
    });
}

function emit(eventName, payload) {
    bus.emit(eventName, payload);
}

module.exports = { on, emit };
