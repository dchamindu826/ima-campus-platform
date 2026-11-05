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

module.exports = { contentDedupeKey, dedupeContents };
