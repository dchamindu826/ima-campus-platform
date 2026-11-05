const { PrismaClient } = require('@prisma/client');
const prisma = require('../../src/core/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

// ytdl-core අයින් කරලා මේ දෙක දාගන්න (yt-dlp පාවිච්චි කරන නිසා)
const { execSync } = require('child_process');
const path = require('path');
const streamCache = {};
const contentController = require('../contentController'); // 🔥 Added for Zoom proxy
const { getStudentOverdueInstallmentBatchIds } = require('../studentController');
const { getStudentBatchAccess } = require('../../utils/installmentHelper');

const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

exports.getMobileBusinesses = async (req, res) => {
    try {
        const businesses = await prisma.business.findMany({
            where: { status: 1 },
            include: {
                batches: {
                    where: { status: 1 },
                    include: {
                        groups: { include: { courses: true } }
                    }
                }
            }
        });

        const formattedBusinesses = businesses.map(biz => {
            return {
                id: biz.id,
                name: biz.name,
                category: biz.category,
                streams: biz.streams || "All",
                logo: biz.logo || "default.png",
                batches: biz.batches.map(batch => {
                    return {
                        id: batch.id,
                        name: batch.name,
                        type: batch.type || 1,
                        logo: batch.logo || "default.png",
                        groups: batch.groups.map(g => ({
                            id: g.id,
                            name: g.name,
                            type: g.type,
                            classType: g.classType || 1,
                            itemOrder: g.itemOrder || 1,
                            discount_rules: g.discount_rules,
                            courses: g.courses.map(c => ({
                                id: c.id,
                                name: c.name,
                                code: c.code,
                                price: c.price,
                                courseType: c.courseType || g.classType || 1,
                                stream: c.stream || "All",
                                streams: c.streams,
                                isDiscountExcluded: c.isDiscountExcluded,
                                lecturerName: c.lecturerName, 
                                groupPrices: c.groupPrices
                            }))
                        }))
                    }
                })
            }
        });

        res.status(200).json({ businesses: safeJson(formattedBusinesses) });
    } catch (error) {
        console.error("Mobile Get Businesses Error:", error);
        res.status(500).json({ error: "Failed to load courses" });
    }
};

exports.getMobileInstallments = async (req, res) => {
    try {
        const { batchId } = req.params;
        const plans = await prisma.installment.findMany({ where: { batchId: parseInt(batchId) } });
        res.status(200).json(safeJson(plans));
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch installments" });
    }
};

exports.getMobilePayments = async (req, res) => {
    try {
        const studentId = req.user?.userId || req.user?.id;

        const payments = await prisma.payment.findMany({
            where: { studentId: parseInt(studentId) },
            include: { business: true, batch: true, group: true },
            orderBy: { created_at: 'desc' }
        });

        // Collect all course IDs from payments to resolve prices if amount is 0
        const allCourseIds = [];
        payments.forEach(p => {
            if (p.subjects) {
                try {
                    const parsed = typeof p.subjects === 'string' ? JSON.parse(p.subjects) : p.subjects;
                    if (Array.isArray(parsed)) allCourseIds.push(...parsed.map(Number).filter(Boolean));
                } catch(e) {}
            }
        });

        const coursePriceMap = new Map();
        if (allCourseIds.length > 0) {
            const courses = await prisma.course.findMany({
                where: { id: { in: [...new Set(allCourseIds)] } },
                select: { id: true, price: true }
            });
            courses.forEach(c => coursePriceMap.set(c.id, parseFloat(c.price || 0)));
        }

        let history = [];
        let upcoming = [];

        payments.forEach(p => {
            const isVerifying = p.status === -1 || (p.status === 0 && p.method === 'Slip');
            
            let resolvedAmount = parseFloat(p.amount || 0);
            if (resolvedAmount === 0 && p.remark) {
                const match = String(p.remark).match(/(?:Extracted Total|Target Amount|Wallet Excess \(-?LKR|Wallet Due \(\+?LKR|Wallet adjusted by LKR [+-]?|LKR|Rs\.?)\s*:?\s*(?:LKR|Rs\.?)?\s*([\d,]+(?:\.\d+)?)/i);
                if (match && match[1]) {
                    resolvedAmount = parseFloat(match[1].replace(/,/g, ''));
                }
            }

            if (resolvedAmount === 0 && p.subjects) {
                try {
                    const parsed = typeof p.subjects === 'string' ? JSON.parse(p.subjects) : p.subjects;
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        const sumPrice = parsed.map(Number).reduce((sum, id) => sum + (coursePriceMap.get(id) || 0), 0);
                        if (sumPrice > 0) resolvedAmount = sumPrice;
                    }
                } catch(e) {}
            }

            const basePayment = {
                id: p.id,
                businessId: p.businessId,
                batchId: p.batchId,
                groupId: p.groupId,
                courseName: `${p.business?.name || ''} - ${p.batch?.name || ''} - ${p.group?.name || 'Unknown'}`,
                groupName: p.group?.name,
                slips: p.slip_image ? p.slip_image.split(',') : [],
                amount: resolvedAmount,
                actualAmountPaid: resolvedAmount,
                remark: p.remark,
                status: p.status,
                method: p.method,
                createdDate: p.created_at,
                dueDate: p.due_date,
                isInstallment: p.payment_type === 2,
                installmentNo: p.installment_no,
                batchLogo: p.batch?.logo
            };

            if (p.status === 1 || p.status === 2 || p.status === 4 || isVerifying) {
                basePayment.displayStatus = (p.status === 1 || p.status === 4) ? 'Approved' 
                                            : p.status === 2 ? 'Rejected' 
                                            : 'Pending Review';
                history.push(basePayment);
            } else {
                upcoming.push(basePayment);
            }
        });

        res.status(200).json(safeJson({ history, upcoming }));
    } catch (error) {
        console.error("Mobile Payments Error:", error);
        res.status(500).json({ error: "Failed to load payments" });
    }
};

exports.getMobileClassroom = async (req, res) => {
    try {
        const studentId = req.user?.userId || req.user?.id || req.userId;

        const overdueBatchIds = await getStudentOverdueInstallmentBatchIds(studentId);

        const validPayments = await prisma.payment.findMany({
            where: { studentId: parseInt(studentId), status: { in: [1, 4] } }
        });

        // Filter out installment payments for batches with overdue installments,
        // unless the student also has a valid full or monthly payment for that batch
        const effectivePayments = validPayments.filter(p => {
            if (p.payment_type === 2 && overdueBatchIds.has(p.batchId)) {
                const hasValidAlternative = validPayments.some(other =>
                    other.id !== p.id &&
                    other.batchId === p.batchId &&
                    [1, 3].includes(other.payment_type) &&
                    other.status === 1
                );
                return hasValidAlternative;
            }
            return true;
        });

        if (effectivePayments.length === 0) return res.status(200).json([]);

        let allowedSubjectIds = [];
        let validBatchIds = [];
        let validGroupIds = [];

        effectivePayments.forEach(p => {
            if (p.batchId) validBatchIds.push(p.batchId);
            if (p.groupId) validGroupIds.push(p.groupId);
            if (p.subjects) {
                try { 
                    const parsedIds = JSON.parse(p.subjects).map(id => parseInt(id, 10));
                    allowedSubjectIds.push(...parsedIds);
                } catch(e){}
            }
        });

        validBatchIds = [...new Set(validBatchIds)];
        validGroupIds = [...new Set(validGroupIds)];
        const uniqueIds = [...new Set(allowedSubjectIds)];

        // 🔥 FIX: Apply the same fallback logic as Web for mobile!
        const paidCourses = await prisma.course.findMany({
            where: { id: { in: uniqueIds } },
            select: { id: true, code: true, name: true }
        });

        const groupsWithCourses = await prisma.group.findMany({
            where: { id: { in: validGroupIds } },
            include: { courses: true }
        });

        let finalAllowedCourseIds = new Set(uniqueIds); // Always include exact matches

        groupsWithCourses.forEach(group => {
            const paidSubjectIdsInThisGroup = [];
            effectivePayments.filter(p => p.groupId === group.id).forEach(p => {
                if (p.subjects && p.subjects !== '[]') {
                    try { paidSubjectIdsInThisGroup.push(...JSON.parse(p.subjects).map(Number)); } catch(e){}
                }
            });
            const paidCoursesInThisGroup = paidCourses.filter(pc => paidSubjectIdsInThisGroup.includes(pc.id));

            group.courses.forEach(c => {
                const hasFullGroupPayment = effectivePayments.some(p => p.groupId === group.id && (!p.subjects || p.subjects === '[]'));
                if (hasFullGroupPayment) {
                    finalAllowedCourseIds.add(c.id);
                    return;
                }
                for (const paidCourse of paidCoursesInThisGroup) {
                    if (c.code && paidCourse.code === c.code) finalAllowedCourseIds.add(c.id);
                    else if (c.name && paidCourse.name === c.name) finalAllowedCourseIds.add(c.id);
                }
            });
        });

        if (finalAllowedCourseIds.size === 0) return res.status(200).json([]);

        const mySubjects = await prisma.course.findMany({
            where: { id: { in: Array.from(finalAllowedCourseIds) } },
            include: {
                group: { include: { batch: { include: { business: true } } } }
            }
        });

        const formattedClassroom = mySubjects.map(sub => {
            let lecturerImage = "default.png";
            try {
                let parsedPrices = sub.groupPrices;
                if (typeof parsedPrices === 'string') parsedPrices = JSON.parse(parsedPrices);
                if (typeof parsedPrices === 'string') parsedPrices = JSON.parse(parsedPrices);
                if (Array.isArray(parsedPrices)) {
                    const imgObj = parsedPrices.find(gp => gp.lecturerImage && gp.lecturerImage.trim() !== '');
                    if (imgObj) lecturerImage = imgObj.lecturerImage;
                }
            } catch(e) {}

            // Calculate student payment type for this course
            const coursePayments = effectivePayments.filter(p => {
                if (!p.subjects) return true;
                try {
                    const subs = JSON.parse(p.subjects).map(id => parseInt(id, 10));
                    return subs.includes(sub.id);
                } catch (e) {
                    return true;
                }
            });
            let actualType = 1; // Default Monthly
            if (coursePayments.some(p => parseInt(p.payment_type) === 3)) actualType = 3;
            else if (coursePayments.some(p => parseInt(p.payment_type) === 2)) actualType = 2;

            return {
                id: sub.id.toString(), 
                name: sub.name,
                code: sub.code,
                courseType: parseInt(sub.courseType || sub.group?.classType || 1, 10),
                classType: parseInt(sub.group?.classType || 1, 10),
                batchType: parseInt(sub.group?.batch?.type || 1, 10),
                businessId: sub.group?.batch?.businessId || null,
                businessName: sub.group?.batch?.business?.name || "Other",
                businessLogo: sub.group?.batch?.business?.logo || "default.png",
                batchId: sub.group?.batchId || null,
                batchName: sub.group?.batch?.name || sub.stream || "General Subjects",
                batchLogo: sub.group?.batch?.logo || "default.png",
                description: sub.lecturerName || sub.description,
                groupType: sub.group?.type || 1, // 1 for Monthly, 2 for Full/Upgrade
                groupId: sub.group?.id || null,
                groupName: sub.group?.name || "",
                lecturerImage: lecturerImage,
                studentPaymentType: actualType
            };
        });

        res.status(200).json(safeJson(formattedClassroom));
    } catch (error) {
        console.error("Mobile Classroom Error:", error);
        res.status(500).json({ error: "Failed to load classroom" });
    }
};

exports.getCourseModules = async (req, res) => {
    try {
        const { id } = req.params; 
        const studentId = req.user?.userId || req.user?.id || req.userId;

        if (!studentId) return res.status(401).json({ error: "Authorization failed" });

        const overdueBatchIds = await getStudentOverdueInstallmentBatchIds(studentId);

        const requestedCourse = await prisma.course.findUnique({
            where: { id: parseInt(id) },
            include: { group: true }
        });

        if (requestedCourse && requestedCourse.group?.batchId) {
            const batchId = requestedCourse.group.batchId;
            if (overdueBatchIds.has(batchId)) {
                const hasValidAlternative = await prisma.payment.findFirst({
                    where: {
                        studentId: parseInt(studentId),
                        batchId: batchId,
                        payment_type: { in: [1, 3] },
                        status: 1
                    }
                });
                if (!hasValidAlternative) {
                    return res.status(403).json({
                        error: "INSTALLMENT_OVERDUE",
                        message: "ඔබගේ වාරික ගෙවීමේ (Installment) අවසන් දිනය ඉක්මවා ගොස් ඇත. පාඨමාලාවට ප්‍රවේශ වීම සඳහා කරුණාකර හිඟ වාරිකය ගෙවන්න.",
                        isOverdue: true
                    });
                }
            }
        }

        const allPayments = await prisma.payment.findMany({
            where: { studentId: parseInt(studentId) }
        });

        let isEnrolled = false;
        let isPending = false;

        allPayments.forEach(p => {
            if (p.payment_type === 2 && overdueBatchIds.has(p.batchId)) {
                return;
            }
            if (p.subjects) {
                try {
                    const parsedIds = JSON.parse(p.subjects).map(subId => parseInt(subId, 10));
                    if (parsedIds.includes(parseInt(id, 10))) {
                        if (p.status === 1 || p.status === 4) {
                            isEnrolled = true;
                        } else if (p.status === 0 || p.status === -1) {
                            isPending = true;
                        }
                    }
                } catch(e){}
            }
        });

        let paidStatus = 0; 
        if (isEnrolled) paidStatus = 1; 
        else if (isPending) paidStatus = -1; 

        let targetCourseIds = [BigInt(id)];

        if (requestedCourse && requestedCourse.group?.batchId) {
            const batchId = requestedCourse.group.batchId;
            const targetClassType = parseInt(requestedCourse.courseType || requestedCourse.group?.classType || 1, 10);

            const fullPayments = await prisma.payment.findMany({
                where: {
                    studentId: parseInt(studentId),
                    batchId: batchId,
                    payment_type: { in: [2, 3] },
                    status: { in: [1, 4] },
                    group: { classType: targetClassType }
                }
            });

            if (fullPayments.length > 0) {
                // If Full Payment, fetch all courses in this batch with matching classType
                const similarCoursesRaw = await prisma.course.findMany({
                    where: {
                        OR: [
                            requestedCourse.code ? { code: requestedCourse.code } : undefined,
                            { name: requestedCourse.name }
                        ].filter(Boolean),
                        group: { 
                            batchId: batchId,
                            classType: targetClassType
                        },
                        courseType: targetClassType
                    }
                });

                const similarCourses = similarCoursesRaw.filter(c => {
                    const cClassType = parseInt(c.courseType || c.group?.classType || 1, 10);
                    return cClassType === targetClassType;
                });
                
                const similarCourseIds = similarCourses.map(c => parseInt(c.id));
                
                const validFullPayments = fullPayments.filter(p => {
                    if (!p.subjects) return true;
                    try {
                        const subs = JSON.parse(p.subjects).map(s => parseInt(s));
                        return subs.some(subId => similarCourseIds.includes(subId));
                    } catch (e) {
                        return true;
                    }
                });

                if (validFullPayments.length > 0) {
                    targetCourseIds = similarCourses.map(c => BigInt(c.id));
                }
            }
        }

        const linkedContents = await prisma.contentCourse.findMany({
            where: { course_id: { in: targetCourseIds } }
        });
        
        const contentIds = linkedContents.map(lc => lc.content_id);
        
        const contentsRaw = await prisma.content.findMany({
            where: { id: { in: contentIds } },
            include: { group: true, paper: true },
            orderBy: { createdAt: 'desc' }
        });

        // 🔥 FIX: Deduplicate contents to prevent showing duplicates when enrolled in both Monthly and Full Payment courses
        // Same title is NOT enough to call two items duplicates (different lecturers
        // reuse titles) — dedupe on title + type + actual media. See src/modules/content/rules.js
        const contents = require('../../src/modules/content/rules').dedupeContents(contentsRaw);

        const groupIds = [...new Set(contents.map(c => c.contentGroupId).filter(Boolean))];
        const groupTitles = [...new Set(contents.map(c => c.group?.title).filter(Boolean))];
        const batchIdForGroups = requestedCourse?.group?.batchId;
        const courseCodeForGroups = requestedCourse?.code || `SUB_${requestedCourse?.id}`;
        const targetClassType = parseInt(requestedCourse?.courseType || requestedCourse?.group?.classType || 1, 10);

        const initialGroups = await prisma.contentGroup.findMany({
             where: { 
                 classType: targetClassType,
                 OR: [
                     batchIdForGroups ? { batchId: batchIdForGroups, courseCode: courseCodeForGroups } : undefined,
                     batchIdForGroups && requestedCourse?.code ? { batchId: batchIdForGroups, courseCode: requestedCourse.code } : undefined,
                     batchIdForGroups ? { batchId: batchIdForGroups, courseCode: null } : undefined,
                     batchIdForGroups ? { batchId: batchIdForGroups, courseCode: '' } : undefined,
                     batchIdForGroups ? { additionalBatchIds: { contains: `,${batchIdForGroups},` } } : undefined,
                     batchIdForGroups && groupTitles.length > 0 ? { batchId: batchIdForGroups, title: { in: groupTitles } } : undefined,
                     batchIdForGroups ? {
                         batchId: batchIdForGroups,
                         parentId: null,
                         OR: [
                             { title: { contains: 'month' } },
                             { title: { contains: 'මාස' } },
                             { title: { in: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December", "General", "General Content"] } }
                         ]
                     } : undefined,
                     { id: { in: groupIds } }
                 ].filter(Boolean)
             },
             orderBy: { itemOrder: 'asc' }
        });

        // Also fetch any missing parent folders for subfolders
        const parentIdsToFetch = initialGroups.map(g => g.parentId).filter(Boolean);
        let allGroupsMap = new Map();
        initialGroups.forEach(g => allGroupsMap.set(g.id, g));

        if (parentIdsToFetch.length > 0) {
            const parentGroups = await prisma.contentGroup.findMany({
                where: { id: { in: parentIdsToFetch }, classType: targetClassType }
            });
            parentGroups.forEach(pg => allGroupsMap.set(pg.id, pg));
        }

        // Also fetch any subfolders of root folders
        const rootIds = Array.from(allGroupsMap.values()).filter(g => !g.parentId).map(g => g.id);
        if (rootIds.length > 0) {
            const subGroups = await prisma.contentGroup.findMany({
                where: { parentId: { in: rootIds }, classType: targetClassType }
            });
            subGroups.forEach(sg => allGroupsMap.set(sg.id, sg));
        }

        const allGroups = Array.from(allGroupsMap.values());

        const normalizeFolderTitle = (title) => {
            if (!title) return '';
            return title
                .toLowerCase()
                .replace(/octomber/gi, 'october')
                .replace(/septeber/gi, 'september')
                .replace(/[\s_-]+/g, ' ')
                .replace(/\b(month|batch|මාසය|මාස|පාඩම|පාඩම්)\b/gi, '')
                .trim();
        };

        // Map each group to its top-level root group
        const groupToRootMap = new Map();
        allGroups.forEach(g => {
            let curr = g;
            while (curr.parentId && allGroupsMap.has(curr.parentId)) {
                curr = allGroupsMap.get(curr.parentId);
            }
            groupToRootMap.set(g.id, curr);
        });

        // Merge root folders with identical type and normalized title
        const rootFoldersByTypeAndTitle = new Map(); // key: type_normTitle -> primaryRootGroup
        const rootRedirectMap = new Map(); // rootId -> primaryRootGroup

        allGroups.filter(g => !g.parentId).forEach(rf => {
            const norm = normalizeFolderTitle(rf.title);
            const typeKey = `${rf.type || 1}_${norm || (rf.title || '').trim().toLowerCase() || rf.id}`;
            if (!rootFoldersByTypeAndTitle.has(typeKey)) {
                rootFoldersByTypeAndTitle.set(typeKey, rf);
                rootRedirectMap.set(rf.id, rf);
            } else {
                const primary = rootFoldersByTypeAndTitle.get(typeKey);
                rootRedirectMap.set(rf.id, primary);
            }
        });

        // Remap all groups in groupToRootMap to the primary root group
        allGroups.forEach(g => {
            const directRoot = groupToRootMap.get(g.id) || g;
            const primary = rootRedirectMap.get(directRoot.id) || directRoot;
            groupToRootMap.set(g.id, primary);
        });
        const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
        const sinhalaMonths = ["ජනවාරි", "පෙබරවාරි", "මාර්තු", "අප්‍රේල්", "මැයි", "ජූනි", "ජූලි", "අගෝස්තු", "සැප්තැම්බර්", "ඔක්තෝබර්", "නොවැම්බර්", "දෙසැම්බර්"];

        // Process contents - all subfolder and duplicate folder recordings map directly to the primary root folder
        const contentsProcessed = contents.map(c => {
            const typeStr = c.contentType;
            let typeInt = 1;
            if (typeStr === 'recording' || typeStr === '2') typeInt = 2;
            else if (typeStr === 'document' || typeStr === '3') typeInt = 3;
            else if (typeStr === 'sPaper' || typeStr === '4') typeInt = 4;
            else if (typeStr === 'paper' || typeStr === '5') typeInt = 5;

            let root = c.contentGroupId ? groupToRootMap.get(c.contentGroupId) : null;
            if (!root && c.group?.title) {
                const norm = normalizeFolderTitle(c.group.title);
                const typeKey = `${typeInt}_${norm || c.group.title.trim().toLowerCase()}`;
                if (rootFoldersByTypeAndTitle.has(typeKey)) {
                    root = rootFoldersByTypeAndTitle.get(typeKey);
                }
            }

            // Smart month matching fallback for cross-batch or uncategorized items
            if (!root) {
                let targetMonthIdx = -1;
                if (c.date) {
                    try {
                        const d = new Date(c.date);
                        if (!isNaN(d.getTime())) targetMonthIdx = d.getMonth();
                    } catch (err) {}
                }
                if (targetMonthIdx === -1 && c.title) {
                    const titleLower = c.title.toLowerCase();
                    targetMonthIdx = monthNames.findIndex(m => titleLower.includes(m));
                    if (targetMonthIdx === -1) targetMonthIdx = sinhalaMonths.findIndex(m => titleLower.includes(m));
                }
                if (targetMonthIdx !== -1) {
                    const engMonth = monthNames[targetMonthIdx];
                    const sinMonth = sinhalaMonths[targetMonthIdx];
                    const matchedRoot = Array.from(rootFoldersByTypeAndTitle.values()).find(rf => {
                        if (rf.type && rf.type !== typeInt) return false;
                        const rfTitleLower = (rf.title || '').toLowerCase();
                        const rfNorm = normalizeFolderTitle(rf.title);
                        return rfTitleLower.includes(engMonth) || rfTitleLower.includes(sinMonth) ||
                               rfNorm.includes(engMonth) || rfNorm.includes(sinMonth);
                    });
                    if (matchedRoot) {
                        root = matchedRoot;
                    }
                }
            }

            const finalGroupId = root ? root.id : c.contentGroupId;
            const finalGroupTitle = root ? root.title : (c.group?.title || null);

            // Auto-heal DB link asynchronously if missing or mismatched
            if (finalGroupId && c.contentGroupId !== finalGroupId) {
                prisma.content.update({
                    where: { id: c.id },
                    data: { contentGroupId: finalGroupId }
                }).catch(() => {});
            }

            return {
                ...c,
                contentGroupId: finalGroupId,
                content_group_id: finalGroupId,
                folder_id: finalGroupId,
                groupTitle: finalGroupTitle,
                group: root ? root : c.group
            };
        });

        const contentGroupIdsWithItems = new Set(contentsProcessed.map(c => c.contentGroupId).filter(Boolean));
        let lessonGroups = Array.from(rootFoldersByTypeAndTitle.values()).sort((a, b) => (a.itemOrder || 1) - (b.itemOrder || 1));
        if (contentGroupIdsWithItems.size > 0) {
            lessonGroups = lessonGroups.filter(g => contentGroupIdsWithItems.has(g.id));
        }

        // 🔥 ලින්ක් එක අපේ සර්වර් එකේ Redirect ලින්ක් එකට හරවන Function එක
        const modifyLinks = (items) => {
            return items.map(item => {
                let newLink = item.link;
                if (newLink && (newLink.includes('youtube.com') || newLink.includes('youtu.be'))) {
                    const match = newLink.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|live\/|shorts\/))([\w-]{11})/);
                    if (match && match[1]) {
                        // "youtube" කෑල්ල අයින් කරලා අපේ සර්වර් එකේ ලින්ක් එක දෙනවා.
                        newLink = `https://imacampus.online/api/student/yt-redirect?v=${match[1]}`;
                    }
                }
                return { ...item, link: newLink, isRedirectLink: newLink !== item.link };
            });
        };

        const processedContents = modifyLinks(contentsProcessed);

        // පරණ විදියටම ගන්නවා
        const liveClasses = processedContents.filter(c => c.contentType === 'live' || c.contentType === '1');
        const recordings = processedContents.filter(c => c.contentType === 'recording' || c.contentType === '2');
        const documents = processedContents.filter(c => c.contentType === 'document' || c.contentType === '3');
        const sPapers = processedContents.filter(c => c.contentType === 'sPaper' || c.contentType === '4');
        const papers = processedContents.filter(c => c.contentType === 'paper' || c.contentType === '5');
        const rankingTests = processedContents.filter(c => ['testRanking', 'rankingTest', 'ranking_test', 'test', 'sPaper', 'paper', '4', '5'].includes(c.contentType));

        const safeData = JSON.parse(JSON.stringify({ 
            course: requestedCourse,
            lessonGroups, 
            contents: processedContents,
            liveClasses: liveClasses, 
            recordings: recordings, 
            documents, sPapers, papers,
            rankingTests,
            paidStatus: paidStatus 
        }, (k, v) => typeof v === 'bigint' ? v.toString() : v));
        
        res.status(200).json(safeData);
    } catch (error) {
        console.error("Module Error:", error);
        res.status(500).json({ error: "Failed to load modules" });
    }
};

// 🔥 FIX: Prisma relation error එක මඟහරින්න Courses ටික වෙනම අරන් map කරනවා
exports.getMobileUpcomingLives = async (req, res) => {
    try {
        const studentId = req.user?.userId || req.user?.id || req.userId;
        if (!studentId) return res.status(401).json({ error: "Authorization failed" });

        const overdueBatchIds = await getStudentOverdueInstallmentBatchIds(studentId);

        const validPayments = await prisma.payment.findMany({
            where: { studentId: parseInt(studentId), status: { in: [1, 4] } }
        });

        const effectivePayments = validPayments.filter(p => {
            if (p.payment_type === 2 && overdueBatchIds.has(p.batchId)) {
                const hasValidAlternative = validPayments.some(other =>
                    other.id !== p.id &&
                    other.batchId === p.batchId &&
                    [1, 3].includes(other.payment_type) &&
                    other.status === 1
                );
                return hasValidAlternative;
            }
            return true;
        });

        let allowedSubjectIds = [];
        effectivePayments.forEach(p => {
            if (p.subjects) {
                try { 
                    const parsedIds = JSON.parse(p.subjects).map(id => parseInt(id, 10));
                    allowedSubjectIds.push(...parsedIds);
                } catch(e){}
            }
        });

        const uniqueSubjectIds = [...new Set(allowedSubjectIds)];
        if (uniqueSubjectIds.length === 0) return res.status(200).json({ liveClasses: [] });

        let linkedContents = [];
        try {
            linkedContents = await prisma.contentCourse.findMany({
                where: { course_id: { in: uniqueSubjectIds.map(id => BigInt(id)) } }
            });
        } catch (e1) {
            try {
                linkedContents = await prisma.contentCourse.findMany({
                    where: { course_id: { in: uniqueSubjectIds } }
                });
            } catch (e2) {
                console.log("ContentCourse Fetch Error:", e2);
            }
        }

        if (!linkedContents || linkedContents.length === 0) return res.status(200).json({ liveClasses: [] });

        let coursesList = [];
        try {
            coursesList = await prisma.course.findMany({
                where: { id: { in: uniqueSubjectIds.map(id => BigInt(id)) } },
                select: { id: true, name: true }
            });
        } catch(e) {
            try {
                coursesList = await prisma.course.findMany({
                    where: { id: { in: uniqueSubjectIds } },
                    select: { id: true, name: true }
                });
            } catch(e2){}
        }

        const contentIds = [...new Set(linkedContents.map(lc => lc.content_id))];

        let liveContents = [];
        try {
            liveContents = await prisma.content.findMany({
                where: {
                    id: { in: contentIds.map(id => BigInt(id.toString())) },
                    contentType: { in: ['live', '1'] }
                },
                orderBy: { date: 'asc' }
            });
        } catch (e1) {
            try {
                liveContents = await prisma.content.findMany({
                    where: {
                        id: { in: contentIds.map(id => parseInt(id.toString(), 10)) },
                        contentType: { in: ['live', '1'] }
                    },
                    orderBy: { date: 'asc' }
                });
            } catch (e2) {
                console.log("Content Fetch Error:", e2);
            }
        }

        const formattedLives = liveContents.map(c => {
            const linkObj = linkedContents.find(lc => lc.content_id.toString() === c.id.toString());
            const courseObj = coursesList.find(cr => cr.id.toString() === linkObj?.course_id?.toString());
            
            let dateStr = "";
            if (c.date) {
                const d = new Date(c.date);
                dateStr = d.toISOString().split('T')[0]; 
            }

            return {
                id: c.id.toString(),
                courseName: courseObj?.name || "Live Class",
                title: c.title,
                date: dateStr,
                startTime: c.startTime,
                endTime: c.endTime,
                link: c.link,
                zoomMeetingId: c.meetingId,
                image: c.thumbnail || c.fileName || null, 
                paidStatus: 1 
            };
        });

        res.status(200).json(safeJson({ liveClasses: formattedLives }));
    } catch (error) {
        console.error("Live Classes Fetch Error:", error);
        res.status(500).json({ error: "Failed to load live classes" });
    }
};

// 🔥 Mobile Password Change Logic
exports.updateMobilePassword = async (req, res) => {
    try {
        const studentId = req.user?.userId || req.user?.id;
        const { currentPassword, newPassword } = req.body;

        if (!studentId) return res.status(401).json({ error: "Unauthorized" });

        // 1. Student wa DB eken hoyaganna
        const student = await prisma.user.findUnique({ where: { id: parseInt(studentId) } });
        if (!student) return res.status(404).json({ error: "Student not found" });

        // 2. Dan thiyena password eka match wenawada kiyala balanna
        const isMatch = await bcrypt.compare(currentPassword, student.password);
        if (!isMatch) return res.status(400).json({ error: "Current password is incorrect" });

        // 3. Aluth password eka hash karanna (Encrypt karanna)
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // 4. Aluth password eka DB eke update karanna
        await prisma.user.update({
            where: { id: parseInt(studentId) },
            data: { 
                password: hashedNewPassword,
                session_id: crypto.randomBytes(16).toString('hex')
            }
        });

        res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
        console.error("Password Update Error:", error);
        res.status(500).json({ error: "Failed to change password" });
    }
};

// Image එකත් එක්කම Profile Update කරන Function එක
exports.updateMobileProfile = async (req, res) => {
    try {
        const studentId = req.user?.userId || req.user?.id;
        const { addressHouseNo, addressStreet, city, district } = req.body;

        let updateData = { addressHouseNo, addressStreet, city, district };

        // Multer හරහා Image එකක් ආවා නම් ඒකේ නම save කරගන්නවා
        if (req.file) {
            updateData.image = req.file.filename; 
        }

        const updatedUser = await prisma.user.update({
            where: { id: parseInt(studentId) },
            data: updateData
        });

        res.status(200).json({ message: "Profile updated successfully", image: updatedUser.image });
    } catch (error) {
        console.error("Profile Update Error:", error);
        res.status(500).json({ error: "Failed to update profile" });
    }
};

// 🔥 YOUTUBE NATIVE APP REDIRECTOR (BUTTON CLICK) 🔥
exports.ytRedirect = (req, res) => {
    const ytId = req.query.v;
    
    if (!ytId) return res.status(400).send("Invalid Video ID");

    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>Secure Stream</title>
            <style>
                body { background-color: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: sans-serif; text-align: center; }
                .yt-icon { width: 60px; height: 60px; margin-bottom: 15px; fill: #dc2626; }
                .btn { background-color: #dc2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px; margin-top: 15px; box-shadow: 0 4px 15px rgba(220, 38, 38, 0.4); display: inline-block; }
                .text { color: #94a3b8; font-size: 13px; margin-top: 15px; padding: 0 30px; line-height: 1.5; }
            </style>
        </head>
        <body>
            <svg class="yt-icon" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>
                <path fill="#0f172a" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            <h2 style="margin:0; font-size: 20px;">Secure Video Stream</h2>
            <p class="text">Click the button below to open this video safely in your YouTube App.</p>
            
            <a href="https://www.youtube.com/watch?v=${ytId}" target="_blank" class="btn">
                Open in YouTube App
            </a>
        </body>
        </html>
    `;
    
    res.send(html);
};

// Helper for HTML escaping to prevent XSS
// 🔥 LIVE CLASS PORTAL VIEW FOR MOBILE WEBVIEW -> REDIRECT TO DIRECT ZOOM LINK 🔥
exports.getLivePortal = async (req, res) => {
    try {
        const id = parseInt(req.query.id, 10);
        if (isNaN(id)) {
            return res.status(400).send("Invalid Live Class ID");
        }

        const content = await prisma.content.findUnique({
            where: { id: id },
            include: { group: true }
        });

        if (!content || !content.link) {
            return res.status(404).send("Live class not found or link is missing");
        }

        let targetUrl = content.link.trim();
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = 'https://' + targetUrl;
        }

        return res.redirect(302, targetUrl);
    } catch (error) {
        console.error("Live Portal Error:", error);
        return res.status(500).send("Failed to redirect to live class");
    }
};

exports.getActiveAppEvent = async (req, res) => {
    try {
        const setting = await prisma.appSetting.findUnique({ where: { key: 'ACTIVE_ANIMATION' } });
        res.status(200).json({ activeEvent: setting ? setting.value : 'none' });
    } catch (error) {
        res.status(500).json({ error: "Failed" });
    }
};

// 🔥 Google Sign-In: Verify Student ID Token
exports.verifyStudent = async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) return res.status(400).json({ error: "No ID token provided" });

        const client = new OAuth2Client(process.env.GOOGLE_YOUTUBE_CLIENT_ID);
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: [
                process.env.GOOGLE_YOUTUBE_CLIENT_ID, 
                process.env.GOOGLE_YOUTUBE_IOS_CLIENT_ID, 
                process.env.GOOGLE_YOUTUBE_ANDROID_CLIENT_ID
            ].filter(Boolean),
        });
        const payload = ticket.getPayload();
        const email = payload['email'];

        // The User table has no email column, so a Google account cannot be matched
        // to a student yet (the old query always crashed with a 500). Until an email
        // column is added and filled, tell the student to use phone login instead.
        const student = null;
        if (!student) {
             console.warn(`[Google Sign-In] Not linked yet, rejected sign-in for ${email}`);
             return res.status(403).json({ error: "Google Sign-In is not available yet. Please log in with your phone number and password." });
        }

        // Generate JWT token for the app session
        const token = jwt.sign(
            { userId: student.id, sessionId: student.session_id }, 
            process.env.JWT_SECRET || 'fallback_secret', 
            { expiresIn: '30d' }
        );
        
        res.status(200).json({ token, user: safeJson(student) });
    } catch (error) {
        console.error("Verify Student Error:", error);
        res.status(500).json({ error: "Google Sign-In Verification failed" });
    }
};

// 🔥 Generate Temporary Video Access Token using Refresh Token
exports.getVideoToken = async (req, res) => {
    try {
        const studentId = req.user?.userId || req.user?.id;
        if (!studentId) return res.status(401).json({ error: "Unauthorized" });

        const oauth2Client = new OAuth2Client(
            process.env.GOOGLE_YOUTUBE_CLIENT_ID,
            process.env.GOOGLE_YOUTUBE_CLIENT_SECRET
        );

        oauth2Client.setCredentials({
            refresh_token: process.env.GOOGLE_YOUTUBE_REFRESH_TOKEN
        });

        const { credentials } = await oauth2Client.refreshAccessToken();
        const accessToken = credentials.access_token;

        res.status(200).json({ accessToken });
    } catch (error) {
        console.error("Get Video Token Error:", error);
        res.status(500).json({ error: "Failed to generate video token" });
    }
};

// 🔥 Update YouTube Cookies automatically from Admin Chrome Extension
exports.updateYtCookies = async (req, res) => {
    try {
        const userRole = String(req.user?.role || '').trim().toUpperCase();
        const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(userRole);
        if (!isAdmin) {
            return res.status(403).json({ error: "Access denied. Admin authorization required." });
        }

        const { cookies } = req.body;
        if (!cookies || typeof cookies !== 'string' || cookies.length > 500000) {
            return res.status(400).json({ error: "Invalid cookie payload" });
        }
        
        const fs = require('fs');
        const path = require('path');
        const cookiePath = path.join(__dirname, '../../../yt_cookies.txt');
        
        fs.writeFileSync(cookiePath, cookies, 'utf8');
        console.log("✅ YouTube cookies updated securely from Admin Extension!");
        
        res.status(200).json({ message: "Cookies updated successfully" });
    } catch (error) {
        console.error("Update Cookies Error:", error);
        res.status(500).json({ error: "Failed to update cookies" });
    }
};

// 🔥 Secure Proxy for Zoom Recording Downloads
exports.downloadRecording = async (req, res) => {
    try {
        const studentId = req.user?.userId || req.user?.id || req.userId;
        const { contentId } = req.params;

        if (!studentId) return res.status(401).json({ error: "Unauthorized" });
        if (!contentId) return res.status(400).json({ error: "Content ID is required" });

        // Fetch the content
        const content = await prisma.content.findUnique({
            where: { id: parseInt(contentId) }
        });

        if (!content) return res.status(404).json({ error: "Content not found" });

        // Ideally we should also verify if the student has access to this content
        // (For now, we rely on the VerifyToken middleware which confirms it's a valid student)

        let finalUrl = content.link; 

        // 🔥 1. Try to fetch fresh Zoom link using Server-to-Server API (Most Reliable) 🔥
        if (content.meetingId && content.meetingId.trim() !== '') {
            console.log(`[PROXY] Using API to fetch Zoom link for Meeting ID: ${content.meetingId}`);
            const cleanMeetingId = content.meetingId.replace(/\D/g, '');
            const directMp4 = await contentController.getZoomDirectMp4Link(cleanMeetingId, content.date);
            if (directMp4) {
                finalUrl = directMp4;
            }
        } 
        // 🔥 2. Fallback to HTML Scraping ONLY IF Meeting ID is not provided 🔥
        else if (finalUrl && (finalUrl.includes('zoom.us/rec/share') || finalUrl.includes('zoom.us/rec/play'))) {
            try {
                console.log(`[PROXY] Extracting video URL from Zoom Share Link for content ${contentId}...`);
                const htmlRes = await axios.get(finalUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Safari/537.36'
                    }
                });
                const htmlText = htmlRes.data;
                // 🔥 Log HTML snippet for debugging 🔥
                console.log(`[PROXY] Zoom HTML Snippet: `, htmlText.substring(0, 500));
                
                // Write full HTML to a temp file for deep debugging
                require('fs').writeFileSync('/tmp/zoom_html.txt', htmlText);

                let extractedUrl = null;
                const downloadMatch = htmlText.match(/downloadUrl\s*:\s*['"](https:\/\/[^'"]+)['"]/);
                
                if (downloadMatch && downloadMatch[1]) {
                    extractedUrl = downloadMatch[1];
                } else {
                    const viewMatch = htmlText.match(/viewUrl\s*:\s*['"](https:\/\/[^'"]+)['"]/);
                    if (viewMatch && viewMatch[1]) {
                        extractedUrl = viewMatch[1];
                    } else {
                        const fallbackMatch = htmlText.match(/(https:\/\/[^"'\s]+\.mp4[^"'\s]*)/);
                        if (fallbackMatch && fallbackMatch[1]) {
                            extractedUrl = fallbackMatch[1];
                        }
                    }
                }

                if (extractedUrl) {
                    try {
                        finalUrl = JSON.parse('"' + extractedUrl + '"');
                    } catch (e) {
                        finalUrl = extractedUrl.replace(/\\u0026/g, '&');
                    }
                    console.log(`[PROXY] Successfully extracted direct MP4 URL!`);
                } else {
                    throw new Error("Could not find mp4 url in HTML");
                }
            } catch (error) {
                console.error(`[PROXY] Failed to extract from Zoom Link:`, error.message);
                return res.status(404).json({ error: "Failed to extract Zoom video. Link might be invalid or require passcode." });
            }
        }

        if (!finalUrl || !finalUrl.startsWith('http')) {
            return res.status(404).json({ error: "Recording URL not available" });
        }

        console.log(`[PROXY] Streaming Zoom video for content ${contentId} to student ${studentId}`);

        // Stream the video file from Zoom through our server to the client
        const response = await axios({
            method: 'get',
            url: finalUrl,
            responseType: 'stream',
            maxRedirects: 5 // Zoom links might redirect
        });

        // Set headers to indicate a video stream download
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="recording_${contentId}.dat"`); // Using .dat to obscure it
        
        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
        }

        // Pipe the stream directly to the client
        response.data.pipe(res);

    } catch (error) {
        console.error("Download Recording Proxy Error:", error.message);
        res.status(500).json({ error: "Failed to download recording" });
    }
};

// ================= STREAM PROXY FOR PRE-EXTRACTED URLS =================
exports.proxyStreamUrl = async (req, res) => {
    try {
        const { url } = req.query;
        if (!url || (!url.includes('zoom.us') && !url.includes('.mp4'))) {
            return res.status(403).json({ error: "Invalid or unauthorized URL." });
        }

        console.log(`[PROXY-STREAM] Proxying pre-extracted URL: ${url.substring(0, 50)}...`);

        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            maxRedirects: 5
        });

        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="recording_${Date.now()}.dat"`);
        
        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
        }

        response.data.pipe(res);
    } catch (error) {
        console.error(`[PROXY-STREAM] Error proxying URL:`, error.message);
        res.status(500).json({ error: "Failed to download stream" });
    }
};