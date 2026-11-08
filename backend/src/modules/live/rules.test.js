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

const { meetingKey, liveKey, sortByNearest } = require('./rules');

test('same Zoom meeting → same key, whatever the link format', () => {
    const a = liveKey('https://us06web.zoom.us/j/81234567890?pwd=abc');
    assert.equal(a, liveKey('https://zoom.us/j/81234567890'));
    assert.equal(a, liveKey('https://us02web.zoom.us/wc/81234567890/join?pwd=x'));
    assert.equal(a, liveKey('', '812 3456 7890'));
    assert.notEqual(a, liveKey('https://zoom.us/j/81234567891'));
    assert.equal(meetingKey('https://meet.google.com/abc-defg-hij/'), 'url:meet.google.com/abc-defg-hij');
    assert.equal(liveKey(''), null);
    assert.match(a, /^[0-9a-z]+$/);
});

test('nearest class by date first', () => {
    const now = new Date('2026-11-10T12:00:00Z');
    const r = sortByNearest([{ id: 1, date: '2026-10-01' }, { id: 2, date: '2026-11-10' }, { id: 3, date: '2026-11-17' }], now);
    assert.deepEqual(r.map((c) => c.id), [2, 3, 1]);
});

test('frontend and backend key code are identical', () => {
    const fs = require('fs'); const path = require('path');
    const cut = (s) => s.slice(s.indexOf('// LIVEKEY-START'), s.indexOf('// LIVEKEY-END'));
    const fe = fs.readFileSync(path.join(__dirname, '../../../../frontend/src/utils/liveKey.js'), 'utf8');
    const be = fs.readFileSync(path.join(__dirname, 'rules.js'), 'utf8');
    assert.equal(cut(fe), cut(be));
});
