const test = require('node:test');
const assert = require('node:assert/strict');
const { dedupeContents } = require('./rules');

test('report: "07.22 ICT ekata giyahama Harshani missge rec ekak" — same title, different lecturers stay separate', () => {
    const contents = [
        { id: 1, title: '2026.07.22 ICT', contentType: 'recording', youtubeLink: 'https://youtu.be/AAA' },
        { id: 2, title: '2026.07.22 ICT', contentType: 'recording', youtubeLink: 'https://youtu.be/BBB' },
    ];
    assert.deepEqual(dedupeContents(contents).map((c) => c.id), [1, 2]);
});

test('report: "Saman sirge class ekata Indika sirge link eka" — live classes with same title keep their own link', () => {
    const contents = [
        { id: 10, title: 'Maths Paper Class', contentType: 'live', meetingId: '111' },
        { id: 11, title: 'Maths Paper Class', contentType: 'live', meetingId: '222' },
    ];
    assert.equal(dedupeContents(contents).length, 2);
});

test('the same lesson uploaded twice (monthly + full course) is shown once', () => {
    const contents = [
        { id: 20, title: 'ET Week 3', contentType: 'recording', youtubeLink: 'https://youtu.be/XYZ' },
        { id: 21, title: 'et week 3 ', contentType: 'recording', youtubeLink: 'https://youtu.be/XYZ' },
    ];
    assert.deepEqual(dedupeContents(contents).map((c) => c.id), [20]);
});

test('items without any media are never merged', () => {
    const contents = [
        { id: 30, title: 'Notice', contentType: 'document' },
        { id: 31, title: 'Notice', contentType: 'document' },
    ];
    assert.equal(dedupeContents(contents).length, 2);
});

test('misfiled: folder of another batch, or wrong folder type', () => {
    const R = require('./rules');
    const folder = { batchId: 5, additionalBatchIds: ',9,', type: 2 };
    assert.equal(R.misfileReason({ batchId: 5, contentType: 'recording' }, folder), null);
    assert.equal(R.misfileReason({ batchId: 9, contentType: 'recording' }, folder), null, 'additional batch ok');
    assert.equal(R.misfileReason({ batchId: 7, contentType: 'recording' }, folder), 'folder-batch-mismatch');
    assert.equal(R.misfileReason({ batchId: 5, contentType: 'live' }, folder), 'folder-type-mismatch');
    assert.equal(R.misfileReason({ batchId: 5, contentType: 'document' }, folder), null, 'documents in recording folders allowed');
    assert.equal(R.misfileReason({ batchId: 5, contentType: 'recording' }, null), null);
});

test('report: sub-folder made in Geo shows only in Geo (or everywhere if made for all subjects)', () => {
    const R = require('./rules');
    assert.equal(R.subfolderBelongsToSubject({ courseCode: 'GEO' }, ['GEO']), true);
    assert.equal(R.subfolderBelongsToSubject({ courseCode: 'GEO' }, ['MEDIA', 'SUB_12']), false);
    assert.equal(R.subfolderBelongsToSubject({ courseCode: 'SUB_315' }, ['315']), true, 'code variants');
    assert.equal(R.subfolderBelongsToSubject({ courseCode: null }, ['MEDIA']), true, 'all-subjects sub-folder');
    assert.equal(R.subfolderBelongsToSubject({ courseCode: 'GEO' }, []), true, 'no subject context: unchanged');
});
