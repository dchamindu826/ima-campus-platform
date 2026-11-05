const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const stream = require('stream');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const gsheetCache = require('../utils/gsheetCache');

// Helper: Get Gemini Keys from DB
const getGeminiKeys = async () => {
    let keys = [];
    try {
        const setting1 = await prisma.appSetting.findUnique({ where: { key: 'GEMINI_API_KEY' } });
        const setting2 = await prisma.appSetting.findUnique({ where: { key: 'GEMINI_API_KEY_2' } });
        if (setting1 && setting1.value) keys.push(setting1.value);
        if (setting2 && setting2.value) keys.push(setting2.value);
    } catch(e) {
        // Fallback
    }
    if (keys.length === 0 && process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
    return keys;
};

// Helper: Fetch all transactions from all sheets and tabs for a given batch
const fetchGSheetTransactions = async (targetBatchId = null) => {
    try {
        const configSetting = await prisma.appSetting.findUnique({ where: { key: 'GSHEET_CONFIGS' } });
        if (!configSetting || !configSetting.value) return { headers: [], rows: [] };

        const configs = JSON.parse(configSetting.value);
        let spreadsheetIds = [];
        
        // Structure is now: { bizId: { batchId: [url1, url2] } }
        for (const bizId in configs) {
            if (typeof configs[bizId] === 'object' && configs[bizId] !== null) {
                for (const batchId in configs[bizId]) {
                    if (targetBatchId && String(batchId) === String(targetBatchId)) {
                        if (Array.isArray(configs[bizId][batchId])) {
                            spreadsheetIds.push(...configs[bizId][batchId]);
                        }
                    }
                }
            }
        }
        console.log(`fetchGSheetTransactions for batch ${targetBatchId}: Found IDs:`, spreadsheetIds);

        if (spreadsheetIds.length === 0) return { headers: [], rows: [] };

        let allHeaders = [];
        let allRows = [];

        for (const idString of spreadsheetIds) {
            const parts = idString.split('|');
            const spreadsheetId = parts[0];
            const targetGid = parts[1] || null;

            let values = [];
            let allSheetValues = [];
            if (true) {
                const { google } = require('googleapis');
                
                // Use the service account for full read/write access
                let auth;
                try {
                    auth = new google.auth.GoogleAuth({
                        keyFile: path.join(__dirname, '../gsheet-service-account.json'),
                        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
                    });
                } catch (e) {
                    auth = 'AIzaSyDUfpDVy946hS3mxESKmgByMpS3UoZk6nw';
                }
                const sheets = google.sheets({ version: 'v4', auth });

                try {
                    const sheetMetadata = await sheets.spreadsheets.get({ spreadsheetId });
                    let sheetTitles = sheetMetadata.data.sheets.map(s => s.properties.title);
                    
                    if (targetGid) {
                        const matchingSheet = sheetMetadata.data.sheets.find(s => String(s.properties.sheetId) === String(targetGid));
                        if (matchingSheet) {
                            sheetTitles = [matchingSheet.properties.title];
                        }
                    }
                    
                    if (sheetTitles.length > 0) {
                        const ranges = sheetTitles.map(t => `'${t}'!A:Z`);
                        const response = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges });
                        if (response.data.valueRanges) {
                            response.data.valueRanges.forEach((vr, i) => {
                                if (vr.values && vr.values.length > 0) {
                                    allSheetValues.push({ sheetName: sheetTitles[i], values: vr.values });
                                }
                            });
                        }
                    }
                } catch (err) {
                    console.error("GSheet fetch error:", err.message);
                    throw new Error(`Google Sheets Access Error: ${err.message}. Please check if the Google Sheet is shared as 'Anyone with the link can view' or if the API key is valid.`);
                }
            } else {
                allSheetValues.push({ sheetName: 'Sheet1', values: values });
            }

            if (allSheetValues.length === 0) continue;

            for (const { sheetName, values } of allSheetValues) {
                if (!values || values.length === 0) continue;

                let headers = values[0].map(h => String(h).trim());
                let hasKnownHeaders = headers.some(h => {
                    const k = h.toLowerCase();
                    return k === 'date' || k === 'txndate' || k === 'ref' || k === 'description' || k === 'amount' || k === 'cr' || k === 'credit';
                });

                let dataRows = values.slice(1);

                if (!hasKnownHeaders) {
                    // Try to guess columns based on the first row of data
                    let descCount = 1;
                    let emptyCount = 1;
                    headers = values[0].map(cell => {
                        let str = String(cell).trim();
                        if (!str) return `Empty_${emptyCount++}`;
                        if (/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/.test(str)) return 'Date';
                        if (/^[\d,]+(\.\d{1,2})?$/.test(str)) return 'Amount';
                        return `Description_${descCount++}`;
                    });
                    
                    // Pad headers if they are shorter than the row data
                    for (let i = headers.length; i < values[0].length; i++) {
                        headers.push(`Column${i + 1}`);
                    }
                    dataRows = values; // First row is data
                }

                // Ensure ALL headers are unique to prevent overwriting keys in rowObj
                let uniqueHeaders = [];
                let headerCounts = {};
                for (const h of headers) {
                    let base = h.trim() || 'Empty';
                    if (headerCounts[base]) {
                        headerCounts[base]++;
                        uniqueHeaders.push(`${base}_${headerCounts[base]}`);
                    } else {
                        headerCounts[base] = 1;
                        uniqueHeaders.push(base);
                    }
                }
                headers = uniqueHeaders;

                if (allHeaders.length === 0) allHeaders = headers;

                const sysHeaders = ['Status', 'Actioned By', 'Business', 'Batch', 'Group', 'Subjects', 'Remark'];
                sysHeaders.forEach(sh => {
                    if (!allHeaders.some(h => h.toLowerCase() === sh.toLowerCase())) {
                        allHeaders.push(sh);
                    }
                });

                let courseMap = null;
                if (allHeaders.some(h => h.trim().toLowerCase() === 'subjects')) {
                    const courses = await prisma.course.findMany({ select: { id: true, name: true } });
                    courseMap = {};
                    courses.forEach(c => courseMap[c.id] = c.name);
                }

                const rows = dataRows.map((row, index) => {
                    let rowObj = { _rowIndex: index + 2, _spreadsheetId: spreadsheetId, _sheetName: sheetName, isMatched: false };
                    allHeaders.forEach((h, i) => {
                        let val = row[i] || '';
                        if (h.trim().toLowerCase() === 'subjects' && val && typeof val === 'string' && val.trim().startsWith('[')) {
                            try {
                                const ids = JSON.parse(val.trim());
                                if (Array.isArray(ids)) {
                                    val = ids.map(id => (courseMap && courseMap[id]) ? courseMap[id] : id).join(', ');
                                }
                            } catch(e) {}
                        }
                        rowObj[h] = val;
                    });
                    
                    const keys = Object.keys(rowObj);
                    
                    const dateKey = keys.find(k => k.toLowerCase() === 'date' || k.toLowerCase() === 'txndate');
                    rowObj.txnDate = dateKey ? rowObj[dateKey] : '';
                    
                    const amountKey = keys.find(k => k.toLowerCase() === 'amount' || k.toLowerCase() === 'cr' || k.toLowerCase() === 'credit');
                    rowObj.amount = amountKey ? rowObj[amountKey] : '';
                    
                    const refKey = keys.find(k => k.toLowerCase() === 'ref' || k.toLowerCase() === 'description' || k.toLowerCase().includes('refarance') || k.toLowerCase() === 'desc' || k.toLowerCase() === 'serial reference' || k.toLowerCase() === 'seriel refarance');
                    rowObj.description = refKey ? rowObj[refKey] : '';
                    
                    const rowValuesStr = Object.values(rowObj).map(v => String(v).toLowerCase()).join(' ');
                    if (rowValuesStr.includes('verified')) {
                        rowObj.isMatched = true;
                    }

                    return rowObj;
                });
                
                allRows.push(...rows);
            }
        }
        return { headers: allHeaders, rows: allRows };
    } catch(err) {
        console.error("Error in fetchGSheetTransactions:", err);
        return { headers: [], rows: [] };
    }
};


// --- Bulk Auto-Verification Background Process ---
let bulkState = {
    isRunning: false,
    total: 0,
    processed: 0,
    success: 0,
    failed: 0,
    currentSlipId: null,
    logs: []
};

// Use an execution ID to prevent zombie loops from modifying a new bulk state
let currentExecutionId = 0;

exports.getBulkStatus = async (req, res) => {
    res.status(200).json(bulkState);
};

exports.getHistory = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const totalCount = await prisma.aiVerificationHistory.count();
        const history = await prisma.aiVerificationHistory.findMany({
            skip,
            take: limit,
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.status(200).json({
            history,
            pagination: {
                total: totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit)
            }
        });
    } catch (err) {
        console.error("[AI History Error]", err);
        res.status(500).json({ error: "Failed to fetch AI verification history" });
    }
};

exports.stopBulkVerification = async (req, res) => {
    if (bulkState.isRunning) {
        bulkState.isRunning = false;
        currentExecutionId++; // invalidate the current loop
        bulkState.logs.push("Verification stopped by user");
        res.status(200).json({ message: "Bulk verification stopped." });
    } else {
        res.status(400).json({ error: "Bulk verification is not currently running." });
    }
};

exports.startBulkVerification = async (req, res) => {
    if (bulkState.isRunning) {
        return res.status(400).json({ error: "Bulk verification is already running" });
    }
    
    const { statementMonth, statementBatch, businessId, batchId, status, paymentIds } = req.body;
    const rawBatchId = statementBatch || batchId;
    
    // Fetch pending slips
    let pendingSlips = [];
    try {
        if (paymentIds && Array.isArray(paymentIds) && paymentIds.length > 0) {
            // Process ONLY the exact requested slips that are pending or postpay - NEVER touch status 1
            pendingSlips = await prisma.payment.findMany({
                where: {
                    id: { in: paymentIds },
                    status: { in: [0, 4] },
                    slip_image: { not: null }
                },
                orderBy: { created_at: 'asc' },
                include: { student: true, business: true, batch: true }
            });
        } else {
            const whereClause = { 
                status: { in: [0, 4] }, 
                slip_image: { not: null },
                NOT: {
                    OR: [
                        { remark: { contains: 'AI Skipped' } },
                        { remark: { contains: '[Duplicate' } },
                        { remark: { contains: '[Business' } },
                        { remark: { contains: '[Batch' } }
                    ]
                }
            };
            if (status !== undefined && status !== '') {
                whereClause.status = parseInt(status);
            }

            if (businessId && businessId !== '') {
                const bizId = parseInt(businessId);
                whereClause.OR = [
                    { businessId: bizId },
                    { batch: { businessId: bizId } },
                    { group: { batch: { businessId: bizId } } }
                ];
            }

            if (rawBatchId && rawBatchId !== '') {
                const bId = parseInt(rawBatchId);
                const targetBatch = await prisma.batch.findUnique({ where: { id: bId }, select: { name: true, businessId: true } });
                
                if (targetBatch && targetBatch.name && targetBatch.name.toUpperCase().includes('ALL BATCHES')) {
                    const targetBizId = targetBatch.businessId || (businessId ? parseInt(businessId) : null);
                    if (targetBizId) {
                        whereClause.OR = [
                            { businessId: targetBizId },
                            { batch: { businessId: targetBizId } },
                            { group: { batch: { businessId: targetBizId } } }
                        ];
                    }
                } else {
                    const batchCondition = [
                        { batchId: bId },
                        { group: { batchId: bId } }
                    ];
                    if (whereClause.OR) {
                        whereClause.AND = [
                            { OR: whereClause.OR },
                            { OR: batchCondition }
                        ];
                        delete whereClause.OR;
                    } else {
                        whereClause.OR = batchCondition;
                    }
                }
            }

            pendingSlips = await prisma.payment.findMany({
                where: whereClause,
                orderBy: { created_at: 'asc' },
                include: { student: true, business: true, batch: true }
            });
        }
    } catch(e) {
        console.error("Bulk fetch error:", e);
        return res.status(500).json({ error: "Failed to fetch pending slips" });
    }

    if (pendingSlips.length === 0) {
        return res.status(400).json({ error: "No pending slips found matching the selected filters" });
    }

    const execId = ++currentExecutionId;

    // Initialize state
    bulkState = {
        isRunning: true,
        total: pendingSlips.length,
        processed: 0,
        success: 0,
        failed: 0,
        currentSlipId: null,
        logs: []
    };

    res.status(200).json({ message: "Bulk verification started", total: bulkState.total });

    // Run in background
    setTimeout(async () => {
        for (const slip of pendingSlips) {
            if (!bulkState.isRunning || currentExecutionId !== execId) break;
            
            bulkState.currentSlipId = slip.id;
            
            try {
                let mockResData = null;
                let mockResStatus = 200;
                const mockReq = {
                    body: {
                        paymentId: slip.id,
                        statementBatch: rawBatchId || slip.batchId,
                        autoDetect: true
                    }
                };
                const mockRes = {
                    status: (s) => { mockResStatus = s; return mockRes; },
                    json: (d) => { mockResData = d; return mockRes; }
                };

                await exports.verifySinglePayment(mockReq, mockRes);

                if (currentExecutionId !== execId) break; // Check again after await

                if (mockResStatus === 200 && mockResData && mockResData.success && mockResData.status === 'VERIFIED') {
                    bulkState.success++;
                    bulkState.logs.push(`✅ Slip #${slip.id} matched successfully.`);
                } else {
                    bulkState.failed++;
                    const errMsg = mockResData?.error || mockResData?.message || '';
                    console.log(`[BULK DEBUG] Slip #${slip.id} Failed with mockResStatus=${mockResStatus}, Data=`, JSON.stringify(mockResData));
                    bulkState.logs.push(`⚠️ Slip #${slip.id} needs manual review. ${errMsg}`);
                }
            } catch (err) {
                if (currentExecutionId !== execId) break; // Check again after await
                bulkState.failed++;
                bulkState.logs.push(`❌ Slip #${slip.id} failed: ${err.message}`);
            }

            bulkState.processed++;
        }
        
        if (currentExecutionId === execId) {
            bulkState.isRunning = false;
            bulkState.currentSlipId = null;
            bulkState.logs.push(`🎉 Bulk Verification Complete! Processed: ${bulkState.processed}, Success: ${bulkState.success}, Failed: ${bulkState.failed}`);

            // Save history record
            try {
                const now = new Date();
                const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(now); // YYYY-MM-DD
                const timeStr = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
                await prisma.aiVerificationHistory.create({
                    data: {
                        date: dateStr,
                        time: timeStr,
                        businessId: businessId ? String(businessId) : null,
                        batchId: rawBatchId ? String(rawBatchId) : null,
                        processed: bulkState.processed,
                        success: bulkState.success,
                        failed: bulkState.failed
                    }
                });
                console.log("[AI History] History log saved successfully for manual bulk run.");
            } catch (hErr) {
                console.error("Failed to create AI history record:", hErr.message);
            }
        }
    }, 100);
};


// Password Authentication Endpoints
exports.verifyPassword = async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ error: "Password is required" });
        }
        
        const stored = await prisma.appSetting.findUnique({ where: { key: 'AI_SLIP_VERIFICATION_PASSWORD' } });
        let isValid = false;
        
        if (!stored) {
            // Default password is 'ima123'
            isValid = (password === 'ima123');
        } else {
            isValid = await bcrypt.compare(password, stored.value);
        }
        
        res.status(200).json({ success: isValid });
    } catch (error) {
        res.status(500).json({ error: "Authentication failed" });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: "Both current and new passwords are required" });
        }
        
        const stored = await prisma.appSetting.findUnique({ where: { key: 'AI_SLIP_VERIFICATION_PASSWORD' } });
        let isValid = false;
        
        if (!stored) {
            isValid = (currentPassword === 'ima123');
        } else {
            isValid = await bcrypt.compare(currentPassword, stored.value);
        }
        
        if (!isValid) {
            return res.status(400).json({ error: "Invalid current password" });
        }
        
        const hashed = await bcrypt.hash(newPassword, 10);
        await prisma.appSetting.upsert({
            where: { key: 'AI_SLIP_VERIFICATION_PASSWORD' },
            update: { value: hashed },
            create: { key: 'AI_SLIP_VERIFICATION_PASSWORD', value: hashed }
        });
        
        res.status(200).json({ success: true, message: "Password updated successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to change password" });
    }
};

// Config Endpoints
exports.getConfig = async (req, res) => {
    try {
        const apiKeySetting = await prisma.appSetting.findUnique({ where: { key: 'GEMINI_API_KEY' } });
        const configSetting = await prisma.appSetting.findUnique({ where: { key: 'AI_SLIP_VERIFICATION_CONFIG' } });
        const settingsSetting = await prisma.appSetting.findUnique({ where: { key: 'AI_SLIP_VERIFICATION_SETTINGS' } });
        
        res.status(200).json({
            apiKey: apiKeySetting ? apiKeySetting.value : '',
            banks: configSetting ? JSON.parse(configSetting.value) : [],
            settings: settingsSetting ? JSON.parse(settingsSetting.value) : { activeBank: '', activeSlips: [] }
        });
    } catch(error) {
        res.status(500).json({ error: "Failed to load configurations" });
    }
};

exports.saveConfig = async (req, res) => {
    try {
        const { apiKey, banks } = req.body;
        
        if (apiKey !== undefined) {
            await prisma.appSetting.upsert({
                where: { key: 'GEMINI_API_KEY' },
                update: { value: apiKey },
                create: { key: 'GEMINI_API_KEY', value: apiKey }
            });
        }
        
        if (banks !== undefined) {
            await prisma.appSetting.upsert({
                where: { key: 'AI_SLIP_VERIFICATION_CONFIG' },
                update: { value: JSON.stringify(banks) },
                create: { key: 'AI_SLIP_VERIFICATION_CONFIG', value: JSON.stringify(banks) }
            });
        }
        
        res.status(200).json({ message: "Configuration saved successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to save configuration" });
    }
};

exports.saveActiveSettings = async (req, res) => {
    try {
        const { activeBank, activeSlips, gsheetTree } = req.body;
        
        const existing = await prisma.appSetting.findUnique({ where: { key: 'AI_SLIP_VERIFICATION_SETTINGS' } });
        let existingVal = existing && existing.value ? JSON.parse(existing.value) : {};
        
        if (activeBank !== undefined) existingVal.activeBank = activeBank;
        if (activeSlips !== undefined) existingVal.activeSlips = activeSlips;
        if (gsheetTree !== undefined) existingVal.gsheetTree = gsheetTree;

        await prisma.appSetting.upsert({
            where: { key: 'AI_SLIP_VERIFICATION_SETTINGS' },
            update: { value: JSON.stringify(existingVal) },
            create: { key: 'AI_SLIP_VERIFICATION_SETTINGS', value: JSON.stringify(existingVal) }
        });
        res.status(200).json({ message: "Active settings saved successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to save active settings" });
    }
};

exports.getScheduleConfig = async (req, res) => {
    try {
        const configSetting = await prisma.appSetting.findUnique({ where: { key: 'AI_SLIP_VERIFICATION_SCHEDULE' } });
        let config = {};
        if (configSetting && configSetting.value) {
            config = JSON.parse(configSetting.value);
        }
        res.status(200).json(config);
    } catch (error) {
        res.status(500).json({ error: "Failed to load schedule config" });
    }
};

exports.saveScheduleConfig = async (req, res) => {
    try {
        const { scheduleConfig } = req.body;
        await prisma.appSetting.upsert({
            where: { key: 'AI_SLIP_VERIFICATION_SCHEDULE' },
            update: { value: JSON.stringify(scheduleConfig) },
            create: { key: 'AI_SLIP_VERIFICATION_SCHEDULE', value: JSON.stringify(scheduleConfig) }
        });
        res.status(200).json({ message: "Schedule configuration saved successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to save schedule config" });
    }
};

exports.uploadRefSlip = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No reference file uploaded" });
        }
        res.status(200).json({ fileUrl: `/storage/documents/${req.file.filename}` });
    } catch (error) {
        res.status(500).json({ error: "Reference upload failed" });
    }
};

exports.addManualTransaction = async (req, res) => {
    try {
        const { txnDate, description, amount, statementMonth } = req.body;
        if (!txnDate || !description || !amount || !statementMonth) {
            return res.status(400).json({ error: "All transaction fields are required" });
        }
        
        const created = await prisma.bankTransaction.create({
            data: {
                txnDate: new Date(txnDate),
                description: String(description).trim(),
                amount: parseFloat(amount),
                statementMonth: String(statementMonth).trim()
            }
        });
        
        res.status(200).json({ success: true, transaction: created });
    } catch (error) {
        res.status(500).json({ error: "Failed to manually add transaction" });
    }
};

// Existing Settings legacy handlers (fallback mapping)
exports.getSettings = async (req, res) => {
    try {
        const setting = await prisma.appSetting.findUnique({ where: { key: 'GEMINI_API_KEY' } });
        res.status(200).json({ apiKey: setting ? setting.value : '' });
    } catch(error) {
        res.status(500).json({ error: "Failed to load settings" });
    }
};

exports.saveSettings = async (req, res) => {
    try {
        const { apiKey } = req.body;
        await prisma.appSetting.upsert({
            where: { key: 'GEMINI_API_KEY' },
            update: { value: apiKey },
            create: { key: 'GEMINI_API_KEY', value: apiKey }
        });
        res.status(200).json({ message: "Settings saved successfully" });
    } catch(error) {
        res.status(500).json({ error: "Failed to save settings" });
    }
};

// Upload Bank Statement (Parses Excel/CSV)

exports.uploadBankStatement = async (req, res) => {
    const { month, bankName, spreadsheetUrl } = req.body;
    if (!spreadsheetUrl) {
        return res.status(400).json({ error: "Google Sheet URL is required" });
    }
    if (!month) {
        return res.status(400).json({ error: "Target month is required" });
    }

    try {
        let spreadsheetId = spreadsheetUrl;
        const match = spreadsheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match) {
            spreadsheetId = match[1];
        }

        const { PrismaClient } = require('@prisma/client');
        const prisma = require('../src/core/db');

        let configs = {};
        const configSetting = await prisma.appSetting.findUnique({ where: { key: 'GSHEET_CONFIGS' } });
        if (configSetting && configSetting.value) {
            configs = JSON.parse(configSetting.value);
        }

        configs[month] = { bankName, spreadsheetId };

        await prisma.appSetting.upsert({
            where: { key: 'GSHEET_CONFIGS' },
            update: { value: JSON.stringify(configs) },
            create: { key: 'GSHEET_CONFIGS', value: JSON.stringify(configs) }
        });

        res.status(200).json({ 
            message: "Google Sheet linked successfully!"
        });

    } catch (error) {
        console.error("[uploadBankStatement] Error:", error);
        res.status(500).json({ error: "Failed to link Google Sheet" });
    }
};

exports.clearBankStatements = async (req, res) => {
    try {
        const { month } = req.params;
        if (!month) return res.status(400).json({ error: "Month is required" });
        
        await prisma.bankTransaction.deleteMany({
            where: { statementMonth: month }
        });
        
        res.status(200).json({ message: "Successfully cleared bank statements for " + month });
    } catch (err) {
        console.error("Failed to clear statements", err);
        res.status(500).json({ error: "Failed to clear statements" });
    }
};

exports.getPendingSlips = async (req, res) => {
    try {
        const { businessId, batchId, includeApproved, status, aiTab } = req.query;
        let where = {
            slip_image: { not: null }
        };

        if (status !== undefined && status !== '') {
            where.status = parseInt(status);
        } else if (aiTab === 'pending') {
            where.status = 0;
        } else if (aiTab === 'review') {
            where.status = { in: [0, 4] };
        } else if (aiTab === 'verified') {
            where.status = 1;
            where.aiVerified = true;
        } else if (aiTab === 'postpay') {
            where.status = 4;
        } else if (includeApproved !== 'true') {
            where.status = 0;
        }

        if (businessId && businessId !== '') {
            const bizId = parseInt(businessId);
            where.OR = [
                { businessId: bizId },
                { batch: { businessId: bizId } },
                { group: { batch: { businessId: bizId } } }
            ];
        }

        if (batchId && batchId !== '') {
            const bId = parseInt(batchId);
            const targetBatch = await prisma.batch.findUnique({ where: { id: bId }, select: { name: true, businessId: true } });
            
            if (targetBatch && targetBatch.name && targetBatch.name.toUpperCase().includes('ALL BATCHES')) {
                const targetBizId = targetBatch.businessId || (businessId ? parseInt(businessId) : null);
                if (targetBizId) {
                    where.OR = [
                        { businessId: targetBizId },
                        { batch: { businessId: targetBizId } },
                        { group: { batch: { businessId: targetBizId } } }
                    ];
                    if (where.AND) delete where.AND;
                }
            } else {
                const batchCondition = [
                    { batchId: bId },
                    { group: { batchId: bId } }
                ];
                if (where.OR) {
                    where.AND = [
                        { OR: where.OR },
                        { OR: batchCondition }
                    ];
                    delete where.OR;
                } else {
                    where.OR = batchCondition;
                }
            }
        }

        const slips = await prisma.payment.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            take: 2000,
            include: { 
                student: { select: { firstName: true, lastName: true, phone: true } },
                actionedUser: { select: { firstName: true, lastName: true } },
                group: { select: { name: true } }
            }
        });

        // Map Subject/Course IDs to names
        const courses = await prisma.course.findMany({ select: { id: true, name: true } });
        const courseMap = {};
        courses.forEach(c => courseMap[c.id] = c.name);

        const today = new Date();

        const processedSlips = slips.map(slip => {
            let subjectNames = slip.subjects;
            if (slip.subjects && slip.subjects.startsWith('[')) {
                try {
                    const ids = JSON.parse(slip.subjects);
                    if (Array.isArray(ids)) {
                        subjectNames = ids.map(id => courseMap[id] || id).join(', ');
                    }
                } catch(e) {}
            }

            let currentStatus = 'Pending';
            if (slip.status === 5) currentStatus = 'Trash';
            else if (slip.status === 4 && slip.valid_until && new Date(slip.valid_until) < today) {
                currentStatus = 'Pending';
            }
            else if (slip.status === 0 && slip.method === 'Upcoming') currentStatus = 'Upcoming';
            else if (slip.status === 0) currentStatus = 'Pending';
            else if (slip.status === 1) {
                if (slip.amount === 0 && slip.remark && slip.remark.includes('Free Card')) currentStatus = 'Free Card';
                else if (slip.remark && slip.remark.includes('Custom Breakdown')) currentStatus = 'Discount';
                else currentStatus = 'Approved';
            }
            else if (slip.status === 2) currentStatus = 'Rejected';
            else if (slip.status === 3) currentStatus = 'Non Paid';
            else if (slip.status === 4) currentStatus = 'Post Pay';

            return {
                ...slip,
                subjectsStr: subjectNames,
                statusStr: currentStatus
            };
        });

        res.status(200).json(processedSlips);
    } catch(err) {
        res.status(500).json({ error: "Failed to fetch pending slips" });
    }
};


exports.getBankStatementMonths = async (req, res) => {
    try {
        const configSetting = await prisma.appSetting.findUnique({ where: { key: 'GSHEET_CONFIGS' } });
        if (configSetting && configSetting.value) {
            const configs = JSON.parse(configSetting.value);
            const allMonths = new Set();
            for (const bizId in configs) {
                if (typeof configs[bizId] === 'object' && configs[bizId] !== null) {
                    for (const batchId in configs[bizId]) {
                        if (typeof configs[bizId][batchId] === 'object' && configs[bizId][batchId] !== null) {
                            Object.keys(configs[bizId][batchId]).forEach(month => allMonths.add(month));
                        }
                    }
                }
            }
            return res.status(200).json(Array.from(allMonths));
        }
        res.status(200).json([]);
    } catch(err) {
        res.status(500).json({ error: "Failed to fetch months" });
    }
};

function fileToGenerativePart(filePath, mimeType) {
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
            mimeType
        },
    };
}

// Helper: Auto-create Delivery record based on ContentHub deliverTute tick (Subject-level duplicate check)
const createDeliveryForVerifiedPayment = async (payment) => {
    try {
        if (!payment || !payment.subjects) return;

        const existingDelivery = await prisma.delivery.findFirst({
            where: {
                paymentId: payment.id,
                status: { notIn: ['Trash', 'Cancelled', 'Rejected'] }
            }
        });
        if (existingDelivery) return;

        let subIds = [];
        try {
            const rawSubs = typeof payment.subjects === 'string' ? JSON.parse(payment.subjects) : payment.subjects;
            if (Array.isArray(rawSubs)) {
                subIds = rawSubs.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0);
            }
        } catch(e) {
            return;
        }

        const { createAutoDeliveryForPayment } = require('./paymentController');
        const delivery = await createAutoDeliveryForPayment(payment);
        if (delivery) {
            console.log(`[AI-Delivery] Created Delivery for Payment ID ${payment.id} (ORD-${delivery.id}).`);
        } else {
            console.log(`[AI-Delivery] No deliverable tutes or already delivered for Payment ID ${payment.id}.`);
        }
    } catch(err) {
        console.error("[AI-Delivery] Error in createDeliveryForVerifiedPayment:", err.message);
    }
};

// Gemini Custom Slip Parsing & Auto-Match Logic

exports.verifySinglePayment = async (req, res) => {
    try {
        const { paymentId, statementMonth, autoVerify = true, autoDetect = false, overrideBank, overrideSlip } = req.body;
        
        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
            include: { student: true, business: true, batch: true }
        });

        if (!payment) return res.status(404).json({ error: "Payment not found" });
        if (payment.status === 1) {
            return res.status(200).json({
                success: true,
                status: 'ALREADY_APPROVED',
                message: "Payment is already approved. Verification skipped to protect student enrollment.",
                matched: true
            });
        }
        if (!payment.slip_image) return res.status(400).json({ error: "No slip image attached to this payment" });

        // --- RULE 1: Check for Duplicate Slip (by slip_image) ---
        if (payment.slip_image) {
            const dupImagePayment = await prisma.payment.findFirst({
                where: {
                    id: { not: payment.id },
                    slip_image: payment.slip_image,
                    status: 1
                }
            });
            if (dupImagePayment) {
                const remark = `[Duplicate Slip] Duplicate slip image detected. Already verified in Payment #${dupImagePayment.id}. Skipped.`;
                await prisma.payment.update({
                    where: { id: payment.id },
                    data: { status: payment.status === 1 ? 1 : (payment.status === 4 ? 4 : 0), aiVerified: payment.status === 1 ? payment.aiVerified : false, remark }
                });
                return res.status(200).json({
                    success: false,
                    status: 'DUPLICATE_SLIP',
                    error: `Skipped: Duplicate slip image already verified in Payment #${dupImagePayment.id}.`,
                    matched: false,
                    remark
                });
            }
        }

        // --- RULE 2: Check for Business / Stream Mismatch ---
        if (payment.studentId) {
            const prevVerified = await prisma.payment.findMany({
                where: {
                    studentId: payment.studentId,
                    status: 1,
                    id: { not: payment.id }
                },
                include: { business: true, batch: true }
            });

            const mismatchedPrev = prevVerified.find(p => 
                (p.businessId && payment.businessId && p.businessId === payment.businessId) &&
                (p.batchId && payment.batchId && p.batchId !== payment.batchId)
            );

            if (mismatchedPrev) {
                const prevBizName = mismatchedPrev.business ? mismatchedPrev.business.name : 'Previous Stream/Business';
                const prevBatchName = mismatchedPrev.batch ? mismatchedPrev.batch.name : 'Previous Batch';
                const currBizName = payment.business ? payment.business.name : (payment.businessId ? `Business #${payment.businessId}` : 'Current Stream/Business');
                const currBatchName = payment.batch ? payment.batch.name : (payment.batchId ? `Batch #${payment.batchId}` : 'Current Batch');
                const remark = `[Batch Mismatch] Student previously paid for ${prevBizName} / ${prevBatchName}. Current payment is for ${currBizName} / ${currBatchName} in the same business. Skipped for manual review.`;
                
                await prisma.payment.update({
                    where: { id: payment.id },
                    data: { status: payment.status === 1 ? 1 : (payment.status === 4 ? 4 : 0), aiVerified: payment.status === 1 ? payment.aiVerified : false, remark }
                });
                return res.status(200).json({
                    success: false,
                    status: 'BATCH_MISMATCH',
                    error: `Skipped: Batch mismatch detected within the same business. Student previously paid for ${prevBatchName}.`,
                    matched: false,
                    remark
                });
            }
        }

        const configSetting = await prisma.appSetting.findUnique({ where: { key: 'AI_SLIP_VERIFICATION_CONFIG' } });
        const settingsSetting = await prisma.appSetting.findUnique({ where: { key: 'AI_SLIP_VERIFICATION_SETTINGS' } });

        const banks = configSetting ? JSON.parse(configSetting.value) : [];
        const activeSettings = settingsSetting ? JSON.parse(settingsSetting.value) : { activeBank: '', activeSlips: [] };

        let activeBankConfig, activeSlipConfigs;
        let effectiveBank = activeSettings.activeBank;

        if (!autoDetect) {
            if (overrideBank) effectiveBank = overrideBank;
            if (!effectiveBank) return res.status(400).json({ error: "No active Bank is configured." });
            activeBankConfig = banks.find(b => b.bankName === effectiveBank);
            if (!activeBankConfig || !activeBankConfig.slips || activeBankConfig.slips.length === 0) {
                return res.status(400).json({ error: "Active bank config missing." });
            }
            if (overrideSlip) {
                activeSlipConfigs = activeBankConfig.slips.filter(s => s.name === overrideSlip);
            } else {
                activeSlipConfigs = activeBankConfig.slips.filter(s => activeSettings.activeSlips.includes(s.name));
            }
            if (activeSlipConfigs.length === 0) return res.status(400).json({ error: "No active Slip Types." });
        }

        const slipFileNames = payment.slip_image.split(',').map(s => s.trim()).filter(Boolean);
        if (slipFileNames.length === 0) return res.status(400).json({ error: "No slip image attached to this payment" });

        let prompt = '';
        if (autoDetect) {
            const allTemplatesList = banks.map(b => b.bankName + " (" + (b.slips || []).map(s => s.name).join(", ") + ")").join("; ");
            prompt = `
You are an expert AI bank slip reader.
We have the following bank templates configured: ${allTemplatesList}
First, carefully analyze the slip and identify the bank and the SINGLE matching slip template from the list above.
Then, extract:
- matched_bank: The identified bank name exactly as listed.
- matched_slip_type: A SINGLE slip template name from the list (e.g. "CDM"). Do not output the whole list.
- transaction_id: (CRITICAL: For BOC: Look for 'DEPOSITOR RELATED REFERENCE' at the bottom of the slip and extract that exact number. Do NOT extract the TO account number. If 'DEPOSITOR RELATED REFERENCE' is not found, extract the RECORD NO. For BOC Online Transfer: Look for 'Online Banking reference Number' or 'Transaction ID'. For People's Bank: Look for 'Trace No' or 'Reference'. For other banks, look for REF, Reference, Seq No. IMPORTANT: The extracted ID MUST be at least 4 digits long. DO NOT extract short 2-digit numbers like "07". Return null if unreadable)
- atm_id: (For Sampath Bank: Look for the ATM ID which usually starts with 'A00' e.g. 'A0001931' at the top of the slip. Return null if unreadable)
- remark: (For Sampath Bank: Look for the 'REMARK' field. Extract exactly what is written. If it says 'NA', extract 'NA'. For People's Bank and BOC Online: Look for 'Remarks' or 'Description' and extract it. Return null if unreadable)
- terminal_id: (For Commercial Bank: Look for the CRM branch name at the top of the slip, e.g., 'ANAMADUW-CRM1 BR' or 'KADAWATH-CRM'. Do NOT extract the alphanumeric TERMINAL ID like 'RANAMAD1HT'. Return null if unreadable)
- narration: (For Commercial Bank: Look for NARRATION field. Extract exactly what is written. Return null if unreadable)
- amount: (The transfer amount as a decimal number, e.g. 5000.00, without commas)
- date: (The exact transaction date from the slip, converted to YYYY-MM-DD format. Return null if unreadable. NEVER guess the date)

Provide output ONLY as valid JSON.
Format:
{
  "matched_bank": "Name",
  "matched_slip_type": "Name",
  "transaction_id": "Extracted Reference Number or null",
  "atm_id": "Extracted ATM ID or null",
  "remark": "Extracted Remark or null",
  "terminal_id": "Extracted Terminal ID or null",
  "narration": "Extracted Narration or null",
  "phone_number": "Extracted phone number or null",
  "amount": 5000.00,
  "date": "YYYY-MM-DD or null"
}
`;
        } else {
            prompt = `
You are an expert AI bank slip reader for the bank "${effectiveBank}".
Analyze the slip carefully.
Extract:
- transaction_id: (CRITICAL: For BOC: Look for 'DEPOSITOR RELATED REFERENCE' at the bottom of the slip and extract that exact number. Do NOT extract the TO account number. If 'DEPOSITOR RELATED REFERENCE' is not found, extract the RECORD NO. For BOC Online Transfer: Look for 'Online Banking reference Number' or 'Transaction ID'. For People's Bank: Look for 'Trace No' or 'Reference'. For other banks, look for REF, Reference, Seq No. IMPORTANT: The extracted ID MUST be at least 4 digits long. DO NOT extract short 2-digit numbers like "07". Return null if unreadable)
- atm_id: (For Sampath Bank: Look for the ATM ID which usually starts with 'A00' e.g. 'A0001931' at the top of the slip. Return null if unreadable)
- remark: (For Sampath Bank: Look for the 'REMARK' field. Extract exactly what is written. If it says 'NA', extract 'NA'. For People's Bank and BOC Online: Look for 'Remarks' or 'Description' and extract it. Return null if unreadable)
- terminal_id: (For Commercial Bank: Look for the CRM branch name at the top of the slip, e.g., 'ANAMADUW-CRM1 BR' or 'KADAWATH-CRM'. Do NOT extract the alphanumeric TERMINAL ID like 'RANAMAD1HT'. Return null if unreadable)
- narration: (For Commercial Bank: Look for NARRATION field. Extract exactly what is written. Return null if unreadable)
- phone_number: (Look for any phone number printed or handwritten on the slip, usually 9 or 10 digits starting with 07. Return null if not found)
- amount: (The transfer amount as a decimal number, e.g. 5000.00, without commas)
- date: (The exact transaction date from the slip, converted to YYYY-MM-DD format. Return null if unreadable. NEVER guess the date)

Provide output ONLY as valid JSON.
Format:
{
  "matched_slip_type": "Name",
  "transaction_id": "Extracted Reference Number or null",
  "atm_id": "Extracted ATM ID or null",
  "remark": "Extracted Remark or null",
  "terminal_id": "Extracted Terminal ID or null",
  "narration": "Extracted Narration or null",
  "phone_number": "Extracted phone number or null",
  "amount": 5000.00,
  "date": "YYYY-MM-DD or null"
}
`;
        }

        let allExtractions = [];
        let lastError = null;

        for (let i = 0; i < slipFileNames.length; i++) {
            const fileName = slipFileNames[i];
            const cleanFileName = require('path').basename(fileName);
            const filePathLocal = require('path').join(process.cwd(), 'storage/documents', cleanFileName);

            if (!require('fs').existsSync(filePathLocal)) continue;

            const ext = require('path').extname(filePathLocal).toLowerCase();
            let mimeType = 'image/jpeg';
            if (ext === '.png') mimeType = 'image/png';
            else if (ext === '.pdf') mimeType = 'application/pdf';

            let singleExtracted = null;
            try {
                const filePart = {
                    inlineData: {
                        data: require('fs').readFileSync(filePathLocal).toString("base64"),
                        mimeType
                    }
                };

                const apiKeys = await getGeminiKeys();
                if (apiKeys.length > 0) {
                    const { GoogleGenAI } = require('@google/genai');
                    for (const key of apiKeys) {
                        try {
                            const ai = new GoogleGenAI({ apiKey: key });
                            const response = await ai.models.generateContent({
                                model: "gemini-2.5-flash-lite",
                                contents: [prompt, filePart]
                            });

                            const text = response.text.trim();
                            let cleanText = text;
                            if (cleanText.startsWith("```json")) cleanText = cleanText.substring(7);
                            if (cleanText.endsWith("```")) cleanText = cleanText.substring(0, cleanText.length - 3);

                            singleExtracted = JSON.parse(cleanText.trim());
                            break;
                        } catch(err) {
                            console.log(`[AI-Extraction] Key failed for slip ${cleanFileName}:`, err.message);
                            lastError = err;
                        }
                    }
                }

                if (!singleExtracted) {
                    const saPath = require('path').join(__dirname, '..', 'gemini-service-account.json');
                    if (require('fs').existsSync(saPath)) {
                        try {
                            const { GoogleAuth } = require('google-auth-library');
                            const axios = require('axios');
                            const auth = new GoogleAuth({
                                keyFile: saPath,
                                scopes: ['https://www.googleapis.com/auth/generative-language']
                            });

                            const client = await auth.getClient();
                            const tokenInfo = await client.getAccessToken();
                            const token = tokenInfo.token;

                            const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

                            const res = await axios.post(apiUrl, {
                                contents: [
                                    { role: "user", parts: [ { text: prompt }, filePart ] }
                                ]
                            }, {
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                    'Content-Type': 'application/json'
                                }
                            });

                            const text = res.data.candidates[0].content.parts[0].text;
                            let cleanText = text.trim();
                            if (cleanText.startsWith("```json")) cleanText = cleanText.substring(7);
                            if (cleanText.endsWith("```")) cleanText = cleanText.substring(0, cleanText.length - 3);

                            singleExtracted = JSON.parse(cleanText.trim());
                        } catch(saError) {
                            console.log(`[AI-Extraction] SA failed for slip ${cleanFileName}:`, saError.message);
                        }
                    }
                }
            } catch(e) {
                lastError = e;
            }

            if (singleExtracted) {
                allExtractions.push({ fileName: cleanFileName, extracted: singleExtracted });
            }
        }

        if (allExtractions.length === 0) {
            return res.status(500).json({ error: "Failed to process slip image(s) with Gemini.", details: lastError?.message });
        }

        let extracted = allExtractions[0].extracted;
        let totalExtractedAmount = 0;
        allExtractions.forEach(item => {
            const amt = parseFloat(item.extracted?.amount) || 0;
            totalExtractedAmount += amt;
        });

        if (allExtractions.length > 1) {
            const breakdownLines = allExtractions.map((item, idx) => `Slip ${idx + 1} (${item.fileName}): LKR ${(parseFloat(item.extracted?.amount) || 0).toLocaleString()} [Ref: ${item.extracted?.transaction_id || 'N/A'}]`).join(' | ');
            extracted = {
                ...extracted,
                amount: totalExtractedAmount,
                isMultipleSlips: true,
                slipCount: allExtractions.length,
                breakdown: breakdownLines
            };
        }

        if (!extracted) {
            return res.status(500).json({ error: "Failed to process with Gemini.", details: lastError?.message });
        }

        let matchMethod = '';
        let confidence = 0;
        let matchedRowIndex = -1;
        let gRows = [];
        let gSheetFetchError = null;
        // Use payment.batchId to fetch the statements
        if (payment.batchId) {
            try {
                const gSheetData = await fetchGSheetTransactions(payment.batchId);
                gRows = gSheetData.rows || [];
            } catch (err) {
                gSheetFetchError = err.message;
            }
        }

        // --- NEW RULE: Check for Batch Mismatch ---
        let isBatchMismatch = false;
        let previousBatchName = '';
        if (payment.studentId && payment.batchId) {
            const prevPayments = await prisma.payment.findMany({
                where: { 
                    studentId: payment.studentId,
                    status: 1,
                    batchId: { not: null }
                },
                include: { batch: true }
            });
            
            const differentBatchPayment = prevPayments.find(p => p.batchId !== payment.batchId);
            if (differentBatchPayment) {
                isBatchMismatch = true;
                previousBatchName = differentBatchPayment.batch ? differentBatchPayment.batch.name : 'Another Batch';
            }
        }

        let cleanTxnId = extracted.transaction_id ? String(extracted.transaction_id).trim() : '';
        
        const matchedBankStr = (extracted.matched_slip_type || extracted.matched_bank || '').toLowerCase();
        
        let isSampath = false;
        let isCommercial = false;
        
        if (matchedBankStr.includes('sampath') || matchedBankStr.includes('commercial')) {
            isSampath = matchedBankStr.includes('sampath');
            isCommercial = matchedBankStr.includes('commercial');
        } else if (!autoDetect && effectiveBank) {
            isSampath = effectiveBank.toLowerCase().includes('sampath');
            isCommercial = effectiveBank.toLowerCase().includes('commercial');
        }

        console.log("=== DEBUG isCommercial ===");
        console.log(`extracted.matched_bank: ${extracted.matched_bank}`);
        console.log(`autoDetect: ${autoDetect}`);
        console.log(`effectiveBank: ${effectiveBank}`);
        console.log(`isSampath: ${isSampath}`);
        console.log(`isCommercial: ${isCommercial}`);
        console.log("==========================");

        if (isSampath) {
            if (extracted.remark && String(extracted.remark).trim().toUpperCase() !== 'NA' && String(extracted.remark).trim().toLowerCase() !== 'null') {
                cleanTxnId = String(extracted.remark).trim();
            } else if (extracted.atm_id && String(extracted.atm_id).trim().toLowerCase() !== 'null') {
                cleanTxnId = String(extracted.atm_id).trim();
            }
        } else if (isCommercial) {
            if (extracted.narration && String(extracted.narration).trim() !== '' && String(extracted.narration).trim().toLowerCase() !== 'null') {
                cleanTxnId = String(extracted.narration).trim();
            } else if (extracted.terminal_id && String(extracted.terminal_id).trim().toLowerCase() !== 'null') {
                cleanTxnId = String(extracted.terminal_id).trim();
            }
        }
        
        // --- RULE 3: Check for Duplicate Transaction ID ---
        if (cleanTxnId && cleanTxnId.length >= 6) {
            const dupTxnPayment = await prisma.payment.findFirst({
                where: {
                    id: { not: payment.id },
                    status: 1,
                    OR: [
                        { remark: { contains: `Extracted ID: ${cleanTxnId}` } },
                        { remark: { contains: `Reference ID (${cleanTxnId})` } },
                        { remark: { contains: `Cleaned: ${cleanTxnId}` } }
                    ]
                }
            });
            if (dupTxnPayment) {
                const remark = `[Duplicate Slip] Extracted Reference ID (${cleanTxnId}) was already verified in Payment #${dupTxnPayment.id}. Skipped.`;
                await prisma.payment.update({
                    where: { id: payment.id },
                    data: { status: payment.status === 1 ? 1 : (payment.status === 4 ? 4 : 0), aiVerified: payment.status === 1, remark }
                });
                return res.status(200).json({
                    success: false,
                    status: 'DUPLICATE_SLIP',
                    error: `Skipped: Reference ID (${cleanTxnId}) already verified in Payment #${dupTxnPayment.id}.`,
                    matched: false,
                    remark
                });
            }
        }
        
        const targetAmount = parseFloat(payment.amount);

        // --- RULE 4: Validate Extracted Slip Amount against Target Amount ---
        if (totalExtractedAmount > 0 && Math.abs(totalExtractedAmount - targetAmount) > 1.0) {
            const remark = `[Amount Mismatch] Extracted slip amount (LKR ${totalExtractedAmount.toLocaleString()}) does not match target payment amount (LKR ${targetAmount.toLocaleString()}). Skipped.`;
            await prisma.payment.update({
                where: { id: payment.id },
                data: { status: payment.status === 1 ? 1 : (payment.status === 4 ? 4 : 0), aiVerified: payment.status === 1, remark }
            });
            return res.status(200).json({
                success: false,
                status: 'AMOUNT_MISMATCH',
                error: `Skipped: Extracted slip amount (LKR ${totalExtractedAmount.toLocaleString()}) does not match target payment amount (LKR ${targetAmount.toLocaleString()}).`,
                matched: false,
                remark
            });
        }

        let matchedRow = null;

        if (!isBatchMismatch && gRows.length > 0) {
            for (const row of gRows) {
                if (row.isMatched) continue; // Skip rows that are already verified

                let hasMatchingAmount = false;
                for (const [key, val] of Object.entries(row)) {
                    if (key.startsWith('_')) continue;
                    let strVal = String(val).replace(/,/g, '');
                    let match = strVal.match(/\d+(\.\d+)?/);
                    let cAmt = match ? parseFloat(match[0]) : NaN;
                    
                    if (!isNaN(cAmt) && Math.abs(cAmt - targetAmount) <= 0.1) {
                        hasMatchingAmount = true;
                        break;
                    }
                }
                
                if (!hasMatchingAmount) continue;

                // STRICT DATE MATCHING (with 2-day bank clearance tolerance)
                let hasMatchingDate = false;
                if (extracted.date && row.txnDate) {
                    let extDateStr = String(extracted.date).trim();
                    let rowDateStr = String(row.txnDate).trim();
                    
                    let extD = new Date(extDateStr);
                    let rowD = new Date(rowDateStr);
                    
                    if (isNaN(rowD.getTime())) {
                        let parts = rowDateStr.split(/[-/]/);
                        if (parts.length >= 3) {
                            let day = parseInt(parts[0], 10);
                            let month = parseInt(parts[1], 10) - 1;
                            let year = parseInt(parts[2], 10);
                            if (year < 100) year += 2000;
                            rowD = new Date(year, month, day);
                        }
                    }

                    if (!isNaN(extD.getTime()) && !isNaN(rowD.getTime())) {
                        const diffDays = Math.abs((extD - rowD) / (1000 * 60 * 60 * 24));
                        if (diffDays <= 3) { // 3 days tolerance for bank holidays/weekends
                            hasMatchingDate = true;
                        }
                    } else {
                        if (rowDateStr.includes(extDateStr) || extDateStr.includes(rowDateStr)) {
                            hasMatchingDate = true;
                        }
                    }
                } else {
                    hasMatchingDate = true; // Bypass if AI couldn't read date or GSheet has no date column
                }

                if (!hasMatchingDate) continue;
                
                let allRowVals = Object.values(row).map(v => String(v)).join(' ');
                const normRowRef = allRowVals.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                const normTxnId = cleanTxnId.replace(/[^a-zA-Z0-9]/g, '').replace(/^0+/, '').toLowerCase();
                
                let extractedPhone = extracted.phone_number ? String(extracted.phone_number).replace(/[^0-9]/g, '') : '';
                if (extractedPhone.startsWith('94')) extractedPhone = '0' + extractedPhone.substring(2);

                let studentFirstName = payment.student?.firstName ? String(payment.student.firstName).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
                let studentLastName = payment.student?.lastName ? String(payment.student.lastName).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
                let extractedRemark = extracted.remark ? String(extracted.remark).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
                let extractedNarration = extracted.narration ? String(extracted.narration).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';

                let matchFound = false;

                if (extractedPhone && extractedPhone.length >= 9 && normRowRef.includes(extractedPhone.substring(1))) {
                    matchFound = true; matchMethod = 'Phone Match';
                } else if (normTxnId && normTxnId.length >= 3 && normRowRef.includes(normTxnId)) {
                    matchFound = true; matchMethod = 'Exact Ref ID Match';
                } else if (normTxnId && normTxnId.length >= 6) {
                    const coreId = normTxnId.substring(normTxnId.length - 6);
                    if (normRowRef.includes(coreId)) {
                        matchFound = true; matchMethod = 'Partial Ref ID Match';
                    }
                }
                
                if (!matchFound && studentFirstName && studentFirstName.length >= 3 && normRowRef.includes(studentFirstName)) {
                    matchFound = true; matchMethod = 'First Name Match';
                }
                if (!matchFound && studentLastName && studentLastName.length >= 3 && normRowRef.includes(studentLastName)) {
                    matchFound = true; matchMethod = 'Last Name Match';
                }

                const genericWords = ['class', 'classes', 'payment', 'payments', 'fee', 'fees', 'month', 'monthly', 'tution', 'deposit', 'online', 'bank', 'transfer', 'boc', 'sampath', 'commercial', 'peoples', 'august', 'july', 'september', 'october', 'november', 'december', 'january', 'february', 'march', 'april', 'may', 'june', 'ol', 'al', 'paper', 'theory'];

                if (!matchFound && extractedRemark && extractedRemark.length >= 3 && !genericWords.includes(extractedRemark) && normRowRef.includes(extractedRemark)) {
                    matchFound = true; matchMethod = 'Extracted Remark Match';
                }
                if (!matchFound && extractedNarration && extractedNarration.length >= 3 && !genericWords.includes(extractedNarration) && normRowRef.includes(extractedNarration)) {
                    matchFound = true; matchMethod = 'Extracted Narration Match';
                }

                if (matchFound) {
                    matchedRow = row;
                    matchedRowIndex = row._rowIndex;
                    confidence = 0.95; 
                    matchMethod = `Date, Amount & ${matchMethod} in GSheet`;
                    break;
                }
            }
        }

        console.log("=== MATCHING RESULT ===");
        console.log(`cleanTxnId: ${cleanTxnId}`);
        console.log(`targetAmount: ${targetAmount}`);
        console.log(`gRows.length: ${gRows.length}`);
        console.log(`matchedRowIndex: ${matchedRowIndex}`);
        console.log(`confidence: ${confidence}`);
        console.log("=======================");

        let isSumAmountMatched = false;
        if (allExtractions.length > 1 && Math.abs(totalExtractedAmount - targetAmount) <= 1.0) {
            isSumAmountMatched = true;
            if (!matchMethod) {
                matchMethod = `Multiple Slips Sum Match (${allExtractions.length} Slips Total LKR ${totalExtractedAmount.toLocaleString()} = Target LKR ${targetAmount.toLocaleString()})`;
                confidence = 0.96;
            }
        }

        if (isBatchMismatch) {
            await prisma.payment.update({
                where: { id: payment.id },
                data: {
                    status: payment.status === 1 ? 1 : (payment.status === 4 ? 4 : 0),
                    aiVerified: payment.status === 1 ? payment.aiVerified : false,
                    remark: `[Batch Mismatch] Student previously paid for ${previousBatchName}. Current payment is for ${payment.batch ? payment.batch.name : 'a different batch'}. Please review manually.`
                }
            });
            return res.status(200).json({ 
                success: false, 
                status: 'BATCH_MISMATCH',
                error: `Skipped: Batch mismatch detected. Student previously paid for ${previousBatchName}.`,
                matched: false
            });
        } else if (gRows.length === 0 && !isSumAmountMatched) {
            const errorMsg = gSheetFetchError || `No Google Sheet Linked for this Batch. Please check the Google Sheet Vault.`;
            await prisma.payment.update({
                where: { id: payment.id },
                data: {
                    status: payment.status === 1 ? 1 : (payment.status === 4 ? 4 : 0),
                    aiVerified: payment.status === 1 ? payment.aiVerified : false,
                    remark: `AI Skipped: ${errorMsg}\n\n--- AI Extraction ---\nBank: ${extracted.matched_bank || 'Unknown'}\nType: ${extracted.matched_slip_type || 'Unknown'}\nExtracted ID: ${extracted.transaction_id || 'null'} (Cleaned: ${cleanTxnId})\nAmount: ${extracted.amount || 'null'}\nTarget Amount: ${targetAmount}`
                }
            });
            return res.status(200).json({ 
                success: false, 
                status: 'NO_GSHEET',
                error: `Skipped: ${errorMsg}`,
                matched: false
            });
        } else if (matchedRowIndex !== -1 && confidence >= 0.80 && allExtractions.length === 1) {
            if (autoVerify) {
                const breakdownText = extracted.breakdown ? `\nBreakdown:\n${extracted.breakdown}` : '';
                const updatedPay = await prisma.payment.update({
                    where: { id: payment.id },
                    data: { 
                        status: 1, 
                        aiVerified: true, 
                        aiConfidence: confidence || 0.96,
                        remark: `AI Verified: ${matchMethod}\n\n--- AI Extraction ---\nBank: ${extracted.matched_bank || 'Unknown'}\nType: ${extracted.matched_slip_type || 'Unknown'}\nExtracted ID: ${extracted.transaction_id || 'null'} (Cleaned: ${cleanTxnId})\nExtracted Total: LKR ${totalExtractedAmount.toLocaleString()}\nTarget Amount: LKR ${targetAmount.toLocaleString()}${breakdownText}`
                    }
                });

                // Trigger ContentHub Auto Delivery Creation
                await createDeliveryForVerifiedPayment(updatedPay);

                // Sync CRM Lead Enrollment and Generate Next Installment Phase
                try {
                    const { syncLeadEnrollment, createNextInstallmentPhase } = require('./paymentController');
                    await syncLeadEnrollment(updatedPay.studentId, updatedPay.payment_type, updatedPay);

                    if (parseInt(updatedPay.payment_type) === 2) {
                        await createNextInstallmentPhase(updatedPay);
                    }
                } catch (e) {
                    console.error("CRM / Installment Sync Error in AI Verification:", e);
                }

                // Write back to GSheet
                if (matchedRow && matchedRow._spreadsheetId) {
                try {
                    // Fetch headers to find column indices
                    const { google } = require('googleapis');
                    const saPath = require('path').join(__dirname, '..', 'gsheet-service-account.json');
                    
                    let authClient;
                    try {
                        authClient = new google.auth.GoogleAuth({
                            keyFile: saPath,
                            scopes: ['https://www.googleapis.com/auth/spreadsheets']
                        });
                    } catch (saErr) {
                        console.error("Failed to load gsheet-service-account.json for GSheets, falling back to API Key:", saErr);
                        authClient = 'AIzaSyDUfpDVy946hS3mxESKmgByMpS3UoZk6nw';
                    }

                    const sheets = google.sheets({ version: 'v4', auth: authClient });
                    
                    const response = await sheets.spreadsheets.values.get({
                        spreadsheetId: matchedRow._spreadsheetId,
                        range: `'${matchedRow._sheetName}'!1:1`, // first row of specific sheet
                    });
                    
                    if (response.data.values && response.data.values.length > 0) {
                        const headers = response.data.values[0];
                        const sysHeaders = ['Status', 'Verified by', 'Student Name', 'Number', 'Business', 'Batch', 'Subjects'];
                        
                        const getHeaderAliases = (sh) => {
                            const s = sh.toLowerCase();
                            if (s === 'student name') return ['student name', 'name', 'student'];
                            if (s === 'number') return ['number', 'phone', 'mobile', 'contact', 'whatsapp', 'phone number'];
                            if (s === 'batch') return ['batch', 'stream', 'course'];
                            if (s === 'business') return ['business', 'company', 'institute'];
                            if (s === 'subjects') return ['subjects', 'subject', 'class', 'classes'];
                            if (s === 'verified by') return ['verified by', 'actioned by', 'checked by'];
                            return [s];
                        };
                        
                        let startColIndex = headers.length;
                        const missingHeaders = sysHeaders.filter(sh => {
                            const aliases = getHeaderAliases(sh);
                            return !headers.find(h => h && aliases.includes(h.toString().trim().toLowerCase()));
                        });
                        
                        if (missingHeaders.length > 0) {
                            const newHeaderRow = [...headers];
                            missingHeaders.forEach(sh => newHeaderRow.push(sh));
                            const endColLtr = String.fromCharCode(65 + newHeaderRow.length - 1);
                            
                            await sheets.spreadsheets.values.update({
                                spreadsheetId: matchedRow._spreadsheetId,
                                range: `'${matchedRow._sheetName}'!A1:${endColLtr}1`,
                                valueInputOption: 'USER_ENTERED',
                                requestBody: { values: [newHeaderRow] }
                            });
                            missingHeaders.forEach(sh => headers.push(sh));
                        }
                        
                        const rowResponse = await sheets.spreadsheets.values.get({
                            spreadsheetId: matchedRow._spreadsheetId,
                            range: `'${matchedRow._sheetName}'!A${matchedRowIndex}:Z${matchedRowIndex}`,
                        });
                        
                        if (rowResponse.data.values && rowResponse.data.values.length > 0) {
                            let rowData = rowResponse.data.values[0];
                            
                            while (rowData.length < startColIndex) {
                                rowData.push('');
                            }
                            
                            const fullPayment = await prisma.payment.findUnique({
                                where: { id: payment.id },
                                include: {
                                    actionedUser: true,
                                    business: true,
                                    batch: true,
                                    student: true
                                }
                            });
                            
                            const statusStr = 'Verified';
                            const actionedByStr = fullPayment.actionedUser ? `${fullPayment.actionedUser.firstName} ${fullPayment.actionedUser.lastName}` : 'AI System';
                            const studentNameStr = fullPayment.student ? `${fullPayment.student.firstName} ${fullPayment.student.lastName}` : 'N/A';
                            const numberStr = fullPayment.student ? fullPayment.student.phone : 'N/A';
                            const businessStr = fullPayment.business ? fullPayment.business.name : 'N/A';
                            const batchStr = fullPayment.batch ? fullPayment.batch.name : 'N/A';
                            
                            const courses = await prisma.course.findMany({ select: { id: true, name: true } });
                            const courseMap = {};
                            courses.forEach(c => courseMap[c.id] = c.name);
                            
                            let subjectsStr = fullPayment.subjects || 'N/A';
                            if (typeof subjectsStr === 'string' && subjectsStr.trim().startsWith('[')) {
                                try {
                                    const ids = JSON.parse(subjectsStr.trim());
                                    if (Array.isArray(ids)) {
                                        subjectsStr = ids.map(id => courseMap[id] || id).join(', ');
                                    }
                                } catch (e) {}
                            }
                            
                            sysHeaders.forEach((sh, idx) => {
                                const aliases = getHeaderAliases(sh);
                                const hIdx = headers.findIndex(h => h && aliases.includes(h.toString().trim().toLowerCase()));
                                const vals = [statusStr, actionedByStr, studentNameStr, numberStr, businessStr, batchStr, subjectsStr];
                                if (hIdx !== -1) {
                                    rowData[hIdx] = vals[idx];
                                } else {
                                    rowData.push(vals[idx]);
                                }
                            });
                            
                            const endColLetter = String.fromCharCode(65 + rowData.length - 1);
                            
                            // Update cell values
                            await sheets.spreadsheets.values.update({
                                spreadsheetId: matchedRow._spreadsheetId,
                                range: `'${matchedRow._sheetName}'!A${matchedRowIndex}:${endColLetter}${matchedRowIndex}`,
                                valueInputOption: 'USER_ENTERED',
                                requestBody: { values: [rowData] }
                            });
                            
                            // Color the row light green
                            try {
                                const sheetMetaResponse = await sheets.spreadsheets.get({ spreadsheetId: matchedRow._spreadsheetId });
                                const sheetId = sheetMetaResponse.data.sheets.find(s => s.properties.title === matchedRow._sheetName)?.properties.sheetId;
                                
                                if (sheetId !== undefined) {
                                    await sheets.spreadsheets.batchUpdate({
                                        spreadsheetId: matchedRow._spreadsheetId,
                                        requestBody: {
                                            requests: [{
                                                repeatCell: {
                                                    range: {
                                                        sheetId: sheetId,
                                                        startRowIndex: matchedRowIndex - 1,
                                                        endRowIndex: matchedRowIndex,
                                                        startColumnIndex: 0,
                                                        endColumnIndex: rowData.length
                                                    },
                                                    cell: {
                                                        userEnteredFormat: {
                                                            backgroundColor: { red: 0.85, green: 0.93, blue: 0.83 } // Light Green
                                                        }
                                                    },
                                                    fields: 'userEnteredFormat.backgroundColor'
                                                }
                                            }]
                                        }
                                    });
                                }
                            } catch (colorErr) {
                                console.error("Error coloring row:", colorErr.message);
                            }
                            console.log('Successfully wrote back to GSheet and colored row.');
                        }
                    }
                } catch (gErr) {
                    console.log('Google Sheets API write failed (likely due to API Key auth limitation):', gErr.message);
                }
            }
            }

            res.status(200).json({
                success: true,
                status: autoVerify ? 'VERIFIED' : 'PENDING_CONFIRMATION',
                confidence,
                matchMethod,
                extracted,
                transaction: { id: `gsheet_row_${matchedRowIndex}` }
            });
        } else {
            const multipleSlipNote = allExtractions.length > 1 ? ' (Multiple slips require manual statement update)' : '';
            const skipReason = `AI Skipped: ${matchMethod || 'No match found'}${multipleSlipNote}.\n\n--- AI Extraction ---\nBank: ${extracted.matched_bank || 'Unknown'}\nType: ${extracted.matched_slip_type || 'Unknown'}\nExtracted ID: ${extracted.transaction_id || 'null'} (Cleaned: ${cleanTxnId})\nExtracted Total: LKR ${totalExtractedAmount.toLocaleString()}\nTarget Amount: LKR ${targetAmount.toLocaleString()}`;
            await prisma.payment.update({
                where: { id: payment.id },
                data: { aiVerified: false, aiConfidence: confidence || 0.1, remark: skipReason }
            });
            
            return res.status(200).json({
                success: false,
                status: 'PENDING_MANUAL',
                confidence: confidence || 0.1,
                matchMethod: matchMethod || 'No Match Found',
                extracted,
                remark: skipReason
            });
        }
    } catch (error) {
        console.error("[verifySinglePayment] Error:", error);
        res.status(500).json({ error: "AI Verification process failed." });
    }
};

exports.processAIVerification = async (req, res) => {
    try {
        const { paymentIds, statementMonth, autoVerify = true } = req.body;
        if (paymentIds && paymentIds.length === 1) {
            req.body.paymentId = paymentIds[0];
            req.body.autoVerify = autoVerify;
            return exports.verifySinglePayment(req, res);
        }
        res.status(200).json({ processed: 0, results: [] });
    } catch (error) {
        res.status(500).json({ error: "AI Verification failed" });
    }
};


exports.getBankTransactions = async (req, res) => {
    try {
        const { batchId } = req.query;
        if (!batchId) return res.status(200).json({ headers: [], rows: [] });
        console.log(`[getBankTransactions] Request received for batch: ${batchId}`);

        const result = await fetchGSheetTransactions(batchId);
        console.log(`[getBankTransactions] Returned ${result.rows.length} rows and ${result.headers.length} headers`);
        res.status(200).json(result);
    } catch(err) {
        console.error("[getBankTransactions] Error:", err.message);
        res.status(500).json({ error: "Failed to fetch transactions from Google Sheet" });
    }
};

exports.executeCommand = async (req, res) => {
    try {
        const { command, pendingPaymentIds, exampleSlipConfigName, statementMonth } = req.body;
        if (!command) return res.status(400).json({ error: "Command is required" });

        const lowerCommand = command.toLowerCase();

        // 1. FILTERING LOGIC
        if (lowerCommand.includes('filter') || lowerCommand.includes('find') || lowerCommand.includes('ona') || lowerCommand.includes('gannawa') || lowerCommand.includes('scan')) {
            if (!exampleSlipConfigName) return res.status(400).json({ error: "Example slip type is required for filtering" });
            if (!pendingPaymentIds || !pendingPaymentIds.length) return res.status(400).json({ error: "No pending payments to filter" });

            const configSetting = await prisma.appSetting.findUnique({ where: { key: 'AI_SLIP_VERIFICATION_CONFIG' } });
            const banks = configSetting ? JSON.parse(configSetting.value) : [];
            let targetSlipConfig = null;
            let targetBankName = null;
            for (const b of banks) {
                const found = b.slips?.find(s => s.name === exampleSlipConfigName);
                if (found) { targetSlipConfig = found; targetBankName = b.bankName; break; }
            }

            if (!targetSlipConfig) return res.status(400).json({ error: "Template configuration not found in DB." });

            let refFilePart = null;
            if (targetSlipConfig.mediaUrl) {
                const refFileName = path.basename(targetSlipConfig.mediaUrl);
                const refFilePath = path.join(process.cwd(), 'storage/documents', refFileName);
                if (fs.existsSync(refFilePath)) {
                    const ext = path.extname(refFilePath).toLowerCase();
                    let mimeType = 'image/jpeg';
                    if (ext === '.png') mimeType = 'image/png';
                    else if (ext === '.webp') mimeType = 'image/webp';
                    else if (ext === '.pdf') mimeType = 'application/pdf';
                    refFilePart = fileToGenerativePart(refFilePath, mimeType);
                }
            }

            // Fetch up to 50 slips to avoid timeouts (adjust as needed for prod)
            const maxToScan = Math.min(pendingPaymentIds.length, 50);
            const scanIds = pendingPaymentIds.slice(0, maxToScan);

            const payments = await prisma.payment.findMany({
                where: { id: { in: scanIds }, slip_image: { not: null } },
                select: { id: true, slip_image: true }
            });

            const matchedIds = [];

            const checkSlip = async (payment) => {

                try {
                    const firstSlipFileName = payment.slip_image.split(',')[0].trim();
                    const cleanFileName = path.basename(firstSlipFileName);
                    const filePath = path.join(process.cwd(), 'storage/documents', cleanFileName);
                    
                    if (!fs.existsSync(filePath)) return;

                    const ext = path.extname(filePath).toLowerCase();
                    let mimeType = 'image/jpeg';
                    if (ext === '.png') mimeType = 'image/png';
                    else if (ext === '.webp') mimeType = 'image/webp';
                    else if (ext === '.pdf') mimeType = 'application/pdf';

                    const filePart = fileToGenerativePart(filePath, mimeType);
                    
                    const parts = [];
                    if (refFilePart) {
                        const prompt = `You are a bank slip categorization assistant. You will be provided with TWO images:
1) A REFERENCE TEMPLATE image (Image 1) representing a "${targetSlipConfig.name}" slip for "${targetBankName}".
2) A USER UPLOADED slip image (Image 2).

CRITICAL RULE: Compare the bank logo and name on Image 2 with Image 1. If Image 2 clearly belongs to a DIFFERENT bank, you MUST reply NO immediately.
If it DOES belong to the same bank, does Image 2 visually match the format, structure, and characteristics of the slip type shown in Image 1?
Additional rules to check:
${targetSlipConfig.rules}

Reply strictly with a single word: YES if Image 2 matches the bank and slip type of Image 1, NO if it does not match.`;
                        parts.push(prompt);
                        parts.push(refFilePart); // Image 1 (Reference)
                        parts.push(filePart);    // Image 2 (User uploaded)
                    } else {
                        const prompt = `You are a bank slip categorization assistant. Look at the attached image.
CRITICAL RULE: First, verify if this slip belongs to "${targetBankName}". 
(Note: Treat acronyms like BOC as Bank of Ceylon, COMBANK as Commercial Bank, HNB as Hatton National Bank, etc.)
If the bank logo or bank name clearly belongs to a DIFFERENT bank and NOT "${targetBankName}" or its variations, you MUST reply NO immediately.

If it DOES belong to "${targetBankName}", does this image match the format and characteristics of the slip type: "${targetSlipConfig.name}"?
Here are the defining rules for this slip type:
${targetSlipConfig.rules}

Reply strictly with a single word: YES if it matches BOTH the bank AND the slip type, NO if it does not match.`;
                        parts.push(prompt);
                        parts.push(filePart);
                    }

                    const apiKeys = await getGeminiKeys();
                    if (apiKeys.length === 0) throw new Error("Gemini API key not found in Settings!");
                    const { GoogleGenAI } = require('@google/genai');
                    
                    let text = "";
                    let success = false;
                    for (const key of apiKeys) {
                        try {
                            const ai = new GoogleGenAI({ apiKey: key });
                            const response = await ai.models.generateContent({
                                model: "gemini-2.5-flash-lite",
                                contents: parts
                            });
                            text = response.text.trim().toUpperCase();
                            success = true;
                            break;
                        } catch (err) {
                            console.log("Batch Gemini API Key failed, trying next... Error:", err.message);
                            continue;
                        }
                    }
                    if (!success) throw new Error("All Gemini API keys failed.");
                    
                    if (text.includes('YES')) {
                        matchedIds.push(payment.id);
                    }
                } catch(e) {
                    console.error(`Error classifying slip ${payment.id}:`, e.message);
                }
            };

            // Process concurrently in chunks of 10 to avoid rate limits
            const chunkSize = 10;
            for (let i = 0; i < payments.length; i += chunkSize) {
                const chunk = payments.slice(i, i + chunkSize);
                await Promise.all(chunk.map(p => checkSlip(p)));
            }

            return res.status(200).json({
                action: 'FILTERED',
                message: `AI scanned ${payments.length} slips and found ${matchedIds.length} matching '${exampleSlipConfigName}'`,
                matchedPaymentIds: matchedIds
            });
        }
        
        // 2. VERIFY LOGIC
        if (lowerCommand.includes('verify') || lowerCommand.includes('check') || lowerCommand.includes('karan')) {
            const numMatch = lowerCommand.match(/\d+/);
            const count = numMatch ? parseInt(numMatch[0]) : 10;
            
            return res.status(200).json({
                action: 'VERIFY',
                count: count,
                message: `Starting verification sequence for ${count} slips...`
            });
        }

        return res.status(200).json({
            action: 'UNKNOWN',
            message: "Command not recognized. Try 'filter these slips' or 'verify 10 slips'."
        });

    } catch (error) {
        console.error("[executeCommand] Error:", error);
        res.status(500).json({ error: "Failed to execute command" });
    }
};


exports.createMonth = async (req, res) => {
    try {
        const { month } = req.body;
        if (!month) return res.status(400).json({ error: "Month is required" });

        const configSetting = await prisma.appSetting.findUnique({ where: { key: 'GSHEET_CONFIGS' } });
        let configs = {};
        if (configSetting && configSetting.value) {
            configs = JSON.parse(configSetting.value);
        }
        
        if (!configs[month]) {
            configs[month] = {};
            await prisma.appSetting.upsert({
                where: { key: 'GSHEET_CONFIGS' },
                update: { value: JSON.stringify(configs) },
                create: { key: 'GSHEET_CONFIGS', value: JSON.stringify(configs) }
            });
        }
        
        res.status(200).json({ message: "Month created successfully" });
    } catch(err) {
        res.status(500).json({ error: "Failed to create month" });
    }
};

exports.deleteMonth = async (req, res) => {
    try {
        const { month } = req.params;
        if (!month) return res.status(400).json({ error: "Month is required" });

        const configSetting = await prisma.appSetting.findUnique({ where: { key: 'GSHEET_CONFIGS' } });
        let configs = {};
        if (configSetting && configSetting.value) {
            configs = JSON.parse(configSetting.value);
        }
        
        if (configs[month]) {
            delete configs[month];
            await prisma.appSetting.upsert({
                where: { key: 'GSHEET_CONFIGS' },
                update: { value: JSON.stringify(configs) },
                create: { key: 'GSHEET_CONFIGS', value: JSON.stringify(configs) }
            });
        }
        
        res.status(200).json({ message: "Month deleted successfully" });
    } catch(err) {
        res.status(500).json({ error: "Failed to delete month" });
    }
};

exports.getTemplates = async (req, res) => {
    try {
        const setting = await prisma.appSetting.findUnique({ where: { key: 'AI_BANK_TEMPLATES' } });
        let templates = [];
        if (setting && setting.value) {
            templates = JSON.parse(setting.value);
        }
        res.status(200).json({ templates });
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load templates" });
    }
};

exports.saveTemplate = async (req, res) => {
    try {
        const { id, bankName, prompt } = req.body;
        let imageUrl = req.body.existingImage || '';
        
        if (req.file) {
            imageUrl = '/storage/documents/' + req.file.filename;
        }

        const setting = await prisma.appSetting.findUnique({ where: { key: 'AI_BANK_TEMPLATES' } });
        let templates = [];
        if (setting && setting.value) {
            templates = JSON.parse(setting.value);
        }

        const templateData = {
            id: id || Date.now().toString(),
            bankName,
            prompt,
            imageUrl,
            updatedAt: new Date().toISOString()
        };

        const existingIndex = templates.findIndex(t => t.id === templateData.id);
        if (existingIndex >= 0) {
            templates[existingIndex] = templateData;
        } else {
            templates.push(templateData);
        }

        await prisma.appSetting.upsert({
            where: { key: 'AI_BANK_TEMPLATES' },
            update: { value: JSON.stringify(templates) },
            create: { key: 'AI_BANK_TEMPLATES', value: JSON.stringify(templates) }
        });

        res.status(200).json({ message: "Template saved successfully", template: templateData });
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: "Failed to save template" });
    }
};

exports.deleteTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const setting = await prisma.appSetting.findUnique({ where: { key: 'AI_BANK_TEMPLATES' } });
        if (!setting || !setting.value) return res.status(404).json({ error: "No templates found" });

        let templates = JSON.parse(setting.value);
        templates = templates.filter(t => t.id !== id);

        await prisma.appSetting.upsert({
            where: { key: 'AI_BANK_TEMPLATES' },
            update: { value: JSON.stringify(templates) },
            create: { key: 'AI_BANK_TEMPLATES', value: JSON.stringify(templates) }
        });

        res.status(200).json({ message: "Template deleted successfully" });
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete template" });
    }
};


exports.getGsheetConfigTree = async (req, res) => {
    try {
        const configSetting = await prisma.appSetting.findUnique({ where: { key: 'GSHEET_CONFIGS' } });
        let configs = {};
        if (configSetting && configSetting.value) {
            configs = JSON.parse(configSetting.value);
            // Migrate old structure if necessary
            if (Object.keys(configs).length > 0 && !Object.keys(configs)[0].includes("Folder") && Object.values(configs)[0] && typeof Object.values(configs)[0] === 'object' && Object.values(configs)[0].spreadsheetId) {
                const migrated = { "Default Folder": {} };
                for (const [month, data] of Object.entries(configs)) {
                    migrated["Default Folder"][month] = [data.spreadsheetId];
                }
                configs = migrated;
                await prisma.appSetting.upsert({
                    where: { key: 'GSHEET_CONFIGS' },
                    update: { value: JSON.stringify(configs) },
                    create: { key: 'GSHEET_CONFIGS', value: JSON.stringify(configs) }
                });
            }
        }
        res.status(200).json(configs);
    } catch(err) {
        console.error("Error in getGsheetConfigTree:", err);
        res.status(500).json({ error: "Failed to fetch gsheet config" });
    }
};

exports.saveGsheetConfigTree = async (req, res) => {
    try {
        const { tree, configs } = req.body;
        const configData = tree || configs;
        await prisma.appSetting.upsert({
            where: { key: 'GSHEET_CONFIGS' },
            update: { value: JSON.stringify(configData) },
            create: { key: 'GSHEET_CONFIGS', value: JSON.stringify(configData) }
        });
        res.status(200).json({ message: "Config saved successfully" });
    } catch(err) {
        console.error("Error in saveGsheetConfigTree:", err);
        res.status(500).json({ error: "Failed to save gsheet config" });
    }
};

exports.toggleSchedule = async (req, res) => {
    try {
        const { type, active, times } = req.body;
        
        const configSetting = await prisma.appSetting.findUnique({ where: { key: 'AI_SLIP_VERIFICATION_SCHEDULE' } });
        let config = {};
        if (configSetting && configSetting.value) config = JSON.parse(configSetting.value);
        
        if (!config[type]) config[type] = {};
        config[type].active = active;
        if (times) config[type].times = times;

        await prisma.appSetting.upsert({
            where: { key: 'AI_SLIP_VERIFICATION_SCHEDULE' },
            update: { value: JSON.stringify(config) },
            create: { key: 'AI_SLIP_VERIFICATION_SCHEDULE', value: JSON.stringify(config) }
        });
        
        console.log(`[AI-Scheduler] Schedule for ${type} is now ${active ? 'ON' : 'OFF'} with times:`, times);
        res.status(200).json({ message: `Schedule ${type} updated successfully` });
    } catch(err) {
        console.error("Error toggling schedule:", err);
        res.status(500).json({ error: "Failed to toggle schedule" });
    }
};


exports.startScheduledBulkVerification = async (queueType) => {
    if (bulkState.isRunning) {
        console.log("[AI-Scheduler] Bulk verification already running, skipping scheduled run.");
        return;
    }
    try {
        console.log(`[AI-Scheduler] Fetching all pending slips for queue: ${queueType}`);
        const { PrismaClient } = require('@prisma/client');
        const prisma = require('../src/core/db');
        
        const pendingSlips = await prisma.payment.findMany({
            where: {
                status: { in: [0, 4] },
                slip_image: { not: null },
                NOT: {
                    OR: [
                        { remark: { contains: 'AI Skipped' } },
                        { remark: { contains: '[Duplicate' } },
                        { remark: { contains: '[Business' } },
                        { remark: { contains: '[Batch' } }
                    ]
                }
            },
            include: { student: true }
        });
        
        if (pendingSlips.length === 0) {
            console.log(`[AI-Scheduler] No pending slips found for ${queueType}.`);
            return;
        }
        
        console.log(`[AI-Scheduler] Found ${pendingSlips.length} pending slips. Starting process...`);
        bulkState.isRunning = true;
        bulkState.shouldStop = false;
        bulkState.processed = 0;
        bulkState.success = 0;
        bulkState.failed = 0;
        bulkState.total = pendingSlips.length;
        bulkState.logs = [`Started scheduled verification (${queueType}) for ${pendingSlips.length} slips.`];
        
        // Wrap logic in an async IIFE to process in background
        (async () => {
            try {
                for (let i = 0; i < pendingSlips.length; i++) {
                    if (bulkState.shouldStop) {
                        bulkState.logs.push("Bulk verification stopped by schedule run.");
                        break;
                    }
                    
                    const slip = pendingSlips[i];
                    bulkState.logs.push(`Processing scheduled slip [${slip.id}] Rs. ${slip.amount}`);
                    bulkState.currentSlipId = slip.id;
                    
                    try {
                        let mockResData = null;
                        let mockResStatus = 200;
                        const mockReq = { 
                            body: { 
                                paymentId: slip.id, 
                                autoDetect: true, 
                                statementBatch: slip.batchId 
                            } 
                        };
                        const mockRes = {
                            status: function(s) { mockResStatus = s; return this; },
                            json: function(data) { mockResData = data; return this; }
                        };
                        
                        await exports.verifySinglePayment(mockReq, mockRes);
                        
                        if (mockResStatus === 200 && mockResData && mockResData.success && mockResData.status === 'VERIFIED') {
                            bulkState.success++;
                            bulkState.logs.push(`✅ Slip #${slip.id} matched successfully.`);
                        } else {
                            bulkState.failed++;
                            bulkState.logs.push(`⚠️ Slip #${slip.id} needs manual review. ${mockResData?.error || ''}`);
                        }
                    } catch (err) {
                        bulkState.failed++;
                        bulkState.logs.push(`❌ Slip #${slip.id} failed: ${err.message}`);
                    }
                    
                    bulkState.processed++;
                }
            } catch(e) {
                console.error("Scheduled run error", e);
            } finally {
                bulkState.isRunning = false;
                bulkState.currentSlipId = null;
                bulkState.logs.push(`🎉 Scheduled Verification Complete! Processed: ${bulkState.processed}, Success: ${bulkState.success}, Failed: ${bulkState.failed}`);
                console.log("[AI-Scheduler] Scheduled run completed.");

                // Save history record
                try {
                    const now = new Date();
                    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(now); // YYYY-MM-DD
                    const timeStr = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
                    await prisma.aiVerificationHistory.create({
                        data: {
                            date: dateStr,
                            time: timeStr,
                            businessId: null,
                            batchId: queueType,
                            processed: bulkState.processed,
                            success: bulkState.success,
                            failed: bulkState.failed
                        }
                    });
                    console.log("[AI History] History log saved successfully for scheduled run.");
                } catch (hErr) {
                    console.error("Failed to create AI history record for scheduled run:", hErr.message);
                }
            }
        })();
        
    } catch(err) {
        console.error("Error starting scheduled verification:", err);
    }
};
