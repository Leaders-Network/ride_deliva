import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Environment configuration
export const config = {
  // Application
  app: {
    name: 'Ride Deliva Backend',
    version: '1.0.0',
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000'),
    apiPrefix: process.env.API_PREFIX || '/api/v1',
  },

  // Database
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ride_deliva?schema=public',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    name: process.env.POSTGRES_DB || 'ride_deliva',
    username: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-this-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  // Encryption
  encryption: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12'),
    key: process.env.ENCRYPTION_KEY || 'dev-encryption-key-32-chars-long',
  },

  // External Services
  services: {
    googleMaps: {
      apiKey: process.env.GOOGLE_MAPS_API_KEY,
    },
    googlePlaces: {
      apiKey: process.env.GOOGLE_PLACES_API_KEY,
    },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER,
    },
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASS,
    },
    fcm: {
      serverKey: process.env.FCM_SERVER_KEY,
      senderId: process.env.FCM_SENDER_ID,
    },
    stripe: {
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    },
    paystack: {
      publicKey: process.env.PAYSTACK_PUBLIC_KEY,
      secretKey: process.env.PAYSTACK_SECRET_KEY,
    },
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
      s3Bucket: process.env.AWS_S3_BUCKET,
    },
  },

  // Security
  security: {
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001', 'http://localhost:3002'],
    sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret',
    sessionMaxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000'), // 24 hours
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
  },

  // Feature Flags
  features: {
    rideSharing: process.env.ENABLE_RIDE_SHARING === 'true',
    delivery: process.env.ENABLE_DELIVERY === 'true',
    analytics: process.env.ENABLE_ANALYTICS === 'true',
    adminPanel: process.env.ENABLE_ADMIN_PANEL === 'true',
    
    // External service availability
    googleMaps: !!process.env.GOOGLE_MAPS_API_KEY && !process.env.GOOGLE_MAPS_API_KEY.includes('ride-deliva'),
    fcm: !!process.env.FCM_SERVER_KEY && !process.env.FCM_SERVER_KEY.includes('ride-deliva'),
    aws: !!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_ACCESS_KEY_ID.includes('ride-deliva'),
  },

  // Business Logic
  business: {
    // Pricing configuration
    pricing: {
      baseFare: 5.00, // Base fare in local currency
      perKmRate: 0.50, // Rate per kilometer
      perMinuteRate: 0.25, // Rate per minute
      minimumFare: 5.00, // Minimum fare
      cancellationFee: 2.00, // Fee for ride cancellation
      commissionRate: 0.20, // 20% commission
    },
    
    // Driver matching configuration
    driverMatching: {
      searchRadius: 5000, // 5km radius for driver search
      maxDrivers: 10, // Maximum drivers to consider
      timeoutSeconds: 30, // Timeout for driver response
    },
    
    // Verification
    verification: {
      codeLength: 6, // OTP code length
      codeExpiryMinutes: 5, // OTP expiry time
      maxAttempts: 3, // Maximum verification attempts
    },
  },
};

// Validate required environment variables
export const validateConfig = (): void => {
  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'REDIS_URL',
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Warn about disabled services
  const logger = console; // Use console for config validation
  
  if (!config.features.googleMaps) {
    logger.warn('⚠️  Google Maps API not configured - location services disabled');
  }
  
  if (!config.features.fcm) {
    logger.warn('⚠️  FCM not configured - push notifications disabled');
  }
  
  if (!config.features.aws) {
    logger.warn('⚠️  AWS not configured - file uploads disabled');
  }
};

// Check if running in production
export const isProduction = (): boolean => {
  return config.app.env === 'production';
};

// Check if running in development
export const isDevelopment = (): boolean => {
  return config.app.env === 'development';
};

// Check if running in test mode
export const isTest = (): boolean => {
  return config.app.env === 'test';
};

export default config;