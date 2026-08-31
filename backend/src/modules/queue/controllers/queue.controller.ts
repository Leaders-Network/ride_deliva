import { Request, Response } from 'express';
import {
  getQueueStatistics,
  pauseQueue,
  resumeQueue,
  cleanQueue,
  retryJob,
  removeJob,
} from '../../../config/bull-board';
import { queueService } from '../../../config/queues';
import { logger } from '../../../config/logger';
import { ApiResponse } from '../../../shared/utils/response';
import { ValidationError } from '../../../shared/utils/validation';

/**
 * Queue Management Controller
 * Provides API endpoints for queue administration
 */
export class QueueController {
  /**
   * Get overall queue statistics
   */
  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const stats = await getQueueStatistics();
      
      ApiResponse.success(res, stats, 'Queue statistics retrieved successfully');
    } catch (error) {
      logger.error('Failed to get queue statistics', { error });
      ApiResponse.error(res, 'Failed to get queue statistics', 500);
    }
  }

  /**
   * Get detailed statistics for a specific queue
   */
  async getQueueDetails(req: Request, res: Response): Promise<void> {
    try {
      const { queueName } = req.params;

      if (!queueName) {
        throw new ValidationError('Queue name is required');
      }

      const stats = await queueService.getQueueStats(queueName);
      
      ApiResponse.success(res, stats, `Statistics for queue ${queueName} retrieved successfully`);
    } catch (error) {
      if (error instanceof ValidationError) {
        ApiResponse.error(res, error.message, 400);
        return;
      }

      logger.error('Failed to get queue details', { error, queueName: req.params.queueName });
      ApiResponse.error(res, 'Failed to get queue details', 500);
    }
  }

  /**
   * Pause a queue
   */
  async pauseQueue(req: Request, res: Response): Promise<void> {
    try {
      const { queueName } = req.params;

      if (!queueName) {
        throw new ValidationError('Queue name is required');
      }

      await pauseQueue(queueName);
      
      logger.info(`Queue ${queueName} paused by admin`, {
        adminId: req.user?.id,
        adminEmail: req.user?.email,
      });
      
      ApiResponse.success(res, { queueName, status: 'paused' }, `Queue ${queueName} paused successfully`);
    } catch (error) {
      if (error instanceof ValidationError) {
        ApiResponse.error(res, error.message, 400);
        return;
      }

      logger.error('Failed to pause queue', { error, queueName: req.params.queueName });
      ApiResponse.error(res, 'Failed to pause queue', 500);
    }
  }

  /**
   * Resume a queue
   */
  async resumeQueue(req: Request, res: Response): Promise<void> {
    try {
      const { queueName } = req.params;

      if (!queueName) {
        throw new ValidationError('Queue name is required');
      }

      await resumeQueue(queueName);
      
      logger.info(`Queue ${queueName} resumed by admin`, {
        adminId: req.user?.id,
        adminEmail: req.user?.email,
      });
      
      ApiResponse.success(res, { queueName, status: 'resumed' }, `Queue ${queueName} resumed successfully`);
    } catch (error) {
      if (error instanceof ValidationError) {
        ApiResponse.error(res, error.message, 400);
        return;
      }

      logger.error('Failed to resume queue', { error, queueName: req.params.queueName });
      ApiResponse.error(res, 'Failed to resume queue', 500);
    }
  }

  /**
   * Clean a queue
   */
  async cleanQueue(req: Request, res: Response): Promise<void> {
    try {
      const { queueName } = req.params;
      const { type = 'completed', grace = 0, limit = 100 } = req.query;

      if (!queueName) {
        throw new ValidationError('Queue name is required');
      }

      const validTypes = ['completed', 'failed', 'active', 'waiting', 'delayed'];
      if (!validTypes.includes(type as string)) {
        throw new ValidationError(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
      }

      const graceNum = parseInt(grace as string, 10) || 0;
      const limitNum = parseInt(limit as string, 10) || 100;

      if (limitNum > 1000) {
        throw new ValidationError('Limit cannot exceed 1000');
      }

      const cleanedCount = await cleanQueue(
        queueName,
        type as 'completed' | 'failed' | 'active' | 'waiting' | 'delayed',
        graceNum,
        limitNum
      );

      logger.info(`Queue ${queueName} cleaned by admin`, {
        adminId: req.user?.id,
        adminEmail: req.user?.email,
        type,
        cleanedCount,
      });
      
      ApiResponse.success(
        res,
        { queueName, type, cleanedCount, grace: graceNum, limit: limitNum },
        `Cleaned ${cleanedCount} ${type} jobs from queue ${queueName}`
      );
    } catch (error) {
      if (error instanceof ValidationError) {
        ApiResponse.error(res, error.message, 400);
        return;
      }

      logger.error('Failed to clean queue', { error, queueName: req.params.queueName });
      ApiResponse.error(res, 'Failed to clean queue', 500);
    }
  }

  /**
   * Retry a specific job
   */
  async retryJob(req: Request, res: Response): Promise<void> {
    try {
      const { queueName, jobId } = req.params;

      if (!queueName || !jobId) {
        throw new ValidationError('Queue name and job ID are required');
      }

      await retryJob(queueName, jobId);
      
      logger.info(`Job ${jobId} retried by admin`, {
        queueName,
        jobId,
        adminId: req.user?.id,
        adminEmail: req.user?.email,
      });
      
      ApiResponse.success(res, { queueName, jobId, status: 'retried' }, `Job ${jobId} retried successfully`);
    } catch (error) {
      if (error instanceof ValidationError) {
        ApiResponse.error(res, error.message, 400);
        return;
      }

      logger.error('Failed to retry job', {
        error,
        queueName: req.params.queueName,
        jobId: req.params.jobId,
      });
      ApiResponse.error(res, 'Failed to retry job', 500);
    }
  }

  /**
   * Remove a specific job
   */
  async removeJob(req: Request, res: Response): Promise<void> {
    try {
      const { queueName, jobId } = req.params;

      if (!queueName || !jobId) {
        throw new ValidationError('Queue name and job ID are required');
      }

      await removeJob(queueName, jobId);
      
      logger.warn(`Job ${jobId} removed by admin`, {
        queueName,
        jobId,
        adminId: req.user?.id,
        adminEmail: req.user?.email,
      });
      
      ApiResponse.success(res, { queueName, jobId, status: 'removed' }, `Job ${jobId} removed successfully`);
    } catch (error) {
      if (error instanceof ValidationError) {
        ApiResponse.error(res, error.message, 400);
        return;
      }

      logger.error('Failed to remove job', {
        error,
        queueName: req.params.queueName,
        jobId: req.params.jobId,
      });
      ApiResponse.error(res, 'Failed to remove job', 500);
    }
  }

  /**
   * Add a test job to a queue (development/testing)
   */
  async addTestJob(req: Request, res: Response): Promise<void> {
    try {
      if (process.env.NODE_ENV === 'production') {
        ApiResponse.error(res, 'Test jobs are not allowed in production', 403);
        return;
      }

      const { queueName } = req.params;
      const { jobName, data = {}, options = {} } = req.body;

      if (!queueName || !jobName) {
        throw new ValidationError('Queue name and job name are required');
      }

      const job = await queueService.addJob(queueName, jobName, data, options);
      
      logger.info(`Test job added by admin`, {
        queueName,
        jobName,
        jobId: job.id,
        adminId: req.user?.id,
        adminEmail: req.user?.email,
      });
      
      ApiResponse.success(
        res,
        { queueName, jobName, jobId: job.id, data, options },
        `Test job ${job.id} added to queue ${queueName}`
      );
    } catch (error) {
      if (error instanceof ValidationError) {
        ApiResponse.error(res, error.message, 400);
        return;
      }

      logger.error('Failed to add test job', {
        error,
        queueName: req.params.queueName,
        body: req.body,
      });
      ApiResponse.error(res, 'Failed to add test job', 500);
    }
  }

  /**
   * Get job details by ID
   */
  async getJob(req: Request, res: Response): Promise<void> {
    try {
      const { queueName, jobId } = req.params;

      if (!queueName || !jobId) {
        throw new ValidationError('Queue name and job ID are required');
      }

      const job = await queueService.getJob(queueName, jobId);
      
      if (!job) {
        ApiResponse.error(res, `Job ${jobId} not found in queue ${queueName}`, 404);
        return;
      }

      const jobData = {
        id: job.id,
        name: job.name,
        data: job.data,
        opts: job.opts,
        progress: job.progress,
        returnvalue: job.returnvalue,
        failedReason: job.failedReason,
        stacktrace: job.stacktrace,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        attemptsMade: job.attemptsMade,
      };
      
      ApiResponse.success(res, jobData, `Job ${jobId} details retrieved successfully`);
    } catch (error) {
      if (error instanceof ValidationError) {
        ApiResponse.error(res, error.message, 400);
        return;
      }

      logger.error('Failed to get job details', {
        error,
        queueName: req.params.queueName,
        jobId: req.params.jobId,
      });
      ApiResponse.error(res, 'Failed to get job details', 500);
    }
  }
}