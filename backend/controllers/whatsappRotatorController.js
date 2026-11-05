const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');

/**
 * Public Instant Redirect Route
 * Handles both:
 *   GET /join               (default campaign)
 *   GET /join/:campaign     (specific campaign e.g. /join/commerce)
 * 
 * Strict No-Cache headers ensure that mobile Safari & Chrome never cache
 * the 307 redirect, allowing instant switching between communities.
 */
exports.redirectJoin = async (req, res) => {
    try {
        const campaign = (req.params.campaign || req.query.c || 'default').toLowerCase().trim();

        // 1. Mandatory HTTP Headers to prevent mobile browser & proxy caching
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');

        // 2. Query all active communities for this campaign in priority order
        const activeLinks = await prisma.whatsappRotator.findMany({
            where: {
                campaign: campaign,
                isActive: true
            },
            orderBy: [
                { orderIndex: 'asc' },
                { id: 'asc' }
            ]
        });

        if (!activeLinks || activeLinks.length === 0) {
            // Check if there are any links for this campaign at all
            const anyLink = await prisma.whatsappRotator.findFirst({
                where: { campaign: campaign },
                orderBy: { orderIndex: 'asc' }
            });

            if (anyLink && anyLink.inviteUrl) {
                // Fallback to the first existing link if all were deactivated
                return res.redirect(307, anyLink.inviteUrl);
            }

            return res.status(404).send(`
                <!DOCTYPE html>
                <html lang="si">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>WhatsApp Community - IMA Campus</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; text-align: center; padding: 20px; }
                        .card { max-width: 420px; background: #1e293b; border-radius: 16px; padding: 32px 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
                        h2 { margin-bottom: 12px; color: #22c55e; }
                        p { color: #94a3b8; font-size: 15px; line-height: 1.6; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h2>IMA Campus WhatsApp</h2>
                        <p>දැනට මෙම WhatsApp Community එකේ ලින්ක්ස් යාවත්කාලීන වෙමින් පවතී. කරුණාකර සුළු මොහොතකින් නැවත උත්සාහ කරන්න.</p>
                        <p style="margin-top:20px; font-size: 13px; color: #64748b;">WhatsApp Community links are currently being updated.</p>
                    </div>
                </body>
                </html>
            `);
        }

        // 3. Find the target community (Auto-Switch if maxLimit is reached)
        // A link is eligible if maxLimit <= 0 (unlimited) OR clickCount < maxLimit
        let target = activeLinks.find(link => link.maxLimit <= 0 || link.clickCount < link.maxLimit);

        // If all active links reached their maxLimit, pick the last active link or the one with lowest clicks
        if (!target) {
            target = activeLinks[activeLinks.length - 1];
        }

        // 4. Asynchronously increment click count (does not delay redirect)
        prisma.whatsappRotator.update({
            where: { id: target.id },
            data: { clickCount: { increment: 1 } }
        }).catch(err => console.error("⚠️ [WhatsApp Rotator] Failed to increment click count:", err.message));

        // 5. Instant HTTP 307 Redirect (Direct into WhatsApp App)
        return res.redirect(307, target.inviteUrl);

    } catch (error) {
        console.error("❌ [WhatsApp Rotator] Redirect error:", error);
        return res.status(500).send("තාක්ෂණික දෝෂයකි. කරුණාකර පසුව උත්සාහ කරන්න.");
    }
};

/**
 * Admin: Get all rotator links
 * GET /api/admin/whatsapp-rotator?campaign=default
 */
exports.getAllLinks = async (req, res) => {
    try {
        const { campaign } = req.query;
        const whereClause = {};
        if (campaign) {
            whereClause.campaign = campaign.toLowerCase().trim();
        }

        const links = await prisma.whatsappRotator.findMany({
            where: whereClause,
            orderBy: [
                { campaign: 'asc' },
                { orderIndex: 'asc' },
                { id: 'asc' }
            ]
        });

        // Summary counts
        const totalClicks = links.reduce((sum, l) => sum + (l.clickCount || 0), 0);
        const activeCount = links.filter(l => l.isActive).length;

        return res.status(200).json({
            success: true,
            totalLinks: links.length,
            activeCount,
            totalClicks,
            links
        });
    } catch (error) {
        console.error("❌ [WhatsApp Rotator] Admin get links error:", error);
        return res.status(500).json({ success: false, error: "Failed to fetch rotator links" });
    }
};

/**
 * Admin: Create a new link
 * POST /api/admin/whatsapp-rotator
 */
exports.createLink = async (req, res) => {
    try {
        const { name, inviteUrl, campaign = 'default', maxLimit = 1020, isActive = true, orderIndex = 1, notes } = req.body;

        if (!name || !inviteUrl) {
            return res.status(400).json({ success: false, error: "Name and inviteUrl are required." });
        }

        const link = await prisma.whatsappRotator.create({
            data: {
                name: name.trim(),
                inviteUrl: inviteUrl.trim(),
                campaign: campaign.toLowerCase().trim(),
                maxLimit: parseInt(maxLimit, 10) || 1020,
                isActive: Boolean(isActive),
                orderIndex: parseInt(orderIndex, 10) || 1,
                notes: notes ? notes.trim() : null
            }
        });

        return res.status(201).json({ success: true, message: "Community link created successfully", link });
    } catch (error) {
        console.error("❌ [WhatsApp Rotator] Admin create link error:", error);
        return res.status(500).json({ success: false, error: "Failed to create rotator link" });
    }
};

/**
 * Admin: Update link details / toggle active status / reset count
 * PUT /api/admin/whatsapp-rotator/:id
 */
exports.updateLink = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ success: false, error: "Invalid link ID" });
        }

        const { name, inviteUrl, campaign, maxLimit, isActive, orderIndex, clickCount, notes } = req.body;

        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (inviteUrl !== undefined) updateData.inviteUrl = inviteUrl.trim();
        if (campaign !== undefined) updateData.campaign = campaign.toLowerCase().trim();
        if (maxLimit !== undefined) updateData.maxLimit = parseInt(maxLimit, 10);
        if (isActive !== undefined) updateData.isActive = Boolean(isActive);
        if (orderIndex !== undefined) updateData.orderIndex = parseInt(orderIndex, 10);
        if (clickCount !== undefined) updateData.clickCount = parseInt(clickCount, 10);
        if (notes !== undefined) updateData.notes = notes ? notes.trim() : null;

        const updated = await prisma.whatsappRotator.update({
            where: { id },
            data: updateData
        });

        return res.status(200).json({ success: true, message: "Link updated successfully", link: updated });
    } catch (error) {
        console.error("❌ [WhatsApp Rotator] Admin update link error:", error);
        return res.status(500).json({ success: false, error: "Failed to update rotator link" });
    }
};

/**
 * Admin: Delete a link
 * DELETE /api/admin/whatsapp-rotator/:id
 */
exports.deleteLink = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ success: false, error: "Invalid link ID" });
        }

        await prisma.whatsappRotator.delete({
            where: { id }
        });

        return res.status(200).json({ success: true, message: "Link deleted successfully" });
    } catch (error) {
        console.error("❌ [WhatsApp Rotator] Admin delete link error:", error);
        return res.status(500).json({ success: false, error: "Failed to delete rotator link" });
    }
};

/**
 * Admin: Seed initial 6 community links for a campaign
 * POST /api/admin/whatsapp-rotator/seed
 */
exports.seedCommunities = async (req, res) => {
    try {
        const { campaign = 'default', links } = req.body;
        const targetCampaign = campaign.toLowerCase().trim();

        // If custom links array provided: [{ name, inviteUrl, maxLimit }]
        if (Array.isArray(links) && links.length > 0) {
            const created = [];
            for (let i = 0; i < links.length; i++) {
                const item = links[i];
                const c = await prisma.whatsappRotator.create({
                    data: {
                        campaign: targetCampaign,
                        name: item.name || `Community ${String(i + 1).padStart(2, '0')}`,
                        inviteUrl: item.inviteUrl || `https://chat.whatsapp.com/mock-community-${i + 1}`,
                        maxLimit: item.maxLimit ? parseInt(item.maxLimit, 10) : 1020,
                        isActive: item.isActive !== undefined ? Boolean(item.isActive) : (i === 0), // Default 1st active
                        orderIndex: item.orderIndex !== undefined ? parseInt(item.orderIndex, 10) : (i + 1),
                        notes: item.notes || null
                    }
                });
                created.push(c);
            }
            return res.status(201).json({ success: true, message: `Seeded ${created.length} communities`, communities: created });
        }

        // Default 6 placeholder communities if no custom links sent
        const defaultSeeds = [
            { name: "Community 01", inviteUrl: "https://chat.whatsapp.com/invite-link-1", orderIndex: 1, isActive: true },
            { name: "Community 02", inviteUrl: "https://chat.whatsapp.com/invite-link-2", orderIndex: 2, isActive: true },
            { name: "Community 03", inviteUrl: "https://chat.whatsapp.com/invite-link-3", orderIndex: 3, isActive: true },
            { name: "Community 04", inviteUrl: "https://chat.whatsapp.com/invite-link-4", orderIndex: 4, isActive: true },
            { name: "Community 05", inviteUrl: "https://chat.whatsapp.com/invite-link-5", orderIndex: 5, isActive: true },
            { name: "Community 06", inviteUrl: "https://chat.whatsapp.com/invite-link-6", orderIndex: 6, isActive: true }
        ];

        const created = [];
        for (const seed of defaultSeeds) {
            const c = await prisma.whatsappRotator.create({
                data: {
                    campaign: targetCampaign,
                    name: seed.name,
                    inviteUrl: seed.inviteUrl,
                    maxLimit: 1020,
                    isActive: seed.isActive,
                    orderIndex: seed.orderIndex,
                    notes: "Initial seed community"
                }
            });
            created.push(c);
        }

        return res.status(201).json({ success: true, message: "Default 6 communities created successfully", communities: created });

    } catch (error) {
        console.error("❌ [WhatsApp Rotator] Admin seed error:", error);
        return res.status(500).json({ success: false, error: "Failed to seed communities" });
    }
};
