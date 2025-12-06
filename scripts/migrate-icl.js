const { connectDB, TrackingData, mongoose } = require('../db');
const Provider = require('../models/Provider');
const config = require('../config');

const migrate = async () => {
    try {
        await connectDB();

        // 1. Migrate ICL -> ICL Domestic
        const icl = await Provider.findOne({ name: 'ICL' });
        if (icl) {
            console.log('Found legacy ICL provider. Migrating to ICL Domestic...');
            icl.name = 'ICL Domestic';
            await icl.save();
            console.log('Provider renamed.');

            const result = await TrackingData.updateMany(
                { provider: 'ICL' },
                { $set: { provider: 'ICL Domestic' } }
            );
            console.log(`Updated ${result.modifiedCount} tracking entries.`);
        } else {
            console.log('Legacy ICL provider not found. Checking for ICL Domestic...');
            const domestic = await Provider.findOne({ name: 'ICL Domestic' });
            if (!domestic) {
                console.log('Creating ICL Domestic...');
                // Find config for ICL Domestic
                const conf = config.defaultProviders.find(p => p.name === 'ICL Domestic');
                if (conf) {
                    await Provider.create(conf);
                    console.log('Created ICL Domestic.');
                } else {
                    console.error('Configuration for ICL Domestic not found in defaultProviders.');
                }
            } else {
                console.log('ICL Domestic already exists.');
            }
        }

        // 2. Create ICL International if missing
        const international = await Provider.findOne({ name: 'ICL International' });
        if (!international) {
            console.log('Creating ICL International...');
            const conf = config.defaultProviders.find(p => p.name === 'ICL International');
            if (conf) {
                await Provider.create(conf);
                console.log('Created ICL International.');
            } else {
                console.error('Configuration for ICL International not found in defaultProviders.');
            }
        } else {
            console.log('ICL International already exists.');
        }

        console.log('Migration complete.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', JSON.stringify(error, null, 2));
        if (error.errors) {
            console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
        }
        process.exit(1);
    }
};

migrate();
