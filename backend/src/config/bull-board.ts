import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Request, Response, NextFunction } from 'express';
import { queueService, QUEUE_NAMES } from './queues';
import { logger } from './logger';
import { authService } from '../shared/services/auth.service';

// Create the Express adapter for Bull Board
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

/**
 * Initialize Bull Board dashboard
 */
export function initializeBullBoard(): ExpressAdapter {
  try {
    logger.info('Initializing Bull Board dashboard...');

    // Get all queues and create adapters
    const queueAdapters = [];
    
    for (const queueName of Object.values(QUEUE_NAMES)) {
      const queue = queueService.getQueue(queueName);
      if (queue) {
        queueAdapters.push(new BullMQAdapter(queue));
        logger.debug(`Added queue ${queueName} to Bull Board`);
      }
    }

    // Create Bull Board
    createBullBoard({
      queues: queueAdapters,
      serverAdapter: serverAdapter,
      options: {
        uiConfig: {
          boardTitle: 'Ride Deliva - Job Queue Dashboard',
          boardLogo: {
            path: '/logo.png',
            width: '100px',
            height: 'auto',
          },
          miscLinks: [
            { text: 'API Documentation', url: '/api-docs' },
            { text: 'Health Check', url: '/health' },
          ],
          favIcon: {
            default: 'static/images/favicon.ico',
            alternative: 'static/images/favicon-32x32.png',
          },
        },
      },
    });

    logger.info('Bull Board dashboard initialized successfully');
    return serverAdapter;
  } catch (error) {
    logger.error('Failed to initialize Bull Board dashboard', { error });
    throw error;
  }
}

/**
 * Authentication middleware for Bull Board
 * Only allow admin users to access the dashboard
 */
export const bullBoardAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Skip auth in development mode (optional)
    if (process.env.NODE_ENV === 'development' && process.env.BULL_BOARD_AUTH_DISABLED === 'true') {
      return next();
    }

    // Extract token from Authorization header or query parameter
    let token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token && req.query.token) {
      token = req.query.token as string;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required for queue dashboard',
        hint: 'Add ?token=your_jwt_token to the URL or use Authorization header',
      });
    }

    // Verify token and check if user is admin
    const user = await authService.getUserFromToken(token);
    
    if (!user || !user.isActive || !authService.hasRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required for queue dashboard',
      });
    }

    // Add user info to request for logging
    req.user = user;
    
    logger.info('Admin user accessing Bull Board dashboard', {
      userId: user.id,
      email: user.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    return next();
  } catch (error) {
    logger.warn('Unauthorized access attempt to Bull Board dashboard', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

/**
 * Get queue statistics for API endpoint
 */
export async function getQueueStatistics(): Promise<any> {
  try {
    const stats = await queueService.getAllQueueStats();
    
    const summary = {
      totalQueues: stats.length,
      totalJobs: 0,
      activeJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      waitingJobs: 0,
      delayedJobs: 0,
      queues: stats,
      timestamp: new Date().toISOString(),
    };

    // Calculate totals - properly discriminate the union type
    for (const queueStats of stats) {
      // Check if this is a successful result (has counts property)
      if ('counts' in queueStats && queueStats.counts) {
        const counts = queueStats.counts as Record<string, number>;
        summary.totalJobs += Object.values(counts).reduce((sum: number, count: number) => sum + count, 0);
        summary.activeJobs += counts.active || 0;
        summary.completedJobs += counts.completed || 0;
        summary.failedJobs += counts.failed || 0;
        summary.waitingJobs += counts.waiting || 0;
        summary.delayedJobs += counts.delayed || 0;
      }
      // If it's an error result, we skip it (already in the stats array)
    }

    return summary;
  } catch (error) {
    logger.error('Failed to get queue statistics', { error });
    throw error;
  }
}

/**
 * Pause a queue (admin operation)
 */
export async function pauseQueue(queueName: string): Promise<void> {
  try {
    await queueService.pauseQueue(queueName);
    logger.warn(`Queue ${queueName} paused by admin`);
  } catch (error) {
    logger.error(`Failed to pause queue ${queueName}`, { error });
    throw error;
  }
}

/**
 * Resume a queue (admin operation)
 */
export async function resumeQueue(queueName: string): Promise<void> {
  try {
    await queueService.resumeQueue(queueName);
    logger.info(`Queue ${queueName} resumed by admin`);
  } catch (error) {
    logger.error(`Failed to resume queue ${queueName}`, { error });
    throw error;
  }
}

/**
 * Clean a queue (admin operation)
 */
export async function cleanQueue(
  queueName: string,
  type: 'completed' | 'failed' | 'active' | 'waiting' | 'delayed' = 'completed',
  grace: number = 0,
  limit: number = 100
): Promise<number> {
  try {
    const jobs = await queueService.cleanQueue(queueName, grace, limit, type);
    logger.info(`Cleaned ${jobs.length} ${type} jobs from queue ${queueName}`);
    return jobs.length;
  } catch (error) {
    logger.error(`Failed to clean queue ${queueName}`, { error, type });
    throw error;
  }
}

/**
 * Retry a specific job (admin operation)
 */
export async function retryJob(queueName: string, jobId: string): Promise<void> {
  try {
    await queueService.retryJob(queueName, jobId);
    logger.info(`Job ${jobId} retried in queue ${queueName}`);
  } catch (error) {
    logger.error(`Failed to retry job ${jobId} in queue ${queueName}`, { error });
    throw error;
  }
}

/**
 * Remove a specific job (admin operation)
 */
export async function removeJob(queueName: string, jobId: string): Promise<void> {
  try {
    await queueService.removeJob(queueName, jobId);
    logger.info(`Job ${jobId} removed from queue ${queueName}`);
  } catch (error) {
    logger.error(`Failed to remove job ${jobId} from queue ${queueName}`, { error });
    throw error;
  }
}

export { serverAdapter };
