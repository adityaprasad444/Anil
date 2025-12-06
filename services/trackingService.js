const { TrackingData } = require('../db');
const Provider = require('../models/Provider');
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

      if (!provider.apiConfig || !provider.apiConfig.endpoint) {
        console.log(`⚠️ No API configuration for provider: ${provider.name}`);
        return trackingEntry;
      }

      // Fetch data from provider API
      const originalTrackingId = trackingEntry.originalTrackingId || trackingId;
      const apiResponse = await apiClient.fetchTrackingData(provider, originalTrackingId);

      // Parse API response
      const parsedData = apiClient.parseResponse(apiResponse, provider, originalTrackingId);

      // Default 'Unknown' status to 'In Transit'
      if (parsedData.status && parsedData.status.toLowerCase() === 'unknown') {
        parsedData.status = 'In Transit';
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
      return updatedData;

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
        skipped: 0
      };

      // Update each entry
      for (const entry of activeEntries) {
        try {
          await this.fetchAndStoreTrackingData(entry.trackingId);
          results.updated++;
        } catch (error) {
          console.error(`Failed to update ${entry.trackingId}:`, error.message);
          results.failed++;
        }
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`✅ Bulk update completed:`, results);
      return results;

    } catch (error) {
      console.error('❌ Error in updateAllTrackingData:', error);
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

    const now = new Date();
    const lastUpdated = new Date(trackingData.lastUpdated);
    const timeSinceUpdate = now - lastUpdated;

    // Adjust cache duration based on status
    let cacheDuration = this.cacheDuration;

    if (trackingData.status) {
      const statusLower = trackingData.status.toLowerCase();

      if (statusLower.includes('deliver')) {
        // If delivered, check less frequently (24 hours)
        cacheDuration = 24 * 60 * 60 * 1000;
      } else if (statusLower.includes('exception') || statusLower.includes('delay')) {
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
    return await this.fetchAndStoreTrackingData(trackingId);
  }
}

module.exports = new TrackingService();
