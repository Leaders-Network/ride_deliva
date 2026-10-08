import { Queue, Worker, Job, QueueEvents, JobsOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { redis as redisClient } from '../../config/redis';
import { logger } from '../../config/logger';

export interface JobData {
  [key: string]: any;
}

export interface QueueConfig {
  name: string;
  defaultJobOptions?: JobsOptions;
  concurrency?: number;
  processor?: (job: Job) => Promise<any>;
}

export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
  duration?: number;
}

export class QueueService {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();
  private redis: Redis;

  constructor() {
    this.redis = redisClient;
  }

  /**
   * Create a new queue
   */
  createQueue(config: QueueConfig): Queue {
    if (this.queues.has(config.name)) {
      logger.warn(`Queue ${config.name} already exists`);
      return this.queues.get(config.name)!;
    }

    const queue = new Queue(config.name, {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        ...config.defaultJobOptions,
      },
    });

    // Create worker if processor is provided
    if (config.processor) {
      this.createWorker(config.name, config.processor, config.concurrency);
    }

    // Set up queue events
    this.setupQueueEvents(config.name, queue);

    this.queues.set(config.name, queue);
    logger.info(`Queue ${config.name} created successfully`);

    return queue;
  }

  /**
   * Create a worker for a queue
   */
  createWorker(
    queueName: string, 
    processor: (job: Job) => Promise<any>,
    concurrency: number = 5
  ): Worker {
    if (this.workers.has(queueName)) {
      logger.warn(`Worker for queue ${queueName} already exists`);
      return this.workers.get(queueName)!;
    }

    const worker = new Worker(queueName, async (job: Job) => {
      const startTime = Date.now();
      
      try {
        logger.info(`Processing job ${job.id} from queue ${queueName}`, {
          jobId: job.id,
          jobName: job.name,
          queueName,
          data: job.data,
        });

        const result = await processor(job);
        const duration = Date.now() - startTime;

        logger.info(`Job ${job.id} completed successfully`, {
          jobId: job.id,
          queueName,
          duration,
          result,
        });

        return { success: true, data: result, duration };
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Job ${job.id} failed`, {
          jobId: job.id,
          queueName,
          duration,
          error: error instanceof Error ? error.message : String(error),
        });

        throw error;
      }
    }, {
      connection: this.redis,
      concurrency,
      stalledInterval: 30000,
      maxStalledCount: 1,
    });

    // Set up worker events
    this.setupWorkerEvents(queueName, worker);

    this.workers.set(queueName, worker);
    logger.info(`Worker for queue ${queueName} created with concurrency ${concurrency}`);

    return worker;
  }

  /**
   * Set up queue events for monitoring
   */
  private setupQueueEvents(queueName: string, queue: Queue): void {
    const queueEvents = new QueueEvents(queueName, {
      connection: this.redis,
    });

    queueEvents.on('waiting', ({ jobId }) => {
      logger.debug(`Job ${jobId} is waiting in queue ${queueName}`);
    });

    queueEvents.on('active', ({ jobId, prev }) => {
      logger.debug(`Job ${jobId} is now active in queue ${queueName}`);
    });

    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      logger.debug(`Job ${jobId} completed in queue ${queueName}`, { returnvalue });
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.warn(`Job ${jobId} failed in queue ${queueName}`, { failedReason });
    });

    queueEvents.on('progress', ({ jobId, data }) => {
      logger.debug(`Job ${jobId} progress in queue ${queueName}`, { progress: data });
    });

    queueEvents.on('stalled', ({ jobId }) => {
      logger.warn(`Job ${jobId} stalled in queue ${queueName}`);
    });

    this.queueEvents.set(queueName, queueEvents);
  }

  /**
   * Set up worker events
   */
  private setupWorkerEvents(queueName: string, worker: Worker): void {
    worker.on('ready', () => {
      logger.info(`Worker for queue ${queueName} is ready`);
    });

    worker.on('error', (error) => {
      logger.error(`Worker error in queue ${queueName}`, { error: error.message });
    });

    worker.on('failed', (job, error) => {
      logger.error(`Job ${job?.id} failed in worker ${queueName}`, {
        error: error.message,
        jobData: job?.data,
      });
    });

    worker.on('stalled', (jobId) => {
      logger.warn(`Job ${jobId} stalled in worker ${queueName}`);
    });
  }

  /**
   * Add a job to a queue
   */
  async addJob(
    queueName: string,
    jobName: string,
    data: JobData,
    options?: JobsOptions
  ): Promise<Job> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.add(jobName, data, options);
    
    logger.info(`Job ${job.id} added to queue ${queueName}`, {
      jobId: job.id,
      jobName,
      queueName,
      data,
      options,
    });

    return job;
  }

  /**
   * Add a delayed job to a queue
   */
  async addDelayedJob(
    queueName: string,
    jobName: string,
    data: JobData,
    delay: number,
    options?: JobsOptions
  ): Promise<Job> {
    return this.addJob(queueName, jobName, data, {
      delay,
      ...options,
    });
  }

  /**
   * Add a scheduled job to a queue
   */
  async addScheduledJob(
    queueName: string,
    jobName: string,
    data: JobData,
    scheduleTime: Date,
    options?: JobsOptions
  ): Promise<Job> {
    const delay = scheduleTime.getTime() - Date.now();
    if (delay <= 0) {
      throw new Error('Schedule time must be in the future');
    }

    return this.addDelayedJob(queueName, jobName, data, delay, options);
  }

  /**
   * Add a repeatable job to a queue
   */
  async addRepeatableJob(
    queueName: string,
    jobName: string,
    data: JobData,
    repeatOptions: {
      pattern?: string; // Cron pattern
      every?: number; // Milliseconds
      limit?: number;
      endDate?: Date;
    },
    options?: JobsOptions
  ): Promise<Job> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.add(jobName, data, {
      repeat: repeatOptions,
      ...options,
    });

    logger.info(`Repeatable job ${job.id} added to queue ${queueName}`, {
      jobId: job.id,
      jobName,
      queueName,
      repeatOptions,
    });

    return job;
  }

  /**
   * Get a queue by name
   */
  getQueue(name: string): Queue | undefined {
    return this.queues.get(name);
  }

  /**
   * Get a worker by queue name
   */
  getWorker(queueName: string): Worker | undefined {
    return this.workers.get(queueName);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
      queue.isPaused(),
    ]);

    return {
      queueName,
      counts: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
      },
      paused,
    };
  }

  /**
   * Get all queue statistics
   */
  async getAllQueueStats() {
    const stats = [];
    
    for (const queueName of this.queues.keys()) {
      try {
        const queueStats = await this.getQueueStats(queueName);
        stats.push(queueStats);
      } catch (error) {
        logger.error(`Error getting stats for queue ${queueName}`, { error });
        stats.push({
          queueName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return stats;
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.pause();
    logger.info(`Queue ${queueName} paused`);
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.resume();
    logger.info(`Queue ${queueName} resumed`);
  }

  /**
   * Clean a queue
   */
  async cleanQueue(
    queueName: string,
    grace: number = 0,
    limit: number = 100,
    type: 'completed' | 'failed' | 'active' | 'waiting' | 'delayed' = 'completed'
  ): Promise<string[]> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    // Map waiting to wait for BullMQ compatibility
    const bullMQType = type === 'waiting' ? 'wait' : type;
    
    const jobs = await queue.clean(grace, limit, bullMQType);
    logger.info(`Cleaned ${Array.isArray(jobs) ? jobs.length : jobs} ${type} jobs from queue ${queueName}`);

    return Array.isArray(jobs) ? jobs : [];
  }

  /**
   * Get job by ID
   */
  async getJob(queueName: string, jobId: string): Promise<Job | undefined> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    return queue.getJob(jobId);
  }

  /**
   * Remove a job
   */
  async removeJob(queueName: string, jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found in queue ${queueName}`);
    }

    await job.remove();
    logger.info(`Job ${jobId} removed from queue ${queueName}`);
  }

  /**
   * Retry a failed job
   */
  async retryJob(queueName: string, jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found in queue ${queueName}`);
    }

    await job.retry();
    logger.info(`Job ${jobId} retried in queue ${queueName}`);
  }

  /**
   * Close all queues and workers
   */
  async close(): Promise<void> {
    logger.info('Closing all queues and workers...');

    // Close all workers
    for (const [name, worker] of this.workers) {
      try {
        await worker.close();
        logger.info(`Worker for queue ${name} closed`);
      } catch (error) {
        logger.error(`Error closing worker for queue ${name}`, { error });
      }
    }

    // Close all queue events
    for (const [name, queueEvents] of this.queueEvents) {
      try {
        await queueEvents.close();
        logger.info(`Queue events for ${name} closed`);
      } catch (error) {
        logger.error(`Error closing queue events for ${name}`, { error });
      }
    }

    // Close all queues
    for (const [name, queue] of this.queues) {
      try {
        await queue.close();
        logger.info(`Queue ${name} closed`);
      } catch (error) {
        logger.error(`Error closing queue ${name}`, { error });
      }
    }

    this.queues.clear();
    this.workers.clear();
    this.queueEvents.clear();

    logger.info('All queues and workers closed');
  }
}

// Create a singleton instance
export const queueService = new QueueService();
