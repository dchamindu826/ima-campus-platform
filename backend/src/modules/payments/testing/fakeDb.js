// Minimal in-memory stand-in for the Prisma models the payment flows touch.
// Used only by tests. Supports the query shapes those flows use.

function matches(row, where = {}) {
    return Object.entries(where).every(([k, cond]) => {
        const v = row[k];
        if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
            if ('contains' in cond) return typeof v === 'string' && v.includes(cond.contains);
            if ('in' in cond) return cond.in.includes(v);
            if ('not' in cond) return v !== cond.not;
            return false;
        }
        return v === cond;
    });
}

function table(rows, { uniqueKey } = {}) {
    let nextId = rows.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1;
    const applyData = (row, data) => {
        for (const [k, v] of Object.entries(data)) {
            if (v && typeof v === 'object' && 'increment' in v) row[k] = (row[k] || 0) + v.increment;
            else row[k] = v;
        }
        row.updatedAt = new Date();
        return row;
    };
    return {
        rows,
        findUnique: async ({ where }) => rows.find((r) => matches(r, where)) || null,
        findFirst: async ({ where } = {}) => rows.find((r) => matches(r, where)) || null,
        findMany: async ({ where } = {}) => rows.filter((r) => matches(r, where)),
        create: async ({ data }) => {
            if (uniqueKey && rows.some((r) => r[uniqueKey] === data[uniqueKey])) {
                const e = new Error('Unique constraint failed'); e.code = 'P2002'; throw e;
            }
            const row = { id: nextId++, created_at: new Date(), ...data };
            rows.push(row);
            return { ...row };
        },
        update: async ({ where, data }) => {
            const row = rows.find((r) => matches(r, where));
            if (!row) { const e = new Error('Not found'); e.code = 'P2025'; throw e; }
            return { ...applyData(row, data) };
        },
        updateMany: async ({ where, data }) => {
            const hit = rows.filter((r) => matches(r, where));
            hit.forEach((r) => applyData(r, data));
            return { count: hit.length };
        },
        upsert: async ({ where, update, create }) => {
            const row = rows.find((r) => matches(r, where));
            if (row) return { ...applyData(row, update) };
            const created = { id: nextId++, ...create };
            rows.push(created);
            return { ...created };
        },
    };
}

function createFakeDb() {
    const db = {
        payment: table([]),
        appSetting: table([], { uniqueKey: 'key' }),
        user: table([]),
    };
    // Sequential "transaction": good enough for tests (the real one is atomic in MySQL).
    db.$transaction = async (fn) => fn(db);
    return db;
}

module.exports = { createFakeDb };
