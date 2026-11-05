const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const SINHALA_MONTH_MAP = {
    'ජනවාරි': 'January', 'පෙබරවාරි': 'February', 'මාර්තු': 'March',
    'අප්‍රේල්': 'April', 'මැයි': 'May', 'ජූනි': 'June',
    'ජූලි': 'July', 'අගෝස්තු': 'August', 'සැප්තැම්බර්': 'September',
    'ඔක්තෝබර්': 'October', 'නොවැම්බර්': 'November', 'දෙසැම්බර්': 'December'
};

const parseMonthName = (str) => {
    if (!str) return null;
    const s = String(str).trim();
    for (const [sin, eng] of Object.entries(SINHALA_MONTH_MAP)) {
        if (s.includes(sin)) return eng;
    }
    const lower = s.toLowerCase();
    for (const m of MONTH_NAMES) {
        if (lower.includes(m.toLowerCase())) return m;
    }
    const shortPrefixes = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    for (let i = 0; i < shortPrefixes.length; i++) {
        if (lower.includes(shortPrefixes[i])) return MONTH_NAMES[i];
    }
    return null;
};

/**
 * Resolves the start and end month indices (0-indexed) and month count for a specific installment step.
 * 
 * Supports:
 * - Single integer month count (e.g. "5", "3", "3")
 * - Start-End range string (e.g. "1-5", "6-8", "9-11" or "1-4", "5-8", "9-12")
 * - Upgrade offset (rangeUp1, rangeUp2)
 * - Fallback to mathematical proportional phase division
 */
function resolveInstallmentStepRange(stepDetails, instIdx, isUpgrade = false, alreadyPaidMonthlyCount = 0, numActive = 12) {
    const totalPhases = (stepDetails && stepDetails.length > 0) ? stepDetails.length : 3;
    let rangeField = 'rangeNormal';
    if (isUpgrade) {
        if (alreadyPaidMonthlyCount === 1) rangeField = 'rangeUp1';
        else if (alreadyPaidMonthlyCount >= 2) rangeField = 'rangeUp2';
    }

    let currentOffset = isUpgrade ? Math.min(alreadyPaidMonthlyCount, numActive) : 0;
    const stepRanges = [];

    for (let k = 0; k < totalPhases; k++) {
        const stepCfg = (stepDetails && stepDetails[k]) || {};
        let rStr = stepCfg[rangeField] || stepCfg['rangeNormal'];
        let s = null;
        let e = null;

        if (rStr !== undefined && rStr !== null && String(rStr).trim() !== '') {
            const trimmed = String(rStr).trim();
            if (trimmed.includes('-')) {
                const parts = trimmed.split('-');
                const p0 = parseInt(parts[0], 10);
                const p1 = parseInt(parts[1], 10);
                if (!isNaN(p0) && !isNaN(p1)) {
                    s = Math.max(0, p0 - 1);
                    e = Math.max(s, p1);
                    currentOffset = e;
                }
            } else {
                const count = parseInt(trimmed, 10);
                if (!isNaN(count) && count > 0) {
                    s = currentOffset;
                    e = currentOffset + count;
                    currentOffset = e;
                }
            }
        }

        if (s === null || e === null) {
            const s_norm = Math.floor((k * numActive) / totalPhases);
            const e_norm = Math.floor(((k + 1) * numActive) / totalPhases);
            s = s_norm;
            e = e_norm;
            if (isUpgrade) {
                s = Math.max(s, alreadyPaidMonthlyCount);
                if (s > e) s = e;
            }
            currentOffset = e;
        }

        if (s < 0) s = 0;
        if (e > numActive) e = numActive;
        if (s > e) s = e;

        stepRanges.push({ start: s, end: e, count: Math.max(0, e - s) });
    }

    return stepRanges[instIdx] || {
        start: Math.floor((instIdx * numActive) / totalPhases),
        end: Math.floor(((instIdx + 1) * numActive) / totalPhases),
        count: Math.max(1, Math.floor(((instIdx + 1) * numActive) / totalPhases) - Math.floor((instIdx * numActive) / totalPhases))
    };
}

/**
 * Determines which monthly groups a student has access to in a batch.
 * 
 * - If student has an approved Full payment (payment_type === 3):
 *     isFullAccess is TRUE, grants access to all groups.
 * - If student has approved Installment payment(s) (payment_type === 2):
 *     isFullAccess is FALSE, grants access ONLY to the monthly groups covered
 *     by the paid installment steps (plus any groups directly paid via monthly payments).
 * - If student only has Monthly payment(s) (payment_type === 1):
 *     isFullAccess is FALSE, only grants access to the specific paid monthly groups.
 */
async function getStudentBatchAccess(prisma, studentId, batchId, targetClassType = 1) {
    const sId = parseInt(studentId, 10);
    const bId = parseInt(batchId, 10);

    // 1. Fetch all approved payments for this student and batch
    const payments = await prisma.payment.findMany({
        where: {
            studentId: sId,
            batchId: bId,
            status: { in: [1, 4] }
        },
        include: { group: true }
    });

    if (payments.length === 0) {
        return { isFullAccess: false, allowedGroupIds: new Set(), allowedMonthIndices: new Set(), hasApprovedPayments: false };
    }

    // 2. If student has Full Payment (payment_type === 3) for this classType / batch
    const fullPayment = payments.find(p => {
        if (p.payment_type !== 3) return false;
        if (!targetClassType) return true;
        const gClassType = parseInt(p.group?.classType || 1, 10);
        return gClassType === targetClassType;
    });

    if (fullPayment) {
        return { isFullAccess: true, allowedGroupIds: new Set(), allowedMonthIndices: new Set(), hasApprovedPayments: true };
    }

    // 3. Check for Installment payments (payment_type === 2)
    const instPayments = payments.filter(p => {
        if (p.payment_type !== 2) return false;
        if (!targetClassType) return true;
        const gClassType = parseInt(p.group?.classType || 1, 10);
        return gClassType === targetClassType;
    });

    // 4. Fetch chronological monthly groups for this batch
    let groupWhere = { batchId: bId };
    if (targetClassType) {
        groupWhere.classType = targetClassType;
    }
    const rawGroups = await prisma.group.findMany({
        where: groupWhere,
        orderBy: [{ itemOrder: 'asc' }, { id: 'asc' }]
    });

    const monthlyGroups = rawGroups.filter(g => {
        const lower = (g.name || '').toLowerCase();
        return !lower.includes('full payment') && !lower.includes('full');
    });

    // Sort monthly groups chronologically based on intake start month
    const courses = await prisma.course.findMany({
        where: { group: { batchId: bId } },
        select: { startMonth: true }
    });

    let intakeStartMonth = null;
    for (const c of courses) {
        const parsed = parseMonthName(c.startMonth);
        if (parsed) {
            intakeStartMonth = parsed;
            break;
        }
    }
    if (!intakeStartMonth && monthlyGroups.length > 0) {
        intakeStartMonth = parseMonthName(monthlyGroups[0].name) || 'January';
    }
    const intakeStartIdx = intakeStartMonth ? MONTH_NAMES.indexOf(intakeStartMonth) : 0;

    const getMonthOffset = (name) => {
        const m = parseMonthName(name);
        if (!m) return 99;
        const idx = MONTH_NAMES.indexOf(m);
        return (idx - intakeStartIdx + 12) % 12;
    };

    monthlyGroups.sort((a, b) => {
        const offA = getMonthOffset(a.name);
        const offB = getMonthOffset(b.name);
        if (offA !== offB) return offA - offB;
        return (a.itemOrder || 0) - (b.itemOrder || 0);
    });

    const numActive = monthlyGroups.length || 1;
    const allowedGroupIds = new Set();
    const allowedMonthIndices = new Set();

    // 5. Add monthly groups paid for via Monthly Payments (payment_type === 1)
    const monthlyPayments = payments.filter(p => p.payment_type === 1);
    monthlyPayments.forEach(mp => {
        if (mp.groupId) allowedGroupIds.add(mp.groupId);
    });

    // 6. If student has Installment payments, unlock groups covered by paid installment steps
    if (instPayments.length > 0) {
        const installmentPlans = await prisma.installment.findMany({ where: { batchId: bId } });

        // Determine core subject count for student
        let subCount = 3; // default
        for (const ip of instPayments) {
            if (ip.subjects) {
                try {
                    const parsedSubs = JSON.parse(ip.subjects);
                    const count = Array.isArray(parsedSubs) ? parsedSubs.length : 3;
                    if (count > 0) subCount = Math.min(3, count);
                } catch(e) {}
            }
        }

        const applicablePlans = installmentPlans.filter(pl => pl.subjectCount <= subCount).sort((a, b) => b.subjectCount - a.subjectCount);
        const plan = applicablePlans.length > 0 ? applicablePlans[0] : (installmentPlans[0] || null);

        let stepDetails = [];
        if (plan && plan.details) {
            try { stepDetails = JSON.parse(plan.details); } catch(e) {}
        }

        const monthlyPaidCount = monthlyPayments.length;

        instPayments.forEach(ip => {
            const instNo = ip.installment_no || 1;
            const instIdx = Math.max(0, instNo - 1);
            const isUpgrade = Boolean(ip.remark && (ip.remark.includes('[UPGRADE]') || ip.remark.includes('UPGRADE')));

            const stepRange = resolveInstallmentStepRange(stepDetails, instIdx, isUpgrade, monthlyPaidCount, numActive);
            for (let i = stepRange.start; i < stepRange.end; i++) {
                allowedMonthIndices.add(i);
                if (monthlyGroups[i]) {
                    allowedGroupIds.add(monthlyGroups[i].id);
                }
            }
        });
    }

    return {
        isFullAccess: false,
        allowedGroupIds,
        allowedMonthIndices,
        hasApprovedPayments: true
    };
}

module.exports = {
    MONTH_NAMES,
    parseMonthName,
    resolveInstallmentStepRange,
    getStudentBatchAccess
};

