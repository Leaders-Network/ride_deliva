import { PrismaClient } from '@/generated/prisma';
import { testDatabaseConnection, checkDatabaseHealth } from '@/config/database';
import { dbService } from '@/shared/services/database';
import { userRepository } from '@/shared/repositories';

// Mock Prisma for tests
jest.mock('@/generated/prisma');

describe('Database Service', () => {
  describe('Connection Tests', () => {
    it('should test database connection', async () => {
      const result = await testDatabaseConnection();
      expect(typeof result).toBe('boolean');
    });

    it('should check database health', async () => {
      const health = await checkDatabaseHealth();
      expect(health).toHaveProperty('status');
      expect(['healthy', 'unhealthy']).toContain(health.status);
    });
  });

  describe('Database Service CRUD Operations', () => {
    it('should have CRUD methods', () => {
      expect(dbService.create).toBeDefined();
      expect(dbService.findById).toBeDefined();
      expect(dbService.findMany).toBeDefined();
      expect(dbService.update).toBeDefined();
      expect(dbService.delete).toBeDefined();
      expect(dbService.count).toBeDefined();
    });

    it('should have pagination method', () => {
      expect(dbService.paginate).toBeDefined();
    });

    it('should have transaction method', () => {
      expect(dbService.transaction).toBeDefined();
    });

    it('should have geospatial methods', () => {
      expect(dbService.findNearbyDrivers).toBeDefined();
      expect(dbService.calculateDistance).toBeDefined();
      expect(dbService.updateDriverLocation).toBeDefined();
    });
  });

  describe('Repository Pattern', () => {
    it('should have user repository methods', () => {
      expect(userRepository.findByPhoneNumber).toBeDefined();
      expect(userRepository.findByEmail).toBeDefined();
      expect(userRepository.createUser).toBeDefined();
      expect(userRepository.updateProfile).toBeDefined();
      expect(userRepository.search).toBeDefined();
    });

    it('should inherit from base repository', () => {
      expect(userRepository.findById).toBeDefined();
      expect(userRepository.findMany).toBeDefined();
      expect(userRepository.create).toBeDefined();
      expect(userRepository.update).toBeDefined();
      expect(userRepository.delete).toBeDefined();
      expect(userRepository.paginate).toBeDefined();
    });
  });
});

describe('Prisma Schema Validation', () => {
  it('should expose every expected model', () => {
    // The file mocks the generated client above, so load the real one to inspect the schema
    const { Prisma } = jest.requireActual('@/generated/prisma');
    const models = Object.values(Prisma.ModelName);

    expect(models).toEqual(
      expect.arrayContaining([
        'User',
        'CustomerProfile',
        'DriverProfile',
        'Ride',
        'Delivery',
        'Payment',
        'Wallet',
        'Vehicle',
        'Address',
        'Notification',
      ])
    );
  });
});
