import { queueService } from '../../config/queues';
import { QUEUE_NAMES } from '../../config/queues';
import { logger } from '../../config/logger';
import { 
  SMSJobData,
  NotificationJobData,
  EmailJobData,
  RideJobData,
  PaymentJobData,
  DeliveryJobData 
} from '../processors';

/**
 * Job Scheduler Utility
 * Provides convenient methods for scheduling various types of background jobs
 */
export class JobScheduler {
  /**
   * SMS Job Scheduling
   */
  static async scheduleSMS(data: SMSJobData, options?: {
    delay?: number;
    priority?: number;
    attempts?: number;
  }) {
    try {
      const job = await queueService.addJob(
        QUEUE_NAMES.SMS,
        data.type,
        data,
        {
          priority: options?.priority || (data.priority === 'high' ? 1 : 5),
          delay: options?.delay,
          attempts: options?.attempts || 5,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        }
      );

      logger.info('SMS job scheduled', {
        jobId: job.id,
        type: data.type,
        to: data.to.replace(/(\d{3})\d{7}(\d{3})/, '$1*******$2'),
      });

      return job;
    } catch (error) {
      logger.error('Failed to schedule SMS job', { error, data });
      throw error;
    }
  }

  /**
   * Schedule verification SMS
   */
  static async scheduleVerificationSMS(
    phone: string,
    code: string,
    userId?: string,
    options?: { delay?: number }
  ) {
    return this.scheduleSMS({
      type: 'verification',
      to: phone,
      message: `Your verification code is: ${code}. Valid for 10 minutes.`,
      priority: 'high',
      userId,
    }, {
      priority: 1, // High priority
      delay: options?.delay,
    });
  }

  /**
   * Schedule ride notification SMS
   */
  static async scheduleRideNotificationSMS(
    phone: string,
    message: string,
    rideId: string,
    userId: string,
    options?: { delay?: number }
  ) {
    return this.scheduleSMS({
      type: 'notification',
      to: phone,
      message,
      rideId,
      userId,
      priority: 'high',
    }, {
      priority: 2,
      delay: options?.delay,
    });
  }

  /**
   * Notification Job Scheduling
   */
  static async scheduleNotification(data: NotificationJobData, options?: {
    delay?: number;
    priority?: number;
  }) {
    try {
      const job = await queueService.addJob(
        QUEUE_NAMES.NOTIFICATION,
        data.type,
        data,
        {
          priority: options?.priority || (data.priority === 'high' ? 1 : 5),
          delay: options?.delay,
        }
      );

      logger.info('Notification job scheduled', {
        jobId: job.id,
        type: data.type,
        userId: data.userId,
        userCount: data.userIds?.length,
        title: data.title,
      });

      return job;
    } catch (error) {
      logger.error('Failed to schedule notification job', { error, data });
      throw error;
    }
  }

  /**
   * Schedule push notification to single user
   */
  static async schedulePushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
    options?: { delay?: number; priority?: 'high' | 'normal' }
  ) {
    return this.scheduleNotification({
      type: 'push',
      userId,
      title,
      body,
      data,
      priority: options?.priority || 'normal',
    }, {
      delay: options?.delay,
      priority: options?.priority === 'high' ? 1 : 5,
    });
  }

  /**
   * Schedule broadcast notification
   */
  static async scheduleBroadcastNotification(
    title: string,
    body: string,
    data?: Record<string, any>,
    topic?: string,
    options?: { delay?: number }
  ) {
    return this.scheduleNotification({
      type: 'broadcast',
      title,
      body,
      data,
      metadata: { topic },
    }, {
      delay: options?.delay,
    });
  }

  /**
   * Email Job Scheduling
   */
  static async scheduleEmail(data: EmailJobData, options?: {
    delay?: number;
    priority?: number;
  }) {
    try {
      const job = await queueService.addJob(
        QUEUE_NAMES.EMAIL,
        data.type,
        data,
        {
          priority: options?.priority || 5,
          delay: options?.delay,
        }
      );

      logger.info('Email job scheduled', {
        jobId: job.id,
        type: data.type,
        to: Array.isArray(data.to) ? `${data.to.length} recipients` : data.to,
        subject: data.subject,
      });

      return job;
    } catch (error) {
      logger.error('Failed to schedule email job', { error, data });
      throw error;
    }
  }

  /**
   * Schedule welcome email
   */
  static async scheduleWelcomeEmail(
    email: string,
    userName: string,
    userId: string,
    options?: { delay?: number }
  ) {
    return this.scheduleEmail({
      type: 'transactional',
      to: email,
      subject: 'Welcome to Ride Deliva!',
      templateId: 'welcome_email',
      variables: {
        userName,
        loginUrl: `${process.env.CLIENT_URL}/login`,
        supportUrl: `${process.env.CLIENT_URL}/support`,
      },
      userId,
    }, {
      delay: options?.delay,
    });
  }

  /**
   * Schedule receipt email
   */
  static async scheduleReceiptEmail(
    email: string,
    userName: string,
    rideId: string,
    amount: number,
    userId: string,
    options?: { delay?: number }
  ) {
    return this.scheduleEmail({
      type: 'receipt',
      to: email,
      subject: 'Your Ride Receipt',
      templateId: 'ride_receipt',
      variables: {
        userName,
        rideId,
        amount: (amount / 100).toFixed(2), // Convert kobo to naira
        date: new Date().toLocaleDateString(),
      },
      rideId,
      userId,
    }, {
      delay: options?.delay,
    });
  }

  /**
   * Ride Job Scheduling
   */
  static async scheduleRideJob(data: RideJobData, options?: {
    delay?: number;
    priority?: number;
  }) {
    try {
      const job = await queueService.addJob(
        QUEUE_NAMES.RIDE,
        data.type,
        data,
        {
          priority: options?.priority || 3, // Default medium priority
          delay: options?.delay,
        }
      );

      logger.info('Ride job scheduled', {
        jobId: job.id,
        type: data.type,
        rideId: data.rideId,
        userId: data.userId,
        driverId: data.driverId,
      });

      return job;
    } catch (error) {
      logger.error('Failed to schedule ride job', { error, data });
      throw error;
    }
  }

  /**
   * Schedule driver matching
   */
  static async scheduleDriverMatching(
    rideId: string,
    pickupLatitude: number,
    pickupLongitude: number,
    options?: { delay?: number; maxDistance?: number }
  ) {
    return this.scheduleRideJob({
      type: 'match_driver',
      rideId,
      data: {
        pickupLatitude,
        pickupLongitude,
        maxDistance: options?.maxDistance || 5000,
      },
    }, {
      priority: 1, // High priority for driver matching
      delay: options?.delay,
    });
  }

  /**
   * Schedule fare calculation
   */
  static async scheduleFareCalculation(
    rideId: string,
    distance: number,
    duration: number,
    surgeMultiplier?: number,
    options?: { delay?: number }
  ) {
    return this.scheduleRideJob({
      type: 'calculate_fare',
      rideId,
      data: {
        distance,
        duration,
        surgeMultiplier,
      },
    }, {
      delay: options?.delay,
    });
  }

  /**
   * Payment Job Scheduling
   */
  static async schedulePaymentJob(data: PaymentJobData, options?: {
    delay?: number;
    priority?: number;
  }) {
    try {
      const job = await queueService.addJob(
        QUEUE_NAMES.PAYMENT,
        data.type,
        data,
        {
          priority: options?.priority || 2, // High priority for payments
          delay: options?.delay,
        }
      );

      logger.info('Payment job scheduled', {
        jobId: job.id,
        type: data.type,
        amount: data.amount,
        rideId: data.rideId,
        userId: data.userId,
      });

      return job;
    } catch (error) {
      logger.error('Failed to schedule payment job', { error, data });
      throw error;
    }
  }

  /**
   * Schedule ride payment
   */
  static async scheduleRidePayment(
    rideId: string,
    amount: number,
    userId: string,
    paymentMethod?: string,
    options?: { delay?: number }
  ) {
    return this.schedulePaymentJob({
      type: 'process_ride_payment',
      rideId,
      amount,
      userId,
      paymentMethod: paymentMethod as any,
    }, {
      priority: 1, // Highest priority for payments
      delay: options?.delay,
    });
  }

  /**
   * Schedule refund
   */
  static async scheduleRefund(
    paymentId: string,
    amount: number,
    reason: string,
    options?: { delay?: number }
  ) {
    return this.schedulePaymentJob({
      type: 'process_refund',
      paymentId,
      amount,
      metadata: { reason },
    }, {
      priority: 1,
      delay: options?.delay,
    });
  }

  /**
   * Delivery Job Scheduling
   */
  static async scheduleDeliveryJob(data: DeliveryJobData, options?: {
    delay?: number;
    priority?: number;
  }) {
    try {
      const job = await queueService.addJob(
        QUEUE_NAMES.DELIVERY,
        data.type,
        data,
        {
          priority: options?.priority || 3,
          delay: options?.delay,
        }
      );

      logger.info('Delivery job scheduled', {
        jobId: job.id,
        type: data.type,
        deliveryId: data.deliveryId,
        userId: data.userId,
        courierId: data.courierId,
      });

      return job;
    } catch (error) {
      logger.error('Failed to schedule delivery job', { error, data });
      throw error;
    }
  }

  /**
   * Schedule courier assignment
   */
  static async scheduleCourierAssignment(
    deliveryId: string,
    pickupLatitude: number,
    pickupLongitude: number,
    options?: { delay?: number; maxDistance?: number }
  ) {
    return this.scheduleDeliveryJob({
      type: 'assign_courier',
      deliveryId,
      data: {
        pickupLatitude,
        pickupLongitude,
        maxDistance: options?.maxDistance || 7000,
      },
    }, {
      priority: 1,
      delay: options?.delay,
    });
  }

  /**
   * Recurring Job Scheduling
   */
  static async scheduleRecurringJob(
    queueName: string,
    jobName: string,
    data: any,
    cronPattern: string,
    options?: {
      limit?: number;
      endDate?: Date;
    }
  ) {
    try {
      const job = await queueService.addRepeatableJob(
        queueName,
        jobName,
        data,
        {
          pattern: cronPattern,
          limit: options?.limit,
          endDate: options?.endDate,
        }
      );

      logger.info('Recurring job scheduled', {
        jobId: job.id,
        queueName,
        jobName,
        cronPattern,
        limit: options?.limit,
        endDate: options?.endDate,
      });

      return job;
    } catch (error) {
      logger.error('Failed to schedule recurring job', { error });
      throw error;
    }
  }

  /**
   * Schedule daily reports (example recurring job)
   */
  static async scheduleDailyReports() {
    return this.scheduleRecurringJob(
      QUEUE_NAMES.EMAIL,
      'daily_admin_report',
      {
        type: 'system',
        to: process.env.ADMIN_EMAIL || 'admin@ridedeliva.com',
        subject: 'Daily Operations Report',
        templateId: 'daily_report',
      },
      '0 8 * * *', // Every day at 8 AM
    );
  }

  /**
   * Batch Job Scheduling
   */
  static async scheduleBatchJobs(
    queueName: string,
    jobs: Array<{
      name: string;
      data: any;
      options?: any;
    }>
  ) {
    try {
      const scheduledJobs = [];

      for (const jobData of jobs) {
        const job = await queueService.addJob(
          queueName,
          jobData.name,
          jobData.data,
          jobData.options
        );
        scheduledJobs.push(job);
      }

      logger.info('Batch jobs scheduled', {
        queueName,
        jobCount: jobs.length,
        jobIds: scheduledJobs.map(job => job.id),
      });

      return scheduledJobs;
    } catch (error) {
      logger.error('Failed to schedule batch jobs', { error });
      throw error;
    }
  }

  /**
   * Schedule batch notifications
   */
  static async scheduleBatchNotifications(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, any>,
    options?: { batchSize?: number; delay?: number }
  ) {
    const batchSize = options?.batchSize || 100;
    const batches = [];

    // Split userIds into batches
    for (let i = 0; i < userIds.length; i += batchSize) {
      batches.push(userIds.slice(i, i + batchSize));
    }

    const jobs = batches.map((batch, index) => ({
      name: 'push',
      data: {
        type: 'push' as const,
        userIds: batch,
        title,
        body,
        data,
      },
      options: {
        delay: (options?.delay || 0) + (index * 1000), // Stagger batches by 1 second
      },
    }));

    return this.scheduleBatchJobs(QUEUE_NAMES.NOTIFICATION, jobs);
  }
}

/**
 * Job Status Checker Utility
 */
class JobStatusChecker {
  /**
   * Wait for job completion
   */
  static async waitForJobCompletion(
    queueName: string,
    jobId: string,
    timeoutMs: number = 30000
  ): Promise<any> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const job = await queueService.getJob(queueName, jobId);
        
        if (!job) {
          throw new Error(`Job ${jobId} not found`);
        }

        if (job.finishedOn) {
          if (job.failedReason) {
            throw new Error(`Job failed: ${job.failedReason}`);
          }
          return job.returnvalue;
        }

        // Wait 1 second before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        logger.error('Error checking job status', { error, jobId, queueName });
        throw error;
      }
    }

    throw new Error(`Job ${jobId} did not complete within ${timeoutMs}ms`);
  }

  /**
   * Get job progress
   */
  static async getJobProgress(queueName: string, jobId: string): Promise<{
    progress: number;
    status: string;
    data?: any;
  }> {
    try {
      const job = await queueService.getJob(queueName, jobId);
      
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      let status = 'waiting';
      if (job.processedOn && !job.finishedOn) {
        status = 'processing';
      } else if (job.finishedOn && !job.failedReason) {
        status = 'completed';
      } else if (job.failedReason) {
        status = 'failed';
      }

      return {
        progress: typeof job.progress === 'number' ? job.progress : 0,
        status,
        data: {
          id: job.id,
          name: job.name,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          failedReason: job.failedReason,
          returnvalue: job.returnvalue,
        },
      };
    } catch (error) {
      logger.error('Error getting job progress', { error, jobId, queueName });
      throw error;
    }
  }
}

// Export both classes
export { JobScheduler as default, JobStatusChecker };
