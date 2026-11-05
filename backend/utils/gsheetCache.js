const { google } = require('googleapis');
const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');

let gsheetCache = {};
let isFetching = false;

const updateCache = async () => {
    if (isFetching) return;
    isFetching = true;
    try {
        console.log('[GSheet Cache] Updating Google Sheets Cache...');
        
        const gApiKeySetting = await prisma.appSetting.findUnique({ where: { key: 'GEMINI_API_KEY' } });
        if (!gApiKeySetting || !gApiKeySetting.value) {
            console.log('[GSheet Cache] No API key found, skipping.');
            isFetching = false;
            return;
        }
        const auth = gApiKeySetting.value;

        const gsheetConfig = await prisma.appSetting.findUnique({ where: { key: 'GSHEET_CONFIGS' } });
        if (!gsheetConfig || !gsheetConfig.value) {
            isFetching = false;
            return;
        }

        const configs = JSON.parse(gsheetConfig.value);
        const sheets = google.sheets({ version: 'v4', auth });

        let newCache = {};

        for (const [month, config] of Object.entries(configs)) {
            const spreadsheetId = config.spreadsheetId;
            if (!spreadsheetId) continue;

            try {
                const response = await sheets.spreadsheets.values.get({
                    spreadsheetId,
                    range: `${month}!A1:Z5000`
                });
                
                newCache[month] = {
                    spreadsheetId,
                    rows: response.data.values || []
                };
            } catch (err) {
                console.error(`[GSheet Cache] Error fetching sheet ${month}:`, err.message);
            }
        }

        gsheetCache = newCache;
        console.log(`[GSheet Cache] Cache updated. Loaded ${Object.keys(newCache).length} sheets.`);

    } catch (err) {
        console.error('[GSheet Cache] Error in updateCache:', err.message);
    } finally {
        isFetching = false;
    }
};

// Start cron-like interval (every 5 minutes)
const initCacheJob = () => {
    updateCache(); // Initial load
    setInterval(updateCache, 5 * 60 * 1000);
};

const getCache = () => gsheetCache;
const getSheetData = (month) => gsheetCache[month]?.rows || [];

module.exports = {
    initCacheJob,
    getCache,
    getSheetData,
    updateCache
};
