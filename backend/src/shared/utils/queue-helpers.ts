import { JobScheduler, JobStatusChecker } from './job-scheduler';
import { logger } from '../../config/logger';

/**
 * High-level queue helper functions for common operations
 * These functions provide a simplified interface for scheduling jobs
 */

/**
 * Authentication & User Management Helpers
 */
export const AuthQueueHelpers = {
  /**
   * Send verification code via SMS
   */
  async sendVerificationCode(phone: string, code: string, userId?: string) {
    try {
      return await JobScheduler.scheduleVerificationSMS(phone, code, userId);
    } catch (error) {
      logger.error('Failed to send verification code', { error, phone, userId });
      throw error;
    }
  },

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(email: string, firstName: string, userId: string) {
    try {
      return await JobScheduler.scheduleWelcomeEmail(email, firstName, userId, {
        delay: 2000, // 2 second delay to ensure user creation is complete
      });
    } catch (error) {
      logger.error('Failed to send welcome email', { error, email, userId });
      throw error;
    }
  },

  /**
   * Send password reset code
   */
  async sendPasswordResetCode(phone: string, code: string, userId: string) {
    try {
      return await JobScheduler.scheduleSMS({
        type: 'verification',
        to: phone,
        message: `Your password reset code is: ${code}. Valid for 15 minutes.`,
        userId,
        priority: 'high',
      }, {
        priority: 1,
      });
    } catch (error) {
      logger.error('Failed to send password reset code', { error, phone, userId });
      throw error;
    }
  },
};

/**
 * Ride Management Helpers
 */
export const RideQueueHelpers = {
  /**
   * Handle new ride request
   */
  async handleNewRideRequest(rideId: string, pickupLatitude: number, pickupLongitude: number) {
    try {
      // Schedule driver matching immediately
      const matchingJob = await JobScheduler.scheduleDriverMatching(
        rideId,
        pickupLatitude,
        pickupLongitude
      );

      logger.info('Ride request processing started', {
        rideId,
        matchingJobId: matchingJob.id,
      });

      return { matchingJobId: matchingJob.id };
    } catch (error) {
      logger.error('Failed to handle new ride request', { error, rideId });
      throw error;
    }
  },

  /**
   * Handle ride completion
   */
  async handleRideCompletion(
    rideId: string,
    distance: number,
    duration: number,
    surgeMultiplier: number = 1
  ) {
    try {
      // Calculate fare first
      const fareJob = await JobScheduler.scheduleFareCalculation(
        rideId,
        distance,
        duration,
        surgeMultiplier
      );

      // Schedule ride completion processing (this will trigger payment)
      const completionJob = await JobScheduler.scheduleRideJob({
        type: 'complete_ride',
        rideId,
      }, {
        delay: 2000, // Wait 2 seconds for fare calculation
      });

      logger.info('Ride completion processing started', {
        rideId,
        fareJobId: fareJob.id,
        completionJobId: completionJob.id,
      });

      return {
        fareJobId: fareJob.id,
        completionJobId: completionJob.id,
      };
    } catch (error) {
      logger.error('Failed to handle ride completion', { error, rideId });
      throw error;
    }
  },

  /**
   * Handle ride cancellation
   */
  async handleRideCancellation(
    rideId: string,
    cancelledBy: 'CUSTOMER' | 'DRIVER' | 'SYSTEM',
    reason?: string,
    cancellationFee: number = 0
  ) {
    try {
      const cancellationJob = await JobScheduler.scheduleRideJob({
        type: 'cancel_ride',
        rideId,
        data: {
          cancelledBy,
          reason,
          cancellationFee,
        },
      });

      logger.info('Ride cancellation processing started', {
        rideId,
        cancelledBy,
        reason,
        jobId: cancellationJob.id,
      });

      return { cancellationJobId: cancellationJob.id };
    } catch (error) {
      logger.error('Failed to handle ride cancellation', { error, rideId });
      throw error;
    }
  },

  /**
   * Send ride status update notifications
   */
  async sendRideStatusUpdate(
    rideId: string,
    status: string,
    customerPhone: string,
    customerUserId: string,
    driverUserId?: string
  ) {
    try {
      const jobs = [];

      // Send SMS to customer
      jobs.push(
        JobScheduler.scheduleRideNotificationSMS(
          customerPhone,
          `Your ride is ${status.toLowerCase()}. Track your ride in the app.`,
          rideId,
          customerUserId
        )
      );

      // Send push notification to customer
      jobs.push(
        JobScheduler.schedulePushNotification(
          customerUserId,
          'Ride Update',
          `Your ride is ${status.toLowerCase()}`,
          { rideId, status },
          { priority: 'high' }
        )
      );

      // Send notification to driver if available
      if (driverUserId) {
        jobs.push(
          JobScheduler.schedulePushNotification(
            driverUserId,
            'Ride Update',
            `Ride status updated to ${status.toLowerCase()}`,
            { rideId, status },
            { priority: 'high' }
          )
        );
      }

      const scheduledJobs = await Promise.all(jobs);

      logger.info('Ride status notifications sent', {
        rideId,
        status,
        jobIds: scheduledJobs.map(job => job.id),
      });

      return scheduledJobs;
    } catch (error) {
      logger.error('Failed to send ride status updates', { error, rideId, status });
      throw error;
    }
  },
};

/**
 * Delivery Management Helpers
 */
export const DeliveryQueueHelpers = {
  /**
   * Handle new delivery request
   */
  async handleNewDeliveryRequest(
    deliveryId: string,
    pickupLatitude: number,
    pickupLongitude: number,
    packageType: string,
    packageWeight: number,
    priority: string = 'STANDARD'
  ) {
    try {
      // Calculate delivery fee first
      const feeJob = await JobScheduler.scheduleDeliveryJob({
        type: 'calculate_delivery_fee',
        deliveryId,
        data: {
          packageType,
          packageWeight,
          priority,
          distance: 0, // Will be calculated by processor
        },
      });

      // Schedule courier assignment
      const assignmentJob = await JobScheduler.scheduleCourierAssignment(
        deliveryId,
        pickupLatitude,
        pickupLongitude,
        { delay: 1000 } // Wait 1 second for fee calculation
      );

      logger.info('Delivery request processing started', {
        deliveryId,
        feeJobId: feeJob.id,
        assignmentJobId: assignmentJob.id,
      });

      return {
        feeJobId: feeJob.id,
        assignmentJobId: assignmentJob.id,
      };
    } catch (error) {
      logger.error('Failed to handle new delivery request', { error, deliveryId });
      throw error;
    }
  },

  /**
   * Handle delivery completion
   */
  async handleDeliveryCompletion(deliveryId: string, proofOfDelivery?: string) {
    try {
      const completionJob = await JobScheduler.scheduleDeliveryJob({
        type: 'handle_delivery_completion',
        deliveryId,
        data: { proofOfDelivery },
      });

      logger.info('Delivery completion processing started', {
        deliveryId,
        jobId: completionJob.id,
      });

      return { completionJobId: completionJob.id };
    } catch (error) {
      logger.error('Failed to handle delivery completion', { error, deliveryId });
      throw error;
    }
  },
};

/**
 * Payment Management Helpers
 */
export const PaymentQueueHelpers = {
  /**
   * Process ride payment
   */
  async processRidePayment(
    rideId: string,
    amount: number,
    userId: string,
    paymentMethod: string = 'card'
  ) {
    try {
      const paymentJob = await JobScheduler.scheduleRidePayment(
        rideId,
        amount,
        userId,
        paymentMethod
      );

      logger.info('Ride payment processing started', {
        rideId,
        amount,
        userId,
        jobId: paymentJob.id,
      });

      return { paymentJobId: paymentJob.id };
    } catch (error) {
      logger.error('Failed to process ride payment', { error, rideId, amount });
      throw error;
    }
  },

  /**
   * Process refund
   */
  async processRefund(paymentId: string, amount: number, reason: string) {
    try {
      const refundJob = await JobScheduler.scheduleRefund(paymentId, amount, reason);

      logger.info('Refund processing started', {
        paymentId,
        amount,
        reason,
        jobId: refundJob.id,
      });

      return { refundJobId: refundJob.id };
    } catch (error) {
      logger.error('Failed to process refund', { error, paymentId, amount });
      throw error;
    }
  },

  /**
   * Schedule driver payout
   */
  async scheduleDriverPayout(driverId: string, amount: number, bankAccount?: any) {
    try {
      const payoutJob = await JobScheduler.schedulePaymentJob({
        type: 'driver_payout',
        driverId,
        amount,
        metadata: { bankAccount },
      });

      logger.info('Driver payout scheduled', {
        driverId,
        amount,
        jobId: payoutJob.id,
      });

      return { payoutJobId: payoutJob.id };
    } catch (error) {
      logger.error('Failed to schedule driver payout', { error, driverId, amount });
      throw error;
    }
  },
};

/**
 * Notification Helpers
 */
export const NotificationQueueHelpers = {
  /**
   * Send emergency notification
   */
  async sendEmergencyNotification(
    userIds: string[],
    title: string,
    message: string,
    data?: Record<string, any>
  ) {
    try {
      const jobs = await JobScheduler.scheduleBatchNotifications(
        userIds,
        title,
        message,
        data,
        { batchSize: 50 } // Smaller batches for urgent notifications
      );

      logger.warn('Emergency notifications scheduled', {
        userCount: userIds.length,
        title,
        jobCount: jobs.length,
      });

      return jobs;
    } catch (error) {
      logger.error('Failed to send emergency notifications', { error, userIds: userIds.length });
      throw error;
    }
  },

  /**
   * Send promotional notification
   */
  async sendPromotionalNotification(
    userIds: string[],
    title: string,
    message: string,
    data?: Record<string, any>,
    scheduleTime?: Date
  ) {
    try {
      const delay = scheduleTime ? scheduleTime.getTime() - Date.now() : 0;
      
      const jobs = await JobScheduler.scheduleBatchNotifications(
        userIds,
        title,
        message,
        data,
        { 
          batchSize: 200, // Larger batches for promotions
          delay: Math.max(delay, 0)
        }
      );

      logger.info('Promotional notifications scheduled', {
        userCount: userIds.length,
        title,
        scheduleTime,
        jobCount: jobs.length,
      });

      return jobs;
    } catch (error) {
      logger.error('Failed to send promotional notifications', { error, userIds: userIds.length });
      throw error;
    }
  },
};

/**
 * Admin & System Helpers
 */
export const SystemQueueHelpers = {
  /**
   * Schedule system maintenance notification
   */
  async scheduleMaintenanceNotification(
    maintenanceTime: Date,
    duration: number,
    affectedServices: string[]
  ) {
    try {
      const notificationTime = new Date(maintenanceTime.getTime() - 30 * 60 * 1000); // 30 minutes before
      const delay = notificationTime.getTime() - Date.now();

      if (delay <= 0) {
        throw new Error('Maintenance notification time must be in the future');
      }

      const job = await JobScheduler.scheduleBroadcastNotification(
        'Scheduled Maintenance',
        `System maintenance scheduled for ${maintenanceTime.toLocaleString()}. Duration: ${duration} minutes.`,
        {
          maintenanceTime: maintenanceTime.toISOString(),
          duration,
          affectedServices,
        },
        'all_users',
        { delay }
      );

      logger.info('Maintenance notification scheduled', {
        maintenanceTime,
        notificationTime,
        duration,
        affectedServices,
        jobId: job.id,
      });

      return job;
    } catch (error) {
      logger.error('Failed to schedule maintenance notification', { error });
      throw error;
    }
  },

  /**
   * Get queue health status
   */
  async getQueueHealthStatus() {
    try {
      const stats = await JobStatusChecker.getJobProgress('health', 'system-check');
      return stats;
    } catch (error) {
      logger.error('Failed to get queue health status', { error });
      return { status: 'unhealthy', error: error instanceof Error ? error.message : String(error) };
    }
  },
};

/**
 * Utility function to wait for multiple jobs
 */
export async function waitForJobs(
  jobs: Array<{ queueName: string; jobId: string }>,
  timeoutMs: number = 30000
): Promise<any[]> {
  try {
    const promises = jobs.map(({ queueName, jobId }) =>
      JobStatusChecker.waitForJobCompletion(queueName, jobId, timeoutMs)
    );

    const results = await Promise.all(promises);
    
    logger.info('All jobs completed', {
      jobCount: jobs.length,
      timeoutMs,
    });

    return results;
  } catch (error) {
    logger.error('Error waiting for jobs', { error, jobs });
    throw error;
  }
}

/**
 * Utility function to check job statuses
 */
export async function checkJobStatuses(
  jobs: Array<{ queueName: string; jobId: string }>
): Promise<any[]> {
  try {
    const promises = jobs.map(({ queueName, jobId }) =>
      JobStatusChecker.getJobProgress(queueName, jobId)
    );

    const statuses = await Promise.all(promises);
    
    return statuses;
  } catch (error) {
    logger.error('Error checking job statuses', { error, jobs });
    throw error;
  }
}
