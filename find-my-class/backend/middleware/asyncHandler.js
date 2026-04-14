/**
 * Wraps async route handlers so rejected promises are passed to the global error handler.
 * Prevents unhandled rejections from crashing the server.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
