const test = require('node:test');
const assert = require('node:assert/strict');

const fresh = (roleValue) => {
    if (roleValue === undefined) delete process.env.IMA_ROLE;
    else process.env.IMA_ROLE = roleValue;
    delete require.cache[require.resolve('./jobs')];
    return require('./jobs');
};

test('default role is "all": jobs and server both on (same as before step 1.6)', () => {
    const jobs = fresh(undefined);
    assert.equal(jobs.role(), 'all');
    assert.equal(jobs.jobsEnabled(), true);
    assert.equal(jobs.serverEnabled(), true);
});

test('"api" role: server on, jobs off — no job is started', () => {
    const jobs = fresh('api');
    assert.equal(jobs.serverEnabled(), true);
    assert.equal(jobs.jobsEnabled(), false);
    assert.equal(jobs.every('t', 10, () => {}), null);
    assert.equal(jobs.schedule('c', '* * * * *', () => {}), null);
    assert.match(jobs.summary(), /role=api jobs=0\/2/);
});

test('"worker" role: jobs on, server off', () => {
    const jobs = fresh('WORKER');
    assert.equal(jobs.serverEnabled(), false);
    assert.equal(jobs.jobsEnabled(), true);
    const t = jobs.every('t', 60000, () => {});
    assert.ok(t);
    clearInterval(t);
});

test('unknown role falls back to "all" (never silently drops jobs)', () => {
    assert.equal(fresh('apii').role(), 'all');
});

test('a failing job is logged and does not throw', async () => {
    const jobs = fresh('worker');
    const origError = console.error;
    let logged = '';
    console.error = (m) => { logged += m; };
    const t = jobs.every('boom', 5, () => { throw new Error('x'); });
    await new Promise((r) => setTimeout(r, 20));
    clearInterval(t);
    console.error = origError;
    assert.match(logged, /\[job:boom\] failed/);
});

test.after(() => fresh(undefined));
