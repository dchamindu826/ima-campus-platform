const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Default Meta Cloud API Rates (Sri Lanka / USD)
const DEFAULT_RATES = {
    MARKETING: 0.0528,
    UTILITY: 0.0150,
    AUTHENTICATION: 0.0154,
    SERVICE: 0.0125,
    USD_TO_LKR: 305.00
};

// Cache for business lookup by waNumId / waId
let settingsCache = null;
let lastCacheTime = 0;

async function getCachedSettings() {
    const now = Date.now();
    if (!settingsCache || now - lastCacheTime > 60000) { // 1 min cache
        try {
            settingsCache = await prisma.crmSettings.findMany({
                select: {
                    id: true,
                    businessId: true,
                    waId: true,
                    waNumId: true,
                    campaignType: true,
                    metaApiKey: true
                }
            });
            lastCacheTime = now;
        } catch (e) {
            console.error('[WhatsAppBilling] Failed to load settings cache:', e.message);
            if (!settingsCache) settingsCache = [];
        }
    }
    return settingsCache;
}

// Get active pricing rates
async function getActiveRates() {
    try {
        const setting = await prisma.appSetting.findUnique({
            where: { key: 'WHATSAPP_BILLING_CONFIG' }
        });
        if (setting && setting.value) {
            const parsed = JSON.parse(setting.value);
            return {
                MARKETING: Number(parsed.MARKETING ?? DEFAULT_RATES.MARKETING),
                UTILITY: Number(parsed.UTILITY ?? DEFAULT_RATES.UTILITY),
                AUTHENTICATION: Number(parsed.AUTHENTICATION ?? DEFAULT_RATES.AUTHENTICATION),
                SERVICE: Number(parsed.SERVICE ?? DEFAULT_RATES.SERVICE),
                USD_TO_LKR: Number(parsed.USD_TO_LKR ?? DEFAULT_RATES.USD_TO_LKR)
            };
        }
    } catch (e) {
        // Fall back to default
    }
    return DEFAULT_RATES;
}

// Save custom rates
async function saveRatesConfig(rates) {
    const config = {
        MARKETING: Number(rates.MARKETING ?? DEFAULT_RATES.MARKETING),
        UTILITY: Number(rates.UTILITY ?? DEFAULT_RATES.UTILITY),
        AUTHENTICATION: Number(rates.AUTHENTICATION ?? DEFAULT_RATES.AUTHENTICATION),
        SERVICE: Number(rates.SERVICE ?? DEFAULT_RATES.SERVICE),
        USD_TO_LKR: Number(rates.USD_TO_LKR ?? DEFAULT_RATES.USD_TO_LKR)
    };

    await prisma.appSetting.upsert({
        where: { key: 'WHATSAPP_BILLING_CONFIG' },
        update: { value: JSON.stringify(config) },
        create: { key: 'WHATSAPP_BILLING_CONFIG', value: JSON.stringify(config) }
    });

    return config;
}

/**
 * Record a billing event from Meta Webhook
 */
async function recordWebhookBillingEvent(statusData, metadata = {}, wabaId = null) {
    if (!statusData || !statusData.id) return null;

    const wamid = statusData.id;
    const pricing = statusData.pricing;

    // Resolve phone number & WABA
    const phoneNumberId = metadata.phone_number_id || null;
    const displayPhoneNumber = metadata.display_phone_number || null;
    const recipient = statusData.recipient_id || null;
    const status = statusData.status || 'sent';

    // Check if message already recorded (prevents double charging across sent/delivered/read webhooks)
    const existing = await prisma.whatsAppBillingRecord.findUnique({
        where: { wamid }
    });

    if (existing) {
        // Just update status if changed
        if (existing.status !== status) {
            return await prisma.whatsAppBillingRecord.update({
                where: { wamid },
                data: { status }
            });
        }
        return existing;
    }

    // Resolve business
    let businessId = null;
    const allSettings = await getCachedSettings();
    const matched = allSettings.find(s => 
        (phoneNumberId && s.waNumId === phoneNumberId) || 
        (wabaId && s.waId === wabaId)
    );
    if (matched) {
        businessId = matched.businessId;
    }

    // Determine category & billable
    const categoryRaw = (pricing?.category || statusData.conversation?.origin?.type || 'MARKETING').toUpperCase();
    const isBillable = pricing ? Boolean(pricing.billable) : true;
    const pricingModel = pricing?.pricing_model || 'PMP';
    const pricingType = pricing?.type || 'regular';

    // Calculate cost
    const rates = await getActiveRates();
    let costUsd = 0.0;
    if (isBillable && pricingType !== 'free_tier' && pricingType !== 'free_entry_point') {
        costUsd = rates[categoryRaw] !== undefined ? rates[categoryRaw] : rates.MARKETING;
    }

    // Timestamp
    let eventTime = new Date();
    if (statusData.timestamp) {
        const tsSec = parseInt(statusData.timestamp, 10);
        if (!isNaN(tsSec) && tsSec > 0) {
            eventTime = new Date(tsSec * 1000);
        }
    }

    const created = await prisma.whatsAppBillingRecord.upsert({
        where: { wamid },
        create: {
            businessId,
            wabaId: wabaId ? String(wabaId) : null,
            phoneNumberId: phoneNumberId ? String(phoneNumberId) : null,
            displayPhoneNumber,
            recipient,
            wamid,
            conversationId: statusData.conversation?.id || null,
            category: categoryRaw,
            pricingModel,
            pricingType,
            costUsd,
            billable: isBillable,
            status,
            eventTimestamp: eventTime
        },
        update: {
            status,
            ...(isBillable ? { billable: true, costUsd } : {})
        }
    });

    // Notify connected clients via Socket
    try {
        const { getIo } = require('../controllers/chatController');
        const io = getIo();
        if (io) {
            io.emit('whatsapp_billing_update', {
                businessId,
                category: categoryRaw,
                costUsd,
                displayPhoneNumber,
                timestamp: eventTime
            });
        }
    } catch (e) {
        // ignore socket errors
    }

    return created;
}

// Sri Lanka Timezone Offset (+05:30)
const SL_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const KNOWN_BUSINESS_PHONES = {
    1: '+94 76 625 9030',
    4: '+94 77 334 5060',
    6: '+94 77 207 9030',
    9: '+94 77 428 9030',
    10: '+94 70 767 8574',
    13: '+94 74 200 0122',
    14: '+94 71 220 9030',
    17: '+94 72 710 9030',
    18: '+94 70 767 8561',
    19: '+94 70 767 8562',
    '1315264348327767': '+94 77 206 5060',
    '1261511497040632': '+94 76 015 9030',
    '1246918395171738': '+94 77 401 9030',
    '1126165833923526': '+94 77 207 9030',
    '1266389426549974': '+94 76 625 9030',
    '1202366239630257': '+94 77 334 5060',
    '1154213631119255': '+94 76 128 8090',
    '1224594054079145': '+94 77 428 9030',
    '1204779132723052': '+94 77 697 0622',
    '1178123275395170': '+94 74 200 0122',
    '1189709874226544': '+94 71 220 9030',
    '1142644975609252': '+94 70 767 8561',
    '1208424262355917': '+94 72 710 9030',
    '1314396868418110': '+94 70 767 8574',
    '1346195111901180': '+94 70 767 8562'
};

function getSlDateRange(range, startDate, endDate) {
    const nowSl = new Date(Date.now() + SL_OFFSET_MS);
    const y = nowSl.getUTCFullYear();
    const m = nowSl.getUTCMonth();
    const d = nowSl.getUTCDate();
    const dayOfWeek = nowSl.getUTCDay();

    let startUtc, endUtc;

    if (range === 'today') {
        startUtc = new Date(Date.UTC(y, m, d, 0, 0, 0) - SL_OFFSET_MS);
        endUtc = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - SL_OFFSET_MS);
    } else if (range === 'yesterday') {
        startUtc = new Date(Date.UTC(y, m, d - 1, 0, 0, 0) - SL_OFFSET_MS);
        endUtc = new Date(Date.UTC(y, m, d - 1, 23, 59, 59, 999) - SL_OFFSET_MS);
    } else if (range === 'this_week') {
        const distToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startUtc = new Date(Date.UTC(y, m, d - distToMonday, 0, 0, 0) - SL_OFFSET_MS);
        endUtc = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - SL_OFFSET_MS);
    } else if (range === 'last_week') {
        const distToMonday = (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + 7;
        startUtc = new Date(Date.UTC(y, m, d - distToMonday, 0, 0, 0) - SL_OFFSET_MS);
        endUtc = new Date(Date.UTC(y, m, d - distToMonday + 6, 23, 59, 59, 999) - SL_OFFSET_MS);
    } else if (range === 'last_7_days') {
        startUtc = new Date(Date.UTC(y, m, d - 6, 0, 0, 0) - SL_OFFSET_MS);
        endUtc = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - SL_OFFSET_MS);
    } else if (range === 'this_month') {
        startUtc = new Date(Date.UTC(y, m, 1, 0, 0, 0) - SL_OFFSET_MS);
        const lastDayThisMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        endUtc = new Date(Date.UTC(y, m, lastDayThisMonth, 23, 59, 59, 999) - SL_OFFSET_MS);
    } else if (range === 'last_month') {
        startUtc = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0) - SL_OFFSET_MS);
        const lastDayLastMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
        endUtc = new Date(Date.UTC(y, m - 1, lastDayLastMonth, 23, 59, 59, 999) - SL_OFFSET_MS);
    } else if (range === 'custom' && startDate && endDate) {
        const [sy, sm, sd] = String(startDate).split('-').map(Number);
        const [ey, em, ed] = String(endDate).split('-').map(Number);
        startUtc = new Date(Date.UTC(sy, sm - 1, sd, 0, 0, 0) - SL_OFFSET_MS);
        endUtc = new Date(Date.UTC(ey, em - 1, ed, 23, 59, 59, 999) - SL_OFFSET_MS);
    } else {
        startUtc = new Date(Date.UTC(y, m, 1, 0, 0, 0) - SL_OFFSET_MS);
        const lastDayThisMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        endUtc = new Date(Date.UTC(y, m, lastDayThisMonth, 23, 59, 59, 999) - SL_OFFSET_MS);
    }

    return { startUtc, endUtc };
}

/**
 * Get aggregated billing overview
 */
async function getBillingOverview({ range = 'this_month', businessId = null, startDate = null, endDate = null }) {
    const rates = await getActiveRates();
    const usdToLkr = rates.USD_TO_LKR;

    const { startUtc, endUtc } = getSlDateRange(range, startDate, endDate);

    const whereClause = {
        createdAt: { gte: startUtc, lte: endUtc }
    };
    if (businessId && !isNaN(parseInt(businessId))) {
        whereClause.businessId = parseInt(businessId);
    }

    // 1. Fetch all records within period
    const records = await prisma.whatsAppBillingRecord.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' }
    });

    // 2. Fetch all businesses for mapping
    const businesses = await prisma.business.findMany({
        select: { id: true, name: true }
    });
    const businessMap = {};
    businesses.forEach(b => { businessMap[b.id] = b.name; });

    // 3. Aggregate totals & breakdowns
    let totalCostUsd = 0;
    let totalMessages = records.length;
    let totalBillable = 0;

    const categoryStats = {
        MARKETING: { count: 0, costUsd: 0, costLkr: 0 },
        UTILITY: { count: 0, costUsd: 0, costLkr: 0 },
        SERVICE: { count: 0, costUsd: 0, costLkr: 0 },
        AUTHENTICATION: { count: 0, costUsd: 0, costLkr: 0 }
    };

    const businessStats = {};
    const dailyMap = {};

    for (const r of records) {
        const cat = r.category || 'MARKETING';
        const cost = Number(r.costUsd || 0);

        totalCostUsd += cost;
        if (r.billable) totalBillable++;

        if (!categoryStats[cat]) {
            categoryStats[cat] = { count: 0, costUsd: 0, costLkr: 0 };
        }
        categoryStats[cat].count++;
        categoryStats[cat].costUsd += cost;

        // Business group - consolidate by businessId
        const bId = r.businessId || 0;
        const bName = businessMap[bId] || (bId === 0 ? 'General / Unassigned' : `Business #${bId}`);
        const phone = KNOWN_BUSINESS_PHONES[bId] || 
                      KNOWN_BUSINESS_PHONES[r.phoneNumberId] || 
                      r.displayPhoneNumber || 
                      r.phoneNumberId || 
                      'Configured Number';

        const bizKey = String(bId);
        if (!businessStats[bizKey]) {
            businessStats[bizKey] = {
                businessId: bId,
                businessName: bName,
                phoneNumber: phone,
                wabaId: r.wabaId,
                count: 0,
                costUsd: 0,
                costLkr: 0,
                marketingCount: 0,
                utilityCount: 0,
                serviceCount: 0
            };
        }
        businessStats[bizKey].count++;
        businessStats[bizKey].costUsd += cost;
        if (cat === 'MARKETING') businessStats[bizKey].marketingCount++;
        else if (cat === 'UTILITY') businessStats[bizKey].utilityCount++;
        else if (cat === 'SERVICE') businessStats[bizKey].serviceCount++;

        // Daily trend using Sri Lanka local calendar date
        const dStr = new Date(new Date(r.createdAt).getTime() + SL_OFFSET_MS).toISOString().split('T')[0];
        if (!dailyMap[dStr]) {
            dailyMap[dStr] = { date: dStr, count: 0, costUsd: 0, costLkr: 0 };
        }
        dailyMap[dStr].count++;
        dailyMap[dStr].costUsd += cost;
    }

    // Format category stats with LKR
    for (const key of Object.keys(categoryStats)) {
        categoryStats[key].costUsd = parseFloat(categoryStats[key].costUsd.toFixed(4));
        categoryStats[key].costLkr = Math.round(categoryStats[key].costUsd * usdToLkr);
    }

    // Format business breakdown array
    const businessBreakdown = Object.values(businessStats).map(b => ({
        ...b,
        costUsd: parseFloat(b.costUsd.toFixed(4)),
        costLkr: Math.round(b.costUsd * usdToLkr)
    })).sort((a, b) => b.costUsd - a.costUsd);

    // Format daily trend
    const dailyTrend = Object.values(dailyMap).map(d => ({
        ...d,
        costUsd: parseFloat(d.costUsd.toFixed(4)),
        costLkr: Math.round(d.costUsd * usdToLkr)
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Logs (up to 10k for CSV export, top 50 for live UI)
    const allLogs = records.slice(0, 10000).map(r => ({
        id: r.id,
        wamid: r.wamid,
        recipient: r.recipient,
        category: r.category,
        costUsd: r.costUsd,
        costLkr: Math.round(r.costUsd * usdToLkr),
        status: r.status,
        displayPhoneNumber: KNOWN_BUSINESS_PHONES[r.businessId] || KNOWN_BUSINESS_PHONES[r.phoneNumberId] || r.displayPhoneNumber || r.phoneNumberId,
        businessName: businessMap[r.businessId] || 'Unassigned',
        timestamp: r.eventTimestamp || r.createdAt
    }));
    const recentLogs = allLogs.slice(0, 50);

    // Today's spend for KPI card (using Sri Lanka day boundary)
    const { startUtc: todayStartUtc } = getSlDateRange('today');
    const todayRecords = records.filter(r => new Date(r.createdAt) >= todayStartUtc);
    const todayCostUsd = parseFloat(todayRecords.reduce((acc, r) => acc + (r.costUsd || 0), 0).toFixed(4));

    return {
        period: {
            range,
            startDate: startUtc.toISOString(),
            endDate: endUtc.toISOString()
        },
        summary: {
            totalCostUsd: parseFloat(totalCostUsd.toFixed(4)),
            totalCostLkr: Math.round(totalCostUsd * usdToLkr),
            todayCostUsd,
            todayCostLkr: Math.round(todayCostUsd * usdToLkr),
            totalMessages,
            totalBillable,
            usdToLkrRate: usdToLkr
        },
        categoryStats,
        businessBreakdown,
        dailyTrend,
        recentLogs,
        allLogs,
        rates
    };
}

/**
 * Fetch live phone number quality & status from Meta Graph API for all configured numbers
 */
async function fetchMetaPhoneHealth() {
    const allSettings = await prisma.crmSettings.findMany({
        where: {
            metaApiKey: { not: null },
            waNumId: { not: null }
        }
    });

    const businesses = await prisma.business.findMany({
        select: { id: true, name: true }
    });
    const businessMap = {};
    businesses.forEach(b => { businessMap[b.id] = b.name; });

    const results = [];

    for (const s of allSettings) {
        try {
            const url = `https://graph.facebook.com/v21.0/${s.waNumId}?fields=display_phone_number,verified_name,quality_rating,code_verification_status,messaging_limit_tier&access_token=${s.metaApiKey}`;
            const res = await fetch(url);
            const data = await res.json();

            const bName = businessMap[s.businessId] || 'Unnamed';

            if (data && !data.error) {
                results.push({
                    businessId: s.businessId,
                    businessName: bName,
                    campaignType: s.campaignType,
                    phoneNumberId: s.waNumId,
                    wabaId: s.waId,
                    displayPhoneNumber: data.display_phone_number,
                    verifiedName: data.verified_name,
                    qualityRating: data.quality_rating || 'UNKNOWN', // GREEN, YELLOW, RED
                    status: data.code_verification_status,
                    messagingLimitTier: data.messaging_limit_tier || 'TIER_1K'
                });
            } else {
                results.push({
                    businessId: s.businessId,
                    businessName: bName,
                    campaignType: s.campaignType,
                    phoneNumberId: s.waNumId,
                    wabaId: s.waId,
                    displayPhoneNumber: null,
                    qualityRating: 'ERROR',
                    error: data.error?.message || 'Failed to fetch'
                });
            }
        } catch (e) {
            results.push({
                businessId: s.businessId,
                businessName: businessMap[s.businessId] || 'Unnamed',
                phoneNumberId: s.waNumId,
                qualityRating: 'ERROR',
                error: e.message
            });
        }
    }

    return results;
}

module.exports = {
    recordWebhookBillingEvent,
    getBillingOverview,
    getActiveRates,
    saveRatesConfig,
    fetchMetaPhoneHealth,
    DEFAULT_RATES
};
