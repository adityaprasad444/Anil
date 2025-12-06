const { connectDB, mongoose } = require('../db');
const Provider = require('../models/Provider');
const config = require('../config');

const updateProvider = async () => {
    try {
        await connectDB();

        const providerName = 'ICL International';
        const conf = config.defaultProviders.find(p => p.name === providerName);

        if (!conf) {
            console.error(`Configuration for ${providerName} not found in config.js`);
            process.exit(1);
        }

        console.log(`Updating ${providerName}...`);

        // We use findOneAndUpdate to ensure we update the existing entry
        const provider = await Provider.findOneAndUpdate(
            { name: providerName },
            {
                $set: {
                    trackingUrl: conf.trackingUrl,
                    apiConfig: conf.apiConfig
                }
            },
            { new: true, upsert: true } // Create if not exists
        );

        console.log(`✅ Provider updated: ${provider.name}`);
        console.log('Endpoint:', provider.apiConfig.endpoint);
        console.log('Method:', provider.apiConfig.method);

        process.exit(0);
    } catch (error) {
        console.error('Update failed:', error);
        process.exit(1);
    }
};

updateProvider();
