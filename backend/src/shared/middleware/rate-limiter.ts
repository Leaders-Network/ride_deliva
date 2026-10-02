import rateLimit from 'express-rate-limit';
import { config } from '@/config';
import { logger } from '@/config/logger';

// Create rate limiter middleware
export const rateLimiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs, // Time window in milliseconds
  max: config.security.rateLimitMaxRequests, // Maximum number of requests per window
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests from this IP, please try again later',
      statusCode: 429,
      retryAfter: Math.ceil(config.security.rateLimitWindowMs / 1000),
    },
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  
  // Custom key generator based on IP and optionally user ID
  keyGenerator: (req) => {
    const userId = (req as any).user?.id;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Use user ID if authenticated, otherwise use IP
    return userId ? `user:${userId}` : `ip:${ip}`;
  },

  // Skip successful requests for certain endpoints
  skip: (req) => {
    // Skip rate limiting for health check endpoints
    const healthEndpoints = ['/health', '/health/readiness', '/health/liveness'];
    return healthEndpoints.includes(req.path);
  },

  // Custom handler for rate limit exceeded
  handler: (req, res) => {
    const userId = (req as any).user?.id;
    const ip = req.ip;

    logger.warn('Rate limit exceeded', {
      ip,
      userId,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
    });

    res.status(429).json({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests from this IP, please try again later',
        statusCode: 429,
        retryAfter: Math.ceil(config.security.rateLimitWindowMs / 1000),
        timestamp: new Date().toISOString(),
      },
    });
  },
});

// Stricter rate limiter for authentication endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Maximum 10 auth attempts per 15 minutes
  message: {
    error: {
      code: 'TOO_MANY_AUTH_ATTEMPTS',
      message: 'Too many authentication attempts, please try again later',
      statusCode: 429,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  
  keyGenerator: (req) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const phoneNumber = req.body?.phoneNumber || req.body?.phone;
    
    // Combine IP and phone number for more specific rate limiting
    return phoneNumber ? `auth:${ip}:${phoneNumber}` : `auth:${ip}`;
  },

  handler: (req, res) => {
    const ip = req.ip;
    const phoneNumber = req.body?.phoneNumber || req.body?.phone;

    logger.warn('Authentication rate limit exceeded', {
      ip,
      phoneNumber: phoneNumber ? `***${phoneNumber.slice(-4)}` : 'N/A',
      method: req.method,
      url: req.originalUrl,
    });

    res.status(429).json({
      error: {
        code: 'TOO_MANY_AUTH_ATTEMPTS',
        message: 'Too many authentication attempts, please try again in 15 minutes',
        statusCode: 429,
        retryAfter: 15 * 60, // 15 minutes in seconds
        timestamp: new Date().toISOString(),
      },
    });
  },
});

// Rate limiter for password reset endpoints
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Maximum 5 password reset attempts per hour
  message: {
    error: {
      code: 'TOO_MANY_PASSWORD_RESET_ATTEMPTS',
      message: 'Too many password reset attempts, please try again later',
      statusCode: 429,
    },
  },
  keyGenerator: (req) => {
    const email = req.body?.email || req.body?.phoneNumber;
    return `password-reset:${email}`;
  },
});

// Rate limiter for OTP verification
export const otpRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Maximum 5 OTP attempts per 5 minutes
  message: {
    error: {
      code: 'TOO_MANY_OTP_ATTEMPTS',
      message: 'Too many OTP verification attempts, please try again later',
      statusCode: 429,
    },
  },
  keyGenerator: (req) => {
    const phoneNumber = req.body?.phoneNumber;
    const ip = req.ip;
    return `otp:${ip}:${phoneNumber}`;
  },
});
