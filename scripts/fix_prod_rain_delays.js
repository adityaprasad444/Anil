require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const mongoose = require('mongoose');
const { trackingSchema } = require('../db');

const TARGET_DBS = ['Tracking', 'Dev'];

async function fixProdRecords() {
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

            const conn = await mongoose.createConnection(dbUri).asPromise();
            const TrackingModel = conn.model('TrackingData', trackingSchema);

            const allRecords = await TrackingModel.find({});
            console.log(`📦 Checking ${allRecords.length} records in [${dbName}]...`);

            let fixedCount = 0;

            for (const record of allRecords) {
                if (!record.history || !Array.isArray(record.history)) continue;

                // Find valid delivered event in history
                const deliveredEvent = record.history.find(h => {
                    const sText = (h.status || '').toLowerCase();
                    const dText = (h.description || '').toLowerCase();
                    const isDeliveredMatch = /\bdelivered\b/i.test(sText) || /\bdelivered\b/i.test(dText);

                    return isDeliveredMatch &&
                        !sText.includes('attempt') &&
                        !sText.includes('out for') &&
                        !sText.includes('scheduled') &&
                        !sText.includes('expected') &&
                        !sText.includes('fail') &&
                        !sText.includes('return') &&
                        !sText.includes('delay') &&
                        !dText.includes('attempt') &&
                        !dText.includes('out for') &&
                        !dText.includes('scheduled') &&
                        !dText.includes('expected') &&
                        !dText.includes('fail') &&
                        !dText.includes('return') &&
                        !dText.includes('delay');
                });

                if (deliveredEvent) {
                    let needsSave = false;

                    // Fix 1: Ensure main status is 'Delivered'
                    if (record.status !== 'Delivered') {
                        console.log(`  🔧 [${record.trackingId} / ${record.originalTrackingId}]: Status "${record.status}" -> "Delivered"`);
                        record.status = 'Delivered';
                        needsSave = true;
                    }

                    // Fix 2: Remove post-delivery delay/rain scans from history
                    const deliveryTime = new Date(deliveredEvent.timestamp).getTime();
                    const initialHistoryLength = record.history.length;
                    
                    record.history = record.history.filter(h => {
                        const hTime = new Date(h.timestamp).getTime();
                        const txt = ((h.status || '') + ' ' + (h.description || '')).toLowerCase();
                        if (hTime > deliveryTime) {
                            if (txt.includes('pod') || txt.includes('delay') || txt.includes('rain') || txt.includes('flood') || txt.includes('exception')) {
                                console.log(`     🗑️ Removing post-delivery scan: [${h.timestamp.toISOString()}] ${h.status}`);
                                return false;
                            }
                        }
                        return true;
                    });

                    if (record.history.length !== initialHistoryLength) {
                        needsSave = true;
                    }

                    if (needsSave) {
                        record.lastUpdated = new Date();
                        await record.save();
                        fixedCount++;
                        console.log(`  ✅ Saved fix for [${record.trackingId}]`);
                    }
                }
            }

            console.log(`\n✨ Summary for [${dbName}]: Fixed ${fixedCount} records.`);
            await conn.close();

        } catch (error) {
            console.error(`💥 Error fixing database [${dbName}]:`, error.message);
        }
    }

    console.log(`\n🎉 All done!`);
    process.exit(0);
}

fixProdRecords();
