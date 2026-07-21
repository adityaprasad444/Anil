require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { TrackingData, connectDB } = require('../db');
const trackingService = require('../services/trackingService');
const apiClient = require('../services/apiClient');

async function fixAllDtdcRecords() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await connectDB();

        console.log('🔄 Fetching all DTDC records from database...');

        const dtdcRecords = await TrackingData.find({
            provider: { $regex: /dtdc/i }
        });

        console.log(`📦 Found ${dtdcRecords.length} DTDC records to process.`);

        let successCount = 0;
        let failCount = 0;

        for (const record of dtdcRecords) {
            const oldLoc = record.location;
            try {
                console.log(`\n🔄 Processing [${record.trackingId}]...`);
                console.log(`  - Status: ${record.status}`);
                console.log(`  - Old Location: ${oldLoc || 'N/A'}`);

                // Force refresh DTDC data from API
                const result = await trackingService.fetchAndStoreTrackingData(record.trackingId, true);
                const updated = result.trackingData || result;

                console.log(`  - New Location: ${updated.location || 'N/A'}`);
                console.log(`  ✅ Successfully updated [${record.trackingId}]`);
                successCount++;
            } catch (err) {
                console.error(`  ❌ Failed [${record.trackingId}]: ${err.message}`);
                failCount++;
            }
            // Polite delay between provider requests
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log('\n✨ Data Fix Summary:');
        console.log(`Total DTDC Records: ${dtdcRecords.length}`);
        console.log(`Successfully Updated: ${successCount}`);
        console.log(`Failed/Skipped: ${failCount}`);

    } catch (error) {
        console.error('💥 Critical Error:', error.message);
    } finally {
        await apiClient.terminateOcrWorker();
        process.exit(0);
    }
}

fixAllDtdcRecords();
