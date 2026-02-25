// tracker-app.js
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const mongoose = require('mongoose');
const config = require('./config');
const { connectDB, TrackingData } = require('./db');
const User = require('./models/User');
const Provider = require('./models/Provider');
const BulkUpload = require('./models/BulkUpload');
const EmailConfig = require('./models/EmailConfig');
const EmailLog = require('./models/EmailLog');
const Report = require('./models/Report');
const EmailTemplate = require('./models/EmailTemplate');
const trackingService = require('./services/trackingService');
const emailService = require('./services/emailService');
const cron = require('node-cron');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerOptions = require('./swaggerConfig');

// Vercel Web Analytics - Server-side integration for Next.js-like servers
// Note: For plain Express servers, the main analytics tracking happens client-side
let analyticsModule;
try {
  analyticsModule = require('@vercel/analytics/server');
  if (analyticsModule) {
    console.log('✅ @vercel/analytics/server loaded successfully');
  }
} catch (error) {
  console.warn('⚠️ @vercel/analytics/server not available, which is expected for Express servers. Client-side analytics will handle tracking.');
  analyticsModule = null;
}


const app = express();
app.set('trust proxy', 1); // Trust first proxy (Vercel)

// Database connection middleware - MUST be the first thing
const ensureDbConnection = async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    res.status(500).json({ error: 'Database connection failed' });
  }
};
app.use(ensureDbConnection);

// Middleware
// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for development to allow external scripts/styles
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow resources from Google Maps
  crossOriginEmbedderPolicy: false // DISABLE strict embedding policy to allow iframes
}));
app.use(cors({
  origin: 'http://localhost:3001',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
const MongoStore = require('connect-mongo').default;

app.use(session({
  secret: config.session.secret,
  store: MongoStore.create({
    mongoUrl: config.mongo.uri,
    ttl: 24 * 60 * 60, // 24 hours
    autoRemove: 'native'
  }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// Serve static files
const publicPath = path.join(process.cwd(), 'public');
app.use(express.static(publicPath));

// Swagger Setup
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Vercel Web Analytics middleware - Track API requests with Server-Timing headers
// Server-Timing headers help Vercel Web Analytics measure backend performance
app.use((req, res, next) => {
  // Record request start time for analytics
  const startTime = Date.now();

  // Capture original response methods
  const originalSend = res.send;
  const originalJson = res.json;

  // Override res.send to track response timing
  res.send = function (data) {
    const duration = Date.now() - startTime;
    // Add Server-Timing header for web vitals tracking (RFC 7231 compliant)
    res.setHeader('Server-Timing', `backend;dur=${duration};desc="Backend Processing"`);
    return originalSend.call(this, data);
  };

  // Override res.json to track response timing
  res.json = function (data) {
    const duration = Date.now() - startTime;
    // Add Server-Timing header for web vitals tracking
    res.setHeader('Server-Timing', `backend;dur=${duration};desc="Backend Processing"`);
    return originalJson.call(this, data);
  };

  next();
});

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
};

// Setup Cron Job for automatic tracking data updates
/*
cron.schedule('* * * * *', async () => {
  console.log('\n⏰ Cron job started: Updating all tracking data...');
  try {
    const results = await trackingService.updateAllTrackingData();
    console.log('✅ Cron job completed:', results);
  } catch (error) {
    console.error('❌ Cron job failed:', error);
  }
});
*/

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Check server health
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 environment:
 *                   type: string
 *                 dbState:
 *                   type: integer
 */
app.get('/api/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  res.status(200).json({
    status: 'ok',
    environment: config.server.environment,
    dbState: dbStatus, // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
    dbName: mongoose.connection.name
  });
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(publicPath, 'login.html'));
});

app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(publicPath, 'admin.html'));
});

app.get('/tools', requireAuth, (req, res) => {
  res.sendFile(path.join(publicPath, 'tools.html'));
});

/**
 * @swagger
 * components:
 *   schemas:
 *     TrackingData:
 *       type: object
 *       properties:
 *         trackingId:
 *           type: string
 *         originalTrackingId:
 *           type: string
 *         provider:
 *           type: string
 *         status:
 *           type: string
 *         location:
 *           type: string
 *         lastUpdated:
 *           type: string
 *           format: date-time
 *         history:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *               location:
 *                 type: string
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *               description:
 *                 type: string
 *     Provider:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         trackingUrl:
 *           type: string
 *         apiConfig:
 *           type: object
 */

// Session check endpoint
/**
 * @swagger
 * /api/login/check:
 *   get:
 *     summary: Check current session status
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: User is authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 authenticated:
 *                   type: boolean
 *                 user:
 *                   type: object
 *                   properties:
 *                     username:
 *                       type: string
 *                     role:
 *                       type: string
 *       401:
 *         description: User is not authenticated
 */
app.get('/api/login/check', (req, res) => {
  if (req.session && req.session.user) {
    res.json({
      authenticated: true,
      user: {
        username: req.session.user.username,
        role: req.session.user.role
      }
    });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

// Tracking API routes
/**
 * @swagger
 * /api/tracking/list:
 *   get:
 *     summary: List all tracking entries
 *     tags: [Tracking]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *       - in: query
 *         name: trackingId
 *         schema:
 *           type: string
 *         description: Filter by partial tracking ID
 *       - in: query
 *         name: provider
 *         schema:
 *           type: string
 *         description: Filter by provider
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: List of tracking entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 entries:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TrackingData'
 *                 total:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /api/tracking/stats:
 *   get:
 *     summary: Get tracking statistics
 *     tags: [Tracking]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Statistics object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 delivered:
 *                   type: integer
 *                 inTransit:
 *                   type: integer
 *                 pending:
 *                   type: integer
 *                 exception:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 */
app.get('/api/tracking/stats', requireAuth, async (req, res) => {
  try {
    const stats = await TrackingData.aggregate([
      {
        $group: {
          _id: { $toLower: "$status" },
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {
      total: 0,
      delivered: 0,
      inTransit: 0,
      pending: 0,
      exception: 0,
      outForDelivery: 0
    };

    stats.forEach(s => {
      const count = s.count;
      result.total += count;
      const status = s._id || '';
      if (status === 'delivered') {
        result.delivered += count;
      } else if (status.includes('out for delivery') || status.includes('scheduled for delivery')) {
        result.outForDelivery += count;
      } else if (status.includes('exception') || status.includes('delay') || status.includes('fail')) {
        result.exception += count;
      } else {
        // Catch-all for all other active statuses (In Transit, Shipped, Booked, Pending, etc.)
        result.inTransit += count;
      }
    });

    res.json(result);
  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/tracking/list', requireAuth, async (req, res) => {
  try {
    console.log('📋 Fetching tracking list');

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.trackingId) {
      // Search in both trackingId and originalTrackingId fields
      filter.$or = [
        { trackingId: { $regex: req.query.trackingId, $options: 'i' } },
        { originalTrackingId: { $regex: req.query.trackingId, $options: 'i' } }
      ];
    }
    if (req.query.provider) {
      filter.provider = req.query.provider;
    }
    if (req.query.status) {
      const statusQuery = req.query.status.toLowerCase();
      if (statusQuery === 'delivered') {
        filter.status = { $regex: '^delivered$', $options: 'i' };
      } else if (statusQuery === 'out-for-delivery') {
        filter.status = { $regex: 'out for delivery|scheduled for delivery', $options: 'i' };
      } else if (statusQuery === 'exception') {
        filter.status = { $regex: 'exception|delay|fail', $options: 'i' };
      } else if (statusQuery === 'in-transit' || statusQuery === 'pending') {
        // Match anything that is NOT delivered, out for delivery, or exception
        filter.status = {
          $not: { $regex: '^delivered$|out for delivery|scheduled for delivery|exception|delay|fail', $options: 'i' }
        };
      } else {
        filter.status = { $regex: statusQuery, $options: 'i' };
      }
    }

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) {
        filter.createdAt.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        // Set to end of day
        const endDate = new Date(req.query.endDate);
        endDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endDate;
      }
    }

    const trackingList = await TrackingData.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCount = await TrackingData.countDocuments(filter);

    console.log(`✅ Found ${trackingList.length} tracking entries (Total: ${totalCount})`);
    res.json({ entries: trackingList, total: totalCount });
  } catch (error) {
    console.error('❌ Error fetching tracking list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/tracking/{trackingId}:
 *   get:
 *     summary: Get tracking data by ID
 *     tags: [Tracking]
 *     parameters:
 *       - in: path
 *         name: trackingId
 *         schema:
 *           type: string
 *         required: true
 *         description: The tracking ID
 *     responses:
 *       200:
 *         description: The tracking data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TrackingData'
 *       404:
 *         description: Tracking ID not found
 *       500:
 *         description: Internal server error
 */
app.get('/api/tracking/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    console.log(`🔍 Fetching tracking data for ID: ${trackingId}`);

    // Get tracking data using our service
    const trackingData = await trackingService.getTrackingData(trackingId);

    if (!trackingData) {
      console.log(`❌ Tracking ID not found: ${trackingId}`);
      return res.status(404).json({ error: 'Tracking ID not found' });
    }

    // Get provider information for the tracking URL
    const provider = await Provider.findOne({ name: trackingData.provider });
    let trackingUrl = '';

    if (provider) {
      const originalId = trackingData.originalTrackingId || trackingId;
      const encodedTrackingId = encodeURIComponent(originalId);
      trackingUrl = provider.trackingUrl;

      // If URL contains a placeholder, replace it, otherwise append the tracking ID
      if (trackingUrl.includes('{trackingId}')) {
        trackingUrl = trackingUrl.replace('{trackingId}', encodedTrackingId);
      } else {
        trackingUrl = trackingUrl.endsWith('/')
          ? `${trackingUrl}${encodedTrackingId}`
          : `${trackingUrl}/${encodedTrackingId}`;
      }
    }

    console.log(`✅ Found tracking data for ID: ${trackingId}`);
    res.json({
      trackingId: trackingData.trackingId,
      // originalTrackingId: trackingData.originalTrackingId,
      // provider: trackingData.provider,
      status: trackingData.status,
      location: trackingData.location,
      estimatedDelivery: trackingData.estimatedDelivery,
      origin: trackingData.origin,
      destination: trackingData.destination,
      weight: trackingData.weight,
      dimensions: trackingData.dimensions,
      history: trackingData.history || [],
      lastUpdated: trackingData.lastUpdated,
      // trackingUrl: trackingUrl
    });
  } catch (error) {
    console.error('Error fetching tracking data:', error);
    res.status(500).json({ error: 'Failed to fetch tracking data' });
  }
});

// Add delete endpoint for tracking IDs
/**
 * @swagger
 * /api/tracking/bulk-delete:
 *   delete:
 *     summary: Delete multiple tracking entries
 *     tags: [Tracking]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - trackingIds
 *             properties:
 *               trackingIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Items deleted successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
app.delete('/api/tracking/bulk-delete', requireAuth, async (req, res) => {
  try {
    const { trackingIds } = req.body;
    if (!trackingIds || !Array.isArray(trackingIds)) {
      return res.status(400).json({ error: 'trackingIds array is required' });
    }

    console.log(`🗑️ Bulk deleting ${trackingIds.length} tracking IDs`);
    const result = await TrackingData.deleteMany({ trackingId: { $in: trackingIds } });

    console.log(`✅ Successfully deleted ${result.deletedCount} items`);
    res.json({ message: `Successfully deleted ${result.deletedCount} items`, count: result.deletedCount });
  } catch (error) {
    console.error('❌ Bulk delete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/tracking/:trackingId', requireAuth, async (req, res) => {
  try {
    const { trackingId } = req.params;
    console.log('🗑️ Deleting tracking ID:', trackingId);

    const escapedId = trackingId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const trackingData = await TrackingData.findOneAndDelete({
      trackingId: { $regex: new RegExp(`^${escapedId}$`, 'i') }
    });

    if (!trackingData) {
      console.log('❌ Tracking ID not found:', trackingId);
      return res.status(404).json({ error: 'Tracking ID not found' });
    }

    console.log('✅ Tracking ID deleted successfully:', trackingId);
    res.json({ message: 'Tracking ID deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting tracking ID:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add update status endpoint for tracking IDs
/**
 * @swagger
 * /api/tracking/bulk-status:
 *   put:
 *     summary: Update status for multiple tracking entries
 *     tags: [Tracking]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - trackingIds
 *               - status
 *             properties:
 *               trackingIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
app.put('/api/tracking/bulk-status', requireAuth, async (req, res) => {
  try {
    const { trackingIds, status } = req.body;
    if (!trackingIds || !Array.isArray(trackingIds) || !status) {
      return res.status(400).json({ error: 'trackingIds array and status are required' });
    }

    console.log(`📝 Bulk updating status to "${status}" for ${trackingIds.length} tracking IDs`);
    const result = await TrackingData.updateMany(
      { trackingId: { $in: trackingIds } },
      { $set: { status, lastUpdated: new Date() } }
    );

    console.log(`✅ Successfully updated ${result.modifiedCount} items`);
    res.json({ message: `Successfully updated ${result.modifiedCount} items`, count: result.modifiedCount });
  } catch (error) {
    console.error('❌ Bulk status update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/tracking/:trackingId/status', requireAuth, async (req, res) => {
  try {
    const { trackingId } = req.params;
    const { status } = req.body;
    console.log('📝 Updating tracking status:', { trackingId, status });

    const escapedId = trackingId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const trackingData = await TrackingData.findOneAndUpdate(
      { trackingId: { $regex: new RegExp(`^${escapedId}$`, 'i') } },
      {
        status,
        lastUpdated: new Date()
      },
      { new: true }
    );

    if (!trackingData) {
      console.log('❌ Tracking ID not found:', trackingId);
      return res.status(404).json({ error: 'Tracking ID not found' });
    }

    console.log('✅ Tracking status updated successfully:', { trackingId, status });
    res.json({ message: 'Tracking status updated successfully', trackingData });
  } catch (error) {
    console.error('❌ Error updating tracking status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Manual refresh endpoint for a specific tracking ID
/**
 * @swagger
 * /api/tracking/{trackingId}/refresh:
 *   post:
 *     summary: Manually refresh tracking data for a specific ID
 *     tags: [Tracking]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: trackingId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tracking data refreshed successfully
 *       500:
 *         description: Failed to refresh tracking data
 */
app.post('/api/tracking/:trackingId/refresh', requireAuth, async (req, res) => {
  try {
    const { trackingId } = req.params;
    console.log('🔄 Manual refresh requested for:', trackingId);

    const updatedData = await trackingService.refreshTrackingData(trackingId);

    console.log('✅ Tracking data refreshed successfully:', trackingId);
    res.json({
      message: 'Tracking data refreshed successfully',
      trackingData: updatedData
    });
  } catch (error) {
    console.error('❌ Error refreshing tracking data:', error);
    res.status(500).json({ error: error.message || 'Failed to refresh tracking data' });
  }
});

// Edit tracking endpoint
/**
 * @swagger
 * /api/tracking/{trackingId}/edit:
 *   put:
 *     summary: Edit an existing tracking entry
 *     tags: [Tracking]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: trackingId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newTrackingId:
 *                 type: string
 *               originalTrackingId:
 *                 type: string
 *               provider:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tracking updated successfully
 *       404:
 *         description: Tracking ID not found
 *       500:
 *         description: Internal server error
 */
app.put('/api/tracking/:trackingId/edit', requireAuth, async (req, res) => {
  try {
    const { trackingId } = req.params;
    const { newTrackingId, originalTrackingId, provider } = req.body;

    console.log(`📝 Editing tracking ID: ${trackingId}`, { newTrackingId, originalTrackingId, provider });

    const escapedId = trackingId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingEntry = await TrackingData.findOne({
      trackingId: { $regex: new RegExp(`^${escapedId}$`, 'i') }
    });

    if (!existingEntry) {
      return res.status(404).json({ error: 'Tracking ID not found' });
    }

    // Check if any changes are actually being made
    const isTrackingIdSame = !newTrackingId || newTrackingId === existingEntry.trackingId;
    const isOriginalIdSame = !originalTrackingId || originalTrackingId === existingEntry.originalTrackingId;
    const isProviderSame = !provider || provider === existingEntry.provider;

    if (isTrackingIdSame && isOriginalIdSame && isProviderSame) {
      console.log(`⚠️ No changes detected for ${trackingId}. Aborting edit.`);
      return res.status(400).json({ error: 'No changes detected. Current data matches new data. History preserved.' });
    }

    // Update fields
    if (newTrackingId) existingEntry.trackingId = newTrackingId;
    if (originalTrackingId) existingEntry.originalTrackingId = originalTrackingId;
    if (provider) existingEntry.provider = provider;

    // "on edit of any existing history is found then clear that"
    if (existingEntry.history && existingEntry.history.length > 0) {
      console.log(`🧹 Clearing history for ${trackingId} due to edit`);
      existingEntry.history = [];
    }
    
    // Reset status to Pending to trigger a fresh status fetch
    existingEntry.status = 'Pending';
    existingEntry.lastUpdated = new Date();

    await existingEntry.save();

    console.log(`✅ Tracking updated for ${trackingId}. Triggering auto-refresh...`);

    // "auto trigger tracking so new tracking data history can be loaded into tracking"
    // Use the new tracking ID for refresh if it was changed
    const idToRefresh = newTrackingId || trackingId;
    
    // Trigger refresh in background or wait for it
    try {
      await trackingService.refreshTrackingData(idToRefresh);
    } catch (refreshError) {
      console.error(`⚠️ Auto-trigger refresh failed for ${idToRefresh}:`, refreshError.message);
      // We don't fail the whole request because the update was successful
    }

    res.json({ 
      message: 'Tracking updated successfully and refresh triggered',
      trackingId: idToRefresh
    });

  } catch (error) {
    console.error('❌ Error editing tracking:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'New Tracking ID already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reports API
/**
 * @swagger
 * /api/reports/generate:
 *   get:
 *     summary: Generate custom tracking reports
 *     tags: [Reports]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [delivery_performance, volume_by_provider, status_distribution]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Report data
 */
app.get('/api/reports/types', requireAuth, async (req, res) => {
  try {
    const reports = await Report.find({}).sort({ category: 1, title: 1 });
    if (reports.length === 0) {
      await seedReports();
      const newReports = await Report.find({}).sort({ category: 1, title: 1 });
      return res.json(newReports);
    }
    res.json(reports);
  } catch (error) {
    console.error('Feature reports fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch report types' });
  }
});

async function seedReports() {
  const seedData = [
    { type: 'delivery_performance', title: 'Delivery Performance (Speed)', category: 'Core Metrics' },
    { type: 'volume_by_provider', title: 'Volume by Provider', category: 'Core Metrics' },
    { type: 'status_distribution', title: 'Status Distribution', category: 'Core Metrics' },
    { type: 'stuck_shipments', title: 'Stuck Shipments (Aging)', category: 'Reliability & Health' },
    { type: 'exception_rate', title: 'Provider Exception Rate', category: 'Reliability & Health' },
    { type: 'data_health', title: 'Data Sync Health', category: 'Reliability & Health' },
    { type: 'delivery_attempts', title: 'First-Attempt Delivery Rate', category: 'Engagement & Quality' },
    { type: 'notification_stats', title: 'Email Notification Success', category: 'Engagement & Quality' },
    { type: 'daily_trend', title: 'New Creations vs Delivered', category: 'Engagement & Quality' },
    { type: 'same_day_delivery', title: 'Same Day Delivery Success', category: 'Engagement & Quality' },
    { type: 'status_distribution_provider', title: 'Status Distribution by Provider', category: 'Engagement & Quality' },
    { type: 'volume_trends', title: 'Volume Peak Trends', category: 'Engagement & Quality' }
  ];

  for (const r of seedData) {
    await Report.findOneAndUpdate(
      { type: r.type },
      { $setOnInsert: r },
      { upsert: true, new: true }
    );
  }
}

async function seedEmailTemplates() {
  const templates = [
    {
      name: 'daily_report',
      subject: 'Daily Tracking Report - {{date}}',
      description: 'Daily summary of packages created and delivered',
      variables: ['date', 'createdCount', 'deliveredCount', 'pendingCount'],
      textContent: `Daily Tracking Report

Date: {{date}}

Packages Created: {{createdCount}}
Packages Delivered: {{deliveredCount}}
Pending Delivery: {{pendingCount}}

This is an automated daily report from AK Logistics Tracking System.`,
      htmlContent: `
<div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
  <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h2 style="color: #4f46e5; margin-bottom: 20px;">📊 Daily Tracking Report</h2>
    <p style="color: #666; font-size: 14px; margin-bottom: 20px;">Report Date: <strong>{{date}}</strong></p>
    
    <div style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
            <span style="color: #666; font-size: 14px;">📦 Packages Created</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right;">
            <strong style="color: #4f46e5; font-size: 24px;">{{createdCount}}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
            <span style="color: #666; font-size: 14px;">✅ Packages Delivered</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right;">
            <strong style="color: #10b981; font-size: 24px;">{{deliveredCount}}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px;">
            <span style="color: #666; font-size: 14px;">⏳ Pending Delivery</span>
          </td>
          <td style="padding: 12px; text-align: right;">
            <strong style="color: #f59e0b; font-size: 24px;">{{pendingCount}}</strong>
          </td>
        </tr>
      </table>
    </div>
    
    <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
      This is an automated daily report from AK Logistics Tracking System
    </p>
  </div>
</div>`,
      isActive: true
    },
    {
      name: 'delivery_notification',
      subject: '📦 Package Delivered: {{trackingId}}',
      description: 'Notification when a package is delivered',
      variables: ['trackingId', 'originalTrackingId', 'provider', 'status', 'location', 'destination', 'lastUpdated'],
      textContent: `Package Delivered!

Shipment for {{trackingId}} has been successfully delivered.

System ID: {{trackingId}}
Provider ID: {{originalTrackingId}}
Provider: {{provider}}
Status: {{status}}
Location: {{location}}
Destination: {{destination}}
Last Updated: {{lastUpdated}}

AK Logistics Tracking System`,
      htmlContent: `
<div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; border: 1px solid #eee; border-radius: 10px; padding: 20px;">
    <h2 style="color: #10b981; margin-top: 0;">Package Delivered!</h2>
    <p>Shipment for <strong>{{trackingId}}</strong> has been successfully delivered.</p>
    
    <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>System ID:</strong> {{trackingId}}</p>
        <p style="margin: 5px 0;"><strong>Provider ID:</strong> {{originalTrackingId}}</p>
        <p style="margin: 5px 0;"><strong>Provider:</strong> {{provider}}</p>
        <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #10b981; font-weight: bold;">{{status}}</span></p>
        <p style="margin: 5px 0;"><strong>Location:</strong> {{location}}</p>
        <p style="margin: 5px 0;"><strong>Destination:</strong> {{destination}}</p>
    </div>

    <p style="font-size: 0.9em; color: #666;">
        Last Updated: {{lastUpdated}}
    </p>
    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="font-size: 0.8em; color: #999; text-align: center;">AK Logistics Tracking System</p>
</div>`,
      isActive: true
    },
    {
      name: 'admin_alert',
      subject: '🚨 [Tracking Alert] {{subject}}',
      description: 'Generic admin notification template',
      variables: ['subject', 'message'],
      textContent: `Admin Alert

{{message}}

This is an automated notification from AK Logistics Tracking System.`,
      htmlContent: `
<div style="font-family: Arial, sans-serif; padding: 20px; background-color: #fef2f2;">
  <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 4px solid #ef4444;">
    <h2 style="color: #ef4444; margin-top: 0;">🚨 Admin Alert</h2>
    <div style="background: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0;">
      <p style="color: #333; line-height: 1.6; margin: 0;">{{message}}</p>
    </div>
    <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
      This is an automated notification from AK Logistics Tracking System
    </p>
  </div>
</div>`,
      isActive: true
    }
  ];

  for (const template of templates) {
    await EmailTemplate.findOneAndUpdate(
      { name: template.name },
      { $setOnInsert: template },
      { upsert: true, new: true }
    );
  }
  console.log('✅ Email templates seeded');
}

app.get('/api/reports/generate', requireAuth, async (req, res) => {
  try {
    const { type, startDate, endDate, provider } = req.query;
    console.log(`📊 Generating report: ${type}`, { startDate, endDate, provider });

    // Validate if report type exists in DB
    const reportMeta = await Report.findOne({ type });
    if (!reportMeta) {
      await seedReports();
      const retryMeta = await Report.findOne({ type });
      if (!retryMeta) return res.status(400).json({ error: 'Invalid report type' });
    }

    const filter = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }
    if (provider) filter.provider = provider;

    let result = null;

    if (type === 'delivery_performance') {
      const delivered = await TrackingData.find({
        ...filter,
        status: { $regex: /^delivered$/i }
      });

      result = delivered.map(d => {
        const deliveredEvent = d.history.find(h => h.status && h.status.toLowerCase().includes('delivered'));
        const deliveryDate = deliveredEvent ? new Date(deliveredEvent.timestamp) : new Date(d.lastUpdated);
        const createdDate = new Date(d.createdAt);
        const days = Math.round((deliveryDate - createdDate) / (1000 * 60 * 60 * 24));
        return {
          trackingId: d.trackingId,
          provider: d.provider,
          days: days > 0 ? days : 1, // Minimum 1 day
          date: deliveryDate
        };
      });
      // Stats calculation for this report is done client side previously or here?
      // Wait, existing code returned aggregated stats: { provider, avgDays, count, min, max, speed... }
      // AND raw data? No, existing code returned the AGGREGATED result.
      // I must match existing logic.
      // Re-reading existing code for delivery_performance...
      // It did aggregation!
      // Let me fix that.
      
      const stats = {};
      delivered.forEach(pkg => {
        const p = pkg.provider || 'Unknown';
        if (!stats[p]) stats[p] = { totalDays: 0, count: 0, fast: 0, medium: 0, slow: 0, min: Infinity, max: 0 };
        const deliveredEvent = pkg.history.find(h => h.status && h.status.toLowerCase().includes('delivered'));
        const deliveryDate = deliveredEvent ? new Date(deliveredEvent.timestamp) : new Date(pkg.lastUpdated);
        const createdDate = new Date(pkg.createdAt);
        const diffMs = deliveryDate - createdDate;
        const diffDays = Math.max(0.1, diffMs / (1000 * 60 * 60 * 24));
        stats[p].totalDays += diffDays;
        stats[p].count++;
        stats[p].min = Math.min(stats[p].min, diffDays);
        stats[p].max = Math.max(stats[p].max, diffDays);
        if (diffDays <= 3) stats[p].fast++;
        else if (diffDays <= 7) stats[p].medium++;
        else stats[p].slow++;
      });
      result = Object.keys(stats).map(p => ({
        provider: p,
        avgDays: (stats[p].totalDays / stats[p].count).toFixed(2),
        count: stats[p].count,
        min: stats[p].min.toFixed(1),
        max: stats[p].max.toFixed(1),
        speed: { fast: stats[p].fast, medium: stats[p].medium, slow: stats[p].slow }
      }));
    }

    if (type === 'volume_by_provider') {
      const volume = await TrackingData.aggregate([
        { $match: filter },
        { $group: { _id: "$provider", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      result = volume.map(v => ({ provider: v._id || 'Unknown', count: v.count }));
    }

    if (type === 'status_distribution') {
      const dist = await TrackingData.aggregate([
        { $match: filter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      result = dist.map(d => ({ status: d._id || 'Unknown', count: d.count }));
    }

    if (type === 'stuck_shipments') {
      const thresholdDays = 5;
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - thresholdDays);
      const stuck = await TrackingData.find({
        ...filter,
        status: { $nin: [/delivered/i, /cancelled/i, /returned/i] },
        lastUpdated: { $lte: thresholdDate }
      }).sort({ lastUpdated: 1 });
      result = stuck.map(s => ({
        trackingId: s.trackingId,
        provider: s.provider,
        status: s.status,
        lastUpdated: s.lastUpdated,
        daysStuck: Math.floor((new Date() - s.lastUpdated) / (1000 * 60 * 60 * 24))
      }));
    }

    if (type === 'exception_rate') {
      const exceptions = await TrackingData.aggregate([
        { $match: filter },
        { 
          $project: {
            provider: 1,
            isException: { 
              $cond: [
                { $or: [
                  { $regexMatch: { input: "$status", regex: /failed/i } },
                  { $regexMatch: { input: "$status", regex: /delay/i } },
                  { $regexMatch: { input: "$status", regex: /hold/i } },
                  { $regexMatch: { input: "$status", regex: /return/i } }
                ]}, 1, 0
              ]
            }
          }
        },
        { $group: { _id: "$provider", total: { $sum: 1 }, exceptions: { $sum: "$isException" } } },
        { $project: { provider: "$_id", total: 1, exceptions: 1, rate: { $multiply: [{ $divide: ["$exceptions", { $max: ["$total", 1] }] }, 100] } } },
        { $sort: { rate: -1 } }
      ]);
      result = exceptions.map(e => ({ ...e, rate: e.rate.toFixed(1) }));
    }

    if (type === 'volume_trends') {
      const trends = await TrackingData.aggregate([
        { $match: filter },
        { 
          $group: { 
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, 
            count: { $sum: 1 } 
          } 
        },
        { $sort: { _id: 1 } }
      ]);
      result = trends.map(t => ({ date: t._id, count: t.count }));
    }

    if (type === 'data_health') {
      const now = new Date();
      const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now - 48 * 60 * 60 * 1000);
      const health = await TrackingData.aggregate([
        { $match: filter },
        { 
          $project: {
            provider: 1,
            freshness: {
              $cond: [
                { $gt: ["$lastUpdated", oneDayAgo] }, "Fresh (<24h)",
                { $cond: [{ $gt: ["$lastUpdated", twoDaysAgo] }, "Stale (24-48h)", "Critical (>48h)"] }
              ]
            }
          }
        },
        { $group: { _id: { provider: "$provider", freshness: "$freshness" }, count: { $sum: 1 } } },
        { $sort: { "_id.provider": 1, "_id.freshness": 1 } }
      ]);
      result = health.map(h => ({ 
        provider: h._id.provider || 'Unknown', 
        freshness: h._id.freshness, 
        count: h.count 
      }));
    }

    if (type === 'delivery_attempts') {
      const delivered = await TrackingData.find({
        ...filter,
        status: { $regex: /^delivered$/i }
      });
      const stats = {};
      delivered.forEach(pkg => {
        const p = pkg.provider || 'Unknown';
        if (!stats[p]) stats[p] = { total: 0, firstAttempt: 0 };
        stats[p].total++;
        const attempts = pkg.history.filter(h => h.status && h.status.toLowerCase().includes('out for delivery')).length;
        if (attempts <= 1) stats[p].firstAttempt++;
      });
      result = Object.entries(stats).map(([k, v]) => ({
        provider: k,
        total: v.total,
        firstAttempt: v.firstAttempt,
        rate: v.total > 0 ? ((v.firstAttempt / v.total) * 100).toFixed(1) : 0
      }));
    }

    if (type === 'notification_stats') {
      const logs = await EmailLog.aggregate([
        { 
          $match: { 
            ...(startDate || endDate ? { timestamp: filter.createdAt } : {})
          } 
        },
        { $group: { _id: { type: "$type", status: "$status" }, count: { $sum: 1 } } }
      ]);
      const emailStats = {};
      logs.forEach(l => {
        const t = l._id.type;
        if (!emailStats[t]) emailStats[t] = { success: 0, failed: 0 };
        if (l._id.status === 'SUCCESS') emailStats[t].success += l.count;
        else emailStats[t].failed += l.count;
      });
      result = Object.entries(emailStats).map(([k, v]) => ({
        type: k,
        success: v.success,
        failed: v.failed,
        rate: (v.success + v.failed) > 0 ? ((v.success / (v.success + v.failed)) * 100).toFixed(1) : 0
      }));
    }

    if (type === 'daily_trend') {
      const creations = await TrackingData.aggregate([
        { $match: filter },
        { 
          $group: { 
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, 
            created: { $sum: 1 } 
          } 
        }
      ]);
      const allDelivered = await TrackingData.find({
        ...filter,
        status: { $regex: /^delivered$/i }
      });
      const deliveryCounts = {};
      allDelivered.forEach(pkg => {
        const deliveredEvent = pkg.history.find(h => h.status && h.status.toLowerCase().includes('delivered'));
        const date = deliveredEvent ? 
          new Date(deliveredEvent.timestamp).toISOString().split('T')[0] : 
          new Date(pkg.lastUpdated).toISOString().split('T')[0];
        deliveryCounts[date] = (deliveryCounts[date] || 0) + 1;
      });
      const dates = new Set([...creations.map(c => c._id), ...Object.keys(deliveryCounts)]);
      result = Array.from(dates).map(date => ({
        date,
        created: creations.find(c => c._id === date)?.created || 0,
        delivered: deliveryCounts[date] || 0
      })).sort((a, b) => a.date.localeCompare(b.date));
    }

    if (type === 'same_day_delivery') {
      const delivered = await TrackingData.find({
        ...filter,
        status: { $regex: /^delivered$/i }
      });
      result = [];
      delivered.forEach(pkg => {
        const deliveredEvent = pkg.history.find(h => h.status && h.status.toLowerCase().includes('delivered'));
        const deliveryDate = deliveredEvent ? new Date(deliveredEvent.timestamp) : new Date(pkg.lastUpdated);
        const createdDate = new Date(pkg.createdAt);
        const sameDay = deliveryDate.toDateString() === createdDate.toDateString();
        if (sameDay) {
          result.push({
            trackingId: pkg.trackingId,
            provider: pkg.provider,
            created: pkg.createdAt,
            delivered: deliveryDate,
            duration: ((deliveryDate - createdDate) / (1000 * 60 * 60)).toFixed(1) + ' hrs'
          });
        }
      });
    }

    if (type === 'status_distribution_provider') {
      const dist = await TrackingData.aggregate([
        { $match: filter },
        { 
          $group: { 
            _id: { provider: "$provider", status: "$status" }, 
            count: { $sum: 1 } 
          } 
        },
        { $sort: { "_id.provider": 1, "_id.status": 1 } }
      ]);
      result = {};
      dist.forEach(item => {
        const p = item._id.provider || 'Unknown';
        if (!result[p]) result[p] = {};
        result[p][item._id.status] = item.count;
      });
    }

    if (result) {
      await Report.updateOne(
        { type }, 
        { 
          $set: { 
            lastRefreshed: new Date(),
            lastData: result
          }
        }
      );
      return res.json(result);
    }

    res.status(400).json({ error: 'Invalid report type' });
  } catch (error) {
    console.error('❌ Report generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Bulk refresh endpoint - refresh all active tracking data
/**
 * @swagger
 * /api/tracking/refresh-all:
 *   post:
 *     summary: Trigger bulk refresh of all active tracking data
 *     tags: [Tracking]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Bulk refresh started
 *       500:
 *         description: Failed to start bulk refresh
 */
app.post('/api/tracking/refresh-all', requireAuth, async (req, res) => {
  try {
    const force = req.query.force === 'true';
    console.log(`🔄 Bulk refresh requested for all tracking data (Force: ${force})`);

    // Run the update and wait for it to complete (required for Vercel/Serverless)
    const results = await trackingService.updateAllTrackingData(force);
    console.log('✅ Bulk refresh completed:', results);

    // Respond with results
    res.json({
      message: force ? 'Full bulk refresh completed' : 'Bulk refresh completed',
      results: results
    });
  } catch (error) {
    console.error('❌ Error during bulk refresh:', error);
    res.status(500).json({ error: 'Failed to complete bulk refresh', details: error.message });
  }
});

// API Routes
/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Login to the system
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Missing credentials
 *       401:
 *         description: Invalid credentials
 */
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('🔐 Login attempt:', { username, timestamp: new Date() });

    if (!username || !password) {
      console.log('❌ Login failed: Missing credentials');
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      console.log('❌ Login failed: User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      console.log('❌ Login failed: Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await user.updateLastLogin();
    req.session.user = {
      id: user._id,
      username: user.username,
      role: user.role
    };

    console.log('✅ Login successful:', { username: user.username, role: user.role });
    res.json({
      success: true,
      user: {
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/logout:
 *   post:
 *     summary: Logout from the system
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logout successful
 */
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

/**
 * @swagger
 * /api/tracking/generate:
 *   post:
 *     summary: Generate a new tracking ID
 *     tags: [Tracking]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider
 *               - originalTrackingId
 *             properties:
 *               provider:
 *                 type: string
 *               originalTrackingId:
 *                 type: string
 *               manualTrackingId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tracking ID generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 trackingId:
 *                   type: string
 *       400:
 *         description: Bad request or duplicate ID
 *       500:
 *         description: Internal server error
 */
app.post('/api/tracking/bulk', requireAuth, async (req, res) => {
  try {
    const { items, fileName, rawContent } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    console.log(`📦 Bulk tracking ID generation request: ${items.length} items from ${fileName || 'unknown file'}`);
    const results = [];
    const errors = [];

    // Fetch supported providers and build a case-insensitive map
    const configuredProviders = await Provider.find({}, 'name');
    const providerMap = new Map(); // lowercase -> original casing
    configuredProviders.forEach(p => providerMap.set(p.name.toLowerCase(), p.name));

    for (const item of items) {
      let { provider, originalTrackingId, manualTrackingId } = item;
      if (!provider || !originalTrackingId) {
        errors.push({ item, error: 'Provider and original tracking ID are required' });
        continue;
      }

      // Check support case-insensitively and normalize casing
      const normalizedProviderName = providerMap.get(provider.toLowerCase());
      if (!normalizedProviderName) {
        errors.push({ item, error: 'provider not supported' });
        continue;
      }
      provider = normalizedProviderName; // Normalize to DB casing (e.g., 'fedex' -> 'FedEx')

      let trackingId;
      if (manualTrackingId) {
        trackingId = manualTrackingId.trim();
        const existing = await TrackingData.findOne({ trackingId });
        if (existing) {
          errors.push({ item, error: `Tracking ID ${trackingId} already exists` });
          continue;
        }
      } else {
        const randomNumber = Math.floor(100000 + Math.random() * 900000);
        trackingId = `ak${randomNumber}lg`;
      }

      try {
        const trackingData = new TrackingData({
          trackingId,
          originalTrackingId,
          provider
        });
        await trackingData.save();
        results.push(trackingId);
      } catch (err) {
        errors.push({ item, error: err.message });
      }
    }

    // Determine status
    let uploadStatus = 'success';
    if (results.length === 0 && items.length > 0) uploadStatus = 'failed';
    else if (errors.length > 0) uploadStatus = 'partial';

    // Save logs to DB
    try {
      await BulkUpload.create({
        fileName: fileName || 'bulk_upload.csv',
        uploadedBy: req.session.user.username,
        status: uploadStatus,
        totalItems: items.length,
        successCount: results.length,
        failCount: errors.length,
        uploadErrors: errors,
        rawContent: rawContent
      });
      console.log('✅ Bulk upload logs saved to database');
    } catch (logErr) {
      console.error('❌ Error saving bulk upload logs:', logErr);
      // Don't fail the request if logging fails, but it's good to know
    }

    console.log(`✅ Bulk generation complete. Success: ${results.length}, Errors: ${errors.length}`);
    res.json({
      success: true,
      count: results.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('❌ Bulk generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/tracking/generate', requireAuth, async (req, res) => {
  try {
    const { provider, originalTrackingId, manualTrackingId } = req.body;
    console.log('📦 Tracking ID generation request:', { provider, originalTrackingId, manualTrackingId });

    if (!provider || !originalTrackingId) {
      return res.status(400).json({ error: 'Provider and original tracking ID are required' });
    }

    let trackingId;

    if (manualTrackingId) {
      // Use manually provided ID
      trackingId = manualTrackingId.trim();

      // Check for duplicates
      const existing = await TrackingData.findOne({ trackingId });
      if (existing) {
        return res.status(400).json({ error: 'Tracking ID already exists' });
      }
    } else {
      // Generate a 6-digit random number
      const randomNumber = Math.floor(100000 + Math.random() * 900000);
      trackingId = `ak${randomNumber}lg`;
    }

    const trackingData = new TrackingData({
      trackingId,
      originalTrackingId,
      provider
    });

    await trackingData.save();
    console.log('✅ Tracking ID generated:', { trackingId });
    res.json({ success: true, trackingId });
  } catch (error) {
    console.error('❌ Tracking ID generation error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Tracking ID already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Map tracking route
app.get('/map-tracking', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'map-tracking.html'));
});

// Configuration route
app.get('/config', requireAuth, (req, res) => {
  res.sendFile(path.join(publicPath, 'config.html'));
});

// Provider API routes
/**
 * @swagger
 * /api/providers:
 *   get:
 *     summary: Get all providers
 *     tags: [Providers]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of providers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Provider'
 *   post:
 *     summary: Create a new provider
 *     tags: [Providers]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Provider'
 *     responses:
 *       201:
 *         description: Provider created
 *       400:
 *         description: Invalid input
 */
app.get('/api/providers', requireAuth, async (req, res) => {
  try {
    console.log('📋 Fetching providers list');
    const providers = await Provider.find().sort({ name: 1 });
    console.log(`✅ Found ${providers.length} providers`);
    res.json(providers);
  } catch (error) {
    console.error('❌ Error fetching providers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/providers/{id}:
 *   get:
 *     summary: Get a provider by ID
 *     tags: [Providers]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Provider details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Provider'
 *       404:
 *         description: Provider not found
 *   put:
 *     summary: Update a provider
 *     tags: [Providers]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Provider'
 *     responses:
 *       200:
 *         description: Provider updated
 *       404:
 *         description: Provider not found
 *   delete:
 *     summary: Delete a provider
 *     tags: [Providers]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Provider deleted
 *       404:
 *         description: Provider not found
 */
app.get('/api/providers/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id === 'undefined') {
      return res.status(400).json({ error: 'Invalid provider ID' });
    }

    console.log('🔍 Fetching provider:', id);
    const provider = await Provider.findById(id);

    if (!provider) {
      console.log('❌ Provider not found:', id);
      return res.status(404).json({ error: 'Provider not found' });
    }

    console.log('✅ Provider found:', provider.name);
    res.json(provider);
  } catch (error) {
    console.error('❌ Error fetching provider:', error);
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid provider ID format' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.post('/api/providers', requireAuth, async (req, res) => {
  try {
    const { name, trackingUrl, apiConfig } = req.body;

    if (!name || !trackingUrl) {
      return res.status(400).json({ error: 'Name and tracking URL are required' });
    }

    console.log('📝 Creating new provider:', name);
    const providerData = { name, trackingUrl };

    // Add API configuration if provided
    if (apiConfig && apiConfig.endpoint) {
      providerData.apiConfig = {
        endpoint: apiConfig.endpoint,
        method: apiConfig.method || 'POST',
        headers: apiConfig.headers || {},
        requestBodyTemplate: apiConfig.requestBodyTemplate || '',
        responseMapping: apiConfig.responseMapping || {}
      };
    }

    const provider = new Provider(providerData);
    await provider.save();

    console.log('✅ Provider created successfully:', name);
    res.status(201).json(provider);
  } catch (error) {
    console.error('❌ Error creating provider:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'Provider name already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.put('/api/providers/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, trackingUrl, apiConfig } = req.body;

    if (!id || id === 'undefined') {
      return res.status(400).json({ error: 'Invalid provider ID' });
    }

    if (!name || !trackingUrl) {
      return res.status(400).json({ error: 'Name and tracking URL are required' });
    }

    console.log('📝 Updating provider:', id);

    const updateData = { name, trackingUrl };

    // Add API configuration if provided
    if (apiConfig && apiConfig.endpoint) {
      updateData.apiConfig = {
        endpoint: apiConfig.endpoint,
        method: apiConfig.method || 'POST',
        headers: apiConfig.headers || {},
        requestBodyTemplate: apiConfig.requestBodyTemplate || '',
        responseMapping: apiConfig.responseMapping || {}
      };
    }

    const provider = await Provider.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!provider) {
      console.log('❌ Provider not found:', id);
      return res.status(404).json({ error: 'Provider not found' });
    }

    console.log('✅ Provider updated successfully:', name);
    res.json(provider);
  } catch (error) {
    console.error('❌ Error updating provider:', error);
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid provider ID format' });
    } else if (error.code === 11000) {
      res.status(400).json({ error: 'Provider name already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.delete('/api/providers/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id === 'undefined') {
      return res.status(400).json({ error: 'Invalid provider ID' });
    }

    console.log('🗑️ Deleting provider:', id);
    const provider = await Provider.findByIdAndDelete(id);

    if (!provider) {
      console.log('❌ Provider not found:', id);
      return res.status(404).json({ error: 'Provider not found' });
    }

    console.log('✅ Provider deleted successfully:', provider.name);
    res.json({ message: 'Provider deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting provider:', error);
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid provider ID format' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Email Configuration API
app.get('/api/config/email', requireAuth, async (req, res) => {
  try {
    let emailConfig = await EmailConfig.findOne();
    
    // If none exists, return a default template (but don't save yet)
    if (!emailConfig) {
      emailConfig = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        user: '',
        pass: '',
        adminEmail: '',
        fromName: 'AK Logistics Tracking System',
        isEnabled: false
      };
    }
    
    // Mask password for security
    const result = emailConfig.toObject ? emailConfig.toObject() : { ...emailConfig };
    if (result.pass) result.pass = '********';
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error fetching email config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/config/email', requireAuth, async (req, res) => {
  try {
    let { host, port, secure, user, pass, adminEmail, fromName, isEnabled } = req.body;
    
    let emailConfig = await EmailConfig.findOne();
    
    // Convert adminEmail string to array if needed
    if (typeof adminEmail === 'string') {
      adminEmail = adminEmail.split(',').map(e => e.trim()).filter(e => e);
    }

    const updateData = {
      host,
      port: parseInt(port),
      secure: secure === true || secure === 'true',
      user,
      adminEmail: Array.isArray(adminEmail) ? adminEmail : [],
      fromName,
      isEnabled: isEnabled === true || isEnabled === 'true'
    };

    // Only update password if a new one is provided (not masked)
    if (pass && pass !== '********') {
      updateData.pass = pass;
    }

    if (emailConfig) {
      emailConfig = await EmailConfig.findByIdAndUpdate(
        emailConfig._id,
        { $set: updateData },
        { new: true }
      );
    } else {
      emailConfig = new EmailConfig(updateData);
      await emailConfig.save();
    }

    console.log('✅ Email configuration updated successfully');
    
    // Mask password in response
    const result = emailConfig.toObject();
    result.pass = '********';
    res.json(result);
  } catch (error) {
    console.error('❌ Error updating email config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// ── Email Logs API ──────────────────────────────────────────────────
/**
 * GET /api/email-logs
 * Returns paginated email log entries with optional filtering.
 * Query params: page, limit, type, status
 */
app.get('/api/email-logs', requireAuth, async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const filter = {};
    if (req.query.type)   filter.type   = req.query.type.toUpperCase();
    if (req.query.status) filter.status = req.query.status.toUpperCase();

    const [logs, total] = await Promise.all([
      EmailLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-htmlContent'), // Exclude heavy field from list view
      EmailLog.countDocuments(filter)
    ]);

    res.json({ logs, total, page, limit });
  } catch (error) {
    console.error('Error fetching email logs:', error);
    res.status(500).json({ error: 'Failed to fetch email logs' });
  }
});

/**
 * GET /api/email-logs/:id/preview
 * Returns the stored HTML content of a specific email log entry.
 */
app.get('/api/email-logs/:id/preview', requireAuth, async (req, res) => {
  try {
    const log = await EmailLog.findById(req.params.id).select('htmlContent subject type createdAt error metadata');
    if (!log) return res.status(404).json({ error: 'Log not found' });

    res.json({ 
      htmlContent: log.htmlContent, 
      subject: log.subject,
      error: log.error,
      metadata: log.metadata,
      type: log.type,
      createdAt: log.createdAt
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch email preview' });
  }
});

// Scheduled Tasks (Cron Jobs)

// Only run if ENABLE_CRON is set to 'true'. This prevents duplication in multi-instance deployments.
const isCronEnabled = process.env.ENABLE_CRON === 'true' || process.env.NODE_ENV === 'development';

if (isCronEnabled) {
  console.log('⏰ Cron jobs initialization requested.');
}

/**
 * @swagger
 * /api/cron/daily-report:
 *   get:
 *     summary: Trigger daily report email (used by scheduled jobs)
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Daily report triggered
 */
app.get('/api/cron/daily-report', async (req, res) => {
  console.log('📊 Manual trigger for daily report email...');
  try {
    const reportResults = await sendDailyReport();
    res.json({ success: true, ...reportResults });
  } catch (error) {
    console.error('❌ Manual daily report failed:', error);
    res.status(500).json({ error: error.message });
  }
});

async function sendDailyReport() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const startDate = yesterday.toLocaleDateString('en-CA'); // YYYY-MM-DD format
  console.log(`📅 Generating daily report for ${startDate}`);
  
  const createdCount = await TrackingData.countDocuments({
    createdAt: {
      $gte: yesterday,
      $lt: today
    }
  });
  
  const deliveredCount = await TrackingData.countDocuments({
    status: 'Delivered',
    updatedAt: {
      $gte: yesterday,
      $lt: today
    }
  });
  
  const reportData = {
    date: startDate,
    created: createdCount,
    delivered: deliveredCount,
    pending: createdCount - deliveredCount
  };
  
  await Report.updateOne(
    { type: 'daily_trend' },
    {
      $set: {
        lastRefreshed: new Date(),
        lastData: [reportData]
      }
    },
    { upsert: true }
  );
  
  await emailService.sendFromTemplate('daily_report', {
    date: startDate,
    createdCount: createdCount.toString(),
    deliveredCount: deliveredCount.toString(),
    pendingCount: reportData.pending.toString()
  });
  
  return reportData;
}

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Global error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Seed email templates
    await seedEmailTemplates();

    const PORT = config.server.port || 3001;
    app.listen(PORT, () => {
      console.log(`\n🚀 Server started successfully!`);
      console.log(`📝 Environment: ${config.server.environment}`);
      console.log(`🔌 Port: ${PORT}`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`⏰ Started at: ${new Date().toISOString()}\n`);
    });

    // Setup daily report email cron job (runs at 8:00 AM every day)
    if (isCronEnabled) {
      cron.schedule('0 8 * * *', async () => {
        console.log('📊 Running scheduled daily report email...');
        try {
          await sendDailyReport();
          console.log('✅ Daily report email sent successfully');
        } catch (error) {
          console.error('❌ Error sending daily report email:', error);
        }
      });
      console.log('⏰ Daily report email cron job scheduled (runs at 8:00 AM)');
    }
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Only start the server if run directly (not imported as a module)
if (require.main === module) {
  startServer();
}

// Export the app for Vercel
module.exports = app;
