const puppeteer = require('puppeteer');

/**
 * Launches a headless Chrome browser to connect to the React frontend
 * and play the IVR ringtone into a WebRTC call.
 * 
 * @param {object} payload - The WhatsApp call payload including SDP
 */
async function launchIvrBot(payload) {
    const { callId, ringtoneUrl, ivrUrl } = payload;
    let browser;
    try {
        console.log(`[IVR Bot] Launching headless browser for call: ${callId}`);
        
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--autoplay-policy=no-user-gesture-required',
                '--use-fake-ui-for-media-stream',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process'
            ]
        });

        const page = await browser.newPage();

        page.on('console', msg => {
            const text = msg.text();
            console.log(`[IVR Bot Page] ${text}`);
            if (text === 'BOT_DONE') {
                console.log(`[IVR Bot] Received BOT_DONE signal. Closing browser for call: ${callId}`);
                if (browser) browser.close();
            }
        });

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5175';
        const targetUrl = `${frontendUrl}/headless-ivr/${encodeURIComponent(callId)}?ringtoneUrl=${encodeURIComponent(ivrUrl || ringtoneUrl || '')}`;

        console.log(`[IVR Bot] Navigating to: ${targetUrl}`);
        
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

        // Pass the payload directly to the window object and dispatch an event
        await page.evaluate((data) => {
            window.botPayload = data;
            window.dispatchEvent(new CustomEvent('BotPayloadReady'));
        }, payload);

        // Failsafe timeout: Force close the browser after 5 minutes
        // to prevent zombie Chrome processes from eating all server RAM.
        setTimeout(async () => {
            try {
                if (browser) {
                    const pages = await browser.pages();
                    if (pages.length > 0) {
                        console.log(`[IVR Bot] Failsafe timeout reached for call ${callId}. Force closing browser.`);
                        await browser.close();
                    }
                }
            } catch (e) {
                console.error(`[IVR Bot] Error during failsafe cleanup:`, e.message);
            }
        }, 300000);

    } catch (err) {
        console.error(`[IVR Bot] Error launching bot for call ${callId}:`, err);
        if (browser) {
            await browser.close().catch(() => {});
        }
    }
}

module.exports = {
    launchIvrBot
};
