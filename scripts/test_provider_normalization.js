const { connectDB } = require('../db');
const Provider = require('../models/Provider');

(async () => {
    try {
        await connectDB();

        // Logic copied from tracker-app.js
        console.log('Fetching providers...');
        const configuredProviders = await Provider.find({}, 'name');
        const providerMap = new Map();
        configuredProviders.forEach(p => providerMap.set(p.name.toLowerCase(), p.name));

        console.log('Provider Map:', Array.from(providerMap.entries()));

        const testCases = ['bluedart', 'XPRESSBEES', 'Delhivery', 'nonexistent'];

        console.log('\n--- Testing Normalization ---');
        testCases.forEach(input => {
            const normalized = providerMap.get(input.toLowerCase());
            console.log(`Input: "${input}" -> Normalized: "${normalized}" (Valid: ${!!normalized})`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
})();
