// Wraps an async controller so thrown errors reach Express's error handler
// instead of crashing the process or being silently swallowed.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { asyncHandler };
