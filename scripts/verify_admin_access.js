const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

const jar = new CookieJar();
const client = wrapper(axios.create({
    baseURL: 'https://tracking-3zrpmcdgm-adityas-projects-b804d15b.vercel.app',
    jar,
    withCredentials: true
}));

async function verifyAdminAccess() {
    try {
        console.log('🔐 1. Attempting Login...');
        const loginRes = await client.post('/api/login', {
            username: 'admin',
            password: 'admin123'
        });

        if (loginRes.data.success) {
            console.log('✅ Login Successful');
        } else {
            console.error('❌ Login Failed:', loginRes.data);
            process.exit(1);
        }

        // 2. Test /api/tracking/list
        console.log('\n📋 2. Testing /api/tracking/list...');
        try {
            const trackingRes = await client.get('/api/tracking/list');
            if (trackingRes.status === 200 && trackingRes.data.entries) {
                console.log(`✅ Success (Count: ${trackingRes.data.total})`);
            } else {
                console.error('❌ Failed:', trackingRes.status);
            }
        } catch (e) {
            console.error('❌ Error:', e.message);
        }

        // 3. Test /api/providers
        console.log('\ntruck 3. Testing /api/providers...');
        try {
            const providersRes = await client.get('/api/providers');
            if (providersRes.status === 200 && Array.isArray(providersRes.data)) {
                console.log(`✅ Success (Count: ${providersRes.data.length})`);
            } else {
                console.error('❌ Failed:', providersRes.status);
            }
        } catch (e) {
            console.error('❌ Error:', e.message);
        }

        // 4. Test /admin (HTML page)
        console.log('\n📄 4. Testing /admin (Page Access)...');
        try {
            const adminRes = await client.get('/admin');
            if (adminRes.status === 200 && adminRes.headers['content-type'].includes('text/html')) {
                console.log('✅ Success (Page loaded)');
            } else {
                console.error('❌ Failed:', adminRes.status);
            }
        } catch (e) {
            console.error('❌ Error:', e.message);
        }

    } catch (error) {
        console.error('❌ Critical Error:', error.message);
        if (error.response) console.error('Response:', error.response.data);
    }
}

verifyAdminAccess();
