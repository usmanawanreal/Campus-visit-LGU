/**
 * Throw an error that the global error handler will send with the given status code.
 */
export function createError(message, statusCode = 500) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}
