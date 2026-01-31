const mongoose = require('mongoose');

const emailConfigSchema = new mongoose.Schema({
    host: {
        type: String,
        required: true,
        default: 'smtp.gmail.com'
    },
    port: {
        type: Number,
        required: true,
        default: 587
    },
    secure: {
        type: Boolean,
        default: false
    },
    user: {
        type: String,
        required: true
    },
    pass: {
        type: String,
        required: true
    },
    adminEmail: {
        type: [String],
        required: true,
        default: []
    },
    fromName: {
        type: String,
        default: 'AK Logistics Tracking System'
    },
    isEnabled: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('EmailConfig', emailConfigSchema);
