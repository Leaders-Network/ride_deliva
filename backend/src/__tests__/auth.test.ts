import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../app';
import { authService } from '@/shared/services/auth.service';
import { userRepository } from '@/shared/repositories';

// Mock external dependencies
jest.mock('@/shared/repositories');
jest.mock('@/shared/services/auth.service');

const mockUserRepository = userRepository as jest.Mocked<typeof userRepository>;
const mockAuthService = authService as jest.Mocked<typeof authService>;

describe('Authentication API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    const validRegistrationData = {
      phoneNumber: '+2348123456789',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'Password123!',
      role: 'customer',
    };

    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user-id',
        phoneNumber: '+2348123456789',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        isVerified: false,
        createdAt: new Date(),
      };

      mockAuthService.register.mockResolvedValue({
        user: mockUser as any,
        verificationCodeSent: true,
      });

      const response = await request(app.app)
        .post('/api/v1/auth/register')
        .send(validRegistrationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.phoneNumber).toBe(validRegistrationData.phoneNumber);
      expect(response.body.data.verificationCodeSent).toBe(true);
      expect(mockAuthService.register).toHaveBeenCalledWith(validRegistrationData);
    });

    it('should return validation error for invalid phone number', async () => {
      const invalidData = {
        ...validRegistrationData,
        phoneNumber: 'invalid-phone',
      };

      const response = await request(app.app)
        .post('/api/v1/auth/register')
        .send(invalidData)
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return validation error for missing required fields', async () => {
      const invalidData = {
        phoneNumber: '+2348123456789',
        // Missing firstName, lastName, role
      };

      const response = await request(app.app)
        .post('/api/v1/auth/register')
        .send(invalidData)
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle registration conflict error', async () => {
      mockAuthService.register.mockRejectedValue(
        new Error('User with this phone number already exists')
      );

      const response = await request(app.app)
        .post('/api/v1/auth/register')
        .send(validRegistrationData)
        .expect(500); // Will be caught by error handler

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    const validLoginData = {
      phoneNumber: '+2348123456789',
      password: 'Password123!',
    };

    it('should login user successfully with password', async () => {
      const mockUser = {
        id: 'user-id',
        phoneNumber: '+2348123456789',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        isVerified: true,
      };

      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      const mockSession = {
        id: 'session-id',
      };

      mockAuthService.login.mockResolvedValue({
        user: mockUser as any,
        tokens: mockTokens,
        session: mockSession as any,
      });

      const response = await request(app.app)
        .post('/api/v1/auth/login')
        .send(validLoginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.phoneNumber).toBe(validLoginData.phoneNumber);
      expect(response.body.data.tokens.accessToken).toBe('access-token');
      expect(response.body.data.sessionId).toBe('session-id');
    });

    it('should login user successfully with verification code', async () => {
      const loginWithCode = {
        phoneNumber: '+2348123456789',
        verificationCode: '123456',
      };

      const mockResponse = {
        user: { id: 'user-id', phoneNumber: '+2348123456789' },
        tokens: { accessToken: 'token', refreshToken: 'refresh' },
        session: { id: 'session-id' },
      };

      mockAuthService.login.mockResolvedValue(mockResponse as any);

      const response = await request(app.app)
        .post('/api/v1/auth/login')
        .send(loginWithCode)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockAuthService.login).toHaveBeenCalledWith(loginWithCode);
    });

    it('should return validation error when both password and code provided', async () => {
      const invalidData = {
        phoneNumber: '+2348123456789',
        password: 'Password123!',
        verificationCode: '123456',
      };

      const response = await request(app.app)
        .post('/api/v1/auth/login')
        .send(invalidData)
        .expect(422);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle invalid credentials', async () => {
      mockAuthService.login.mockRejectedValue(
        new Error('Invalid credentials')
      );

      const response = await request(app.app)
        .post('/api/v1/auth/login')
        .send(validLoginData)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/verify-phone', () => {
    const validVerificationData = {
      phoneNumber: '+2348123456789',
      code: '123456',
    };

    it('should verify phone number successfully', async () => {
      const mockResponse = {
        verified: true,
        user: {
          id: 'user-id',
          phoneNumber: '+2348123456789',
          isVerified: true,
        },
      };

      mockAuthService.verifyPhoneCode.mockResolvedValue(mockResponse as any);

      const response = await request(app.app)
        .post('/api/v1/auth/verify-phone')
        .send(validVerificationData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.verified).toBe(true);
      expect(mockAuthService.verifyPhoneCode).toHaveBeenCalledWith(
        validVerificationData.phoneNumber,
        validVerificationData.code
      );
    });

    it('should return validation error for invalid code format', async () => {
      const invalidData = {
        phoneNumber: '+2348123456789',
        code: '12345', // Too short
      };

      const response = await request(app.app)
        .post('/api/v1/auth/verify-phone')
        .send(invalidData)
        .expect(422);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle expired verification code', async () => {
      mockAuthService.verifyPhoneCode.mockRejectedValue(
        new Error('Verification code has expired')
      );

      const response = await request(app.app)
        .post('/api/v1/auth/verify-phone')
        .send(validVerificationData)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/refresh-token', () => {
    it('should refresh token successfully', async () => {
      const refreshTokenData = {
        refreshToken: 'valid-refresh-token',
      };

      const mockTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      mockAuthService.refreshToken.mockResolvedValue(mockTokens);

      const response = await request(app.app)
        .post('/api/v1/auth/refresh-token')
        .send(refreshTokenData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tokens).toEqual(mockTokens);
    });

    it('should handle invalid refresh token', async () => {
      mockAuthService.refreshToken.mockRejectedValue(
        new Error('Invalid refresh token')
      );

      const response = await request(app.app)
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken: 'invalid-token' })
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/auth/profile', () => {
    it('should get user profile when authenticated', async () => {
      const mockUser = {
        id: 'user-id',
        phoneNumber: '+2348123456789',
        firstName: 'John',
        lastName: 'Doe',
        isVerified: true,
      };

      mockAuthService.getUserFromToken.mockResolvedValue(mockUser as any);

      const response = await request(app.app)
        .get('/api/v1/auth/profile')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.phoneNumber).toBe(mockUser.phoneNumber);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app.app)
        .get('/api/v1/auth/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully when authenticated', async () => {
      mockAuthService.verifyToken.mockReturnValue({
        userId: 'user-id',
        sessionId: 'session-id',
        phoneNumber: '+2348123456789',
        role: 'CUSTOMER',
        iat: Date.now(),
        exp: Date.now() + 3600,
      });

      mockAuthService.logout.mockResolvedValue();

      const response = await request(app.app)
        .post('/api/v1/auth/logout')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logout successful');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to registration endpoint', async () => {
      // This test would need to make multiple requests to trigger rate limiting
      // Implementation depends on your rate limiting configuration
    });

    it('should apply rate limiting to OTP endpoints', async () => {
      // Test OTP-specific rate limiting
    });
  });

  describe('Validation Edge Cases', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app.app)
        .post('/api/v1/auth/register')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.error.code).toBe('BAD_REQUEST');
    });

    it('should sanitize phone numbers', async () => {
      const registrationData = {
        phoneNumber: '0812 345 6789', // Spaces should be removed
        firstName: 'John',
        lastName: 'Doe',
        role: 'customer',
      };

      mockAuthService.register.mockResolvedValue({
        user: { phoneNumber: '+2348123456789' } as any,
        verificationCodeSent: true,
      });

      const response = await request(app.app)
        .post('/api/v1/auth/register')
        .send(registrationData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });
});

describe('Auth Service Unit Tests', () => {
  describe('Password Hashing', () => {
    it('should hash password correctly', async () => {
      const password = 'Password123!';
      const hash = await authService.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(typeof hash).toBe('string');
    });

    it('should verify password correctly', async () => {
      const password = 'Password123!';
      const hash = await bcrypt.hash(password, 12);
      
      const isValid = await authService.verifyPassword(password, hash);
      expect(isValid).toBe(true);
      
      const isInvalid = await authService.verifyPassword('wrongpassword', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('JWT Tokens', () => {
    it('should generate valid JWT tokens', () => {
      const payload = {
        userId: 'user-id',
        phoneNumber: '+2348123456789',
        role: 'CUSTOMER',
        sessionId: 'session-id',
      };

      const tokens = authService.generateTokens(payload);
      
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
    });

    it('should verify JWT tokens correctly', () => {
      const payload = {
        userId: 'user-id',
        phoneNumber: '+2348123456789',
        role: 'CUSTOMER',
        sessionId: 'session-id',
      };

      const tokens = authService.generateTokens(payload);
      const decoded = authService.verifyToken(tokens.accessToken);
      
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.phoneNumber).toBe(payload.phoneNumber);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.sessionId).toBe(payload.sessionId);
    });
  });

  describe('Role Checking', () => {
    it('should correctly identify user roles', () => {
      const customerUser = {
        customerProfile: { id: 'customer-profile-id' },
      } as any;

      const driverUser = {
        driverProfile: { id: 'driver-profile-id' },
      } as any;

      const adminUser = {
        adminProfile: { id: 'admin-profile-id' },
      } as any;

      expect(authService.hasRole(customerUser, ['CUSTOMER'])).toBe(true);
      expect(authService.hasRole(customerUser, ['DRIVER'])).toBe(false);
      
      expect(authService.hasRole(driverUser, ['DRIVER'])).toBe(true);
      expect(authService.hasRole(driverUser, ['CUSTOMER'])).toBe(false);
      
      expect(authService.hasRole(adminUser, ['ADMIN'])).toBe(true);
      expect(authService.hasRole(adminUser, ['SUPER_ADMIN'])).toBe(true);
    });
  });
});