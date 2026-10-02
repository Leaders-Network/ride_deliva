import { Router } from 'express';
import { authController } from './controllers/auth.controller';
import { validate } from '@/shared/utils/validation';
import { 
  authenticate, 
  authenticateVerifiedUser,
  optionalAuthenticate 
} from '@/shared/middleware/auth.middleware';
import { 
  authRateLimiter, 
  otpRateLimiter, 
  passwordResetRateLimiter 
} from '@/shared/middleware/rate-limiter';
import {
  registerSchema,
  loginSchema,
  sendVerificationCodeSchema,
  verifyPhoneSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  revokeSessionSchema,
  updateProfileSchema,
} from './validators/auth.validators';

const router = Router();

// Public routes (no authentication required)

// Registration
router.post('/register', 
  authRateLimiter,
  validate(registerSchema),
  authController.register
);

// Login
router.post('/login', 
  authRateLimiter,
  validate(loginSchema),
  authController.login
);

// Send verification code
router.post('/send-code', 
  otpRateLimiter,
  validate(sendVerificationCodeSchema),
  authController.sendVerificationCode
);

// Verify phone number
router.post('/verify-phone', 
  otpRateLimiter,
  validate(verifyPhoneSchema),
  authController.verifyPhone
);

// Refresh access token
router.post('/refresh-token', 
  validate(refreshTokenSchema),
  authController.refreshToken
);

// Forgot password
router.post('/forgot-password', 
  passwordResetRateLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);

// Reset password
router.post('/reset-password', 
  passwordResetRateLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword
);

// Check authentication status (optional auth)
router.get('/check', 
  optionalAuthenticate,
  authController.checkAuth
);

// Protected routes (authentication required)

// Get current user profile
router.get('/profile', 
  authenticate,
  authController.getProfile
);

// Update user profile
router.put('/profile', 
  authenticateVerifiedUser,
  validate(updateProfileSchema),
  authController.updateProfile
);

// Logout current session
router.post('/logout', 
  authenticate,
  authController.logout
);

// Logout from all sessions
router.post('/logout-all', 
  authenticate,
  authController.logoutAll
);

// Change password
router.post('/change-password', 
  authenticateVerifiedUser,
  validate(changePasswordSchema),
  authController.changePassword
);

// Get user sessions
router.get('/sessions', 
  authenticateVerifiedUser,
  authController.getSessions
);

// Revoke specific session
router.delete('/sessions/:sessionId', 
  authenticateVerifiedUser,
  validate(revokeSessionSchema, 'params'),
  authController.revokeSession
);

// Verify current session
router.get('/verify-session', 
  authenticate,
  authController.verifySession
);

// API information endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'Authentication API',
    version: '1.0.0',
    endpoints: {
      // Public endpoints
      'POST /register': 'Register new user (customer or driver)',
      'POST /login': 'User login with phone + password or phone + OTP',
      'POST /send-code': 'Send verification code to phone',
      'POST /verify-phone': 'Verify phone number with code',
      'POST /refresh-token': 'Refresh access token',
      'POST /forgot-password': 'Initiate password reset',
      'POST /reset-password': 'Complete password reset with code',
      'GET /check': 'Check authentication status',
      
      // Protected endpoints
      'GET /profile': 'Get current user profile',
      'PUT /profile': 'Update user profile',
      'POST /logout': 'Logout current session',
      'POST /logout-all': 'Logout from all sessions',
      'POST /change-password': 'Change password (requires current password)',
      'GET /sessions': 'Get all active sessions',
      'DELETE /sessions/:sessionId': 'Revoke specific session',
      'GET /verify-session': 'Verify current session validity',
    },
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer <token>',
      tokenTypes: {
        access_token: 'Short-lived token for API access',
        refresh_token: 'Long-lived token for renewing access tokens',
      },
    },
    rateLimits: {
      authentication: '10 requests per 15 minutes',
      otp: '5 requests per 5 minutes',
      passwordReset: '5 requests per hour',
    },
  });
});

export { router as authRoutes };
