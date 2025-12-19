const { TrackingData, connectDB } = require('../db');

async function normalizeStatuses() {
    try {
        await connectDB();
        console.log('🔌 Connected to database for status normalization...');

        const items = await TrackingData.find({});
        console.log(`🔍 Checking ${items.length} items...`);

        let updatedCount = 0;

        function normalizeStatus(status) {
            if (!status) return 'In Transit';
            const s = status.toLowerCase().trim();
            if (s.includes('delivered')) return 'Delivered';
            if (s.includes('transit')) return 'In Transit';
            if (s.includes('out for delivery')) return 'Out for Delivery';
            if (s.includes('pickup') || s.includes('booked') || s.includes('pending')) return 'Pending';
            if (s.includes('exception') || s.includes('delay') || s.includes('failed') || s.includes('issue')) return 'Exception';

            // Title Case as fallback
            return status.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
        }

        for (const item of items) {
            const originalStatus = item.status;
            const newStatus = normalizeStatus(originalStatus);

            if (originalStatus !== newStatus) {
                item.status = newStatus;
                // Also normalize history if needed?
                if (item.history && Array.isArray(item.history)) {
                    item.history.forEach(h => {
                        h.status = normalizeStatus(h.status);
                    });
                }
                await item.save();
                updatedCount++;
                console.log(`✅ Normalized: ${item.trackingId} (${originalStatus} -> ${newStatus})`);
            }
        }

        console.log(`🎉 Done! Updated ${updatedCount} records.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during normalization:', error);
        process.exit(1);
    }
}

normalizeStatuses();
