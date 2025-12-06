const BASE_URL = 'https://tracking-3zrpmcdgm-adityas-projects-b804d15b.vercel.app';

async function check(path) {
    try {
        const res = await fetch(BASE_URL + path);
        console.log(`${path} -> Status: ${res.status}`);
    } catch (err) {
        console.error(`${path} -> Error: ${err.message}`);
    }
}

async function run() {
    console.log('Checking endpoints...');
    await check('/api/tracking/list');
    await check('/api/providers');
    await check('/admin');
    await check('/api/health'); // Should be 200
}

run();
