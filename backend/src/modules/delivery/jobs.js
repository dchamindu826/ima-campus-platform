// Delivery background jobs (run only in the worker process — see src/core/jobs.js).
const jobs = require('../../core/jobs');

// 01:00 server time (UTC) = 06:30 Sri Lanka, before the delivery team starts.
jobs.schedule('delivery-reconcile-daily', '0 1 * * *', () => require('./service').dailyReconcile());
