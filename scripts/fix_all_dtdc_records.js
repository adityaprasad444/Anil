const { TrackingData, connectDB } = require('../db');
const trackingService = require('../services/trackingService');
const mongoose = require('mongoose');

async function fixAllDtdcRecords() {
    try {
        console.log('🔌 Connecting to database...');
        await connectDB();

        console.log('🔄 Starting fix for ALL DTDC records...');

        // Find all records where provider is DTDC
        const dtdcRecords = await TrackingData.find({
            provider: { $regex: /dtdc/i }
        });

        console.log(`📦 Found ${dtdcRecords.length} DTDC records to refresh.`);

        let successCount = 0;
        let failCount = 0;

        for (const record of dtdcRecords) {
            try {
                process.stdout.write(`🔄 Refreshing [${record.trackingId}]... `);

                // Call fetchAndStoreTrackingData
                await trackingService.fetchAndStoreTrackingData(record.trackingId);

                console.log('✅ Done');
                successCount++;
            } catch (err) {
                console.log(`❌ Failed: ${err.message}`);
                failCount++;
            }
            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log('\n✨ Migration Summary:');
        console.log(`Total: ${dtdcRecords.length}`);
        console.log(`Success: ${successCount}`);
        console.log(`Failed: ${failCount}`);

        process.exit(0);
    } catch (error) {
        console.error('💥 Critical Error:', error);
        process.exit(1);
    }
}

fixAllDtdcRecords();
