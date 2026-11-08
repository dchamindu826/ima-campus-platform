// Student "join live class" links — pure helpers.
//
// Every live class gets its own short link:  https://imacampus.online/live/<contentId>
// The link never contains the Zoom link. The student logs in (if needed), the server
// checks payment, and only then the Join button opens Zoom through /api/mobile/live-portal.

// One student link per Zoom meeting: the same Zoom link in 2-3 batches gets the SAME link.
// This block is identical in backend/src/modules/live/rules.js and frontend/src/utils/liveKey.js
// (live/rules.test.js checks that).
// LIVEKEY-START
function meetingKey(link, meetingId) {
    const s = String(link || '').trim();
    const m = s.match(/zoom\.us\/(?:j|wc|w|s)\/(\d{9,12})/i) || s.match(/[?&]confno=(\d{9,12})/i);
    if (m) return `zm:${m[1]}`;
    const digits = String(meetingId || '').replace(/\D/g, '');
    if (digits.length >= 9) return `zm:${digits}`;
    if (!s) return null;
    return `url:${s.toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
}
function hash53(str) {
    let h1 = 0xdeadbeef ^ 7, h2 = 0x41c6ce57 ^ 7;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
function liveKey(link, meetingId) {
    const k = meetingKey(link, meetingId);
    return k ? hash53(k).toString(36) : null;
}
// LIVEKEY-END

const isLiveContent = (c) => !!c && (c.contentType === 'live' || String(c.contentType) === '1');

const studentLiveLink = (origin, contentId) => `${String(origin || '').replace(/\/+$/, '')}/live/${Number(contentId)}`;

/**
 * Several classes (batches) can share one Zoom link → one student link.
 * Pick which of them this student joins through: the nearest by date first.
 */
function sortByNearest(contents, now = new Date()) {
    const t = (c) => {
        const d = c.date ? new Date(c.date).getTime() : new Date(c.createdAt || 0).getTime();
        return Math.abs(d - now.getTime());
    };
    return [...contents].sort((a, b) => t(a) - t(b));
}

/** What the page shows. Never includes the Zoom link itself. */
function livePageView(content, { courseName, batchName, access }) {
    return {
        id: content.id,
        title: content.title,
        courseName: courseName || null,
        batchName: batchName || null,
        date: content.date || null,
        startTime: content.startTime || null,
        endTime: content.endTime || null,
        hasLink: !!(content.link && String(content.link).trim()),
        access,
        joinPath: `/mobile/live-portal?id=${Number(content.id)}`,
    };
}

module.exports = { meetingKey, liveKey, isLiveContent, studentLiveLink, sortByNearest, livePageView };
