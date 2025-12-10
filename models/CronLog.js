const mongoose = require('mongoose');

const cronLogSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now
    },
    level: {
        type: String,
        enum: ['info', 'error', 'warn'],
        default: 'info'
    },
    message: {
        type: String,
        required: true
    },
    details: {
        type: mongoose.Schema.Types.Mixed
    },
    durationMs: {
        type: Number
    }
}, {
    timestamps: true /* Adds createdAt and updatedAt */
});

// Index for easier querying by date and level
cronLogSchema.index({ timestamp: -1 });
cronLogSchema.index({ level: 1 });

module.exports = mongoose.model('CronLog', cronLogSchema);
