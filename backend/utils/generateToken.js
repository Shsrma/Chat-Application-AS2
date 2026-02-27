import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import RefreshToken from '../models/RefreshToken.js';
import Device from '../models/Device.js';

/**
 * Generate Access Token (Short lived)
 */
export const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
};

/**
 * Generate Refresh Token (Long lived) and save to DB
 */
export const generateRefreshToken = async (userId, deviceInfo, ipAddress) => {
  const token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Check if device already exists for user
  let device = await Device.findOne({
    user: userId,
    deviceIdentifier: deviceInfo.deviceId,
  });

  if (!device) {
    device = await Device.create({
      user: userId,
      deviceIdentifier: deviceInfo.deviceId,
      deviceType: deviceInfo.deviceType,
      os: deviceInfo.os,
      browser: deviceInfo.browser,
      ipAddress,
    });
  } else {
    // Update last active
    device.lastActiveAt = Date.now();
    device.ipAddress = ipAddress;
    await device.save();
  }

  // Revoke old tokens for this specific device to ensure 1 token per device
  await RefreshToken.updateMany(
    { user: userId, device: device._id, isRevoked: false },
    { isRevoked: true }
  );

  const refreshTokenDoc = await RefreshToken.create({
    token,
    user: userId,
    device: device._id,
    expiresAt,
  });

  return refreshTokenDoc.token;
};

/**
 * Set Cookies for Tokens
 */
export const setTokenCookies = (res, accessToken, refreshToken) => {
  res.cookie('jwt', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/users/refresh-token' // Restrict path
  });
};

/**
 * Clear Cookies
 */
export const clearTokenCookies = (res) => {
  res.cookie('jwt', '', {
    httpOnly: true,
    expires: new Date(0),
  });
  
  res.cookie('refreshToken', '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/api/users/refresh-token'
  });
};
