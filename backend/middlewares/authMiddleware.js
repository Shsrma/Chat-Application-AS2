import jwt from 'jsonwebtoken';
import catchAsync from '../utils/catchAsync.js';
import { ApiError } from './errorMiddleware.js';
import User from '../models/User.js';

export const protect = catchAsync(async (req, res, next) => {
  let token;

  // Prefer HttpOnly cookie, fallback to Bearer token
  if (req.cookies.jwt) {
    token = req.cookies.jwt;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new ApiError(401, 'Not authorized, no token provided'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user and verify they are still active
    const user = await User.findById(decoded.id).select('-password -twoFactorSecret');
    
    if (!user) {
      return next(new ApiError(401, 'User belonging to this token no longer exists'));
    }

    if (user.status !== 'active') {
      return next(new ApiError(403, `Account is ${user.status}. Contact support.`));
    }

    req.user = user;
    next();
  } catch (error) {
    return next(new ApiError(401, 'Not authorized, token failed or expired'));
  }
});
