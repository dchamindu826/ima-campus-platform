const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getScopedBusinessId = async (user, requestedBusinessId = null) => {
    if (!user) return null;
    
    const role = (user.role || '').toUpperCase().replace(/ /g, '_');
    const isTopLevel = role === 'SYSTEM_ADMIN' || role === 'DIRECTOR';
    
    if (isTopLevel) {
        if (requestedBusinessId && requestedBusinessId !== 'all' && requestedBusinessId !== 'null') {
            return Number(requestedBusinessId);
        }
        return null; // Top-level users can see everything
    }
    
    const userId = user.userId || user.id;
    const allBiz = await prisma.business.findMany();
    
    const userBizList = user.businessType ? String(user.businessType).split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
    
    const allowedBusinesses = allBiz.filter(biz => {
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

    if (allowedBusinesses.length === 0) return null;

    if (requestedBusinessId && requestedBusinessId !== 'all' && requestedBusinessId !== 'null') {
        const requested = allowedBusinesses.find(b => String(b.id) === String(requestedBusinessId));
        if (requested) return Number(requested.id);
    }

    if (requestedBusinessId === 'all') {
        return null;
    }

    return Number(allowedBusinesses[0].id);
};

module.exports = { getScopedBusinessId };
