const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { markPaymentOnGSheet } = require('../utils/gsheetUpdater');
const prisma = require('../src/core/db');

const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

// Helper: Sync verified payments with corresponding CRM Leads (match by last 7 digits to resolve prefix changes)
// Helper: Sync verified payments with corresponding CRM Leads (batch-specific isolation)
const syncLeadEnrollment = async (studentId, paymentType, payment) => {
    try {
        if (!studentId) return;
        const student = await prisma.user.findUnique({ 
            where: { id: parseInt(studentId) },
            include: {
                payments: {
                    where: { status: { in: [0, 1, 4] } },
                    orderBy: { created_at: 'desc' },
                    include: { batch: true }
                }
            }
        });
        if (!student) return;

        const rawPhones = [student.phone, student.whatsapp, student.optionalPhone, student.addressHouseNo];
        const phonesToCheck = [];
        rawPhones.forEach(raw => {
            if (raw) {
                const cleaned = raw.replace(/[^0-9]/g, '');
                if (cleaned.length >= 7) phonesToCheck.push(cleaned);
            }
        });

        const validLast7Digits = [...new Set(phonesToCheck.map(p => p.slice(-7)).filter(p => p.length >= 7))];
        if (validLast7Digits.length === 0) return;

        // Find leads containing last 7 digits of the phone
        const leads = await prisma.lead.findMany({
            where: {
                campaignType: { in: ['AFTER_SEMINAR', 'FREE_SEMINAR', 'OPEN_SEMINAR'] },
                OR: validLast7Digits.map(last7 => ({ phone: { contains: last7 } }))
            },
            include: { batch: true }
        });

        // Map student payments by batchId and businessId
        const approvedBatchIds = new Set();
        const pendingBatchIds = new Set();
        const batchPaymentMap = new Map();

        student.payments.forEach(p => {
            if (p.batchId) {
                if (p.status === 1) {
                    approvedBatchIds.add(p.batchId);
                    if (!batchPaymentMap.has(p.batchId)) batchPaymentMap.set(p.batchId, p);
                } else if (p.status === 0 || p.status === 4) {
                    pendingBatchIds.add(p.batchId);
                    if (!batchPaymentMap.has(p.batchId)) batchPaymentMap.set(p.batchId, p);
                }
            }
        });

        if (leads.length > 0) {
            for (const lead of leads) {
                const leadBatchId = lead.batchId;
                let targetStatus = 'NON_ENROLLED';
                let targetIntention = 'NOT_DECIDED';

                if (leadBatchId && approvedBatchIds.has(leadBatchId)) {
                    targetStatus = 'ENROLLED';
                    const batchPay = batchPaymentMap.get(leadBatchId);
                    const pType = parseInt(batchPay?.payment_type || paymentType || 1);
                    targetIntention = pType === 3 ? 'FULL' : pType === 2 ? 'INSTALLMENT' : 'MONTHLY';
                } else if (leadBatchId && pendingBatchIds.has(leadBatchId)) {
                    targetStatus = 'PAYMENT_PROCESSING';
                    const batchPay = batchPaymentMap.get(leadBatchId);
                    const pType = parseInt(batchPay?.payment_type || paymentType || 1);
                    targetIntention = pType === 3 ? 'FULL' : pType === 2 ? 'INSTALLMENT' : 'MONTHLY';
                } else if (!leadBatchId && payment && payment.status === 1) {
                    // Lead has no specific batch attached, check business match
                    const leadBizId = lead.batch?.businessId || (lead.phone && lead.phone.includes('_BIZ_') ? parseInt(lead.phone.split('_BIZ_')[1]?.split('_')[0]) : null);
                    if (!leadBizId || leadBizId === payment.businessId) {
                        targetStatus = 'ENROLLED';
                        const pType = parseInt(paymentType || 1);
                        targetIntention = pType === 3 ? 'FULL' : pType === 2 ? 'INSTALLMENT' : 'MONTHLY';
                    }
                }

                if (lead.enrollmentStatus !== targetStatus || lead.paymentIntention !== targetIntention) {
                    await prisma.lead.update({
                        where: { id: lead.id },
                        data: {
                            enrollmentStatus: targetStatus,
                            paymentIntention: targetIntention
                        }
                    });
                }
            }
            console.log(`[SYNC] Evaluated ${leads.length} leads with batch-specific isolation for Student ID ${studentId}`);
        } else {
            // No matching lead found at all, create a completely new PAID_CAMP lead if student exists
            const basePhone = phonesToCheck[0];
            const businessId = payment?.businessId || student.businessId || 1;
            const batchId = payment?.batchId || student.batchId || null;
            const assignedTo = null;

            let pIntention = 'MONTHLY';
            const pType = parseInt(paymentType || 1);
            if (pType === 3) pIntention = 'FULL';
            else if (pType === 2) pIntention = 'INSTALLMENT';

            let newEnrollmentStatus = 'NON_ENROLLED';
            if (payment && payment.status === 1) newEnrollmentStatus = 'ENROLLED';
            else if (payment && (payment.status === 0 || payment.status === 4)) newEnrollmentStatus = 'PAYMENT_PROCESSING';

            const dbPhoneSuffix = `_BIZ_${businessId}` + (batchId ? `_BATCH_${batchId}` : '') + `_PAID`;
            const newPhone = `${basePhone}${dbPhoneSuffix}`;

            const checkExact = await prisma.lead.findUnique({ where: { phone: newPhone } });
            if (!checkExact) {
                await prisma.lead.create({
                    data: {
                        name: student.firstName ? `${student.firstName} ${student.lastName || ''}`.trim() : 'Unknown Student',
                        phone: newPhone,
                        source: 'system',
                        campaignType: 'AFTER_SEMINAR',
                        inquiryType: 'PAID_CAMP',
                        enrollmentStatus: newEnrollmentStatus,
                        paymentIntention: pIntention,
                        assignedTo: assignedTo,
                        batchId: batchId,
                        coordinationRound: 1,
                        phase: 1,
                        callStatus: 'pending'
                    }
                });
                console.log(`[SYNC] Created new independent PAID_CAMP lead for Student ID ${studentId}`);
            } else {
                await prisma.lead.update({
                    where: { id: checkExact.id },
                    data: {
                        enrollmentStatus: newEnrollmentStatus,
                        paymentIntention: pIntention
                    }
                });
            }
        }
    } catch (error) {
        console.error(`[SYNC ERROR] syncLeadEnrollment failed for Student ID ${studentId}:`, error);
    }
};

// Helper: Normalize tute/course string for accurate comparison
const normalizeTuteText = (txt = '') => {
    return String(txt || '')
        .toLowerCase()
        .replace(/[^a-z0-9\u0D80-\u0DFF]/g, '')
        .trim();
};

const getBaseSubjectName = (txt = '') => {
    let clean = String(txt || '').toLowerCase().trim();
    clean = clean.replace(/\b(full\s*payment|full\s*set|full|theory|revision|paper\s*class|paper|class|tute|tutes|book|lesson|\d+)\b/gi, '').trim();
    return normalizeTuteText(clean);
};

// Helper: Deduce deliverable tutes for a payment based on Content Hub groupPrices rules.
// Content Hub (groupPrices) is the single source of truth.
// If deliverTute is true, the tutes are delivered regardless of whether it is a theory, revision, or paper class.
const getDeliverableCoursesForPayment = async (payment, courses) => {
    if (!courses || courses.length === 0) return [];

    const deliverableCoursesMap = new Map();

    for (const course of courses) {
        let deliverTute = false;
        let tuteName = (course.name || "Tute").trim();
        let tuteImage = null;

        if (course.groupPrices && payment.groupId) {
            try {
                const gps = typeof course.groupPrices === 'string' ? JSON.parse(course.groupPrices) : course.groupPrices;
                const match = Array.isArray(gps) ? gps.find(g => String(g.groupId) === String(payment.groupId)) : null;

                if (match && (match.deliverTute === true || match.deliverTute === 'true')) {
                    if (match.tutes && Array.isArray(match.tutes) && match.tutes.length > 0) {
                        match.tutes.forEach(t => {
                            const tName = (t.name || t.tuteName || '').trim();
                            const tCover = t.cover || t.tuteCover || null;
                            if (tName) {
                                const normKey = normalizeTuteText(tName) || `${course.id}_${tName}`;
                                if (!deliverableCoursesMap.has(normKey)) {
                                    deliverableCoursesMap.set(normKey, {
                                        courseId: course.id,
                                        tuteName: tName,
                                        tuteImage: tCover,
                                        quantity: 1
                                    });
                                }
                            }
                        });
                    } else {
                        deliverTute = true;
                        if (match.tuteName && match.tuteName.trim()) {
                            tuteName = match.tuteName.trim();
                        }
                        if (match.tuteCover && match.tuteCover.trim()) {
                            tuteImage = match.tuteCover.trim();
                        }
                    }
                }
            } catch (e) {
                console.error("[DELIVERY] Error parsing groupPrices for course:", course.id, e.message);
            }
        }

        if (deliverTute) {
            const normKey = normalizeTuteText(tuteName) || `${course.id}_${tuteName}`;
            if (!deliverableCoursesMap.has(normKey)) {
                deliverableCoursesMap.set(normKey, {
                    courseId: course.id,
                    tuteName: tuteName,
                    tuteImage: tuteImage || null,
                    quantity: 1
                });
            }
        }
    }

    return Array.from(deliverableCoursesMap.values());
};

/**
 * Unified Auto-Delivery Creator for both Slip Approval & Online Instant Payments (Paycorp / PayHere).
 * Strictly mirrors the battle-tested Slip Approval deduplication logic:
 * 1. Checks if a delivery record already exists for this paymentId.
 * 2. Fetches candidate items from Content Hub (groupPrices).
 * 3. Scoped deduplication:
 *    - Monthly (type 1): Checks previous deliveries for studentId in the SAME groupId.
 *      (September payment never blocks October payment! But within October, duplicates are avoided).
 *    - Installment / Full (type 2 / 3): Checks previous deliveries for studentId in the SAME batchId.
 *      (Prevents duplicate orders if batch tutes were already delivered).
 * 4. Deduplicates by both courseId and normalized tute name.
 */
const createAutoDeliveryForPayment = async (payment, isSelfPicked = false) => {
    try {
        if (!payment || !payment.id || !payment.subjects) return null;

        // 1. Ensure a delivery record doesn't already exist for this exact paymentId
        const existingDeliveryForPayment = await prisma.delivery.findFirst({
            where: {
                paymentId: payment.id,
                status: { notIn: ['Trash', 'Cancelled', 'Rejected'] }
            }
        });
        if (existingDeliveryForPayment) {
            console.log(`[DELIVERY] Delivery already exists for Payment #${payment.id} (ORD-${existingDeliveryForPayment.id}). Skipping.`);
            return existingDeliveryForPayment;
        }

        // 2. Parse subjects and fetch courses
        let subIds = [];
        try {
            subIds = typeof payment.subjects === 'string' ? JSON.parse(payment.subjects) : payment.subjects;
            if (!Array.isArray(subIds)) subIds = [];
            subIds = subIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0);
        } catch (e) {
            subIds = [];
        }
        if (subIds.length === 0) return null;

        const courses = await prisma.course.findMany({ where: { id: { in: subIds } } });
        if (!courses || courses.length === 0) return null;

        // 3. Resolve deliverable tute items from Content Hub (groupPrices)
        const deliverableItems = await getDeliverableCoursesForPayment(payment, courses);
        if (!deliverableItems || deliverableItems.length === 0) {
            console.log(`[DELIVERY] No deliverable tutes configured for Payment #${payment.id} in Content Hub.`);
            return null;
        }

        const pType = parseInt(payment.payment_type !== undefined ? payment.payment_type : payment.paymentType, 10);
        const paymentTypeStr = pType === 1 ? 'Monthly' : (pType === 2 ? 'Installment' : 'Full');

        // 4. Scoped deduplication check:
        // - For Monthly (pType === 1): check prior deliveries for student in the SAME month / group (groupId).
        //   Month 1 (September) tutes NEVER block Month 2 (October) tutes!
        //   Within the same month, duplicate tutes are avoided.
        // - For Full / Installment (pType === 2 or 3): check prior deliveries in the SAME batch (batchId),
        //   because Full payment covers the full batch course.
        let existingDeliveries = [];
        if (pType === 1 && payment.groupId) {
            existingDeliveries = await prisma.delivery.findMany({
                where: {
                    studentId: payment.studentId.toString(),
                    payment: { groupId: parseInt(payment.groupId, 10) },
                    status: { notIn: ['Trash', 'Cancelled', 'Rejected'] }
                },
                include: { items: true, payment: true }
            });
        } else if (payment.batchId) {
            existingDeliveries = await prisma.delivery.findMany({
                where: {
                    studentId: payment.studentId.toString(),
                    payment: { batchId: parseInt(payment.batchId, 10) },
                    status: { notIn: ['Trash', 'Cancelled', 'Rejected'] }
                },
                include: { items: true, payment: true }
            });
        } else if (payment.groupId) {
            existingDeliveries = await prisma.delivery.findMany({
                where: {
                    studentId: payment.studentId.toString(),
                    payment: { groupId: parseInt(payment.groupId, 10) },
                    status: { notIn: ['Trash', 'Cancelled', 'Rejected'] }
                },
                include: { items: true, payment: true }
            });
        }

        // Collect already delivered/queued items for this student in this scope
        const alreadyDeliveredExactSet = new Set();
        const alreadyDeliveredBaseSet = new Set();
        const alreadyDeliveredCourseSet = new Set();

        existingDeliveries.forEach(d => {
            const isDeliveryFull = d.paymentType === 'Full' || d.paymentType === 'Installment';
            (d.items || []).forEach(item => {
                if (item.courseId) {
                    alreadyDeliveredCourseSet.add(`${item.courseId}`);
                }
                if (item.tuteName) {
                    const norm = normalizeTuteText(item.tuteName);
                    const base = getBaseSubjectName(item.tuteName);
                    if (norm) {
                        alreadyDeliveredExactSet.add(norm);
                        if (item.courseId) alreadyDeliveredExactSet.add(`${item.courseId}_${norm}`);
                    }
                    if (base && isDeliveryFull) {
                        alreadyDeliveredBaseSet.add(base);
                        if (item.courseId) alreadyDeliveredBaseSet.add(`${item.courseId}_${base}`);
                    }
                }
            });
        });

        // Filter out already delivered tutes in this scope
        const newDeliverableItems = deliverableItems.filter(item => {
            const norm = item.tuteName ? normalizeTuteText(item.tuteName) : null;
            const base = item.tuteName ? getBaseSubjectName(item.tuteName) : null;
            const keyCourse = `${item.courseId}`;

            // 1. Exact tute name already delivered in this batch (e.g. same lesson book like "PS - Lesson 02")
            if (norm && alreadyDeliveredExactSet.has(norm)) return false;
            if (norm && item.courseId && alreadyDeliveredExactSet.has(`${item.courseId}_${norm}`)) return false;

            // 2. For Full / Installment payments:
            if (pType === 2 || pType === 3) {
                // If the exact courseId was already delivered
                if (alreadyDeliveredCourseSet.has(keyCourse)) return false;
                // If base subject was already delivered in Full (e.g. "Sinhala Full" when "Sinhala" was already delivered)
                if (base && alreadyDeliveredBaseSet.has(base)) return false;
                if (base && item.courseId && alreadyDeliveredBaseSet.has(`${item.courseId}_${base}`)) return false;
            }

            return true;
        });

        if (newDeliverableItems.length === 0) {
            console.log(`[DELIVERY] All tutes for Payment #${payment.id} have already been delivered in this scope (${paymentTypeStr}). Skipping duplicate delivery.`);
            return null;
        }

        // 5. Create Delivery in Pending status (or Delivered if self-picked)
        const delivery = await prisma.delivery.create({
            data: {
                paymentId: payment.id,
                studentId: payment.studentId.toString(),
                businessId: payment.businessId,
                paymentType: paymentTypeStr,
                status: isSelfPicked ? 'Delivered' : 'Pending',
                items: {
                    create: newDeliverableItems.map(item => ({
                        courseId: item.courseId,
                        tuteName: item.tuteName || "Tute",
                        tuteImage: item.tuteImage || null,
                        quantity: item.quantity || 1
                    }))
                }
            }
        });

        console.log(`🚚 Auto Delivery created (ORD-${delivery.id}) for Payment #${payment.id} with ${newDeliverableItems.length} items.`);
        return delivery;
    } catch (error) {
        console.error(`[DELIVERY ERROR] Failed in createAutoDeliveryForPayment for Payment #${payment?.id}:`, error);
        return null;
    }
};

// ==========================================
// 🏦 PAYMENT CONTROLLER LOGIC (ADMIN)
// ==========================================

let leadIndexCache = null;
let leadIndexCacheExpiry = 0;

async function getPhoneLeadMap() {
    const now = Date.now();
    if (leadIndexCache && now < leadIndexCacheExpiry) {
        return leadIndexCache;
    }
    const leads = await prisma.lead.findMany({
        select: { 
            phone: true, 
            batchId: true, 
            inquiryType: true, 
            campaignType: true,
            assignedTo: true,
            assignedUser: { select: { id: true, firstName: true, lastName: true } }
        }
    });
    const map = new Map();
    for (let i = 0; i < leads.length; i++) {
        const l = leads[i];
        if (!l.phone) continue;
        const pClean = l.phone.split('_')[0].replace(/[^0-9]/g, '');
        if (pClean.length >= 9) {
            const p9 = pClean.slice(-9);
            let arr = map.get(p9);
            if (!arr) {
                arr = [];
                map.set(p9, arr);
            }
            arr.push(l);
        }
    }
    leadIndexCache = map;
    leadIndexCacheExpiry = now + 60000; // cache for 60 seconds
    return map;
}

function resolveLeadDetails(p, phoneLeadMap) {
    if (!p.student) {
        return {
            source: 'DIRECT',
            staffId: null,
            staffName: 'Direct / Untracked'
        };
    }
    const rawPhones = [p.student.phone, p.student.whatsapp, p.student.optionalPhone].filter(Boolean);
    let matchedLeads = [];
    for (const ph of rawPhones) {
        const c = String(ph).replace(/[^0-9]/g, '');
        if (c.length >= 9) {
            const p9 = c.slice(-9);
            const ml = phoneLeadMap.get(p9);
            if (ml) matchedLeads.push(...ml);
        }
    }
    if (matchedLeads.length === 0) {
        return {
            source: 'DIRECT',
            staffId: null,
            staffName: 'Direct / Untracked'
        };
    }

    // 1. Exact batch lead with explicit inquiryType (NEW_INQ, OPEN_SEMINAR, NORMAL)
    let best = matchedLeads.find(l => l.batchId === p.batchId && (l.inquiryType === 'NEW_INQ' || l.inquiryType === 'OPEN_SEMINAR' || l.inquiryType === 'NORMAL'));
    // 2. Exact batch lead
    if (!best) best = matchedLeads.find(l => l.batchId === p.batchId);
    // 3. Any lead with explicit inquiryType
    if (!best) best = matchedLeads.find(l => l.inquiryType === 'NEW_INQ' || l.inquiryType === 'OPEN_SEMINAR' || l.inquiryType === 'NORMAL');
    // 4. Fallback to first matched lead
    if (!best) best = matchedLeads[0];

    let source = 'DIRECT';
    if (best.inquiryType === 'NEW_INQ') {
        source = 'NEW_INQ';
    } else if (best.inquiryType === 'OPEN_SEMINAR' || best.inquiryType === 'NORMAL' || best.campaignType === 'FREE_SEMINAR' || best.campaignType === 'AFTER_SEMINAR') {
        source = 'OPEN_SEMINAR';
    }

    // Resolve assigned staff from best lead, or fallback to any matched lead with assigned staff
    let assignedStaff = (best && best.assignedUser) ? best.assignedUser : null;
    let assignedStaffId = (best && best.assignedTo) ? best.assignedTo : null;
    if (!assignedStaff && matchedLeads.length > 0) {
        const anyAssigned = matchedLeads.find(l => l.assignedUser);
        if (anyAssigned) {
            assignedStaff = anyAssigned.assignedUser;
            assignedStaffId = anyAssigned.assignedTo;
        }
    }

    const staffName = assignedStaff 
        ? `${assignedStaff.firstName || ''} ${assignedStaff.lastName || ''}`.trim() 
        : (source === 'DIRECT' ? 'Direct / Untracked' : 'Unassigned / Direct');

    return {
        source,
        staffId: assignedStaffId || null,
        staffName: staffName || 'Unassigned / Direct'
    };
}

function resolveLeadSource(p, phoneLeadMap) {
    return resolveLeadDetails(p, phoneLeadMap).source;
}

// 1. Get All Payments
exports.getPayments = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.id;
        const userRole = req.user.role;
        const businessType = req.user.businessType;
        const userDepartment = req.user.department;
        
        const roleUpper = userRole ? userRole.toUpperCase().replace(/ /g, '_') : '';
        const isAdmin = ['SYSTEM_ADMIN', 'DIRECTOR'].includes(roleUpper) || userDepartment === 'Finance';
        
        let whereClause = {};
        
        if (!isAdmin) {
            const allBiz = await prisma.business.findMany();
            const myBizs = allBiz.filter(biz => {
                const isManagerOf = biz.head_manager_id === userId || biz.ass_manager_id === userId;
                const matchesBizType = businessType && (
                    String(biz.id) === String(businessType).trim() ||
                    biz.name.toLowerCase().trim() === String(businessType).toLowerCase().trim() ||
                    biz.name.toLowerCase().includes(String(businessType).toLowerCase().trim()) ||
                    String(businessType).toLowerCase().trim().includes(biz.name.toLowerCase().trim())
                );
                return isManagerOf || matchesBizType;
            });
            const myBizIds = myBizs.map(b => b.id);
            whereClause = { businessId: { in: myBizIds } };
        }

        const [phoneLeadMap, rawPayments] = await Promise.all([
            getPhoneLeadMap(),
            prisma.payment.findMany({
                where: whereClause,
                include: { student: true, business: true, batch: true, group: true },
                orderBy: { created_at: 'desc' }
            })
        ]);

        const paymentIds = rawPayments.map(p => p.id);
        const deliveries = await prisma.delivery.findMany({
            where: { paymentId: { in: paymentIds } }
        });
        const deliveryMap = {};
        deliveries.forEach(d => deliveryMap[d.paymentId] = true);

        const allCourses = await prisma.course.findMany({ select: { id: true, name: true, price: true, code: true, isDiscountExcluded: true, courseType: true, groupId: true } });
        const courseMap = {};
        allCourses.forEach(c => courseMap[c.id] = c);

        const allInstallments = await prisma.installment.findMany();
        const today = new Date();

        const formattedPayments = await Promise.all(rawPayments.map(async (p) => {

            // 🔥 ALUTH DEBUG කෑල්ල: Shehara ගේ විස්තර හරියටම බලමු
            if (p.student && (p.student.firstName.includes('Shehara') || p.student.id === 752)) {
                console.log(`\n👉 [DEBUG] Payment ID: ${p.id} | Student: STU-${p.studentId}`);
                console.log(`   - DB Real Status: ${p.status} | Payment Type: ${p.payment_type}`);
                console.log(`   - Valid Until: ${p.valid_until} | Post Pay Days: ${p.post_pay_days}`);
            }

            let currentStatus = 'Pending';

            if (p.status === 5) currentStatus = 'Trash';
            // 🔥 AUTO EXPIRE LOGIC REMOVED AS PER REQUIREMENT - MONTHLY PAYMENTS NO LONGER EXPIRE
            // 🔥 Post Pay 7 Days Expire Check (Auto revert to Pending & Revoke Access)
            else if (p.status === 4 && p.valid_until && new Date(p.valid_until) < today) {
                currentStatus = 'Pending';
                await prisma.payment.update({ where: { id: p.id }, data: { status: 0, valid_until: null, post_pay_days: 0 } });
            }
            else if (p.status === 0 && p.method === 'Upcoming') currentStatus = 'Upcoming';
            else if (p.status === 0) currentStatus = 'Pending';
            else if (p.status === 1) {
                if (p.amount === 0 && p.remark && p.remark.includes('Free Card')) currentStatus = 'Free Card';
                else if (p.remark && p.remark.includes('Custom Breakdown')) currentStatus = 'Discount';
                else currentStatus = 'Approved';
            }
            else if (p.status === 2) currentStatus = 'Rejected';
            else if (p.status === 3) currentStatus = 'Non Paid';
            else if (p.status === 4) currentStatus = 'Post Pay';

            // 🔥 Status Check කරාට පස්සේ Current Status එක Print කරමු
            if (p.student && (p.student.firstName.includes('Shehara') || p.student.id === 752)) {
                console.log(`   - Mapped Status (Going to Frontend): ${currentStatus}`);
            }

            let systemTotal = 0; let parsedSubjects = []; let totalPhases = 1;

            if (p.subjects) {
                try {
                    const subIds = JSON.parse(p.subjects).map(id => parseInt(id));
                    
                    let customPricesMap = {};
                    if (p.remark && p.remark.includes('[CUSTOM_PRICES:')) {
                        try {
                            const match = p.remark.match(/\[CUSTOM_PRICES:({.*?})\]/);
                            if (match) {
                                customPricesMap = JSON.parse(match[1]);
                            }
                        } catch (e) { }
                    }

                    // Get group discount rules if any
                    let activeGroupDiscount = null;
                    if (p.group && p.group.discount_rules && (!p.remark || !p.remark.includes('[UPGRADE]'))) {
                        try {
                            const rules = JSON.parse(p.group.discount_rules);
                            if (Array.isArray(rules)) {
                                rules.sort((a, b) => b.courseCount - a.courseCount);
                                
                                const eligibleSubjectsCount = subIds.filter(id => {
                                    const c = courseMap[id];
                                    return c && !c.isDiscountExcluded;
                                }).length;

                                for (let rule of rules) {
                                    if (eligibleSubjectsCount >= rule.courseCount) {
                                        activeGroupDiscount = { 
                                            triggerCount: rule.courseCount, 
                                            packagePrice: (rule.packagePrice !== undefined && rule.packagePrice !== null && rule.packagePrice !== '') ? parseFloat(rule.packagePrice) : null,
                                            newPricePerCourse: (rule.pricePerCourse !== undefined && rule.pricePerCourse !== null && rule.pricePerCourse !== '') ? parseFloat(rule.pricePerCourse) : null,
                                            fixedDiscount: (rule.fixedDiscount !== undefined && rule.fixedDiscount !== null && rule.fixedDiscount !== '') ? parseFloat(rule.fixedDiscount) : null
                                        };
                                        break;
                                    }
                                }
                            }
                        } catch (e) {}
                    }

                    if (activeGroupDiscount && activeGroupDiscount.packagePrice !== null && activeGroupDiscount.packagePrice !== undefined) {
                        let packagePriceAdded = false;
                        parsedSubjects = subIds.map(id => {
                            const course = courseMap[id];
                            let price = course ? parseFloat(course.price || 0) : 0;
                            const strId = String(id);
                            if (customPricesMap[strId] !== undefined) {
                                price = parseFloat(customPricesMap[strId]);
                                systemTotal += price;
                            } else if (course && course.isDiscountExcluded) {
                                systemTotal += price;
                            } else if (course && !course.isDiscountExcluded) {
                                if (!packagePriceAdded) {
                                    systemTotal += activeGroupDiscount.packagePrice;
                                    packagePriceAdded = true;
                                }
                            }
                            if (course) return { ...course, price };
                            return { id, name: 'Unknown Course', price, code: 'N/A' };
                        });
                    } else {
                        parsedSubjects = subIds.map(id => {
                            const course = courseMap[id];
                            let price = course ? parseFloat(course.price || 0) : 0;
                            const strId = String(id);
                            if (customPricesMap[strId] !== undefined) {
                                price = parseFloat(customPricesMap[strId]);
                            } else if (activeGroupDiscount && course && !course.isDiscountExcluded) {
                                if (activeGroupDiscount.newPricePerCourse !== null && activeGroupDiscount.newPricePerCourse !== undefined) {
                                    price = parseFloat(activeGroupDiscount.newPricePerCourse);
                                }
                            }
                            
                            if (course) {
                                systemTotal += price;
                                return { ...course, price };
                            }
                            return { id, name: 'Unknown Course', price, code: 'N/A' };
                        });

                        // Apply fixed discount if present in activeGroupDiscount
                        if (activeGroupDiscount && activeGroupDiscount.fixedDiscount !== null && activeGroupDiscount.fixedDiscount !== undefined) {
                            systemTotal -= parseFloat(activeGroupDiscount.fixedDiscount);
                        }
                    }

                    // Apply Bundle Discount if configured in AppSettings (Only for Upgrades!)
                    if (p.batchId && p.remark && p.remark.includes('[UPGRADE]')) {
                        const richConfigRec = await prisma.appSetting.findUnique({
                            where: { key: `UPGRADE_RICH_CONFIG_BATCH_${p.batchId}` }
                        });
                        if (richConfigRec) {
                            const rich = JSON.parse(richConfigRec.value);
                            if (rich && rich.enableBundle) {
                                const eligibleIds = rich.bundleSubjects ? rich.bundleSubjects.map(id => parseInt(id)) : [];
                                const allEligible = subIds.every(id => eligibleIds.includes(id));
                                if (allEligible) {
                                    if (subIds.length === 2 && rich.bundle2Price > 0) {
                                        systemTotal = parseFloat(rich.bundle2Price);
                                    } else if (subIds.length === 3 && rich.bundle3Price > 0) {
                                        systemTotal = parseFloat(rich.bundle3Price);
                                    }
                                }
                            }
                        }
                    }

                    if (p.payment_type === 2) {
                        const plan = allInstallments.find(i => i.batchId === p.batchId && i.subjectCount <= subIds.length);
                        if (plan && plan.details) {
                            try { totalPhases = JSON.parse(plan.details).length; } catch (e) { }
                        }
                    }
                } catch (e) { }
            }

            const walletBalance = parseFloat(p.student?.walletBalance || 0);
            const baseTotal = systemTotal;
            // Negative walletBalance means Arrears (Add to total), Positive means Excess (Reduce from total)
            systemTotal = systemTotal - walletBalance;
            if (systemTotal < 0) systemTotal = 0; // Prevent negative expected amount
            
            let resolvedClassType = 1;
            if (parsedSubjects.length > 0) {
                const hasPaper = parsedSubjects.some(s => s.courseType === 2);
                const hasTheory = parsedSubjects.some(s => s.courseType === 1);
                if (hasPaper && !hasTheory) resolvedClassType = 2;
                else if (hasTheory && !hasPaper) resolvedClassType = 1;
                else resolvedClassType = parseInt(p.group?.classType || 1, 10);
            } else {
                resolvedClassType = parseInt(p.group?.classType || 1, 10);
            }
            const classTypeName = resolvedClassType === 2 ? 'Paper Class' : 'Theory Class';

            const leadDetails = resolveLeadDetails(p, phoneLeadMap);

            return {
                id: p.id,
                studentId: p.studentId,
                studentName: p.student ? `${p.student.firstName} ${p.student.lastName}` : 'Unknown',
                phone: p.student?.phone || p.student?.whatsapp || 'N/A',
                studentNo: p.student?.id ? `STU-${p.student.id}` : 'STU-000',
                businessId: p.businessId, batchId: p.batchId, groupId: p.groupId,
                business: p.business?.name || 'N/A', batch: p.batch?.name || 'N/A',
                groupName: p.group?.name || 'Unknown',
                classType: resolvedClassType,
                classTypeName: classTypeName,
                amount: p.amount || 0,
                systemTotal: systemTotal,
                baseTotal: baseTotal,
                walletBalance: walletBalance,
                isUpgrade: p.remark ? p.remark.includes('[UPGRADE]') : false,
                subjectsList: parsedSubjects,
                type: parseInt(p.payment_type) === 1 ? 'Monthly' : (parseInt(p.payment_type) === 2 ? 'Installment' : 'Full'),
                method: p.method || 'Slip',
                status: currentStatus,
                date: p.created_at ? new Date(p.created_at).toISOString().split('T')[0] : '-',
                dueDate: p.due_date ? new Date(p.due_date).toISOString().split('T')[0] : null,
                installmentNo: p.installment_no || 1,
                totalPhases: totalPhases,
                slips: p.slip_image ? p.slip_image.split(',') : [],
                remark: p.remark || '',
                daysLeft: p.post_pay_days || 0,
                validUntil: p.valid_until,
                excessAmount: p.excessAmount || 0,
                arrearsAmount: p.arrearsAmount || 0,
                hasDelivery: deliveryMap[p.id] || false,
                aiVerified: p.aiVerified || false,
                inquirySource: leadDetails.source,
                assignedStaffId: leadDetails.staffId,
                assignedStaffName: leadDetails.staffName
            };
        }));

        res.status(200).json(safeJson(formattedPayments));
    } catch (error) {
        res.status(500).json([]);
    }
};

// 2. Action for Standard Payments (Approve/Reject/Trash/SendToDelivery)
exports.paymentAction = async (req, res) => {
    try {
        const { paymentId, action, customAmount, remark, isSelfPicked, actualAmountPaid } = req.body;
        const adminId = req.user?.userId || req.user?.id;
        let updateData = {};
        if (adminId) {
            updateData.actionedById = parseInt(adminId);
        }

        const payRecord = await prisma.payment.findUnique({ where: { id: parseInt(paymentId) } });
        if (!payRecord) return res.status(404).json({ error: "Payment not found" });

        // 🔥 Send to Delivery Hub manually for Free Cards / Discounts
        if (action === 'SendToDelivery') {
            const existingDelivery = await prisma.delivery.findUnique({ where: { paymentId: parseInt(paymentId) } });
            if (!existingDelivery && payRecord.subjects) {
                try {
                    let subIds = JSON.parse(payRecord.subjects).map(id => parseInt(id));
                    
                    // Filter by selectedSubjectIds if provided from frontend modal
                    if (req.body.selectedSubjectIds && Array.isArray(req.body.selectedSubjectIds)) {
                        const selectedIds = req.body.selectedSubjectIds.map(id => parseInt(id));
                        subIds = subIds.filter(id => selectedIds.includes(id));
                    }

                    if (subIds.length === 0) {
                        return res.status(400).json({ error: "Please select at least one subject to send to delivery" });
                    }

                    const courses = await prisma.course.findMany({ where: { id: { in: subIds } } });
                    if (courses.length > 0) {
                        const deliverableItems = await getDeliverableCoursesForPayment(payRecord, courses);
                        if (!deliverableItems || deliverableItems.length === 0) {
                            return res.status(400).json({ error: "None of the selected courses have 'Deliver Tute' enabled in Content Hub." });
                        }
                        const paymentTypeStr = parseInt(payRecord.payment_type) === 1 ? 'Monthly' : (parseInt(payRecord.payment_type) === 2 ? 'Installment' : 'Full');
                        await prisma.delivery.create({
                            data: {
                                paymentId: payRecord.id, studentId: payRecord.studentId.toString(), businessId: payRecord.businessId,
                                paymentType: paymentTypeStr, status: 'Pending',
                                items: { create: deliverableItems }
                            }
                        });
                        return res.status(200).json({ message: `Sent to Delivery Hub successfully` });
                    }
                } catch (e) { return res.status(500).json({ error: "Failed to create delivery" }); }
            }
            return res.status(200).json({ message: `Already in Delivery Hub` });
        }

        if (action === 'Trash') {
            updateData.status = 5;
        } else if (action === 'Reject') {
            updateData.status = 2;
        } else if (action === 'Approve') {
            updateData.status = 1;
            updateData.post_pay_days = 0;

            // 🔥 WALLET SETTLEMENT LOGIC 🔥
            // ළමයාගේ wallet එකෙන් කොච්චර ගාණක් මේ payment එකට පාවිච්චි වුණාද කියලා හොයාගෙන ඒක settle කරනවා
            let appliedWalletBalance = 0;
            if (payRecord.remark) {
                const excessMatch = payRecord.remark.match(/Wallet Excess \(-LKR ([\d,.]+)\) applied/i);
                if (excessMatch) appliedWalletBalance = -parseFloat(excessMatch[1].replace(/,/g, ''));

                const dueMatch = payRecord.remark.match(/Wallet Due \(\+LKR ([\d,.]+)\) applied/i);
                if (dueMatch) appliedWalletBalance = parseFloat(dueMatch[1].replace(/,/g, ''));
            }

            const expectedAmount = parseFloat(payRecord.amount || 0);
            const actualPaid = actualAmountPaid !== undefined && actualAmountPaid !== null ? parseFloat(actualAmountPaid) : expectedAmount;
            const difference = actualPaid - expectedAmount;

            // ඇඩ්මින් වෙනස් කරපු ගාණයි, කලින් apply වෙලා තිබ්බ ගාණයි දෙකම සලකලා අවසන් wallet update එක හදනවා
            const totalWalletIncrement = difference + appliedWalletBalance;

            if (totalWalletIncrement !== 0) {
                await prisma.user.update({
                    where: { id: payRecord.studentId },
                    data: { walletBalance: { increment: totalWalletIncrement } }
                });
                updateData.excessAmount = difference > 0 ? difference : 0;
                updateData.arrearsAmount = difference < 0 ? Math.abs(difference) : 0;

                let sysNote = `[SYSTEM]: Wallet adjusted by LKR ${totalWalletIncrement > 0 ? '+' : ''}${totalWalletIncrement.toLocaleString()}`;
                if (appliedWalletBalance !== 0) sysNote += ` (Included settlement of LKR ${appliedWalletBalance > 0 ? '+' : ''}${appliedWalletBalance.toLocaleString()})`;

                updateData.remark = payRecord.remark
                    ? `${payRecord.remark}\n\n${sysNote}`
                    : sysNote;
            }
        } else if (action === 'Free Card') {
            updateData.status = 1;
            updateData.amount = 0;
            if (!remark) return res.status(400).json({ error: "Remark is required for Free Card" });
        } else if (action === 'Discount') {
            updateData.status = 1;
            updateData.amount = parseFloat(customAmount || 0);
            if (!remark) return res.status(400).json({ error: "Remark is required for Discount" });
        }

        // Validity Date සෙට් කිරීම
        if (['Approve', 'Free Card', 'Discount'].includes(action)) {
            if (parseInt(payRecord.payment_type) === 1) {
                let validDate = new Date();
                validDate.setDate(validDate.getDate() + 30);
                updateData.valid_until = validDate;
            }
        }

        if (remark && action !== 'Trash') {
            updateData.remark = updateData.remark
                ? `${updateData.remark}\n\n[ADMIN]: ${remark}`
                : (payRecord.remark ? `${payRecord.remark}\n\n[ADMIN]: ${remark}` : `[ADMIN]: ${remark}`);
        }

        const updatedPayment = await prisma.payment.update({
            where: { id: parseInt(paymentId) },
            data: updateData
        });

        // Sync leads and CRM
        if (['Approve', 'Free Card', 'Discount'].includes(action)) {
            await syncLeadEnrollment(updatedPayment.studentId, updatedPayment.payment_type, updatedPayment);
        }

        // 🔥 Auto Delivery ONLY for normal Approve (Not Free Card/Discount)
        if (action === 'Approve') {
            if (updatedPayment.subjects) {
                try {
                    await createAutoDeliveryForPayment(updatedPayment, isSelfPicked);
                } catch (e) {
                    console.error("Auto Delivery Creation Error on Approve:", e);
                }
            }
        }

        // Auto-generate next installment phase if approving an installment
        if (action === 'Approve' && parseInt(updatedPayment.payment_type) === 2) {
            try {
                await createNextInstallmentPhase(updatedPayment);
            } catch (instErr) {
                console.error("Auto next installment error in paymentAction:", instErr);
            }
        }

        // Trigger GSheet sync asynchronously for Approve/Reject/Free Card/Discount
        if (['Approve', 'Free Card', 'Discount', 'Reject'].includes(action)) {
            markPaymentOnGSheet(paymentId).catch(e => console.error("GSheet Update Error:", e));
        }

        res.status(200).json({ message: `Payment processed as ${action}` });
    } catch (error) {
        res.status(500).json({ error: "Action failed" });
    }
};

const createNextInstallmentPhase = async (payRecord, nextDueDate = null) => {
    if (!payRecord || !payRecord.subjects || parseInt(payRecord.payment_type) !== 2) return null;

    try {
        const subIds = typeof payRecord.subjects === 'string' ? JSON.parse(payRecord.subjects) : payRecord.subjects;

        const plan = await prisma.installment.findFirst({
            where: {
                batchId: payRecord.batchId,
                subjectCount: { lte: subIds.length }
            },
            orderBy: { subjectCount: 'desc' }
        });

        if (plan && plan.details) {
            const phases = JSON.parse(plan.details);

            const currentInstallment = payRecord.installment_no || 1;
            const currentPhaseIndex = currentInstallment - 1;

            if (currentPhaseIndex + 1 < phases.length) {
                const nextPhase = phases[currentPhaseIndex + 1];

                const existingNext = await prisma.payment.findFirst({
                    where: {
                        studentId: payRecord.studentId,
                        batchId: payRecord.batchId,
                        payment_type: 2,
                        installment_no: currentInstallment + 1
                    }
                });

                if (existingNext) return existingNext;

                let finalNextDueDate = nextDueDate ? new Date(nextDueDate) : new Date(payRecord.updatedAt || new Date());
                if (!nextDueDate) {
                    const currentPhase = phases[currentPhaseIndex];
                    const gapDays = parseInt(currentPhase.gapDays || '30', 10);
                    finalNextDueDate.setDate(finalNextDueDate.getDate() + gapDays);
                }

                const nextPhaseAmount = parseFloat(nextPhase.price || nextPhase.amount || 0);

                const nextPay = await prisma.payment.create({
                    data: {
                        studentId: payRecord.studentId,
                        businessId: payRecord.businessId,
                        batchId: payRecord.batchId,
                        groupId: payRecord.groupId,
                        subjects: typeof payRecord.subjects === 'string' ? payRecord.subjects : JSON.stringify(payRecord.subjects),
                        payment_type: 2,
                        method: 'Upcoming',
                        status: 0,
                        amount: nextPhaseAmount,
                        installment_no: currentInstallment + 1,
                        due_date: finalNextDueDate
                    }
                });

                console.log(`[Installment] Auto-generated Phase #${currentInstallment + 1} for Student #${payRecord.studentId}, Due: ${finalNextDueDate.toISOString()}`);
                return nextPay;
            }
        }
    } catch (e) {
        console.error("🔥 Auto-Generate Next Installment Error:", e);
    }
    return null;
};
exports.createNextInstallmentPhase = createNextInstallmentPhase;

exports.approveInstallment = async (req, res) => {
    try {
        const { paymentId, actualAmountPaid, remark, isSelfPicked, nextDueDate } = req.body;
        const adminId = req.user?.userId || req.user?.id;

        const payRecord = await prisma.payment.findUnique({ where: { id: parseInt(paymentId) } });
        if (!payRecord) return res.status(404).json({ error: "Payment not found" });

        let updateData = { status: 1, post_pay_days: 0 };
        if (adminId) {
            updateData.actionedById = parseInt(adminId);
        }

        // 🔥 WALLET SETTLEMENT LOGIC 🔥
        let appliedWalletBalance = 0;
        if (payRecord.remark) {
            const excessMatch = payRecord.remark.match(/Wallet Excess \(-LKR ([\d,.]+)\) applied/i);
            if (excessMatch) appliedWalletBalance = -parseFloat(excessMatch[1].replace(/,/g, ''));

            const dueMatch = payRecord.remark.match(/Wallet Due \(\+LKR ([\d,.]+)\) applied/i);
            if (dueMatch) appliedWalletBalance = parseFloat(dueMatch[1].replace(/,/g, ''));
        }

        const expectedAmount = parseFloat(payRecord.amount || 0);
        const actualPaid = actualAmountPaid !== undefined && actualAmountPaid !== null ? parseFloat(actualAmountPaid) : expectedAmount;
        const difference = actualPaid - expectedAmount;

        const totalWalletIncrement = difference + appliedWalletBalance;

        if (totalWalletIncrement !== 0) {
            await prisma.user.update({
                where: { id: payRecord.studentId },
                data: { walletBalance: { increment: totalWalletIncrement } }
            });
            updateData.excessAmount = difference > 0 ? difference : 0;
            updateData.arrearsAmount = difference < 0 ? Math.abs(difference) : 0;

            let sysNote = `[SYSTEM]: Wallet adjusted by LKR ${totalWalletIncrement > 0 ? '+' : ''}${totalWalletIncrement.toLocaleString()}`;
            if (appliedWalletBalance !== 0) sysNote += ` (Included settlement of LKR ${appliedWalletBalance > 0 ? '+' : ''}${appliedWalletBalance.toLocaleString()})`;

            updateData.remark = payRecord.remark
                ? `${payRecord.remark}\n\n${sysNote}`
                : sysNote;
        }

        if (remark) {
            updateData.remark = updateData.remark
                ? `${updateData.remark}\n\n[ADMIN]: ${remark}`
                : (payRecord.remark ? `${payRecord.remark}\n\n[ADMIN]: ${remark}` : `[ADMIN]: ${remark}`);
        }

        if (nextDueDate) {
            updateData.due_date = new Date(nextDueDate);
        }

        const updatedPayment = await prisma.payment.update({
            where: { id: parseInt(paymentId) },
            data: updateData
        });

        await syncLeadEnrollment(updatedPayment.studentId, updatedPayment.payment_type, updatedPayment);

        // 🔥 Auto Delivery Logic (Scoped deduplication check)
        if (updatedPayment.subjects) {
            try {
                await createAutoDeliveryForPayment(updatedPayment, isSelfPicked);
            } catch (e) {
                console.error("Delivery Creation Error in approveInstallment:", e);
            }
        }

        // 🔥 NEXT PHASE GENERATION LOGIC
        await createNextInstallmentPhase(payRecord, nextDueDate);

        // Trigger GSheet sync asynchronously
        markPaymentOnGSheet(paymentId).catch(e => console.error("GSheet Update Error in approveInstallment:", e));

        res.status(200).json({ message: "Installment approved successfully" });
    } catch (error) {
        console.error("Installment Approval General Error:", error);
        res.status(500).json({ error: "Failed to approve installment" });
    }
};

// 4. Grant Post Pay (Temporary Access) - Auto generates 7 days
exports.grantPostPay = async (req, res) => {
    try {
        const { paymentId } = req.body;

        let validDate = new Date();
        validDate.setDate(validDate.getDate() + 7); // Exactly 7 days

        await prisma.payment.update({
            where: { id: parseInt(paymentId) },
            data: { status: 4, post_pay_days: 7, valid_until: validDate }
        });

        res.status(200).json({ message: `Access granted for 7 days` });
    } catch (error) {
        res.status(500).json({ error: "Failed to grant access" });
    }
};

// 5. Get All Courses
exports.getAllCourses = async (req, res) => {
    try {
        const courses = await prisma.course.findMany({
            orderBy: { name: 'asc' }
        });
        res.status(200).json(safeJson(courses));
    } catch (e) {
        res.status(500).json([]);
    }
};

// 6. Update Payment Details (Subjects and Amount)
exports.updatePaymentDetails = async (req, res) => {
    try {
        const { paymentId, subjects, customPrices, amount } = req.body;

        if (!paymentId || !Array.isArray(subjects)) {
            return res.status(400).json({ error: "Invalid paymentId or subjects array." });
        }

        const payRecord = await prisma.payment.findUnique({ where: { id: parseInt(paymentId) } });
        if (!payRecord) return res.status(404).json({ error: "Payment not found" });

        // Calculate expected total based on customPrices
        let systemTotal = 0;
        const allCourses = await prisma.course.findMany({ select: { id: true, price: true } });
        const courseMap = {};
        allCourses.forEach(c => courseMap[c.id] = c);

        subjects.forEach(id => {
            const courseId = parseInt(id);
            let price = courseMap[courseId] ? parseFloat(courseMap[courseId].price || 0) : 0;
            if (customPrices && customPrices[courseId] !== undefined) {
                price = parseFloat(customPrices[courseId]);
            }
            systemTotal += price;
        });

        const diff = parseFloat(amount) - systemTotal;
        const excessAmount = diff > 0 ? diff : 0;
        const arrearsAmount = diff < 0 ? Math.abs(diff) : 0;

        let cleanRemark = payRecord.remark || "";
        cleanRemark = cleanRemark.replace(/\[CUSTOM_PRICES:.*?\]/g, "").trim();

        let finalRemark = cleanRemark;
        if (customPrices && Object.keys(customPrices).length > 0) {
            const customPricesStr = `[CUSTOM_PRICES:${JSON.stringify(customPrices)}]`;
            finalRemark = cleanRemark ? `${cleanRemark}\n\n${customPricesStr}` : customPricesStr;
        }

        // Update the payment record
        const updatedPayment = await prisma.payment.update({
            where: { id: parseInt(paymentId) },
            data: {
                subjects: JSON.stringify(subjects.map(id => parseInt(id))),
                amount: parseFloat(amount),
                excessAmount: excessAmount,
                arrearsAmount: arrearsAmount,
                remark: finalRemark || null
            }
        });

        // Sync with tute deliveries if they exist
        const delivery = await prisma.delivery.findUnique({
            where: { paymentId: parseInt(paymentId) }
        });

        if (delivery) {
            // Fetch new courses
            const courses = await prisma.course.findMany({
                where: { id: { in: subjects.map(id => parseInt(id)) } }
            });

            const deliverableItems = await getDeliverableCoursesForPayment(updatedPayment, courses);

            if (deliverableItems.length > 0) {
                // Delete old items and re-create updated items
                await prisma.deliveryItem.deleteMany({
                    where: { deliveryId: delivery.id }
                });

                await prisma.deliveryItem.createMany({
                    data: deliverableItems.map(item => ({
                        deliveryId: delivery.id,
                        courseId: item.courseId,
                        tuteName: item.tuteName,
                        tuteImage: item.tuteImage || null,
                        quantity: item.quantity || 1
                    }))
                });
            } else {
                // If no deliverable tutes exist under Content Hub rules, remove the orphaned delivery
                await prisma.deliveryItem.deleteMany({ where: { deliveryId: delivery.id } });
                await prisma.delivery.delete({ where: { id: delivery.id } });
            }
        }

        res.status(200).json({ message: "Payment details updated successfully", payment: updatedPayment });
    } catch (error) {
        console.error("Update payment details error:", error);
        res.status(500).json({ error: "Failed to update payment details" });
    }
};

exports.getStaffStatsReport = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const userRole = req.user?.role;
        const businessType = req.user?.businessType;
        const userDepartment = req.user?.department;
        
        const roleUpper = userRole ? userRole.toUpperCase().replace(/ /g, '_') : '';
        const isAdmin = ['SYSTEM_ADMIN', 'DIRECTOR'].includes(roleUpper) || userDepartment === 'Finance';

        const { dateFrom, dateTo, verificationMethod, action, dateBasis } = req.query;

        let where = {};
        const dateField = (dateBasis === 'created_at' || dateBasis === 'upload') ? 'created_at' : 'updatedAt';
        
        if (!isAdmin && userId) {
            const allBiz = await prisma.business.findMany();
            const myBizs = allBiz.filter(biz => {
                const isManagerOf = biz.head_manager_id === userId || biz.ass_manager_id === userId;
                const matchesBizType = businessType && (
                    String(biz.id) === String(businessType).trim() ||
                    biz.name.toLowerCase().trim() === String(businessType).toLowerCase().trim() ||
                    biz.name.toLowerCase().includes(String(businessType).toLowerCase().trim()) ||
                    String(businessType).toLowerCase().trim().includes(biz.name.toLowerCase().trim())
                );
                return isManagerOf || matchesBizType;
            });
            const myBizIds = myBizs.map(b => b.id);
            
            // If the manager has no businesses, they shouldn't see anything.
            if (myBizIds.length === 0) {
                return res.status(200).json({
                    success: true,
                    data: [],
                    summary: { aiVerified: 0, manualVerified: 0, rejected: 0, total: 0 }
                });
            }
            where.businessId = { in: myBizIds };
        }

        if (dateFrom && dateTo) {
            const startDate = dateFrom.includes('T') ? new Date(dateFrom) : new Date(`${dateFrom}T00:00:00.000Z`);
            const endDate = dateTo.includes('T') ? new Date(dateTo) : new Date(`${dateTo}T23:59:59.999Z`);
            where[dateField] = {
                gte: startDate,
                lte: endDate
            };
        } else if (dateFrom) {
            const startDate = dateFrom.includes('T') ? new Date(dateFrom) : new Date(`${dateFrom}T00:00:00.000Z`);
            where[dateField] = { gte: startDate };
        } else if (dateTo) {
            const endDate = dateTo.includes('T') ? new Date(dateTo) : new Date(`${dateTo}T23:59:59.999Z`);
            where[dateField] = { lte: endDate };
        }

        if (verificationMethod === 'ai') {
            where.aiVerified = true;
        } else if (verificationMethod === 'manual') {
            where.aiVerified = false;
        }

        if (action === 'approved') {
            where.status = 1;
        } else if (action === 'rejected') {
            where.status = 2;
        } else if (action === 'postpay') {
            where.status = 4;
        } else if (action === 'pending') {
            where.status = 0;
        } else if (['quick_approve', 'discount_approve', 'adjust_approve', 'upgrade_approve', 'installment_approve'].includes(action)) {
            where.status = 1;
        } else {
            // Default "All Actions" includes all verified/actioned slips (status: 1 Approved, 2 Rejected, 4 Postpay)
            where.status = { in: [1, 2, 4] };
        }

        // 🔥 Remove artificial take: 1000 limit so all slips in the period are fetched & counted accurately!
        const payments = await prisma.payment.findMany({
            where,
            include: {
                student: { select: { firstName: true, lastName: true, phone: true } },
                actionedUser: { select: { firstName: true, lastName: true } },
                batch: { select: { name: true } },
                business: { select: { name: true } }
            },
            orderBy: { updatedAt: 'desc' }
        });

        let summary = {
            aiVerified: 0,
            manualVerified: 0,
            rejected: 0,
            postpay: 0,
            total: payments.length,
            quickApprove: 0,
            discountApprove: 0,
            adjustApprove: 0,
            upgradeApprove: 0,
            installmentApprove: 0
        };

        const reportData = payments.map(p => {
            const isAi = p.aiVerified === true;
            if (isAi && p.status === 1) summary.aiVerified++;
            else if (!isAi && p.status === 1) summary.manualVerified++;
            else if (p.status === 2) summary.rejected++;
            else if (p.status === 4) summary.postpay = (summary.postpay || 0) + 1;

            let approveType = null;
            if (p.status === 1) {
                const isUpgrade = p.remark && p.remark.includes('[UPGRADE]');
                const isAdjusted = parseFloat(p.excessAmount || 0) > 0 || parseFloat(p.arrearsAmount || 0) > 0;
                const isInstallment = p.payment_type === 2;
                const isDiscount = (p.remark && (p.remark.includes('Custom Breakdown') || p.remark.toLowerCase().includes('discount'))) || p.amount === 0;
                
                if (isUpgrade) {
                    approveType = 'Upgrade Approve';
                    summary.upgradeApprove++;
                } else if (isAdjusted) {
                    approveType = 'Adjust Approve';
                    summary.adjustApprove++;
                } else if (isInstallment) {
                    approveType = 'Installment Approve';
                    summary.installmentApprove++;
                } else if (isDiscount) {
                    approveType = 'Discount Approve';
                    summary.discountApprove++;
                } else {
                    approveType = 'Quick Approve';
                    summary.quickApprove++;
                }
            } else if (p.status === 2) {
                approveType = 'Rejected';
            } else if (p.status === 4) {
                approveType = 'Postpay';
            }

            let verifiedBy = 'Unknown';
            if (p.actionedUser) {
                verifiedBy = `${p.actionedUser.firstName} ${p.actionedUser.lastName || ''}`.trim();
            } else if (isAi) {
                verifiedBy = 'AI System';
            } else if (p.method === 'PayHere') {
                verifiedBy = 'PayHere Gateway';
            } else if (p.remark && p.remark.includes('[ADMIN]')) {
                verifiedBy = 'Admin User';
            } else {
                verifiedBy = 'System / Staff';
            }

            return {
                id: p.id,
                paymentId: p.id,
                amount: p.amount,
                status: p.status,
                isAiVerified: isAi,
                verifiedBy,
                studentName: p.student ? `${p.student.firstName} ${p.student.lastName || ''}`.trim() : 'Unknown',
                studentPhone: p.student?.phone || '',
                batch: p.batch?.name || '-',
                batchName: p.batch?.name || '-',
                business: p.business?.name || '-',
                businessName: p.business?.name || '-',
                createdAt: p.created_at,
                updatedAt: p.updatedAt,
                approveType,
                method: p.method || 'Slip'
            };
        });

        // Filter the final data if a specific sub-approval type was requested
        let finalReportData = reportData;
        if (action === 'quick_approve') {
            finalReportData = reportData.filter(r => r.approveType === 'Quick Approve');
        } else if (action === 'discount_approve') {
            finalReportData = reportData.filter(r => r.approveType === 'Discount Approve');
        } else if (action === 'adjust_approve') {
            finalReportData = reportData.filter(r => r.approveType === 'Adjust Approve');
        } else if (action === 'upgrade_approve') {
            finalReportData = reportData.filter(r => r.approveType === 'Upgrade Approve');
        } else if (action === 'installment_approve') {
            finalReportData = reportData.filter(r => r.approveType === 'Installment Approve');
        }

        res.status(200).json({
            success: true,
            data: finalReportData,
            summary
        });
    } catch (error) {
        console.error("Staff stats report error:", error);
        res.status(500).json({ error: "Failed to generate staff stats report" });
    }
};

exports.syncLeadEnrollment = syncLeadEnrollment;
exports.getDeliverableCoursesForPayment = getDeliverableCoursesForPayment;
exports.createAutoDeliveryForPayment = createAutoDeliveryForPayment;
