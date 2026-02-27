import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import crypto from 'crypto';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import Device from '../models/Device.js';
import catchAsync from '../utils/catchAsync.js';
import { ApiError } from '../middlewares/errorMiddleware.js';
import { generateAccessToken, generateRefreshToken, setTokenCookies, clearTokenCookies } from '../utils/generateToken.js';
import logger from '../config/logger.js';

/**
 * Register a new user
 * POST /api/auth/register
 */
export const registerUser = catchAsync(async (req, res, next) => {
  const { username, email, password } = req.body;

  const userExists = await User.findOne({ $or: [{ email }, { username }] });
  if (userExists) {
    return next(new ApiError(400, 'Username or Email already exists'));
  }

  const user = await User.create({ username, email, password });

  if (user) {
    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please login.'
    });
  } else {
    return next(new ApiError(400, 'Invalid user data'));
  }
});

/**
 * Login user & get tokens
 * POST /api/auth/login
 */
export const loginUser = catchAsync(async (req, res, next) => {
  const { email, password, deviceIdentifier = 'unknown', deviceType, os, browser } = req.body;

  const user = await User.findOne({ email }).select('+password +twoFactorSecret');

  if (!user || !(await user.matchPassword(password))) {
    logger.warn(`Failed login attempt for email: ${email}`);
    return next(new ApiError(401, 'Invalid email or password'));
  }

  if (user.status !== 'active') {
    return next(new ApiError(403, `Account is ${user.status}`));
  }

  // Handle 2FA First
  if (user.isTwoFactorEnabled) {
    // Return partial response requiring 2FA step
    return res.status(200).json({
      success: true,
      requires2FA: true,
      userId: user._id,
      message: 'Please provide 2FA token'
    });
  }

  // Process standard Login (No 2FA)
  await performCompleteLogin(user, { deviceId: deviceIdentifier, deviceType, os, browser }, req.ip, res);
});

/**
 * Verify 2FA and get tokens
 * POST /api/auth/verify-2fa
 */
export const verify2FA = catchAsync(async (req, res, next) => {
  const { userId, token, deviceIdentifier = 'unknown', deviceType, os, browser } = req.body;

  const user = await User.findById(userId).select('+twoFactorSecret');
  
  if (!user || !user.isTwoFactorEnabled) {
    return next(new ApiError(400, 'Invalid request'));
  }

  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token
  });

  if (!verified) {
    logger.warn(`Failed 2FA attempt for user: ${userId}`);
    return next(new ApiError(401, 'Invalid 2FA token'));
  }

  // 2FA Success -> Login
  await performCompleteLogin(user, { deviceId: deviceIdentifier, deviceType, os, browser }, req.ip, res);
});

/**
 * Get new access token using refresh token
 * POST /api/auth/refresh-token
 */
export const refreshToken = catchAsync(async (req, res, next) => {
  const incomingToken = req.cookies.refreshToken;

  if (!incomingToken) {
    return next(new ApiError(401, 'No refresh token provided'));
  }

  const existingToken = await RefreshToken.findOne({ token: incomingToken });

  if (!existingToken) {
    clearTokenCookies(res);
    return next(new ApiError(401, 'Invalid refresh token'));
  }

  // Token reuse detection behavior (Theft)
  if (existingToken.isRevoked) {
    // Immediately revoke ALL tokens for this user as a security measure
    await RefreshToken.updateMany({ user: existingToken.user }, { isRevoked: true });
    logger.error(`Token reuse detected for user ${existingToken.user}. All sessions revoked.`);
    clearTokenCookies(res);
    return next(new ApiError(401, 'Security breach detected. Please login again.'));
  }

  // Check Expiration
  if (new Date() > existingToken.expiresAt) {
    existingToken.isRevoked = true;
    await existingToken.save();
    clearTokenCookies(res);
    return next(new ApiError(401, 'Refresh token expired'));
  }

  // Setup the next valid token rotation
  existingToken.isRevoked = true;
  await existingToken.save();

  // Generate new tokens
  const nextRefreshToken = crypto.randomBytes(40).toString('hex');
  const newRefreshTokenDoc = await RefreshToken.create({
    token: nextRefreshToken,
    user: existingToken.user,
    device: existingToken.device,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  existingToken.replacedByToken = nextRefreshToken;
  await existingToken.save();

  const accessToken = generateAccessToken(existingToken.user);

  setTokenCookies(res, accessToken, nextRefreshToken);

  res.status(200).json({ success: true, accessToken });
});

/**
 * Logout User & Revoke Token
 * POST /api/auth/logout
 */
export const logoutUser = catchAsync(async (req, res, next) => {
  const incomingToken = req.cookies.refreshToken;
  if (incomingToken) {
    await RefreshToken.findOneAndUpdate(
      { token: incomingToken },
      { isRevoked: true }
    );
  }

  clearTokenCookies(res);
  
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

/**
 * Initial Setup for 2FA
 * POST /api/auth/enable-2fa
 */
export const setup2FA = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  if (user.isTwoFactorEnabled) {
    return next(new ApiError(400, '2FA is already enabled'));
  }

  const secret = speakeasy.generateSecret({
    name: `EnterpriseChat:${user.email}`
  });

  // Temporarily store secret on the user until they confirm
  await User.findByIdAndUpdate(user._id, { twoFactorSecret: secret.base32 });

  qrcode.toDataURL(secret.otpauth_url, (err, dataUrl) => {
    if (err) return next(new ApiError(500, 'Error generating QR code'));
    res.json({
      success: true,
      qrCodeUrl: dataUrl,
      secret: secret.base32,
    });
  });
});

/**
 * Confirm 2FA Setup
 * POST /api/auth/confirm-2fa
 */
export const confirm2FASetup = catchAsync(async (req, res, next) => {
  const { token } = req.body;
  const user = await User.findById(req.user._id).select('+twoFactorSecret');

  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token
  });

  if (verified) {
    user.isTwoFactorEnabled = true;
    await user.save();
    res.json({ success: true, message: '2FA enabled successfully' });
  } else {
    return next(new ApiError(400, 'Invalid token. Setup failed.'));
  }
});

/**
 * Disable 2FA
 * POST /api/auth/disable-2fa
 */
export const disable2FA = catchAsync(async (req, res, next) => {
  const { token } = req.body;
  const user = await User.findById(req.user._id).select('+twoFactorSecret');

  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token
  });

  if (!verified) {
    return next(new ApiError(400, 'Invalid token'));
  }

  user.isTwoFactorEnabled = false;
  user.twoFactorSecret = undefined;
  await user.save();

  res.json({ success: true, message: '2FA disabled successfully' });
});

/**
 * Get All Active Session Devices
 * GET /api/auth/sessions
 */
export const getActiveSessions = catchAsync(async (req, res, next) => {
  const devices = await Device.find({ user: req.user._id, isActive: true })
    .sort('-lastActiveAt')
    .select('-__v');

  res.json({ success: true, devices });
});

/**
 * Revoke specific device session
 * DELETE /api/auth/sessions/:deviceId
 */
export const revokeSession = catchAsync(async (req, res, next) => {
  const { deviceId } = req.params;

  const device = await Device.findOne({ _id: deviceId, user: req.user._id });
  if (!device) {
    return next(new ApiError(404, 'Device not found'));
  }

  device.isActive = false;
  await device.save();

  // Revoke all tokens for this device
  await RefreshToken.updateMany(
    { user: req.user._id, device: device._id },
    { isRevoked: true }
  );

  res.json({ success: true, message: 'Session revoked successfully' });
});


// Helper to perform the actual token issuance & cookie setting
async function performCompleteLogin(user, deviceInfo, ipAddress, res) {
  const accessToken = generateAccessToken(user._id);
  const refreshToken = await generateRefreshToken(user._id, deviceInfo, ipAddress);

  setTokenCookies(res, accessToken, refreshToken);

  res.status(200).json({
    success: true,
    user: {
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
    },
    accessToken // Useful if frontend prefers saving it in-memory instead of extracting from cookie (if not httpOnly)
  });
}

export default {
  registerUser,
  loginUser,
  verify2FA,
  refreshToken,
  logoutUser,
  setup2FA,
  confirm2FASetup,
  disable2FA,
  getActiveSessions,
  revokeSession
};
