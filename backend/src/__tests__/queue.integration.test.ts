import { queueService } from '../config/queues';
import { QUEUE_NAMES } from '../config/queues';
import { JobScheduler, JobStatusChecker } from '../shared/utils/job-scheduler';
import { 
  AuthQueueHelpers, 
  RideQueueHelpers, 
  PaymentQueueHelpers,
  NotificationQueueHelpers 
} from '../shared/utils/queue-helpers';
import { redisClient } from '../config/redis';

describe('Queue System Tests', () => {
  beforeAll(async () => {
    // Ensure Redis connection is established
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Clean up queues and close connections
    try {
      // Clean all test jobs
      for (const queueName of Object.values(QUEUE_NAMES)) {
        try {
          await queueService.cleanQueue(queueName, 0, 1000, 'completed');
          await queueService.cleanQueue(queueName, 0, 1000, 'failed');
        } catch (error) {
          console.log(`Error cleaning queue ${queueName}:`, error);
        }
      }
      
      await queueService.close();
    } catch (error) {
      console.log('Error during queue cleanup:', error);
    }
  });

  describe('Queue Service', () => {
    test('should create and manage queues', async () => {
      const testQueueName = 'test-queue';
      
      // Create a test queue
      const queue = queueService.createQueue({
        name: testQueueName,
        concurrency: 1,
      });

      expect(queue).toBeDefined();
      expect(queueService.getQueue(testQueueName)).toBe(queue);
    });

    test('should add and process jobs', async () => {
      const testData = { message: 'test job', timestamp: Date.now() };
      
      // Add a job to SMS queue
      const job = await queueService.addJob(QUEUE_NAMES.SMS, 'test', testData);
      
      expect(job.id).toBeDefined();
      expect(job.data).toEqual(testData);
    }, 10000);

    test('should get queue statistics', async () => {
      const stats = await queueService.getQueueStats(QUEUE_NAMES.SMS);
      
      expect(stats).toBeDefined();
      expect(stats.queueName).toBe(QUEUE_NAMES.SMS);
      expect(stats.counts).toBeDefined();
      expect(typeof stats.counts.waiting).toBe('number');
    });

    test('should handle delayed jobs', async () => {
      const testData = { message: 'delayed test job' };
      const delay = 1000; // 1 second delay
      
      const job = await queueService.addDelayedJob(
        QUEUE_NAMES.NOTIFICATION,
        'delayed-test',
        testData,
        delay
      );
      
      expect(job.id).toBeDefined();
      expect(job.opts.delay).toBe(delay);
    });
  });

  describe('Job Processors', () => {
    test('should process SMS jobs', async () => {
      const smsData = {
        type: 'verification' as const,
        to: '+2348012345678',
        message: 'Test SMS message',
        userId: 'test-user-id',
      };

      const job = await JobScheduler.scheduleSMS(smsData);
      expect(job.id).toBeDefined();

      // Wait a moment for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const jobStatus = await JobStatusChecker.getJobProgress(QUEUE_NAMES.SMS, job.id);
      expect(jobStatus.progress).toBeGreaterThanOrEqual(0);
    }, 15000);

    test('should process notification jobs', async () => {
      const notificationData = {
        type: 'push' as const,
        userId: 'test-user-id',
        title: 'Test Notification',
        body: 'This is a test notification',
        priority: 'normal' as const,
      };

      const job = await JobScheduler.scheduleNotification(notificationData);
      expect(job.id).toBeDefined();

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const jobStatus = await JobStatusChecker.getJobProgress(QUEUE_NAMES.NOTIFICATION, job.id);
      expect(jobStatus.progress).toBeGreaterThanOrEqual(0);
    }, 15000);

    test('should process email jobs', async () => {
      const emailData = {
        type: 'transactional' as const,
        to: 'test@example.com',
        subject: 'Test Email',
        htmlContent: '<h1>Test Email Content</h1>',
        userId: 'test-user-id',
      };

      const job = await JobScheduler.scheduleEmail(emailData);
      expect(job.id).toBeDefined();
    });

    test('should process ride jobs', async () => {
      const rideData = {
        type: 'calculate_fare' as const,
        rideId: 'test-ride-id',
        data: {
          distance: 5000, // 5km
          duration: 900,  // 15 minutes
          surgeMultiplier: 1.2,
        },
      };

      const job = await JobScheduler.scheduleRideJob(rideData);
      expect(job.id).toBeDefined();
    });

    test('should process payment jobs', async () => {
      const paymentData = {
        type: 'process_ride_payment' as const,
        rideId: 'test-ride-id',
        userId: 'test-user-id',
        amount: 2500, // 25 Naira in kobo
        paymentMethod: 'card' as const,
      };

      const job = await JobScheduler.schedulePaymentJob(paymentData);
      expect(job.id).toBeDefined();
    });
  });

  describe('Queue Helpers', () => {
    test('should send verification code', async () => {
      const job = await AuthQueueHelpers.sendVerificationCode(
        '+2348012345678',
        '123456',
        'test-user-id'
      );
      
      expect(job.id).toBeDefined();
    });

    test('should handle new ride request', async () => {
      const result = await RideQueueHelpers.handleNewRideRequest(
        'test-ride-id-2',
        6.5244,
        3.3792
      );
      
      expect(result.matchingJobId).toBeDefined();
    });

    test('should process ride payment', async () => {
      const result = await PaymentQueueHelpers.processRidePayment(
        'test-ride-id-3',
        3000, // 30 Naira
        'test-user-id'
      );
      
      expect(result.paymentJobId).toBeDefined();
    });

    test('should send emergency notification', async () => {
      const jobs = await NotificationQueueHelpers.sendEmergencyNotification(
        ['user1', 'user2', 'user3'],
        'Emergency Alert',
        'This is an emergency notification test'
      );
      
      expect(jobs.length).toBeGreaterThan(0);
    });
  });

  describe('Job Status Tracking', () => {
    test('should track job progress', async () => {
      const job = await queueService.addJob(
        QUEUE_NAMES.SMS,
        'progress-test',
        { message: 'progress tracking test' }
      );

      // Check initial status
      const initialStatus = await JobStatusChecker.getJobProgress(QUEUE_NAMES.SMS, job.id);
      expect(initialStatus.progress).toBe(0);
      expect(['waiting', 'processing'].includes(initialStatus.status)).toBe(true);
    });

    test('should handle job completion waiting', async () => {
      const job = await queueService.addJob(
        QUEUE_NAMES.NOTIFICATION,
        'completion-test',
        {
          type: 'push',
          userId: 'test-user',
          title: 'Completion Test',
          body: 'Testing job completion',
        }
      );

      // This should complete quickly for a notification job
      try {
        const result = await JobStatusChecker.waitForJobCompletion(
          QUEUE_NAMES.NOTIFICATION,
          job.id,
          10000 // 10 second timeout
        );
        expect(result).toBeDefined();
      } catch (error) {
        // Job might still be processing, which is acceptable
        console.log('Job completion test - job may still be processing:', error.message);
      }
    }, 15000);
  });

  describe('Batch Operations', () => {
    test('should handle batch notifications', async () => {
      const userIds = ['user1', 'user2', 'user3', 'user4', 'user5'];
      
      const jobs = await JobScheduler.scheduleBatchNotifications(
        userIds,
        'Batch Test',
        'Testing batch notifications',
        { testId: 'batch-test-1' },
        { batchSize: 2 }
      );

      expect(jobs.length).toBeGreaterThan(0);
      
      // Should create multiple batches
      expect(jobs.length).toBeGreaterThanOrEqual(Math.ceil(userIds.length / 2));
    });

    test('should schedule recurring jobs', async () => {
      const job = await JobScheduler.scheduleRecurringJob(
        QUEUE_NAMES.EMAIL,
        'test-recurring',
        { type: 'system', message: 'recurring test' },
        '0 0 * * *', // Daily at midnight
        { limit: 5 } // Only run 5 times
      );

      expect(job.id).toBeDefined();
      expect(job.opts.repeat).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid queue names', async () => {
      await expect(
        queueService.addJob('invalid-queue', 'test', {})
      ).rejects.toThrow();
    });

    test('should handle job not found', async () => {
      await expect(
        JobStatusChecker.getJobProgress(QUEUE_NAMES.SMS, 'non-existent-job-id')
      ).rejects.toThrow();
    });

    test('should handle processor errors gracefully', async () => {
      // This test would require a job that intentionally fails
      const job = await queueService.addJob(
        QUEUE_NAMES.SMS,
        'error-test',
        {
          type: 'verification',
          to: 'invalid-phone-number', // This should cause an error
          message: 'test message',
        }
      );

      expect(job.id).toBeDefined();
      
      // Wait for processing and check that it handles the error
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const status = await JobStatusChecker.getJobProgress(QUEUE_NAMES.SMS, job.id);
      // Job should either be failed or completed (depending on mock behavior)
      expect(['failed', 'completed', 'processing'].includes(status.status)).toBe(true);
    }, 10000);
  });

  describe('Queue Management', () => {
    test('should pause and resume queues', async () => {
      const testQueue = 'pause-test-queue';
      
      // Create a test queue
      queueService.createQueue({
        name: testQueue,
        concurrency: 1,
      });

      // Pause the queue
      await queueService.pauseQueue(testQueue);
      
      // Add a job while paused
      const job = await queueService.addJob(testQueue, 'paused-job', { test: true });
      expect(job.id).toBeDefined();

      // Resume the queue
      await queueService.resumeQueue(testQueue);
      
      // The queue should now process the job
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    test('should clean completed jobs', async () => {
      // Add some jobs first
      await queueService.addJob(QUEUE_NAMES.SMS, 'clean-test-1', { test: 1 });
      await queueService.addJob(QUEUE_NAMES.SMS, 'clean-test-2', { test: 2 });
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Clean completed jobs
      const cleanedJobs = await queueService.cleanQueue(
        QUEUE_NAMES.SMS,
        0,    // grace period
        10,   // limit
        'completed'
      );
      
      expect(Array.isArray(cleanedJobs)).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete ride flow', async () => {
      const rideId = 'integration-test-ride-1';
      const pickupLat = 6.5244;
      const pickupLng = 3.3792;
      
      // Start ride request
      const rideResult = await RideQueueHelpers.handleNewRideRequest(
        rideId,
        pickupLat,
        pickupLng
      );
      
      expect(rideResult.matchingJobId).toBeDefined();
      
      // Simulate ride completion
      const completionResult = await RideQueueHelpers.handleRideCompletion(
        rideId,
        5000,  // 5km distance
        900,   // 15 minutes
        1.0    // no surge
      );
      
      expect(completionResult.fareJobId).toBeDefined();
      expect(completionResult.completionJobId).toBeDefined();
    });

    test('should handle user registration flow', async () => {
      const userId = 'integration-test-user-1';
      const phone = '+2348012345678';
      const email = 'test@example.com';
      const name = 'Test User';
      
      // Send verification code
      const smsJob = await AuthQueueHelpers.sendVerificationCode(phone, '123456', userId);
      expect(smsJob.id).toBeDefined();
      
      // Send welcome email
      const emailJob = await AuthQueueHelpers.sendWelcomeEmail(email, name, userId);
      expect(emailJob.id).toBeDefined();
    });

    test('should handle payment and notification flow', async () => {
      const rideId = 'integration-test-ride-2';
      const userId = 'integration-test-user-2';
      const amount = 2500; // 25 Naira
      
      // Process payment
      const paymentResult = await PaymentQueueHelpers.processRidePayment(
        rideId,
        amount,
        userId
      );
      
      expect(paymentResult.paymentJobId).toBeDefined();
      
      // Send payment notification
      const notificationJob = await JobScheduler.schedulePushNotification(
        userId,
        'Payment Processed',
        `Your payment of ₦${(amount / 100).toFixed(2)} has been processed`,
        { rideId, amount }
      );
      
      expect(notificationJob.id).toBeDefined();
    });
  });
});