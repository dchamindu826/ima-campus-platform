// Background job registry + process roles (step 1.6).
//
// The same code base can run in three roles, chosen by the IMA_ROLE env var:
//   all     (default) — one process does everything, exactly like before
//   api     — serves HTTP + sockets only; background jobs are NOT started
//   worker  — runs background jobs only; does not open a port
//
// Why: heavy jobs (DB backup, AI slip verification, YouTube cookie generator,
// auto-assign) were running inside the same process that serves students and
// staff. A slow or crashing job slowed down or restarted the whole site.
//
// Every cron / repeating job must be registered through schedule() or every()
// so it runs in exactly one process. In-memory cache cleanups that belong to the
// API process (setInterval on a local Map) stay as plain setInterval.

const ROLES = ['all', 'api', 'worker'];

function role() {
    const r = String(process.env.IMA_ROLE || 'all').trim().toLowerCase();
    return ROLES.includes(r) ? r : 'all';
}

const jobsEnabled = () => role() !== 'api';
const serverEnabled = () => role() !== 'worker';

const registered = [];

const safeRun = (name, fn) => async () => {
    try {
        await fn();
    } catch (err) {
        console.error(`[job:${name}] failed:`, err);
    }
};

/** Register a cron job (node-cron expression). Skipped in the "api" role. */
function schedule(name, expression, fn) {
    registered.push({ name, kind: 'cron', when: expression, active: jobsEnabled() });
    if (!jobsEnabled()) return null;
    return require('node-cron').schedule(expression, safeRun(name, fn));
}

/** Register a repeating job every `ms` milliseconds. Skipped in the "api" role. */
function every(name, ms, fn) {
    registered.push({ name, kind: 'interval', when: `${ms}ms`, active: jobsEnabled() });
    if (!jobsEnabled()) return null;
    return setInterval(safeRun(name, fn), ms);
}

/** For logs and the startup banner. */
function summary() {
    const active = registered.filter((j) => j.active).map((j) => j.name);
    return `role=${role()} jobs=${active.length}/${registered.length}${active.length ? ` [${active.join(', ')}]` : ''}`;
}

module.exports = { role, jobsEnabled, serverEnabled, schedule, every, summary, _registered: registered };
