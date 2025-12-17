const { TrackingData } = require('../db');
const Provider = require('../models/Provider');
const CronLog = require('../models/CronLog');
const apiClient = require('./apiClient');

class TrackingService {
  constructor() {
    // Cache duration in milliseconds (default: 1 hour)
    this.cacheDuration = 60 * 60 * 1000;
  }

  /**
   * Get tracking data - fetches from DB or API if needed
   * @param {string} trackingId - Tracking ID to fetch
   * @returns {Promise<Object>} - Tracking data
   */
  async getTrackingData(trackingId) {
    try {
      console.log(`🔍 Getting tracking data for: ${trackingId}`);

      // First, check if we have this tracking ID in our database
      let trackingData = await TrackingData.findOne({ trackingId });

      if (!trackingData) {
        console.log(`❌ Tracking ID not found in database: ${trackingId}`);
        return null;
      }

      // Check if data is stale and needs refresh
      const needsRefresh = this.needsRefresh(trackingData);

      if (needsRefresh) {
        console.log(`🔄 Data is stale, fetching fresh data for: ${trackingId}`);
        try {
          await this.fetchAndStoreTrackingData(trackingId);
          // Reload the updated data
          trackingData = await TrackingData.findOne({ trackingId });
        } catch (error) {
          console.error(`⚠️ Failed to refresh data, returning cached data:`, error.message);
          // Return cached data if refresh fails
        }
      } else {
        console.log(`✅ Returning cached data for: ${trackingId}`);
      }

      return trackingData;
    } catch (error) {
      console.error('❌ Error in getTrackingData:', error);
      throw error;
    }
  }

  /**
   * Fetch tracking data from provider API and store in database
   * @param {string} trackingId - Tracking ID to fetch
   * @returns {Promise<Object>} - Updated tracking data
   */
  async fetchAndStoreTrackingData(trackingId) {
    try {
      // Get tracking entry from database
      const trackingEntry = await TrackingData.findOne({ trackingId });

      if (!trackingEntry) {
        throw new Error('Tracking ID not found in database');
      }

      // Get provider configuration
      const provider = await Provider.findOne({ name: trackingEntry.provider });

      if (!provider) {
        throw new Error(`Provider not found: ${trackingEntry.provider}`);
      }

      // Check if package is already delivered - if so, ignore all future updates
      if (trackingEntry.status && trackingEntry.status.toLowerCase().includes('deliver')) {
        console.log(`📦 Package already delivered, skipping update for: ${trackingId}`);
        return trackingEntry;
      }

      if (!provider.apiConfig || !provider.apiConfig.endpoint) {
        console.log(`⚠️ No API configuration for provider: ${provider.name}`);
        return trackingEntry;
      }

      // Fetch data from provider API
      const originalTrackingId = trackingEntry.originalTrackingId || trackingId;
      const apiResult = await apiClient.fetchTrackingData(provider, originalTrackingId);

      // Use just the data part for parsing
      const apiResponse = apiResult.data;
      const requestDetails = {
        url: apiResult.requestUrl,
        statusCode: apiResult.responseStatus
      };

      // Parse API response
      const parsedData = apiClient.parseResponse(apiResponse, provider, originalTrackingId);

      // Default 'Unknown' status to 'In Transit'
      if (parsedData.status && parsedData.status.toLowerCase() === 'unknown') {
        parsedData.status = 'In Transit';
      }

      // Check for 'Delivered' status in history and enforce it
      if (parsedData.history && Array.isArray(parsedData.history)) {
        const deliveredEvent = parsedData.history.find(h =>
          h.status &&
          h.status.toLowerCase().includes('deliver') &&
          !h.status.toLowerCase().includes('attempt') &&
          !h.status.toLowerCase().includes('out for') &&
          !h.status.toLowerCase().includes('schedule') &&
          !h.status.toLowerCase().includes('expected') &&
          !h.status.toLowerCase().includes('fail') &&
          !h.status.toLowerCase().includes('return')
        );

        if (deliveredEvent) {
          // If we found a delivery event, enforce it as the main status
          // This prevents "POD Uploaded" from overwriting "Delivered"
          if (parsedData.status !== deliveredEvent.status) {
            parsedData.status = deliveredEvent.status;
          }

          // Filter out post-delivery updates specifically "POD" related ones
          parsedData.history = parsedData.history.filter(h =>
            !h.status.toLowerCase().includes('pod upload') &&
            !h.status.toLowerCase().includes('pod update')
          );
        }
      }

      // Update tracking data in database
      const updateData = {
        status: parsedData.status || trackingEntry.status,
        location: parsedData.location || trackingEntry.location,
        estimatedDelivery: parsedData.estimatedDelivery || trackingEntry.estimatedDelivery,
        origin: parsedData.origin || trackingEntry.origin,
        destination: parsedData.destination || trackingEntry.destination,
        lastUpdated: new Date(),
        rawApiResponse: parsedData.rawResponse
      };

      // Add history entry if there's a status change
      if (parsedData.status && parsedData.status !== trackingEntry.status) {
        if (!trackingEntry.history) {
          trackingEntry.history = [];
        }
        trackingEntry.history.push({
          timestamp: new Date(),
          status: parsedData.status,
          location: parsedData.location || '',
          description: `Status updated to ${parsedData.status}`
        });
        updateData.history = trackingEntry.history;
      }

      // Merge parsed history if available
      if (parsedData.history && Array.isArray(parsedData.history)) {
        updateData.history = parsedData.history;
      }

      // Update in database
      const updatedData = await TrackingData.findByIdAndUpdate(
        trackingEntry._id,
        { $set: updateData },
        { new: true }
      );

      console.log(`✅ Updated tracking data for: ${trackingId}`);

      // Return enhanced result with log info
      return {
        trackingData: updatedData,
        log: {
          trackingId,
          provider: provider.name,
          requestUrl: requestDetails.url,
          responseStatus: requestDetails.statusCode,
          response: JSON.stringify(apiResponse).substring(0, 500) // Truncate response for log
        }
      };

    } catch (error) {
      console.error(`❌ Error fetching and storing tracking data:`, error);
      throw error;
    }
  }

  /**
   * Update all active tracking entries
   * Called by cron job
   * @returns {Promise<Object>} - Update statistics
   */
  // In services/trackingService.js, update the updateAllTrackingData method:

  async updateAllTrackingData() {
    const startTime = Date.now();
    try {
      console.log('🔄 Starting bulk update of all tracking data...');

      // Get all tracking entries that are not delivered
      const activeEntries = await TrackingData.find({
        status: {
          $not: {
            $in: [
              /delivered/i,
              /delivery.*complete/i,
              /delivered.*successfully/i,
              /completed/i
            ]
          }
        }
      });

      console.log(`📦 Found ${activeEntries.length} active tracking entries to update`);

      const results = {
        total: activeEntries.length,
        updated: 0,
        failed: 0,
        skipped: 0,
        logs: []
      };

      // Update each entry
      for (const entry of activeEntries) {
        try {
          const result = await this.fetchAndStoreTrackingData(entry.trackingId);
          results.updated++;
          if (result.log) results.logs.push(result.log);
        } catch (error) {
          console.error(`Failed to update ${entry.trackingId}:`, error.message);
          results.failed++;
          results.logs.push({
            trackingId: entry.trackingId,
            error: error.message,
            provider: entry.provider
          });
        }
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`✅ Bulk update completed:`, results);

      // Log success to DB
      await CronLog.create({
        level: 'info',
        message: 'Bulk tracking update completed',
        details: results,
        durationMs: Date.now() - startTime
      });

      return results;

    } catch (error) {
      console.error('❌ Error in updateAllTrackingData:', error);

      // Log failure to DB
      await CronLog.create({
        level: 'error',
        message: 'Bulk tracking update failed',
        details: { error: error.message, stack: error.stack },
        durationMs: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * Check if tracking data needs refresh
   * @param {Object} trackingData - Tracking data object
   * @returns {boolean} - True if needs refresh
   */
  needsRefresh(trackingData) {
    if (!trackingData.lastUpdated) {
      return true; // Never updated, needs refresh
    }

    // If package is delivered, never refresh
    if (trackingData.status &&
      trackingData.status.toLowerCase().includes('deliver') &&
      !trackingData.status.toLowerCase().includes('out for')) {
      return false;
    }

    const now = new Date();
    const lastUpdated = new Date(trackingData.lastUpdated);
    const timeSinceUpdate = now - lastUpdated;

    // Adjust cache duration based on status
    let cacheDuration = this.cacheDuration;

    if (trackingData.status) {
      const statusLower = trackingData.status.toLowerCase();

      if (statusLower.includes('exception') || statusLower.includes('delay')) {
        // If there's an issue, check more frequently (30 minutes)
        cacheDuration = 30 * 60 * 1000;
      }
    }

    return timeSinceUpdate > cacheDuration;
  }

  /**
   * Sleep utility for delays
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Manually trigger refresh for a specific tracking ID
   * @param {string} trackingId - Tracking ID to refresh
   * @returns {Promise<Object>} - Updated tracking data
   */
  async refreshTrackingData(trackingId) {
    console.log(`🔄 Manual refresh requested for: ${trackingId}`);
    const result = await this.fetchAndStoreTrackingData(trackingId);
    // If we return the whole result, the caller might be confused if they expect checking properties directly.
    // However, looking at previous usage, caller might expect the trackingData object.
    return result.trackingData ? result.trackingData : result;
  }
}

module.exports = new TrackingService();
