import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, Session, VerificationCode } from '@/generated/prisma';
import { config } from '@/config';
import { logger } from '@/config/logger';
import { redis } from '@/config/redis';
import { userRepository } from '@/shared/repositories';
import { createError } from '@/shared/middleware/error-handler';
import { sanitize } from '@/shared/utils/validation';
import { TokenPayload, RegisterData, LoginCredentials } from '@/types';
import { CACHE_KEYS, BUSINESS_CONSTANTS } from '@/shared/constants';
import { smsService } from '@/shared/services/sms.service';
import prisma from '@/config/database';

export class AuthService {
  // Generate verification code
  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Hash password
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, config.encryption.saltRounds);
  }

  // Verify password
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Generate JWT tokens
  generateTokens(payload: Omit<TokenPayload, 'iat' | 'exp'>): {
    accessToken: string;
    refreshToken: string;
  } {
    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    const refreshToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.refreshExpiresIn,
    });

    return { accessToken, refreshToken };
  }

  // Verify JWT token
  verifyToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, config.jwt.secret) as TokenPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw createError.unauthorized('Token expired');
      }
      throw createError.unauthorized('Invalid token');
    }
  }

  // Register new user
  async register(registerData: RegisterData): Promise<{
    user: User;
    verificationCodeSent: boolean;
  }> {
    const { phoneNumber, email, firstName, lastName, password, role } = registerData;

    // Sanitize inputs
    const sanitizedPhone = sanitize.phoneNumber(phoneNumber);
    const sanitizedEmail = email ? sanitize.email(email) : undefined;

    // Check if user already exists
    const existingUser = await userRepository.findByPhoneNumber(sanitizedPhone);
    if (existingUser) {
      throw createError.conflict('User with this phone number already exists');
    }

    if (sanitizedEmail) {
      const existingEmailUser = await userRepository.findByEmail(sanitizedEmail);
      if (existingEmailUser) {
        throw createError.conflict('User with this email already exists');
      }
    }

    // Hash password if provided
    let passwordHash: string | undefined;
    if (password) {
      passwordHash = await this.hashPassword(password);
    }

    // Create user with profile
    const profileData = role === 'DRIVER' 
      ? { status: 'PENDING' as const }
      : {};

    const user = await userRepository.createUser({
      phoneNumber: sanitizedPhone,
      email: sanitizedEmail,
      firstName: sanitize.name(firstName),
      lastName: sanitize.name(lastName),
      passwordHash,
      profileType: role,
      profileData,
    });

    // Send verification code
    const verificationCodeSent = await this.sendVerificationCode(sanitizedPhone, 'PHONE_VERIFICATION');

    logger.info('User registered successfully', {
      userId: user.id,
      phoneNumber: sanitizedPhone,
      role,
    });

    return { user, verificationCodeSent };
  }

  // Send verification code
  async sendVerificationCode(
    phoneNumber: string,
    type: 'PHONE_VERIFICATION' | 'PASSWORD_RESET' = 'PHONE_VERIFICATION'
  ): Promise<boolean> {
    const sanitizedPhone = sanitize.phoneNumber(phoneNumber);

    // Check rate limiting
    const rateLimitKey = `${CACHE_KEYS.VERIFICATION_CODE(sanitizedPhone)}:rate_limit`;
    const attempts = await redis.get(rateLimitKey);
    
    if (attempts && parseInt(attempts) >= 5) {
      throw createError.tooManyRequests('Too many verification attempts. Please try again later.');
    }

    // Generate and store verification code
    const code = this.generateVerificationCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + BUSINESS_CONSTANTS.VERIFICATION_CODE_EXPIRY_MINUTES);

    // Store in database
    await prisma.verificationCode.create({
      data: {
        phoneNumber: sanitizedPhone,
        code,
        type,
        expiresAt,
      },
    });

    // Store in Redis for fast lookup
    await redis.setex(
      CACHE_KEYS.VERIFICATION_CODE(sanitizedPhone),
      BUSINESS_CONSTANTS.VERIFICATION_CODE_EXPIRY_MINUTES * 60,
      JSON.stringify({ code, type, expiresAt })
    );

    // Increment rate limiting
    await redis.incr(rateLimitKey);
    await redis.expire(rateLimitKey, 3600); // 1 hour

    // Send SMS via SMS service
    let smsResult;
    if (type === 'PHONE_VERIFICATION') {
      smsResult = await smsService.sendVerificationCode(sanitizedPhone, code);
    } else {
      smsResult = await smsService.sendPasswordResetCode(sanitizedPhone, code);
    }

    if (!smsResult.success) {
      logger.error('Failed to send SMS verification code', {
        phoneNumber: sanitizedPhone,
        error: smsResult.error,
      });
      // Don't throw error to avoid revealing SMS service issues
      // In production, you might want to retry or use alternative delivery methods
    }

    // Log the code in development for testing
    if (config.app.env === 'development') {
      logger.info(`Verification code for ${sanitizedPhone}: ${code}`);
    }

    logger.info('Verification code sent', {
      phoneNumber: sanitizedPhone,
      type,
      smsDelivered: smsResult.success,
      messageId: smsResult.messageId,
    });

    return true;
  }

  // Verify phone verification code
  async verifyPhoneCode(phoneNumber: string, code: string): Promise<{
    verified: boolean;
    user?: User;
  }> {
    const sanitizedPhone = sanitize.phoneNumber(phoneNumber);

    // Get verification code from Redis first (faster)
    let storedData: any;
    const cacheKey = CACHE_KEYS.VERIFICATION_CODE(sanitizedPhone);
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      storedData = JSON.parse(cachedData);
    } else {
      // Fallback to database
      const dbCode = await prisma.verificationCode.findFirst({
        where: {
          phoneNumber: sanitizedPhone,
          type: 'PHONE_VERIFICATION',
          isUsed: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!dbCode) {
        throw createError.badRequest('Invalid or expired verification code');
      }

      storedData = {
        code: dbCode.code,
        type: dbCode.type,
        expiresAt: dbCode.expiresAt,
      };
    }

    // Check if code matches and hasn't expired
    if (storedData.code !== code) {
      // Increment attempts
      await this.incrementVerificationAttempts(sanitizedPhone);
      throw createError.badRequest('Invalid verification code');
    }

    if (new Date() > new Date(storedData.expiresAt)) {
      throw createError.badRequest('Verification code has expired');
    }

    // Mark code as used
    await prisma.verificationCode.updateMany({
      where: {
        phoneNumber: sanitizedPhone,
        code,
        type: 'PHONE_VERIFICATION',
      },
      data: { isUsed: true },
    });

    // Remove from cache
    await redis.del(cacheKey);

    // Mark user as verified
    const user = await userRepository.findByPhoneNumber(sanitizedPhone);
    if (user && !user.isVerified) {
      await userRepository.markPhoneVerified(user.id);
    }

    logger.info('Phone verification successful', {
      phoneNumber: sanitizedPhone,
      userId: user?.id,
    });

    return { verified: true, user };
  }

  // Login with phone and password or verification code
  async login(credentials: LoginCredentials): Promise<{
    user: User;
    tokens: { accessToken: string; refreshToken: string };
    session: Session;
  }> {
    const { phoneNumber, password, verificationCode } = credentials;
    const sanitizedPhone = sanitize.phoneNumber(phoneNumber);

    // Find user
    const user = await userRepository.findByPhoneNumber(sanitizedPhone, {
      customerProfile: true,
      driverProfile: true,
      adminProfile: true,
    });

    if (!user) {
      throw createError.unauthorized('Invalid credentials');
    }

    if (!user.isActive) {
      throw createError.forbidden('Account is deactivated');
    }

    // Verify credentials
    let isValidCredentials = false;

    if (password && user.passwordHash) {
      // Password-based authentication
      isValidCredentials = await this.verifyPassword(password, user.passwordHash);
    } else if (verificationCode) {
      // OTP-based authentication
      const verificationResult = await this.verifyPhoneCode(sanitizedPhone, verificationCode);
      isValidCredentials = verificationResult.verified;
    }

    if (!isValidCredentials) {
      throw createError.unauthorized('Invalid credentials');
    }

    // Determine user role
    let role = 'USER';
    if (user.adminProfile) role = 'ADMIN';
    else if (user.driverProfile) role = 'DRIVER';
    else if (user.customerProfile) role = 'CUSTOMER';

    // Create session
    const session = await this.createSession(user.id, {
      deviceInfo: {}, // Will be populated from request headers
      ipAddress: '', // Will be populated from request
    });

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      phoneNumber: user.phoneNumber,
      role,
      sessionId: session.id,
    };

    const tokens = this.generateTokens(tokenPayload);

    logger.info('User logged in successfully', {
      userId: user.id,
      phoneNumber: sanitizedPhone,
      role,
      sessionId: session.id,
    });

    return { user, tokens, session };
  }

  // Create user session
  private async createSession(userId: string, metadata: {
    deviceInfo?: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<Session> {
    const { deviceInfo = {}, ipAddress, userAgent } = metadata;

    // Generate session tokens
    const sessionTokens = this.generateTokens({
      userId,
      phoneNumber: '', // Will be filled from user data
      role: '', // Will be filled from user data
      sessionId: '', // Placeholder, will be replaced
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + BUSINESS_CONSTANTS.SESSION_EXPIRY_DAYS);

    const session = await prisma.session.create({
      data: {
        userId,
        token: sessionTokens.accessToken,
        refreshToken: sessionTokens.refreshToken,
        deviceInfo,
        ipAddress,
        userAgent,
        expiresAt,
        isActive: true,
      },
    });

    // Cache session in Redis
    await redis.setex(
      CACHE_KEYS.USER_SESSION(userId),
      BUSINESS_CONSTANTS.SESSION_EXPIRY_DAYS * 24 * 60 * 60,
      JSON.stringify({
        sessionId: session.id,
        userId,
        expiresAt: session.expiresAt,
      })
    );

    return session;
  }

  // Refresh access token
  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      const payload = this.verifyToken(refreshToken);

      // Verify session exists and is active
      const session = await prisma.session.findUnique({
        where: { id: payload.sessionId },
        include: { user: true },
      });

      if (!session || !session.isActive || session.expiresAt < new Date()) {
        throw createError.unauthorized('Invalid session');
      }

      // Generate new tokens
      const newTokens = this.generateTokens({
        userId: payload.userId,
        phoneNumber: payload.phoneNumber,
        role: payload.role,
        sessionId: payload.sessionId,
      });

      // Update session with new tokens
      await prisma.session.update({
        where: { id: session.id },
        data: {
          token: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
        },
      });

      logger.info('Token refreshed successfully', {
        userId: payload.userId,
        sessionId: payload.sessionId,
      });

      return newTokens;
    } catch (error) {
      throw createError.unauthorized('Invalid refresh token');
    }
  }

  // Logout user
  async logout(sessionId: string): Promise<void> {
    // Deactivate session
    await prisma.session.update({
      where: { id: sessionId },
      data: { isActive: false },
    });

    // Remove from cache
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (session) {
      await redis.del(CACHE_KEYS.USER_SESSION(session.userId));
    }

    logger.info('User logged out successfully', { sessionId });
  }

  // Logout all sessions for a user
  async logoutAll(userId: string): Promise<void> {
    // Deactivate all sessions
    await prisma.session.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    // Remove from cache
    await redis.del(CACHE_KEYS.USER_SESSION(userId));

    logger.info('All sessions logged out', { userId });
  }

  // Reset password
  async initiatePasswordReset(phoneNumber: string): Promise<boolean> {
    const sanitizedPhone = sanitize.phoneNumber(phoneNumber);

    // Check if user exists
    const user = await userRepository.findByPhoneNumber(sanitizedPhone);
    if (!user) {
      // Don't reveal if user exists or not
      logger.warn('Password reset attempted for non-existent user', { phoneNumber: sanitizedPhone });
      return true;
    }

    // Send verification code for password reset
    await this.sendVerificationCode(sanitizedPhone, 'PASSWORD_RESET');

    logger.info('Password reset initiated', {
      userId: user.id,
      phoneNumber: sanitizedPhone,
    });

    return true;
  }

  // Complete password reset
  async completePasswordReset(
    phoneNumber: string,
    code: string,
    newPassword: string
  ): Promise<boolean> {
    const sanitizedPhone = sanitize.phoneNumber(phoneNumber);

    // Verify code
    const dbCode = await prisma.verificationCode.findFirst({
      where: {
        phoneNumber: sanitizedPhone,
        code,
        type: 'PASSWORD_RESET',
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!dbCode) {
      throw createError.badRequest('Invalid or expired verification code');
    }

    // Find user
    const user = await userRepository.findByPhoneNumber(sanitizedPhone);
    if (!user) {
      throw createError.notFound('User not found');
    }

    // Hash new password
    const passwordHash = await this.hashPassword(newPassword);

    // Update password
    await userRepository.updatePassword(user.id, passwordHash);

    // Mark code as used
    await prisma.verificationCode.update({
      where: { id: dbCode.id },
      data: { isUsed: true },
    });

    // Logout all sessions
    await this.logoutAll(user.id);

    logger.info('Password reset completed', {
      userId: user.id,
      phoneNumber: sanitizedPhone,
    });

    return true;
  }

  // Get user from token
  async getUserFromToken(token: string): Promise<User | null> {
    try {
      const payload = this.verifyToken(token);

      // Check session validity
      const session = await prisma.session.findUnique({
        where: { id: payload.sessionId },
      });

      if (!session || !session.isActive || session.expiresAt < new Date()) {
        return null;
      }

      return userRepository.getUserWithProfiles(payload.userId);
    } catch (error) {
      return null;
    }
  }

  // Helper method to increment verification attempts
  private async incrementVerificationAttempts(phoneNumber: string): Promise<void> {
    const attemptsKey = `${CACHE_KEYS.VERIFICATION_CODE(phoneNumber)}:attempts`;
    const attempts = await redis.incr(attemptsKey);
    await redis.expire(attemptsKey, 3600); // 1 hour

    if (attempts >= BUSINESS_CONSTANTS.MAX_VERIFICATION_ATTEMPTS) {
      throw createError.tooManyRequests('Maximum verification attempts exceeded');
    }
  }

  // Check if user has required role/permission
  hasRole(user: User, requiredRoles: string[]): boolean {
    if ((user as any).adminProfile) {
      return requiredRoles.includes('ADMIN') || requiredRoles.includes('SUPER_ADMIN');
    }
    if ((user as any).driverProfile) {
      return requiredRoles.includes('DRIVER');
    }
    if ((user as any).customerProfile) {
      return requiredRoles.includes('CUSTOMER');
    }
    return false;
  }

  // Get user sessions
  async getUserSessions(userId: string): Promise<Session[]> {
    return prisma.session.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Revoke specific session
  async revokeSession(sessionId: string): Promise<void> {
    await prisma.session.update({
      where: { id: sessionId },
      data: { isActive: false },
    });

    logger.info('Session revoked', { sessionId });
  }
}

export const authService = new AuthService();
