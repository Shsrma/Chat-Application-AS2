import logger from '../config/logger.js';

/**
 * Custom Error Class to standardize API errors
 */
export class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Middleware to catch 404 routes
 */
export const notFound = (req, res, next) => {
  const error = new ApiError(404, `Not Found - ${req.originalUrl}`);
  next(error);
};

/**
 * Global Error Handling Middleware
 */
export const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;
  
  // Default to 500 if unknown error
  if (!err.isOperational) {
    statusCode = statusCode || 500;
    message = statusCode === 500 ? 'Internal Server Error' : message;
  }

  // Define response payload
  const response = {
    code: statusCode,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  // Log error using Winston
  if (statusCode >= 500) {
    logger.error(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`, err);
  } else {
    logger.warn(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  }

  // Send JSON response
  res.status(statusCode).json(response);
};
