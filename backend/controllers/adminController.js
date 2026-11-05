const mysqldump = require('mysqldump');
const fs = require('fs');
const path = require('path');

// ==========================================
// FULL SQL DATABASE BACKUP
// ==========================================
exports.downloadDatabaseBackup = async (req, res) => {
    try {
        const BACKUP_DIR = path.join(__dirname, '../backups');
        if (!fs.existsSync(BACKUP_DIR)) {
            return res.status(404).json({ error: "No automated backups found yet." });
        }

        const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.sql'));
        if (files.length === 0) {
            return res.status(404).json({ error: "No automated backups found yet." });
        }

        // Get the latest backup
        const latestBackup = files.sort().reverse()[0];
        const dumpPath = path.join(BACKUP_DIR, latestBackup);

        res.download(dumpPath, latestBackup, (err) => {
            if (err) console.error("Backup download error:", err);
        });
    } catch (error) {
        console.error("Database backup failed:", error);
        res.status(500).json({ error: "Failed to download database backup" });
    }
};

const os = require('os');
const { exec } = require('child_process');

function readTail(filePath, maxBytes = 64 * 1024, maxLines = 35) {
    if (!fs.existsSync(filePath)) return "";
    try {
        const stat = fs.statSync(filePath);
        if (stat.size === 0) return "";
        const bytesToRead = Math.min(stat.size, maxBytes);
        const buffer = Buffer.alloc(bytesToRead);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, bytesToRead, stat.size - bytesToRead);
        fs.closeSync(fd);
        const text = buffer.toString('utf8');
        const lines = text.split('\n');
        return lines.slice(-maxLines).join('\n');
    } catch (err) {
        console.error(`Error tailing file ${filePath}:`, err);
        return "";
    }
}

exports.getSystemOverview = async (req, res) => {
    try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();

        // Safe fetch of simple stats
        const paymentsCount = await prisma.payment.count();
        const leadsCount = await prisma.lead.count();
        const usersCount = await prisma.user.count();

        // Calculate simple server stats
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMemPct = Math.round(((totalMem - freeMem) / totalMem) * 100);
        
        // Simple CPU load average (1 minute)
        const loadAvg = os.loadavg()[0];
        const cpuCount = os.cpus().length;
        const cpuLoadPct = Math.round((loadAvg / cpuCount) * 100);

        // Calculate recent errors from PM2 error log safely
        let recentErrorsCount = 0;
        try {
            const errPath = path.join(os.homedir(), '.pm2/logs/ima-backend-error.log');
            if (fs.existsSync(errPath)) {
                const tailContent = readTail(errPath, 128 * 1024, 100);
                recentErrorsCount = tailContent.split('\n').filter(line => line.toLowerCase().includes('error')).length;
            }
        } catch(e) {
            console.error("Failed to read error logs for overview", e);
        }

        res.json({
            grossRevenue: paymentsCount * 1000, // Dummy calc for visual
            verifiedSales: paymentsCount,
            pendingSync: 0,
            failed: recentErrorsCount,
            pieData: [
                { name: 'Verified', value: paymentsCount || 100 },
                { name: 'Pending', value: 45 },
                { name: 'Failed', value: 12 }
            ],
            barData: [
                { name: 'Courses', revenue: 450000 }
            ],
            services: [
                { name: "Live API Server", status: "LIVE", totalLeads: leadsCount, healthScore: 100 },
                { name: "Database Nodes", status: "LIVE", totalLeads: usersCount, healthScore: 100 }
            ],
            serverHealth: {
                cpuUsage: Math.min(cpuLoadPct, 100),
                ramUsage: usedMemPct
            }
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to load overview data" });
    }
};

exports.getLiveLogs = (req, res) => {
    // Tail the last 35 lines of PM2 backend logs safely without loading large files into memory
    const logPath = path.join(os.homedir(), '.pm2/logs/ima-backend-out.log');
    const errPath = path.join(os.homedir(), '.pm2/logs/ima-backend-error.log');
    
    let combinedLogs = "";

    try {
        const outLogs = readTail(logPath, 64 * 1024, 30);
        if (outLogs) {
            combinedLogs += "=== STANDARD OUTPUT ===\n" + outLogs + "\n";
        }
        const errLogs = readTail(errPath, 64 * 1024, 30);
        if (errLogs) {
            combinedLogs += "=== ERROR OUTPUT ===\n" + errLogs + "\n";
        }
        res.send(combinedLogs || "No logs available.");
    } catch (e) {
        console.error("getLiveLogs error:", e);
        res.status(500).send("Error reading logs");
    }
};
// ==========================================
// SYSTEM AUDIT LOGS
// ==========================================
exports.getAuditLogs = async (req, res) => {
    try {
        const { password, page = 1, limit = 50 } = req.body;
        
        // Security checks
        const userRole = (req.user?.role || req.query.loggedUserRole || '').toUpperCase();
        if (userRole !== 'SYSTEM_ADMIN') {
            return res.status(403).json({ error: "Access Denied: Requires SYSTEM_ADMIN role." });
        }
        
        if (password !== 'IMAAT@2026') {
            return res.status(401).json({ error: "Incorrect Security Password." });
        }

        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();

        const offset = (page - 1) * limit;

        const logs = await prisma.systemAuditLog.findMany({
            orderBy: { id: 'desc' },
            take: parseInt(limit),
            skip: offset,
            include: {
                user: {
                    select: { firstName: true, lastName: true, phone: true }
                }
            }
        });

        // Instant row count estimate from information_schema to avoid 19M row table scan
        const countResult = await prisma.$queryRaw`SELECT table_rows AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'SystemAuditLog'`;
        const totalLogs = Number(countResult[0]?.cnt || 0);

        res.status(200).json({
            logs,
            totalPages: Math.ceil(totalLogs / limit),
            currentPage: parseInt(page),
            totalLogs
        });
    } catch (error) {
        console.error("Audit log fetch error:", error);
        res.status(500).json({ error: "Failed to fetch audit logs" });
    }
};

exports.getAdminProfile = async (req, res) => {
    try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        const userId = req.user.id || req.user.userId;
        if (!req.user || !userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const profile = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
                agentStatus: true,
            }
        });

        if (!profile) {
            return res.status(404).json({ error: "Profile not found" });
        }

        res.status(200).json({ success: true, profile });
    } catch (error) {
        console.error("Failed to fetch admin profile:", error);
        res.status(500).json({ error: "Failed to load admin profile" });
    }
};
