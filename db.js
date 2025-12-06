const mongoose = require('mongoose');
const config = require('./config');

// MongoDB connection cache for serverless
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  if (!config.mongo.uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  if (cached.conn) {
    console.log('📦 Using cached MongoDB connection');
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      bufferCommands: false, // Disable Mongoose buffering
      serverSelectionTimeoutMS: 5000 // Timeout after 5s
    };

    console.log('🔌 Establishing new MongoDB connection...');
    cached.promise = mongoose.connect(config.mongo.uri, opts).then((mongoose) => {
      console.log('✅ MongoDB connected successfully');
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
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