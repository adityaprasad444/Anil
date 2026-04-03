const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const User = require('../../../models/User');

exports.verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    // --- JWT path ---
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      const user = await User.findById(decoded.id).lean();
      if (!user) {
        throw new AppError('The user belonging to this token no longer exists.', 401);
      }
      req.user = user;
      return next();
    }

    // --- Session fallback (for admin cookie-session users) ---
    if (req.session && req.session.user) {
      // Attach a compatible user object with the fields RBAC middleware expects
      req.user = {
        _id: req.session.user._id || null,
        username: req.session.user.username,
        tenant_id: req.session.user.tenant_id || null,
        roles: req.session.user.roles || [],
        // Grant superAdmin full bypass on permission checks
        // We consider 'admin' role as Super Admin for bypass
        isSuperAdmin: req.session.user.role === 'admin' || (req.session.user.roles || []).includes('SUPER_ADMIN_ROLE_ID'),
        // Backward compatibility for code checking .role
        role: req.session.user.role
      };
      return next();
    }

    throw new AppError('Authentication token is missing. Please log in.', 401);
  } catch (error) {
    if (error.isOperational) return next(error);
    next(new AppError(
      error.name === 'JsonWebTokenError' ? 'Invalid token.' : 'Token expired or malformed.',
      401
    ));
  }
};
