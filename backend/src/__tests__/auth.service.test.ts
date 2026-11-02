import bcrypt from 'bcrypt';
import { authService } from '@/shared/services/auth.service';

// Runs against the real AuthService (no jest.mock), unlike auth.test.ts which stubs it for HTTP tests
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