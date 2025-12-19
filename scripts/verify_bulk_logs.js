const { connectDB } = require('../db');
const BulkUpload = require('../models/BulkUpload');

(async () => {
    try {
        await connectDB();
        const logs = await BulkUpload.find({}).sort({ createdAt: -1 }).limit(1);
        console.log('--- LATEST BULK UPLOAD LOG ---');
        console.log(JSON.stringify(logs[0], null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
})();
