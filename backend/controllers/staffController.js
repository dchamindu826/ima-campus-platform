const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const prisma = require('../src/core/db');

// 🔥 Role Format Fixer Helper 🔥
const checkIsTopLevel = (role) => {
    if (!role) return false;
    const normalized = role.toUpperCase().replace(/[\s_-]+/g, '_');
    return normalized === 'SYSTEM_ADMIN' || normalized === 'DIRECTOR' || normalized === 'ADMIN_MANAGER';
};

// 1. Get All Businesses
exports.getBusinesses = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.id;
        const userRole = req.user.role;
        const businessType = req.user.businessType;
        
        const userDepartment = req.user.department ? req.user.department.toUpperCase() : '';
        const roleUpper = userRole ? userRole.toUpperCase().replace(/[\s_-]+/g, '_') : '';
        const isAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'FINANCE', 'SUPER_ADMIN', 'ADMIN_MANAGER'].includes(roleUpper) || 
                        userDepartment === 'DELIVERY' || 
                        userDepartment === 'CALL_CENTER' || 
                        userDepartment === 'CALL CENTER' || 
                        userDepartment === 'FINANCE';
        
        let businesses;
        if (isAdmin) {
            businesses = await prisma.business.findMany({ select: { id: true, name: true, logo: true, ringtone: true } });
        } else {
            const allBiz = await prisma.business.findMany({ select: { id: true, name: true, logo: true, ringtone: true, head_manager_id: true, ass_manager_id: true } });
            
            const managerBizArray = businessType ? String(businessType).split(',').map(b => b.trim().toLowerCase()).filter(Boolean) : [];
            
            businesses = allBiz.filter(biz => {
                const isManagerOf = biz.head_manager_id === userId || biz.ass_manager_id === userId;
                const bizName = biz.name.trim().toLowerCase();
                const bizId = String(biz.id).trim();
                
                const matchesBizType = managerBizArray.includes(bizName) || managerBizArray.includes(bizId);
                return isManagerOf || matchesBizType;
            });
        }
        res.status(200).json(businesses.map(b => ({ id: b.id, name: b.name, logo: b.logo, ringtone: b.ringtone })));
    } catch (error) { res.status(500).json({ error: "Failed to fetch businesses" }); }
};

// 2. Get all staff 
exports.getStaff = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.id;
        const userRole = req.user.role;
        const managerBusinessType = req.user.businessType;
        
        const roleUpper = userRole ? userRole.toUpperCase().replace(/[\s_-]+/g, '_') : '';
        const isAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'ADMIN_MANAGER'].includes(roleUpper);
        
        const { startDate, endDate } = req.query;
console.log("[DEBUG] /admin/staff query:", req.query);
        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter = {
                createdAt: {
                    gte: new Date(startDate),
                    lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
                }
            };
        }

        let whereClause = {
            role: { notIn: ['STUDENT', 'USER', 'Student', 'student', 'user'] }
        };

        const queryDept = req.query.department;
        if (queryDept === 'Social Media' || req.user?.department === 'Social Media') {
            whereClause.OR = [
                { department: 'Social Media' },
                { role: { in: ['Social Media Staff', 'Social Media Manager', 'SOCIAL_MEDIA_STAFF', 'SOCIAL_MEDIA_MANAGER', 'Editor', 'Graphic Designer', 'Video Editor'] } }
            ];
        } else if (queryDept === 'Administration') {
            whereClause.OR = [
                { department: 'Administration' },
                { role: { in: ['System Admin', 'Director', 'Admin Manager', 'SYSTEM_ADMIN', 'DIRECTOR', 'ADMIN_MANAGER'] } }
            ];
        } else if (queryDept) {
            whereClause.department = queryDept;
        } else if (!isAdmin && req.user.department) {
            whereClause.department = req.user.department;
        }

        const allStaff = await prisma.user.findMany({
            where: whereClause,
            select: { id: true, firstName: true, lastName: true, phone: true, nic: true, role: true, department: true, businessType: true, extension: true, hasCallChannel: true, agentStatus: true, image: true }
        });
        
        // Fetch stats grouped by agentId, direction, status, and campaignType
        const callStats = await prisma.whatsAppCallRecord.groupBy({
            by: ['agentId', 'direction', 'status', 'campaignType'],
            where: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
            _count: { id: true },
            _sum: { duration: true }
        });
        
        // Fetch all missed calls to check poolSnapshot for unassigned missed calls
        const allMissedCalls = await prisma.whatsAppCallRecord.findMany({
            where: {
                status: 'MISSED',
                ...(Object.keys(dateFilter).length > 0 ? dateFilter : {})
            },
            select: { poolSnapshot: true, agentId: true }
        });
        
        const staffWithStats = allStaff.map(staff => {
            const inboundComp = callStats.filter(s => s.agentId === staff.id && (s.direction === 'INBOUND' || s.direction === 'inbound') && s.status === 'COMPLETED');
            const outboundComp = callStats.filter(s => s.agentId === staff.id && (s.direction === 'OUTBOUND' || s.direction === 'outbound') && s.status === 'COMPLETED');
            
            const freeSemOutboundComp = outboundComp.filter(s => s.campaignType === 'FREE_SEMINAR');
            const afterSemOutboundComp = outboundComp.filter(s => s.campaignType === 'AFTER_SEMINAR');
            const generalOutboundComp = outboundComp.filter(s => s.campaignType !== 'FREE_SEMINAR' && s.campaignType !== 'AFTER_SEMINAR');
            
            let missedCount = 0;
            allMissedCalls.forEach(call => {
                // If it was specifically assigned and missed (rare)
                if (call.agentId === staff.id) {
                    missedCount++;
                } 
                // If it was a pool call and missed, check if agent was in the pool and ACTIVE
                else if (!call.agentId && call.poolSnapshot && Array.isArray(call.poolSnapshot)) {
                    const snapAgent = call.poolSnapshot.find(agent => agent.id === staff.id);
                    if (snapAgent && snapAgent.agentStatus === 'ACTIVE') {
                        missedCount++;
                    }
                }
            });

            const freeSemInboundComp = inboundComp.filter(s => s.campaignType === 'FREE_SEMINAR');
            const afterSemInboundComp = inboundComp.filter(s => s.campaignType === 'AFTER_SEMINAR');
            const generalInboundComp = inboundComp.filter(s => s.campaignType !== 'FREE_SEMINAR' && s.campaignType !== 'AFTER_SEMINAR');

            const inCalls = inboundComp.reduce((acc, curr) => acc + (curr._count?.id || 0), 0);
            const inDur = inboundComp.reduce((acc, curr) => acc + (curr._sum?.duration || 0), 0);
            
            const freeSemInCalls = freeSemInboundComp.reduce((acc, curr) => acc + (curr._count?.id || 0), 0);
            const freeSemInDur = freeSemInboundComp.reduce((acc, curr) => acc + (curr._sum?.duration || 0), 0);
            
            const afterSemInCalls = afterSemInboundComp.reduce((acc, curr) => acc + (curr._count?.id || 0), 0);
            const afterSemInDur = afterSemInboundComp.reduce((acc, curr) => acc + (curr._sum?.duration || 0), 0);
            
            const generalInCalls = generalInboundComp.reduce((acc, curr) => acc + (curr._count?.id || 0), 0);
            const generalInDur = generalInboundComp.reduce((acc, curr) => acc + (curr._sum?.duration || 0), 0);
            
            const outCalls = outboundComp.reduce((acc, curr) => acc + (curr._count?.id || 0), 0);
            const outDur = outboundComp.reduce((acc, curr) => acc + (curr._sum?.duration || 0), 0);
            
            const freeSemOutCalls = freeSemOutboundComp.reduce((acc, curr) => acc + (curr._count?.id || 0), 0);
            const freeSemOutDur = freeSemOutboundComp.reduce((acc, curr) => acc + (curr._sum?.duration || 0), 0);
            
            const afterSemOutCalls = afterSemOutboundComp.reduce((acc, curr) => acc + (curr._count?.id || 0), 0);
            const afterSemOutDur = afterSemOutboundComp.reduce((acc, curr) => acc + (curr._sum?.duration || 0), 0);
            
            const generalOutCalls = generalOutboundComp.reduce((acc, curr) => acc + (curr._count?.id || 0), 0);
            const generalOutDur = generalOutboundComp.reduce((acc, curr) => acc + (curr._sum?.duration || 0), 0);
            
            const totalCalls = inCalls + outCalls;
            const totalDuration = inDur + outDur;
            const avgTotalDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;
            
            return {
                ...staff,
                callStats: {
                    totalCalls: totalCalls,
                    totalMinutes: Math.round(totalDuration / 60),
                    avgDuration: Math.round(avgTotalDuration / 60) // in minutes
                },
                inboundStats: {
                    totalCalls: inCalls,
                    totalMinutes: Math.round(inDur / 60),
                    avgDuration: inCalls > 0 ? Math.round(inDur / inCalls / 60) : 0,
                    freeSemCalls: freeSemInCalls,
                    freeSemMins: Math.round(freeSemInDur / 60),
                    afterSemCalls: afterSemInCalls,
                    afterSemMins: Math.round(afterSemInDur / 60),
                    generalCalls: generalInCalls,
                    generalMins: Math.round(generalInDur / 60)
                },
                outboundStats: {
                    totalCalls: outCalls,
                    totalMinutes: Math.round(outDur / 60),
                    avgDuration: outCalls > 0 ? Math.round(outDur / outCalls / 60) : 0,
                    freeSemCalls: freeSemOutCalls,
                    freeSemMins: Math.round(freeSemOutDur / 60),
                    afterSemCalls: afterSemOutCalls,
                    afterSemMins: Math.round(afterSemOutDur / 60),
                    generalCalls: generalOutCalls,
                    generalMins: Math.round(generalOutDur / 60)
                },
                missedCalls: missedCount
            };
        });

        if (isAdmin) {
            return res.status(200).json(staffWithStats);
        }

        const userDept = req.user?.department || '';
        const reqQueryDept = req.query?.department || '';

        const isSocialMediaManager = roleUpper === 'SOCIAL_MEDIA_MANAGER' || 
                                     (roleUpper === 'MANAGER' && (userDept === 'Social Media' || reqQueryDept === 'Social Media')) ||
                                     userDept === 'Social Media' ||
                                     reqQueryDept === 'Social Media';

        if (isSocialMediaManager) {
            const socialMediaStaff = staffWithStats.filter(s => 
                s.department === 'Social Media' || 
                s.role === 'Social Media Staff' || 
                s.role === 'Social Media Manager' ||
                s.role === 'Editor' ||
                s.role === 'Graphic Designer' ||
                s.role === 'Video Editor'
            );
            return res.status(200).json(socialMediaStaff);
        }

        const allBiz = await prisma.business.findMany();
        
        const managerBizArray = managerBusinessType ? String(managerBusinessType).split(',').map(b => b.trim().toLowerCase()).filter(Boolean) : [];
        
        const myBizs = allBiz.filter(biz => {
            const isManagerOf = biz.head_manager_id === userId || biz.ass_manager_id === userId;
            const bizName = biz.name.trim().toLowerCase();
            const bizId = String(biz.id).trim();
            
            const matchesBizType = managerBizArray.includes(bizName) || managerBizArray.includes(bizId);
            return isManagerOf || matchesBizType;
        });
        
        const myBizIds = myBizs.map(b => String(b.id).trim());
        const myBizNames = myBizs.map(b => b.name.toLowerCase().trim());
        
        const filteredStaff = staffWithStats.filter(s => {
            if (!s.businessType) return false;
            
            const staffBizArray = String(s.businessType).split(',').map(b => b.trim().toLowerCase()).filter(Boolean);
            
            // Check if ANY of the staff's assigned businesses match ANY of the manager's businesses
            return staffBizArray.some(sBiz => myBizIds.includes(sBiz) || myBizNames.includes(sBiz));
        });
        
        res.status(200).json(filteredStaff);
    } catch (error) { res.status(500).json({ error: "Failed to fetch staff" }); }
};

const normalizePhone = (p) => {
    if (!p) return p;
    let num = String(p).replace(/[\s-]/g, '');
    if (num.startsWith('+94')) {
        num = '0' + num.slice(3);
    } else if (num.startsWith('94') && num.length === 11) {
        num = '0' + num.slice(2);
    }
    return num;
};

// 3. Create new staff
exports.createStaff = async (req, res) => {
    try {
        let { firstName, lastName, phone, nic, password, role, department, businessType } = req.body;
        if (!firstName || !lastName || !phone) {
            return res.status(400).json({ error: "First name, last name, and phone are required." });
        }
        if (!password || password.trim() === '') {
            return res.status(400).json({ error: "Password is required." });
        }
        phone = normalizePhone(phone);
        
        const existingUser = await prisma.user.findUnique({ where: { phone } });
        if (existingUser) return res.status(400).json({ error: "Phone number already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const isTopLevel = checkIsTopLevel(role);

        let finalDepartment = isTopLevel ? (department || 'Administration') : ((role === 'Coordinator' || role === 'Paper Marker' ? 'Class Coordination' : (role === 'Caller' ? 'Call Center' : department)));
        let finalBusiness = (!isTopLevel) ? businessType : null;
        if (!isTopLevel && (!finalBusiness || String(finalBusiness).trim() === '') && req.user?.businessType) {
            finalBusiness = req.user.businessType;
        }

        // Force department to Social Media if role is Social Media Manager or Staff
        if (role === 'Social Media Manager' || role === 'Social Media Staff') {
            finalDepartment = 'Social Media';
        }

        const newStaff = await prisma.user.create({
            data: { firstName, lastName, phone, nic, password: hashedPassword, role, department: finalDepartment, businessType: finalBusiness }
        });

        res.status(201).json({ message: "Staff created successfully", staff: newStaff });
    } catch (error) { 
        console.error("Error creating staff:", error);
        res.status(500).json({ error: error.message || "Failed to create staff" }); 
    }
};

// 4. Update staff
exports.updateStaff = async (req, res) => {
    try {
        const { id } = req.params;
        let { firstName, lastName, phone, nic, password, role, department, businessType } = req.body;
        phone = normalizePhone(phone);
        
        const isTopLevel = checkIsTopLevel(role);

        let finalDepartment = isTopLevel ? (department || 'Administration') : ((role === 'Coordinator' || role === 'Paper Marker' ? 'Class Coordination' : (role === 'Caller' ? 'Call Center' : department)));
        
        if (role === 'Social Media Manager' || role === 'Social Media Staff') {
            finalDepartment = 'Social Media';
        }

        let updateData = { 
            firstName, lastName, phone, nic, role, 
            department: finalDepartment, 
            businessType: (!isTopLevel) ? businessType : null 
        };
        
        if (password && password.trim() !== '') {
            updateData.password = await bcrypt.hash(password, 10);
            updateData.session_id = crypto.randomBytes(16).toString('hex');
        }

        const updatedStaff = await prisma.user.update({
            where: { id: parseInt(id) }, data: updateData
        });

        res.status(200).json({ message: "Staff updated", staff: updatedStaff });
    } catch (error) { res.status(500).json({ error: "Failed to update staff" }); }
};

// 5. Delete staff
exports.deleteStaff = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.user.delete({ where: { id: parseInt(id) } });
        res.status(200).json({ message: "Staff deleted successfully" });
    } catch (error) { res.status(500).json({ error: "Failed to delete staff" }); }
};

// 8. Get Lumi Invoice Billing Data
exports.getLumiInvoiceData = async (req, res) => {
    try {
        const { startDate, endDate, month } = req.query;

        let start, end;
        if (month) {
            const [y, m] = month.split('-').map(Number);
            start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
            end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
        } else if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(new Date(endDate).setHours(23, 59, 59, 999));
        } else {
            const now = new Date();
            start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0));
            end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
        }

        const dateFilter = {
            createdAt: {
                gte: start,
                lte: end
            }
        };

        const businesses = await prisma.business.findMany({
            select: { id: true, name: true, logo: true }
        });

        // Group outbound completed calls by businessId and campaignType
        const callStats = await prisma.whatsAppCallRecord.groupBy({
            by: ['businessId', 'campaignType', 'direction', 'status'],
            where: {
                ...dateFilter,
                direction: { in: ['OUTBOUND', 'outbound'] },
                status: { in: ['COMPLETED', 'completed', 'ANSWERED', 'answered'] }
            },
            _count: { id: true },
            _sum: { duration: true }
        });

        const invoiceBusinesses = businesses.map(biz => {
            const bizCalls = callStats.filter(c => c.businessId === biz.id);

            const freeCalls = bizCalls.filter(c => c.campaignType === 'FREE_SEMINAR');
            const afterCalls = bizCalls.filter(c => c.campaignType === 'AFTER_SEMINAR');
            const otherCalls = bizCalls.filter(c => c.campaignType !== 'FREE_SEMINAR' && c.campaignType !== 'AFTER_SEMINAR');

            const freeCount = freeCalls.reduce((acc, curr) => acc + (curr._count?.id || 0), 0);
            const freeDurationSec = freeCalls.reduce((acc, curr) => acc + (curr._sum?.duration || 0), 0);
            const freeMinutes = Math.ceil(freeDurationSec / 60);

            const afterCount = afterCalls.reduce((acc, curr) => acc + (curr._count?.id || 0), 0);
            const afterDurationSec = afterCalls.reduce((acc, curr) => acc + (curr._sum?.duration || 0), 0);
            const afterMinutes = Math.ceil(afterDurationSec / 60);

            const otherCount = otherCalls.reduce((acc, curr) => acc + (curr._count?.id || 0), 0);
            const otherDurationSec = otherCalls.reduce((acc, curr) => acc + (curr._sum?.duration || 0), 0);
            const otherMinutes = Math.ceil(otherDurationSec / 60);

            return {
                id: biz.id,
                name: biz.name,
                logo: biz.logo,
                freeSeminar: {
                    active: true,
                    callCount: freeCount,
                    durationSeconds: freeDurationSec,
                    durationMinutes: freeMinutes,
                    fixedRental: 2500,
                    ratePerMinute: 5.0
                },
                afterSeminar: {
                    active: true,
                    callCount: afterCount + otherCount,
                    durationSeconds: afterDurationSec + otherDurationSec,
                    durationMinutes: afterMinutes + otherMinutes,
                    fixedRental: 2500,
                    ratePerMinute: 5.0
                }
            };
        });

        res.status(200).json({
            success: true,
            period: {
                start: start.toISOString(),
                end: end.toISOString()
            },
            rateConfig: {
                fixedRentalPerNumber: 2500,
                costPerMinute: 5.0
            },
            bankDetails: {
                accountNumber: "115452324957",
                bankName: "Sampath Bank",
                branch: "Aralaganwila Branch",
                accountName: "Chamindu Dilshan"
            },
            businesses: invoiceBusinesses
        });

    } catch (error) {
        console.error("Lumi Invoice Data Error:", error);
        res.status(500).json({ error: "Failed to generate Lumi invoice data" });
    }
};

exports.getLumiStats = async (req, res) => {
    try {
        const totalCalls = await prisma.whatsAppCallRecord.count();
        const activeAgents = await prisma.user.count({
            where: { agentStatus: 'ACTIVE', hasCallChannel: true }
        });
        res.status(200).json({ totalCalls, activeAgents });
    } catch (error) {
        console.error('Error fetching global Lumi stats:', error);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
};

exports.getLumiMissedCalls = async (req, res) => {
    try {
        const userId = req.user ? (req.user.id || req.user.userId) : null;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { startDate, endDate } = req.query;
        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter.createdAt = {
                gte: new Date(`${startDate}T00:00:00.000Z`),
                lte: new Date(`${endDate}T23:59:59.999Z`)
            };
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        let businessFilter = {};
        
        if (user) {
            const roleUpper = user.role ? String(user.role).toUpperCase().replace(/ /g, '_') : "";
            const isRestrictedRole = ['SYSTEM_ADMIN', 'DELIVERY', 'FINANCE'].some(r => roleUpper.includes(r));
            const isTopLevel = ['SYSTEM_ADMIN', 'HEAD_MANAGER', 'ASSISTANT_MANAGER'].some(r => roleUpper === r);
            
            if (!isTopLevel && !isRestrictedRole) {
                if (user.businessType && String(user.businessType).trim() !== 'ALL') {
                    const userBiz = await prisma.business.findFirst({
                        where: { name: String(user.businessType).trim() }
                    });
                    if (userBiz) {
                        businessFilter.businessId = userBiz.id;
                    }
                }
            }
        }

        const missedCalls = await prisma.whatsAppCallRecord.findMany({
            where: {
                status: 'MISSED',
                ...(Object.keys(dateFilter).length > 0 ? dateFilter : {}),
                ...(Object.keys(businessFilter).length > 0 ? businessFilter : {})
            },
            select: { 
                id: true, 
                createdAt: true, 
                leadPhone: true, 
                campaignType: true, 
                poolSnapshot: true,
                businessId: true
            },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json(missedCalls);
    } catch (error) {
        console.error('Error fetching missed calls:', error);
        res.status(500).json({ error: "Failed to fetch missed calls" });
    }
};

exports.allocateChannel = async (req, res) => {
    try {
        const { id } = req.params;
        const { extension } = req.body;
        if (!extension) return res.status(400).json({ error: "Extension is required" });

        const updatedStaff = await prisma.user.update({
            where: { id: Number(id) },
            data: {
                hasCallChannel: true,
                extension: String(extension)
            }
        });
        res.status(200).json(updatedStaff);
    } catch (error) {
        res.status(500).json({ error: "Failed to allocate channel" });
    }
};

exports.uploadProfilePicture = async (req, res) => {
    try {
        const userId = req.user ? (req.user.id || req.user.userId) : null;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        if (!req.file) {
            return res.status(400).json({ error: "No image file provided" });
        }
        // Save the relative path so frontend can use it (e.g. /storage/users/filename.jpg)
        const imageUrl = `/storage/users/${req.file.filename}`;
        const updatedUser = await prisma.user.update({
            where: { id: parseInt(userId) },
            data: { image: imageUrl }
        });
        res.status(200).json({ success: true, image: updatedUser.image });
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        res.status(500).json({ error: "Failed to upload profile picture" });
    }
};