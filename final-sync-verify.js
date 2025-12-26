const { connectDB, TrackingData } = require('./db');
const trackingService = require('./services/trackingService');
const apiClient = require('./services/apiClient');
const Provider = require('./models/Provider');

async function finalSyncAndVerify() {
    try {
        console.log('🔌 Connecting to DB...');
        await connectDB();

        // 1. Trigger Bulk Update
        console.log('\n🔄 Starting Final Bulk Sync...');
        const syncResults = await trackingService.updateAllTrackingData();
        console.log('✅ Sync Completed.');
        console.log(`Updated: ${syncResults.updated}, Failed: ${syncResults.failed}, Total Processed: ${syncResults.total}`);
        if (syncResults.logs && syncResults.logs.length > 0) {
            console.log('Logs (Sample):', syncResults.logs.slice(0, 3));
        }

        // 2. Verification Audit
        console.log('\n🔎 Verifying all active/non-delivered items...');

        // Find all non-delivered items AGAIN to check if they are now caught up
        const query = {
            status: {
                $not: { $regex: 'delivered', $options: 'i' }
            }
        };

        const items = await TrackingData.find(query);
        console.log(`📦 Found ${items.length} items remaining in 'Active' state (Not Delivered).`);

        if (items.length === 0) {
            console.log('✅ Awesome! All items are Delivered.');
            process.exit(0);
        }

        let mismatches = 0;
        let errors = 0;

        console.log('\n------------------------------------------------------------------------------------------------');
        console.log('| Tracking ID       | Provider        | App Status           | API Status           | Match? |');
        console.log('------------------------------------------------------------------------------------------------');

        for (const item of items) {
            try {
                const provider = await Provider.findOne({ name: item.provider });
                if (!provider) {
                    console.log(`| ${item.trackingId.padEnd(17)} | ${item.provider.padEnd(15)} | ${item.status.padEnd(20)} | (Provider Not Found) | ❌     |`);
                    errors++;
                    continue;
                }

                const lookupId = item.originalTrackingId || item.trackingId;
                const apiResult = await apiClient.fetchTrackingData(provider, lookupId);
                const parsed = apiClient.parseResponse(apiResult.data, provider, lookupId);

                const dbStatus = (item.status || '').trim();
                const apiStatus = (parsed.status || '').trim();

                const isMatch = dbStatus.toLowerCase() === apiStatus.toLowerCase();
                if (!isMatch) mismatches++;

                const matchIcon = isMatch ? '✅' : '⚠️';
                console.log(`| ${item.trackingId.padEnd(17)} | ${item.provider.slice(0, 14).padEnd(15)} | ${dbStatus.slice(0, 19).padEnd(20)} | ${apiStatus.slice(0, 19).padEnd(20)} | ${matchIcon}     |`);

                // Small delay
                await new Promise(r => setTimeout(r, 200));

            } catch (err) {
                console.log(`| ${item.trackingId.padEnd(17)} | ${item.provider.slice(0, 14).padEnd(15)} | ${item.status.padEnd(20)} | ERROR: ${err.message.slice(0, 12)} | ❌     |`);
                errors++;
            }
        }

        console.log('------------------------------------------------------------------------------------------------');
        console.log(`\nVerification Summary:`);
        console.log(`Remaining Mismatches: ${mismatches}`);

        if (mismatches === 0) {
            console.log('✅ SUCCESS: All active statuses match the provider!');
        } else {
            console.log('⚠️ WARNING: Some statuses still do not match. Check the table above.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Fatal Error:', error);
        process.exit(1);
    }
}

finalSyncAndVerify();
