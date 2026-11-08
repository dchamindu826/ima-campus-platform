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

export { meetingKey, liveKey };
