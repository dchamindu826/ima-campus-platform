const test = require('node:test');
const assert = require('node:assert/strict');

test('misfiled report: finds other-batch / wrong-type folders and counts uncategorized', async () => {
    const rows = [
        { id: 1, title: 'Nov Rec 1', contentType: 'recording', batchId: 5, contentGroupId: 10, createdAt: new Date(), group: { id: 10, title: 'November', type: 2, batchId: 5 } },
        { id: 2, title: 'Nov Rec 2', contentType: 'recording', batchId: 5, contentGroupId: 20, createdAt: new Date(), group: { id: 20, title: 'November', type: 2, batchId: 8 } },
        { id: 3, title: 'Live', contentType: 'live', batchId: 5, contentGroupId: 10, createdAt: new Date(), group: { id: 10, title: 'November', type: 2, batchId: 5 } },
        { id: 4, title: 'Loose', contentType: 'recording', batchId: 5, contentGroupId: null, createdAt: new Date(), group: null },
    ];
    globalThis.__imaPrisma = { content: { findMany: async () => rows } };
    delete require.cache[require.resolve('../../core/db')];
    delete require.cache[require.resolve('./service')];
    const r = await require('./service').findMisfiledContents({ days: 30 });
    delete globalThis.__imaPrisma;
    assert.equal(r.uncategorized, 1);
    assert.deepEqual(r.misfiled.map((m) => [m.contentId, m.reason]), [[2, 'folder-batch-mismatch'], [3, 'folder-type-mismatch']]);
});
