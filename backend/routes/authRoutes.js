import authController from '../controllers/authController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validateMiddleware.js';
import { registerSchema, loginSchema, verify2FASchema } from '../validators/authValidators.js';
import { authLimiter } from '../middlewares/rateLimiter.js';
import express from 'express';

const router = express.Router();

// Public routes
router.post('/register', authLimiter, validate(registerSchema), authController.registerUser);
router.post('/login', authLimiter, validate(loginSchema), authController.loginUser);
router.post('/verify-2fa', authLimiter, validate(verify2FASchema), authController.verify2FA);
router.post('/refresh-token', authController.refreshToken); // Uses HTTP-only cookie automatically

// Protected routes
router.post('/logout', protect, authController.logoutUser);
router.post('/enable-2fa', protect, authController.setup2FA); // Generate QR
router.post('/confirm-2fa', protect, authController.confirm2FASetup);
router.post('/disable-2fa', protect, authController.disable2FA);
router.get('/sessions', protect, authController.getActiveSessions);
router.delete('/sessions/:deviceId', protect, authController.revokeSession); // Revoke specific device

export default router;
