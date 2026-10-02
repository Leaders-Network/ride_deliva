import { Request, Response, NextFunction } from 'express';
import { authService } from '@/shared/services/auth.service';
import { sendSuccess, sendCreated } from '@/shared/utils/response';
import { createError, asyncHandler } from '@/shared/middleware/error-handler';
import { AuthenticatedRequest, RegisterData, LoginCredentials } from '@/types';
import { logger } from '@/config/logger';

export class AuthController {
  // User registration
  register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const registerData: RegisterData = req.body;

    const result = await authService.register(registerData);

    // Remove sensitive data from response
    const { user, verificationCodeSent } = result;
    const userResponse = {
      id: user.id,
      phoneNumber: user.phoneNumber,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
    };

    sendCreated(res, {
      user: userResponse,
      verificationCodeSent,
      message: 'Registration successful. Please verify your phone number.',
    });
  });

  // User login
  login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const credentials: LoginCredentials = req.body;

    // Add request metadata for session creation
    const deviceInfo = {
      userAgent: req.get('User-Agent'),
      acceptLanguage: req.get('Accept-Language'),
      platform: req.get('Sec-CH-UA-Platform'),
    };

    const ipAddress = req.ip || req.connection.remoteAddress || '';

    // Enhance auth service to accept metadata (we'll need to modify the service)
    const result = await authService.login(credentials);

    // Update session with request metadata
    // This is a simplified version - in production you'd update the session
    logger.info('Login metadata captured', {
      userId: result.user.id,
      deviceInfo,
      ipAddress,
    });

    // Prepare user response without sensitive data
    const userResponse = {
      id: result.user.id,
      phoneNumber: result.user.phoneNumber,
      email: result.user.email,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      isVerified: result.user.isVerified,
      profilePicture: result.user.profilePicture,
      customerProfile: (result.user as any).customerProfile,
      driverProfile: (result.user as any).driverProfile,
      adminProfile: (result.user as any).adminProfile,
    };

    sendSuccess(res, {
      user: userResponse,
      tokens: result.tokens,
      sessionId: result.session.id,
    }, 'Login successful');
  });

  // Send verification code
  sendVerificationCode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { phoneNumber, type = 'PHONE_VERIFICATION' } = req.body;

    await authService.sendVerificationCode(phoneNumber, type);

    sendSuccess(res, null, 'Verification code sent successfully');
  });

  // Verify phone number
  verifyPhone = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { phoneNumber, code } = req.body;

    const result = await authService.verifyPhoneCode(phoneNumber, code);

    if (result.verified) {
      const userResponse = result.user ? {
        id: result.user.id,
        phoneNumber: result.user.phoneNumber,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        isVerified: result.user.isVerified,
      } : null;

      sendSuccess(res, {
        verified: true,
        user: userResponse,
      }, 'Phone number verified successfully');
    } else {
      throw createError.badRequest('Verification failed');
    }
  });

  // Refresh access token
  refreshToken = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw createError.badRequest('Refresh token is required');
    }

    const tokens = await authService.refreshToken(refreshToken);

    sendSuccess(res, { tokens }, 'Token refreshed successfully');
  });

  // User logout
  logout = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw createError.unauthorized('Authentication required');
    }

    // Extract session ID from token
    const authHeader = req.headers.authorization;
    const token = authHeader?.substring(7); // Remove 'Bearer '
    
    if (token) {
      try {
        const payload = authService.verifyToken(token);
        await authService.logout(payload.sessionId);
      } catch (error) {
        // Log error but don't fail logout
        logger.warn('Error during logout session cleanup', { error });
      }
    }

    sendSuccess(res, null, 'Logout successful');
  });

  // Logout from all devices
  logoutAll = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw createError.unauthorized('Authentication required');
    }

    await authService.logoutAll(req.user.id);

    sendSuccess(res, null, 'Logged out from all devices successfully');
  });

  // Get current user profile
  getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw createError.unauthorized('Authentication required');
    }

    // Get fresh user data with all profiles
    const user = await authService.getUserFromToken(req.headers.authorization?.substring(7) || '');

    if (!user) {
      throw createError.unauthorized('Invalid session');
    }

    const userResponse = {
      id: user.id,
      phoneNumber: user.phoneNumber,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePicture: user.profilePicture,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      isVerified: user.isVerified,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      customerProfile: (user as any).customerProfile,
      driverProfile: (user as any).driverProfile,
      adminProfile: (user as any).adminProfile,
    };

    sendSuccess(res, userResponse, 'Profile retrieved successfully');
  });

  // Initiate password reset
  forgotPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { phoneNumber } = req.body;

    await authService.initiatePasswordReset(phoneNumber);

    sendSuccess(res, null, 'Password reset code sent to your phone');
  });

  // Complete password reset
  resetPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { phoneNumber, code, newPassword } = req.body;

    await authService.completePasswordReset(phoneNumber, code, newPassword);

    sendSuccess(res, null, 'Password reset successfully');
  });

  // Get user sessions
  getSessions = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw createError.unauthorized('Authentication required');
    }

    const sessions = await authService.getUserSessions(req.user.id);

    // Remove sensitive token data
    const sessionResponse = sessions.map(session => ({
      id: session.id,
      deviceInfo: session.deviceInfo,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      isActive: session.isActive,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }));

    sendSuccess(res, sessionResponse, 'Sessions retrieved successfully');
  });

  // Revoke a specific session
  revokeSession = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw createError.unauthorized('Authentication required');
    }

    const { sessionId } = req.params;

    // Verify the session belongs to the user
    const sessions = await authService.getUserSessions(req.user.id);
    const sessionExists = sessions.some(session => session.id === sessionId);

    if (!sessionExists) {
      throw createError.notFound('Session not found');
    }

    await authService.revokeSession(sessionId);

    sendSuccess(res, null, 'Session revoked successfully');
  });

  // Check authentication status
  checkAuth = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw createError.unauthorized('Not authenticated');
    }

    const userResponse = {
      id: req.user.id,
      phoneNumber: req.user.phoneNumber,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      isVerified: req.user.isVerified,
      isActive: req.user.isActive,
    };

    sendSuccess(res, {
      authenticated: true,
      user: userResponse,
    }, 'Authentication valid');
  });

  // Update user profile
  updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw createError.unauthorized('Authentication required');
    }

    const updates = req.body;

    // Import userRepository here to avoid circular dependency
    const { userRepository } = await import('@/shared/repositories');
    
    const updatedUser = await userRepository.updateProfile(req.user.id, updates);

    const userResponse = {
      id: updatedUser.id,
      phoneNumber: updatedUser.phoneNumber,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      profilePicture: updatedUser.profilePicture,
      dateOfBirth: updatedUser.dateOfBirth,
      gender: updatedUser.gender,
      updatedAt: updatedUser.updatedAt,
    };

    sendSuccess(res, userResponse, 'Profile updated successfully');
  });

  // Change password (for authenticated users)
  changePassword = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw createError.unauthorized('Authentication required');
    }

    const { currentPassword, newPassword } = req.body;

    // Verify current password
    if (req.user.passwordHash) {
      const isValidPassword = await authService.verifyPassword(currentPassword, req.user.passwordHash);
      if (!isValidPassword) {
        throw createError.unauthorized('Current password is incorrect');
      }
    } else {
      throw createError.badRequest('No password set for this account');
    }

    // Hash and update new password
    const passwordHash = await authService.hashPassword(newPassword);
    
    // Import userRepository to update password
    const { userRepository } = await import('@/shared/repositories');
    await userRepository.updatePassword(req.user.id, passwordHash);

    // Logout all sessions for security
    await authService.logoutAll(req.user.id);

    sendSuccess(res, null, 'Password changed successfully. Please login again.');
  });

  // Verify current session
  verifySession = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // This is handled by the authenticate middleware
    // If we reach here, the session is valid
    sendSuccess(res, {
      valid: true,
      userId: req.user?.id,
    }, 'Session is valid');
  });
}

export const authController = new AuthController();
