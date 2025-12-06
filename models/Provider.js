const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    trackingUrl: {
        type: String,
        required: true,
        trim: true
    },
    // Comprehensive API Configuration
    apiConfig: {
        endpoint: {
            type: String,
            trim: true,
            default: ''
        },
        method: {
            type: String,
            enum: ['GET', 'POST', 'PUT', 'PATCH'],
            default: 'POST'
        },
        headers: {
            type: Map,
            of: String,
            default: new Map()
        },
        requestBodyTemplate: {
            type: String,
            default: ''
        },
        responseMapping: {
            type: Map,
            of: String,
            default: new Map()
        }
    },
    // Legacy fields for backward compatibility
    apiEndpoint: {
        type: String,
        trim: true,
        default: ''
    },
    apiKey: {
        type: String,
        trim: true,
        default: ''
    },
    apiSecret: {
        type: String,
        trim: true,
        default: ''
    },
    requiresAuth: {
        type: Boolean,
        default: false
    },
    authType: {
        type: String,
        enum: ['none', 'api_key', 'oauth', 'basic_auth', 'bearer_token'],
        default: 'none'
    },
    rateLimit: {
        type: Number,
        default: 100 // Requests per hour
    },
    isActive: {
        type: Boolean,
        default: true
    },
    webhookUrl: {
        type: String,
        trim: true,
        default: ''
    },
    webhookEnabled: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Update the updatedAt timestamp before saving
providerSchema.pre('save', function (next) {
    this.updatedAt = new Date();

    // If API endpoint is provided, ensure it ends with a slash
    if (this.apiEndpoint && !this.apiEndpoint.endsWith('/')) {
        this.apiEndpoint += '/';
    }

    next();
});

// Virtual for the provider's API base URL
providerSchema.virtual('apiBaseUrl').get(function () {
    if (!this.apiEndpoint) return null;
    try {
        const url = new URL(this.apiEndpoint);
        return `${url.protocol}//${url.host}`;
    } catch (e) {
        return null;
    }
});

// Method to get authentication headers
providerSchema.methods.getAuthHeaders = function () {
    const headers = {};

    switch (this.authType) {
        case 'api_key':
            headers['X-API-Key'] = this.apiKey;
            break;
        case 'bearer_token':
            headers['Authorization'] = `Bearer ${this.apiKey}`;
            break;
        case 'basic_auth':
            const credentials = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
            headers['Authorization'] = `Basic ${credentials}`;
            break;
        // For OAuth, you would typically get a token first
    }

    return headers;
};

// Method to get API configuration with tracking ID replaced
providerSchema.methods.getApiRequest = function (trackingId) {
    if (!this.apiConfig || !this.apiConfig.endpoint) {
        return null;
    }

    const config = {
        url: this.apiConfig.endpoint,
        method: this.apiConfig.method || 'POST',
        headers: {}
    };

    // Convert Map to object for headers
    if (this.apiConfig.headers) {
        this.apiConfig.headers.forEach((value, key) => {
            config.headers[key] = value;
        });
    }

    // Replace tracking ID in request body template
    if (this.apiConfig.requestBodyTemplate) {
        try {
            const bodyTemplate = this.apiConfig.requestBodyTemplate.replace(/{trackingId}/g, trackingId);
            config.data = JSON.parse(bodyTemplate);
        } catch (e) {
            console.error('Error parsing request body template:', e);
        }
    }

    return config;
};

module.exports = mongoose.model('Provider', providerSchema);