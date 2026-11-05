const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getBusinesses = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.id;
        const userRole = req.user.role;
        const businessType = req.user.businessType;
        
        const userDepartment = req.user.department ? req.user.department.toUpperCase() : '';
        const roleUpper = userRole ? userRole.toUpperCase().replace(/[\s_-]+/g, '_') : '';
        const isAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'FINANCE', 'SUPER_ADMIN'].includes(roleUpper) || 
                        userDepartment === 'DELIVERY' || 
                        userDepartment === 'CALL_CENTER' || 
                        userDepartment === 'CALL CENTER' || 
                        userDepartment === 'FINANCE';
        
        let businesses;
        if (isAdmin) {
            businesses = await prisma.business.findMany({
                orderBy: [
                    { itemOrder: 'asc' },
                    { id: 'asc' }
                ]
            });
        } else {
            const allBiz = await prisma.business.findMany({
                orderBy: [
                    { itemOrder: 'asc' },
                    { id: 'asc' }
                ]
            });
            const userBizList = businessType ? String(businessType).split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
            businesses = allBiz.filter(biz => {
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
        }
        res.status(200).json(businesses);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch businesses" });
    }
};

exports.createBusiness = async (req, res) => {
    try {
        const { name, category, medium, description, streams, isDiscountEnabledForInstallments, merchantId } = req.body;
        const logo = req.file ? req.file.filename : 'default.png';

        const newBiz = await prisma.business.create({
            data: {
                name, category, medium, description, streams, logo,
                isDiscountEnabledForInstallments: parseInt(isDiscountEnabledForInstallments || 0),
                merchantId: merchantId || null
            }
        });
        res.status(201).json(newBiz);
    } catch (error) {
        res.status(500).json({ error: "Failed to create business" });
    }
};

// Business එකක් Update කිරීම
exports.updateBusiness = async (req, res) => {
    try {
        const { businessId, name, category, medium, description, streams, isDiscountEnabledForInstallments, merchantId } = req.body;
        
        const updateData = {
            name, 
            category, 
            medium, 
            description, 
            streams,
            isDiscountEnabledForInstallments: parseInt(isDiscountEnabledForInstallments || 0),
            merchantId: merchantId || null
        };

        // අලුත් ලෝගෝ එකක් දාලා තියෙනවා නම් ඒකත් අප්ඩේට් කරනවා
        if (req.file) {
            updateData.logo = req.file.filename;
        }

        const updatedBiz = await prisma.business.update({
            where: { id: parseInt(businessId) },
            data: updateData
        });
        res.status(200).json(updatedBiz);
    } catch (error) {
        res.status(500).json({ error: "Failed to update business" });
    }
};

// Business එකක් Delete කිරීම
exports.deleteBusiness = async (req, res) => {
    try {
        const { business_id } = req.body;
        await prisma.business.delete({
            where: { id: parseInt(business_id) }
        });
        res.status(200).json({ message: "Business deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete business. It might be linked to other data." });
    }
};

// Business එකේ Status එක On/Off කිරීම
exports.toggleBusinessStatus = async (req, res) => {
    try {
        const { business_id, status } = req.body;
        const updatedBiz = await prisma.business.update({
            where: { id: parseInt(business_id) },
            data: { status: parseInt(status) }
        });
        res.status(200).json(updatedBiz);
    } catch (error) {
        res.status(500).json({ error: "Failed to toggle business status" });
    }
};

// controllers/businessController.js

exports.assignManagers = async (req, res) => {
    try {
        const businessId = parseInt(req.params.id);
        const { head_manager_id, ass_manager_id } = req.body;

        // 🔥 මෙතන තමයි කලින් අවුල තිබ්බේ. BigInt වෙනුවට parseInt දැම්මා 🔥
        const headManagerId = head_manager_id ? parseInt(head_manager_id) : null;
        const assManagerId = ass_manager_id ? parseInt(ass_manager_id) : null;

        const updatedBusiness = await prisma.business.update({
            where: { id: businessId },
            data: {
                head_manager_id: headManagerId,
                ass_manager_id: assManagerId
            }
        });

        const safeData = JSON.parse(JSON.stringify(updatedBusiness, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));

        res.status(200).json({ message: "Managers assigned successfully", business: safeData });
    } catch (error) {
        console.error("Manager Assignment Error:", error);
        res.status(500).json({ error: "Failed to assign managers" });
    }
};

exports.reorderBusinesses = async (req, res) => {
    try {
        const { orders } = req.body;
        // orders should be an array of { id, itemOrder }
        
        await prisma.$transaction(
            orders.map(order => 
                prisma.business.update({
                    where: { id: parseInt(order.id) },
                    data: { itemOrder: parseInt(order.itemOrder) }
                })
            )
        );
        
        res.status(200).json({ message: "Order updated successfully" });
    } catch (error) {
        console.error("Reorder Businesses Error:", error);
        res.status(500).json({ error: "Failed to update business order" });
    }
};