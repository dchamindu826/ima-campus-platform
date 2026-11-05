const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const admin = require("firebase-admin"); 

const resolveTutesForDeliveryItem = (item, d, courses, allGroups = []) => {
    const course = courses.find(c => c.id === item.courseId);
    let lecturerName = course?.lecturerName || 'Lecturer';
    let lecturerImage = 'default.png';
    let tuteCover = item.tuteImage || null;
    let actualTuteName = item.tuteName; 
    let tutesList = [];

    const isMonthly = d.paymentType === 'Monthly';
    const isFull = d.paymentType === 'Full' || d.paymentType === 'Installment';

    if (course && course.groupPrices) {
        try {
            const gpArr = JSON.parse(course.groupPrices);
            let matchedGp;
            
            if (isFull) {
                const fullGrp = allGroups.find(g => g.batchId === d.payment?.batchId && (g.name.toLowerCase().includes('full') || g.type === 2));
                if (fullGrp) matchedGp = gpArr.find(g => parseInt(g.groupId) === parseInt(fullGrp.id));
                if (!matchedGp) matchedGp = gpArr.find(g => {
                    const grp = allGroups.find(ag => ag.id === parseInt(g.groupId));
                    return grp && (grp.type === 2 || grp.name.toLowerCase().includes('full'));
                });
            } else if (isMonthly && d.payment?.groupId) {
                matchedGp = gpArr.find(g => parseInt(g.groupId) === parseInt(d.payment.groupId));
            }

            if (!matchedGp && item.tuteName) {
                matchedGp = gpArr.find(g => g.tuteName === item.tuteName || (g.tutes && g.tutes.some(t => t.name === item.tuteName)));
            }

            // Only fallback to gpArr[0] if isFull, NEVER for monthly!
            if (!matchedGp && isFull && gpArr.length > 0) {
                matchedGp = gpArr[0];
            }

            if (matchedGp) {
                if (matchedGp.lecturerImage) lecturerImage = matchedGp.lecturerImage;
                else {
                    const fallbackLec = gpArr.find(g => g.lecturerImage)?.lecturerImage;
                    if (fallbackLec) lecturerImage = fallbackLec;
                }

                if (matchedGp.tutes && Array.isArray(matchedGp.tutes) && matchedGp.tutes.length > 0) {
                    tutesList = matchedGp.tutes;
                } else {
                    if (matchedGp.tuteCover) tuteCover = matchedGp.tuteCover;
                    else if (isFull) {
                        const fallbackCover = gpArr.find(g => g.tuteCover)?.tuteCover;
                        if (fallbackCover) tuteCover = fallbackCover;
                    }
                    if (matchedGp.tuteName) actualTuteName = matchedGp.tuteName;
                    tutesList = [{ name: actualTuteName || item.tuteName, cover: tuteCover || item.tuteImage || 'default-tute.png' }];
                }
            }
        } catch (e) {}
    }

    if (tutesList.length === 0) {
        tutesList = [{ name: actualTuteName || item.tuteName || 'Unknown', cover: tuteCover || item.tuteImage || 'default-tute.png' }];
    }

    return tutesList.map(tute => ({
        ...item,
        tuteName: tute.name,
        courseName: course?.name || 'Subject',
        lecturerName,
        lecturerImage,
        tuteCover: tute.cover || item.tuteImage || 'default-tute.png',
        tuteImage: tute.cover || item.tuteImage || 'default-tute.png'
    }));
};

// ================= DELIVERY POS ACTIONS =================

// 1. Pending & Hold Deliveries ගන්න (Monthly/Full වලට හරියටම Covers & Names එන්න හැදුවා)
exports.getPendingDeliveries = async (req, res) => {
    try {
        const { businessId, paymentType } = req.query;
        
        let whereClause = { 
            status: { in: ['Pending', 'Hold'] },
            payment: { status: 1 }
        };
        if (businessId) whereClause.businessId = parseInt(businessId);
        if (paymentType && paymentType !== 'All') whereClause.paymentType = paymentType;

        const deliveries = await prisma.delivery.findMany({
            where: whereClause,
            include: {
                items: {
                    select: { id: true, courseId: true, tuteName: true, tuteImage: true, quantity: true }
                },
                payment: {
                    select: {
                        id: true,
                        status: true,
                        batchId: true,
                        groupId: true,
                        remark: true,
                        student: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                addressHouseNo: true,
                                addressStreet: true,
                                city: true,
                                district: true,
                                phone: true,
                                whatsapp: true,
                                optionalPhone: true
                            }
                        },
                        batch: { select: { id: true, name: true } },
                        group: { select: { id: true, name: true } }
                    }
                }
            },
            orderBy: [
                { createdAt: 'asc' },
                { id: 'asc' }
            ]
        });

        const courseIds = [...new Set(deliveries.flatMap(d => d.items.map(i => i.courseId)).filter(Boolean))];
        const courses = courseIds.length > 0 ? await prisma.course.findMany({
            where: { id: { in: courseIds.map(id => parseInt(id)) } },
            select: { id: true, name: true, lecturerName: true, groupPrices: true }
        }) : [];

        const batchIds = [...new Set(deliveries.map(d => d.payment?.batchId).filter(Boolean))];
        const allGroups = batchIds.length > 0 ? await prisma.group.findMany({
            where: { batchId: { in: batchIds } },
            select: { id: true, batchId: true, name: true }
        }) : [];

        const studentIds = [...new Set(deliveries.map(d => d.payment?.student?.id).filter(Boolean))];
        const pastDeliveries = studentIds.length > 0 ? await prisma.delivery.findMany({
            where: {
                studentId: { in: studentIds.map(String) },
                status: { notIn: ['Pending', 'Hold'] }
            },
            distinct: ['studentId'],
            orderBy: [{ studentId: 'asc' }, { packedAt: 'desc' }],
            select: {
                studentId: true,
                packedAt: true,
                trackingNumber: true,
                paymentType: true,
                packRemark: true,
                payment: {
                    select: {
                        group: { select: { name: true } }
                    }
                }
            }
        }) : [];

        // Fetch all previously delivered/packed items for these students to detect duplicates
        const pastDeliveredItems = studentIds.length > 0 ? await prisma.deliveryItem.findMany({
            where: {
                delivery: {
                    studentId: { in: studentIds.map(String) },
                    id: { notIn: deliveries.map(d => d.id) },
                    status: { in: ['Packed', 'On the way', 'Delivered', 'Resolved', 'Received'] }
                }
            },
            include: {
                delivery: {
                    select: {
                        id: true,
                        studentId: true,
                        status: true,
                        packedAt: true,
                        createdAt: true,
                        payment: {
                            select: {
                                groupId: true,
                                group: { select: { name: true } }
                            }
                        }
                    }
                }
            }
        }) : [];

        // Build quick lookup map for past deliveries by studentId
        const pastDelMap = new Map();
        pastDeliveries.forEach(pd => {
            if (pd.studentId && !pastDelMap.has(pd.studentId)) {
                pastDelMap.set(pd.studentId, pd);
            }
        });

        const formatted = deliveries.map(d => {
            const std = d.payment?.student || {};
            const addressParts = [std.addressHouseNo, std.addressStreet, std.city, std.district].filter(Boolean);
            const finalAddress = addressParts.length > 0 ? addressParts.join(', ') : 'No Address Provided';
            const labelAddressParts = [std.addressHouseNo, std.addressStreet, std.city].filter(Boolean);
            const finalLabelAddress = labelAddressParts.length > 0 ? labelAddressParts.join(', ') : 'No Address Provided';
            
            // 🔥 FIX: Multiple Phones
            const phoneParts = [std.phone, std.whatsapp, std.optionalPhone].filter(Boolean);
            const finalPhone = [...new Set(phoneParts)].join(' / ') || 'No Phone';
            
            const finalName = std.firstName ? `${std.firstName} ${std.lastName}` : 'Unknown Student';

            const isUpgrade = d.payment?.remark ? d.payment.remark.includes('[UPGRADE]') : false;

            const rawItemsWithDetails = d.items.flatMap(item => resolveTutesForDeliveryItem(item, d, courses, allGroups));
            const seenTuteKeys = new Set();
            const itemsWithDetails = [];
            for (const item of rawItemsWithDetails) {
                const normName = (item.tuteName || '').toLowerCase().replace(/[^a-z0-9\u0D80-\u0DFF]/g, '');
                const dedupeKey = normName || String(item.courseId || '');
                if (!seenTuteKeys.has(dedupeKey)) {
                    seenTuteKeys.add(dedupeKey);
                    itemsWithDetails.push(item);
                }
            }

            // 🔥 Check for duplicate tutes already delivered to this student previously
            let hasDuplicate = false;
            const duplicateWarnings = [];
            const enrichedItems = itemsWithDetails.map(item => {
                const normName = (item.tuteName || '').toLowerCase().replace(/[^a-z0-9\u0D80-\u0DFF]/g, '');
                const priorDup = pastDeliveredItems.find(p => 
                    p.delivery.studentId === String(std.id) &&
                    (p.tuteName || '').toLowerCase().replace(/[^a-z0-9\u0D80-\u0DFF]/g, '') === normName
                );
                if (priorDup) {
                    hasDuplicate = true;
                    const dateStr = priorDup.delivery.packedAt 
                        ? new Date(priorDup.delivery.packedAt).toLocaleDateString('en-GB')
                        : new Date(priorDup.delivery.createdAt).toLocaleDateString('en-GB');
                    const warningInfo = {
                        orderId: priorDup.delivery.id,
                        status: priorDup.delivery.status,
                        date: dateStr,
                        groupName: priorDup.delivery.payment?.group?.name || 'Previous Order',
                        tuteName: item.tuteName
                    };
                    duplicateWarnings.push(warningInfo);
                    return {
                        ...item,
                        isDuplicate: true,
                        duplicateDetails: warningInfo
                    };
                }
                return {
                    ...item,
                    isDuplicate: false
                };
            });

            const lastDel = std.id ? pastDelMap.get(String(std.id)) : null;
            let lastDeliveryInfo = null;
            if (lastDel) {
                lastDeliveryInfo = {
                    packedAt: lastDel.packedAt,
                    trackingNumber: lastDel.trackingNumber,
                    paymentMonth: lastDel.payment?.group?.name || 'No Group',
                    paymentType: lastDel.paymentType,
                    packRemark: lastDel.packRemark
                };
            }

            return {
                ...d,
                studentName: d.labelName || finalName,
                studentNo: std.id ? `STU-${std.id}` : 'STU-000',
                address: finalAddress,
                labelAddress: d.labelAddress || finalLabelAddress,
                originalAddress: {
                    houseNo: std.addressHouseNo || '',
                    street: std.addressStreet || '',
                    city: std.city || '',
                    district: std.district || ''
                },
                phone: d.labelPhone || finalPhone, 
                batchName: d.payment?.batch?.name || 'Batch Not Assigned', 
                groupName: d.payment?.group?.name || 'No Group',
                isUpgrade: isUpgrade,
                items: enrichedItems,
                hasDuplicate,
                duplicateWarnings,
                lastDelivery: lastDeliveryInfo
            };
        });

        return res.status(200).json(formatted);
    } catch (error) {
        console.error("Fetch Pending Deliveries Error:", error);
        if (!res.headersSent) return res.status(500).json({ error: "Failed to fetch pending deliveries" });
    }
};

// 2. Auto Stock Deduction AT PACKING
exports.packDelivery = async (req, res) => {
    try {
        const { deliveryId, trackingNumber, packRemark } = req.body;

        await prisma.$transaction(async (tx) => {
            const updatedDelivery = await tx.delivery.update({
                where: { id: parseInt(deliveryId) },
                data: { 
                    status: 'Packed', 
                    trackingNumber: trackingNumber,
                    packRemark: packRemark,
                    packedAt: new Date()
                },
                include: { items: true, payment: true }
            });

            const courseIds = updatedDelivery.items.map(i => i.courseId).filter(Boolean);
            const courses = await tx.course.findMany({ where: { id: { in: courseIds } } });
            const allGroups = await tx.group.findMany({ where: { batchId: updatedDelivery.payment?.batchId } });
            
            const expandedItems = updatedDelivery.items.flatMap(item => resolveTutesForDeliveryItem(item, updatedDelivery, courses, allGroups));

            for (const item of expandedItems) {
                const actualTuteName = item.tuteName;
                const gpCover = item.tuteCover;

                let stockItem = await tx.tuteStock.findFirst({
                    where: { courseId: parseInt(item.courseId), tuteName: actualTuteName }
                });

                if (!stockItem && actualTuteName) {
                    // If completely missing, auto-create it with 0 balance
                    stockItem = await tx.tuteStock.create({
                        data: {
                            courseId: parseInt(item.courseId),
                            tuteName: actualTuteName,
                            tuteImage: gpCover,
                            availableQuantity: 0
                        }
                    });
                }

                if (stockItem) {
                    const newQty = stockItem.availableQuantity - parseInt(item.quantity || 1);
                    
                    await tx.tuteStock.update({
                        where: { id: stockItem.id },
                        data: { availableQuantity: newQty }
                    });

                    await tx.tuteStockHistory.create({
                        data: {
                            stockId: stockItem.id, 
                            courseId: stockItem.courseId, 
                            tuteName: stockItem.tuteName,
                            action: "REDUCED", 
                            oldQuantity: stockItem.availableQuantity, 
                            newQuantity: newQty, 
                            reason: `Order ORD-${updatedDelivery.id} Packed`
                        }
                    });
                } else {
                    console.log(`⚠️ Stock Item Not Found & Could Not Auto-Create for CourseID: ${item.courseId}, Tute: ${actualTuteName}`);
                }
            }
        });

        res.status(200).json({ message: "Packed and Stock Deducted Successfully!" });
    } catch (error) {
        console.error("Pack Delivery Error:", error);
        res.status(500).json({ error: "Failed to pack delivery" });
    }
};

// 3. Order එක Hold කරන එක
exports.holdDelivery = async (req, res) => {
    try {
        const { deliveryId, reason, remark } = req.body;
        
        const heldOrder = await prisma.delivery.update({
            where: { id: parseInt(deliveryId) },
            data: { status: 'Hold', holdReason: reason, holdRemark: remark }
        });
        
        res.status(200).json({ message: "Delivery placed on Hold", data: heldOrder });
    } catch (error) {
        res.status(500).json({ error: "Failed to hold delivery" });
    }
};

// ================= TUTE STOCK MANAGEMENT =================

exports.getTuteStocks = async (req, res) => {
    try {
        const stocks = await prisma.tuteStock.findMany({ include: { course: true } });
        res.status(200).json(stocks);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch stock" });
    }
};


exports.addTuteStock = async (req, res) => {
    try {
        const { stockId, quantity, reason } = req.body;
        const oldStock = await prisma.tuteStock.findUnique({ where: { id: parseInt(stockId) } });
        
        const updated = await prisma.tuteStock.update({
            where: { id: parseInt(stockId) },
            data: { availableQuantity: { increment: parseInt(quantity) } }
        });

        await prisma.tuteStockHistory.create({
            data: {
                stockId: updated.id, courseId: updated.courseId, tuteName: updated.tuteName,
                action: "ADDED", oldQuantity: oldStock.availableQuantity, newQuantity: updated.availableQuantity,
                reason: reason || "New stock added"
            }
        });
        res.status(200).json(updated);
    } catch (error) {
        res.status(500).json({ error: "Failed to update stock" });
    }
};

exports.addCustomTute = async (req, res) => {
    try {
        const { courseId, tuteName } = req.body;
        const tuteCover = req.file ? req.file.filename : null;

        if (!courseId || courseId === "null" || courseId === "") {
            return res.status(400).json({ error: "Please select a Subject to link this Extra Tute." });
        }

        const newStock = await prisma.tuteStock.create({
            data: {
                courseId: parseInt(courseId),
                tuteName: tuteName,
                tuteImage: tuteCover,
                availableQuantity: 0
            }
        });
        res.status(201).json(newStock);
    } catch (error) {
        res.status(500).json({ error: "Failed to create custom tute" });
    }
};

exports.editTuteStock = async (req, res) => {
    try {
        const { stockId, newQuantity, reason, originalIds } = req.body;
        const targetId = parseInt(stockId);
        const parsedNewQty = parseInt(newQuantity);
        
        const oldStock = await prisma.tuteStock.findUnique({ where: { id: targetId } });
        
        // If originalIds is provided from frontend grouping, zero out the duplicates
        if (originalIds && Array.isArray(originalIds) && originalIds.length > 1) {
            const allIds = originalIds.map(id => parseInt(id));
            const otherIds = allIds.filter(id => id !== targetId);
            
            if (otherIds.length > 0) {
                await prisma.tuteStock.updateMany({
                    where: { id: { in: otherIds } },
                    data: { availableQuantity: 0 }
                });
            }
        }
        
        const updated = await prisma.tuteStock.update({
            where: { id: targetId },
            data: { availableQuantity: parsedNewQty }
        });
        
        await prisma.tuteStockHistory.create({
            data: {
                stockId: updated.id, courseId: updated.courseId, tuteName: updated.tuteName,
                action: oldStock.availableQuantity > parsedNewQty ? "REDUCED" : "EDITED",
                oldQuantity: oldStock.availableQuantity, newQuantity: updated.availableQuantity, reason: reason
            }
        });
        res.status(200).json({ message: "Stock adjusted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to edit stock" });
    }
};

exports.deleteTuteStock = async (req, res) => {
    try {
        const stockId = parseInt(req.params.id);
        const { reason } = req.query;
        const oldStock = await prisma.tuteStock.findUnique({ where: { id: stockId } });
        await prisma.tuteStockHistory.create({
            data: {
                stockId: oldStock.id, courseId: oldStock.courseId, tuteName: oldStock.tuteName,
                action: "DELETED", oldQuantity: oldStock.availableQuantity, newQuantity: 0, reason: reason || "Item removed"
            }
        });
        await prisma.tuteStock.delete({ where: { id: stockId } });
        res.status(200).json({ message: "Stock item deleted" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete stock" });
    }
};

exports.clearAllTuteStock = async (req, res) => {
    try {
        await prisma.tuteStock.deleteMany({});
        await prisma.tuteStockHistory.deleteMany({});
        res.status(200).json({ message: "All TuteStock records cleared successfully" });
    } catch (error) {
        console.error("Failed to clear tute stock:", error);
        res.status(500).json({ error: "Failed to clear tute stock" });
    }
};

exports.getStockHistory = async (req, res) => {
    try {
        const { startDate, endDate, page = 1, limit = 10 } = req.query;
        const courseIds = req.params.courseIds ? req.params.courseIds.split(',').map(id => parseInt(id)) : [];

        let whereClause = { courseId: { in: courseIds } };

        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            whereClause.createdAt = { gte: start, lte: end };
        }

        const total = await prisma.tuteStockHistory.count({ where: whereClause });
        const history = await prisma.tuteStockHistory.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            skip: (parseInt(page) - 1) * parseInt(limit),
            take: parseInt(limit)
        });

        const safeJson = (data) => JSON.parse(JSON.stringify(data, (k, v) => typeof v === 'bigint' ? v.toString() : v));
        res.status(200).json({
            data: safeJson(history),
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error("History Error:", error);
        res.status(500).json({ error: "Failed to fetch history" });
    }
};

exports.getStockAnalytics = async (req, res) => {
    try {
        const { startDate, endDate, businessId, batchName } = req.query;

        // Base where clause for Course to filter by Business/Batch
        let courseWhere = {};
        
        if (businessId && businessId !== 'All') {
            courseWhere.group = {
                batch: {
                    businessId: parseInt(businessId)
                }
            };
        }
        
        if (batchName && batchName !== 'All') {
            if (!courseWhere.group) courseWhere.group = { batch: {} };
            courseWhere.group.batch.name = batchName;
        }

        const stocks = await prisma.tuteStock.findMany({
            where: { course: courseWhere },
            include: {
                course: {
                    include: { group: { include: { batch: { include: { business: true } } } } }
                }
            }
        });

        // Date range filters
        let dateFilter = {};
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateFilter = { gte: start, lte: end };
        }

        // Fetch deliveries in range for "Stock Issued/Auto Packed"
        const deliveries = await prisma.delivery.findMany({
            where: {
                status: { notIn: ['Pending', 'Hold'] },
                ...(dateFilter.gte ? { packedAt: dateFilter } : {})
            },
            include: { items: true, payment: true }
        });

        const courseIds = [...new Set(deliveries.flatMap(d => d.items.map(i => i.courseId)).filter(Boolean))];
        const courses = await prisma.course.findMany({ where: { id: { in: courseIds } } });
        const batchIds = [...new Set(deliveries.map(d => d.payment?.batchId).filter(Boolean))];
        const allGroups = await prisma.group.findMany({ where: { batchId: { in: batchIds } } });

        deliveries.forEach(d => {
            d.expandedItems = d.items.flatMap(item => resolveTutesForDeliveryItem(item, d, courses, allGroups));
        });

        // Fetch stock history in range for "Tutes Added"
        const history = await prisma.tuteStockHistory.findMany({
            where: {
                ...(dateFilter.gte ? { createdAt: dateFilter } : {})
            }
        });

        const analytics = stocks.map(stock => {
            // Find additions for this stock
            const stockHistory = history.filter(h => h.stockId === stock.id && (h.action === 'ADDED' || h.action === 'EDITED' || h.action === 'REDUCED'));
            let addedCount = 0;
            let editedCount = 0;
            stockHistory.forEach(h => {
                if (h.action === 'ADDED') addedCount += (h.newQuantity - h.oldQuantity);
                if (h.action === 'EDITED' && h.newQuantity > h.oldQuantity) editedCount += (h.newQuantity - h.oldQuantity);
                if (h.action === 'REDUCED' && h.oldQuantity > h.newQuantity) editedCount -= (h.oldQuantity - h.newQuantity);
            });

            // Find issues for this stock (DeliveryItems matching courseId and tuteName)
            let issuedCount = 0;
            let autoPackedCount = 0; // if packed automatically or no packRemark
            deliveries.forEach(d => {
                const items = d.expandedItems.filter(i => i.courseId === stock.courseId && i.tuteName === stock.tuteName);
                items.forEach(item => {
                    issuedCount += (item.quantity || 1);
                    if (!d.packRemark) autoPackedCount += (item.quantity || 1); // Heuristic for auto-packed
                });
            });

            const bizName = stock.course?.group?.batch?.business?.name || 'Unknown Business';
            const bName = stock.course?.group?.batch?.name || 'Unknown Batch';
            const payGrp = stock.course?.group?.type === 1 ? 'MONTHLY' : (stock.course?.group?.type === 2 ? 'FULL' : 'UNKNOWN');

            return {
                id: stock.id,
                businessBatch: `${bizName} - ${bName}`,
                subjectPaymentGrp: `${stock.course?.name || 'Unknown'} - ${payGrp}`,
                materialName: stock.tuteName,
                tutesAdded: addedCount,
                tutesEdited: editedCount,
                totalDelivered: issuedCount,
                autoPacked: autoPackedCount,
                remainingStock: stock.availableQuantity
            };
        });

        res.status(200).json(analytics);
    } catch (error) {
        console.error("Analytics Error:", error);
        res.status(500).json({ error: "Failed to fetch analytics" });
    }
};

exports.getGlobalStock = async (req, res) => {
    try {
        // --- AUTO-SYNC LOGIC DISABLED ---
        // We no longer sync from Course.groupPrices since tutes are managed directly in Delivery.
        // --------------------------------

        const stocks = await prisma.tuteStock.findMany({
            include: { course: { include: { group: { include: { batch: { include: { business: true } } } } } } },
            orderBy: { availableQuantity: 'asc' }
        });
        const masterData = await getMasterTutesData();
        const safeJson = (data) => JSON.parse(JSON.stringify(data, (k, v) => typeof v === 'bigint' ? v.toString() : v));
        res.status(200).json({ stocks: safeJson(stocks), masterData: safeJson(masterData) });
    } catch (error) { res.status(500).json({ error: "Failed to fetch global stock" }); }
};

exports.getGlobalStockHistory = async (req, res) => {
    try {
        const { startDate, endDate, page = 1, limit = 10 } = req.query;
        let whereClause = {};

        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            whereClause.createdAt = { gte: start, lte: end };
        }

        const total = await prisma.tuteStockHistory.count({ where: whereClause });
        const history = await prisma.tuteStockHistory.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            skip: (parseInt(page) - 1) * parseInt(limit),
            take: parseInt(limit)
        });

        const safeJson = (data) => JSON.parse(JSON.stringify(data, (k, v) => typeof v === 'bigint' ? v.toString() : v));
        res.status(200).json({
            data: safeJson(history),
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) { res.status(500).json({ error: "Failed to fetch global history" }); }
};

exports.getBatchStock = async (req, res) => {
    try {
        const batchId = parseInt(req.params.batchId);
        
        const groups = await prisma.group.findMany({
            where: { batchId },
            include: { courses: true }
        });

        let allCourseIds = [];
        let requiredTutes = [];

        groups.forEach(g => {
            g.courses.forEach(c => {
                allCourseIds.push(c.id);

                let gpPrices = [];
                try { gpPrices = typeof c.groupPrices === 'string' ? JSON.parse(c.groupPrices) : (c.groupPrices || []); } catch(e){}

                const gpData = gpPrices.find(p => parseInt(p.groupId) === g.id);

                let tName = c.name + " - Tute";
                let tCover = 'default-tute.png';

                if (gpData) {
                    if (gpData.tuteName && gpData.tuteName.trim() !== '') tName = gpData.tuteName;
                    if (gpData.tuteCover) tCover = gpData.tuteCover;
                }

                requiredTutes.push({
                    courseId: c.id,
                    tuteName: tName,
                    tuteImage: tCover
                });
            });
        });

        if (requiredTutes.length > 0) {
            for (const rt of requiredTutes) {
                const exists = await prisma.tuteStock.findFirst({
                    where: { courseId: rt.courseId, tuteName: rt.tuteName }
                });

                if (!exists) {
                    await prisma.tuteStock.create({
                        data: {
                            courseId: rt.courseId,
                            tuteName: rt.tuteName,
                            tuteImage: rt.tuteImage,
                            availableQuantity: 0
                        }
                    });
                }
            }
        }

        if (allCourseIds.length === 0) {
            return res.status(200).json([]);
        }

        const allStocks = await prisma.tuteStock.findMany({
            where: { courseId: { in: allCourseIds.map(id => Number(id)) } },
            include: { 
                course: { 
                    include: { group: true }
                } 
            },
            orderBy: { updatedAt: 'desc' }
        });

        const safeJson = (data) => JSON.parse(JSON.stringify(data, (k, v) => typeof v === 'bigint' ? v.toString() : v));
        res.status(200).json(safeJson(allStocks));

    } catch (error) {
        console.error("Get Batch Stock Error:", error);
        res.status(500).json({ error: "Failed to fetch batch stock." });
    }
};

// ================= DISPATCH / HISTORY & CRON JOBS =================

const cron = require('node-cron');

cron.schedule('0 * * * *', async () => {
    try {
        const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000);

        await prisma.delivery.updateMany({
            where: { 
                status: 'Packed',
                packedAt: { lte: tenHoursAgo } 
            },
            data: { 
                status: 'On the way',
                onTheWayAt: new Date()
            }
        });
        console.log("🚚 Auto Delivery Status Updated (Packed -> On the way)");
    } catch (error) {
        console.error("Cron Job Error:", error);
    }
});

cron.schedule('0 8 * * *', async () => {
    try {
        const dispatchedOrders = await prisma.delivery.findMany({
            where: { status: 'On the way' },
            include: { payment: { include: { student: true } } }
        });

        for (const order of dispatchedOrders) {
            const student = order.payment?.student;
            
            if (student && student.fcmToken) {
                const message = {
                    notification: {
                        title: "📦 Delivery Update!",
                        body: "ඔබගේ Tute pack එක මේ වනවිට Dispatch කර ඇත. කරුණාකර App එකට ගොස් Received හෝ Not Received යන්න Update කරන්න."
                    },
                    token: student.fcmToken
                };
                
                try {
                    await admin.messaging().send(message);
                } catch (e) {
                    console.log(`Failed to send FCM to student ${student.id}`);
                }
            }
        }
        console.log("🚚 Daily Dispatch Notifications Sent to Students!");
    } catch (error) {
        console.error("Cron Job Error (Dispatch Notifications):", error);
    }
});

exports.getDispatchDeliveries = async (req, res) => {
    try {
        const { businessId } = req.query;
        
        let whereClause = {
            status: { notIn: ['Pending', 'Hold'] } 
        };
        
        if (businessId) whereClause.businessId = parseInt(businessId);

        const deliveries = await prisma.delivery.findMany({
            where: whereClause,
            include: {
                items: true,
                payment: { 
                    include: { student: true, batch: true, group: true } 
                }
            },
            orderBy: [{ packedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
        });

        const courseIds = [...new Set(deliveries.flatMap(d => d.items.map(i => i.courseId)).filter(Boolean))];
        const courses = await prisma.course.findMany({
            where: { id: { in: courseIds.map(id => parseInt(id)) } }
        });
        const batchIds = [...new Set(deliveries.map(d => d.payment?.batchId).filter(Boolean))];
        const allGroups = await prisma.group.findMany({
            where: { batchId: { in: batchIds } },
            select: { id: true, name: true, batchId: true }
        });

        const formatted = deliveries.map(d => {
            const std = d.payment?.student || {};
            const addressParts = [std.addressHouseNo, std.addressStreet, std.city, std.district].filter(Boolean);
            const labelAddressParts = [std.addressHouseNo, std.addressStreet, std.city].filter(Boolean);
            
            // 🔥 FIX: ළමයාගේ තියෙන ඔක්කොම වෙනස් Phone Numbers එකතු කරලා Sticker එකට යවනවා
            const phoneParts = [std.phone, std.whatsapp, std.optionalPhone].filter(Boolean);
            const finalPhone = [...new Set(phoneParts)].join(' / ') || 'No Phone';

            return {
                ...d,
                studentName: d.labelName || (std.firstName ? `${std.firstName} ${std.lastName}` : 'Unknown Student'),
                address: addressParts.length > 0 ? addressParts.join(', ') : 'No Address Provided',
                labelAddress: d.labelAddress || (labelAddressParts.length > 0 ? labelAddressParts.join(', ') : 'No Address Provided'),
                phone: d.labelPhone || finalPhone, // 🔥 Updated Multiple Phones
                batchName: d.payment?.batch?.name || 'Batch Not Assigned',
                groupName: d.payment?.group?.name || 'No Group',
                items: d.items.flatMap(item => resolveTutesForDeliveryItem(item, d, courses, allGroups))
            };
        });

        return res.status(200).json(formatted);
    } catch (error) {
        console.error("Fetch Dispatch Error:", error);
        res.status(500).json({ error: "Failed to fetch dispatch deliveries" });
    }
};

exports.getAdvancedHistory = async (req, res) => {
    try {
        const { page = 1, limit = 15, search, businessId, batchId, paymentType, status, startDate, endDate, studentId } = req.query;
        
        let whereClause = {};

        if (status) {
            if (status === 'Dispatched') whereClause.status = { in: ['Packed', 'On the way', 'Not Received'] };
            else if (status === 'Delivered') whereClause.status = 'Received';
            else whereClause.status = status; 
        } else {
            whereClause.status = { notIn: ['Pending', 'Hold'] }; 
        }

        if (businessId) whereClause.businessId = parseInt(businessId);
        if (paymentType) whereClause.paymentType = paymentType;
        if (studentId) whereClause.studentId = String(studentId);
        
        if (startDate && endDate) {
            const start = new Date(startDate); start.setHours(0, 0, 0, 0);
            const end = new Date(endDate); end.setHours(23, 59, 59, 999);
            whereClause.OR = [
                { packedAt: { gte: start, lte: end } },
                { createdAt: { gte: start, lte: end } }
            ];
        }

        if (search) {
            const searchNum = parseInt(search.replace(/\D/g, ''));
            const orConditions = [
                { trackingNumber: { contains: search } },
                { payment: { student: { firstName: { contains: search } } } },
                { payment: { student: { phone: { contains: search } } } }
            ];
            if (!isNaN(searchNum)) {
                orConditions.push({ id: searchNum });
            }
            whereClause.OR = orConditions;
        }

        if (batchId) {
            whereClause.payment = { ...whereClause.payment, batchId: parseInt(batchId) };
        }

        const businesses = await prisma.business.findMany({ select: { id: true, name: true } });
        const total = await prisma.delivery.count({ where: whereClause });
        
        const deliveries = await prisma.delivery.findMany({
            where: whereClause,
            include: {
                items: true, 
                payment: { include: { student: true, batch: true, group: true } }
            },
            orderBy: [{ packedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
            skip: (parseInt(page) - 1) * parseInt(limit),
            take: parseInt(limit)
        });

        const courses = await prisma.course.findMany();
        
        const batchIds = [...new Set(deliveries.map(d => d.payment?.batchId).filter(Boolean))];
        const allGroups = await prisma.group.findMany({
            where: { batchId: { in: batchIds } }
        });

        const formatted = deliveries.map(d => {
            const bizName = businesses.find(b => b.id === d.businessId)?.name || 'Unknown';
            const std = d.payment?.student || {};
            const addressParts = [std.addressHouseNo, std.addressStreet, std.city, std.district].filter(Boolean);
            const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : 'No Address Provided';
            const labelAddressParts = [std.addressHouseNo, std.addressStreet, std.city].filter(Boolean);
            const fullLabelAddress = labelAddressParts.length > 0 ? labelAddressParts.join(', ') : 'No Address Provided';

            // 🔥 FIX: ළමයාගේ තියෙන ඔක්කොම වෙනස් Phone Numbers එකතු කරලා Sticker එකට යවනවා
            const phoneParts = [std.phone, std.whatsapp, std.optionalPhone].filter(Boolean);
            const finalPhone = [...new Set(phoneParts)].join(' / ') || 'No Phone';

            // 🔥 FIX: Resolve actual tute name dynamically like in getPendingDeliveries
            const itemsWithDetails = d.items.flatMap(item => resolveTutesForDeliveryItem(item, d, courses, allGroups));

            return {
                id: d.id,
                studentName: d.labelName || (std.firstName ? `${std.firstName} ${std.lastName}` : 'Unknown'),
                phone: d.labelPhone || finalPhone, // 🔥 Updated Multiple Phones
                address: fullAddress, 
                labelAddress: d.labelAddress || fullLabelAddress,
                businessName: bizName,
                batchName: d.payment?.batch?.name || 'No Batch',
                paymentType: d.paymentType,
                status: d.status,
                trackingNumber: d.trackingNumber,
                packedAt: d.packedAt,
                packRemark: d.packRemark,
                items: itemsWithDetails
            };
        });

        const safeJson = (data) => JSON.parse(JSON.stringify(data, (k, v) => typeof v === 'bigint' ? v.toString() : v));

        res.status(200).json(safeJson({
            data: formatted,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        }));

    } catch (error) {
        console.error("Advanced History fetch error:", error);
        res.status(500).json({ error: "Failed to fetch history" });
    }
};

exports.manualConfirmDelivery = async (req, res) => {
    try {
        const { deliveryId } = req.params;
        const updatedDelivery = await prisma.delivery.update({
            where: { id: parseInt(deliveryId) },
            data: { 
                status: 'Received', 
                resolvedAt: new Date()
            }
        });
        res.status(200).json({ message: `Delivery marked as Delivered`, data: updatedDelivery });
    } catch (error) {
        res.status(500).json({ error: "Failed to manually update delivery." });
    }
};

// ================= DASHBOARD STATS & REPORTS =================

exports.getDeliveryStats = async (req, res) => {
    try {
        // Helper: Convert UTC timestamp to Sri Lanka YYYY-MM-DD Date Key (UTC+5:30)
        const getSLDateKey = (dateInput) => {
            if (!dateInput) return null;
            const d = new Date(dateInput);
            if (isNaN(d.getTime())) return null;
            const slDate = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
            return slDate.toISOString().split('T')[0];
        };

        const now = new Date();
        const slTodayKey = getSLDateKey(now);
        const slStartOfToday = new Date(`${slTodayKey}T00:00:00.000+05:30`);

        const slSevenDaysAgoDate = new Date(slStartOfToday.getTime() - (6 * 24 * 60 * 60 * 1000));

        const pending = await prisma.delivery.count({ where: { status: 'Pending' } });
        const onHold = await prisma.delivery.count({ where: { status: 'Hold' } });
        const dispatched = await prisma.delivery.count({ where: { status: 'On the way' } });
        const returned = await prisma.delivery.count({ where: { status: 'Returned' } }); 
        const totalDelivered = await prisma.delivery.count({ where: { status: 'Received' } });
        
        const deliveredToday = await prisma.delivery.count({ 
            where: { 
                status: 'Received', 
                OR: [
                    { resolvedAt: { gte: slStartOfToday } },
                    { updatedAt: { gte: slStartOfToday } }
                ]
            } 
        });
        const lowStock = await prisma.tuteStock.count({
            where: { availableQuantity: { lte: 10 } }
        });

        const statusDistribution = [
            { name: 'Pending', value: pending, color: '#3b82f6' }, 
            { name: 'Dispatched', value: dispatched, color: '#8b5cf6' }, 
            { name: 'Delivered', value: totalDelivered, color: '#10b981' }, 
            { name: 'Hold', value: onHold, color: '#f97316' }, 
        ].filter(s => s.value > 0);

        const recentDeliveries = await prisma.delivery.findMany({
            where: { 
                OR: [
                    { packedAt: { gte: slSevenDaysAgoDate } },
                    { resolvedAt: { gte: slSevenDaysAgoDate } },
                    { updatedAt: { gte: slSevenDaysAgoDate } },
                    { createdAt: { gte: slSevenDaysAgoDate } }
                ]
            },
            select: { status: true, packedAt: true, resolvedAt: true, updatedAt: true, createdAt: true }
        });

        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const weeklyTrendArray = [];

        for (let i = 6; i >= 0; i--) {
            const dayTime = slStartOfToday.getTime() - (i * 24 * 60 * 60 * 1000);
            const dayDateObj = new Date(dayTime);
            const dayKey = getSLDateKey(dayDateObj);
            const dayLabel = daysOfWeek[new Date(dayTime + (5.5 * 3600 * 1000)).getUTCDay()];

            let packedCount = 0;
            let deliveredCount = 0;

            recentDeliveries.forEach(del => {
                const packedDateKey = getSLDateKey(del.packedAt || del.createdAt);
                if (packedDateKey === dayKey && (del.status === 'Packed' || del.status === 'On the way' || del.status === 'Received')) {
                    packedCount += 1;
                }

                const deliveredDateKey = getSLDateKey(del.resolvedAt || del.updatedAt);
                if (deliveredDateKey === dayKey && del.status === 'Received') {
                    deliveredCount += 1;
                }
            });

            weeklyTrendArray.push({
                name: dayLabel,
                Packed: packedCount,
                Delivered: deliveredCount
            });
        }

        const weeklyTrend = weeklyTrendArray;

        const businessCounts = await prisma.delivery.groupBy({
            by: ['businessId'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 3
        });

        const businesses = await prisma.business.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        });

        const batches = await prisma.batch.findMany({ select: { id: true, name: true } });
        
        let lecturers = [];
        try {
            const setting = await prisma.appSetting.findUnique({ where: { key: 'MASTER_TUTES' } });
            if (setting) {
                const masterData = JSON.parse(setting.value);
                lecturers = masterData.map(l => l.name);
            }
        } catch (e) {
            console.error("Failed to fetch lecturers", e);
        }

        const maxOrders = businessCounts[0]?._count.id || 1;
        const topBusinesses = businessCounts.map(bc => {
            const biz = businesses.find(b => b.id === bc.businessId);
            return {
                name: biz ? biz.name : 'Unknown Business',
                orders: bc._count.id,
                progress: Math.round((bc._count.id / maxOrders) * 100)
            };
        });

        const latestUpdates = await prisma.delivery.findMany({
            take: 5,
            orderBy: { updatedAt: 'desc' },
            select: { id: true, status: true, updatedAt: true }
        });

        const timeSince = (date) => {
            const seconds = Math.floor((new Date() - new Date(date)) / 1000);
            if (seconds < 60) return `${seconds} secs ago`;
            if (seconds < 3600) return `${Math.floor(seconds / 60)} mins ago`;
            if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
            return `${Math.floor(seconds / 86400)} days ago`;
        };

        const recentActivity = latestUpdates.map((update, index) => {
            let type = 'info';
            let text = `Order ORD-${update.id} updated to ${update.status}`;
            
            if (update.status === 'Received') { type = 'success'; text = `Order ORD-${update.id} delivered successfully`; }
            else if (update.status === 'Hold') { type = 'error'; text = `Order ORD-${update.id} placed on hold`; }
            else if (update.status === 'Packed') { type = 'info'; text = `Order ORD-${update.id} packed and ready`; }
            else if (update.status === 'On the way') { type = 'info'; text = `Order ORD-${update.id} dispatched via courier`; }

            return { id: index + 1, text, time: timeSince(update.updatedAt), type };
        });

        res.status(200).json({ 
            pending, onHold, dispatched, deliveredToday, lowStock, returned,
            statusDistribution, weeklyTrend, topBusinesses, recentActivity,
            businesses, batches, lecturers
        });

    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
};

exports.getTuteDeliveryReport = async (req, res) => {
    try {
        const { startDate, endDate, lecturers, batchId, paymentType, businessId } = req.query;

        let whereClause = { status: { in: ['Packed', 'On the way', 'Received'] } };

        if (paymentType && paymentType !== 'All') {
            whereClause.paymentType = paymentType;
        }

        if (businessId && businessId !== 'All' && businessId !== 'ALL') {
            whereClause.businessId = parseInt(businessId);
        }
        
        if (startDate && endDate) {
            const start = new Date(startDate); start.setHours(0, 0, 0, 0);
            const end = new Date(endDate); end.setHours(23, 59, 59, 999);
            whereClause.updatedAt = { gte: start, lte: end };
        }

        const deliveries = await prisma.delivery.findMany({
            where: whereClause,
            include: {
                items: {
                    include: { course: true }
                },
                payment: { include: { student: true, batch: true, group: true } }
            },
            orderBy: { updatedAt: 'desc' }
        });

        let selectedLecturers = [];
        if (lecturers && lecturers !== 'All') {
            try {
                selectedLecturers = JSON.parse(lecturers);
            } catch (e) {
                selectedLecturers = [lecturers];
            }
        }

        const courseIds = [...new Set(deliveries.flatMap(d => d.items.map(i => i.courseId)).filter(Boolean))];
        const courses = await prisma.course.findMany({ where: { id: { in: courseIds } } });
        const batchIds = [...new Set(deliveries.map(d => d.payment?.batchId).filter(Boolean))];
        const allGroups = await prisma.group.findMany({ where: { batchId: { in: batchIds } } });

        const reportMap = {};

        deliveries.forEach(d => {
            const payType = d.paymentType || 'Unknown';
            const expandedItems = d.items.flatMap(item => resolveTutesForDeliveryItem(item, d, courses, allGroups));

            expandedItems.forEach(item => {
                const lecName = item.lecturerName || item.course?.lecturerName || 'Unknown Lecturer';
                
                if (selectedLecturers.length > 0 && !selectedLecturers.includes(lecName)) {
                    return;
                }

                const key = `${lecName}-${payType}-${item.courseId}-${item.tuteName}`;
                if (!reportMap[key]) {
                    reportMap[key] = { 
                        lecturerName: lecName,
                        paymentType: payType,
                        courseId: item.courseId,
                        courseName: item.courseName || item.course?.name || 'Unknown Subject',
                        tuteName: item.tuteName, 
                        deliveredQty: 0 
                    };
                }
                reportMap[key].deliveredQty += (item.quantity || 1); 
            });
        });

        const cIds = Object.values(reportMap).map(r => parseInt(r.courseId));
        const stocks = await prisma.tuteStock.findMany({ where: { courseId: { in: cIds } } });

        const finalReport = Object.values(reportMap).map(r => {
            const stockItem = stocks.find(s => s.courseId === r.courseId && s.tuteName === r.tuteName);
            return {
                lecturerName: r.lecturerName,
                paymentType: r.paymentType,
                courseName: r.courseName,
                tuteName: r.tuteName, 
                deliveredQty: r.deliveredQty,
                currentStock: stockItem?.availableQuantity || 0
            };
        });

        finalReport.sort((a, b) => b.deliveredQty - a.deliveredQty);

        const safeJson = (data) => JSON.parse(JSON.stringify(data, (k, v) => typeof v === 'bigint' ? v.toString() : v));
        res.status(200).json(safeJson(finalReport));

    } catch (error) {
        console.error("Report Generation Error:", error);
        res.status(500).json({ error: "Failed to generate report" });
    }
};

// ================= STUDENT SIDE TRACKING =================

exports.getMyDeliveries = async (req, res) => {
    try {
        const studentId = req.user.id; 

        const deliveries = await prisma.delivery.findMany({
            where: { studentId: studentId },
            include: { items: true },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json(deliveries);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch deliveries." });
    }
};

exports.confirmDelivery = async (req, res) => {
    try {
        const { deliveryId, status } = req.body;
        const studentId = req.user.id;

        const existingDelivery = await prisma.delivery.findFirst({
            where: { id: parseInt(deliveryId), studentId: studentId }
        });

        if (!existingDelivery || existingDelivery.status !== 'On the way') {
            return res.status(400).json({ error: "Invalid request or delivery is not 'On the way'." });
        }

        const updatedDelivery = await prisma.delivery.update({
            where: { id: parseInt(deliveryId) },
            data: { 
                status: status, 
                resolvedAt: new Date()
            }
        });

        res.status(200).json({ message: `Delivery marked as ${status}`, data: updatedDelivery });
    } catch (error) {
        console.error("Error confirming delivery:", error);
        res.status(500).json({ error: "Failed to confirm delivery." });
    }
};

exports.updateTracking = async (req, res) => {
    try {
        const { deliveryId } = req.params;
        const { trackingNumber, packRemark } = req.body;
        
        const updatedDelivery = await prisma.delivery.update({
            where: { id: parseInt(deliveryId) },
            data: { 
                trackingNumber: trackingNumber !== undefined ? trackingNumber : undefined,
                packRemark: packRemark !== undefined ? packRemark : undefined
            }
        });
        res.status(200).json({ message: `Tracking and remark updated`, data: updatedDelivery });
    } catch (error) {
        console.error("Error updating tracking:", error);
        res.status(500).json({ error: "Failed to update tracking info." });
    }
};

exports.getDeliveryPaymentDetails = async (req, res) => {
    try {
        const { businessId, paymentType, installmentNo } = req.query;
        
        let whereClause = {};

        if (businessId) whereClause.businessId = parseInt(businessId);
        
        // Let's filter payments based on type/installment in JS since Prisma relation filters can be tricky, 
        // or we can use relation filters.
        if (paymentType && paymentType !== 'All' && paymentType !== 'Mixed') {
            whereClause.paymentType = paymentType;
        }

        const deliveries = await prisma.delivery.findMany({
            where: whereClause,
            include: {
                payment: {
                    include: { student: true, batch: true, group: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        let formatted = deliveries.map(d => {
            const std = d.payment?.student || {};
            const addressParts = [std.addressHouseNo, std.addressStreet, std.city, std.district].filter(Boolean);
            const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : 'No Address Provided';

            const phoneParts = [std.phone, std.whatsapp, std.optionalPhone].filter(Boolean);
            const finalPhone = [...new Set(phoneParts)].join(' / ') || 'No Phone';

            let paymentTypeStr = d.paymentType;
            let installNo = d.payment?.installment_no || 1;

            return {
                id: d.id,
                paymentId: d.payment?.id,
                studentName: std.firstName ? `${std.firstName} ${std.lastName}` : 'Unknown',
                studentId: std.id ? `STU-${std.id}` : 'N/A',
                phone: finalPhone,
                address: fullAddress, 
                businessId: d.businessId,
                batchName: d.payment?.batch?.name || 'No Batch',
                paymentType: paymentTypeStr,
                installmentNo: installNo,
                paymentDate: d.payment?.created_at ? new Date(d.payment.created_at).toISOString().split('T')[0] : 'N/A',
                status: d.status
            };
        });

        // Handle Mixed Payments logic if we want to support 'Mixed' filter (similar to PendingHolds)
        // A mixed payment is where a student has multiple delivery records.
        const counts = {};
        formatted.forEach(d => {
            const key = d.phone;
            if(key) counts[key] = (counts[key] || 0) + 1;
        });

        formatted = formatted.map(d => ({
            ...d,
            isMix: counts[d.phone] > 1
        }));

        if (paymentType === 'Mixed') {
            formatted = formatted.filter(d => d.isMix);
        } else if (paymentType && paymentType !== 'All') {
            formatted = formatted.filter(d => !d.isMix && d.paymentType === paymentType);
        } else if (paymentType === 'All') {
            formatted = formatted.filter(d => !d.isMix);
        }

        if (installmentNo) {
            formatted = formatted.filter(d => parseInt(d.installmentNo) === parseInt(installmentNo));
        }

        const safeJson = (data) => JSON.parse(JSON.stringify(data, (k, v) => typeof v === 'bigint' ? v.toString() : v));

        res.status(200).json(safeJson(formatted));

    } catch (error) {
        console.error("Payment Details fetch error:", error);
        res.status(500).json({ error: "Failed to fetch payment details" });
    }
};

// ================= MASTER TUTES (APP SETTING) =================

const getMasterTutesData = async () => {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'MASTER_TUTES' } });
    if (!setting) return [];
    try { return JSON.parse(setting.value); } catch(e) { return []; }
};

const saveMasterTutesData = async (data) => {
    await prisma.appSetting.upsert({
        where: { key: 'MASTER_TUTES' },
        update: { value: JSON.stringify(data) },
        create: { key: 'MASTER_TUTES', value: JSON.stringify(data) }
    });
};

exports.getMasterTutes = async (req, res) => {
    try {
        const data = await getMasterTutesData();
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch master tutes" });
    }
};

exports.saveMasterLecturer = async (req, res) => {
    try {
        const { id, name } = req.body;
        if (!name) return res.status(400).json({ error: "Lecturer name is required" });

        let image = req.body.image || null;
        if (req.files && req.files['image'] && req.files['image'][0]) {
            image = req.files['image'][0].filename;
        }

        const data = await getMasterTutesData();
        
        if (id) {
            const index = data.findIndex(l => l.id == id);
            if (index !== -1) {
                data[index].name = name;
                if (image) data[index].image = image;
            }
        } else {
            data.push({ id: Date.now(), name, image, tutes: [] });
        }

        await saveMasterTutesData(data);
        res.status(200).json({ message: "Lecturer saved successfully", data });
    } catch (error) {
        res.status(500).json({ error: "Failed to save lecturer" });
    }
};

exports.deleteMasterLecturer = async (req, res) => {
    try {
        const { id } = req.params;
        let data = await getMasterTutesData();
        data = data.filter(l => l.id != id);
        await saveMasterTutesData(data);
        res.status(200).json({ message: "Lecturer deleted successfully", data });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete lecturer" });
    }
};

exports.saveMasterTute = async (req, res) => {
    try {
        const { lecturerId, tuteId, name } = req.body;
        if (!lecturerId || !name) return res.status(400).json({ error: "Lecturer ID and Tute name are required" });

        let image = req.body.image || null;
        if (req.files && req.files['image'] && req.files['image'][0]) {
            image = req.files['image'][0].filename;
        }

        const data = await getMasterTutesData();
        const lec = data.find(l => l.id == lecturerId);
        if (!lec) return res.status(404).json({ error: "Lecturer not found" });

        if (!lec.tutes) lec.tutes = [];

        if (tuteId) {
            const tIndex = lec.tutes.findIndex(t => t.id == tuteId);
            if (tIndex !== -1) {
                lec.tutes[tIndex].name = name;
                if (image) lec.tutes[tIndex].image = image;
            }
        } else {
            lec.tutes.push({ id: Date.now(), name, image });
        }

        await saveMasterTutesData(data);
        res.status(200).json({ message: "Tute saved successfully", data });
    } catch (error) {
        res.status(500).json({ error: "Failed to save tute" });
    }
};

exports.deleteMasterTute = async (req, res) => {
    try {
        const { lecturerId, tuteId } = req.params;
        const data = await getMasterTutesData();
        const lec = data.find(l => l.id == lecturerId);
        if (lec && lec.tutes) {
            lec.tutes = lec.tutes.filter(t => t.id != tuteId);
            await saveMasterTutesData(data);
        }
        res.status(200).json({ message: "Tute deleted successfully", data });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete tute" });
    }
};

exports.updateDeliveryLabel = async (req, res) => {
    try {
        const deliveryId = parseInt(req.params.id);
        const { labelName, labelPhone, houseNo, street, city, district } = req.body;

        const delivery = await prisma.delivery.findUnique({
            where: { id: deliveryId },
            include: { payment: true }
        });

        if (!delivery) return res.status(404).json({ error: "Delivery not found" });

        if (delivery.payment?.studentId) {
            await prisma.user.update({
                where: { id: delivery.payment.studentId },
                data: {
                    addressHouseNo: houseNo,
                    addressStreet: street,
                    city: city,
                    district: district
                }
            });
        }

        const labelAddress = [houseNo, street, city, district].filter(Boolean).join(', ');

        const updated = await prisma.delivery.update({
            where: { id: deliveryId },
            data: { labelName, labelPhone, labelAddress }
        });

        res.status(200).json({ success: true, delivery: updated });
    } catch (error) {
        console.error('Update Delivery Label Error:', error);
        res.status(500).json({ error: 'Failed to update delivery label' });
    }
};
// ================= NEW TUTE STOCK & LECTURER ENDPOINTS =================

exports.createTuteStock = async (req, res) => {
    try {
        let { courseId, tuteName, itemOrder, lecturerName, paymentGroup } = req.body;
        let actualLecturer = lecturerName;
        
        if (!courseId || courseId === 'undefined' || courseId === 'null') {
            if (!lecturerName || !paymentGroup) return res.status(400).json({ error: "Missing required details to create material" });
            const groupType = paymentGroup === 'Monthly' ? 1 : 2;
            let course = await prisma.course.findFirst({ where: { lecturerName, group: { type: groupType } } });
            if (!course) {
                const batch = await prisma.batch.findFirst({ orderBy: { id: 'desc' }});
                if (!batch) return res.status(400).json({ error: "No batches found to attach material." });
                const group = await prisma.group.create({
                    data: { name: `${lecturerName} - ${paymentGroup} Base Group`, type: groupType, batchId: batch.id }
                });
                course = await prisma.course.create({
                    data: { name: `${lecturerName} - ${paymentGroup} General Materials`, lecturerName, groupId: group.id }
                });
            }
            courseId = course.id;
            actualLecturer = course.lecturerName;
        } else {
            const courseObj = await prisma.course.findUnique({ where: { id: parseInt(courseId) } });
            actualLecturer = courseObj?.lecturerName || "Unknown Lecturer";
        }

        let tuteImage = 'default-tute.png';
        let tuteImage2 = null;
        if (req.files) {
            if (req.files['tuteImage'] && req.files['tuteImage'][0]) tuteImage = req.files['tuteImage'][0].filename;
            if (req.files['tuteImage2'] && req.files['tuteImage2'][0]) tuteImage2 = req.files['tuteImage2'][0].filename;
        }

        const newStock = await prisma.tuteStock.create({
            data: {
                courseId: parseInt(courseId),
                tuteName,
                tuteImage, tuteImage2, itemOrder: parseInt(itemOrder || 1)
            }
        });

        // Sync with MASTER_TUTES for Content Hub
        let masterData = await getMasterTutesData();
        let lecIndex = masterData.findIndex(l => l.name === actualLecturer);
        
        const newTuteEntry = {
            id: Date.now() + Math.random().toString(),
            name: tuteName,
            image: tuteImage
        };

        if (lecIndex !== -1) {
            if (!masterData[lecIndex].tutes) masterData[lecIndex].tutes = [];
            if (!masterData[lecIndex].tutes.some(t => t.name === tuteName)) {
                masterData[lecIndex].tutes.push(newTuteEntry);
                await saveMasterTutesData(masterData);
            }
        } else {
            masterData.push({
                id: Date.now().toString(),
                name: actualLecturer,
                image: null,
                tutes: [newTuteEntry]
            });
            await saveMasterTutesData(masterData);
        }

        res.status(201).json(newStock);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create tute stock" });
    }
};

exports.updateTuteStock = async (req, res) => {
    try {
        const { id, tuteName, itemOrder } = req.body;
        const oldStock = await prisma.tuteStock.findUnique({
            where: { id: parseInt(id) },
            include: { course: true }
        });

        let data = { tuteName, itemOrder: parseInt(itemOrder || 1) };
        if (req.files) {
            if (req.files['tuteImage'] && req.files['tuteImage'][0]) data.tuteImage = req.files['tuteImage'][0].filename;
            if (req.files['tuteImage2'] && req.files['tuteImage2'][0]) data.tuteImage2 = req.files['tuteImage2'][0].filename;
        }

        const updated = await prisma.tuteStock.update({
            where: { id: parseInt(id) },
            data
        });

        // Sync with MASTER_TUTES
        if (oldStock && oldStock.course?.lecturerName) {
            let masterData = await getMasterTutesData();
            let lecIndex = masterData.findIndex(l => l.name === oldStock.course.lecturerName);
            if (lecIndex !== -1 && masterData[lecIndex].tutes) {
                let tIndex = masterData[lecIndex].tutes.findIndex(t => t.name === oldStock.tuteName);
                if (tIndex !== -1) {
                    masterData[lecIndex].tutes[tIndex].name = tuteName;
                    if (data.tuteImage) masterData[lecIndex].tutes[tIndex].image = data.tuteImage;
                    await saveMasterTutesData(masterData);
                }
            }
        }

        res.status(200).json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update tute stock" });
    }
};

exports.deleteTuteStock = async (req, res) => {
    try {
        const stockId = parseInt(req.params.id);
        const oldStock = await prisma.tuteStock.findUnique({
            where: { id: stockId },
            include: { course: true }
        });

        await prisma.tuteStock.delete({ where: { id: stockId } });

        // If no remaining tute stock with this tuteName and lecturer, remove from MASTER_TUTES
        if (oldStock && oldStock.course?.lecturerName) {
            const remaining = await prisma.tuteStock.findFirst({
                where: {
                    tuteName: oldStock.tuteName,
                    course: { lecturerName: oldStock.course.lecturerName }
                }
            });
            if (!remaining) {
                let masterData = await getMasterTutesData();
                let lecIndex = masterData.findIndex(l => l.name === oldStock.course.lecturerName);
                if (lecIndex !== -1 && masterData[lecIndex].tutes) {
                    masterData[lecIndex].tutes = masterData[lecIndex].tutes.filter(t => t.name !== oldStock.tuteName);
                    await saveMasterTutesData(masterData);
                }
            }
        }

        res.status(200).json({ message: "Deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete tute stock" });
    }
};

exports.updateLecturerInfo = async (req, res) => {
    try {
        const { oldName, newName } = req.body;
        
        let masterData = await getMasterTutesData();
        let lecObj = masterData.find(l => l.name === oldName);
        
        let image = lecObj ? lecObj.image : null;
        if (req.file) image = req.file.filename;

        // Update Master Data
        if (lecObj) {
            lecObj.name = newName;
            lecObj.image = image;
        } else {
            masterData.push({ id: Date.now().toString(), name: newName, image, tutes: [] });
        }
        await saveMasterTutesData(masterData);

        // Update Course lecturerName
        if (oldName !== newName) {
            await prisma.course.updateMany({
                where: { lecturerName: oldName },
                data: { lecturerName: newName }
            });
        }
        
        res.status(200).json({ message: "Lecturer updated" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update lecturer" });
    }
};

exports.deleteLecturerGlobal = async (req, res) => {
    try {
        const { oldName } = req.params;
        
        let masterData = await getMasterTutesData();
        masterData = masterData.filter(l => l.name !== oldName);
        await saveMasterTutesData(masterData);

        // Reset course lecturerName where it matches
        await prisma.course.updateMany({
            where: { lecturerName: oldName },
            data: { lecturerName: "Unknown Lecturer" }
        });
        
        res.status(200).json({ message: "Lecturer deleted" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete lecturer" });
    }
};

// ================= CC BUSINESS MANAGER & SUPER ADMIN LECTURER TUTE STOCK & PACKING CALENDAR =================

exports.getManagerLecturerTuteStock = async (req, res) => {
    try {
        const { businessId, search, paymentType, startDate, endDate } = req.query;
        let user = req.user;
        if (user?.id) {
            const freshUser = await prisma.user.findUnique({
                where: { id: parseInt(user.id) },
                select: { id: true, role: true, department: true, businessType: true }
            });
            if (freshUser) user = freshUser;
        }

        // 1. Determine accessible businesses
        let accessibleBusinesses = await prisma.business.findMany({
            select: { id: true, name: true, head_manager_id: true, ass_manager_id: true },
            orderBy: { name: 'asc' }
        });

        const rawRole = user?.role || '';
        const rawDept = user?.department || '';
        const userRole = rawRole.toUpperCase().replace(/[\s_-]+/g, '_');
        const userDept = rawDept.toUpperCase().replace(/[\s_-]+/g, '_');

        const isDelivery = userDept === 'DELIVERY' || userRole.includes('DELIVERY');
        const isAdmin = isDelivery || ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER', 'SUPER_ADMIN', 'ADMIN'].some(r => userRole.includes(r));

        if (!isAdmin) {
            // Tokenize user.businessType (supports comma-separated string, JSON, or single name)
            let userBizTokens = [];
            if (user?.businessType) {
                userBizTokens = String(user.businessType)
                    .split(',')
                    .map(s => s.trim().toLowerCase())
                    .filter(Boolean);
            }

            const managedBusinesses = accessibleBusinesses.filter(biz => {
                const isManagerOf = (biz.head_manager_id && Number(biz.head_manager_id) === Number(user?.id)) || 
                                    (biz.ass_manager_id && Number(biz.ass_manager_id) === Number(user?.id));
                const matchesBizType = userBizTokens.some(token => 
                    token === String(biz.id) ||
                    biz.name.toLowerCase().trim() === token ||
                    biz.name.toLowerCase().includes(token) ||
                    token.includes(biz.name.toLowerCase().trim())
                );
                return isManagerOf || matchesBizType;
            });

            if (managedBusinesses.length > 0) {
                accessibleBusinesses = managedBusinesses;
            } else if (userBizTokens.length > 0) {
                // Specified businesses in user account, but none matched
                accessibleBusinesses = [];
            } else if (userRole.includes('MANAGER') || userRole.includes('DIRECTOR') || userRole.includes('ADMIN')) {
                // General Manager with no specific business restriction: can view all
            } else {
                accessibleBusinesses = [];
            }
        }

        const accessibleBizIds = accessibleBusinesses.map(b => b.id);

        // If not admin and no businesses are assigned/accessible, return empty list
        if (!isAdmin && accessibleBizIds.length === 0) {
            return res.status(200).json({
                businesses: [],
                lecturers: [],
                summary: {
                    totalLecturers: 0,
                    totalTuteTypes: 0,
                    totalAvailableStock: 0,
                    totalDelivered: 0,
                    lowStockAlerts: 0,
                    hazardCount: 0
                }
            });
        }

        // 2. Base where clause for Course and Deliveries
        let targetBizIds = null;
        if (!isAdmin) {
            targetBizIds = accessibleBizIds;
            if (businessId && businessId !== 'ALL' && businessId !== 'all' && businessId !== 'All') {
                const bId = parseInt(businessId);
                if (accessibleBizIds.includes(bId)) {
                    targetBizIds = [bId];
                }
            }
        } else {
            if (businessId && businessId !== 'ALL' && businessId !== 'all' && businessId !== 'All') {
                targetBizIds = [parseInt(businessId)];
            }
        }

        let courseWhere = {};
        if (targetBizIds) {
            courseWhere.group = { batch: { businessId: { in: targetBizIds } } };
        }

        // 3. Fetch all courses with group, batch, business, and tuteStocks
        const courses = await prisma.course.findMany({
            where: courseWhere,
            include: {
                group: {
                    include: {
                        batch: {
                            include: { business: true }
                        }
                    }
                },
                tuteStocks: true
            }
        });

        // 4. Fetch Master Tutes data for lecturer images & details
        const masterData = await getMasterTutesData();

        // 5. Fetch all packed delivery items count per course and tuteName
        let delItemWhere = {
            delivery: {
                status: { in: ['Packed', 'On the way', 'Received', 'Delivered', 'Not Received'] }
            }
        };
        if (targetBizIds) {
            delItemWhere.delivery.businessId = { in: targetBizIds };
        }

        if (startDate && endDate) {
            const start = new Date(startDate); start.setHours(0, 0, 0, 0);
            const end = new Date(endDate); end.setHours(23, 59, 59, 999);
            delItemWhere.delivery.updatedAt = { gte: start, lte: end };
        }

        const deliveredItems = await prisma.deliveryItem.findMany({
            where: delItemWhere,
            select: {
                courseId: true,
                tuteName: true,
                quantity: true,
                course: {
                    select: {
                        lecturerName: true,
                        group: { select: { type: true } }
                    }
                }
            }
        });

        // 6. Build global Lecturer Image Map from MasterData & Course groupPrices
        const normalizeLec = (s) => (s || '').replace(/[\u2013\u2014\u2212]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
        const normalizeTute = (name) => (name || '').toLowerCase().replace(/\s+/g, ' ').trim();
        const lecturerImageMap = {};

        // A. Load images from Master Tutes
        if (Array.isArray(masterData)) {
            masterData.forEach(m => {
                if (m.name && m.image) {
                    lecturerImageMap[normalizeLec(m.name)] = m.image;
                }
            });
        }

        // B. Load images from Course groupPrices (often contains the most up-to-date photo)
        courses.forEach(c => {
            if (c.lecturerName && c.groupPrices) {
                try {
                    const gpArr = typeof c.groupPrices === 'string' ? JSON.parse(c.groupPrices) : c.groupPrices;
                    const img = Array.isArray(gpArr) ? gpArr.find(g => g.lecturerImage)?.lecturerImage : null;
                    if (img) {
                        const norm = normalizeLec(c.lecturerName);
                        if (!lecturerImageMap[norm]) lecturerImageMap[norm] = img;
                    }
                } catch (e) {}
            }
        });

        // 7. Group tute stocks by Lecturer and distinct tute type (100% matching TuteStock.jsx)
        const lecturerMap = {};

        courses.forEach(course => {
            let lecName = course.lecturerName ? course.lecturerName.trim() : 'General / Unassigned';
            if (!lecName || lecName === 'null') lecName = 'General / Unassigned';

            const normLecName = normalizeLec(lecName);
            let lecImage = lecturerImageMap[normLecName] || null;
            if (!lecImage) {
                const matchKey = Object.keys(lecturerImageMap).find(k => k.startsWith(normLecName) || normLecName.startsWith(k));
                if (matchKey) lecImage = lecturerImageMap[matchKey];
            }

            const masterLec = Array.isArray(masterData) ? masterData.find(l => {
                const nl = normalizeLec(l.name);
                return nl === normLecName || nl.startsWith(normLecName) || normLecName.startsWith(nl);
            }) : null;

            if (!lecturerMap[lecName]) {
                lecturerMap[lecName] = {
                    id: masterLec?.id || lecName,
                    name: lecName,
                    image: lecImage,
                    businesses: new Map(),
                    batches: new Map(),
                    monthlyTypes: {},
                    fullTypes: {},
                    totalDelivered: 0,
                    monthlyDelivered: 0,
                    fullDelivered: 0
                };
            } else if (!lecturerMap[lecName].image && lecImage) {
                lecturerMap[lecName].image = lecImage;
            }

            const biz = course.group?.batch?.business;
            const batch = course.group?.batch;
            if (biz) lecturerMap[lecName].businesses.set(biz.id, biz.name);
            if (batch) lecturerMap[lecName].batches.set(batch.id, batch.name);

            const isMonthly = course.group?.type === 1;
            const targetTypes = isMonthly ? lecturerMap[lecName].monthlyTypes : lecturerMap[lecName].fullTypes;
            const pTypeStr = isMonthly ? 'Monthly' : 'Full';

            if (course.tuteStocks && course.tuteStocks.length > 0) {
                course.tuteStocks.forEach(stock => {
                    const norm = normalizeTute(stock.tuteName);
                    
                    let coverImg = stock.tuteImage;
                    if (!coverImg || coverImg === 'default-tute.png' || coverImg === 'null') {
                        const mCover = masterLec?.tutes?.find(t => t.name === stock.tuteName)?.image;
                        if (mCover) coverImg = mCover;
                    }

                    if (!targetTypes[norm]) {
                        targetTypes[norm] = {
                            id: stock.id,
                            originalIds: [stock.id],
                            courseId: course.id,
                            courseName: course.name,
                            batchId: batch?.id,
                            batchName: batch?.name || 'N/A',
                            businessId: biz?.id,
                            businessName: biz?.name || 'N/A',
                            paymentType: pTypeStr,
                            tuteName: stock.tuteName,
                            tuteImage: coverImg || 'default-tute.png',
                            tuteImage2: stock.tuteImage2 || null,
                            availableQuantity: stock.availableQuantity || 0,
                            itemOrder: stock.itemOrder || 1,
                            totalDelivered: 0,
                            updatedAt: stock.updatedAt
                        };
                    } else {
                        targetTypes[norm].availableQuantity += (stock.availableQuantity || 0);
                        targetTypes[norm].originalIds.push(stock.id);
                        if ((stock.itemOrder || 1) > (targetTypes[norm].itemOrder || 1)) {
                            targetTypes[norm].itemOrder = stock.itemOrder;
                        }
                        if (coverImg && coverImg !== 'default-tute.png' && (!targetTypes[norm].tuteImage || targetTypes[norm].tuteImage === 'default-tute.png')) {
                            targetTypes[norm].tuteImage = coverImg;
                        }
                    }
                });
            }
        });

        // 8. Associate delivered counts by lecturer and normalized tute name
        deliveredItems.forEach(d => {
            let lecName = d.course?.lecturerName ? d.course.lecturerName.trim() : 'General / Unassigned';
            if (!lecName || lecName === 'null') lecName = 'General / Unassigned';
            if (!lecturerMap[lecName]) return;

            const isMonthly = d.course?.group?.type === 1;
            const qty = d.quantity || 1;
            const norm = normalizeTute(d.tuteName);
            const targetTypes = isMonthly ? lecturerMap[lecName].monthlyTypes : lecturerMap[lecName].fullTypes;

            lecturerMap[lecName].totalDelivered += qty;
            if (isMonthly) {
                lecturerMap[lecName].monthlyDelivered += qty;
            } else {
                lecturerMap[lecName].fullDelivered += qty;
            }

            // Smart tute matching (exact, variations with/without 'Full', or prefix match)
            let matchedTute = targetTypes[norm];
            if (!matchedTute) {
                if (targetTypes[norm + ' full']) {
                    matchedTute = targetTypes[norm + ' full'];
                } else if (norm.endsWith(' full') && targetTypes[norm.replace(/\s+full$/, '')]) {
                    matchedTute = targetTypes[norm.replace(/\s+full$/, '')];
                } else {
                    const keys = Object.keys(targetTypes);
                    const foundKey = keys.find(k => k === norm || k.startsWith(norm) || norm.startsWith(k));
                    if (foundKey) matchedTute = targetTypes[foundKey];
                }
            }

            if (matchedTute) {
                matchedTute.totalDelivered += qty;
            }
        });

        const isFilterMonthly = paymentType && paymentType.toLowerCase() === 'monthly';
        const isFilterFull = paymentType && (paymentType.toLowerCase().includes('full'));

        // 9. Convert Map to array and format with identical numbers to TuteStock.jsx
        let lecturersList = Object.values(lecturerMap).map(lec => {
            const monthlyTutes = Object.values(lec.monthlyTypes).map(t => {
                const qty = t.availableQuantity || 0;
                const isHazard = qty < 10;
                return {
                    ...t,
                    isHazard,
                    status: qty <= 0 ? 'DEPLETED' : qty < 10 ? 'HAZARD' : qty <= 20 ? 'LOW_STOCK' : 'IN_STOCK'
                };
            }).sort((a, b) => (a.itemOrder || 1) - (b.itemOrder || 1));

            const fullTutes = Object.values(lec.fullTypes).map(t => {
                const qty = t.availableQuantity || 0;
                const isHazard = qty < 10;
                return {
                    ...t,
                    isHazard,
                    status: qty <= 0 ? 'DEPLETED' : qty < 10 ? 'HAZARD' : qty <= 20 ? 'LOW_STOCK' : 'IN_STOCK'
                };
            }).sort((a, b) => (a.itemOrder || 1) - (b.itemOrder || 1));

            const monthlyStock = monthlyTutes.reduce((s, t) => s + t.availableQuantity, 0);
            const fullStock = fullTutes.reduce((s, t) => s + t.availableQuantity, 0);

            let activeTutes = [];
            let activeStock = 0;
            let activeDelivered = 0;
            let activeTypesCount = 0;

            if (isFilterMonthly) {
                activeTutes = monthlyTutes;
                activeStock = monthlyStock;
                activeDelivered = lec.monthlyDelivered;
                activeTypesCount = monthlyTutes.length;
            } else if (isFilterFull) {
                activeTutes = fullTutes;
                activeStock = fullStock;
                activeDelivered = lec.fullDelivered;
                activeTypesCount = fullTutes.length;
            } else {
                activeTutes = [...fullTutes, ...monthlyTutes];
                activeStock = fullStock + monthlyStock;
                activeDelivered = lec.totalDelivered;
                activeTypesCount = fullTutes.length + monthlyTutes.length;
            }

            const hazardCount = activeTutes.filter(t => (t.availableQuantity || 0) < 10).length;
            const hasHazard = hazardCount > 0;
            const lowStockCount = activeTutes.filter(t => (t.availableQuantity || 0) <= 20).length;

            return {
                id: lec.id,
                name: lec.name,
                image: lec.image,
                businesses: Array.from(lec.businesses.entries()).map(([id, name]) => ({ id, name })),
                batches: Array.from(lec.batches.entries()).map(([id, name]) => ({ id, name })),
                totalStock: activeStock,
                totalDelivered: activeDelivered,
                lowStockCount,
                hazardCount,
                hasHazard,
                tutesCount: activeTypesCount,
                monthlyStock,
                fullStock,
                monthlyTypesCount: monthlyTutes.length,
                fullTypesCount: fullTutes.length,
                monthlyDelivered: lec.monthlyDelivered,
                fullDelivered: lec.fullDelivered,
                monthlyTutes,
                fullTutes,
                tutes: activeTutes
            };
        }).filter(l => (l.monthlyTypesCount + l.fullTypesCount) > 0);

        // Search filter if provided
        if (search && search.trim() !== '') {
            const q = search.toLowerCase().trim();
            lecturersList = lecturersList.filter(l => 
                l.name.toLowerCase().includes(q) || 
                l.tutes.some(t => t.tuteName.toLowerCase().includes(q) || t.courseName.toLowerCase().includes(q))
            );
        }

        // Sort by total stock or tutes count
        lecturersList.sort((a, b) => b.tutesCount - a.tutesCount);

        const safeJson = (data) => JSON.parse(JSON.stringify(data, (k, v) => typeof v === 'bigint' ? v.toString() : v));

        res.status(200).json({
            businesses: safeJson(accessibleBusinesses),
            lecturers: safeJson(lecturersList),
            summary: {
                totalLecturers: lecturersList.length,
                totalTuteTypes: lecturersList.reduce((acc, l) => acc + l.tutesCount, 0),
                totalAvailableStock: lecturersList.reduce((acc, l) => acc + l.totalStock, 0),
                totalStockAvailable: lecturersList.reduce((acc, l) => acc + l.totalStock, 0),
                totalDelivered: lecturersList.reduce((acc, l) => acc + l.totalDelivered, 0),
                totalMonthlyStock: lecturersList.reduce((acc, l) => acc + (l.monthlyStock || 0), 0),
                totalFullStock: lecturersList.reduce((acc, l) => acc + (l.fullStock || 0), 0),
                totalLowStockAlerts: lecturersList.reduce((acc, l) => acc + (l.lowStockCount || 0), 0),
                totalHazardAlerts: lecturersList.reduce((acc, l) => acc + (l.hazardCount || 0), 0),
                totalHazardLecturers: lecturersList.filter(l => l.hasHazard).length
            }
        });

    } catch (error) {
        console.error("Manager Lecturer Tute Stock Error:", error);
        res.status(500).json({ error: "Failed to fetch lecturer tute stock." });
    }
};

exports.getPackingCalendarHistory = async (req, res) => {
    try {
        const { year, month, businessId, lecturerName } = req.query;
        const user = req.user;

        const targetYear = year ? parseInt(year) : new Date().getFullYear();
        const targetMonth = month ? parseInt(month) : (new Date().getMonth() + 1);

        // Compute start and end of the month
        const startOfMonth = new Date(targetYear, targetMonth - 1, 1, 0, 0, 0, 0);
        const endOfMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

        // Role & Business filtering
        let whereClause = {
            status: { in: ['Packed', 'On the way', 'Received'] },
            OR: [
                { packedAt: { gte: startOfMonth, lte: endOfMonth } },
                { packedAt: null, updatedAt: { gte: startOfMonth, lte: endOfMonth } }
            ]
        };

        const rawRole = user?.role || '';
        const userRole = rawRole.toUpperCase().replace(/ /g, '_');
        const isAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER'].includes(userRole);

        if (businessId && businessId !== 'ALL' && businessId !== 'all') {
            whereClause.businessId = parseInt(businessId);
        } else if (!isAdmin) {
            const userBizs = await prisma.business.findMany({
                where: {
                    OR: [
                        { head_manager_id: user?.id },
                        { ass_manager_id: user?.id }
                    ]
                },
                select: { id: true }
            });
            const userBizIds = userBizs.map(b => b.id);
            if (userBizIds.length > 0) {
                whereClause.businessId = { in: userBizIds };
            }
        }

        const deliveries = await prisma.delivery.findMany({
            where: whereClause,
            include: {
                items: {
                    include: { course: true }
                },
                payment: {
                    include: { student: true, batch: true, group: true }
                }
            },
            orderBy: { packedAt: 'desc' }
        });

        // Preload courses, groups, and businesses for resolution
        const courseIds = [...new Set(deliveries.flatMap(d => d.items.map(i => i.courseId)).filter(Boolean))];
        const courses = await prisma.course.findMany({ where: { id: { in: courseIds } } });
        const batchIds = [...new Set(deliveries.map(d => d.payment?.batchId).filter(Boolean))];
        const allGroups = await prisma.group.findMany({ where: { batchId: { in: batchIds } } });
        const allBusinesses = await prisma.business.findMany({ select: { id: true, name: true } });

        const businessNameMap = {};
        allBusinesses.forEach(b => { businessNameMap[b.id] = b.name; });

        const daysMap = {};
        const lecturerStatsMap = {};
        const tuteStatsMap = {};
        const businessStatsMap = {};

        let totalOrdersPacked = 0;
        let totalTutesPacked = 0;

        deliveries.forEach(del => {
            const packDateObj = del.packedAt || del.updatedAt || del.createdAt;
            const dateStr = new Date(packDateObj).toISOString().split('T')[0];

            const expandedItems = del.items.flatMap(item => resolveTutesForDeliveryItem(item, del, courses, allGroups));

            // Filter by lecturer if requested
            let matchedItems = expandedItems;
            if (lecturerName && lecturerName !== 'ALL' && lecturerName !== 'all') {
                matchedItems = expandedItems.filter(i => (i.lecturerName || '').toLowerCase().includes(lecturerName.toLowerCase()));
                if (matchedItems.length === 0) return; // Skip this delivery if no matching lecturer tutes
            }

            const delTutesCount = matchedItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
            totalOrdersPacked += 1;
            totalTutesPacked += delTutesCount;

            if (!daysMap[dateStr]) {
                daysMap[dateStr] = {
                    date: dateStr,
                    day: parseInt(dateStr.split('-')[2]),
                    ordersCount: 0,
                    tutesCount: 0,
                    lecturers: {},
                    businesses: {},
                    sampleItems: []
                };
            }

            daysMap[dateStr].ordersCount += 1;
            daysMap[dateStr].tutesCount += delTutesCount;

            const bizName = businessNameMap[del.businessId] || 'Other Business';
            daysMap[dateStr].businesses[bizName] = (daysMap[dateStr].businesses[bizName] || 0) + delTutesCount;
            businessStatsMap[bizName] = (businessStatsMap[bizName] || 0) + delTutesCount;

            matchedItems.forEach(item => {
                const lec = item.lecturerName || 'Unknown Lecturer';
                const tName = item.tuteName || 'Tute';

                daysMap[dateStr].lecturers[lec] = (daysMap[dateStr].lecturers[lec] || 0) + (item.quantity || 1);
                lecturerStatsMap[lec] = (lecturerStatsMap[lec] || 0) + (item.quantity || 1);
                tuteStatsMap[tName] = (tuteStatsMap[tName] || 0) + (item.quantity || 1);

                if (daysMap[dateStr].sampleItems.length < 4) {
                    daysMap[dateStr].sampleItems.push({
                        tuteName: tName,
                        lecturerName: lec,
                        quantity: item.quantity || 1,
                        tuteImage: item.tuteCover || item.tuteImage
                    });
                }
            });
        });

        // Compute rankings & KPIs
        const topLecturers = Object.entries(lecturerStatsMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        const topTutes = Object.entries(tuteStatsMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        const businessBreakdown = Object.entries(businessStatsMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        const activeDaysCount = Object.keys(daysMap).length;
        const dailyAverage = activeDaysCount > 0 ? Math.round(totalTutesPacked / activeDaysCount) : 0;

        let peakDay = { date: 'N/A', count: 0 };
        Object.values(daysMap).forEach(d => {
            if (d.tutesCount > peakDay.count) {
                peakDay = { date: d.date, count: d.tutesCount };
            }
        });

        const todayStr = new Date().toISOString().split('T')[0];
        const todayTutesCount = daysMap[todayStr]?.tutesCount || 0;
        const todayOrdersCount = daysMap[todayStr]?.ordersCount || 0;

        const safeJson = (data) => JSON.parse(JSON.stringify(data, (k, v) => typeof v === 'bigint' ? v.toString() : v));

        res.status(200).json(safeJson({
            year: targetYear,
            month: targetMonth,
            summary: {
                totalOrdersPacked,
                totalTutesPacked,
                activeDaysCount,
                dailyAverage,
                peakDay,
                todayTutesCount,
                todayOrdersCount
            },
            days: daysMap,
            topLecturers,
            topTutes,
            businessBreakdown
        }));

    } catch (error) {
        console.error("Packing Calendar History Error:", error);
        res.status(500).json({ error: "Failed to fetch packing calendar history." });
    }
};

exports.getPackingDayDetails = async (req, res) => {
    try {
        const { date, businessId, lecturerName } = req.query;
        if (!date) return res.status(400).json({ error: "Date parameter is required (YYYY-MM-DD)." });

        const startOfDay = new Date(date + 'T00:00:00.000Z');
        const endOfDay = new Date(date + 'T23:59:59.999Z');

        let whereClause = {
            status: { in: ['Packed', 'On the way', 'Received'] },
            OR: [
                { packedAt: { gte: startOfDay, lte: endOfDay } },
                { packedAt: null, updatedAt: { gte: startOfDay, lte: endOfDay } }
            ]
        };

        if (businessId && businessId !== 'ALL' && businessId !== 'all') {
            whereClause.businessId = parseInt(businessId);
        }

        const deliveries = await prisma.delivery.findMany({
            where: whereClause,
            include: {
                items: {
                    include: { course: true }
                },
                payment: {
                    include: { student: true, batch: true, group: true }
                }
            },
            orderBy: { packedAt: 'desc' }
        });

        const courseIds = [...new Set(deliveries.flatMap(d => d.items.map(i => i.courseId)).filter(Boolean))];
        const courses = await prisma.course.findMany({ where: { id: { in: courseIds } } });
        const batchIds = [...new Set(deliveries.map(d => d.payment?.batchId).filter(Boolean))];
        const allGroups = await prisma.group.findMany({ where: { batchId: { in: batchIds } } });
        const businesses = await prisma.business.findMany({ select: { id: true, name: true } });

        const bizMap = {};
        businesses.forEach(b => { bizMap[b.id] = b.name; });

        let formattedDeliveries = [];
        const lecturerCounts = {};
        const tuteCounts = {};
        let dayTotalTutes = 0;

        deliveries.forEach(del => {
            const std = del.payment?.student || {};
            const addressParts = [std.addressHouseNo, std.addressStreet, std.city, std.district].filter(Boolean);
            const fullAddress = addressParts.join(', ') || 'No Address';
            const phoneParts = [std.phone, std.whatsapp, std.optionalPhone].filter(Boolean);
            const finalPhone = [...new Set(phoneParts)].join(' / ') || 'No Phone';

            const expandedItems = del.items.flatMap(item => resolveTutesForDeliveryItem(item, del, courses, allGroups));

            let filteredItems = expandedItems;
            if (lecturerName && lecturerName !== 'ALL' && lecturerName !== 'all') {
                filteredItems = expandedItems.filter(i => (i.lecturerName || '').toLowerCase().includes(lecturerName.toLowerCase()));
                if (filteredItems.length === 0) return;
            }

            const orderTutesCount = filteredItems.reduce((acc, i) => acc + (i.quantity || 1), 0);
            dayTotalTutes += orderTutesCount;

            filteredItems.forEach(i => {
                const lec = i.lecturerName || 'Unknown';
                const tName = i.tuteName || 'Tute';
                lecturerCounts[lec] = (lecturerCounts[lec] || 0) + (i.quantity || 1);
                tuteCounts[tName] = (tuteCounts[tName] || 0) + (i.quantity || 1);
            });

            formattedDeliveries.push({
                id: del.id,
                orderNo: `ORD-${del.id}`,
                studentName: del.labelName || (std.firstName ? `${std.firstName} ${std.lastName}` : 'Unknown Student'),
                studentPhone: del.labelPhone || finalPhone,
                studentAddress: del.labelAddress || fullAddress,
                businessId: del.businessId,
                businessName: bizMap[del.businessId] || 'Unknown Business',
                batchName: del.payment?.batch?.name || 'N/A',
                paymentType: del.paymentType,
                status: del.status,
                trackingNumber: del.trackingNumber || 'N/A',
                packRemark: del.packRemark || '',
                packedAt: del.packedAt || del.updatedAt,
                totalTutesCount: orderTutesCount,
                items: filteredItems.map(i => ({
                    tuteName: i.tuteName,
                    courseName: i.courseName,
                    lecturerName: i.lecturerName,
                    quantity: i.quantity || 1,
                    tuteImage: i.tuteCover || i.tuteImage
                }))
            });
        });

        const safeJson = (data) => JSON.parse(JSON.stringify(data, (k, v) => typeof v === 'bigint' ? v.toString() : v));

        res.status(200).json(safeJson({
            date,
            totalOrders: formattedDeliveries.length,
            totalTutes: dayTotalTutes,
            lecturerSummary: Object.entries(lecturerCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
            tuteSummary: Object.entries(tuteCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
            deliveries: formattedDeliveries
        }));

    } catch (error) {
        console.error("Packing Day Details Error:", error);
        res.status(500).json({ error: "Failed to fetch day packing details." });
    }
};

