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

test('report: folder order jumps — reorder sets the SAME order on every copy (subjects / types), subfolders too', async () => {
    const folders = [
        { id: 1, batchId: 5, classType: 1, parentId: null, title: 'MAY MONTH', type: 2, itemOrder: 1 },
        { id: 2, batchId: 5, classType: 1, parentId: null, title: 'May', type: 3, itemOrder: 1 },       // documents copy
        { id: 3, batchId: 5, classType: 1, parentId: null, title: 'JUNE MONTH', type: 2, itemOrder: 1 },
        { id: 4, batchId: 5, classType: 1, parentId: null, title: 'June', type: 3, itemOrder: 1 },
        { id: 5, batchId: 5, classType: 2, parentId: null, title: 'MAY MONTH', type: 2, itemOrder: 1 }, // paper class: untouched
        { id: 6, batchId: 5, classType: 1, parentId: 1, title: 'Week 1', type: 2, itemOrder: 1 },
        { id: 7, batchId: 5, classType: 1, parentId: 2, title: 'Week 1', type: 3, itemOrder: 1 },
        { id: 8, batchId: 5, classType: 1, parentId: 1, title: 'Week 2', type: 2, itemOrder: 1 },
    ];
    globalThis.__imaPrisma = { contentGroup: {
        findMany: async ({ where }) => folders.filter((f) => (where.id ? where.id.in.includes(f.id) : where.batchId.in.includes(f.batchId))),
        updateMany: async ({ where, data }) => { let n = 0; for (const f of folders) if (where.id.in.includes(f.id)) { Object.assign(f, data); n++; } return { count: n }; },
    } };
    delete require.cache[require.resolve('../../core/db')];
    delete require.cache[require.resolve('./service')];
    const svc = require('./service');
    await svc.reorderFolders([[3], [1]]);                 // June above May (recordings tab)
    await svc.reorderFolders([[8], [6]]);                 // Week 2 above Week 1
    delete globalThis.__imaPrisma;
    const o = Object.fromEntries(folders.map((f) => [f.id, f.itemOrder]));
    assert.deepEqual([o[3], o[4], o[1], o[2]], [10, 10, 20, 20], 'documents copies follow');
    assert.equal(o[5], 1, 'paper class not touched');
    assert.deepEqual([o[8], o[6], o[7]], [10, 20, 20], 'sub-folder copies follow');
});
