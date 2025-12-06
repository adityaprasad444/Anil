const https = require('https');

const BASE_URL = 'https://tracking-3zrpmcdgm-adityas-projects-b804d15b.vercel.app';

const endpoints = [
    { path: '/api/tracking/list', method: 'GET', expectedStatus: 401, name: 'Tracking List (Protected)' },
    { path: '/api/providers', method: 'GET', expectedStatus: 401, name: 'Providers List (Protected)' },
    { path: '/admin', method: 'GET', expectedStatus: 401, name: 'Admin Page (Protected)' }, // Note: Browser might redirect, API might return 401 or redirect depending on impl.
    // In tracker-app.js: app.get('/admin', requireAuth, ...) -> sends file. 
    // Wait, requireAuth sends 401 json: res.status(401).json({ error: 'Authentication required' });

    { path: '/api/tracking/somefakeid', method: 'GET', expectedStatus: 404, name: 'Tracking Info (Public)' }
];

function checkEndpoint(endpoint) {
    return new Promise((resolve) => {
        const options = {
            method: endpoint.method,
            headers: {
                'Accept': 'application/json'
            }
        };

        const req = https.request(`${BASE_URL}${endpoint.path}`, options, (res) => {
            const isSuccess = res.statusCode === endpoint.expectedStatus;
            console.log(`${isSuccess ? '✅' : '❌'} ${endpoint.name}: Expected ${endpoint.expectedStatus}, got ${res.statusCode}`);
            resolve();
        });

        req.on('error', (e) => {
            console.error(`❌ ${endpoint.name}: Error ${e.message}`);
            resolve();
        });

        req.end();
    });
}

async function runTests() {
    console.log(`Testing Authentication Protection on ${BASE_URL}\n`);
    for (const ep of endpoints) {
        await checkEndpoint(ep);
    }
}

runTests();
