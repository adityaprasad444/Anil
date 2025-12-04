const mongoose = require('mongoose');
const config = require('./config');

// Connect to MongoDB using config
mongoose.connect(config.mongo.uri, config.mongo.options)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define the tracking data schema
const trackingSchema = new mongoose.Schema({
  trackingId: {
    type: String,
    required: true,
    unique: true
  },
  originalTrackingId: {
    type: String,
    required: true
  },
  provider: {
    type: String,
    required: true
  },
  status: {
    type: String,
    default: 'In transit'
  },
  location: {
    type: String,
    default: ''
  },
  estimatedDelivery: {
    type: Date,
    default: null
  },
  origin: {
    type: String,
    default: ''
  },
  destination: {
    type: String,
    default: ''
  },
  weight: {
    type: String,
    default: ''
  },
  dimensions: {
    type: String,
    default: ''
  },
  history: [{
    status: String,
    location: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    description: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  lastFetched: {
    type: Date,
    default: null
  },
  nextFetchAfter: {
    type: Date,
    default: () => new Date(Date.now() + 2 * 60 * 60 * 1000) // Default 2 hours
  }
}, {
  timestamps: true
});

// Create the model
const TrackingData = mongoose.model('TrackingData', trackingSchema);

module.exports = {
  TrackingData,
  mongoose
}; 