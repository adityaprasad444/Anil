const mongoose = require('mongoose');

const emailTemplateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    subject: {
        type: String,
        required: true
    },
    textContent: {
        type: String,
        required: true
    },
    htmlContent: {
        type: String,
        required: true
    },
    variables: {
        type: [String],
        default: []
    },
    description: {
        type: String,
        default: ''
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('EmailTemplate', emailTemplateSchema);
