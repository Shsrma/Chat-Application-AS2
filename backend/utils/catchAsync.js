/**
 * Wrapper for async controller functions to avoid try-catch blocks everywhere
 * Passes error to Express next() function automatically.
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => next(err));
};

export default catchAsync;
