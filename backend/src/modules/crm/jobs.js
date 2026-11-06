// CRM background jobs (worker process only — see src/core/jobs.js).
const jobs = require('../../core/jobs');

// 01:30 UTC = 07:00 Sri Lanka, before the call center starts.
jobs.schedule('crm-enrollment-reconcile-daily', '30 1 * * *', () => require('./service').dailyReconcile());
