const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
require('dotenv').config({ path: '.env.local' });

const jar = new CookieJar();
const client = wrapper(axios.create({
    baseURL: 'http://localhost:3001', // Assumes local testing or I can point it to a real URL
    jar,
    withCredentials: true
}));

async function testRefresh() {
    try {
        console.log('🔐 Logging in...');
        const loginRes = await client.post('/api/login', {
            username: 'admin',
            password: 'admin123'
        });

        if (!loginRes.data.success) {
            console.error('❌ Login failed');
            return;
        }

        console.log('✅ Login successful');

        // Get a tracking ID from the list
        console.log('📋 Fetching tracking list...');
        const listRes = await client.get('/api/tracking/list');
        const items = listRes.data.entries;

        if (items.length === 0) {
            console.log('⚠️ No tracking items found. Creating one...');
            // Try to generate one
            const genRes = await client.post('/api/tracking/generate', {
                provider: 'Delhivery',
                originalTrackingId: '123456789'
            });
            items.push({ trackingId: genRes.data.trackingId });
        }

        const testId = items[0].trackingId;
        console.log(`🔄 Testing refresh for: ${testId}`);

        try {
            const refreshRes = await client.post(`/api/tracking/${testId}/refresh`);
            console.log('✅ Refresh Response:', JSON.stringify(refreshRes.data, null, 2));
        } catch (e) {
            console.error('❌ Refresh failed:', e.response ? e.response.data : e.message);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testRefresh();
