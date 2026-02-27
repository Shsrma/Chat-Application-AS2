import rateLimit from 'express-rate-limit';
import { ApiError } from './errorMiddleware.js';

// General API rate limiter (100 requests per 15 mins)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new ApiError(429, 'Too many requests from this IP, please try again after 15 minutes'));
  }
});

// Stricter rate limit for authentication routes (login/register/2FA) (10 requests per 15 mins)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new ApiError(429, 'Too many authentication attempts, please try again after 15 minutes'));
  }
});

// Messaging rate limiter (to prevent spamming messages, 60 msgs per minute)
export const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new ApiError(429, 'You are sending messages too fast. Please slow down.'));
  }
});
