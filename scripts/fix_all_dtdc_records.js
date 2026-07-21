require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const mongoose = require('mongoose');
const { connectDB, trackingSchema } = require('../db');
const trackingService = require('../services/trackingService');
const apiClient = require('../services/apiClient');
const config = require('../config');

// Databases in MongoDB Atlas cluster to update
const TARGET_DBS = ['Tracking', 'Dev'];

async function fixAllDtdcRecords() {
    const baseUri = process.env.MONGODB_URI;

    for (const dbName of TARGET_DBS) {
        try {
            console.log(`\n========================================`);
            console.log(`🔌 Connecting to Database: [${dbName}]`);
            console.log(`========================================`);

            let dbUri = baseUri;
            if (baseUri.includes('/Dev?')) {
                dbUri = baseUri.replace('/Dev?', `/${dbName}?`);
            } else if (baseUri.includes('/Dev')) {
                dbUri = baseUri.replace('/Dev', `/${dbName}`);
            }

            process.env.MONGODB_URI = dbUri;
            config.mongo.uri = dbUri;

            if (mongoose.connection.readyState !== 0) {
                await mongoose.disconnect();
            }

            await connectDB();

            const TrackingModel = mongoose.model('TrackingData', trackingSchema);

            const dtdcRecords = await TrackingModel.find({
                provider: { $regex: /dtdc/i }
            });

            console.log(`📦 Found ${dtdcRecords.length} DTDC records in [${dbName}].`);

            let successCount = 0;
            let failCount = 0;

            for (const record of dtdcRecords) {
                const oldLoc = record.location;
                try {
                    console.log(`\n🔄 Processing [${record.trackingId}]...`);
                    console.log(`  - Status: ${record.status}`);
                    console.log(`  - Old Location: ${oldLoc || 'N/A'}`);

                    const result = await trackingService.fetchAndStoreTrackingData(record.trackingId, true);
                    const updated = result.trackingData || result;

                    console.log(`  - New Location: ${updated.location || 'N/A'}`);
                    console.log(`  ✅ Successfully updated [${record.trackingId}]`);
                    successCount++;
                } catch (err) {
                    console.error(`  ❌ Failed [${record.trackingId}]: ${err.message}`);
                    failCount++;
                }
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            console.log(`\n✨ Data Fix Summary for [${dbName}]:`);
            console.log(`Total DTDC Records: ${dtdcRecords.length}`);
            console.log(`Successfully Updated: ${successCount}`);
            console.log(`Failed/Skipped: ${failCount}`);

        } catch (error) {
            console.error(`💥 Error in database [${dbName}]:`, error.message);
        }
    }

    await apiClient.terminateOcrWorker();
    process.exit(0);
}

fixAllDtdcRecords();
