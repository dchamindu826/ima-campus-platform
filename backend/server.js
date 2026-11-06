const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const admin = require("firebase-admin"); // 🔥 Firebase Admin Import

dotenv.config();
const app = express();

app.use('/api/courier-proxy', createProxyMiddleware({
    target: 'https://www.fdedomestic.com',
    changeOrigin: true,
    pathRewrite: {
        '^/api/courier-proxy': '', // URL එකෙන් මේ කෑල්ල කපලා යවනවා
    },
    onProxyRes: function (proxyRes, req, res) {
        // මේ Headers මකන නිසා දැන් Browser එකට Iframe එක ඇතුලේ මේක ලෝඩ් කරන්න පුළුවන්!
        delete proxyRes.headers['x-frame-options'];
        delete proxyRes.headers['content-security-policy'];

        // Cookie අවුල් යන්නැති වෙන්න SameSite එක හදනවා
        if (proxyRes.headers['set-cookie']) {
            proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map(c =>
                c.replace(/SameSite=Lax/g, 'SameSite=None; Secure')
            );
        }
    }
}));

// ================= FIREBASE INITIALIZATION =================
// Firebase Console eken gaththa Service Account JSON file eka
// backend folder eke 'serviceAccountKey.json' kiyala save karala thiyenna ona.
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// ================= MIDDLEWARES =================

const isAllowedOrigin = (origin) => {
    if (!origin) return true; // Mobile apps, Native clients, server-to-server have no Origin header
    try {
        const parsed = new URL(origin);
        const host = parsed.hostname;
        if (
            host === 'imacampus.online' ||
            host.endsWith('.imacampus.online') ||
            host === 'localhost' ||
            host === '127.0.0.1' ||
            host === '72.62.249.211' ||
            host.startsWith('192.168.') ||
            host.startsWith('10.') ||
            host.startsWith('172.')
        ) {
            return true;
        }
        if (origin.startsWith('chrome-extension://')) return true;
    } catch (e) {
        return false;
    }
    return false;
};

const corsOptions = {
    origin: function (origin, callback) {
        if (isAllowedOrigin(origin)) {
            callback(null, true);
        } else {
            callback(null, false);
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'Cache-Control', 'Pragma', 'Expires'],
    credentials: true
};

app.use(cors(corsOptions));

// Preflight OPTIONS handler
app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        const origin = req.headers.origin;
        if (isAllowedOrigin(origin)) {
            res.header('Access-Control-Allow-Origin', origin);
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, Expires');
            res.header('Access-Control-Allow-Credentials', 'true');
            return res.status(200).end();
        } else {
            return res.status(403).end();
        }
    }
    next();
});

// 🔥 API CACHE DISABLE MIDDLEWARE (Forces Mobile App to refresh data)
app.use((req, res, next) => {
    // Prevent caching for all API routes except storage and documents
    if (req.originalUrl.startsWith('/api/') && !req.originalUrl.startsWith('/api/storage') && !req.originalUrl.startsWith('/api/documents')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
    }
    next();
});

app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ limit: '150mb', extended: true }));

const coordinatorCrmRoutes = require('./routes/coordinatorCrmRoutes');
const afterSeminarCrmRoutes = require('./routes/afterSeminarCrmRoutes');
const teamRoutes = require('./routes/teamRoutes');

// ================= STATIC FOLDERS =================
// Kalin thibuna routes (meka mehema thiyenna arinna wena ewata one wenna puluwan)
app.use('/documents', express.static(path.join(__dirname, 'documents')));
app.use('/api/documents', express.static(path.join(__dirname, 'documents')));
const fs = require('fs');

const serveDocumentWithFallback = (req, res, next) => {
    const filePath = req.path;
    const docPath = path.join(__dirname, 'storage/documents', filePath);
    if (fs.existsSync(docPath)) return res.sendFile(docPath);
    const iconPath = path.join(__dirname, 'storage/icons', filePath);
    if (fs.existsSync(iconPath)) return res.sendFile(iconPath);
    const postPath = path.join(__dirname, 'storage/posts', filePath);
    if (fs.existsSync(postPath)) return res.sendFile(postPath);
    const imgPath = path.join(__dirname, 'storage/images', filePath);
    if (fs.existsSync(imgPath)) return res.sendFile(imgPath);
    next();
};

app.use('/storage/documents', serveDocumentWithFallback, express.static(path.join(__dirname, 'storage/documents')));
app.use('/api/storage/documents', serveDocumentWithFallback, express.static(path.join(__dirname, 'storage/documents')));
app.use('/storage/tutes', serveDocumentWithFallback, express.static(path.join(__dirname, 'storage/documents')));
app.use('/api/storage/tutes', serveDocumentWithFallback, express.static(path.join(__dirname, 'storage/documents')));
app.use('/storage/icons', express.static(path.join(__dirname, 'storage/icons')));
app.use('/storage/posts', express.static(path.join(__dirname, 'storage/posts')));
app.use('/storage/images', express.static(path.join(__dirname, 'storage/images')));
app.use('/api/storage/images', express.static(path.join(__dirname, 'storage/images')));
app.use('/api/storage/icons', express.static(path.join(__dirname, 'storage/icons')));
app.use('/api/storage/posts', express.static(path.join(__dirname, 'storage/posts')));
app.use('/storage/ringtone', express.static(path.join(__dirname, '../storage/ringtone')));
app.use('/api/storage/ringtone', express.static(path.join(__dirname, '../storage/ringtone')));
app.use('/storage/users', express.static(path.join(__dirname, 'storage/users')));
app.use('/api/storage/users', express.static(path.join(__dirname, 'storage/users')));
app.use('/storage/users', express.static(path.join(__dirname, '../storage/users')));
app.use('/api/storage/users', express.static(path.join(__dirname, '../storage/users')));
// Call recordings are private: staff token required (header or ?token=).
const { requireStaffLink } = require('./src/core/linkAuth');
app.use('/storage/recordings', requireStaffLink, express.static(path.join(__dirname, '../storage/recordings')));
app.use('/api/storage/recordings', requireStaffLink, express.static(path.join(__dirname, '../storage/recordings')));

// 🔥 IMA Pusthakalaya (Library) Static Uploads
app.use('/uploads/library', express.static(path.join(__dirname, 'uploads/library')));
app.use('/api/uploads/library', express.static(path.join(__dirname, 'uploads/library')));

// 🔥 Petty Cash Receipts Static Uploads
app.use('/storage/petty_cash', express.static(path.join(__dirname, 'storage/petty_cash')));
app.use('/api/storage/petty_cash', express.static(path.join(__dirname, 'storage/petty_cash')));

// WhatsApp call recordings: staff only (the <audio> tag passes ?token=).
app.get('/api/public/whatsapp-recording/:filename', requireStaffLink, require('./controllers/whatsappCallController').getRecording);

// 🔥 SMART WHATSAPP ROTATOR & INSTANT QR REDIRECT 🔥
// ================= STAFF GATE (see src/core/staffGate.js) =================
// Staff-only APIs need a logged-in NON-student account. Must stay above all routes.
app.use(require('./src/core/staffGate').staffGate());

app.use(require('./routes/whatsappRotatorRoutes'));

// ================= GLOBAL AUDIT TRAIL =================
const auditMiddleware = require('./middlewares/auditMiddleware');
app.use(auditMiddleware);

// ================= NEW MODULAR API (see ARCHITECTURE.md) =================
app.use('/api/v2', require('./src/v2'));

// ================= ROUTES =================
app.use('/api/library', require('./routes/libraryRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/student', require('./routes/studentRoutes'));
app.use('/api/web-inquiry', require('./routes/webInquiryRoutes'));
app.use('/api/papers', require('./routes/paperRoutes'));
app.use('/api', require('./routes/contentRoutes'));
// DEBUG: Moved up here
app.use('/api/admin/data-export', require('./routes/dataExportRoutes'));
app.use('/api/admin', require('./routes/timetableRoutes'));
app.use('/api/admin', require('./routes/taskRoutes'));
app.use('/api', require('./routes/businessRoutes'));
app.use('/api', require('./routes/tuteStockRoutes'));
app.use('/api/public', require('./routes/publicRoutes'));
app.use('/api/admin/payments', require('./routes/paymentRoutes'));
app.use('/api/admin/teacher-salary', require('./routes/teacherSalaryRoutes'));
app.use('/api/admin/delivery', require('./routes/deliveryRoutes'));
app.use('/api/delivery', require('./routes/deliveryRoutes'));
app.use('/api/admin/staff', require('./routes/staffRoutes'));
app.use('/api/admin/crm', require('./routes/crmRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/reminders', require('./routes/reminderRoutes'));
app.use('/api/system-tasks', require('./routes/systemTaskRoutes'));
app.use('/api/upgrade-pricing', require('./routes/upgradePricingRoutes'));
app.use('/api/zoom-accounts', require('./routes/zoomAccountRoutes'));
app.use('/api/technical', require('./routes/technicalRoutes'));
app.use('/api/notes', require('./routes/noteRoutes'));
app.use('/api/admin/whatsapp-call', require('./routes/whatsappCallRoutes'));
app.use('/api/admin/call-campaign-audit', require('./routes/callCampaignAuditRoutes'));
app.use('/api/admin/whatsapp-billing', require('./routes/whatsappBillingRoutes'));


// 🔥 NEW: Add Data Export Route here 🔥
// app.use('/api/admin/data-export', require('./routes/dataExportRoutes')); // Mekath hadanna ona

const physicalStudentRoutes = require('./routes/physicalStudentRoutes');
app.use('/api/physical-students', physicalStudentRoutes);
app.use('/api/physical-crm', require('./routes/physicalCrmRoutes'));
app.use('/api/physical-finance', require('./routes/physicalFinanceRoutes'));

app.use('/api/coordinator-crm', coordinatorCrmRoutes);
app.use('/api/after-seminar-crm', afterSeminarCrmRoutes);
app.use('/api/missed-call-tasks', require('./routes/missedCallTaskRoutes'));
app.use('/api/team', teamRoutes);

// 🔥🔥🔥 MOBILE APP ROUTES 🔥🔥🔥
app.use('/api/mobile', require('./routes/mobile/mobileRoutes'));
app.use('/api/mobile/chat', require('./routes/mobile/chatRoutes'));

// AI Verification
app.use('/api/ai-verification', require('./routes/aiVerificationRoutes'));

// AI Database Agent
app.use('/api/admin/ai-agent', require('./routes/aiAgentRoutes'));
app.use('/api/claude', require('./routes/claudeRoutes'));
app.use('/api/youtube-transcribe', require('./routes/youtubeTranscribeRoutes'));
app.use('/api/ai-team', require('./routes/aiTeamRoutes'));
app.use('/api/admin/test-injector', require('./routes/testRoutes'));
app.use('/api/social-media', require('./routes/socialMediaRoutes'));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/uploads/social-media', express.static(path.join(__dirname, 'public/uploads/social-media')));
app.use('/api/uploads/social-media', express.static(path.join(__dirname, 'public/uploads/social-media')));

const rosterRoutes = require('./routes/rosterRoutes');
app.use('/api/roster', rosterRoutes);

const callCenterRoutes = require('./routes/callCenterRoutes');
app.use('/api/call-center', callCenterRoutes);
const callCenterAgentRoutes = require('./routes/callCenterAgentRoutes');
app.use('/api/call-center/agent-v2', callCenterAgentRoutes);

// 🔥 PETTY CASH MANAGEMENT SYSTEM 🔥
app.use('/api/petty-cash', require('./routes/pettyCashRoutes'));

// ================= DELIVERY MODULE ROUTES (NEW) =================


// 🔥 පැය 10න් Auto Update වෙන Cron Job එක Run වෙන්න Controller එක Load කරනවා 🔥
require('./controllers/deliveryController');
// 🔥 AUTO BACKUP SERVICE (CRON JOB) 🔥
require('./services/backupService');
// Delivery reconciliation (daily, worker only) — src/modules/delivery
require('./src/modules/delivery/jobs');
require('./src/modules/crm/jobs');

// 🔥 GOOGLE SHEETS CACHE ENGINE 🔥
const { initCacheJob } = require('./utils/gsheetCache');
// The sheet cache is read by API requests, so it lives in the process that serves HTTP.
if (require('./src/core/jobs').serverEnabled()) initCacheJob();

// ================= SERVER START =================
const http = require('http');
const server = http.createServer(app);

// Increase timeouts for long-running AI transcription & video processing uploads
server.timeout = 300000; // 5 minutes
server.headersTimeout = 305000; // 5 minutes + 5s
server.keepAliveTimeout = 65000;

// IMA_ROLE=worker runs background jobs only: no port, no sockets (see src/core/jobs.js)
const PORT = process.env.PORT || 5000;
if (require('./src/core/jobs').serverEnabled()) {
    // Initialize Socket.io Chat
    const { initSocket } = require('./controllers/chatController');
    initSocket(server);

    server.listen(PORT, () => {
        console.log(`🚀 Backend Server is running cleanly on port ${PORT}`);
    });
} else {
    console.log('🛠️  Worker mode: background jobs only, no HTTP port opened');
}
// Log which jobs this process runs, once every module has registered its jobs.
setImmediate(() => console.log(`[jobs] ${require('./src/core/jobs').summary()}`));


// ==========================================================
// 🔥 DAILY AUTO ASSIGN QUOTA RESET (CRON JOB) 🔥
// ==========================================================
// හැමදාම පාන්දර 12:00 ට Auto Assign එකට අදාලව දීපු ගාන (assigned count) 0 කරනවා
const cron = require('node-cron');
const jobs = require('./src/core/jobs'); // runs only in the jobs process (see src/core/jobs.js)
require('./services/liveClassCronService');
const { PrismaClient } = require('@prisma/client');
const prismaTaskGen = require('./src/core/db');
const { generateYoutubeCookies } = require('./utils/youtubeCookieManager');

// Run cookie generator at midnight every day
jobs.schedule('youtube-cookie-generator', '0 0 * * *', async () => {
    console.log("⏰ Running Daily YouTube Cookie Generator...");
    await generateYoutubeCookies();
});

jobs.schedule('auto-assign-quota-reset', '0 0 * * *', async () => {
    console.log("⏰ Running Daily Auto Assign Quota Reset...");
    try {
        const result = await prismaTaskGen.autoAssignQuota.updateMany({
            data: { assigned: 0 }
        });
        console.log(`🎉 Successfully reset quotas for ${result.count} staff members!`);
    } catch (error) {
        console.error("❌ Error in Auto Assign Quota Reset:", error);
    }
});


// ==========================================================
// 🔥 DAILY CUSTOM TASK GENERATOR (CRON JOB) 🔥
// ==========================================================


// හැමදාම පාන්දර 12:05 ට මේක Auto Run වෙනවා ('5 0 * * *')
jobs.schedule('daily-custom-task-generator', '5 0 * * *', async () => {
    console.log("⏰ Running Daily Custom Task Generator...");
    try {
        // SLT වෙලාව හදාගන්නවා
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Colombo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });

        const datePrefix = formatter.format(now); // Auto enawa "2026-05-15" wage
        const todayDay = parseInt(datePrefix.split('-')[2], 10);

        // 1. අද දවසට අදාල Templates ටික හොයනවා (DAILY ඒවා සහ අද Date එකට සෙට් වෙන ඒවා)
        const templates = await prismaTaskGen.customTaskTemplate.findMany({
            where: {
                OR: [
                    { allocationType: 'DAILY' },
                    { dayOfMonth: todayDay }
                ]
            }
        });

        if (templates.length === 0) {
            console.log("✅ No custom tasks scheduled for today.");
            return;
        }

        let createdCount = 0;

        // 2. ඒ Templates ටිකෙන් අදට අදාල Tasks හදනවා
        // 2. ඒ Templates ටිකෙන් අදට අදාල Tasks හදනවා
        for (const t of templates) {
            // 🔥 ME KALLA ADD KARANNA (Time eke length eka 5k karanawa e.g., 9:30 -> 09:30)
            const safeMainEndTime = t.endTime.length === 5 ? t.endTime : `0${t.endTime}`.slice(-5);
            let deadline = new Date(`${datePrefix}T${safeMainEndTime}:00+05:30`);
            
            if (isNaN(deadline.getTime())) {
                deadline = new Date();
            }

            // Main Task එක හදනවා
            const mainTask = await prismaTaskGen.task.create({
                data: {
                    businessId: t.businessId,
                    taskType: "CUSTOM",
                    customTitle: t.title,
                    customDesc: t.description,
                    assignedTo: t.autoAssignTo || null,
                    status: t.autoAssignTo ? "IN_PROGRESS" : "PENDING",
                    deadline: deadline
                }
            });

            // 3. Sub-Tasks (Checklist Items) තියෙනවද බලලා ඒවා හදනවා
            if (t.subTasks) {
                const subTasksArray = typeof t.subTasks === 'string' ? JSON.parse(t.subTasks) : t.subTasks;

                if (Array.isArray(subTasksArray) && subTasksArray.length > 0) {
                    const subsData = subTasksArray.map(sub => {
                        // 🔥 Sub task eketath time format eka hadanawa
                        const safeSubEndTime = sub.endTime.length === 5 ? sub.endTime : `0${sub.endTime}`.slice(-5);
                        return {
                            businessId: t.businessId,
                            taskType: "CUSTOM",
                            customTitle: sub.title,
                            parentId: mainTask.id,
                            deadline: new Date(`${datePrefix}T${safeSubEndTime}:00+05:30`),
                            assignedTo: t.autoAssignTo || null,
                            status: t.autoAssignTo ? "IN_PROGRESS" : "PENDING"
                        };
                    });
                    await prismaTaskGen.task.createMany({ data: subsData });
                }
            }
            createdCount++;
        }

        console.log(`🎉 Successfully generated ${createdCount} Custom Tasks for today!`);
    } catch (error) {
        console.error("❌ Error in Daily Custom Task Generator:", error);
    }
});

// ==========================================================
// 🔥 AUTO ROUND PUSH FOR ALL INQUIRIES (CRON JOB) 🔥
// ==========================================================
// හැමදාම රෑ 12:10 ට මේක Auto Run වෙනවා
jobs.schedule('auto-round-push', '10 0 * * *', async () => {
    console.log("⏰ Running Daily Auto Round Push (5-Day & 7-Day Rules)...");
    try {
        const now = new Date();
        const fiveDaysAgo = new Date(now.getTime() - (5 * 24 * 60 * 60 * 1000));
        const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

        /*
        const leadsToPush = await prismaTaskGen.lead.findMany({
            where: {
                campaignType: 'AFTER_SEMINAR',
                inquiryType: 'NEW_INQ', // ONLY NEW_INQ (Open Sem uses 14-day absolute rule)
                enrollmentStatus: { not: 'ENROLLED' },
                coordinationRound: { in: [1, 2] },
                OR: [
                    { phase: 1, callStatus: 'answered' },
                    { phase: 2, callStatus: { in: ['answered', 'no_answer'] } },
                    { phase: 3 } 
                ],
                updatedAt: { lte: fiveDaysAgo } // දවස් 5ක් පැනපු ඔක්කොම ගන්නවා
            }
        });
        */

        /*
        // ❌ REMOVED AUTO ROUND PUSH FOR NEW_INQ BY USER REQUEST ❌
        // New Inquiries should only be manually pushed by coordinators to change rounds.
        if (leadsToPush.length === 0) {
            console.log("✅ No leads found for Auto Round Push today.");
            return;
        }

        let updatedCount = 0;

        for (const lead of leadsToPush) {
            const currentRound = lead.coordinationRound || 1;
            const isNewInq = lead.inquiryType === 'NEW_INQ';

            // 🔥 NEW_INQ Round 2 එකට දවස් 7ක් යන්න ඕනේ!
            if (isNewInq && currentRound === 2) {
                const leadDate = new Date(lead.updatedAt).getTime();
                if (leadDate > sevenDaysAgo.getTime()) {
                    continue; // තාම දවස් 7ක් පිරිලා නෑ, skip කරනවා
                }
            }

            // 1. Save history to LeadRoundProgress before changing round
            await prismaTaskGen.leadRoundProgress.create({
                data: {
                    leadId: lead.id,
                    roundNum: currentRound,
                    callStatus: lead.callStatus || 'pending',
                    callMethod: lead.callMethod || 'direct',
                    callAttempt: lead.callAttempt || 1,
                    feedback: lead.feedback || 'Auto pushed to next round'
                }
            });

            // 2. Update the existing lead (NO DUPLICATES!)
            if (currentRound === 1) {
                // Round 1 -> Round 2
                await prismaTaskGen.lead.update({
                    where: { id: lead.id },
                    data: {
                        coordinationRound: 2,
                        phase: 1,
                        callStatus: 'pending',
                        callAttempt: 1,
                        isLocked: false,
                        feedback: 'Auto pushed from Round 1',
                        newInqRound: isNewInq ? 2 : lead.newInqRound,
                        newInqPhase: isNewInq ? 1 : lead.newInqPhase,
                        newInqCallStatus: isNewInq ? 'pending' : lead.newInqCallStatus,
                        newInqCallAttempt: isNewInq ? 1 : lead.newInqCallAttempt,
                        newInqFeedback: isNewInq ? 'Auto pushed from Round 1' : lead.newInqFeedback,
                        updatedAt: new Date()
                    }
                });
            } else if (currentRound === 2) {
                // Round 2 -> NON_PAID (NORMAL)
                await prismaTaskGen.lead.update({
                    where: { id: lead.id },
                    data: {
                        inquiryType: 'NORMAL', // Move to Non Paid campaign
                        coordinationRound: 1,  // Reset round for Non Paid
                        phase: 1,
                        callStatus: 'pending',
                        callAttempt: 1,
                        isLocked: false,
                        feedback: `Auto pushed from Round 2 to Non-${isNewInq ? 'Enrolled' : 'Paid'}`,
                        newInqRound: isNewInq ? 3 : lead.newInqRound, // Mark as round 3 (moved out) if new inq
                        openSemRound: 1, // Start Open Sem at round 1
                        openSemPhase: 1,
                        openSemCallStatus: 'pending',
                        openSemCallAttempt: 1,
                        openSemFeedback: `Auto pushed from Round 2 to Non-${isNewInq ? 'Enrolled' : 'Paid'}`,
                        updatedAt: new Date()
                    }
                });
            }
            updatedCount++;
        }

        console.log(`🎉 Successfully Pushed ${updatedCount} NEW_INQ Leads to the Next Round!`);
        */

        // ==========================================================
        // 🔥 14-DAY LIMIT RULE FOR OPEN_SEMINAR 🔥
        // ==========================================================
        const fourteenDaysAgo = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000));
        const openSemLeadsToPush = await prismaTaskGen.lead.findMany({
            where: {
                campaignType: 'AFTER_SEMINAR',
                inquiryType: 'OPEN_SEMINAR',
                enrollmentStatus: { not: 'ENROLLED' },
                assignedAt: { lte: fourteenDaysAgo }
            }
        });

        if (openSemLeadsToPush.length > 0) {
            let openSemUpdatedCount = 0;
            for (const lead of openSemLeadsToPush) {
                let combinedFeedback = lead.feedback || 'Auto pushed to Non-Enrolled after 14 days delay';
                
                if (lead.coordinationRound === 2) {
                    const round1Progress = await prismaTaskGen.leadRoundProgress.findFirst({
                        where: { leadId: lead.id, roundNum: 1 },
                        orderBy: { createdAt: 'desc' }
                    });
                    if (round1Progress && round1Progress.feedback) {
                        combinedFeedback = `[Round 1]: ${round1Progress.feedback} | [Round 2]: ${lead.feedback || ''}`;
                    }
                }

                await prismaTaskGen.leadRoundProgress.upsert({
                    where: { 
                        leadId_roundNum_campaignCategory: { 
                            leadId: lead.id, 
                            roundNum: lead.coordinationRound || 1,
                            campaignCategory: 'OPEN_SEM'
                        } 
                    },
                    update: {
                        callStatus: lead.callStatus || 'pending',
                        callMethod: lead.callMethod || 'direct',
                        callAttempt: lead.callAttempt || 1,
                        feedback: '14-Day Limit Reached. Pushed to Non-Enrolled.'
                    },
                    create: {
                        leadId: lead.id,
                        roundNum: lead.coordinationRound || 1,
                        campaignCategory: 'OPEN_SEM',
                        callStatus: lead.callStatus || 'pending',
                        callMethod: lead.callMethod || 'direct',
                        callAttempt: lead.callAttempt || 1,
                        feedback: '14-Day Limit Reached. Pushed to Non-Enrolled.'
                    }
                });

                await prismaTaskGen.lead.update({
                    where: { id: lead.id },
                    data: {
                        // inquiryType: 'NORMAL', // Keep it as OPEN_SEMINAR so it stays in Open Sem Dashboard
                        coordinationRound: 3,  // Round 3 represents Non-Enrolled in Open Sem
                        phase: 1,
                        callStatus: 'pending',
                        callAttempt: 1,
                        isLocked: false,
                        feedback: combinedFeedback,
                        updatedAt: new Date()
                    }
                });
                openSemUpdatedCount++;
            }
            console.log(`🎉 Successfully Pushed ${openSemUpdatedCount} OPEN_SEMINAR Leads to Non-Enrolled (14-day limit)!`);
        }

    } catch (error) {
        console.error("❌ Error in Auto Round Push Generator:", error);
    }
});
// ==========================================================
// 🔥 AI SLIP VERIFICATION AUTO-SCHEDULE 🔥
// ==========================================================
let lastAiVerificationRunMinute = -1;

jobs.schedule('ai-slip-verification-schedule', '* * * * *', async () => {
    try {
        const configSetting = await prismaTaskGen.appSetting.findUnique({ where: { key: 'AI_SLIP_VERIFICATION_SCHEDULE' } });
        if (!configSetting || !configSetting.value) {
            return;
        }
        
        const scheduleConfig = JSON.parse(configSetting.value);
        if (!scheduleConfig || typeof scheduleConfig !== 'object') {
            return;
        }
        
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Colombo',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        const currentTimeStr = formatter.format(now); // Produces HH:mm in Colombo time

        const currentMinuteNum = parseInt(currentTimeStr.split(':')[1], 10);
        if (lastAiVerificationRunMinute === currentMinuteNum) {
            return;
        }

        const aiVerificationController = require('./controllers/aiVerificationController');

        let ran = false;
        // Check mainQueue
        if (scheduleConfig.mainQueue && scheduleConfig.mainQueue.active && scheduleConfig.mainQueue.times) {
            if (scheduleConfig.mainQueue.times.includes(currentTimeStr)) {
                console.log(`⏰ [AI-Scheduler] Triggering MAIN QUEUE bulk verification at ${currentTimeStr}`);
                lastAiVerificationRunMinute = currentMinuteNum;
                ran = true;
                await aiVerificationController.startScheduledBulkVerification('mainQueue');
            }
        }

        // Check noMatch
        if (!ran && scheduleConfig.noMatch && scheduleConfig.noMatch.active && scheduleConfig.noMatch.times) {
            if (scheduleConfig.noMatch.times.includes(currentTimeStr)) {
                console.log(`⏰ [AI-Scheduler] Triggering NO MATCH retry verification at ${currentTimeStr}`);
                lastAiVerificationRunMinute = currentMinuteNum;
                await aiVerificationController.startScheduledBulkVerification('noMatch');
            }
        }
    } catch (err) {
        console.error("❌ Error in AI Schedule Cron:", err);
    }
});
