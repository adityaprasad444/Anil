const { connectDB, mongoose } = require('../db');
const Provider = require('../models/Provider');
const config = require('../config');

const addXpressBees = async () => {
    try {
        await connectDB();

        const providerName = 'XpressBees';
        const existing = await Provider.findOne({ name: providerName });

        if (existing) {
            console.log(`${providerName} already exists. Updating...`);
            const conf = config.defaultProviders.find(p => p.name === providerName);
            if (conf) {
                existing.trackingUrl = conf.trackingUrl;
                existing.apiConfig = conf.apiConfig;
                await existing.save();
                console.log(`✅ ${providerName} updated successfully`);
            }
        } else {
            console.log(`Creating ${providerName}...`);
            const conf = config.defaultProviders.find(p => p.name === providerName);
            if (conf) {
                await Provider.create(conf);
                console.log(`✅ ${providerName} created successfully`);
            } else {
                console.error(`Configuration for ${providerName} not found in config.js`);
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('Failed:', error);
        process.exit(1);
    }
};

addXpressBees();
