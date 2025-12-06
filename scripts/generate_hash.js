const bcrypt = require('bcryptjs');

const password = 'AKtracking@4455';

async function generate() {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    console.log(`Password: ${password}`);
    console.log(`Hash: ${hash}`);
}

generate();
