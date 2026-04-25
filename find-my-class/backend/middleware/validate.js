import mongoose from 'mongoose';

/**
 * Creates a validation error with status 400 for the global error handler.
 */
function validationError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

/**
 * Validates MongoDB ObjectId format.
 */
export function isValidId(id) {
  if (id == null || typeof id !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(id) && new mongoose.Types.ObjectId(id).toString() === id;
}

/**
 * Validate request body with simple rules.
 * Rules: [{ key, required?, type?, min?, max?, message? }]
 * Calls next(validationError(message)) on first failure.
 */
export function validateBody(rules) {
  return (req, res, next) => {
    const body = req.body || {};
    for (const rule of rules) {
      const value = body[rule.key];
      if (rule.required && (value === undefined || value === null || value === '')) {
        return next(validationError(rule.message || `${rule.key} is required`));
      }
      if (value === undefined || value === null) continue;
      if (rule.type === 'string' && typeof value !== 'string') {
        return next(validationError(rule.message || `${rule.key} must be a string`));
      }
      if (rule.type === 'number') {
        const n = Number(value);
        if (Number.isNaN(n)) return next(validationError(rule.message || `${rule.key} must be a number`));
        if (rule.min != null && n < rule.min) {
          return next(validationError(rule.message || `${rule.key} must be at least ${rule.min}`));
        }
        if (rule.max != null && n > rule.max) {
          return next(validationError(rule.message || `${rule.key} must be at most ${rule.max}`));
        }
      }
      if (rule.type === 'email' && typeof value === 'string') {
        const trimmed = value.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
          return next(validationError(rule.message || 'Invalid email'));
        }
      }
      if (rule.mongoId && !isValidId(value)) {
        return next(validationError(rule.message || `${rule.key} must be a valid id`));
      }
    }
    next();
  };
}

/**
 * Validate request query with same rules as validateBody (uses req.query).
 */
export function validateQuery(rules) {
  return (req, res, next) => {
    const data = req.query || {};
    for (const rule of rules) {
      const value = data[rule.key];
      if (rule.required && (value === undefined || value === null || value === '')) {
        return next(validationError(rule.message || `${rule.key} is required`));
      }
      if (value === undefined || value === null || value === '') continue;
      if (rule.type === 'string' && typeof value !== 'string') {
        return next(validationError(rule.message || `${rule.key} must be a string`));
      }
      if (rule.type === 'number') {
        const n = Number(value);
        if (Number.isNaN(n)) return next(validationError(rule.message || `${rule.key} must be a number`));
        if (rule.min != null && n < rule.min) {
          return next(validationError(rule.message || `${rule.key} must be at least ${rule.min}`));
        }
        if (rule.max != null && n > rule.max) {
          return next(validationError(rule.message || `${rule.key} must be at most ${rule.max}`));
        }
      }
      if (rule.mongoId && !isValidId(value)) {
        return next(validationError(rule.message || `${rule.key} must be a valid id`));
      }
    }
    next();
  };
}

/**
 * Validate route param is a valid MongoDB ObjectId.
 */
export function validateIdParam(paramName = 'id') {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!isValidId(id)) {
      return next(validationError(`Invalid ${paramName}`));
    }
    next();
  };
}
