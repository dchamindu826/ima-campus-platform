const cron = require('node-cron');
const jobs = require('../src/core/jobs'); // runs only in the jobs process (see src/core/jobs.js)
const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');
const admin = require('firebase-admin');

// Helper to parse time strings like "8:30 PM", "20:30", "08:30", "8.30 PM" into { hours, minutes }
function parseTimeComponents(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const clean = timeStr.trim().replace('.', ':');
    const match = clean.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return null;

    let hours = parseInt(match[1], 10);
    let minutes = parseInt(match[2], 10);
    const ampm = match[3]?.toUpperCase();

    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;

    return {
        hoursStr: hours.toString().padStart(2, '0'),
        minutesStr: minutes.toString().padStart(2, '0'),
        totalMinutes: hours * 60 + minutes
    };
}

// 15-minute live class reminder and Auto Delete Cron Job
// Runs every minute
jobs.schedule('live-class-reminders-and-cleanup', '* * * * *', async () => {
    try {
        const now = new Date();

        const liveClasses = await prisma.content.findMany({
            where: {
                contentType: { in: ['live', '1'] }
            }
        });

        for (const cls of liveClasses) {
            const targetDate = cls.date || cls.createdAt;
            if (!targetDate) continue;

            // Extract date in Asia/Colombo timezone to prevent UTC shift issues
            const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' });
            const dateStr = formatter.format(new Date(targetDate));

            // --- 1. 15-Minute Reminder Logic ---
            if (!cls.reminderSent && cls.startTime) {
                const startTimeParsed = parseTimeComponents(cls.startTime);
                if (startTimeParsed) {
                    const formattedStartTime = `${startTimeParsed.hoursStr}:${startTimeParsed.minutesStr}`;
                    const startDateTime = new Date(`${dateStr}T${formattedStartTime}:00+05:30`);
                    const diffMins = (startDateTime - now) / (1000 * 60);

                    // If class is within 15 minutes and hasn't started yet
                    if (diffMins > 0 && diffMins <= 15) {
                        try {
                            const contentCourses = await prisma.contentCourse.findMany({ where: { content_id: cls.id } });
                            
                            let targetTopics = [];
                            if (contentCourses.length > 0) {
                                targetTopics = contentCourses.map(cc => `course_${cc.course_id}`);
                            } else {
                                targetTopics = [`batch_${cls.batchId}`];
                            }
                            
                            for (const targetTopic of targetTopics) {
                                const message = {
                                    notification: {
                                        title: `🔴 Live Class Reminder!`,
                                        body: `${cls.title} will start in ${Math.round(diffMins)} minutes.`
                                    },
                                    data: {
                                        type: 'live_class',
                                        class_id: String(cls.id)
                                    },
                                    android: {
                                        priority: 'high'
                                    },
                                    apns: {
                                        payload: { aps: { 'content-available': 1, sound: 'default' } }
                                    },
                                    topic: targetTopic
                                };

                                try {
                                    await admin.messaging().send(message);
                                    console.log(`[CRON] 15-min reminder sent for Live Class ID: ${cls.id} to ${targetTopic}`);
                                } catch (e) {
                                    console.error(`[CRON] Push Error for topic ${targetTopic}:`, e.message);
                                }
                            }
                            
                            await prisma.content.update({
                                where: { id: cls.id },
                                data: { reminderSent: true }
                            });
                        } catch (e) {
                            console.error("[CRON] Reminder Logic Error:", e);
                        }
                    }
                }
            }

            // --- 2. Auto Delete Logic ---
            const autoDelHours = parseFloat(cls.autoDeleteHours);
            if (!isNaN(autoDelHours) && autoDelHours > 0) {
                let formattedEndTime = "23:59";
                const endParsed = parseTimeComponents(cls.endTime);

                if (endParsed) {
                    formattedEndTime = `${endParsed.hoursStr}:${endParsed.minutesStr}`;
                } else if (cls.startTime) {
                    const startParsed = parseTimeComponents(cls.startTime);
                    if (startParsed) {
                        // Fallback: 2 hours after start time
                        const endTotalMin = (startParsed.totalMinutes + 120) % (24 * 60);
                        const endH = Math.floor(endTotalMin / 60).toString().padStart(2, '0');
                        const endM = (endTotalMin % 60).toString().padStart(2, '0');
                        formattedEndTime = `${endH}:${endM}`;
                    }
                }

                const endDateTime = new Date(`${dateStr}T${formattedEndTime}:00+05:30`);
                // Calculate when it should be deleted
                const deleteTime = new Date(endDateTime.getTime() + autoDelHours * 60 * 60 * 1000);

                if (now >= deleteTime) {
                    console.log(`[CRON] Auto-deleting expired Live Class ID: ${cls.id} (${cls.title}) - Expired at: ${deleteTime.toISOString()}`);
                    try {
                        // 1. Unlink from any Tasks to prevent foreign key errors
                        await prisma.task.updateMany({ where: { contentId: cls.id }, data: { contentId: null } });
                        // 2. Delete Course mappings
                        await prisma.contentCourse.deleteMany({ where: { content_id: cls.id } });
                        // 3. Delete the Content
                        await prisma.content.delete({ where: { id: cls.id } });
                        console.log(`[CRON] Successfully auto-deleted Live Class ID: ${cls.id}`);
                    } catch (delError) {
                        console.error(`[CRON] Delete Error for Live Class ID ${cls.id}:`, delError);
                    }
                }
            }
        }
    } catch (error) {
        console.error("[CRON] Live Class Cron Error:", error);
    }
});

module.exports = {};
