const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAllData = async (req, res) => {
    try {
        const { model } = req.params;
        // Pagination, Search & Filter parameters from Query String
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50; // Default 50 rows per page
        const search = req.query.search || '';
        const filterColumn = req.query.filterColumn || '';
        const filterValue = req.query.filterValue || '';

        const prismaModel = model.charAt(0).toLowerCase() + model.slice(1);

        if (!prisma[prismaModel]) {
            return res.status(400).json({ error: "Invalid Table Name" });
        }

        // 1. Get Model Fields (Columns) to apply Global Search dynamically
        // Because Prisma doesn't have a simple "search all columns" feature, 
        // we need to dynamically build the OR condition for string fields.
        const dmmfModel = Prisma.dmmf.datamodel.models.find(m => m.name.toLowerCase() === prismaModel.toLowerCase());
        const stringFields = dmmfModel ? dmmfModel.fields.filter(f => f.type === 'String').map(f => f.name) : [];

        // 2. Build Where Clause
        let whereClause = {};
        let AND_conditions = [];

        // Apply Global Search (OR across all string fields)
        if (search && stringFields.length > 0) {
            const searchConditions = stringFields.map(field => ({
                [field]: { contains: search }
            }));
            
            // Also try to match ID if search is a number
            if (!isNaN(search)) {
                searchConditions.push({ id: parseInt(search) });
            }
            
            AND_conditions.push({ OR: searchConditions });
        }

        // Apply Specific Column Filter (Contains OR Equals depending on type)
        if (filterColumn && filterValue) {
            const fieldDef = dmmfModel?.fields.find(f => f.name === filterColumn);
            
            if (fieldDef) {
                if (fieldDef.type === 'String') {
                    // String නම් 'contains' පාවිච්චි කරනවා
                    AND_conditions.push({
                        [filterColumn]: { contains: filterValue }
                    });
                } else if (fieldDef.type === 'Int' || fieldDef.type === 'BigInt' || fieldDef.type === 'Float') {
                    // Number එකක් නම් හරියටම සමානද බලනවා (equals)
                    if (!isNaN(filterValue)) {
                        AND_conditions.push({
                            [filterColumn]: fieldDef.type === 'Float' ? parseFloat(filterValue) : parseInt(filterValue)
                        });
                    }
                } else if (fieldDef.type === 'Boolean') {
                    const isTrue = filterValue.toLowerCase() === 'true' || filterValue === '1';
                    AND_conditions.push({
                        [filterColumn]: isTrue
                    });
                }
            }
        }

        if (AND_conditions.length > 0) {
            whereClause = { AND: AND_conditions };
        }

        // 3. Count total matching records for Pagination
        const totalRecords = await prisma[prismaModel].count({
            where: whereClause
        });

        // 4. Fetch the paginated data
        const data = await prisma[prismaModel].findMany({
            where: whereClause,
            orderBy: { id: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        });
        
        const totalPages = Math.ceil(totalRecords / limit);

        // Safely parse BigInt values
        const safeData = JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));
        
        res.status(200).json({
            data: safeData,
            meta: {
                totalRecords,
                totalPages,
                currentPage: page,
                limit
            }
        });
    } catch (error) {
        console.error("DB Fetch Error:", error);
        res.status(500).json({ error: "Failed to fetch data" });
    }
};

// Delete record from any table
exports.deleteRecord = async (req, res) => {
    try {
        const { model, id } = req.params;
        const prismaModel = model.charAt(0).toLowerCase() + model.slice(1);

        await prisma[prismaModel].delete({
            where: { id: parseInt(id) }
        });
        res.status(200).json({ message: "Record deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete record. May be linked to other data." });
    }
};

// Update record dynamically
exports.updateRecord = async (req, res) => {
    try {
        const { model, id } = req.params;
        const prismaModel = model.charAt(0).toLowerCase() + model.slice(1);
        const updateData = req.body;

        // Cleanup id from updateData if exists
        delete updateData.id;

        const updated = await prisma[prismaModel].update({
            where: { id: parseInt(id) },
            data: updateData
        });
        
        const safeData = JSON.parse(JSON.stringify(updated, (key, value) => typeof value === 'bigint' ? value.toString() : value));
        res.status(200).json(safeData);
    } catch (error) {
        res.status(500).json({ error: "Failed to update record" });
    }
};