const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const aiVerificationController = require('../controllers/aiVerificationController');

// Run every minute to check if current time matches any scheduled time
cron.schedule('* * * * *', async () => {
    try {
        const configSetting = await prisma.appSetting.findUnique({ where: { key: 'AI_SLIP_VERIFICATION_SCHEDULE' } });
        if (!configSetting || !configSetting.value) return;
        
        const scheduleConfig = JSON.parse(configSetting.value);
        const now = new Date();
        const currentHour = String(now.getHours()).padStart(2, '0');
        const currentMin = String(now.getMinutes()).padStart(2, '0');
        const currentTimeString = `${currentHour}:${currentMin}`;

        // Check mainQueue
        if (scheduleConfig.mainQueue && scheduleConfig.mainQueue.active) {
            if (scheduleConfig.mainQueue.times && scheduleConfig.mainQueue.times.includes(currentTimeString)) {
                console.log(`[AI-Scheduler] Triggering MAIN QUEUE bulk verification at ${currentTimeString}`);
                // Start bulk verification for all pending slips
                await aiVerificationController.startScheduledBulkVerification('mainQueue');
            }
        }

        // Check noMatch
        if (scheduleConfig.noMatch && scheduleConfig.noMatch.active) {
            if (scheduleConfig.noMatch.times && scheduleConfig.noMatch.times.includes(currentTimeString)) {
                console.log(`[AI-Scheduler] Triggering NO MATCH retry verification at ${currentTimeString}`);
                await aiVerificationController.startScheduledBulkVerification('noMatch');
            }
        }
    } catch (err) {
        console.error("Error in AI Schedule Cron:", err);
    }
});
