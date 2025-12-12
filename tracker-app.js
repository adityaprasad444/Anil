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
const trackingService = require('./services/trackingService');
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
app.use(helmet({
  contentSecurityPolicy: false // Disable CSP for development
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
  res.send = function(data) {
    const duration = Date.now() - startTime;
    // Add Server-Timing header for web vitals tracking (RFC 7231 compliant)
    res.setHeader('Server-Timing', `backend;dur=${duration};desc="Backend Processing"`);
    return originalSend.call(this, data);
  };
  
  // Override res.json to track response timing
  res.json = function(data) {
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
app.get('/api/tracking/list', requireAuth, async (req, res) => {
  try {
    console.log('📋 Fetching tracking list');

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.trackingId) {
      filter.trackingId = { $regex: req.query.trackingId, $options: 'i' }; // Case-insensitive partial match
    }
    if (req.query.provider) {
      filter.provider = req.query.provider;
    }
    if (req.query.status) {
      filter.status = req.query.status;
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
      originalTrackingId: trackingData.originalTrackingId,
      provider: trackingData.provider,
      status: trackingData.status,
      location: trackingData.location,
      estimatedDelivery: trackingData.estimatedDelivery,
      origin: trackingData.origin,
      destination: trackingData.destination,
      weight: trackingData.weight,
      dimensions: trackingData.dimensions,
      history: trackingData.history || [],
      lastUpdated: trackingData.lastUpdated,
      trackingUrl: trackingUrl
    });
  } catch (error) {
    console.error('Error fetching tracking data:', error);
    res.status(500).json({ error: 'Failed to fetch tracking data' });
  }
});

// Add delete endpoint for tracking IDs
/**
 * @swagger
 * /api/tracking/{trackingId}:
 *   delete:
 *     summary: Delete a tracking entry
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
 *         description: Tracking ID deleted successfully
 *       404:
 *         description: Tracking ID not found
 *       500:
 *         description: Internal server error
 */
app.delete('/api/tracking/:trackingId', requireAuth, async (req, res) => {
  try {
    const { trackingId } = req.params;
    console.log('🗑️ Deleting tracking ID:', trackingId);

    const trackingData = await TrackingData.findOneAndDelete({ trackingId });

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
 * /api/tracking/{trackingId}/status:
 *   put:
 *     summary: Update tracking status
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       404:
 *         description: Tracking ID not found
 *       500:
 *         description: Internal server error
 */
app.put('/api/tracking/:trackingId/status', requireAuth, async (req, res) => {
  try {
    const { trackingId } = req.params;
    const { status } = req.body;
    console.log('📝 Updating tracking status:', { trackingId, status });

    const trackingData = await TrackingData.findOneAndUpdate(
      { trackingId },
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
    console.log('🔄 Bulk refresh requested for all tracking data');

    // Run the update and wait for it to complete (required for Vercel/Serverless)
    const results = await trackingService.updateAllTrackingData();
    console.log('✅ Bulk refresh completed:', results);

    // Respond with results
    res.json({
      message: 'Bulk refresh completed',
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Global error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    const PORT = config.server.port || 3001;
    app.listen(PORT, () => {
      console.log(`\n🚀 Server started successfully!`);
      console.log(`📝 Environment: ${config.server.environment}`);
      console.log(`🔌 Port: ${PORT}`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`⏰ Started at: ${new Date().toISOString()}\n`);
    });
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
