const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');
const crypto = require('crypto');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

async function getPaycorpClientId(businessId) {
    try {
        const business = await prisma.business.findUnique({
            where: { id: parseInt(businessId) },
            select: { merchantId: true }
        });

        if (business && business.merchantId) {
            return business.merchantId;
        }
    } catch (error) {
        console.error("Error fetching merchantId for business:", error);
    }
    
    // Fallback to the main LIVE client ID if not set
    return "14008328"; 
}

exports.initPayment = async (req, res) => {
    try {
        const { amount, orderId, businessId } = req.body;
        
        if (!amount || !orderId) {
            return res.status(400).json({ success: false, message: 'Amount and Order ID are required' });
        }

        const amountInCents = Math.round(parseFloat(amount) * 100);
        const baseUrl = process.env.FRONTEND_URL || req.headers.origin || 'https://imacampus.online';
        const clientId = await getPaycorpClientId(businessId);
        
        const payload = {
            version: "1.5",
            msgId: uuidv4().toUpperCase(),
            operation: "PAYMENT_INIT",
            requestDate: new Date().toISOString(),
            validateOnly: false,
            requestData: {
                clientId: clientId,
                clientIdHash: "",
                transactionType: "PURCHASE",
                transactionAmount: {
                    totalAmount: 0,
                    paymentAmount: amountInCents,
                    serviceFeeAmount: 0,
                    currency: "LKR"
                },
                redirect: {
                    returnUrl: `${baseUrl}/student/paycorp-return/${businessId}`,
                    cancelUrl: `${baseUrl}/student/paycorp-cancel`,
                    returnMethod: "GET"
                },
                clientRef: orderId.toString(),
                comment: "IMA Campus Payment",
                tokenize: true,
                cssLocation1: "",
                cssLocation2: "",
                useReliability: true
            }
        };

        const payloadString = JSON.stringify(payload);
        
        console.log("PAYCORP INIT REQUEST:");
        console.log("BusinessId:", businessId, "Mapped ClientId:", clientId);
        console.log("Payload String:", payloadString);

        const hmac = crypto.createHmac('sha256', process.env.PAYCORP_HMAC_SECRET)
                           .update(payloadString)
                           .digest('hex');
                           
        console.log("Generated HMAC:", hmac);

        const headers = {
            'Content-Type': 'application/json',
            'AUTHTOKEN': process.env.PAYCORP_AUTH_TOKEN,
            'HMAC': hmac
        };

        try {
            console.log("Sending Axios POST to:", process.env.PAYCORP_ENDPOINT);
            const response = await axios.post(process.env.PAYCORP_ENDPOINT, payload, { headers, timeout: 15000 });
            console.log("Paycorp Init Response Status:", response.status);

            if (response.data && response.data.responseData && response.data.responseData.paymentPageUrl) {
                // Remember the amount THIS server sent to Paycorp for this reqid.
                await require('../src/modules/payments/service').recordGatewayStart('paycorp', response.data.responseData.reqid, {
                    studentId: req.user?.userId || req.user?.id,
                    amount: amountInCents / 100,
                });
                return res.json({
                    success: true,
                    paymentUrl: response.data.responseData.paymentPageUrl,
                    reqid: response.data.responseData.reqid,
                    clientId: clientId // Added for debugging/verification
                });
            } else {
                console.error('Paycorp Init Error Data (Invalid Structure):', response.data);
                return res.status(400).json({ success: false, message: 'Invalid response from Paycorp', error: response.data });
            }
        } catch (axiosError) {
            console.error('Axios Request Error Stack:', axiosError.stack || axiosError);
            console.error('Axios Response Data:', axiosError.response ? axiosError.response.data : 'No response');
            return res.status(500).json({ success: false, message: 'Paycorp API request failed', error: axiosError.message });
        }
    } catch (error) {
        console.error('General Paycorp Request Error:', error.stack || error);
        return res.status(500).json({ success: false, message: 'Paycorp request failed', error: error.message });
    }
};

exports.completePayment = async (req, res) => {
    try {
        const { reqid, businessId } = req.body;

        if (!reqid || !businessId) {
            return res.status(400).json({ success: false, message: 'reqid and businessId are required' });
        }

        const clientId = await getPaycorpClientId(businessId);

        const payload = {
            version: "1.5",
            msgId: uuidv4().toUpperCase(),
            operation: "PAYMENT_COMPLETE",
            requestDate: new Date().toISOString(),
            validateOnly: false,
            requestData: {
                clientId: clientId,
                reqid: reqid
            }
        };

        const payloadString = JSON.stringify(payload);
        const hmac = crypto.createHmac('sha256', process.env.PAYCORP_HMAC_SECRET)
                           .update(payloadString)
                           .digest('hex');

        const headers = {
            'Content-Type': 'application/json',
            'AUTHTOKEN': process.env.PAYCORP_AUTH_TOKEN,
            'HMAC': hmac
        };

        const response = await axios.post(process.env.PAYCORP_ENDPOINT, payload, { headers });

        if (response.data && response.data.responseData) {
            const result = response.data.responseData;
            if (result.responseCode === "00") {
                // Server-to-server confirmation: the paid amount is the amount this server initiated.
                const payService = require('../src/modules/payments/service');
                const started = await payService.readRecord('paycorp', reqid);
                const gatewayCents = result.transactionAmount && result.transactionAmount.paymentAmount;
                const paidAmount = gatewayCents ? gatewayCents / 100 : (started && started.amount);
                await payService.recordGatewayConfirmed('paycorp', reqid, { paidAmount, raw: { responseCode: result.responseCode, txnReference: result.txnReference || null } });
            }
            return res.json({
                success: true,
                status: result.responseCode === "00" ? "success" : "failed",
                data: result
            });
        } else {
            return res.status(400).json({ success: false, message: 'Invalid response from Paycorp', error: response.data });
        }
    } catch (error) {
        console.error('Paycorp Complete Error:', error.response ? error.response.data : error.message);
        return res.status(500).json({ success: false, message: 'Paycorp request failed', error: error.message });
    }
};
