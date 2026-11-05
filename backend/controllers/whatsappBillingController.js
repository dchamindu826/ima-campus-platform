const whatsappBillingService = require('../services/whatsappBillingService');

/**
 * GET /api/admin/whatsapp-billing/overview
 */
exports.getOverview = async (req, res) => {
    try {
        const { range = 'this_month', businessId, startDate, endDate } = req.query;
        const data = await whatsappBillingService.getBillingOverview({
            range,
            businessId,
            startDate,
            endDate
        });
        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('[WhatsAppBillingController] getOverview error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /api/admin/whatsapp-billing/rates
 */
exports.getRates = async (req, res) => {
    try {
        const rates = await whatsappBillingService.getActiveRates();
        res.status(200).json({ success: true, rates });
    } catch (error) {
        console.error('[WhatsAppBillingController] getRates error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * PUT /api/admin/whatsapp-billing/rates
 */
exports.updateRates = async (req, res) => {
    try {
        const rates = req.body;
        const saved = await whatsappBillingService.saveRatesConfig(rates);
        res.status(200).json({ success: true, message: 'Pricing rates updated successfully', rates: saved });
    } catch (error) {
        console.error('[WhatsAppBillingController] updateRates error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /api/admin/whatsapp-billing/health
 */
exports.getMetaHealth = async (req, res) => {
    try {
        const health = await whatsappBillingService.fetchMetaPhoneHealth();
        res.status(200).json({ success: true, health });
    } catch (error) {
        console.error('[WhatsAppBillingController] getMetaHealth error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /api/admin/whatsapp-billing/export
 */
exports.exportBillingCsv = async (req, res) => {
    try {
        const { range = 'this_month', businessId, startDate, endDate } = req.query;
        const overview = await whatsappBillingService.getBillingOverview({ range, businessId, startDate, endDate });

        const exportItems = overview.allLogs || overview.recentLogs || [];
        for (const log of exportItems) {
            const dateStr = new Date(log.timestamp).toISOString();
            csv += `"${log.id}","${dateStr}","${log.businessName}","${log.displayPhoneNumber || ''}","${log.recipient || ''}","${log.category}","${log.status}","${log.costUsd}","${log.costLkr}"\n`;
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=whatsapp_billing_${range}_${Date.now()}.csv`);
        res.status(200).send(csv);
    } catch (error) {
        console.error('[WhatsAppBillingController] exportBillingCsv error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
