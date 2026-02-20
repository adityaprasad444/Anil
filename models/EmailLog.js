const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now
    },
    recipients: {
        type: [String],
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['ADMIN_NOTIFICATION', 'DELIVERY_NOTIFICATION', 'BULK_REPORT', 'DAILY_REPORT'],
        default: 'ADMIN_NOTIFICATION'
    },
    status: {
        type: String,
        enum: ['SUCCESS', 'FAILED'],
        required: true
    },
    messageId: String,
    metadata: {
        type: mongoose.Schema.Types.Mixed
    },
    error: String
}, {
    timestamps: true
});

// Index for easier querying
emailLogSchema.index({ timestamp: -1 });
emailLogSchema.index({ status: 1 });

module.exports = mongoose.model('EmailLog', emailLogSchema);
