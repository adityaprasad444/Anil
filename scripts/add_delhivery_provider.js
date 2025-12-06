const mongoose = require('mongoose');
const Provider = require('../models/Provider'); // Adjust path as needed
require('dotenv').config({ path: '.env.local' });

async function addDelhivery() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('❌ MONGODB_URI missing');
        return;
    }

    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(uri);
        console.log('✅ Connected.');

        const delhiveryConfig = {
            name: 'Delhivery',
            trackingUrl: 'https://www.delhivery.com/track/package/{trackingId}',
            apiConfig: {
                endpoint: 'https://dlv-api.delhivery.com/v3/unified-tracking?wbn={trackingId}',
                method: 'GET',
                headers: {
                    'accept': 'application/json, text/plain, */*',
                    'origin': 'https://www.delhivery.com',
                    'referer': 'https://www.delhivery.com/',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
                    'accept-language': 'en-US,en;q=0.9,en-IN;q=0.8,id;q=0.7',
                    'cache-control': 'no-cache',
                    'pragma': 'no-cache',
                    'priority': 'u=1, i',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-site'
                }
            }
        };

        console.log('📝 Upserting Delhivery provider...');
        const result = await Provider.findOneAndUpdate(
            { name: 'Delhivery' },
            delhiveryConfig,
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        console.log('✅ Delhivery provider configured successfully:', result.name);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

addDelhivery();
