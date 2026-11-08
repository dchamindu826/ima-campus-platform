const test = require('node:test');
const assert = require('node:assert');
const { isLiveContent, studentLiveLink, livePageView } = require('./rules');

test('live content type', () => {
    assert.equal(isLiveContent({ contentType: 'live' }), true);
    assert.equal(isLiveContent({ contentType: '1' }), true);
    assert.equal(isLiveContent({ contentType: 'recording' }), false);
    assert.equal(isLiveContent(null), false);
});

test('student link per class', () => {
    assert.equal(studentLiveLink('https://imacampus.online/', 812), 'https://imacampus.online/live/812');
});

test('page view never contains the Zoom link', () => {
    const v = livePageView({ id: 5, title: 'Econ', link: 'https://zoom.us/j/123?pwd=x', startTime: '18:00' }, { access: { allowed: true } });
    assert.equal(v.hasLink, true);
    assert.equal(JSON.stringify(v).includes('zoom.us'), false);
    assert.equal(v.joinPath, '/mobile/live-portal?id=5');
    assert.equal(livePageView({ id: 6, title: 'x', link: '  ' }, { access: {} }).hasLink, false);
});
