import mongoose from 'mongoose';

/**
 * Global error handling middleware.
 * Ensures proper status codes and safe error messages; never crashes the API.
 */
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = 500;
  let message = 'Internal server error';

  // Validation error from middleware (has statusCode 400)
  if (err.statusCode === 400) {
    statusCode = 400;
    message = err.message || 'Validation failed';
  }

  // Mongoose validation error (schema rules)
  else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    const first = Object.values(err.errors)[0];
    message = first?.message || err.message || 'Validation failed';
  }

  // Invalid MongoDB ObjectId (e.g. malformed id in URL)
  else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid ${err.path || 'id'}`;
  }

  // MongoDB duplicate key
  else if (err.code === 11000) {
    statusCode = 400;
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : 'field';
    message = `${field} already exists`;
  }

  // JWT errors
  else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
  }

  // Explicit error with status (e.g. from controller)
  else if (err.statusCode && typeof err.statusCode === 'number') {
    statusCode = err.statusCode;
    message = err.message || message;
  }

  // Invalid JSON body (from express.json())
  else if (err instanceof SyntaxError) {
    statusCode = 400;
    message = 'Invalid JSON';
  }

  // Safe use of err.message only for expected client errors (4xx)
  else if (err.message && statusCode >= 500 && process.env.NODE_ENV === 'development') {
    message = err.message;
  }

  if (statusCode >= 500) {
    console.error('[Error]', err);
  }

  res.status(statusCode).json({ error: message });
};
