const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
    console.log("🌱 Checking and seeding initial 6 WhatsApp communities...");
    const existing = await prisma.whatsappRotator.count({
        where: { campaign: 'default' }
    });

    if (existing > 0) {
        console.log(`ℹ️ Already found ${existing} communities for default campaign. Skipping seed.`);
        const links = await prisma.whatsappRotator.findMany({
            where: { campaign: 'default' },
            orderBy: { orderIndex: 'asc' }
        });
        console.log("Current Communities:", links.map(l => ({ id: l.id, name: l.name, url: l.inviteUrl, active: l.isActive, clicks: l.clickCount })));
        return;
    }

    const defaultCommunities = [
        { name: "Community 01", inviteUrl: "https://chat.whatsapp.com/COMMUNITY_01_INVITE_CODE", orderIndex: 1, isActive: true, maxLimit: 1020 },
        { name: "Community 02", inviteUrl: "https://chat.whatsapp.com/COMMUNITY_02_INVITE_CODE", orderIndex: 2, isActive: true, maxLimit: 1020 },
        { name: "Community 03", inviteUrl: "https://chat.whatsapp.com/COMMUNITY_03_INVITE_CODE", orderIndex: 3, isActive: true, maxLimit: 1020 },
        { name: "Community 04", inviteUrl: "https://chat.whatsapp.com/COMMUNITY_04_INVITE_CODE", orderIndex: 4, isActive: true, maxLimit: 1020 },
        { name: "Community 05", inviteUrl: "https://chat.whatsapp.com/COMMUNITY_05_INVITE_CODE", orderIndex: 5, isActive: true, maxLimit: 1020 },
        { name: "Community 06", inviteUrl: "https://chat.whatsapp.com/COMMUNITY_06_INVITE_CODE", orderIndex: 6, isActive: true, maxLimit: 1020 }
    ];

    for (const c of defaultCommunities) {
        await prisma.whatsappRotator.create({
            data: {
                campaign: 'default',
                name: c.name,
                inviteUrl: c.inviteUrl,
                orderIndex: c.orderIndex,
                isActive: c.isActive,
                maxLimit: c.maxLimit,
                notes: "Initial seed community"
            }
        });
    }

    console.log("🎉 Successfully seeded 6 default WhatsApp communities!");
    await prisma.$disconnect();
}

seed();
