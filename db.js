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
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Create the model
const TrackingData = mongoose.model('TrackingData', trackingSchema);

module.exports = {
  TrackingData,
  mongoose
}; 