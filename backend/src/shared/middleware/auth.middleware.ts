import { Request, Response, NextFunction } from 'express';
import { User } from '@/generated/prisma';
import { authService } from '@/shared/services/auth.service';
import { createError } from '@/shared/middleware/error-handler';
import { logger } from '@/config/logger';
import { AuthenticatedRequest } from '@/types';

// Extend Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User & {
        customerProfile?: any;
        driverProfile?: any;
        adminProfile?: any;
      };
    }
  }
}

// Authentication middleware
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw createError.unauthorized('Authentication token required');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw createError.unauthorized('Invalid token format. Use Bearer token');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      throw createError.unauthorized('Authentication token required');
    }

    // Verify token and get user
    const user = await authService.getUserFromToken(token);

    if (!user) {
      throw createError.unauthorized('Invalid or expired token');
    }

    if (!user.isActive) {
      throw createError.forbidden('Account is deactivated');
    }

    // Attach user to request
    req.user = user;

    logger.debug('User authenticated', {
      userId: user.id,
      phoneNumber: user.phoneNumber,
      requestId: req.id,
    });

    next();
  } catch (error) {
    logger.warn('Authentication failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    next(error);
  }
};

// Optional authentication middleware (doesn't throw if no token)
export const optionalAuthenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const token = authHeader.substring(7);

    if (!token) {
      return next();
    }

    const user = await authService.getUserFromToken(token);

    if (user && user.isActive) {
      req.user = user;
      logger.debug('Optional authentication successful', {
        userId: user.id,
        requestId: req.id,
      });
    }

    next();
  } catch (error) {
    // Log the error but continue without authentication
    logger.debug('Optional authentication failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.id,
    });

    next();
  }
};

// Role-based authorization middleware
export const authorize = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(createError.unauthorized('Authentication required'));
    }

    const hasRequiredRole = authService.hasRole(req.user, roles);

    if (!hasRequiredRole) {
      logger.warn('Authorization failed - insufficient permissions', {
        userId: req.user.id,
        requiredRoles: roles,
        requestId: req.id,
      });

      return next(createError.forbidden('Insufficient permissions'));
    }

    logger.debug('Authorization successful', {
      userId: req.user.id,
      roles: roles,
      requestId: req.id,
    });

    next();
  };
};

// Specific role middleware
export const requireCustomer = authorize('CUSTOMER');
export const requireDriver = authorize('DRIVER');
export const requireAdmin = authorize('ADMIN', 'SUPER_ADMIN');
export const requireDriverOrAdmin = authorize('DRIVER', 'ADMIN', 'SUPER_ADMIN');

// Account verification middleware
export const requireVerified = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    return next(createError.unauthorized('Authentication required'));
  }

  if (!req.user.isVerified) {
    return next(createError.forbidden('Account verification required'));
  }

  next();
};

// Driver status middleware
export const requireApprovedDriver = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    return next(createError.unauthorized('Authentication required'));
  }

  const driverProfile = (req.user as any).driverProfile;

  if (!driverProfile) {
    return next(createError.forbidden('Driver profile required'));
  }

  if (driverProfile.status !== 'APPROVED') {
    return next(createError.forbidden(`Driver status is ${driverProfile.status}. Approval required.`));
  }

  next();
};

// Resource ownership middleware
export const requireOwnership = (resourceField: string = 'userId') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(createError.unauthorized('Authentication required'));
    }

    // Check if user owns the resource
    const resourceUserId = req.params[resourceField] || req.body[resourceField];

    if (!resourceUserId) {
      return next(createError.badRequest(`${resourceField} is required`));
    }

    // Admin can access any resource
    if ((req.user as any).adminProfile) {
      return next();
    }

    // Check ownership
    if (req.user.id !== resourceUserId) {
      logger.warn('Unauthorized resource access attempt', {
        userId: req.user.id,
        resourceUserId,
        resource: req.originalUrl,
        requestId: req.id,
      });

      return next(createError.forbidden('Access denied - resource ownership required'));
    }

    next();
  };
};

// Session validation middleware
export const validateSession = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    return next(createError.unauthorized('Authentication required'));
  }

  try {
    // Extract token from header
    const authHeader = req.headers.authorization;
    const token = authHeader?.substring(7); // Remove 'Bearer '

    if (!token) {
      return next(createError.unauthorized('Token required for session validation'));
    }

    // Verify token and extract session ID
    const payload = authService.verifyToken(token);

    // Get active sessions for user
    const sessions = await authService.getUserSessions(req.user.id);
    const currentSession = sessions.find(session => session.id === payload.sessionId);

    if (!currentSession) {
      return next(createError.unauthorized('Session no longer valid'));
    }

    // Attach session info to request
    (req as any).session = currentSession;

    next();
  } catch (error) {
    logger.warn('Session validation failed', {
      userId: req.user.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.id,
    });

    next(createError.unauthorized('Invalid session'));
  }
};

// Rate limiting for sensitive operations
export const sensitiveOperation = (req: Request, res: Response, next: NextFunction): void => {
  // This can be enhanced with more sophisticated rate limiting
  // For now, we rely on the existing rate limiter middleware
  next();
};

// IP whitelist middleware (for admin operations)
export const requireWhitelistedIP = (whitelist: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (whitelist.length === 0) {
      return next(); // No whitelist configured
    }

    const clientIP = req.ip || req.connection.remoteAddress || '';

    if (!whitelist.includes(clientIP)) {
      logger.warn('Access denied - IP not whitelisted', {
        clientIP,
        requestId: req.id,
        url: req.originalUrl,
      });

      return next(createError.forbidden('Access denied from this IP address'));
    }

    next();
  };
};

// Middleware to check if user account is active
export const requireActiveAccount = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    return next(createError.unauthorized('Authentication required'));
  }

  if (!req.user.isActive) {
    logger.warn('Inactive account access attempt', {
      userId: req.user.id,
      requestId: req.id,
    });

    return next(createError.forbidden('Account is deactivated'));
  }

  next();
};

// Combined middleware for common patterns
export const authenticateAndAuthorize = (...roles: string[]) => {
  return [authenticate, authorize(...roles)];
};

export const authenticateVerifiedUser = [authenticate, requireVerified, requireActiveAccount];

export const authenticateCustomer = [authenticate, requireCustomer, requireVerified];

export const authenticateDriver = [
  authenticate,
  requireDriver,
  requireVerified,
  requireApprovedDriver,
];

export const authenticateAdmin = [authenticate, requireAdmin];
