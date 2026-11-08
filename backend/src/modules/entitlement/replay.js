// Re-check the "[entitlement:shadow] would deny" log lines with the CURRENT rule.
// Read-only. Usage (on the server, in backend/):
//   node src/modules/entitlement/replay.js /root/shadow-deny.txt
// Prints how many would still be denied (by reason) and 12 random still-denied cases with
// the student's last payments, so a coordinator can check them before ENTITLEMENT_ENFORCE.

const fs = require('fs');

function parseLines(text) {
    const pairs = new Map();
    for (const line of String(text).split('\n')) {
        const s = line.match(/student=(\d+)/);
        const c = line.match(/(course|content)=(\d+)/);
        if (!s || !c) continue;
        const key = `${s[1]}|${c[1]}|${c[2]}`;
        if (!pairs.has(key)) pairs.set(key, { studentId: Number(s[1]), kind: c[1], id: Number(c[2]) });
    }
    return [...pairs.values()];
}

async function replay(pairs, service) {
    const still = [];
    const byReason = {};
    let nowAllowed = 0;
    for (const p of pairs) {
        let r;
        if (p.kind === 'course') r = await service.explainCourseAccess(p.studentId, p.id);
        else r = await service.canAccessContent(p.studentId, p.id);
        const allowed = typeof r === 'boolean' ? r : r.allowed;
        const reason = typeof r === 'boolean' ? (r ? 'allowed' : 'content-denied') : r.reason;
        if (allowed) { nowAllowed++; continue; }
        byReason[reason] = (byReason[reason] || 0) + 1;
        still.push({ ...p, reason });
    }
    return { total: pairs.length, nowAllowed, stillDenied: still.length, byReason, still };
}

module.exports = { parseLines, replay };

if (require.main === module) {
    (async () => {
        const prisma = require('../../core/db');
        const service = require('./service');
        const pairs = parseLines(fs.readFileSync(process.argv[2] || '/root/shadow-deny.txt', 'utf8'));
        const r = await replay(pairs, service);
        console.log(`pairs=${r.total} nowAllowed=${r.nowAllowed} stillDenied=${r.stillDenied} students=${new Set(r.still.map((x) => x.studentId)).size}`);
        console.log('BY REASON', JSON.stringify(r.byReason));
        const sample = r.still.sort(() => Math.random() - 0.5).slice(0, 12);
        for (const x of sample) {
            const course = x.kind === 'course' ? await prisma.course.findUnique({ where: { id: x.id }, select: { name: true, groupId: true, batchId: true, courseType: true } }) : null;
            const g = course ? await prisma.group.findUnique({ where: { id: course.groupId }, select: { name: true } }) : null;
            console.log(`STUDENT ${x.studentId} | ${x.kind} ${x.id} ${course ? course.name + ' / ' + (g && g.name) + ' / batch ' + course.batchId + ' / type ' + course.courseType : ''} | ${x.reason}`);
            const ps = await prisma.payment.findMany({ where: { studentId: x.studentId }, orderBy: { id: 'desc' }, take: 4, select: { id: true, status: true, payment_type: true, batchId: true, groupId: true, subjects: true, created_at: true } });
            const gn = new Map((await prisma.group.findMany({ where: { id: { in: ps.map((p) => p.groupId).filter(Boolean) } }, select: { id: true, name: true } })).map((gg) => [gg.id, gg.name]));
            for (const p of ps) console.log(`   pay ${p.id} status ${p.status} type ${p.payment_type} batch ${p.batchId} group ${gn.get(p.groupId)} subjects ${p.subjects} date ${p.created_at.toISOString().slice(0, 10)}`);
        }
        process.exit(0);
    })().catch((e) => { console.error(e); process.exit(1); });
}
