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

  // If cached connection exists and is ready (1 = connected)
  if (cached.conn && mongoose.connection.readyState === 1) {
    // console.log('📦 Using cached MongoDB connection');
    return cached.conn;
  }

  // If not ready, kill the promise/conn to force reconnection
  if (mongoose.connection.readyState !== 1) {
    cached.promise = null;
    cached.conn = null;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Disable buffering to fail fast
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    console.log('🔌 Establishing new MongoDB connection...');
    cached.promise = mongoose.connect(config.mongo.uri, opts).then((mongoose) => {
      console.log('✅ MongoDB connected successfully');
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;

    // Double check connection state
    if (mongoose.connection.readyState !== 1) {
      throw new Error('MongoDB connection not ready after await');
    }

  } catch (e) {
    cached.promise = null;
    cached.conn = null;
    console.error('❌ MongoDB Connection Error:', e);
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
    default: 'In Transit'
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

// Add indexes for performance optimization
trackingSchema.index({ trackingId: 1 }); // Already unique but explicitly indexing is fine, though redundant
trackingSchema.index({ originalTrackingId: 1 });
trackingSchema.index({ provider: 1 });
trackingSchema.index({ status: 1 });
trackingSchema.index({ createdAt: -1 });
trackingSchema.index({ lastUpdated: -1 });

// Compound indexes for common filter combinations with sorting
trackingSchema.index({ provider: 1, createdAt: -1 });
trackingSchema.index({ status: 1, createdAt: -1 });
trackingSchema.index({ provider: 1, status: 1 });
trackingSchema.index({ createdAt: -1, status: 1 }); // Useful for status counts over time
trackingSchema.index({ lastUpdated: -1, status: 1 }); // Useful for identifying stuck shipments

// Create the model
const TrackingData = mongoose.model('TrackingData', trackingSchema);

module.exports = {
  connectDB,
  mongoose,
  TrackingData
};