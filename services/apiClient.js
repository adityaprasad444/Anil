const axios = require('axios');

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
            timeout: 30000
        };

        // 🔍 Print the request URL before calling axios
        console.log("🔍 Request URL:", config.url);

        if (requestBodyTemplate) {
            config.data = this.buildRequestBody(requestBodyTemplate, trackingId);
        }

        const response = await axios(config);

        console.log(`✅ Successfully fetched data from ${provider.name} API`);
        return response.data;

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

        if (provider.name.toLowerCase().includes("dtdc")) {
            return this.parseDTDCResponse(apiResponse, trackingData);
        }

        if (provider.name === "ICL") {
            return this.parseICLResponse(apiResponse, trackingData);
        }

        return this.parseGenericResponse(apiResponse, trackingData);
    }

    /**
     * DTDC-specific parser
     */
    parseDTDCResponse(apiResponse, trackingData) {
        if (apiResponse.statusCode === 200 && Array.isArray(apiResponse.statuses)) {
            const statuses = apiResponse.statuses;

            if (statuses.length > 0) {
                const latest = statuses[0];

                trackingData.status = latest.statusDescription || latest.status || 'In Transit';
                trackingData.location = latest.actBranchCode || latest.location || '';

                trackingData.history = statuses.map(s => ({
                    timestamp: s.statusTimestamp || s.date || new Date(),
                    status: s.statusDescription || s.status,
                    location: s.actBranchCode || s.location || '',
                    description: s.remarks || s.statusDescription || ''
                }));
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
     * ICL-specific parser (fixed & clean)
     */
    parseICLResponse(apiResponse, trackingData) {
        try {
            const consignment = apiResponse.ConsignmentDetails_Traking || {};
            const history = apiResponse.Sheet_History || [];

            trackingData.status = consignment.current_status_name || "In Transit";
            trackingData.location = consignment.current_location_name || "Unknown";
            trackingData.estimatedDelivery = consignment.ExpectedDeliveryDate || null;
            trackingData.origin = consignment.origin_name || "";
            trackingData.destination = consignment.dest_name || "";

            trackingData.history = history.map(item => ({
                timestamp: item.status_date ? new Date(item.status_date) : new Date(),
                status: item.status || "Update",
                location: item.dispatch_location_name || "",
                description: item.Remarks || item.status || ""
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

        trackingData.status = this.extractField(apiResponse, fieldSets.status) || 'Unknown';
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
}

module.exports = new ApiClient();