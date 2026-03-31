const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const User = require('../models/User');

exports.verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      throw new AppError('Authentication token is missing. Please log in.', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    
    // Ensure user still exists & attach to request
    const user = await User.findById(decoded.id).lean();
    if (!user) {
      throw new AppError('The user belonging to this token no longer exists.', 401);
    }

    req.user = user;
    next();
  } catch (error) {
    next(new AppError(error.name === 'JsonWebTokenError' ? 'Invalid token.' : 'Token expired or malformed.', 401));
  }
};
