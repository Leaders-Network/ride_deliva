import { checkDatabaseHealth } from '@/config/database';
import { checkRedisHealth } from '@/config/redis';
import { healthService } from '@/shared/services/health';

const mockedDatabaseHealth = checkDatabaseHealth as jest.MockedFunction<typeof checkDatabaseHealth>;
const mockedRedisHealth = checkRedisHealth as jest.MockedFunction<typeof checkRedisHealth>;

describe('dependency-aware health checks', () => {
  it('reports healthy and ready only when both required dependencies are healthy', async () => {
    mockedDatabaseHealth.mockResolvedValue({ status: 'healthy', latency: 3 });
    mockedRedisHealth.mockResolvedValue({ status: 'healthy', latency: 2 });

    const health = await healthService.checkHealth();

    expect(health.status).toBe('healthy');
    expect(health.services.database.status).toBe('healthy');
    expect(health.services.redis.status).toBe('healthy');
    await expect(healthService.checkReadiness()).resolves.toBe(true);
  });

  it.each(['database', 'redis'] as const)(
    'reports unhealthy and not ready when %s is unavailable',
    async failedDependency => {
      mockedDatabaseHealth.mockResolvedValue(
        failedDependency === 'database'
          ? { status: 'unhealthy', error: 'database unavailable' }
          : { status: 'healthy', latency: 3 }
      );
      mockedRedisHealth.mockResolvedValue(
        failedDependency === 'redis'
          ? { status: 'unhealthy', error: 'redis unavailable' }
          : { status: 'healthy', latency: 2 }
      );

      const health = await healthService.checkHealth();

      expect(health.status).toBe('unhealthy');
      expect(health.services[failedDependency].status).toBe('unhealthy');
      await expect(healthService.checkReadiness()).resolves.toBe(false);
    }
  );
});
