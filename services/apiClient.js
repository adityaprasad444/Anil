const axios = require('axios');
const https = require('https');

/**
 * API Client Service
 * Handles fetching tracking data from provider APIs
 */
class ApiClient {

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

            // 🔍 Print the request URL before calling axios
            console.log("🔍 Request URL:", config.url);

            if (requestBodyTemplate) {
                config.data = this.buildRequestBody(requestBodyTemplate, trackingId);
            }

            const response = await axios(config);

            console.log(`✅ Successfully fetched data from ${provider.name} API`);
            // console.log("Response Data:", response);
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
            const scans = shipment.scans || [];

            trackingData.status = this.normalizeStatus(statusObj.status || "In Transit");
            trackingData.location = statusObj.statusLocation || "Unknown";
            trackingData.origin = shipment.origin || "";
            trackingData.destination = shipment.destination || "";
            // Use deliveryDate_v1 or expectedDeliveryDate if available
            trackingData.estimatedDelivery = shipment.deliveryDate_v1 || shipment.expectedDeliveryDate || null;

            // Map history
            trackingData.history = scans.map(scan => ({
                timestamp: this.parseISTDate(scan.scanDateTime),
                status: this.cleanText(scan.scan || scan.scanType),
                location: this.cleanText(scan.scannedLocation || scan.scanLocation || ""),
                description: this.cleanText(scan.instructions || scan.message || "")
            }));

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
        if (apiResponse.statusCode === 200 && Array.isArray(apiResponse.statuses)) {
            const statuses = apiResponse.statuses;

            if (statuses.length > 0) {
                const latest = statuses[0];

                // Use statusDescription, status, or remarks as fallback
                const statusStr = latest.statusDescription || latest.status || (latest.remarks ? latest.remarks.replace(/<[^>]*>?/gm, '').trim() : 'In Transit');
                trackingData.status = this.normalizeStatus(statusStr);

                // Use branch name/city as location fallback
                trackingData.location = latest.actBranchName || latest.actBranchCode || latest.actCityName || latest.location || '';

                trackingData.history = statuses.map(s => {
                    // Extract clean status text
                    let sText = s.statusDescription || s.status;
                    if (!sText && s.remarks) {
                        sText = this.cleanText(s.remarks);
                        // If it's still empty or just too long, use a default
                        if (!sText || sText.length > 100) sText = "Update";
                    }
                    if (!sText) sText = "In Transit";

                    // Extract location
                    const locText = s.actBranchName || s.actBranchCode || s.actCityName || s.location || '';

                    return {
                        timestamp: this.parseISTDate(s.statusTimestamp || s.date),
                        status: this.cleanText(sText),
                        location: this.cleanText(locText),
                        description: this.cleanText(s.remarks || s.statusDescription || sText)
                    };
                });
            } else {
                trackingData.status = apiResponse.statusDescription || 'No tracking info';
                trackingData.location = 'Unknown';
            }
        } else {
            trackingData.status = apiResponse.statusDescription || 'Unable to fetch tracking data';
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

            trackingData.status = this.normalizeStatus(consignment.current_status_name || "In Transit");
            trackingData.location = consignment.current_location_name || "Unknown";
            trackingData.estimatedDelivery = consignment.ExpectedDeliveryDate || null;
            trackingData.origin = consignment.origin_name || "";
            trackingData.destination = consignment.dest_name || "";

            trackingData.history = history.map(item => ({
                timestamp: this.parseISTDate(item.status_date),
                status: this.cleanText(item.status || "Update"),
                location: this.cleanText(item.dispatch_location_name || ""),
                description: this.cleanText(item.Remarks || item.status || "")
            })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

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
            trackingData.status = "Error parsing ICL response";
            return trackingData;
        }
    }

    /**
     * Parse date assuming IST if no timezone present
     */
    parseISTDate(dateStr) {
        try {
            if (!dateStr) return new Date();

            // Check if string intentionally contains a timezone indicator (Z, +HH:mm, -HH:mm) at the end
            // This avoids catching YYYY-MM-DD dashes
            const hasTimezone = /Z|[+-]\d{2}:?\d{2}$/.test(dateStr);

            if (hasTimezone) {
                return new Date(dateStr);
            }

            // If it looks like an ISO string but has no timezone, append IST
            return new Date(`${dateStr}+05:30`);
        } catch (e) {
            return new Date();
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
            trackingData.estimatedDelivery = tracking.ExpectedDeliveryDate || null;
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
            trackingData.status = "Error parsing ICL International response";
            return trackingData;
        }
    }

    /**
     * Parse ICL date format (DD/MM/YYYY) and time (HHMM)
     */
    parseICLDate(dateStr, timeStr) {
        try {
            if (!dateStr) return new Date();
            const [day, month, year] = dateStr.split('/');
            const hour = timeStr ? timeStr.substring(0, 2) : '00';
            const minute = timeStr ? timeStr.substring(2, 4) : '00';
            // Append IST offset +05:30
            return new Date(`${year}-${month}-${day}T${hour}:${minute}:00+05:30`);
        } catch (e) {
            return new Date();
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
        trackingData.estimatedDelivery = this.extractField(apiResponse, fieldSets.estimatedDelivery);
        trackingData.origin = this.extractField(apiResponse, fieldSets.origin);
        trackingData.destination = this.extractField(apiResponse, fieldSets.destination);

        const history = this.extractField(apiResponse, fieldSets.history);
        if (Array.isArray(history)) {
            trackingData.history = history.map(event => ({
                timestamp: event.timestamp || event.date || new Date(),
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
        if (s.includes('delivered')) return 'Delivered';
        if (s.includes('transit')) return 'In Transit';
        if (s.includes('out for delivery')) return 'Out for Delivery';
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