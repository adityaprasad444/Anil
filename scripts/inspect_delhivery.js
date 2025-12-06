const https = require('https');

const options = {
    hostname: 'dlv-api.delhivery.com',
    path: '/v3/unified-tracking?wbn=38746810000475',
    method: 'GET',
    headers: {
        'accept': 'application/json, text/plain, */*',
        'origin': 'https://www.delhivery.com',
        'referer': 'https://www.delhivery.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        console.log(JSON.stringify(JSON.parse(data), null, 2));
    });
});

req.on('error', (e) => {
    console.error(e);
});

req.end();
