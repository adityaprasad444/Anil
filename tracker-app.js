// tracker-app.js
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config');
const { TrackingData } = require('./db');
const User = require('./models/User');
const Provider = require('./models/Provider');

const app = express();

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
app.use(session({
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve static files
app.use(express.static('public'));

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
};

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Session check endpoint
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

app.get('/api/tracking/:trackingId', async (req, res) => {
    try {
        const { trackingId } = req.params;
        const trackingData = await TrackingData.findOne({ trackingId });
        
        if (!trackingData) {
            return res.status(404).json({ error: 'Tracking ID not found' });
        }

        // Get provider information
        const provider = await Provider.findOne({ name: trackingData.provider });
        
        if (!provider) {
            return res.status(404).json({ error: 'Provider not found' });
        }

        // Update lastUpdated timestamp
        trackingData.lastUpdated = new Date();
        await trackingData.save();

        // Handle URL formats consistently
        const encodedTrackingId = encodeURIComponent(trackingData.originalTrackingId);
        let trackingUrl = provider.trackingUrl;

        // If URL contains a placeholder, replace it
        if (trackingUrl.includes('{trackingId}')) {
            trackingUrl = trackingUrl.replace('{trackingId}', encodedTrackingId);
        } else {
            // If no placeholder, append tracking ID to base URL
            trackingUrl = `${trackingUrl}${encodedTrackingId}`;
        }

        // Return tracking data and provider URL
        res.json({
            trackingId: trackingData.trackingId,
            originalTrackingId: trackingData.originalTrackingId,
            provider: trackingData.provider,
            status: trackingData.status,
            lastUpdated: trackingData.lastUpdated,
            trackingUrl: trackingUrl
        });
    } catch (error) {
        console.error('Error fetching tracking data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add delete endpoint for tracking IDs
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

// API Routes
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

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.post('/api/tracking/generate', requireAuth, async (req, res) => {
  try {
    const { provider, originalTrackingId } = req.body;
    console.log('📦 Tracking ID generation request:', { provider, originalTrackingId });

    if (!provider || !originalTrackingId) {
      return res.status(400).json({ error: 'Provider and original tracking ID are required' });
    }

    // Generate a 6-digit random number
    const randomNumber = Math.floor(100000 + Math.random() * 900000);
    const trackingId = `ak${randomNumber}lg`;
    
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Map tracking route
app.get('/map-tracking', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'map-tracking.html'));
});

// Configuration route
app.get('/config', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'config.html'));
});

// Provider API routes
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
        const { name, trackingUrl } = req.body;
        
        if (!name || !trackingUrl) {
            return res.status(400).json({ error: 'Name and tracking URL are required' });
        }

        console.log('📝 Creating new provider:', name);
        const provider = new Provider({ name, trackingUrl });
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
        const { name, trackingUrl } = req.body;
        
        if (!id || id === 'undefined') {
            return res.status(400).json({ error: 'Invalid provider ID' });
        }

        if (!name || !trackingUrl) {
            return res.status(400).json({ error: 'Name and tracking URL are required' });
        }

        console.log('📝 Updating provider:', id);
        const provider = await Provider.findByIdAndUpdate(
            id,
            { name, trackingUrl },
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

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  console.log(`
🚀 Server started successfully!
📝 Environment: ${process.env.NODE_ENV || 'development'}
🔌 Port: ${PORT}
🌐 URL: http://localhost:${PORT}
📦 MongoDB: Connected
⏰ Started at: ${new Date().toISOString()}
  `);
});
