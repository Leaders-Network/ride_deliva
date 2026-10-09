import { checkDatabaseHealth } from '@/config/database';
import { checkRedisHealth } from '@/config/redis';
import { config } from '@/config';
import { logger } from '@/config/logger';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    database: {
      status: 'healthy' | 'unhealthy';
      latency?: number;
      error?: string;
    };
    redis: {
      status: 'healthy' | 'unhealthy';
      latency?: number;
      error?: string;
    };
    application: {
      status: 'healthy';
      uptime: number;
      memory: {
        used: number;
        free: number;
        total: number;
      };
    };
  };
  version: string;
}

export class HealthService {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  async checkHealth(): Promise<HealthCheckResult> {
    logger.debug('Performing dependency-aware health check');

    const [dbHealth, redisHealth] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);

    const memoryUsage = process.memoryUsage();
    const uptime = Date.now() - this.startTime;

    const overallStatus = dbHealth.status === 'healthy' && redisHealth.status === 'healthy'
      ? 'healthy'
      : 'unhealthy';

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth,
        redis: redisHealth,
        application: {
          status: 'healthy',
          uptime,
          memory: {
            used: memoryUsage.heapUsed,
            free: memoryUsage.heapTotal - memoryUsage.heapUsed,
            total: memoryUsage.heapTotal,
          },
        },
      },
      version: config.app.version,
    };

    logger.debug('Health check completed', { status: overallStatus });

    return result;
  }

  async checkReadiness(): Promise<boolean> {
    try {
      const [dbHealth, redisHealth] = await Promise.all([
        checkDatabaseHealth(),
        checkRedisHealth(),
      ]);
      return dbHealth.status === 'healthy' && redisHealth.status === 'healthy';
    } catch (error) {
      logger.error('Readiness check failed:', error);
      return false;
    }
  }

  async checkLiveness(): Promise<boolean> {
    // Simple liveness check - just verify the service is running
    return true;
  }
}

export const healthService = new HealthService();
