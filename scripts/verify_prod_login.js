const mongoose = require('mongoose');
const User = require('../models/User'); // Adjust path as needed
require('dotenv').config({ path: '.env.local' }); // Load from .env.local

async function verifyLogin() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('❌ MONGODB_URI missing');
        return;
    }

    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('✅ Connected.');

        const username = 'admin'; // Testing default admin
        // You can change this to what the user expects if known, or I'll list all users to see what's there.

        console.log(`🔍 Searching for user: ${username}`);
        const user = await User.findOne({ username });

        if (!user) {
            console.log('❌ User not found in DB.');

            // List all users to debug
            const allUsers = await User.find({});
            console.log('📋 Existing users in DB:', allUsers.map(u => u.username));

        } else {
            console.log('✅ User found:', user.username);
            console.log('🔑 Stored Password Hash:', user.password);

            // logic from tracker-app.js
            const candidatePassword = 'admin123';
            console.log(`🔐 Testing password: "${candidatePassword}"`);

            const isMatch = await user.comparePassword(candidatePassword);
            if (isMatch) {
                console.log('✅ Login SUCCESS: Password matches.');
            } else {
                console.log('❌ Login FAILED: Password validation returned false.');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

verifyLogin();
