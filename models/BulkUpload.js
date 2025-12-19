const mongoose = require('mongoose');

const bulkUploadSchema = new mongoose.Schema({
    fileName: {
        type: String,
        required: true
    },
    uploadedBy: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['success', 'failed', 'partial'],
        required: true
    },
    totalItems: {
        type: Number,
        required: true
    },
    successCount: {
        type: Number,
        required: true
    },
    failCount: {
        type: Number,
        required: true
    },
    uploadErrors: [{
        item: mongoose.Schema.Types.Mixed,
        error: String
    }],
    rawContent: {
        type: String
    }
}, {
    timestamps: true
});

// Index for performance
bulkUploadSchema.index({ createdAt: -1 });
bulkUploadSchema.index({ uploadedBy: 1 });

module.exports = mongoose.model('BulkUpload', bulkUploadSchema);
