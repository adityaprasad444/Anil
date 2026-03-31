const AppError = require('../utils/AppError');

const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  return new AppError(`Duplicate field value: ${value}. Please use another value!`, 400);
};

module.exports = function rbacErrorHandler(err, req, res, next) {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  let error = { ...err, name: err.name, message: err.message };

  if (error.code === 11000) error = handleDuplicateFieldsDB(error);
  if (error.name === 'ValidationError') error = new AppError('Invalid input data.', 400);
  if (error.name === 'CastError') error = new AppError('Invalid resource ID format.', 400);

  if (error.isOperational) {
    res.status(error.statusCode).json({ status: error.status, message: error.message });
  } else {
    console.error('CRITICAL UNHANDLED BUG:', err);
    res.status(500).json({ status: 'error', message: 'An internal failure occurred.' });
  }
};
