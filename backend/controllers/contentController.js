const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const admin = require("firebase-admin");
const axios = require('axios');
const { getScopedBusinessId } = require('../utils/scopeUtils');

// 🔥 පරණ Hardcoded Keys අයින් කළා. දැන් කෙලින්ම ගන්නේ .env ෆයිල් එකෙන් 🔥

const getZoomDirectMp4Link = async (meetingId) => {
    const cleanMeetingId = meetingId.replace(/\s+/g, '');
    console.log(`\n================ ZOOM DEBUG START ================`);
    console.log(`[1] Requested Meeting ID: "${cleanMeetingId}" (Original: "${meetingId}")`);

    try {
        let zoomAccounts = [];
        try {
            zoomAccounts = await prisma.zoomAccount.findMany({ where: { isActive: true } });
        } catch (e) {
            console.error("[!] Error fetching zoom accounts from DB:", e);
        }

        // If no accounts in DB, fallback to .env
        if (zoomAccounts.length === 0) {
            zoomAccounts.push({
                name: 'Default ENV Account',
                accountId: process.env.ZOOM_ACCOUNT_ID,
                clientId: process.env.ZOOM_CLIENT_ID,
                clientSecret: process.env.ZOOM_CLIENT_SECRET
            });
        }

        for (const account of zoomAccounts) {
            console.log(`[>>] Trying Account: ${account.name || 'Unknown'}`);
            if (!account.accountId || !account.clientId || !account.clientSecret) {
                console.error(`[!] Missing credentials for account: ${account.name}`);
                continue;
            }

            try {
                const authHeader = Buffer.from(`${account.clientId}:${account.clientSecret}`).toString('base64');
                const tokenRes = await axios.post(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${account.accountId}`, null, {
                    headers: { 'Authorization': `Basic ${authHeader}` }
                });

                const accessToken = tokenRes.data.access_token;
                const searchTarget = cleanMeetingId.includes('/') ? encodeURIComponent(encodeURIComponent(cleanMeetingId)) : cleanMeetingId;
                
                // Try fetching recording directly
                let recRes = await axios.get(`https://api.zoom.us/v2/meetings/${searchTarget}/recordings`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    validateStatus: function (status) { return status < 500; }
                });

                // If 404 on numeric meeting ID, check past instances
                if (recRes.status === 404 && /^\d+$/.test(cleanMeetingId)) {
                    try {
                        const instRes = await axios.get(`https://api.zoom.us/v2/past_meetings/${cleanMeetingId}/instances`, {
                            headers: { 'Authorization': `Bearer ${accessToken}` },
                            validateStatus: function (status) { return status < 500; }
                        });
                        if (instRes.status === 200 && instRes.data && instRes.data.meetings && instRes.data.meetings.length > 0) {
                            const latestInst = instRes.data.meetings[instRes.data.meetings.length - 1];
                            const encodedUuid = encodeURIComponent(encodeURIComponent(latestInst.uuid));
                            recRes = await axios.get(`https://api.zoom.us/v2/meetings/${encodedUuid}/recordings`, {
                                headers: { 'Authorization': `Bearer ${accessToken}` },
                                validateStatus: function (status) { return status < 500; }
                            });
                        }
                    } catch (instErr) {}
                }

                if (recRes.status === 200 && recRes.data && recRes.data.recording_files) {
                    const mp4File = recRes.data.recording_files.find(file => file.file_type === 'MP4');
                    if (mp4File) {
                        console.log(`[✔] MP4 Found in account ${account.name}! Size: ${(mp4File.file_size / (1024*1024)).toFixed(2)} MB`);
                        console.log(`================ ZOOM DEBUG END ================\n`);
                        return `${mp4File.download_url}?access_token=${accessToken}`;
                    }
                } else if (recRes.status === 404) {
                    console.log(`[x] Recording not found in ${account.name}, trying next...`);
                } else {
                    console.log(`[!] Unexpected status ${recRes.status} from ${account.name}`);
                }
            } catch (innerError) {
                console.error(`[!] Error fetching from account ${account.name}:`, innerError.message);
            }
        }
        
        console.log(`[!] Error: MP4 not found in any available Zoom accounts.`);
        console.log(`================ ZOOM DEBUG END ================\n`);
        return null;
    } catch (error) {
        console.error(`[!] SYSTEM ERROR in getZoomDirectMp4Link:`, error.message);
        console.log(`================ ZOOM DEBUG END ================\n`);
        return null;
    }
};

const getTypeInt = (typeStr) => {
    switch (typeStr) {
        case 'live': return 1; case 'recording': return 2; case 'document': return 3; case 'sPaper': return 4; case 'paper': return 5;
        case 'testRanking': case 'rankingTest': return 4;
        default: return parseInt(typeStr) || 1;
    }
};

const safeStr = (val) => Array.isArray(val) ? val[0] : (val || '');

// ================= BUSINESS =================
exports.createBusiness = async (req, res) => {
    try {
        const { name, category, medium, description, streams, isDiscountEnabledForInstallments } = req.body;
        const logo = req.file ? req.file.filename : 'default.png';
        const newBiz = await prisma.business.create({
            data: { name, category, medium, description, streams, logo, isDiscountEnabledForInstallments: parseInt(isDiscountEnabledForInstallments || 0) }
        });
        res.status(201).json(newBiz);
    } catch (error) { res.status(500).json({ error: "Failed to create business" }); }
};

exports.updateBusiness = async (req, res) => {
    try {
        const { businessId, name, category, medium, description, streams, isDiscountEnabledForInstallments } = req.body;
        let updateData = { name, category, medium, description, streams, isDiscountEnabledForInstallments: parseInt(isDiscountEnabledForInstallments || 0) };
        if (req.file) updateData.logo = req.file.filename;
        const updatedBiz = await prisma.business.update({ where: { id: parseInt(businessId) }, data: updateData });
        res.status(200).json(updatedBiz);
    } catch (error) { res.status(500).json({ error: "Failed to update business" }); }
};

exports.deleteBusiness = async (req, res) => {
    try {
        await prisma.business.delete({ where: { id: parseInt(req.body.business_id) } });
        res.status(200).json({ message: "Business Deleted" });
    } catch (e) { res.status(500).json({ error: "Failed to delete business. Please delete its batches first." }); }
};

exports.toggleBusinessStatus = async (req, res) => {
    try {
        const { business_id, status } = req.body;
        const updatedBiz = await prisma.business.update({
            where: { id: parseInt(business_id) },
            data: { status: parseInt(status) }
        });
        res.status(200).json(updatedBiz);
    } catch (error) { 
        res.status(500).json({ error: "Failed to update business visibility" }); 
    }
};

// ================= BATCHES & LECTURERS =================
exports.getBatchesByBusiness = async (req, res) => {
    try {
        const batches = await prisma.batch.findMany({
            where: { businessId: parseInt(req.params.bizId) },
            include: { groups: { include: { courses: true }, orderBy: [{ itemOrder: 'asc' }, { id: 'asc' }] } }
        });
        const safeData = JSON.parse(JSON.stringify(batches, (key, value) => typeof value === 'bigint' ? value.toString() : value));
        console.log("SENDING BATCHES-FULL:", JSON.stringify(safeData).substring(0, 500)); res.status(200).json({ batches: safeData });
    } catch (error) { res.status(500).json({ error: "Failed to fetch batches" }); }
};

exports.createBatch = async (req, res) => {
    try {
        const { business_id, name, type, itemOrder, description } = req.body;
        const logo = req.file ? req.file.filename : null;
        await prisma.batch.create({
            data: { businessId: parseInt(business_id), name, type: parseInt(type), itemOrder: parseInt(itemOrder || 1), description, logo }
        });
        res.status(201).json({ message: "Created" });
    } catch (e) { res.status(500).json({ error: "Failed to create batch" }); }
};

exports.updateBatch = async (req, res) => {
    try {
        const { batch_id, name, type, itemOrder, description } = req.body;
        const data = { name, type: parseInt(type), itemOrder: parseInt(itemOrder || 1), description };
        if (req.file) data.logo = req.file.filename;
        await prisma.batch.update({ where: { id: parseInt(batch_id) }, data });
        res.status(200).json({ message: "Updated" });
    } catch (e) { res.status(500).json({ error: "Failed to update batch" }); }
};

exports.deleteBatch = async (req, res) => {
    try {
        await prisma.batch.delete({ where: { id: parseInt(req.body.batch_id) } });
        res.status(200).json({ message: "Batch Deleted" });
    } catch (e) { res.status(500).json({ error: "Failed to delete batch. Please delete its groups first." }); }
};

exports.updateBatchLecturers = async (req, res) => {
    try {
        const { batch_id, lecturers } = req.body;
        const updated = await prisma.batch.update({
            where: { id: parseInt(batch_id) },
            data: { lecturers: JSON.stringify(lecturers || []) }
        });
        res.status(200).json(updated);
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: "Failed to update lecturers" }); 
    }
};

exports.toggleBatchStatus = async (req, res) => {
    try {
        const { batch_id, status } = req.body;
        const updatedBatch = await prisma.batch.update({
            where: { id: parseInt(batch_id) },
            data: { status: parseInt(status) }
        });
        res.status(200).json(updatedBatch);
    } catch (error) { 
        res.status(500).json({ error: "Failed to update batch visibility" }); 
    }
};

// ================= GROUPS =================
exports.createGroup = async (req, res) => {
    try {
        const { batch_id, name, paymentType, itemOrder, discountRules, classType } = req.body;
        const newGroup = await prisma.group.create({
            data: { 
                batchId: parseInt(batch_id), 
                name, 
                type: paymentType === 'Monthly' ? 1 : 2, 
                classType: parseInt(classType || 1),
                itemOrder: parseInt(itemOrder || 1), 
                discount_rules: JSON.stringify(discountRules || []) 
            }
        });
        res.status(201).json(newGroup);
    } catch (e) { res.status(500).json({ error: "Failed to create group" }); }
};

exports.updateGroup = async (req, res) => {
    try {
        const { group_id, name, paymentType, itemOrder, discountRules, classType } = req.body;
        const data = { 
            name, 
            type: paymentType === 'Monthly' ? 1 : 2, 
            itemOrder: parseInt(itemOrder || 1), 
            discount_rules: JSON.stringify(discountRules || []) 
        };
        if (classType !== undefined && classType !== null) {
            data.classType = parseInt(classType);
        }
        const updated = await prisma.group.update({
            where: { id: parseInt(group_id) }, 
            data
        });
        res.status(200).json(updated);
    } catch (e) { res.status(500).json({ error: "Failed to update group" }); }
};

exports.deleteGroup = async (req, res) => {
    try {
        const { group_id } = req.body;
        await prisma.group.delete({ 
            where: { id: parseInt(group_id) } 
        });
        res.status(200).json({ message: "Payment Group Deleted" });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: "Failed to delete group. Please remove subjects assigned to this group first." }); 
    }
};

// ================= SUBJECTS =================
exports.createSubject = async (req, res) => {
    try {
        const name = safeStr(req.body.name);
        const code = safeStr(req.body.code);
        const stream = safeStr(req.body.stream);
        const description = safeStr(req.body.description);
        const lecturerName = safeStr(req.body.lecturerName);
        const itemOrder = safeStr(req.body.itemOrder);
        const groupPrices = safeStr(req.body.groupPrices);
        const isDiscountExcluded = safeStr(req.body.isDiscountExcluded);
        let streamsStr = safeStr(req.body.streams);

        let lecturerImage = null;
        if (req.files && req.files.length > 0) {
             const lecImageFile = req.files.find(f => f.fieldname === 'lecturerImage');
             if (lecImageFile) lecturerImage = lecImageFile.filename;
        }

        try {
            if (typeof streamsStr === 'string' && !streamsStr.startsWith('[')) streamsStr = JSON.stringify([streamsStr]);
        } catch(e) {}

        const parsedPrices = JSON.parse(groupPrices || '[]');
        const excludeDiscount = isDiscountExcluded === 'true' || isDiscountExcluded === '1';
        
        if (parsedPrices.length === 0) return res.status(400).json({ error: "Please select at least one group" });

        if (req.files && req.files.length > 0) {
            parsedPrices.forEach(gp => {
                const file = req.files.find(f => f.fieldname === `tuteCover_${gp.groupId}`);
                if (file) gp.tuteCover = file.filename;
            });
        }

        // Keep group-specific tute covers and names as explicitly configured (never overwrite monthly with full)
        parsedPrices.forEach(gp => {
            gp.tutes = Array.isArray(gp.tutes) ? gp.tutes : [];
        });
        console.log("START MONTH IN REQ:", req.body.startMonth, "END MONTH IN REQ:", req.body.endMonth);
        console.log("UPDATE SUBJECT RECEIVED START MONTH:", req.body.startMonth, "END MONTH:", req.body.endMonth);
        const getMonthVal = (val) => {
            const s = safeStr(val);
            return (s === 'null' || s === 'undefined' || s === '') ? null : s;
        };
        const startMonth = getMonthVal(req.body.startMonth);
        const endMonth = getMonthVal(req.body.endMonth);

        let activeMonths = null;
        if (startMonth && endMonth) {
            const monthsList = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            const startIndex = monthsList.indexOf(startMonth);
            const endIndex = monthsList.indexOf(endMonth);
            if (startIndex !== -1 && endIndex !== -1) {
                if (endIndex >= startIndex) {
                    activeMonths = endIndex - startIndex + 1;
                } else {
                    activeMonths = (12 - startIndex) + endIndex + 1;
                }
            }
        }

        const courseType = parseInt(req.body.courseType || 1);

        const coursePromises = parsedPrices.map(async (gp) => {
            if (lecturerImage) gp.lecturerImage = lecturerImage;
            gp.deliverTute = gp.deliverTute === true || gp.deliverTute === 'true';

            const existingInGroup = await prisma.course.findFirst({
                where: {
                    name: name,
                    groupId: parseInt(gp.groupId),
                    courseType: courseType
                }
            });

            if (existingInGroup) {
                return prisma.course.update({
                    where: { id: existingInGroup.id },
                    data: {
                        name, code, stream, streams: streamsStr, description, lecturerName,
                        itemOrder: parseInt(itemOrder || 1), price: parseFloat(gp.price || 0),
                        groupPrices: JSON.stringify(parsedPrices),
                        isDiscountExcluded: excludeDiscount,
                        activeMonths, startMonth, endMonth,
                        courseType: courseType
                    }
                });
            }

            return prisma.course.create({
                data: { 
                    name, code, stream, streams: streamsStr, description, lecturerName,
                    itemOrder: parseInt(itemOrder || 1), price: parseFloat(gp.price || 0), 
                    groupPrices: JSON.stringify(parsedPrices), groupId: parseInt(gp.groupId),
                    isDiscountExcluded: excludeDiscount,
                    activeMonths, startMonth, endMonth,
                    courseType: courseType
                }
            });
        });

        await Promise.all(coursePromises);

        res.status(201).json({ message: "Created in all selected groups" });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: "Failed to create subject" }); 
    }
};

exports.updateSubject = async (req, res) => {
    try {
        const course_id = safeStr(req.body.course_id);
        const name = safeStr(req.body.name);
        const code = safeStr(req.body.code);
        const stream = safeStr(req.body.stream);
        const description = safeStr(req.body.description);
        const lecturerName = safeStr(req.body.lecturerName);
        const itemOrder = safeStr(req.body.itemOrder);
        const groupPrices = safeStr(req.body.groupPrices);
        const isDiscountExcluded = safeStr(req.body.isDiscountExcluded);
        const batch_id = safeStr(req.body.batch_id); 
        let streamsStr = safeStr(req.body.streams);

        let lecturerImage = null;
        if (req.files && req.files.length > 0) {
             const lecImageFile = req.files.find(f => f.fieldname === 'lecturerImage');
             if (lecImageFile) lecturerImage = lecImageFile.filename;
        }

        try {
            if (typeof streamsStr === 'string' && !streamsStr.startsWith('[')) streamsStr = JSON.stringify([streamsStr]);
        } catch(e) {}

        const parsedPrices = JSON.parse(groupPrices || '[]');
        console.log("RECEIVED GROUP PRICES: ", groupPrices);
        const excludeDiscount = isDiscountExcluded === 'true' || isDiscountExcluded === '1';

        const originalCourse = await prisma.course.findUnique({ where: { id: parseInt(course_id) } });
        if (!originalCourse) return res.status(404).json({ error: "Course not found" });

        // Map uploaded tute covers
        if (req.files && req.files.length > 0) {
            parsedPrices.forEach(gp => {
                const file = req.files.find(f => f.fieldname === `tuteCover_${gp.groupId}`);
                if (file) gp.tuteCover = file.filename;
            });
        }

        const courseType = req.body.courseType !== undefined && req.body.courseType !== '' 
            ? parseInt(req.body.courseType) 
            : (originalCourse.courseType || 1);

        for (let i = 0; i < parsedPrices.length; i++) {
            let gp = parsedPrices[i];
            const existingCourse = await prisma.course.findFirst({
                where: { 
                    name: originalCourse.name, 
                    groupId: parseInt(gp.groupId),
                    courseType: originalCourse.courseType || 1
                }
            });
            
            const existingGpData = existingCourse ? JSON.parse(existingCourse.groupPrices || '[]').find(p => parseInt(p.groupId) === parseInt(gp.groupId)) : null;
            
            if (existingGpData) {
                if (!lecturerImage && existingGpData.lecturerImage) gp.lecturerImage = existingGpData.lecturerImage;
                if (!gp.tuteCover && existingGpData.tuteCover) gp.tuteCover = existingGpData.tuteCover;
                if (!gp.tuteName && existingGpData.tuteName) gp.tuteName = existingGpData.tuteName;
            }
            if (lecturerImage) gp.lecturerImage = lecturerImage;
            
            gp.deliverTute = gp.deliverTute === true || gp.deliverTute === 'true';
            gp._existingCourse = existingCourse;
        }

        // Keep group-specific tute covers and names as explicitly configured (never overwrite monthly with full)
        parsedPrices.forEach(gp => {
            gp.tutes = Array.isArray(gp.tutes) ? gp.tutes : [];
        });

        const finalGroupPricesStr = JSON.stringify(parsedPrices.map(gp => {
            const { _existingCourse, ...cleanGp } = gp;
            return cleanGp;
        }));
        console.log("UPDATE SUBJECT RECEIVED START MONTH:", req.body.startMonth, "END MONTH:", req.body.endMonth);
        const getMonthVal = (val) => {
            const s = safeStr(val);
            return (s === 'null' || s === 'undefined' || s === '') ? null : s;
        };
        const startMonth = getMonthVal(req.body.startMonth);
        const endMonth = getMonthVal(req.body.endMonth);

        let activeMonths = null;
        if (startMonth && endMonth) {
            const monthsList = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            const startIndex = monthsList.indexOf(startMonth);
            const endIndex = monthsList.indexOf(endMonth);
            if (startIndex !== -1 && endIndex !== -1) {
                if (endIndex >= startIndex) {
                    activeMonths = endIndex - startIndex + 1;
                } else {
                    activeMonths = (12 - startIndex) + endIndex + 1;
                }
            }
        }

        const updatePromises = parsedPrices.map(gp => {
            const existingCourse = gp._existingCourse;
            if (existingCourse) {
                return prisma.course.update({
                    where: { id: existingCourse.id },
                    data: { 
                        name, code, stream, streams: streamsStr, description, lecturerName, 
                        itemOrder: parseInt(itemOrder || 1), price: parseFloat(gp.price || 0), 
                        groupPrices: finalGroupPricesStr, isDiscountExcluded: excludeDiscount,
                        activeMonths, startMonth, endMonth,
                        courseType: courseType
                    }
                });
            } else {
                return prisma.course.create({
                    data: { 
                        name, code, stream, streams: streamsStr, description, lecturerName, 
                        itemOrder: parseInt(itemOrder || 1), price: parseFloat(gp.price || 0), 
                        groupPrices: finalGroupPricesStr, groupId: parseInt(gp.groupId), 
                        isDiscountExcluded: excludeDiscount,
                        activeMonths, startMonth, endMonth,
                        courseType: courseType
                    }
                });
            }
        });

        await Promise.all(updatePromises);

        if (batch_id) {
            const batchGroups = await prisma.group.findMany({ where: { batchId: parseInt(batch_id) }, select: { id: true } });
            const batchGroupIds = batchGroups.map(g => g.id);
            const allExistingCourses = await prisma.course.findMany({ 
                where: { 
                    name: originalCourse.name, 
                    groupId: { in: batchGroupIds },
                    courseType: originalCourse.courseType || 1
                } 
            });
            
            const incomingGroupIds = parsedPrices.map(gp => parseInt(gp.groupId));
            const coursesToDelete = allExistingCourses.filter(c => !incomingGroupIds.includes(c.groupId));
            for (const c of coursesToDelete) await prisma.course.delete({ where: { id: c.id } });
        }

        // 🔥 AUTO-SYNC PENDING & HOLD DELIVERIES 🔥
        // When tutes/groupPrices are updated in Content Hub, automatically synchronize any unfulfilled (Pending/Hold)
        // deliveries for the affected groups or batch so that students receive all allocated tutes.
        try {
            const affectedGroupIds = parsedPrices.map(gp => parseInt(gp.groupId)).filter(Boolean);
            if (affectedGroupIds.length > 0) {
                const { getDeliverableCoursesForPayment } = require('./paymentController');
                const pendingDeliveries = await prisma.delivery.findMany({
                    where: {
                        status: { in: ['Pending', 'Hold'] },
                        payment: {
                            status: 1,
                            OR: [
                                { groupId: { in: affectedGroupIds } },
                                ...(batch_id ? [{ batchId: parseInt(batch_id) }] : [])
                            ]
                        }
                    },
                    include: {
                        items: true,
                        payment: true
                    }
                });

                for (const del of pendingDeliveries) {
                    if (!del.payment || !del.payment.subjects) continue;
                    let subIds = [];
                    try {
                        const rawSubs = typeof del.payment.subjects === 'string' ? JSON.parse(del.payment.subjects) : del.payment.subjects;
                        if (Array.isArray(rawSubs)) subIds = rawSubs.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0);
                    } catch (e) { continue; }
                    if (subIds.length === 0) continue;

                    const courses = await prisma.course.findMany({ where: { id: { in: subIds } } });
                    if (!courses || courses.length === 0) continue;

                    const deliverableItems = await getDeliverableCoursesForPayment(del.payment, courses);
                    if (deliverableItems && deliverableItems.length > 0) {
                        await prisma.$transaction([
                            prisma.deliveryItem.deleteMany({ where: { deliveryId: del.id } }),
                            prisma.deliveryItem.createMany({
                                data: deliverableItems.map(item => ({
                                    deliveryId: del.id,
                                    courseId: item.courseId,
                                    tuteName: item.tuteName || "Tute",
                                    tuteImage: item.tuteImage || null,
                                    quantity: item.quantity || 1
                                }))
                            })
                        ]);
                    }
                }
            }
        } catch (syncErr) {
            console.error("[CONTENT-HUB AUTO-SYNC ERROR]:", syncErr);
        }

        res.status(200).json({ message: "Updated across groups" });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: "Failed to update subject" }); 
    }
};

exports.deleteSubject = async (req, res) => {
    try {
        const courseId = parseInt(req.body.course_id);
        const targetCourse = await prisma.course.findUnique({ where: { id: courseId } });
        if (targetCourse) {
            const group = await prisma.group.findUnique({ where: { id: targetCourse.groupId } });
            if (group && group.batchId) {
                const batchGroups = await prisma.group.findMany({ where: { batchId: group.batchId }, select: { id: true } });
                const batchGroupIds = batchGroups.map(g => g.id);
                await prisma.course.deleteMany({
                    where: {
                        name: targetCourse.name,
                        groupId: { in: batchGroupIds },
                        courseType: targetCourse.courseType || 1
                    }
                });
            } else {
                await prisma.course.delete({ where: { id: courseId } });
            }
        }
        res.status(200).json({ message: "Subject Deleted" });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: "Failed to delete subject." }); 
    }
};

exports.assignLecturer = async (req, res) => {
    try {
        const { subjectName, lecturerName } = req.body;
        await prisma.course.updateMany({
            where: { name: subjectName },
            data: { lecturerName }
        });
        res.status(200).json({ message: "Lecturer Assigned Successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to assign lecturer" });
    }
};

// ================= INSTALLMENTS =================
exports.getInstallments = async (req, res) => {
    try {
        const plans = await prisma.installment.findMany({ where: { batchId: parseInt(req.params.batchId) } });
        res.status(200).json(plans);
    } catch (e) { res.status(500).json({ error: "Failed to get installments" }); }
};

exports.deleteInstallment = async (req, res) => {
    try {
        await prisma.installment.delete({ where: { id: parseInt(req.body.plan_id) } });
        res.status(200).json({ message: "Deleted" });
    } catch (e) { res.status(500).json({ error: "Failed to delete installment" }); }
};

exports.createInstallment = async (req, res) => {
    try {
        const { batch_id, subjectCount, installmentsData } = req.body;
        await prisma.installment.create({ data: { batchId: parseInt(batch_id), subjectCount: parseInt(subjectCount), details: JSON.stringify(installmentsData) } });
        res.status(201).json({ message: "Created" });
    } catch (e) { res.status(500).json({ error: "Failed to create installment" }); }
};

exports.updateInstallment = async (req, res) => {
    try {
        const { plan_id, subjectCount, installmentsData } = req.body;
        await prisma.installment.update({
            where: { id: parseInt(plan_id) },
            data: { subjectCount: parseInt(subjectCount), details: JSON.stringify(installmentsData) }
        });
        res.status(200).json({ message: "Updated" });
    } catch (e) { res.status(500).json({ error: "Failed to update installment" }); }
};

// ================= FOLDERS (CONTENT GROUPS) =================
exports.addContentGroup = async (req, res) => {
    try {
        const { 
            title, type, types, order, batch_id, batchId, 
            course_code, courseCode, parentId, parent_id, 
            selectedBatches, applyToAllSubjects, applyToAllTypes 
        } = req.body;
        
        const rawBatchId = batch_id !== undefined && batch_id !== null ? batch_id : batchId;
        const parsedBatchId = parseInt(rawBatchId);
        const parsedType = parseInt(type);

        if (!title || isNaN(parsedBatchId) || isNaN(parsedType)) {
            console.error("[addContentGroup] Invalid request payload:", { title, batch_id, batchId, type });
            return res.status(400).json({ error: "Missing or invalid title, batchId, or folder type" });
        }

        const rawParentId = parentId !== undefined && parentId !== null ? parentId : parent_id;
        const parsedParentId = (rawParentId !== undefined && rawParentId !== null && rawParentId !== '' && rawParentId !== 'null' && rawParentId !== '0') 
            ? parseInt(rawParentId) 
            : null;
        let safeParentId = isNaN(parsedParentId) ? null : parsedParentId;
        let resolvedClassType = parseInt(req.body.classType || 1);
        if (safeParentId) {
            const parentExists = await prisma.contentGroup.findUnique({ where: { id: safeParentId } });
            if (!parentExists) {
                console.warn(`[addContentGroup] Parent folder ${safeParentId} not found, setting parentId to null.`);
                safeParentId = null;
            } else {
                resolvedClassType = parentExists.classType || resolvedClassType;
            }
        }

        let additionalBatchStr = null;
        if (selectedBatches) {
            try {
                const bArray = Array.isArray(selectedBatches) ? selectedBatches : JSON.parse(selectedBatches);
                if (bArray && bArray.length > 0) {
                    const others = bArray.filter(id => parseInt(id) !== parsedBatchId);
                    if (others.length > 0) additionalBatchStr = `,${others.join(',')},`;
                }
            } catch (err) {
                console.error("Error parsing selectedBatches for folder:", err);
            }
        }

        const trimmedTitle = (title || '').trim();
        
        const monthNamesList = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
        const sinhalaMonthsList = ["ජනවාරි", "පෙබරවාරි", "මාර්තු", "අප්‍රේල්", "මැයි", "ජූනි", "ජූලි", "අගෝස්තු", "සැප්තැම්බර්", "ඔක්තෝබර්", "නොවැම්බර්", "දෙසැම්බර්"];
        const normT = trimmedTitle.toLowerCase().replace(/octomber/g, 'october').replace(/septeber|septemeber|septembar/g, 'september').replace(/[\s_-]+/g, ' ').replace(/\b(month|batch|මාසය|මාස|පාඩම|පාඩම්)\b/gi, '').trim();
        const isMonthlyRoot = !safeParentId && (monthNamesList.includes(normT) || sinhalaMonthsList.includes(normT) || monthNamesList.some(m => normT.includes(m)));

        // If applyToAllSubjects is true or it's a batch-wide monthly folder, courseCode is null so it applies across all subjects in the batch!
        const isAllSubjects = applyToAllSubjects === true || applyToAllSubjects === 'true' || isMonthlyRoot;
        const rawCode = course_code !== undefined ? course_code : courseCode;
        const resolvedCourseCode = isAllSubjects 
            ? null 
            : ((rawCode === 'NULL' || !rawCode) ? null : rawCode);

        // Determine target folder types:
        // For sub-folders, only use the parent's type (parsedType).
        // For root folders, if applyToAllTypes or types array is passed:
        let targetTypes = [parsedType];
        if (!safeParentId) {
            if (Array.isArray(types) && types.length > 0) {
                targetTypes = [...new Set(types.map(t => parseInt(t)).filter(t => !isNaN(t)))];
            } else if (applyToAllTypes === true || applyToAllTypes === 'true') {
                targetTypes = [2, 3]; // Default Recordings (2) & Documents (3)
                if (parsedType && !targetTypes.includes(parsedType)) targetTypes.push(parsedType);
            }
        }

        let primaryFolder = null;

        for (const tType of targetTypes) {
            const duplicateWhere = {
                batchId: parsedBatchId,
                type: tType,
                classType: resolvedClassType,
                parentId: safeParentId,
                title: trimmedTitle
            };

            if (resolvedCourseCode) {
                duplicateWhere.courseCode = resolvedCourseCode;
            } else {
                duplicateWhere.OR = [
                    { courseCode: null },
                    { courseCode: '' }
                ];
            }

            const existingFolder = await prisma.contentGroup.findFirst({
                where: duplicateWhere,
                include: { parent: true, subFolders: true }
            });

            if (existingFolder) {
                let needsUpdate = false;
                let updatePayload = {};
                if (additionalBatchStr && existingFolder.additionalBatchIds !== additionalBatchStr) {
                    const currentBatches = (existingFolder.additionalBatchIds || '').split(',').filter(Boolean);
                    const newBatches = additionalBatchStr.split(',').filter(Boolean);
                    const merged = [...new Set([...currentBatches, ...newBatches])];
                    updatePayload.additionalBatchIds = merged.length > 0 ? `,${merged.join(',')},` : null;
                    needsUpdate = true;
                }
                if (!existingFolder.courseCode && resolvedCourseCode) {
                    updatePayload.courseCode = resolvedCourseCode;
                    needsUpdate = true;
                }
                if (needsUpdate) {
                    const updated = await prisma.contentGroup.update({
                        where: { id: existingFolder.id },
                        data: updatePayload,
                        include: { parent: true, subFolders: true }
                    });
                    if (!primaryFolder) primaryFolder = updated;
                } else {
                    if (!primaryFolder) primaryFolder = existingFolder;
                }
            } else {
                const created = await prisma.contentGroup.create({
                    data: { 
                        title: trimmedTitle, 
                        type: tType, 
                        classType: resolvedClassType,
                        itemOrder: parseInt(order) || 1, 
                        batchId: parsedBatchId, 
                        courseCode: resolvedCourseCode,
                        parentId: safeParentId,
                        additionalBatchIds: additionalBatchStr
                    },
                    include: {
                        parent: true,
                        subFolders: true
                    }
                });
                if (!primaryFolder) primaryFolder = created;
            }
        }

        res.status(201).json({ message: "Folder Created", data: primaryFolder });
    } catch (e) { 
        console.error("[addContentGroup] Add Folder Error:", e);
        res.status(500).json({ error: e.message || "Failed to create folder" }); 
    }
};

exports.updateContentGroup = async (req, res) => {
    try {
        const { contentGroupId, title, type, order, course_code, parentId, parent_id, selectedBatches } = req.body;
        const updateData = { 
            title, 
            type: parseInt(type), 
            itemOrder: parseInt(order) || 1, 
            courseCode: course_code === 'NULL' ? null : course_code 
        };

        if (req.body.classType !== undefined && req.body.classType !== null && req.body.classType !== '') {
            updateData.classType = parseInt(req.body.classType);
        }

        if (parentId !== undefined || parent_id !== undefined) {
            const rawPId = parentId !== undefined ? parentId : parent_id;
            updateData.parentId = (rawPId !== null && rawPId !== '' && rawPId !== 'null' && rawPId !== '0') ? parseInt(rawPId) : null;
        }

        if (selectedBatches !== undefined) {
            try {
                const bArray = Array.isArray(selectedBatches) ? selectedBatches : JSON.parse(selectedBatches);
                if (bArray && bArray.length > 0) {
                    const currentFolder = await prisma.contentGroup.findUnique({ where: { id: parseInt(contentGroupId) } });
                    const primaryBatchId = currentFolder?.batchId;
                    const others = bArray.filter(id => parseInt(id) !== parseInt(primaryBatchId));
                    updateData.additionalBatchIds = others.length > 0 ? `,${others.join(',')},` : null;
                } else {
                    updateData.additionalBatchIds = null;
                }
            } catch (err) {
                console.error("Error parsing selectedBatches in updateContentGroup:", err);
            }
        }

        const updatedFolder = await prisma.contentGroup.update({
            where: { id: parseInt(contentGroupId) },
            data: updateData,
            include: {
                parent: true,
                subFolders: true
            }
        });
        res.status(200).json({ message: "Folder Updated", data: updatedFolder });
    } catch (e) { console.error("Update Folder Error:", e); res.status(500).json({ error: "Failed to update folder" }); }
};

exports.deleteContentGroup = async (req, res) => {
    try {
        const folderId = parseInt(req.body.contentGroupId);
        if (!folderId) return res.status(400).json({ error: "Invalid Folder ID" });

        // Find all nested subfolder IDs
        const subFolders = await prisma.contentGroup.findMany({ where: { parentId: folderId } });
        const allGroupIds = [folderId, ...subFolders.map(sf => sf.id)];

        // Unlink content items from deleted folder(s) so content is not lost
        await prisma.content.updateMany({
            where: { contentGroupId: { in: allGroupIds } },
            data: { contentGroupId: null }
        });

        // Delete subfolders first
        await prisma.contentGroup.deleteMany({ where: { parentId: folderId } });

        // Delete the parent folder
        await prisma.contentGroup.delete({ where: { id: folderId } });
        res.status(200).json({ message: "Folder Deleted" });
    } catch (e) { console.error("Delete Folder Error:", e); res.status(500).json({ error: "Failed to delete folder" }); }
};

// ================= CONTENT & MASS ASSIGN =================
exports.addContentMassAssign = async (req, res) => {
    try {
        const { type, contentGroupId, title, link, zoomMeetingId, date, startTime, endTime, autoDeleteHours, paperTime, questionCount, isFree, selectedCourses, batch_id, itemOrder, youtubeLink, vimeoLink, selectedBatches, paperType, category, paperCategory, manualParticipantCount, timerMode, scheduledStartTime, mcqTimerMode, mcqScheduledStartTime, structuredTimerMode, structuredScheduledStartTime, breakIntervalMinutes, structuredUploadMinutes, passMarks, instructions, gradingScale, mcqDurationMinutes, structuredDurationMinutes, totalMarks, totalMcqMarks, totalStructuredMarks } = req.body;
        
        let uploadedFiles = [];
        let thumbnail = null;
        let mcqFileName = null;
        let structuredFileName = null;

        if (req.files && !Array.isArray(req.files)) {
            if (req.files['file'] && req.files['file'].length > 0) uploadedFiles = req.files['file'];
            if (req.files['thumbnail'] && req.files['thumbnail'].length > 0) thumbnail = req.files['thumbnail'][0].filename;
            if (req.files['mcqFile'] && req.files['mcqFile'].length > 0) mcqFileName = req.files['mcqFile'][0].filename;
            if (req.files['structuredFile'] && req.files['structuredFile'].length > 0) structuredFileName = req.files['structuredFile'][0].filename;
        } else if (req.file) {
            uploadedFiles = [req.file];
        }

        const sanitizedMeetingId = zoomMeetingId ? zoomMeetingId.replace(/\s+/g, '') : null;

        // Process selected batches for Multi-Batch assignment
        let primaryBatchId = parseInt(batch_id);
        let additionalBatchStr = null;
        
        if (selectedBatches) {
            try {
                const batchesArray = JSON.parse(selectedBatches);
                if (batchesArray && batchesArray.length > 0) {
                    if (!batchesArray.includes(primaryBatchId)) {
                        primaryBatchId = parseInt(batchesArray[0]);
                    }
                    const others = batchesArray.filter(id => parseInt(id) !== primaryBatchId);
                    if (others.length > 0) {
                        additionalBatchStr = `,${others.join(',')},`;
                    }
                }
            } catch (err) {
                console.error("Error parsing selectedBatches:", err);
            }
        }

        const parsedAutoDeleteHours = (autoDeleteHours !== undefined && autoDeleteHours !== null && autoDeleteHours !== '' && autoDeleteHours !== 'null') 
            ? parseFloat(autoDeleteHours) 
            : null;

        const filesToProcess = uploadedFiles.length > 0 ? uploadedFiles : [null];
        const createdContents = [];

        for (let i = 0; i < filesToProcess.length; i++) {
            const currentFile = filesToProcess[i];
            let fileName = currentFile ? currentFile.filename : null;
            if (!fileName) {
                fileName = structuredFileName || mcqFileName || null;
            }
            
            // If multiple files uploaded, give each file a sensible title
            let itemTitle = title;
            if (filesToProcess.length > 1 && currentFile) {
                const rawBaseName = currentFile.originalname ? currentFile.originalname.replace(/\.[^/.]+$/, "") : `Part ${i + 1}`;
                itemTitle = title ? `${title} (${rawBaseName})` : rawBaseName;
            }

            const data = {
                title: itemTitle, 
                contentType: type, 
                link: link, 
                youtubeLink,
                vimeoLink,
                meetingId: sanitizedMeetingId, 
                fileName, 
                thumbnail, 
                date: date ? new Date(date) : null, 
                startTime, 
                endTime,
                autoDeleteHours: parsedAutoDeleteHours,
                paperTime: paperTime ? parseInt(paperTime) : null, 
                questionCount: questionCount ? parseInt(questionCount) : null,
                isFree: isFree === '1', 
                batchId: primaryBatchId,
                additionalBatchIds: additionalBatchStr,
                courseId: 0,
                itemOrder: parseInt(itemOrder || 1) + i
            };

            if (contentGroupId && contentGroupId !== 'null' && contentGroupId !== 'undefined' && contentGroupId !== '' && contentGroupId !== '0') {
                data.contentGroupId = parseInt(contentGroupId);
            } else {
                data.contentGroupId = null;
            }

            const newContent = await prisma.content.create({ data });

            if (type === 'paper' || type === 'sPaper' || type === 'testRanking' || type === 'rankingTest') {
                let finalScheduledTime = null;
                if (timerMode === 'SCHEDULED' && scheduledStartTime) {
                    const schedStr = String(scheduledStartTime).trim();
                    if (schedStr.includes('T') || schedStr.includes('-') || schedStr.includes('/')) {
                        finalScheduledTime = new Date(schedStr);
                    } else {
                        let dStr = date ? String(date).split('T')[0] : new Date().toISOString().split('T')[0];
                        finalScheduledTime = new Date(`${dStr}T${schedStr}:00`);
                    }
                }

                const resolvedPaperType = paperType || (type === 'sPaper' ? 'STRUCTURED' : 'MCQ');
                const rawTotalDur = (paperTime !== undefined && paperTime !== '') 
                    ? parseInt(paperTime) 
                    : (req.body.durationMinutes !== undefined && req.body.durationMinutes !== '' ? parseInt(req.body.durationMinutes) : 60);

                const parsedMcqDur = mcqDurationMinutes ? parseInt(mcqDurationMinutes) : (resolvedPaperType === 'MCQ' ? rawTotalDur : 30);
                const parsedStructDur = structuredDurationMinutes ? parseInt(structuredDurationMinutes) : (resolvedPaperType === 'STRUCTURED' ? rawTotalDur : 60);
                const parsedTotalDur = resolvedPaperType === 'BOTH' 
                    ? (parsedMcqDur + parsedStructDur) 
                    : (resolvedPaperType === 'STRUCTURED' ? parsedStructDur : (resolvedPaperType === 'MCQ' ? parsedMcqDur : rawTotalDur));

                const parsedPassMarks = passMarks ? parseFloat(passMarks) : 40;
                const parsedTotalMarks = totalMarks ? parseFloat(totalMarks) : 100;
                const parsedTotalMcqMarks = totalMcqMarks ? parseFloat(totalMcqMarks) : 50;
                const parsedTotalStructMarks = totalStructuredMarks ? parseFloat(totalStructuredMarks) : 50;

                const resolvedStructuredPaper = structuredFileName || (resolvedPaperType === 'STRUCTURED' ? (uploadedFiles[0]?.filename || null) : null);
                const resolvedMcqPaper = mcqFileName || (resolvedPaperType === 'MCQ' ? (uploadedFiles[0]?.filename || null) : null);

                const resolvedMcqTimer = mcqTimerMode || timerMode || 'FLEXIBLE';
                const resolvedStructTimer = structuredTimerMode || timerMode || 'FLEXIBLE';
                const parsedMcqStartTime = mcqScheduledStartTime ? new Date(mcqScheduledStartTime) : finalScheduledTime;
                const parsedStructStartTime = structuredScheduledStartTime ? new Date(structuredScheduledStartTime) : finalScheduledTime;
                const parsedBreakInterval = breakIntervalMinutes !== undefined && breakIntervalMinutes !== '' ? parseInt(breakIntervalMinutes) : 15;
                const parsedUploadMins = structuredUploadMinutes !== undefined && structuredUploadMinutes !== '' ? parseInt(structuredUploadMinutes) : 15;
                const parsedCategory = (category || paperCategory) && ['WEEKLY', 'MONTHLY'].includes(String(category || paperCategory).toUpperCase())
                    ? String(category || paperCategory).toUpperCase()
                    : 'WEEKLY';
                const parsedHasLeaderboard = req.body.hasLeaderboard !== undefined 
                    ? (req.body.hasLeaderboard === 'true' || req.body.hasLeaderboard === '1' || req.body.hasLeaderboard === true)
                    : true;
                const parsedParticipantCount = (manualParticipantCount !== undefined && manualParticipantCount !== null && manualParticipantCount !== '')
                    ? parseInt(manualParticipantCount)
                    : null;

                let parsedGradingScale = null;
                if (gradingScale !== undefined && gradingScale !== null && gradingScale !== '') {
                    parsedGradingScale = typeof gradingScale === 'string' ? gradingScale : JSON.stringify(gradingScale);
                }

                await prisma.paper.upsert({
                    where: { contentId: newContent.id },
                    create: {
                        contentId: newContent.id,
                        paperType: resolvedPaperType,
                        category: parsedCategory,
                        hasLeaderboard: parsedHasLeaderboard,
                        manualParticipantCount: parsedParticipantCount,
                        durationMinutes: parsedTotalDur,
                        mcqDurationMinutes: parsedMcqDur,
                        structuredDurationMinutes: parsedStructDur,
                        totalMarks: parsedTotalMarks,
                        totalMcqMarks: parsedTotalMcqMarks,
                        totalStructuredMarks: parsedTotalStructMarks,
                        passMarks: parsedPassMarks,
                        instructions: instructions || '',
                        gradingScale: parsedGradingScale,
                        timerMode: timerMode || 'FLEXIBLE',
                        scheduledStartTime: finalScheduledTime,
                        mcqTimerMode: resolvedMcqTimer,
                        mcqScheduledStartTime: parsedMcqStartTime,
                        structuredTimerMode: resolvedStructTimer,
                        structuredScheduledStartTime: parsedStructStartTime,
                        breakIntervalMinutes: parsedBreakInterval,
                        structuredUploadMinutes: parsedUploadMins,
                        mcqPaperFile: resolvedMcqPaper,
                        structuredPaperFile: resolvedStructuredPaper
                    },
                    update: {
                        paperType: resolvedPaperType,
                        category: parsedCategory,
                        hasLeaderboard: parsedHasLeaderboard,
                        manualParticipantCount: parsedParticipantCount,
                        durationMinutes: parsedTotalDur,
                        mcqDurationMinutes: parsedMcqDur,
                        structuredDurationMinutes: parsedStructDur,
                        totalMarks: parsedTotalMarks,
                        totalMcqMarks: parsedTotalMcqMarks,
                        totalStructuredMarks: parsedTotalStructMarks,
                        passMarks: parsedPassMarks,
                        instructions: instructions || '',
                        gradingScale: parsedGradingScale,
                        timerMode: timerMode || 'FLEXIBLE',
                        scheduledStartTime: finalScheduledTime,
                        mcqTimerMode: resolvedMcqTimer,
                        mcqScheduledStartTime: parsedMcqStartTime,
                        structuredTimerMode: resolvedStructTimer,
                        structuredScheduledStartTime: parsedStructStartTime,
                        breakIntervalMinutes: parsedBreakInterval,
                        structuredUploadMinutes: parsedUploadMins,
                        ...(resolvedMcqPaper ? { mcqPaperFile: resolvedMcqPaper } : {}),
                        ...(resolvedStructuredPaper ? { structuredPaperFile: resolvedStructuredPaper } : {})
                    }
                });

                if (!newContent.fileName && (resolvedStructuredPaper || resolvedMcqPaper)) {
                    await prisma.content.update({
                        where: { id: newContent.id },
                        data: { fileName: resolvedStructuredPaper || resolvedMcqPaper }
                    });
                }
            }

            if (selectedCourses) {
                const coursesArray = JSON.parse(selectedCourses);
                const assignedCourseIds = [...new Set(coursesArray.map(Number))].filter(Boolean);

                const contentCourseData = assignedCourseIds.map(cId => ({ 
                    content_id: newContent.id, 
                    course_id: BigInt(cId), 
                    type: getTypeInt(type) 
                }));
                if (contentCourseData.length > 0) await prisma.contentCourse.createMany({ data: contentCourseData });
            }

            createdContents.push(newContent);
        }

        res.status(201).json({ message: "Assigned Successfully", data: createdContents[0], all: createdContents });
    } catch (e) { 
        console.error("addContentMassAssign Error:", e); 
        res.status(500).json({ error: "Failed to add content" }); 
    }
};

exports.updateContentMassAssign = async (req, res) => {
    try {
        const { content_id, type, contentGroupId, title, link, zoomMeetingId, date, startTime, endTime, autoDeleteHours, paperTime, questionCount, isFree, itemOrder, selectedCourses, selectedBatches, youtubeLink, vimeoLink, paperType, category, paperCategory, manualParticipantCount, timerMode, scheduledStartTime, mcqTimerMode, mcqScheduledStartTime, structuredTimerMode, structuredScheduledStartTime, breakIntervalMinutes, structuredUploadMinutes, passMarks, instructions, gradingScale, mcqDurationMinutes, structuredDurationMinutes, totalMarks, totalMcqMarks, totalStructuredMarks } = req.body;
        
        const sanitizedMeetingId = zoomMeetingId ? zoomMeetingId.replace(/\s+/g, '') : null;

        const parsedAutoDeleteHours = (autoDeleteHours !== undefined && autoDeleteHours !== null && autoDeleteHours !== '' && autoDeleteHours !== 'null') 
            ? parseFloat(autoDeleteHours) 
            : null;

        let updateData = { 
            title, 
            contentType: type, 
            link: link, 
            youtubeLink: youtubeLink || null,
            vimeoLink: vimeoLink || null,
            meetingId: sanitizedMeetingId, 
            date: date ? new Date(date) : null, 
            startTime, 
            endTime, 
            autoDeleteHours: parsedAutoDeleteHours,
            paperTime: paperTime ? parseInt(paperTime) : null, 
            questionCount: questionCount ? parseInt(questionCount) : null, 
            isFree: isFree === '1',
            itemOrder: parseInt(itemOrder || 1)
        };

        // Parse selectedBatches to update batchId & additionalBatchIds on the content
        let updatedBatchId = undefined;
        let updatedAdditionalBatchIds = undefined;
        if (selectedBatches) {
            try {
                const batchesArray = Array.isArray(selectedBatches) ? selectedBatches : JSON.parse(selectedBatches);
                const numBatches = batchesArray.map(Number).filter(n => !isNaN(n));
                if (numBatches.length > 0) {
                    const currentC = await prisma.content.findUnique({ where: { id: parseInt(content_id) }, select: { batchId: true } });
                    const primary = (currentC && numBatches.includes(currentC.batchId)) ? currentC.batchId : numBatches[0];
                    const others = numBatches.filter(id => id !== primary);
                    updatedBatchId = primary;
                    updatedAdditionalBatchIds = others.length > 0 ? `,${others.join(',')},` : null;
                    updateData.batchId = updatedBatchId;
                    updateData.additionalBatchIds = updatedAdditionalBatchIds;
                }
            } catch (err) {
                console.error("Error parsing selectedBatches in update:", err);
            }
        }

        if (type === 'live') {
            updateData.reminderSent = false;
        }

        if (contentGroupId && contentGroupId !== 'null' && contentGroupId !== 'undefined' && contentGroupId !== '' && contentGroupId !== '0' && contentGroupId !== 'uncategorized') {
            updateData.contentGroupId = parseInt(contentGroupId);
        } else if (contentGroupId === 'uncategorized') {
            updateData.contentGroupId = null;
        }

        let mcqFileName = null;
        let structuredFileName = null;

        if (req.files && !Array.isArray(req.files)) {
            if (req.files['file'] && req.files['file'].length > 0) updateData.fileName = req.files['file'][0].filename;
            if (req.files['thumbnail'] && req.files['thumbnail'].length > 0) updateData.thumbnail = req.files['thumbnail'][0].filename;
            if (req.files['mcqFile'] && req.files['mcqFile'].length > 0) mcqFileName = req.files['mcqFile'][0].filename;
            if (req.files['structuredFile'] && req.files['structuredFile'].length > 0) structuredFileName = req.files['structuredFile'][0].filename;
        } else if (req.file) {
            updateData.fileName = req.file.filename;
        }

        if (structuredFileName) {
            updateData.fileName = structuredFileName;
        } else if (mcqFileName && !updateData.fileName) {
            updateData.fileName = mcqFileName;
        }

        const updated = await prisma.content.update({ where: { id: parseInt(content_id) }, data: updateData });

        if (type === 'paper' || type === 'sPaper' || type === 'testRanking' || type === 'rankingTest') {
            const { paperType } = req.body;
            let finalScheduledTime = null;
            if (timerMode === 'SCHEDULED' && scheduledStartTime) {
                const schedStr = String(scheduledStartTime).trim();
                if (schedStr.includes('T') || schedStr.includes('-') || schedStr.includes('/')) {
                    finalScheduledTime = new Date(schedStr);
                } else {
                    let dStr = date ? String(date).split('T')[0] : new Date().toISOString().split('T')[0];
                    finalScheduledTime = new Date(`${dStr}T${schedStr}:00`);
                }
            }

            const resolvedPaperType = paperType || (type === 'sPaper' ? 'STRUCTURED' : (type === 'paper' ? 'MCQ' : undefined));
            let rawTotalDur = (paperTime !== undefined && paperTime !== '') 
                ? parseInt(paperTime) 
                : (req.body.durationMinutes !== undefined && req.body.durationMinutes !== '' ? parseInt(req.body.durationMinutes) : undefined);

            let parsedMcqDur = (mcqDurationMinutes !== undefined && mcqDurationMinutes !== '') 
                ? parseInt(mcqDurationMinutes) 
                : (resolvedPaperType === 'MCQ' && rawTotalDur !== undefined ? rawTotalDur : undefined);
            let parsedStructDur = (structuredDurationMinutes !== undefined && structuredDurationMinutes !== '') 
                ? parseInt(structuredDurationMinutes) 
                : (resolvedPaperType === 'STRUCTURED' && rawTotalDur !== undefined ? rawTotalDur : undefined);
            
            let parsedTotalDur = rawTotalDur;
            if (resolvedPaperType === 'BOTH' && parsedMcqDur !== undefined && parsedStructDur !== undefined) {
                parsedTotalDur = parsedMcqDur + parsedStructDur;
            } else if (resolvedPaperType === 'STRUCTURED' && parsedStructDur !== undefined) {
                parsedTotalDur = parsedStructDur;
            } else if (resolvedPaperType === 'MCQ' && parsedMcqDur !== undefined) {
                parsedTotalDur = parsedMcqDur;
            }

            const parsedPassMarks = passMarks !== undefined && passMarks !== '' ? parseFloat(passMarks) : undefined;
            const parsedTotalMarks = totalMarks !== undefined && totalMarks !== '' ? parseFloat(totalMarks) : undefined;
            const parsedTotalMcqMarks = totalMcqMarks !== undefined && totalMcqMarks !== '' ? parseFloat(totalMcqMarks) : undefined;
            const parsedTotalStructMarks = totalStructuredMarks !== undefined && totalStructuredMarks !== '' ? parseFloat(totalStructuredMarks) : undefined;

            const resolvedMcqTimer = mcqTimerMode || timerMode || 'FLEXIBLE';
            const resolvedStructTimer = structuredTimerMode || timerMode || 'FLEXIBLE';
            const parsedMcqStartTime = mcqScheduledStartTime ? new Date(mcqScheduledStartTime) : finalScheduledTime;
            const parsedStructStartTime = structuredScheduledStartTime ? new Date(structuredScheduledStartTime) : finalScheduledTime;
            const parsedBreakInterval = breakIntervalMinutes !== undefined && breakIntervalMinutes !== '' ? parseInt(breakIntervalMinutes) : 15;
            const parsedUploadMins = structuredUploadMinutes !== undefined && structuredUploadMinutes !== '' ? parseInt(structuredUploadMinutes) : 15;
            const parsedCategory = (category || paperCategory) && ['WEEKLY', 'MONTHLY'].includes(String(category || paperCategory).toUpperCase())
                ? String(category || paperCategory).toUpperCase()
                : 'WEEKLY';
            const parsedHasLeaderboard = req.body.hasLeaderboard !== undefined 
                ? (req.body.hasLeaderboard === 'true' || req.body.hasLeaderboard === '1' || req.body.hasLeaderboard === true)
                : undefined;
            const parsedParticipantCount = (manualParticipantCount !== undefined && manualParticipantCount !== null && manualParticipantCount !== '')
                ? parseInt(manualParticipantCount)
                : null;

            let parsedGradingScale = undefined;
            if (gradingScale !== undefined && gradingScale !== null && gradingScale !== '') {
                parsedGradingScale = typeof gradingScale === 'string' ? gradingScale : JSON.stringify(gradingScale);
            }

            await prisma.paper.upsert({
                where: { contentId: updated.id },
                create: {
                    contentId: updated.id,
                    paperType: resolvedPaperType || 'MCQ',
                    category: parsedCategory,
                    hasLeaderboard: parsedHasLeaderboard !== undefined ? parsedHasLeaderboard : true,
                    manualParticipantCount: parsedParticipantCount,
                    durationMinutes: parsedTotalDur || 60,
                    mcqDurationMinutes: parsedMcqDur !== undefined ? parsedMcqDur : (resolvedPaperType === 'MCQ' ? (parsedTotalDur || 60) : 30),
                    structuredDurationMinutes: parsedStructDur !== undefined ? parsedStructDur : (resolvedPaperType === 'STRUCTURED' ? (parsedTotalDur || 60) : 60),
                    totalMarks: parsedTotalMarks !== undefined ? parsedTotalMarks : 100,
                    totalMcqMarks: parsedTotalMcqMarks !== undefined ? parsedTotalMcqMarks : 50,
                    totalStructuredMarks: parsedTotalStructMarks !== undefined ? parsedTotalStructMarks : 50,
                    timerMode: timerMode || 'FLEXIBLE',
                    scheduledStartTime: finalScheduledTime,
                    mcqTimerMode: resolvedMcqTimer,
                    mcqScheduledStartTime: parsedMcqStartTime,
                    structuredTimerMode: resolvedStructTimer,
                    structuredScheduledStartTime: parsedStructStartTime,
                    breakIntervalMinutes: parsedBreakInterval,
                    structuredUploadMinutes: parsedUploadMins,
                    passMarks: parsedPassMarks !== undefined ? parsedPassMarks : 40,
                    instructions: instructions || '',
                    gradingScale: parsedGradingScale || null,
                    mcqPaperFile: mcqFileName || null,
                    structuredPaperFile: structuredFileName || null
                },
                update: {
                    ...(resolvedPaperType ? { paperType: resolvedPaperType } : {}),
                    category: parsedCategory,
                    ...(parsedHasLeaderboard !== undefined ? { hasLeaderboard: parsedHasLeaderboard } : {}),
                    ...(manualParticipantCount !== undefined ? { manualParticipantCount: parsedParticipantCount } : {}),
                    ...(parsedTotalDur !== undefined ? { durationMinutes: parsedTotalDur } : {}),
                    ...(parsedMcqDur !== undefined ? { mcqDurationMinutes: parsedMcqDur } : {}),
                    ...(parsedStructDur !== undefined ? { structuredDurationMinutes: parsedStructDur } : {}),
                    ...(parsedTotalMarks !== undefined ? { totalMarks: parsedTotalMarks } : {}),
                    ...(parsedTotalMcqMarks !== undefined ? { totalMcqMarks: parsedTotalMcqMarks } : {}),
                    ...(parsedTotalStructMarks !== undefined ? { totalStructuredMarks: parsedTotalStructMarks } : {}),
                    ...(timerMode ? { timerMode } : {}),
                    scheduledStartTime: finalScheduledTime,
                    ...(mcqTimerMode ? { mcqTimerMode } : {}),
                    ...(parsedMcqStartTime ? { mcqScheduledStartTime: parsedMcqStartTime } : {}),
                    ...(structuredTimerMode ? { structuredTimerMode } : {}),
                    ...(parsedStructStartTime ? { structuredScheduledStartTime: parsedStructStartTime } : {}),
                    ...(breakIntervalMinutes !== undefined ? { breakIntervalMinutes: parsedBreakInterval } : {}),
                    ...(structuredUploadMinutes !== undefined ? { structuredUploadMinutes: parsedUploadMins } : {}),
                    ...(parsedPassMarks !== undefined ? { passMarks: parsedPassMarks } : {}),
                    ...(instructions !== undefined ? { instructions } : {}),
                    ...(parsedGradingScale !== undefined ? { gradingScale: parsedGradingScale } : {}),
                    ...(mcqFileName ? { mcqPaperFile: mcqFileName } : {}),
                    ...(structuredFileName ? { structuredPaperFile: structuredFileName } : {})
                }
            });
        }

        if (selectedCourses) {
            const coursesArray = JSON.parse(selectedCourses);
            await prisma.contentCourse.deleteMany({ where: { content_id: parseInt(content_id) } });
            
            const assignedCourseIds = [...new Set(coursesArray.map(Number))].filter(Boolean);

            if (assignedCourseIds.length > 0) {
                const contentCourseData = assignedCourseIds.map(cId => ({ 
                    content_id: parseInt(content_id), 
                    course_id: BigInt(cId), 
                    type: getTypeInt(type) 
                }));
                await prisma.contentCourse.createMany({ data: contentCourseData });

                // If selectedBatches was not explicitly passed, sync batchId and additionalBatchIds from remaining assigned courses:
                if (updatedBatchId === undefined) {
                    const remainingCourses = await prisma.course.findMany({
                        where: { id: { in: assignedCourseIds } },
                        select: { group: { select: { batchId: true } } }
                    });
                    const bIds = [...new Set(remainingCourses.map(c => c.group?.batchId).filter(Boolean))];
                    if (bIds.length > 0) {
                        const currentC = await prisma.content.findUnique({ where: { id: parseInt(content_id) }, select: { batchId: true } });
                        const primary = (currentC && bIds.includes(currentC.batchId)) ? currentC.batchId : bIds[0];
                        const others = bIds.filter(id => id !== primary);
                        await prisma.content.update({
                            where: { id: parseInt(content_id) },
                            data: {
                                batchId: primary,
                                additionalBatchIds: others.length > 0 ? `,${others.join(',')},` : null
                            }
                        });
                    }
                }
            }
        }

        res.status(200).json(updated);
    } catch (e) { 
        console.error("updateContentMassAssign Error:", e); 
        res.status(500).json({ error: "Failed to update content" }); 
    }
};

exports.deleteContent = async (req, res) => {
    try {
        const { content_id } = req.body;
        const cId = parseInt(content_id);
        // Unlink any tasks referencing this content
        await prisma.task.updateMany({ where: { contentId: cId }, data: { contentId: null } });
        await prisma.contentCourse.deleteMany({ where: { content_id: cId } });
        await prisma.content.delete({ where: { id: cId } });
        res.status(200).json({ message: "Deleted" });
    } catch (e) { console.error("Delete Content Error:", e); res.status(500).json({ error: "Failed to delete" }); }
};

// 🔥 FIX: Selective Unlink - Remove content from a specific class/subject without deleting it from other batches/classes
exports.unlinkContentCourse = async (req, res) => {
    try {
        const { content_id, courseIds } = req.body;
        const cId = parseInt(content_id);
        if (!cId) return res.status(400).json({ error: "Missing content_id" });

        let targetCourseIds = [];
        if (Array.isArray(courseIds)) {
            targetCourseIds = courseIds.map(id => BigInt(id));
        } else if (typeof courseIds === 'string') {
            targetCourseIds = courseIds.split(',').filter(Boolean).map(id => BigInt(id));
        } else if (courseIds !== undefined && courseIds !== null) {
            targetCourseIds = [BigInt(courseIds)];
        }

        if (targetCourseIds.length === 0) {
            return res.status(400).json({ error: "Missing courseIds to unlink" });
        }

        // Delete contentCourse records for these specific courses
        await prisma.contentCourse.deleteMany({
            where: {
                content_id: cId,
                course_id: { in: targetCourseIds }
            }
        });

        // Check if there are any remaining course assignments
        const remaining = await prisma.contentCourse.findMany({
            where: { content_id: cId }
        });

        if (remaining.length === 0) {
            // No other courses left: delete content completely
            await prisma.task.updateMany({ where: { contentId: cId }, data: { contentId: null } });
            await prisma.content.delete({ where: { id: cId } });
            return res.status(200).json({ message: "Content removed completely as no other classes remain", remainingCount: 0 });
        }

        // Update batchId & additionalBatchIds to match remaining courses
        const remCourses = await prisma.course.findMany({
            where: { id: { in: remaining.map(r => Number(r.course_id)) } },
            select: { group: { select: { batchId: true } } }
        });
        const remainingBatchIds = [...new Set(remCourses.map(c => c.group?.batchId).filter(Boolean))];
        const currentContent = await prisma.content.findUnique({ where: { id: cId }, select: { batchId: true } });
        
        let newPrimaryBatch = currentContent?.batchId;
        if (!remainingBatchIds.includes(newPrimaryBatch) && remainingBatchIds.length > 0) {
            newPrimaryBatch = remainingBatchIds[0];
        }
        const others = remainingBatchIds.filter(bId => bId !== newPrimaryBatch);
        const newAdditionalBatches = others.length > 0 ? `,${others.join(',')},` : null;

        await prisma.content.update({
            where: { id: cId },
            data: {
                batchId: newPrimaryBatch,
                additionalBatchIds: newAdditionalBatches
            }
        });

        res.status(200).json({ message: "Content unlinked from selected subject successfully", remainingCount: remaining.length });
    } catch (error) {
        console.error("unlinkContentCourse Error:", error);
        res.status(500).json({ error: "Failed to unlink content from course" });
    }
};

exports.getContents = async (req, res) => {
    try {
        const { batchId, courseCode, courseIds } = req.query;
        
        const rawIds = courseIds ? courseIds.split(',') : [req.query.courseId];
        const courseIdArray = rawIds
            .filter(id => id && id !== 'undefined' && id !== 'null' && id.trim() !== '')
            .map(id => BigInt(id));

        // Determine classType strictly (1: Theory, 2: Paper)
        let targetClassType = req.query.classType ? parseInt(req.query.classType) : null;
        if (!targetClassType && courseIdArray.length > 0) {
            try {
                const crs = await prisma.course.findFirst({
                    where: { id: { in: courseIdArray.map(Number) } },
                    select: { courseType: true, group: { select: { classType: true } } }
                });
                if (crs) targetClassType = parseInt(crs.courseType || crs.group?.classType || 1);
            } catch (e) {}
        }
        if (!targetClassType) targetClassType = 1;

        // Get all related courses to find all variations of courseCode (e.g. "22" and "SUB_315")
        let allSubjectCourseCodes = [];
        if (courseCode && courseCode !== 'null' && courseCode !== 'undefined') {
            allSubjectCourseCodes.push(courseCode);
            if (courseCode.startsWith('SUB_')) allSubjectCourseCodes.push(courseCode.replace('SUB_', ''));
            else allSubjectCourseCodes.push(`SUB_${courseCode}`);
        }
        if (courseIdArray.length > 0) {
            try {
                const subjectCourses = await prisma.course.findMany({
                    where: { id: { in: courseIdArray.map(id => Number(id)) } },
                    select: { id: true, code: true }
                });
                subjectCourses.forEach(sc => {
                    if (sc.code) {
                        allSubjectCourseCodes.push(sc.code);
                        allSubjectCourseCodes.push(`SUB_${sc.code}`);
                    }
                    allSubjectCourseCodes.push(`SUB_${sc.id}`);
                    allSubjectCourseCodes.push(String(sc.id));
                });
            } catch (err) {}
        }
        allSubjectCourseCodes = [...new Set(allSubjectCourseCodes.filter(Boolean))];

        const linkedCourses = await prisma.contentCourse.findMany({ where: { course_id: { in: courseIdArray } } });
        const contentIds = linkedCourses.map(lc => lc.content_id);

        const contents = await prisma.content.findMany({
            where: { id: { in: contentIds } },
            orderBy: { createdAt: 'desc' },
            include: { 
                group: {
                    include: {
                        parent: true
                    }
                },
                paper: true
            }
        });

        // Content walata assign wela thiyena courses serama pre-populate wenna yawana eka
        const allContentCourses = await prisma.contentCourse.findMany({
            where: { content_id: { in: contentIds } }
        });

        const contentGroupIds = [...new Set(contents.map(c => c.contentGroupId).filter(Boolean))];
        const contentGroupTitles = [...new Set(contents.map(c => c.group?.title).filter(Boolean))];

        const parsedBatchId = parseInt(batchId);
        const initialGroups = await prisma.contentGroup.findMany({
            where: {
                classType: targetClassType, // Strictly isolate Theory (1) vs Paper (2)
                OR: [
                    parsedBatchId ? { batchId: parsedBatchId, courseCode: { in: allSubjectCourseCodes } } : undefined,
                    parsedBatchId ? { batchId: parsedBatchId, courseCode: null } : undefined,
                    parsedBatchId ? { batchId: parsedBatchId, courseCode: '' } : undefined,
                    parsedBatchId ? { additionalBatchIds: { contains: `,${parsedBatchId},` } } : undefined,
                    parsedBatchId && contentGroupTitles.length > 0 ? { batchId: parsedBatchId, title: { in: contentGroupTitles } } : undefined,
                    contentGroupIds.length > 0 ? { id: { in: contentGroupIds } } : undefined
                ].filter(Boolean)
            },
            orderBy: { itemOrder: 'asc' },
            include: {
                subFolders: {
                    orderBy: { itemOrder: 'asc' }
                }
            }
        });

        // Fetch any missing parent folders for subfolders
        const parentIdsToFetch = initialGroups.map(g => g.parentId).filter(Boolean);
        const allGroupsMap = new Map();
        initialGroups.forEach(g => allGroupsMap.set(g.id, g));

        if (parentIdsToFetch.length > 0) {
            const parentGroups = await prisma.contentGroup.findMany({
                where: { id: { in: parentIdsToFetch }, classType: targetClassType },
                include: { subFolders: true }
            });
            parentGroups.forEach(pg => allGroupsMap.set(pg.id, pg));
        }

        // Fetch any subfolders of root folders
        const rootIds = Array.from(allGroupsMap.values()).filter(g => !g.parentId).map(g => g.id);
        if (rootIds.length > 0) {
            const subGroups = await prisma.contentGroup.findMany({
                where: { parentId: { in: rootIds }, classType: targetClassType }
            });
            subGroups.forEach(sg => allGroupsMap.set(sg.id, sg));
        }

        const lessonGroups = Array.from(allGroupsMap.values());

        const normalizeFolderTitle = (title) => {
            if (!title) return '';
            return title
                .toLowerCase()
                .replace(/octomber/g, 'october')
                .replace(/septeber|septemeber|septembar/g, 'september')
                .replace(/[\s_-]+/g, ' ')
                .replace(/\b(month|batch|මාසය|මාස|පාඩම|පාඩම්)\b/gi, '')
                .trim();
        };

        // Merge root folders that share the same normalized title and type to prevent duplicates
        const mergedRootMap = new Map();
        const unparentedGroups = lessonGroups.filter(g => !g.parentId || !lessonGroups.some(p => p.id === g.parentId));
        
        unparentedGroups.forEach(g => {
            const titleKey = normalizeFolderTitle(g.title) || (g.title || '').trim().toLowerCase();
            const groupKey = `${g.type}_${titleKey}`;
            if (!mergedRootMap.has(groupKey)) {
                mergedRootMap.set(groupKey, {
                    ...g,
                    allIds: [g.id],
                    rawSubFolders: [...(g.subFolders || [])]
                });
            } else {
                const existing = mergedRootMap.get(groupKey);
                if (!existing.allIds.includes(g.id)) existing.allIds.push(g.id);
                if (g.subFolders && g.subFolders.length > 0) {
                    existing.rawSubFolders.push(...g.subFolders);
                }
            }
        });

        // Also collect subfolders that might be defined outside g.subFolders
        lessonGroups.forEach(g => {
            if (g.parentId) {
                for (const mergedRoot of mergedRootMap.values()) {
                    if (mergedRoot.allIds.includes(g.parentId)) {
                        mergedRoot.rawSubFolders.push(g);
                        break;
                    }
                }
            }
        });

        const finalMergedLessonGroups = [];
        mergedRootMap.forEach(mergedRoot => {
            // Deduplicate subfolders by title and type
            const mergedSubMap = new Map();
            (mergedRoot.rawSubFolders || []).forEach(sf => {
                const subTitleKey = normalizeFolderTitle(sf.title) || (sf.title || '').trim().toLowerCase();
                const subKey = `${sf.type}_${subTitleKey}`;
                if (!mergedSubMap.has(subKey)) {
                    mergedSubMap.set(subKey, {
                        ...sf,
                        parentId: mergedRoot.id,
                        allIds: [sf.id]
                    });
                } else {
                    const existingSub = mergedSubMap.get(subKey);
                    if (!existingSub.allIds.includes(sf.id)) existingSub.allIds.push(sf.id);
                }
            });
            const deduplicatedSubs = Array.from(mergedSubMap.values());
            delete mergedRoot.rawSubFolders;
            mergedRoot.subFolders = deduplicatedSubs;
            finalMergedLessonGroups.push(mergedRoot);
            deduplicatedSubs.forEach(sf => finalMergedLessonGroups.push(sf));
        });

        // Flatten all groups in current batch (root + subfolders)
        const allBatchGroups = [...finalMergedLessonGroups];

        const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
        const sinhalaMonths = ["ජනවාරි", "පෙබරවාරි", "මාර්තු", "අප්‍රේල්", "මැයි", "ජූනි", "ජූලි", "අගෝස්තු", "සැප්තැම්බර්", "ඔක්තෝබර්", "නොවැම්බර්", "දෙසැම්බර්"];

        const contentsWithCourses = contents.map(c => {
            const cleanContent = { ...c };
            let finalGroupId = c.contentGroupId;
            let groupTitle = c.group?.title || null;
            let parentGroupTitle = c.group?.parent?.title || null;
            let parentGroupId = c.group?.parentId || null;
            delete cleanContent.group;

            const typeInt = (c.contentType === 'live' || c.contentType === '1') ? 1
                : (c.contentType === 'recording' || c.contentType === '2') ? 2
                : (c.contentType === 'document' || c.contentType === '3') ? 3
                : (c.contentType === 'testRanking' || c.contentType === 'rankingTest' || c.contentType === 'ranking_test' || c.contentType === 'test' || c.contentType === 'sPaper' || c.contentType === '4' || c.contentType === 'paper' || c.contentType === '5') ? 4 : null;

            // 1. Direct ID or allIds match in merged groups (roots or subfolders)
            if (finalGroupId) {
                const matchingMergedGroup = allBatchGroups.find(bg => 
                    (typeInt ? bg.type === typeInt : true) && 
                    ((bg.allIds && bg.allIds.includes(finalGroupId)) || bg.id === finalGroupId)
                );
                if (matchingMergedGroup) {
                    finalGroupId = matchingMergedGroup.id;
                    groupTitle = matchingMergedGroup.title;
                    if (matchingMergedGroup.parentId) {
                        parentGroupId = matchingMergedGroup.parentId;
                        const parentG = allBatchGroups.find(p => p.id === matchingMergedGroup.parentId || (p.allIds && p.allIds.includes(matchingMergedGroup.parentId)));
                        parentGroupTitle = parentG?.title || parentGroupTitle;
                    }
                }
            }

            // 2. Title matching fallback if group title is known and folder doesn't match ID
            const isAssignedValid = finalGroupId && allBatchGroups.some(g => g.id === finalGroupId || (g.allIds && g.allIds.includes(finalGroupId)));
            if (!isAssignedValid && groupTitle) {
                const normItem = normalizeFolderTitle(groupTitle);
                const rawItem = groupTitle.trim().toLowerCase();

                const matchedGroup = allBatchGroups.find(bg => {
                    if (typeInt && bg.type !== typeInt) return false;
                    const bgRaw = (bg.title || '').trim().toLowerCase();
                    const bgNorm = normalizeFolderTitle(bg.title);
                    return bgRaw === rawItem || (normItem && bgNorm && normItem === bgNorm);
                });

                if (matchedGroup) {
                    finalGroupId = matchedGroup.id;
                    groupTitle = matchedGroup.title;
                    if (matchedGroup.parentId) {
                        parentGroupId = matchedGroup.parentId;
                        const parentG = allBatchGroups.find(p => p.id === matchedGroup.parentId || (p.allIds && p.allIds.includes(matchedGroup.parentId)));
                        parentGroupTitle = parentG?.title || parentGroupTitle;
                    }
                }
            }

            // 3. Smart Month matching fallback (Handles null contentGroupId or cross-batch month folders)
            const isNowAssigned = finalGroupId && allBatchGroups.some(g => g.id === finalGroupId || (g.allIds && g.allIds.includes(finalGroupId)));
            if (!isNowAssigned) {
                let targetMonthIdx = -1;
                if (c.date) {
                    try {
                        const d = new Date(c.date);
                        if (!isNaN(d.getTime())) {
                            targetMonthIdx = d.getMonth();
                        }
                    } catch (err) {}
                }
                if (targetMonthIdx === -1 && c.title) {
                    const titleLower = c.title.toLowerCase();
                    targetMonthIdx = monthNames.findIndex(m => titleLower.includes(m));
                    if (targetMonthIdx === -1) {
                        targetMonthIdx = sinhalaMonths.findIndex(m => titleLower.includes(m));
                    }
                }

                if (targetMonthIdx !== -1) {
                    const engMonth = monthNames[targetMonthIdx];
                    const sinMonth = sinhalaMonths[targetMonthIdx];

                    const matchedGroup = allBatchGroups.find(bg => {
                        if (typeInt && bg.type !== typeInt) return false;
                        const bgTitleLower = (bg.title || '').toLowerCase();
                        const bgNorm = normalizeFolderTitle(bg.title);
                        return bgTitleLower.includes(engMonth) || bgTitleLower.includes(sinMonth) ||
                               bgNorm.includes(engMonth) || bgNorm.includes(sinMonth);
                    });

                    if (matchedGroup) {
                        finalGroupId = matchedGroup.id;
                        groupTitle = matchedGroup.title;
                        if (matchedGroup.parentId) {
                            parentGroupId = matchedGroup.parentId;
                            const parentG = allBatchGroups.find(p => p.id === matchedGroup.parentId || (p.allIds && p.allIds.includes(matchedGroup.parentId)));
                            parentGroupTitle = parentG?.title || parentGroupTitle;
                        }
                    }
                }
            }

            // 4. Auto-healing: If content was unlinked (null), persist finalGroupId in DB
            if (!c.contentGroupId && finalGroupId) {
                prisma.content.update({
                    where: { id: c.id },
                    data: { contentGroupId: finalGroupId }
                }).catch(() => {});
            }

            return {
                ...cleanContent,
                contentGroupId: finalGroupId,
                originalContentGroupId: c.contentGroupId,
                groupTitle: groupTitle,
                parentGroupTitle: parentGroupTitle,
                parentGroupId: parentGroupId,
                assignedCourses: allContentCourses.filter(cc => cc.content_id === c.id).map(cc => Number(cc.course_id))
            };
        });

        const safeJson = (data) => JSON.parse(JSON.stringify(data, (k, v) => typeof v === 'bigint' ? v.toString() : v));
        res.status(200).json({ lessonGroups: finalMergedLessonGroups, contents: safeJson(contentsWithCourses) });
    } catch (e) { console.error("getContents Error:", e); res.status(500).json({ error: "Failed to fetch contents" }); }
};

// ================= BATCHES FULL DATA =================
exports.getBatchesFull = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.id;
        const userRole = req.user.role;
        const businessType = req.user.businessType;
        
        const roleUpper = userRole ? userRole.toUpperCase().replace(/ /g, '_') : '';
        const isAdmin = ['SYSTEM_ADMIN', 'DIRECTOR'].includes(roleUpper);
        
        let whereClause = {};
        
        if (!isAdmin) {
            const allBiz = await prisma.business.findMany();
            const userBizList = businessType ? String(businessType).split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
            const myBizs = allBiz.filter(biz => {
                const isManagerOf = (biz.head_manager_id && String(biz.head_manager_id) === String(userId)) ||
                                    (biz.ass_manager_id && String(biz.ass_manager_id) === String(userId));
                const matchesBizType = userBizList.some(b => 
                    b === String(biz.id) ||
                    b === biz.name.toLowerCase().trim() ||
                    biz.name.toLowerCase().trim().includes(b) ||
                    b.includes(biz.name.toLowerCase().trim())
                );
                return isManagerOf || matchesBizType;
            });
            const myBizIds = myBizs.map(b => b.id);
            if (myBizIds.length > 0) {
                whereClause = { businessId: { in: myBizIds } };
            }
        }

        const batches = await prisma.batch.findMany({ 
            where: whereClause,
            include: { 
                business: true, 
                groups: { 
                    include: { courses: true },
                    orderBy: [{ itemOrder: 'asc' }, { id: 'asc' }]
                } 
            } 
        });

        const safeData = JSON.parse(JSON.stringify(batches, (key, value) => typeof value === 'bigint' ? value.toString() : value));
        res.status(200).json(safeData);
    } catch (error) { 
        console.error(error);
        res.status(500).json({ message: "Server Error" }); 
    }
};

// ================= POSTS =================

exports.createAdminPost = async (req, res) => {
    try {
        let { title, description, businessId, batchId } = req.body;
        
        const scopedBizId = await getScopedBusinessId(req.user, businessId);
        if (scopedBizId) {
            businessId = scopedBizId; // Use authorized target business
        }

        const finalBizId = (businessId === 'all' || !businessId || businessId === 'null') ? null : BigInt(businessId);
        const finalBatchId = (batchId === 'all' || !batchId || batchId === 'null') ? null : BigInt(batchId);
        
        const fileName = req.file ? req.file.filename : 'default.png';

        // 1. Database එකට Save කරනවා
        const newPost = await prisma.post.create({ 
            data: { 
                title, 
                caption: description, 
                image: fileName, 
                business_id: finalBizId, 
                batch_id: finalBatchId 
            }
        });

        // 2. 🔥 Firebase Cloud Messaging (Push Notification) යවන කොටස 🔥
        try {
            // Default topic එක (හැමෝටම)
            let targetTopic = 'ima_updates';

            // Batch එකක් select කරලා නම් (හිස් string ආවොත් block කරන්න '')
            if (batchId && batchId !== 'all' && batchId !== 'null' && batchId !== 'undefined' && batchId !== '') {
                targetTopic = `batch_${batchId}`; 
            } 
            // Batch එක All වෙලා, Business එකක් select කරලා නම්
            else if (businessId && businessId !== 'all' && businessId !== 'null' && businessId !== 'undefined' && businessId !== '') {
                targetTopic = `business_${businessId}`;
            }

            // Image URL එක හදාගන්නවා
            const imageUrl = fileName !== 'default.png' ? `https://imacampus.online/storage/posts/${fileName}` : null;

            const message = {
                notification: {
                    title: title,
                    body: description
                },
                data: {
                    image_url: imageUrl || '', // මේක App එක ඇතුලෙදි පාවිච්චි කරන්න
                },
                topic: targetTopic 
            };

            // 🔥 FIX: ෆෝන් එකේ උඩින් පේන Notification එකට Image එක දාන කොටස
            if (imageUrl) {
                message.notification.imageUrl = imageUrl; // General
                
                // Android වල ලොකුවට ෆොටෝ එක පේන්න
                message.android = {
                    notification: {
                        imageUrl: imageUrl
                    }
                };
                
                // iOS (Apple) වල ෆොටෝ එක පේන්න
                message.apns = {
                    payload: {
                        aps: {
                            'mutable-content': 1
                        }
                    },
                    fcm_options: {
                        image: imageUrl
                    }
                };
            }

            // 👉 දැන් ඇත්තටම ළමයින්ගේ ෆෝන් වලට Notification එක යවනවා
            await admin.messaging().send(message);
            console.log(`🚀 Push notification sent successfully to topic: ${targetTopic}`);

        } catch (fcmError) {
            console.error("Push notification send error:", fcmError);
        }

        res.status(201).json({ message: "Post Created & Notification Sent Successfully" });
    } catch (e) { 
        console.error("Post Creation Error:", e); 
        res.status(500).json({ error: "Failed to create post" }); 
    }
};

exports.getPosts = async (req, res) => {
    try {
        // ෆ්‍රන්ට්එන්ඩ් එකෙන් එවන businessId එක ගන්නවා
        const { businessId } = req.query;
        
        let whereClause = {};
        const scopedBizId = await getScopedBusinessId(req.user, businessId);
        
        if (scopedBizId) {
            whereClause = { 
                OR: [
                    { business_id: BigInt(scopedBizId) },
                    { business_id: null }
                ]
            };
        } else if (businessId && businessId !== 'all' && businessId !== 'null') {
            whereClause = {
                OR: [
                    { business_id: BigInt(businessId) }, // ඒ අදාල Business එකේ පෝස්ට්
                    { business_id: null } // 'All' කියලා දාපු පොදු පෝස්ට්
                ]
            };
        }

        const posts = await prisma.post.findMany({ 
            where: whereClause,
            orderBy: { created_at: 'desc' } 
        });
        
        const businesses = await prisma.business.findMany({ select: { id: true, name: true } });
        
        const mappedPosts = posts.map(post => {
            const biz = businesses.find(b => b.id.toString() === post.business_id?.toString());
            return {
                ...post,
                Business: biz ? { name: biz.name } : null
            };
        });

        const safeData = JSON.parse(JSON.stringify(mappedPosts, (key, value) => typeof value === 'bigint' ? value.toString() : value));
        res.status(200).json(safeData);
    } catch (e) { 
        console.error(e); 
        res.status(500).json({ error: "Failed to get posts" }); 
    }
};

exports.deletePost = async (req, res) => {
    try {
        const post = await prisma.post.findUnique({ where: { id: parseInt(req.body.post_id) } });
        if (!post) return res.status(404).json({ error: "Post not found" });

        const role = (req.user?.role || '').toUpperCase().replace(/ /g, '_');
        const isTopLevel = role === 'SYSTEM_ADMIN' || role === 'DIRECTOR';

        if (!isTopLevel && post.business_id) {
            const scopedBizId = await getScopedBusinessId(req.user, post.business_id.toString());
            if (!scopedBizId) {
                return res.status(403).json({ error: "Unauthorized to delete this post" });
            }
        }

        await prisma.post.delete({ where: { id: parseInt(req.body.post_id) } });
        res.status(200).json({ message: "Post Deleted" });
    } catch (e) { res.status(500).json({ error: "Failed to delete post" }); }
};

// ================= ZOOM DYNAMIC DOWNLOAD (JSON RESPONSE) =================
exports.getZoomDirectMp4Link = getZoomDirectMp4Link;

exports.getZoomDirectLinkJson = async (req, res) => {
    try {
        const rawId = req.params.contentId || req.params.meetingId || req.query.id || req.query.meetingId;
        if (!rawId) return res.status(400).json({ error: "Meeting ID or Content ID is required" });

        let cleanMeetingId = String(rawId).replace(/\s+/g, '');
        console.log(`[DOWNLOAD API] Processing Zoom link request for: "${cleanMeetingId}"`);

        // Check if rawId refers to a database Content ID
        if (/^\d+$/.test(cleanMeetingId) && parseInt(cleanMeetingId) < 100000000) {
            try {
                const content = await prisma.content.findUnique({ where: { id: parseInt(cleanMeetingId) } });
                if (content) {
                    if (content.meetingId && content.meetingId.trim() !== '') {
                        cleanMeetingId = content.meetingId.replace(/\s+/g, '');
                        console.log(`[DOWNLOAD API] Resolved DB Content ID ${rawId} to Meeting ID: ${cleanMeetingId}`);
                    } else if (content.link) {
                        const urlMatch = content.link.match(/(?:zoom\.us\/(?:rec\/share|rec\/play|j)\/)([a-zA-Z0-9_.-]+)/);
                        if (urlMatch && urlMatch[1]) {
                            cleanMeetingId = urlMatch[1];
                            console.log(`[DOWNLOAD API] Extracted Meeting ID from DB Content link: ${cleanMeetingId}`);
                        }
                    }
                }
            } catch (dbErr) {
                console.error("[DOWNLOAD API] DB lookup error:", dbErr.message);
            }
        } else if (cleanMeetingId.includes('zoom.us')) {
            const urlMatch = cleanMeetingId.match(/(?:zoom\.us\/(?:rec\/share|rec\/play|j)\/)([a-zA-Z0-9_.-]+)/);
            if (urlMatch && urlMatch[1]) {
                cleanMeetingId = urlMatch[1];
            }
        }
        
        const directMp4 = await getZoomDirectMp4Link(cleanMeetingId);
        
        if (directMp4) {
            return res.status(200).json({ mp4Link: directMp4 }); 
        } else {
            return res.status(404).json({ error: "Zoom recording direct MP4 not found or expired." });
        }
    } catch (error) {
        console.error("Zoom Fetch Error:", error);
        res.status(500).json({ error: "Server Error" });
    }
};

// Admin App Event Settings
exports.getAppEvent = async (req, res) => {
    try {
        const setting = await prisma.appSetting.findUnique({ where: { key: 'ACTIVE_ANIMATION' } });
        res.status(200).json({ activeEvent: setting ? setting.value : 'none' });
    } catch (error) { res.status(500).json({ error: "Failed to load event" }); }
};

exports.setAppEvent = async (req, res) => {
    try {
        const { eventId } = req.body;
        await prisma.appSetting.upsert({
            where: { key: 'ACTIVE_ANIMATION' },
            update: { value: eventId },
            create: { key: 'ACTIVE_ANIMATION', value: eventId }
        });
        res.status(200).json({ message: "App Animation Updated!" });
    } catch (error) { res.status(500).json({ error: "Failed to update event" }); }
};

exports.getMaintenanceMode = async (req, res) => {
    try {
        const setting = await prisma.appSetting.findUnique({ where: { key: 'MAINTENANCE_MODE' } });
        let valueData = { active: false };
        if (setting) {
            try { valueData = JSON.parse(setting.value); } catch(e) { valueData = { active: setting.value === 'true' }; }
        }
        res.status(200).json(valueData);
    } catch (error) { res.status(500).json({ error: "Failed to load maintenance mode" }); }
};

exports.setMaintenanceMode = async (req, res) => {
    try {
        const { active, messageEn, messageSi } = req.body;
        const valueStr = JSON.stringify({ active, messageEn, messageSi });
        await prisma.appSetting.upsert({
            where: { key: 'MAINTENANCE_MODE' },
            update: { value: valueStr },
            create: { key: 'MAINTENANCE_MODE', value: valueStr }
        });
        res.status(200).json({ message: "Maintenance Mode Updated!" });
    } catch (error) { res.status(500).json({ error: "Failed to update maintenance mode" }); }
};