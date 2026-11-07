// Content service. Read-only reports for now (step 4).

const rules = require('./rules');

const db = () => require('../../core/db');
const MAX_SCAN = 5000;

/**
 * Content sitting in a folder that does not fit it (other batch / wrong type) —
 * mostly left behind by the old read-time "auto-heal" that rewrote contentGroupId.
 * Also counts content with no folder at all ("Uncategorized").
 * @param {{ days?: number, batchId?: number }} opts
 */
async function findMisfiledContents({ days = 120, batchId } = {}) {
    const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
    const where = { createdAt: { gte: since } };
    if (batchId) where.batchId = Number(batchId);
    const rows = await db().content.findMany({
        where,
        select: {
            id: true, title: true, contentType: true, batchId: true, additionalBatchIds: true, contentGroupId: true, createdAt: true,
            group: { select: { id: true, title: true, type: true, batchId: true, additionalBatchIds: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: MAX_SCAN,
    });
    const misfiled = [];
    let uncategorized = 0;
    for (const c of rows) {
        if (!c.contentGroupId) { uncategorized++; continue; }
        const reason = rules.misfileReason(c, c.group);
        if (reason) {
            misfiled.push({
                contentId: c.id, title: c.title, contentType: c.contentType, contentBatchId: c.batchId,
                folderId: c.group.id, folderTitle: c.group.title, folderBatchId: c.group.batchId, folderType: c.group.type,
                reason, createdAt: c.createdAt,
            });
        }
    }
    return { scanned: rows.length, truncated: rows.length === MAX_SCAN, uncategorized, misfiled };
}

/**
 * Save the folder order shown in the Content Hub.
 * A folder made "for all subjects" / "recordings + documents" is really several copies
 * (one per subject / type) shown as one. Editing "Display Order" changed only ONE copy, so
 * the order jumped around (staff and students). Here every copy gets the same order.
 * @param {Array<Array<number>>} orderedFolders  one entry per visible folder, top to bottom;
 *        each entry = the ids the Content Hub shows as that folder
 * @returns {Promise<number>} folders updated
 */
async function reorderFolders(orderedFolders) {
    const lists = (orderedFolders || []).map((ids) => (Array.isArray(ids) ? ids : [ids]).map(Number).filter(Boolean)).filter((l) => l.length);
    if (lists.length === 0) return 0;
    const shown = await db().contentGroup.findMany({ where: { id: { in: lists.flat() } }, select: { id: true, batchId: true, classType: true, parentId: true, title: true } });
    const byId = new Map(shown.map((f) => [f.id, f]));
    const batchIds = [...new Set(shown.map((f) => f.batchId))];
    const all = await db().contentGroup.findMany({ where: { batchId: { in: batchIds } }, select: { id: true, batchId: true, classType: true, parentId: true, title: true } });
    const allById = new Map(all.map((f) => [f.id, f]));
    const parentKey = (f) => (f.parentId ? rules.normalizeFolderTitle((allById.get(f.parentId) || {}).title) : '');
    const key = (f) => `${f.batchId}|${f.classType}|${f.parentId ? 'sub:' + parentKey(f) : 'root'}|${rules.normalizeFolderTitle(f.title)}`;

    let updated = 0;
    for (let i = 0; i < lists.length; i++) {
        const keys = new Set(lists[i].map((id) => byId.get(id)).filter(Boolean).map(key));
        const ids = all.filter((f) => keys.has(key(f))).map((f) => f.id);
        if (ids.length === 0) continue;
        const r = await db().contentGroup.updateMany({ where: { id: { in: ids } }, data: { itemOrder: (i + 1) * 10 } });
        updated += r.count;
    }
    return updated;
}

module.exports = { findMisfiledContents, reorderFolders };
