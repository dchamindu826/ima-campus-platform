// Student "join live class" links — pure helpers.
//
// Every live class gets its own short link:  https://imacampus.online/live/<contentId>
// The link never contains the Zoom link. The student logs in (if needed), the server
// checks payment, and only then the Join button opens Zoom through /api/mobile/live-portal.

const isLiveContent = (c) => !!c && (c.contentType === 'live' || String(c.contentType) === '1');

const studentLiveLink = (origin, contentId) => `${String(origin || '').replace(/\/+$/, '')}/live/${Number(contentId)}`;

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

module.exports = { isLiveContent, studentLiveLink, livePageView };
