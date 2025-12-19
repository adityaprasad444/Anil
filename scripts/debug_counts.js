const { connectDB, TrackingData } = require('../db');
(async () => {
    try {
        await connectDB();
        const filter = {
            status: { $regex: '^delivered$', $options: 'i' }
        };
        const count = await TrackingData.countDocuments(filter);
        console.log('COUNT_DELIVERED:' + count);

        const transitFilter = {
            status: { $not: { $regex: '^delivered$|out for delivery|scheduled for delivery|exception|delay|fail', $options: 'i' } }
        };
        const transitCount = await TrackingData.countDocuments(transitFilter);
        console.log('COUNT_TRANSIT:' + transitCount);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
})();
