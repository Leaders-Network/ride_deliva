import { config } from '@/config';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce logging in tests

// Mock external services for tests
jest.mock('@/config/database', () => ({
  prisma: {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    // Add other models as needed
  },
  testDatabaseConnection: jest.fn().mockResolvedValue(true),
  closeDatabaseConnection: jest.fn().mockResolvedValue(undefined),
  checkDatabaseHealth: jest.fn().mockResolvedValue({ status: 'healthy' }),
}));

jest.mock('@/config/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    ping: jest.fn(),
  },
  testRedisConnection: jest.fn().mockResolvedValue(true),
  closeRedisConnections: jest.fn().mockResolvedValue(undefined),
  checkRedisHealth: jest.fn().mockResolvedValue({ status: 'healthy' }),
}));

// Global test timeout
jest.setTimeout(30000);

// Global test setup
beforeAll(async () => {
  // Setup test database or any global test configuration
});

// Global test cleanup
afterAll(async () => {
  // Cleanup test database or any global test resources
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
