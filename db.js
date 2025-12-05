const mongoose = require('mongoose');
const config = require('./config');

// MongoDB connection with updated options
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongo.uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log(` MongoDB: Connected to ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(' MongoDB connection error:', error.message);
    process.exit(1);
  }
};

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
  location: String,
  estimatedDelivery: Date,
  origin: String,
  destination: String,
  weight: String,
  dimensions: String,
  history: [{
    status: String,
    location: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    description: String
  }],
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
  connectDB,
  mongoose,
  TrackingData
};