const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const path = require('path');
const fs = require('fs');

// Helper: Format file size
const formatBytes = (bytes, decimals = 2) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// ==========================================
// 🌐 PUBLIC ENDPOINTS (FOR STUDENTS & PORTAL)
// ==========================================

// Get all active Categories
exports.getCategories = async (req, res) => {
    try {
        const categories = await prisma.libraryCategory.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            include: {
                _count: {
                    select: { resources: true, grades: true, streams: true, subjects: true }
                }
            }
        });
        return res.status(200).json({ success: true, categories });
    } catch (error) {
        console.error("Error fetching library categories:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch categories", error: error.message });
    }
};

// Get Grades (optionally filtered by category)
exports.getGrades = async (req, res) => {
    try {
        const { categoryId } = req.query;
        const where = { isActive: true };
        if (categoryId && categoryId !== 'ALL') {
            where.categoryId = parseInt(categoryId);
        }

        const grades = await prisma.libraryGrade.findMany({
            where,
            orderBy: [{ sortOrder: 'asc' }, { gradeNumber: 'asc' }],
            include: { category: true }
        });
        return res.status(200).json({ success: true, grades });
    } catch (error) {
        console.error("Error fetching library grades:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch grades", error: error.message });
    }
};

// Get Streams (optionally filtered by category)
exports.getStreams = async (req, res) => {
    try {
        const { categoryId } = req.query;
        const where = { isActive: true };
        if (categoryId && categoryId !== 'ALL') {
            where.categoryId = parseInt(categoryId);
        }

        const streams = await prisma.libraryStream.findMany({
            where,
            orderBy: { sortOrder: 'asc' },
            include: { category: true }
        });
        return res.status(200).json({ success: true, streams });
    } catch (error) {
        console.error("Error fetching library streams:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch streams", error: error.message });
    }
};

// Get Subjects (optionally filtered by stream, grade, category)
exports.getSubjects = async (req, res) => {
    try {
        const { streamId, gradeId, categoryId } = req.query;
        const where = { isActive: true };
        if (streamId && streamId !== 'ALL') where.streamId = parseInt(streamId);
        if (gradeId && gradeId !== 'ALL') where.gradeId = parseInt(gradeId);
        if (categoryId && categoryId !== 'ALL') where.categoryId = parseInt(categoryId);

        const subjects = await prisma.librarySubject.findMany({
            where,
            orderBy: { sortOrder: 'asc' },
            include: { stream: true, category: true, grade: true }
        });
        return res.status(200).json({ success: true, subjects });
    } catch (error) {
        console.error("Error fetching library subjects:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch subjects", error: error.message });
    }
};

// Search & Filter Resources (Public)
exports.getResources = async (req, res) => {
    try {
        const {
            search,
            categoryId,
            gradeId,
            streamId,
            subjectId,
            resourceType,
            year,
            medium,
            page = 1,
            limit = 24
        } = req.query;

        const where = { isPublished: true };

        if (categoryId && categoryId !== 'ALL') where.categoryId = parseInt(categoryId);
        if (gradeId && gradeId !== 'ALL') where.gradeId = parseInt(gradeId);
        if (streamId && streamId !== 'ALL') where.streamId = parseInt(streamId);
        if (subjectId && subjectId !== 'ALL') where.subjectId = parseInt(subjectId);
        if (resourceType && resourceType !== 'ALL') where.resourceType = resourceType;
        if (year && year !== 'ALL') where.year = year;
        if (medium && medium !== 'ALL') where.medium = medium;

        if (search && search.trim() !== '') {
            const query = search.trim();
            where.OR = [
                { title: { contains: query } },
                { description: { contains: query } },
                { tags: { contains: query } },
                { subject: { name: { contains: query } } },
                { stream: { name: { contains: query } } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const [total, resources] = await Promise.all([
            prisma.libraryResource.count({ where }),
            prisma.libraryResource.findMany({
                where,
                skip,
                take,
                orderBy: [
                    { isFeatured: 'desc' },
                    { createdAt: 'desc' }
                ],
                include: {
                    category: true,
                    grade: true,
                    stream: true,
                    subject: true
                }
            })
        ]);

        return res.status(200).json({
            success: true,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / take) || 1,
            resources
        });
    } catch (error) {
        console.error("Error fetching library resources:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch resources", error: error.message });
    }
};

// Get Single Resource details & increment view count
exports.getResourceById = async (req, res) => {
    try {
        const { id } = req.params;
        const resource = await prisma.libraryResource.update({
            where: { id: parseInt(id) },
            data: { viewCount: { increment: 1 } },
            include: {
                category: true,
                grade: true,
                stream: true,
                subject: true
            }
        });

        if (!resource) {
            return res.status(404).json({ success: false, message: "Resource not found" });
        }

        return res.status(200).json({ success: true, resource });
    } catch (error) {
        console.error("Error getting resource:", error);
        return res.status(500).json({ success: false, message: "Failed to get resource", error: error.message });
    }
};

// Track Download (increment downloadCount)
exports.trackDownload = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await prisma.libraryResource.update({
            where: { id: parseInt(id) },
            data: { downloadCount: { increment: 1 } },
            select: { id: true, downloadCount: true, fileUrl: true, fileName: true }
        });
        return res.status(200).json({ success: true, resource: updated });
    } catch (error) {
        console.error("Error tracking download:", error);
        return res.status(500).json({ success: false, message: "Failed to track download", error: error.message });
    }
};

// ==========================================
// 🏢 ADMIN & MANAGER MANAGEMENT ENDPOINTS
// ==========================================

// Get All Hierarchy Structure in one call
exports.getAdminStructure = async (req, res) => {
    try {
        const [categories, grades, streams, subjects] = await Promise.all([
            prisma.libraryCategory.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { resources: true } } } }),
            prisma.libraryGrade.findMany({ orderBy: [{ sortOrder: 'asc' }, { gradeNumber: 'asc' }], include: { category: true, _count: { select: { resources: true } } } }),
            prisma.libraryStream.findMany({ orderBy: { sortOrder: 'asc' }, include: { category: true, _count: { select: { resources: true } } } }),
            prisma.librarySubject.findMany({ orderBy: { sortOrder: 'asc' }, include: { category: true, stream: true, grade: true, _count: { select: { resources: true } } } })
        ]);

        return res.status(200).json({
            success: true,
            categories,
            grades,
            streams,
            subjects
        });
    } catch (error) {
        console.error("Error fetching admin library structure:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch structure", error: error.message });
    }
};

// Helper: Check Library Role Permissions
const checkLibraryPermissions = (user) => {
    const roleUpper = (user?.role || '').toUpperCase().replace(/[\s_-]+/g, '_');
    const isSystemAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER_ADMIN', 'ADMIN', 'SUPER'].includes(roleUpper) || roleUpper.includes('ADMIN') || roleUpper.includes('DIRECTOR') || roleUpper.includes('SUPER');
    const isManager = ['MANAGER', 'HEAD_MANAGER', 'ASS_MANAGER', 'ASSISTANT_MANAGER'].includes(roleUpper) || roleUpper.includes('MANAGER');
    const isCoordinator = ['COORDINATOR', 'STAFF', 'CLASS_COORDINATOR', 'CALLER'].includes(roleUpper) || user?.department === 'Class Coordination' || roleUpper.includes('COORDINATOR');
    const isStaffMember = isSystemAdmin || isManager || isCoordinator || Boolean(user?.department);

    return {
        isSystemAdmin,
        isManager,
        isCoordinator,
        canManageStructure: isSystemAdmin, // Only System Admin can add/edit/delete Category, Grade, Stream
        canManageSubjects: isSystemAdmin || isManager || isCoordinator || isStaffMember, // Coordinators, Managers, Admins can add & edit
        canDeleteSubject: isSystemAdmin || isManager || isCoordinator || isStaffMember, // Coordinators, Managers, Admins can delete subjects!
        canManageResources: isSystemAdmin || isManager || isCoordinator || isStaffMember, // Coordinators, Managers, Admins can upload & edit
        canDelete: isSystemAdmin // ONLY System Admin can delete Categories, Streams, Grades & Resources!
    };
};

// --- Category CRUD (System Admin Only) ---
exports.createCategory = async (req, res) => {
    try {
        const perms = checkLibraryPermissions(req.user);
        if (!perms.canManageStructure) {
            return res.status(403).json({ success: false, message: "Access Denied: Only System Administrators can create categories." });
        }

        const { name, code, description, sortOrder } = req.body;
        if (!name || !code) return res.status(400).json({ success: false, message: "Name and Code are required" });

        const created = await prisma.libraryCategory.create({
            data: {
                name,
                code: code.trim().toUpperCase(),
                description,
                sortOrder: sortOrder ? parseInt(sortOrder) : 0
            }
        });
        return res.status(201).json({ success: true, category: created });
    } catch (error) {
        console.error("Error creating category:", error);
        return res.status(500).json({ success: false, message: "Failed to create category", error: error.message });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const perms = checkLibraryPermissions(req.user);
        if (!perms.canManageStructure) {
            return res.status(403).json({ success: false, message: "Access Denied: Only System Administrators can update categories." });
        }

        const { id } = req.params;
        const { name, code, description, sortOrder, isActive } = req.body;
        const updated = await prisma.libraryCategory.update({
            where: { id: parseInt(id) },
            data: {
                ...(name && { name }),
                ...(code && { code: code.trim().toUpperCase() }),
                ...(description !== undefined && { description }),
                ...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder) }),
                ...(isActive !== undefined && { isActive: Boolean(isActive) })
            }
        });
        return res.status(200).json({ success: true, category: updated });
    } catch (error) {
        console.error("Error updating category:", error);
        return res.status(500).json({ success: false, message: "Failed to update category", error: error.message });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const perms = checkLibraryPermissions(req.user);
        if (!perms.canManageStructure) {
            return res.status(403).json({ success: false, message: "Access Denied: Only System Administrators can delete categories." });
        }

        const { id } = req.params;
        const catId = parseInt(id);
        await prisma.libraryGrade.updateMany({ where: { categoryId: catId }, data: { categoryId: null } });
        await prisma.libraryStream.updateMany({ where: { categoryId: catId }, data: { categoryId: null } });
        await prisma.librarySubject.updateMany({ where: { categoryId: catId }, data: { categoryId: null } });
        await prisma.libraryResource.updateMany({ where: { categoryId: catId }, data: { categoryId: null } });
        await prisma.libraryCategory.delete({ where: { id: catId } });
        return res.status(200).json({ success: true, message: "Category deleted successfully" });
    } catch (error) {
        console.error("Error deleting category:", error);
        return res.status(500).json({ success: false, message: "Failed to delete category", error: error.message });
    }
};

// --- Grade CRUD (System Admin Only) ---
exports.createGrade = async (req, res) => {
    try {
        const perms = checkLibraryPermissions(req.user);
        if (!perms.canManageStructure) {
            return res.status(403).json({ success: false, message: "Access Denied: Only System Administrators can create grades." });
        }

        const { name, gradeNumber, categoryId, sortOrder } = req.body;
        if (!name) return res.status(400).json({ success: false, message: "Grade name is required" });

        const created = await prisma.libraryGrade.create({
            data: {
                name,
                gradeNumber: gradeNumber ? parseInt(gradeNumber) : null,
                categoryId: categoryId ? parseInt(categoryId) : null,
                sortOrder: sortOrder ? parseInt(sortOrder) : 0
            },
            include: { category: true }
        });
        return res.status(201).json({ success: true, grade: created });
    } catch (error) {
        console.error("Error creating grade:", error);
        return res.status(500).json({ success: false, message: "Failed to create grade", error: error.message });
    }
};

exports.updateGrade = async (req, res) => {
    try {
        const perms = checkLibraryPermissions(req.user);
        if (!perms.canManageStructure) {
            return res.status(403).json({ success: false, message: "Access Denied: Only System Administrators can update grades." });
        }

        const { id } = req.params;
        const { name, gradeNumber, categoryId, sortOrder, isActive } = req.body;
        const updated = await prisma.libraryGrade.update({
            where: { id: parseInt(id) },
            data: {
                ...(name && { name }),
                ...(gradeNumber !== undefined && { gradeNumber: gradeNumber ? parseInt(gradeNumber) : null }),
                ...(categoryId !== undefined && { categoryId: categoryId ? parseInt(categoryId) : null }),
                ...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder) }),
                ...(isActive !== undefined && { isActive: Boolean(isActive) })
            },
            include: { category: true }
        });
        return res.status(200).json({ success: true, grade: updated });
    } catch (error) {
        console.error("Error updating grade:", error);
        return res.status(500).json({ success: false, message: "Failed to update grade", error: error.message });
    }
};

exports.deleteGrade = async (req, res) => {
    try {
        const perms = checkLibraryPermissions(req.user);
        if (!perms.canManageStructure) {
            return res.status(403).json({ success: false, message: "Access Denied: Only System Administrators can delete grades." });
        }

        const { id } = req.params;
        const gId = parseInt(id);
        await prisma.librarySubject.updateMany({ where: { gradeId: gId }, data: { gradeId: null } });
        await prisma.libraryResource.updateMany({ where: { gradeId: gId }, data: { gradeId: null } });
        await prisma.libraryGrade.delete({ where: { id: gId } });
        return res.status(200).json({ success: true, message: "Grade deleted successfully" });
    } catch (error) {
        console.error("Error deleting grade:", error);
        return res.status(500).json({ success: false, message: "Failed to delete grade", error: error.message });
    }
};

// --- Stream CRUD (System Admin Only) ---
exports.createStream = async (req, res) => {
    try {
        const perms = checkLibraryPermissions(req.user);
        if (!perms.canManageStructure) {
            return res.status(403).json({ success: false, message: "Access Denied: Only System Administrators can create streams." });
        }

        const { name, code, description, categoryId, sortOrder } = req.body;
        if (!name) return res.status(400).json({ success: false, message: "Stream name is required" });

        const created = await prisma.libraryStream.create({
            data: {
                name,
                code: code ? code.trim().toUpperCase() : null,
                description,
                categoryId: categoryId ? parseInt(categoryId) : null,
                sortOrder: sortOrder ? parseInt(sortOrder) : 0
            },
            include: { category: true }
        });
        return res.status(201).json({ success: true, stream: created });
    } catch (error) {
        console.error("Error creating stream:", error);
        return res.status(500).json({ success: false, message: "Failed to create stream", error: error.message });
    }
};

exports.updateStream = async (req, res) => {
    try {
        const perms = checkLibraryPermissions(req.user);
        if (!perms.canManageStructure) {
            return res.status(403).json({ success: false, message: "Access Denied: Only System Administrators can update streams." });
        }

        const { id } = req.params;
        const { name, code, description, categoryId, sortOrder, isActive } = req.body;
        const updated = await prisma.libraryStream.update({
            where: { id: parseInt(id) },
            data: {
                ...(name && { name }),
                ...(code !== undefined && { code: code ? code.trim().toUpperCase() : null }),
                ...(description !== undefined && { description }),
                ...(categoryId !== undefined && { categoryId: categoryId ? parseInt(categoryId) : null }),
                ...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder) }),
                ...(isActive !== undefined && { isActive: Boolean(isActive) })
            },
            include: { category: true }
        });
        return res.status(200).json({ success: true, stream: updated });
    } catch (error) {
        console.error("Error updating stream:", error);
        return res.status(500).json({ success: false, message: "Failed to update stream", error: error.message });
    }
};

exports.deleteStream = async (req, res) => {
    try {
        const perms = checkLibraryPermissions(req.user);
        if (!perms.canManageStructure) {
            return res.status(403).json({ success: false, message: "Access Denied: Only System Administrators can delete streams." });
        }

        const { id } = req.params;
        const stId = parseInt(id);
        await prisma.librarySubject.updateMany({ where: { streamId: stId }, data: { streamId: null } });
        await prisma.libraryResource.updateMany({ where: { streamId: stId }, data: { streamId: null } });
        await prisma.libraryStream.delete({ where: { id: stId } });
        return res.status(200).json({ success: true, message: "Stream deleted successfully" });
    } catch (error) {
        console.error("Error deleting stream:", error);
        return res.status(500).json({ success: false, message: "Failed to delete stream", error: error.message });
    }
};

// --- Subject CRUD (Coordinators, Managers & Admins can Create/Update, ONLY System Admin can Delete) ---
exports.createSubject = async (req, res) => {
    try {
        const perms = checkLibraryPermissions(req.user);
        if (!perms.canManageSubjects) {
            return res.status(403).json({ success: false, message: "Access Denied: You do not have permission to create subjects." });
        }

        const { name, code, categoryId, streamId, gradeId, sortOrder } = req.body;
        if (!name) return res.status(400).json({ success: false, message: "Subject name is required" });

        const created = await prisma.librarySubject.create({
            data: {
                name,
                code: code ? code.trim().toUpperCase() : null,
                categoryId: categoryId ? parseInt(categoryId) : null,
                streamId: streamId ? parseInt(streamId) : null,
                gradeId: gradeId ? parseInt(gradeId) : null,
                sortOrder: sortOrder ? parseInt(sortOrder) : 0
            },
            include: { category: true, stream: true, grade: true }
        });
        return res.status(201).json({ success: true, subject: created });
    } catch (error) {
        console.error("Error creating subject:", error);
        return res.status(500).json({ success: false, message: "Failed to create subject", error: error.message });
    }
};

exports.updateSubject = async (req, res) => {
    try {
        const perms = checkLibraryPermissions(req.user);
        if (!perms.canManageSubjects) {
            return res.status(403).json({ success: false, message: "Access Denied: You do not have permission to update subjects." });
        }

        const { id } = req.params;
        const { name, code, categoryId, streamId, gradeId, sortOrder, isActive } = req.body;
        const updated = await prisma.librarySubject.update({
            where: { id: parseInt(id) },
            data: {
                ...(name && { name }),
                ...(code !== undefined && { code: code ? code.trim().toUpperCase() : null }),
                ...(categoryId !== undefined && { categoryId: categoryId ? parseInt(categoryId) : null }),
                ...(streamId !== undefined && { streamId: streamId ? parseInt(streamId) : null }),
                ...(gradeId !== undefined && { gradeId: gradeId ? parseInt(gradeId) : null }),
                ...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder) }),
                ...(isActive !== undefined && { isActive: Boolean(isActive) })
            },
            include: { category: true, stream: true, grade: true }
        });
        return res.status(200).json({ success: true, subject: updated });
    } catch (error) {
        console.error("Error updating subject:", error);
        return res.status(500).json({ success: false, message: "Failed to update subject", error: error.message });
    }
};

exports.deleteSubject = async (req, res) => {
    try {
        const perms = checkLibraryPermissions(req.user);
        if (!perms.canDeleteSubject) {
            return res.status(403).json({ success: false, message: "Access Denied: You do not have permission to delete subjects." });
        }

        const { id } = req.params;
        const subId = parseInt(id);
        await prisma.libraryResource.updateMany({ where: { subjectId: subId }, data: { subjectId: null } });
        await prisma.librarySubject.delete({ where: { id: subId } });
        return res.status(200).json({ success: true, message: "Subject deleted successfully" });
    } catch (error) {
        console.error("Error deleting subject:", error);
        return res.status(500).json({ success: false, message: "Failed to delete subject", error: error.message });
    }
};

// --- Resource Upload & CRUD (Coordinators, Managers & Admins can Upload/Update, ONLY System Admin can Delete) ---
exports.uploadResource = async (req, res) => {
    try {
        const perms = checkLibraryPermissions(req.user);
        if (!perms.canManageResources) {
            return res.status(403).json({ success: false, message: "Access Denied: You do not have permission to upload resources." });
        }

        const files = req.files || {};
        const paperFile = files.paper ? files.paper[0] : (req.file ? req.file : null);
        const schemeFile = files.markingScheme ? files.markingScheme[0] : null;

        if (!paperFile) {
            return res.status(400).json({ success: false, message: "PDF paper file is required" });
        }

        const {
            title,
            description,
            resourceType = 'PAST_PAPER',
            year,
            term,
            medium = 'SINHALA',
            tags,
            categoryId,
            gradeId,
            streamId,
            subjectId,
            isFeatured = 'false',
            isPublished = 'true'
        } = req.body;

        if (!title || title.trim() === '') {
            return res.status(400).json({ success: false, message: "Title is required" });
        }

        // Search tags are strictly mandatory
        if (!tags || String(tags).trim() === '') {
            return res.status(400).json({ success: false, message: "Search tags are mandatory (Comma separated keywords)." });
        }

        const fileUrl = `/uploads/library/${paperFile.filename}`;
        const fileSize = formatBytes(paperFile.size);
        const markingSchemeUrl = schemeFile ? `/uploads/library/${schemeFile.filename}` : null;
        const hasMarkingScheme = Boolean(schemeFile) || req.body.hasMarkingScheme === 'true';

        const resource = await prisma.libraryResource.create({
            data: {
                title: title.trim(),
                description: description || null,
                fileUrl,
                fileName: paperFile.originalname,
                fileSize,
                fileType: 'PDF',
                resourceType,
                year: year || null,
                term: term || null,
                medium,
                hasMarkingScheme,
                markingSchemeUrl,
                tags: String(tags).trim(),
                isFeatured: isFeatured === 'true' || isFeatured === true,
                isPublished: isPublished === 'true' || isPublished === true,
                categoryId: categoryId ? parseInt(categoryId) : null,
                gradeId: gradeId ? parseInt(gradeId) : null,
                streamId: streamId ? parseInt(streamId) : null,
                subjectId: subjectId ? parseInt(subjectId) : null,
                createdById: req.user?.id || null
            },
            include: {
                category: true,
                grade: true,
                stream: true,
                subject: true
            }
        });

        return res.status(201).json({ success: true, message: "Resource uploaded successfully", resource });
    } catch (error) {
        console.error("Error uploading resource:", error);
        return res.status(500).json({ success: false, message: "Failed to upload resource", error: error.message });
    }
};

exports.updateResource = async (req, res) => {
    try {
        const perms = checkLibraryPermissions(req.user);
        if (!perms.canManageResources) {
            return res.status(403).json({ success: false, message: "Access Denied: You do not have permission to update resources." });
        }

        const { id } = req.params;
        const {
            title,
            description,
            resourceType,
            year,
            term,
            medium,
            tags,
            hasMarkingScheme,
            isFeatured,
            isPublished,
            categoryId,
            gradeId,
            streamId,
            subjectId
        } = req.body;

        if (tags !== undefined && (!tags || String(tags).trim() === '')) {
            return res.status(400).json({ success: false, message: "Search tags cannot be empty." });
        }

        const updated = await prisma.libraryResource.update({
            where: { id: parseInt(id) },
            data: {
                ...(title && { title: title.trim() }),
                ...(description !== undefined && { description }),
                ...(resourceType && { resourceType }),
                ...(year !== undefined && { year }),
                ...(term !== undefined && { term }),
                ...(medium && { medium }),
                ...(tags !== undefined && { tags: String(tags).trim() }),
                ...(hasMarkingScheme !== undefined && { hasMarkingScheme: Boolean(hasMarkingScheme) }),
                ...(isFeatured !== undefined && { isFeatured: Boolean(isFeatured) }),
                ...(isPublished !== undefined && { isPublished: Boolean(isPublished) }),
                ...(categoryId !== undefined && { categoryId: categoryId ? parseInt(categoryId) : null }),
                ...(gradeId !== undefined && { gradeId: gradeId ? parseInt(gradeId) : null }),
                ...(streamId !== undefined && { streamId: streamId ? parseInt(streamId) : null }),
                ...(subjectId !== undefined && { subjectId: subjectId ? parseInt(subjectId) : null })
            },
            include: {
                category: true,
                grade: true,
                stream: true,
                subject: true
            }
        });

        return res.status(200).json({ success: true, resource: updated });
    } catch (error) {
        console.error("Error updating resource:", error);
        return res.status(500).json({ success: false, message: "Failed to update resource", error: error.message });
    }
};

exports.deleteResource = async (req, res) => {
    try {
        const perms = checkLibraryPermissions(req.user);
        if (!perms.canDelete) {
            return res.status(403).json({ success: false, message: "Access Denied: Only System Administrators can delete resources from the vault." });
        }

        const { id } = req.params;
        const resource = await prisma.libraryResource.findUnique({ where: { id: parseInt(id) } });
        if (!resource) return res.status(404).json({ success: false, message: "Resource not found" });

        // Remove files from disk if exist
        if (resource.fileUrl) {
            const filePath = path.join(__dirname, '..', resource.fileUrl);
            if (fs.existsSync(filePath) && !filePath.includes('sample_paper.pdf')) {
                fs.unlinkSync(filePath);
            }
        }
        if (resource.markingSchemeUrl) {
            const schemePath = path.join(__dirname, '..', resource.markingSchemeUrl);
            if (fs.existsSync(schemePath) && !schemePath.includes('sample_paper.pdf')) {
                fs.unlinkSync(schemePath);
            }
        }

        await prisma.libraryResource.delete({ where: { id: parseInt(id) } });
        return res.status(200).json({ success: true, message: "Resource deleted successfully" });
    } catch (error) {
        console.error("Error deleting resource:", error);
        return res.status(500).json({ success: false, message: "Failed to delete resource", error: error.message });
    }
};

// Library Analytics
exports.getLibraryAnalytics = async (req, res) => {
    try {
        const [totalResources, totalDownloads, totalViews, topDownloads, typeBreakdown] = await Promise.all([
            prisma.libraryResource.count(),
            prisma.libraryResource.aggregate({ _sum: { downloadCount: true } }),
            prisma.libraryResource.aggregate({ _sum: { viewCount: true } }),
            prisma.libraryResource.findMany({
                take: 5,
                orderBy: { downloadCount: 'desc' },
                include: { subject: true, stream: true, category: true }
            }),
            prisma.libraryResource.groupBy({
                by: ['resourceType'],
                _count: { id: true }
            })
        ]);

        return res.status(200).json({
            success: true,
            analytics: {
                totalResources,
                totalDownloads: totalDownloads._sum.downloadCount || 0,
                totalViews: totalViews._sum.viewCount || 0,
                topDownloads,
                typeBreakdown
            }
        });
    } catch (error) {
        console.error("Error fetching library analytics:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch analytics", error: error.message });
    }
};
