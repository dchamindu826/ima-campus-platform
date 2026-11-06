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

module.exports = { findMisfiledContents };
