const bcrypt = require('bcryptjs');

const hash = '$2a$10$RRZGOuNQQ1uI5myeK8PFCuc4TkQpkKytHFbTLO7UrkfJQfhsPqsEC';
const candidates = ['admin123', 'admin', 'password', '123456', 'tracking123'];

async function check() {
    for (const pass of candidates) {
        const match = await bcrypt.compare(pass, hash);
        if (match) {
            console.log(`Match found! Password is: ${pass}`);
            return;
        }
    }
    console.log('No match found among common defaults.');
}

check();
