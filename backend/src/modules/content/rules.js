// Content rules (pure). The content module is migrated in step 4; this file starts it.

const norm = (s) => String(s || '').trim().toLowerCase();

/**
 * Key used to hide duplicate content rows (the same lesson uploaded once for the
 * monthly course and again for the full-payment course).
 *
 * Old behaviour used title + type only, so two DIFFERENT lessons with the same title
 * (e.g. "Week 1" by two lecturers) collapsed into one — students saw the wrong
 * lecturer's recording / live link. Now the actual media must match too.
 */
function contentDedupeKey(c) {
    const media =
        c.meetingId || c.link || c.youtubeLink || c.vimeoLink || c.fileName || `id:${c.id}`;
    return [norm(c.title), norm(c.contentType), String(media).trim()].join('|');
}

/** Remove duplicate content rows, keeping the first occurrence. */
function dedupeContents(contents) {
    const seen = new Map();
    for (const c of contents) {
        const key = contentDedupeKey(c);
        if (!seen.has(key)) seen.set(key, c);
    }
    return [...seen.values()];
}

/** Content type as the folder "type" number (1 live, 2 recording, 3 document, 4 paper). */
function contentTypeNumber(contentType) {
    const t = String(contentType || '');
    if (t === 'live' || t === '1') return 1;
    if (t === 'recording' || t === '2') return 2;
    if (t === 'document' || t === '3') return 3;
    if (['testRanking', 'rankingTest', 'ranking_test', 'test', 'sPaper', 'paper', '4', '5'].includes(t)) return 4;
    return 1;
}

/** ",3,7," / "3,7" / null → [3, 7] */
function batchList(primary, additional) {
    const ids = String(additional || '').split(',').map((x) => parseInt(x, 10)).filter((x) => x > 0);
    const p = parseInt(primary, 10);
    if (p > 0) ids.unshift(p);
    return [...new Set(ids)];
}

/**
 * Is this content in a folder that does not fit it? Returns a reason or null.
 * Used to find recordings moved by the old read-time "auto-heal".
 *   folder-batch-mismatch — folder belongs to another batch
 *   folder-type-mismatch  — e.g. a recording inside a live-class folder
 *                           (documents inside recording folders are allowed, as before)
 */
function misfileReason(content, folder) {
    if (!content || !folder) return null;
    const cb = batchList(content.batchId, content.additionalBatchIds);
    const fb = batchList(folder.batchId, folder.additionalBatchIds);
    if (cb.length && fb.length && !cb.some((b) => fb.includes(b))) return 'folder-batch-mismatch';
    const t = contentTypeNumber(content.contentType);
    const ft = Number(folder.type);
    if (ft && ft !== t && !(t === 3 && ft === 2)) return 'folder-type-mismatch';
    return null;
}

module.exports = { contentDedupeKey, dedupeContents, contentTypeNumber, batchList, misfileReason };
