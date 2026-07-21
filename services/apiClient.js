const axios = require('axios');
const https = require('https');

/**
 * API Client Service
 * Handles fetching tracking data from provider APIs
 */
class ApiClient {
    constructor() {
        this.dtdcJar = null;
        this.dtdcClient = null;
        this.dtdcTrackToken = null;
        this.ocrWorker = null;
    }

    /**
     * Lazily initializes and caches the Tesseract OCR worker for CAPTCHA solving
     */
    async getOcrWorker() {
        if (this.ocrWorker) return this.ocrWorker;

        const { createWorker } = require('tesseract.js');
        const path = require('path');
        this.ocrWorker = await createWorker('eng', 1, {
            cachePath: path.join(__dirname, '..', 'tessdata')
        });
        await this.ocrWorker.setParameters({
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
            tessedit_pageseg_mode: '7'
        });
        return this.ocrWorker;
    }

    /**
     * Gracefully terminates cached OCR worker if needed
     */
    async terminateOcrWorker() {
        if (this.ocrWorker) {
            try {
                await this.ocrWorker.terminate();
            } catch (err) {
                console.warn('⚠️ Error terminating OCR worker:', err.message);
            }
            this.ocrWorker = null;
        }
    }

    /**
     * Lazily initializes the cookie-jar and wrapped axios client for DTDC
     */
    async initDtdcClient() {
        if (this.dtdcClient) return;
        const { CookieJar } = require('tough-cookie');
        const { wrapper } = await import('axios-cookiejar-support');
        this.dtdcJar = new CookieJar();
        this.dtdcClient = wrapper(axios.create({
            jar: this.dtdcJar,
            withCredentials: true,
            timeout: 30000
        }));
    }

    /**
     * Fetch tracking data from provider API
     */
    async fetchTrackingData(provider, trackingId) {
        if (!provider?.apiConfig?.endpoint) {
            throw new Error('Provider API configuration not found');
        }

        const { endpoint, method, headers, requestBodyTemplate } = provider.apiConfig;

        try {
            console.log(`📡 Fetching tracking data from ${provider.name} API for ${trackingId}`);

            // Build final URL (replaces {trackingId} if present)
            const finalUrl = endpoint.includes("{trackingId}")
                ? endpoint.replace("{trackingId}", trackingId)
                : endpoint;

            const config = {
                method: method || 'POST',
                url: finalUrl,
                headers: this.buildHeaders(headers),
                timeout: 30000,
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false,
                    secureOptions: require('constants').SSL_OP_LEGACY_SERVER_CONNECT
                })
            };

            const isDtdc = provider.name.toLowerCase().includes("dtdc");
            if (isDtdc) {
                await this.initDtdcClient();
                if (!this.dtdcTrackToken) {
                    const headersObj = this.buildHeaders(headers);
                    this.dtdcTrackToken = headersObj['x-dtdc-track-token'] || headersObj['X-DTDC-Track-Token'] || null;
                }
                
                if (!this.dtdcTrackToken) {
                    await this.refreshDtdcToken();
                }
                config.headers['x-dtdc-track-token'] = this.dtdcTrackToken;
            }

            // 🔍 Print the request URL before calling axios
            console.log("🔍 Request URL:", config.url);

            if (requestBodyTemplate) {
                config.data = this.buildRequestBody(requestBodyTemplate, trackingId);
            }

            let response;
            if (isDtdc) {
                config.jar = this.dtdcJar;
                config.withCredentials = true;
                delete config.httpsAgent;
                try {
                    response = await this.dtdcClient(config);
                    if (response.data && response.data.success === false) {
                        console.log('🔄 Response returned success: false. Refreshing DTDC token and retrying...');
                        await this.refreshDtdcToken();
                        config.headers['x-dtdc-track-token'] = this.dtdcTrackToken;
                        response = await this.dtdcClient(config);
                    }
                } catch (error) {
                    const isSecurityError = error.response && (
                        error.response.status === 403 || 
                        (error.response.data && error.response.data.success === false)
                    );
                    if (isSecurityError) {
                        console.log('🔄 Security verification failed or token expired. Refreshing DTDC token and retrying...');
                        await this.refreshDtdcToken();
                        config.headers['x-dtdc-track-token'] = this.dtdcTrackToken;
                        response = await this.dtdcClient(config);
                    } else {
                        throw error;
                    }
                }
            } else {
                response = await axios(config);
            }

            console.log(`✅ Successfully fetched data from ${provider.name} API`);
            return {
                data: response.data,
                requestUrl: config.url,
                requestHeaders: config.headers,
                responseStatus: response.status
            };

        } catch (error) {
            console.error(`❌ Error fetching from ${provider.name} API:`, error.message);

            if (error.response) {
                throw new Error(`API Error: ${error.response.status} - ${error.response.statusText}`);
            } else if (error.request) {
                throw new Error('No response from API - network error or timeout');
            } else {
                throw new Error(`Request setup error: ${error.message}`);
            }
        }
    }

    /**
     * Preprocesses the raw captcha PNG buffer to binarize, scale, pad, and remove line noise
     * @param {Buffer} rawBuffer - Base64 decoded PNG buffer
     * @param {Object|number} options - Preprocessing parameters (scale, pad, threshold, thresholdPercentile, erodeMinCount)
     */
    preprocessCaptcha(rawBuffer, options = {}) {
        const {
            scale = 3,
            pad = 20,
            threshold = 360,
            thresholdPercentile = null,
            erodeMinCount = 4
        } = typeof options === 'number' ? { threshold: options } : options;

        const PNG = require('pngjs').PNG;
        return new Promise((resolve, reject) => {
            const png = new PNG();
            png.parse(rawBuffer, (err, data) => {
                if (err) return reject(err);
                const w = data.width;
                const h = data.height;

                // Determine effective threshold (adaptive percentile or static value)
                let effectiveThreshold = threshold;
                if (thresholdPercentile !== null) {
                    const sums = new Uint16Array(w * h);
                    for (let i = 0; i < w * h; i++) {
                        const idx = i << 2;
                        sums[i] = data.data[idx] + data.data[idx+1] + data.data[idx+2];
                    }
                    const sorted = Array.from(sums).sort((a, b) => a - b);
                    effectiveThreshold = sorted[Math.floor(sorted.length * thresholdPercentile)];
                }

                // 1. Initial Binarization
                const grid = new Uint8Array(w * h);
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const idx = (w * y + x) << 2;
                        const sum = data.data[idx] + data.data[idx+1] + data.data[idx+2];
                        grid[w * y + x] = (sum <= effectiveThreshold) ? 1 : 0;
                    }
                }

                // 2. Binary Erosion to filter out thin lines/noise
                const cleanGrid = new Uint8Array(w * h);
                for (let y = 1; y < h - 1; y++) {
                    for (let x = 1; x < w - 1; x++) {
                        if (grid[w * y + x] === 1) {
                            let count = 0;
                            for (let ny = -1; ny <= 1; ny++) {
                                for (let nx = -1; nx <= 1; nx++) {
                                    if (grid[w * (y + ny) + (x + nx)] === 1) {
                                        count++;
                                    }
                                }
                            }
                            if (count >= erodeMinCount) {
                                cleanGrid[w * y + x] = 1;
                            }
                        }
                    }
                }

                // 3. Construct Scaled & Padded Target Image Buffer
                const newW = w * scale + pad * 2;
                const newH = h * scale + pad * 2;
                const outPng = new PNG({ width: newW, height: newH });

                // Fill background with white (255, 255, 255, 255)
                outPng.data.fill(255);

                // Draw scaled dark pixels
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        if (cleanGrid[w * y + x] === 1) {
                            for (let sy = 0; sy < scale; sy++) {
                                for (let sx = 0; sx < scale; sx++) {
                                    const outX = pad + x * scale + sx;
                                    const outY = pad + y * scale + sy;
                                    const outIdx = (newW * outY + outX) << 2;
                                    outPng.data[outIdx] = 0;
                                    outPng.data[outIdx+1] = 0;
                                    outPng.data[outIdx+2] = 0;
                                    outPng.data[outIdx+3] = 255;
                                }
                            }
                        }
                    }
                }

                const chunks = [];
                outPng.pack()
                    .on('data', chunk => chunks.push(chunk))
                    .on('end', () => resolve(Buffer.concat(chunks)))
                    .on('error', reject);
            });
        });
    }

    /**
     * Fetches captcha, solves it using multi-strategy OCR solver, and validates to obtain fresh DTDC token
     */
    async refreshDtdcToken() {
        console.log('🔄 Refreshing DTDC session and token via local OCR solver...');
        await this.initDtdcClient();
        const worker = await this.getOcrWorker();

        const maxSessionAttempts = 5;
        let successfulToken = null;

        const strategies = [
            { scale: 3, pad: 20, thresholdPercentile: 0.14, erodeMinCount: 4 },
            { scale: 3, pad: 20, thresholdPercentile: 0.16, erodeMinCount: 4 },
            { scale: 3, pad: 20, threshold: 360, erodeMinCount: 4 },
            { scale: 3, pad: 25, thresholdPercentile: 0.18, erodeMinCount: 3 },
            { scale: 4, pad: 20, threshold: 380, erodeMinCount: 4 }
        ];

        for (let sessionAttempt = 1; sessionAttempt <= maxSessionAttempts; sessionAttempt++) {
            try {
                console.log(`📡 Captcha session attempt ${sessionAttempt}/${maxSessionAttempts}...`);
                
                // 1. Fetch generate-captcha to get key, image and establish session cookies
                const captchaUrl = `https://www.dtdc.com/wp-json/custom/v1/generate-captcha?t=${Date.now()}`;
                const captchaRes = await this.dtdcClient.get(captchaUrl, {
                    headers: {
                        'accept': '*/*',
                        'referer': 'https://www.dtdc.com/track-your-shipment/',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'
                    }
                });

                const { key, image } = captchaRes.data;
                if (!key || !image) {
                    throw new Error('Failed to retrieve key or image from DTDC captcha generator');
                }

                const rawBuffer = Buffer.from(image, 'base64');
                const triedValues = new Set();

                // 2. Try multi-strategy OCR solving on the SAME captcha image
                for (let sIdx = 0; sIdx < strategies.length; sIdx++) {
                    const strat = strategies[sIdx];
                    const cleanBuffer = await this.preprocessCaptcha(rawBuffer, strat);
                    const ocrResult = await worker.recognize(cleanBuffer);
                    const captchaValue = ocrResult.data.text.replace(/[^A-Z0-9]/g, '').trim();

                    if (!captchaValue || captchaValue.length < 4) continue;
                    if (triedValues.has(captchaValue)) continue;
                    triedValues.add(captchaValue);

                    console.log(`  > Strategy #${sIdx + 1} guess: ${captchaValue}`);

                    // 3. Validate captcha to get the JWT token
                    const validateUrl = 'https://www.dtdc.com/wp-json/custom/v1/captcha/validate';
                    const validateRes = await this.dtdcClient.post(validateUrl, {
                        captchaKey: key,
                        captchaValue: captchaValue
                    }, {
                        headers: {
                            'content-type': 'application/json',
                            'referer': 'https://www.dtdc.com/track-your-shipment/',
                            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'
                        }
                    });

                    if (validateRes.data && validateRes.data.success && validateRes.data.token) {
                        successfulToken = validateRes.data.token;
                        console.log(`🎉 SUCCESS! Obtained fresh DTDC token on session attempt #${sessionAttempt} using Strategy #${sIdx + 1}`);
                        break;
                    } else {
                        console.log(`  ❌ Strategy #${sIdx + 1} validation failed: ${validateRes.data.message || 'Invalid captcha'}`);
                    }
                }

                if (successfulToken) break;

            } catch (attemptErr) {
                console.warn(`⚠️ Captcha session attempt ${sessionAttempt} failed: ${attemptErr.message}`);
            }

            // Delay between session attempts
            await new Promise(r => setTimeout(r, 500));
        }

        if (!successfulToken) {
            throw new Error(`Failed to obtain a valid DTDC token after ${maxSessionAttempts} captcha sessions.`);
        }

        this.dtdcTrackToken = successfulToken;

        // Save the new token to database so other worker instances can reuse it
        try {
            const Provider = require('../models/Provider');
            await Provider.findOneAndUpdate(
                { name: 'DTDC' },
                { 
                    $set: { 
                        'apiConfig.headers.x-dtdc-track-token': this.dtdcTrackToken 
                    } 
                }
            );
            console.log('💾 Persisted fresh DTDC token to database.');
        } catch (dbErr) {
            console.warn('⚠️ Could not persist DTDC token to DB:', dbErr.message);
        }
    }


    /**
     * Build headers object
     */
    buildHeaders(headers) {
        if (!headers) return {};

        if (headers instanceof Map) {
            const obj = {};
            headers.forEach((v, k) => obj[k] = v);
            return obj;
        }

        return headers;
    }

    /**
     * Build request body from template
     */
    buildRequestBody(template, trackingId) {
        try {
            const bodyString = template.replace(/{trackingId}/g, trackingId);
            return JSON.parse(bodyString);
        } catch (error) {
            console.error("❌ Error parsing request body template:", error);
            throw new Error("Invalid request body template");
        }
    }

    /**
     * Parse API response → Normalized DB object
     */
    parseResponse(apiResponse, provider, trackingId) {
        const trackingData = {
            provider: provider.name,
            originalTrackingId: trackingId,
            lastUpdated: new Date(),
            rawResponse: apiResponse
        };

        console.log('Provider Name Check:', provider.name, 'Lower:', provider.name.toLowerCase());

        if (provider.name.toLowerCase().includes("dtdc")) {
            return this.parseDTDCResponse(apiResponse, trackingData);
        }

        if (provider.name.includes("ICL")) {
            return this.parseICLResponse(apiResponse, trackingData);
        }

        if (provider.name.toLowerCase().includes("xpressbees")) {
            console.log('Routing to XpressBees Parser');
            return this.parseXpressBeesResponse(apiResponse, trackingData);
        }

        if (provider.name.toLowerCase().includes("delhivery")) {
            return this.parseDelhiveryResponse(apiResponse, trackingData);
        }

        console.log('Routing to Generic Parser');

        return this.parseGenericResponse(apiResponse, trackingData);
    }

    /**
     * XpressBees-specific parser
     */
    parseXpressBeesResponse(apiResponse, trackingData) {
        try {
            // Check if response has data array
            if (!apiResponse.data || !Array.isArray(apiResponse.data) || apiResponse.data.length === 0) {
                trackingData.status = "No data found";
                return trackingData;
            }

            const latest = apiResponse.data[0];

            // Check if any history item indicates delivery
            const deliveredItem = apiResponse.data.find(d =>
                d.label && d.label.toLowerCase().includes('delivered')
            );

            if (deliveredItem) {
                trackingData.status = this.normalizeStatus(deliveredItem.label);
                trackingData.location = deliveredItem.location || latest.location;
            } else {
                trackingData.status = this.normalizeStatus(latest.label || "In Transit");
                trackingData.location = latest.location || "Unknown";
            }

            // Map history
            trackingData.history = apiResponse.data.map(item => ({
                timestamp: this.parseISTDate(item.shipmentDate),
                status: this.cleanText(item.label || "Update"),
                location: this.cleanText(item.location || ""),
                description: this.cleanText(item.label || "")
            }));

            return trackingData;
        } catch (err) {
            console.error("❌ Error parsing XpressBees:", err);
            trackingData.status = "Error parsing XpressBees response";
            return trackingData;
        }
    }

    /**
     * Delhivery-specific parser
     */
    parseDelhiveryResponse(apiResponse, trackingData) {
        try {
            // Check if response has data array
            if (!apiResponse.data || !Array.isArray(apiResponse.data) || apiResponse.data.length === 0) {
                trackingData.status = "No data found";
                return trackingData;
            }

            const shipment = apiResponse.data[0];
            const statusObj = shipment.status || {};

            // Extract scans from either top-level or trackingStates (Unified Tracking API format)
            let scans = shipment.scans || [];
            if ((!scans || scans.length === 0) && shipment.trackingStates) {
                // Flatten scans from all tracking states
                scans = shipment.trackingStates.flatMap(state => state.scans || []);
            }

            // Normalize and determine latest status
            trackingData.status = this.normalizeStatus(statusObj.status || shipment.hqStatus || "In Transit");

            // Origin and Destination
            trackingData.origin = shipment.origin || "";
            trackingData.destination = shipment.destination || "";

            // Deliver Date
            trackingData.estimatedDelivery = this.parseISTDate(shipment.promiseDeliveryDate || shipment.expectedDeliveryDate, true);

            // Map history
            trackingData.history = scans.map(scan => ({
                timestamp: this.parseISTDate(scan.scanDateTime || scan.scanDate),
                status: this.cleanText(scan.scan || scan.scanType || "Update"),
                location: this.cleanText(scan.scannedLocation || scan.scanLocation || scan.cityLocation || ""),
                description: this.cleanText(scan.instructions || scan.message || scan.scanNslRemark || "")
            }));

            // Sort history by timestamp descending and remove duplicates based on status + timestamp
            trackingData.history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            // Filter duplicates (some items might appear in multiple states)
            trackingData.history = trackingData.history.filter((item, index, self) =>
                index === self.findIndex((t) => (
                    t.timestamp.toString() === item.timestamp.toString() && t.status === item.status
                ))
            );

            // Update current location from the latest scan if not already set
            if (trackingData.history.length > 0) {
                trackingData.location = trackingData.history[0].location || statusObj.statusLocation || "Unknown";
            } else {
                trackingData.location = statusObj.statusLocation || "Unknown";
            }

            return trackingData;
        } catch (err) {
            console.error("❌ Error parsing Delhivery:", err);
            trackingData.status = "Error parsing Delhivery response";
            return trackingData;
        }
    }

    /**
     * DTDC-specific parser
     */
    parseDTDCResponse(apiResponse, trackingData) {
        const payload = apiResponse?.response || apiResponse || {};

        // Support the new schema (header, milestones, and statuses)
        if (payload.header || Array.isArray(payload.milestones) || Array.isArray(payload.statuses)) {
            const header = payload.header || {};
            const milestones = Array.isArray(payload.milestones) ? payload.milestones : [];
            const statuses = Array.isArray(payload.statuses) ? payload.statuses : [];
            const activeMilestones = milestones.filter(mile => mile.mileStatus === 'A');

            // Detect if shipment has reached Delivered state
            const isDeliveredInHeader = header.currentStatusDescription === 'Delivered' || header.currentStatusCode === 'DLV';
            const isDeliveredInMilestones = activeMilestones.some(m => (m.mileName || '').toLowerCase().includes('delivered'));
            const isDeliveredInStatuses = statuses.some(s => 
                (s.statusDescription || '').toLowerCase().includes('delivered') || 
                (s.remarks || '').toLowerCase().includes('delivered')
            );
            const hasDeliveredState = isDeliveredInHeader || isDeliveredInMilestones || isDeliveredInStatuses;

            // 1. Current Status
            let statusStr = '';
            if (hasDeliveredState) {
                statusStr = 'Delivered';
            } else {
                statusStr = header.currentStatusDescription;
                if (!statusStr && statuses.length > 0) {
                    statusStr = statuses[0].statusDescription || statuses[0].status;
                }
                if (!statusStr && activeMilestones.length > 0) {
                    statusStr = activeMilestones[activeMilestones.length - 1].mileName;
                }
            }
            trackingData.status = this.normalizeStatus(statusStr || 'In Transit');

            // 2. Origin and Destination
            trackingData.origin = header.originCity || '';
            trackingData.destination = header.destinationCity || '';

            // 3. Estimated Delivery
            trackingData.estimatedDelivery = header.opsEdd ? this.parseISTDate(header.opsEdd, true) : null;

            // 4. Map History Events with Smart Timestamp Fallback
            let rawHistory = [];

            if (statuses.length > 0) {
                rawHistory = statuses.map(s => {
                    let sText = s.statusDescription || s.status;
                    if (!sText && s.remarks) {
                        sText = this.cleanText(s.remarks);
                        if (!sText || sText.length > 100) sText = "Update";
                    }
                    if (!sText) sText = "In Transit";

                    const locText = s.actCityName || s.actBranchName || s.actBranchCode || s.location || '';
                    const parsedDate = s.statusTimestamp ? this.parseISTDate(s.statusTimestamp, true) : null;

                    return {
                        timestamp: parsedDate || (header.bookingDate ? this.parseISTDate(header.bookingDate) : new Date(0)),
                        status: this.cleanText(sText),
                        location: this.cleanText(locText),
                        description: this.cleanText(s.remarks || s.statusDescription || sText)
                    };
                });
            } else if (activeMilestones.length > 0) {
                let lastValidTimestamp = header.bookingDate ? this.parseISTDate(header.bookingDate) : new Date(0);

                rawHistory = activeMilestones.map(mile => {
                    let timestamp = null;
                    if (mile.mileStatusDateTime && mile.mileStatusDateTime.trim() !== '') {
                        timestamp = this.parseISTDate(mile.mileStatusDateTime, true);
                    }

                    if (timestamp) {
                        lastValidTimestamp = timestamp;
                    } else {
                        timestamp = new Date(lastValidTimestamp);
                    }

                    return {
                        timestamp: timestamp,
                        status: this.cleanText(mile.mileName || 'Update'),
                        location: this.cleanText(mile.mileLocationName || ''),
                        description: this.cleanText(mile.mileName || '')
                    };
                });
            }

            // Ensure history is sorted descending by timestamp (newest update at index 0)
            rawHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            trackingData.history = rawHistory;

            // 5. Determine Current Location Accurately
            let currentLocation = '';

            if (hasDeliveredState) {
                const deliveredScan = statuses.find(s => 
                    (s.statusDescription || '').toLowerCase().includes('delivered') ||
                    (s.remarks || '').toLowerCase().includes('delivered')
                );
                if (deliveredScan) {
                    currentLocation = deliveredScan.actCityName || deliveredScan.actBranchName || deliveredScan.actBranchCode || '';
                }
                if (!currentLocation) {
                    const deliveredMilestone = activeMilestones.find(m => (m.mileName || '').toLowerCase().includes('delivered'));
                    if (deliveredMilestone) {
                        currentLocation = deliveredMilestone.mileLocationName || '';
                    }
                }
                if (!currentLocation) {
                    currentLocation = trackingData.destination || header.destinationCity || '';
                }
            }

            if (!currentLocation && statuses.length > 0) {
                const latestScan = statuses[0];
                currentLocation = latestScan.actCityName || latestScan.actBranchName || latestScan.actBranchCode || latestScan.location || '';
            }

            if (!currentLocation && activeMilestones.length > 0) {
                const latestMilestone = activeMilestones[activeMilestones.length - 1];
                currentLocation = latestMilestone.mileLocationName || '';
            }

            if (!currentLocation) {
                currentLocation = header.currentStatusCity || header.originCity || 'Unknown';
            }

            trackingData.location = this.cleanText(currentLocation);

            return trackingData;
        }

        // Support old schema fallback
        if (payload.statusCode === 200 && Array.isArray(payload.statuses)) {
            const statuses = payload.statuses;

            if (statuses.length > 0) {
                const latest = statuses[0];

                const statusStr = latest.statusDescription || latest.status || (latest.remarks ? latest.remarks.replace(/<[^>]*>?/gm, '').trim() : 'In Transit');
                trackingData.status = this.normalizeStatus(statusStr);

                let loc = latest.actCityName || latest.actBranchName || latest.actBranchCode || latest.location || '';
                if (!loc && trackingData.status === 'Delivered' && trackingData.destination) {
                    loc = trackingData.destination;
                }
                trackingData.location = this.cleanText(loc || 'Unknown');

                trackingData.history = statuses.map(s => {
                    let sText = s.statusDescription || s.status;
                    if (!sText && s.remarks) {
                        sText = this.cleanText(s.remarks);
                        if (!sText || sText.length > 100) sText = "Update";
                    }
                    if (!sText) sText = "In Transit";

                    const locText = s.actCityName || s.actBranchName || s.actBranchCode || s.location || '';

                    return {
                        timestamp: this.parseISTDate(s.statusTimestamp || s.date),
                        status: this.cleanText(sText),
                        location: this.cleanText(locText),
                        description: this.cleanText(s.remarks || s.statusDescription || sText)
                    };
                });
            } else {
                trackingData.status = payload.statusDescription || 'No tracking info';
                trackingData.location = 'Unknown';
            }
        } else {
            trackingData.status = payload.statusDescription || 'Unable to fetch tracking data';
            trackingData.location = 'Unknown';
        }

        return trackingData;
    }

    /**
     * ICL-specific parser (handles both Domestic and International)
     */
    parseICLResponse(apiResponse, trackingData) {
        try {
            // Check if this is ICL International format
            if (apiResponse.Response && apiResponse.Response.Tracking) {
                return this.parseICLInternationalResponse(apiResponse, trackingData);
            }

            // Check if this is ICL Domestic format
            if (!apiResponse.ConsignmentDetails_Traking) {
                console.log("⚠️ Unknown ICL format. Using generic parser.");
                return this.parseGenericResponse(apiResponse, trackingData);
            }

            const consignment = apiResponse.ConsignmentDetails_Traking || {};
            const history = apiResponse.Sheet_History || [];

            // Map and sort history first
            trackingData.history = history.map(item => ({
                timestamp: this.parseISTDate(item.status_date),
                status: this.cleanText(item.status || "Update"),
                location: this.cleanText(item.dispatch_location_name || ""),
                description: this.cleanText(item.Remarks || item.status || "")
            })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            let currentStatus = consignment.current_status_name || "In Transit";

            // If current status is "Pod Uploaded", fall back to the most recent useful history status
            if (currentStatus.toLowerCase().includes('pod upload') || currentStatus.toLowerCase().includes('pod update')) {
                const usefulHistory = trackingData.history.find(h =>
                    h.status &&
                    !h.status.toLowerCase().includes('pod upload') &&
                    !h.status.toLowerCase().includes('pod update')
                );
                if (usefulHistory) {
                    currentStatus = usefulHistory.status;
                }
            }

            trackingData.status = this.normalizeStatus(currentStatus);
            trackingData.location = consignment.current_location_name || "Unknown";
            trackingData.estimatedDelivery = consignment.ExpectedDeliveryDate ? this.parseICLDate(consignment.ExpectedDeliveryDate) : null;
            trackingData.origin = consignment.origin_name || "";
            trackingData.destination = consignment.dest_name || "";

            trackingData.additionalInfo = {
                consignmentNo: consignment.consignment_no,
                consignmentDate: consignment.date_of_booking,
                pieces: consignment.no_of_pieces,
                weight: consignment.actual_weight,
                service: consignment.service_name,
                carrier: consignment.carrier_name
            };

            return trackingData;

        } catch (err) {
            console.error("❌ Error parsing ICL:", err);
            trackingData.status = "In Transit";
            return trackingData;
        }
    }

    /**
     * Parse date assuming IST if no timezone present
     * @param {string} dateStr - Date string to parse
     * @param {boolean} returnNullOnFailure - Whether to return null or new Date() on failure
     */
    parseISTDate(dateStr, returnNullOnFailure = false) {
        try {
            if (!dateStr) return returnNullOnFailure ? null : new Date();
            
            if (typeof dateStr !== 'string') {
                const date = new Date(dateStr);
                return isNaN(date.getTime()) ? (returnNullOnFailure ? null : new Date()) : date;
            }

            // Handle DD/MM/YYYY
            if (dateStr.includes('/') && !dateStr.includes('-')) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    const [day, month, year] = parts;
                    // Format year-month-day and add IST offset
                    // Pad month and day to ensure 2 digits
                    const d = day.trim().padStart(2, '0');
                    const m = month.trim().padStart(2, '0');
                    const y = year.trim();
                    
                    const date = new Date(`${y}-${m}-${d}T00:00:00+05:30`);
                    if (!isNaN(date.getTime())) return date;
                }
            }

            // Check if string intentionally contains a timezone indicator (Z, +HH:mm, -HH:mm) at the end
            const hasTimezone = /Z|[+-]\d{2}:?\d{2}$/.test(dateStr);

            if (hasTimezone) {
                const date = new Date(dateStr);
                if (!isNaN(date.getTime())) return date;
            }

            // If it looks like an ISO-ish string but has no timezone, append IST
            // Also handle space-separated dates like "2024-02-26 11:16:06"
            let normalizedDate = dateStr.replace(' ', 'T');
            const date = new Date(`${normalizedDate}${normalizedDate.includes('T') ? '' : 'T00:00:00'}+05:30`);
            if (!isNaN(date.getTime())) return date;

            // Final fallback to native parsing
            const finalDate = new Date(dateStr);
            return isNaN(finalDate.getTime()) ? (returnNullOnFailure ? null : new Date()) : finalDate;
        } catch (e) {
            return returnNullOnFailure ? null : new Date();
        }
    }

    /**
     * ICL International-specific parser
     */
    parseICLInternationalResponse(apiResponse, trackingData) {
        try {
            const response = apiResponse.Response;
            const tracking = response.Tracking && response.Tracking[0];
            const events = response.Events || [];
            const additionalData = response.AdditionalData && response.AdditionalData[0];

            if (!tracking) {
                trackingData.status = "No tracking data found";
                return trackingData;
            }

            trackingData.status = this.normalizeStatus(tracking.Status || "In Transit");
            trackingData.location = events.length > 0 ? events[0].Location : "Unknown";
            trackingData.estimatedDelivery = tracking.ExpectedDeliveryDate ? this.parseICLDate(tracking.ExpectedDeliveryDate) : null;
            trackingData.origin = tracking.Origin || "";
            trackingData.destination = tracking.Destination || "";

            // Parse events into history
            trackingData.history = events.map(event => ({
                timestamp: this.parseICLDate(event.EventDate, event.EventTime),
                status: this.toTitleCase(event.Status) || "Update",
                location: event.Location || "",
                description: event.Status || ""
            }));

            // Additional info
            trackingData.additionalInfo = {
                awbNo: tracking.AWBNo,
                bookingDate: tracking.BookingDate1,
                deliveryDate: tracking.DeliveryDate1,
                deliveryTime: tracking.DeliveryTime1,
                receiverName: tracking.ReceiverName,
                vendorName: tracking.VendorName,
                vendorAWBNo: tracking.VendorAWBNo1,
                serviceName: tracking.ServiceName,
                weight: tracking.Weight,
                pieces: additionalData?.Pieces,
                shipper: additionalData?.ShipperContact,
                consignee: additionalData?.ConsigneeContact
            };

            return trackingData;

        } catch (err) {
            console.error("❌ Error parsing ICL International:", err);
            trackingData.status = "In Transit";
            return trackingData;
        }
    }

    /**
     * Parse ICL date format (DD/MM/YYYY) and time (HHMM)
     */
    parseICLDate(dateStr, timeStr) {
        try {
            if (!dateStr) return null;
            if (typeof dateStr !== 'string') return new Date(dateStr);

            if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    const [day, month, year] = parts;
                    const hour = (timeStr && typeof timeStr === 'string') ? timeStr.substring(0, 2).padStart(2, '0') : '00';
                    const minute = (timeStr && typeof timeStr === 'string') ? timeStr.substring(2, 4).padStart(2, '0') : '00';
                    const date = new Date(`${year.trim()}-${month.trim().padStart(2, '0')}-${day.trim().padStart(2, '0')}T${hour}:${minute}:00+05:30`);
                    if (!isNaN(date.getTime())) return date;
                }
            }
            
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? null : date;
        } catch (e) {
            console.error("Error parsing ICL Date:", dateStr, e);
            return null;
        }
    }

    /**
     * Fallback generic parser
     */
    parseGenericResponse(apiResponse, trackingData) {
        const fieldSets = {
            status: ['status', 'shipmentStatus', 'trackingStatus', 'deliveryStatus'],
            location: ['location', 'currentLocation', 'lastLocation'],
            estimatedDelivery: ['estimatedDelivery', 'expectedDelivery', 'eta', 'deliveryDate'],
            origin: ['origin', 'originLocation', 'pickupLocation'],
            destination: ['destination', 'destinationLocation', 'toLocation'],
            history: ['history', 'events', 'trackingHistory', 'shipmentHistory', 'scans']
        };

        trackingData.status = this.normalizeStatus(this.extractField(apiResponse, fieldSets.status) || 'In Transit');
        trackingData.location = this.extractField(apiResponse, fieldSets.location) || 'Unknown';
        
        const estDelivery = this.extractField(apiResponse, fieldSets.estimatedDelivery);
        trackingData.estimatedDelivery = this.parseISTDate(estDelivery, true);
        
        trackingData.origin = this.extractField(apiResponse, fieldSets.origin);
        trackingData.destination = this.extractField(apiResponse, fieldSets.destination);

        const history = this.extractField(apiResponse, fieldSets.history);
        if (Array.isArray(history)) {
            trackingData.history = history.map(event => ({
                timestamp: this.parseISTDate(event.timestamp || event.date),
                status: event.status || event.description || "Update",
                location: event.location || "",
                description: event.description || event.remarks || ""
            }));
        }

        return trackingData;
    }

    /**
     * Convert string to Title Case
     */
    toTitleCase(str) {
        if (!str) return '';
        return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
    }

    /**
     * Normalize status strings to consistent format
     */
    normalizeStatus(status) {
        if (!status) return 'In Transit';
        const s = status.toLowerCase().trim();

        // Exact matches or very clear patterns
        if (s.includes('delivered')) return 'Delivered';
        if (s.includes('out for delivery') || s.includes('out_delivery')) return 'Out for Delivery';
        if (s.includes('transit') || s.includes('shipped') || s.includes('dispatched')) return 'In Transit';
        if (s.includes('pickup') || s.includes('booked') || s.includes('pending')) return 'Pending';
        if (s.includes('exception') || s.includes('delay') || s.includes('failed') || s.includes('issue')) return 'Exception';

        // Capitalize for display if no match
        return this.toTitleCase(status);
    }

    /**
     * Try multiple field names
     */
    extractField(obj, fields) {
        for (const f of fields) {
            if (obj?.[f] !== undefined && obj?.[f] !== null) return obj[f];

            const nested = this.searchNested(obj, f);
            if (nested !== null) return nested;
        }
        return null;
    }

    /**
     * Recursive nested search
     */
    searchNested(obj, field) {
        if (!obj || typeof obj !== "object") return null;

        if (obj[field] !== undefined && obj[field] !== null) return obj[field];

        for (const key in obj) {
            if (typeof obj[key] === "object") {
                const result = this.searchNested(obj[key], field);
                if (result !== null) return result;
            }
        }
        return null;
    }
    /**
     * Remove HTML tags and URLs from text
     */
    cleanText(text) {
        if (!text) return "";
        if (typeof text !== 'string') return String(text);

        // Remove HTML tags
        let clean = text.replace(/<[^>]*>?/gm, '');

        // Remove URLs (http/https/ftp)
        clean = clean.replace(/(?:https?|ftp):\/\/[\n\S]+/g, '');

        // Remove www. URLs
        clean = clean.replace(/www\.[\n\S]+/g, '');

        return clean.trim();
    }
}

module.exports = new ApiClient();