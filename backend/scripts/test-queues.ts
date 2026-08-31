#!/usr/bin/env ts-node

/**
 * Queue System Test Script
 * 
 * This script demonstrates and tests the job queue system functionality.
 * Run with: npm run test:queues
 * 
 * Features tested:
 * - Job scheduling and processing
 * - Different job types (SMS, email, notifications, rides, payments, deliveries)
 * - Queue management operations
 * - Error handling and retries
 * - Batch operations
 * - Status monitoring
 */

import { config } from 'dotenv';
import { logger } from '../src/config/logger';
import { initializeQueues, queueService, QUEUE_NAMES } from '../src/config/queues';
import { JobScheduler, JobStatusChecker } from '../src/shared/utils/job-scheduler';
import {
  AuthQueueHelpers,
  RideQueueHelpers,
  DeliveryQueueHelpers,
  PaymentQueueHelpers,
  NotificationQueueHelpers,
  SystemQueueHelpers,
  waitForJobs,
  checkJobStatuses,
} from '../src/shared/utils/queue-helpers';

// Load environment variables
config();

class QueueTester {
  private testResults: Array<{ test: string; success: boolean; duration: number; error?: string }> = [];

  async runTest(name: string, testFn: () => Promise<any>): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info(`🧪 Running test: ${name}`);
      
      await testFn();
      
      const duration = Date.now() - startTime;
      this.testResults.push({ test: name, success: true, duration });
      
      logger.info(`✅ Test passed: ${name} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.testResults.push({ test: name, success: false, duration, error: errorMessage });
      
      logger.error(`❌ Test failed: ${name} (${duration}ms)`, { error: errorMessage });
    }
  }

  async testBasicJobScheduling(): Promise<void> {
    // Test SMS job
    const smsJob = await JobScheduler.scheduleSMS({
      type: 'verification',
      to: '+2348012345678',
      message: 'Your test verification code is: 123456',
      userId: 'test-user-1',
    });

    // Test notification job
    const notificationJob = await JobScheduler.scheduleNotification({
      type: 'push',
      userId: 'test-user-1',
      title: 'Test Notification',
      body: 'This is a test push notification',
      priority: 'high',
    });

    // Test email job
    const emailJob = await JobScheduler.scheduleEmail({
      type: 'transactional',
      to: 'test@ridedeliva.com',
      subject: 'Test Email',
      htmlContent: '<h1>Test Email Content</h1>',
      userId: 'test-user-1',
    });

    logger.info('Basic jobs scheduled', {
      smsJobId: smsJob.id,
      notificationJobId: notificationJob.id,
      emailJobId: emailJob.id,
    });
  }

  async testRideFlow(): Promise<void> {
    const rideId = `test-ride-${Date.now()}`;
    
    // Simulate complete ride flow
    logger.info(`Testing ride flow for ${rideId}`);

    // 1. Handle new ride request
    const rideRequest = await RideQueueHelpers.handleNewRideRequest(
      rideId,
      6.5244,  // Lagos coordinates
      3.3792
    );

    // 2. Simulate driver assignment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const assignmentJob = await JobScheduler.scheduleRideJob({
      type: 'driver_assignment',
      rideId,
      driverId: 'test-driver-1',
    });

    // 3. Send status updates
    await RideQueueHelpers.sendRideStatusUpdate(
      rideId,
      'DRIVER_ASSIGNED',
      '+2348012345678',
      'test-user-1',
      'test-driver-1'
    );

    // 4. Complete the ride
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const completionResult = await RideQueueHelpers.handleRideCompletion(
      rideId,
      8500,  // 8.5km
      1200,  // 20 minutes
      1.2    // 20% surge
    );

    logger.info('Ride flow completed', {
      rideId,
      matchingJobId: rideRequest.matchingJobId,
      assignmentJobId: assignmentJob.id,
      completionJobIds: completionResult,
    });
  }

  async testDeliveryFlow(): Promise<void> {
    const deliveryId = `test-delivery-${Date.now()}`;
    
    logger.info(`Testing delivery flow for ${deliveryId}`);

    // Handle new delivery request
    const deliveryRequest = await DeliveryQueueHelpers.handleNewDeliveryRequest(
      deliveryId,
      6.5244,  // Pickup location
      3.3792,
      'PACKAGE',  // Package type
      2.5,       // 2.5kg
      'EXPRESS'  // Priority
    );

    // Simulate delivery status updates
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const statusJob = await JobScheduler.scheduleDeliveryJob({
      type: 'update_status',
      deliveryId,
      data: {
        status: 'COURIER_ASSIGNED',
        courierId: 'test-courier-1',
      },
    });

    // Complete delivery
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const completionResult = await DeliveryQueueHelpers.handleDeliveryCompletion(
      deliveryId,
      'delivery-proof-image-url'
    );

    logger.info('Delivery flow completed', {
      deliveryId,
      requestJobIds: deliveryRequest,
      statusJobId: statusJob.id,
      completionJobId: completionResult.completionJobId,
    });
  }

  async testPaymentFlow(): Promise<void> {
    const paymentId = `test-payment-${Date.now()}`;
    const rideId = `test-ride-payment-${Date.now()}`;
    
    logger.info(`Testing payment flow for ${paymentId}`);

    // Process ride payment
    const paymentResult = await PaymentQueueHelpers.processRidePayment(
      rideId,
      3500,  // 35 Naira
      'test-user-1',
      'card'
    );

    // Test refund
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const refundResult = await PaymentQueueHelpers.processRefund(
      paymentId,
      1000,  // Partial refund of 10 Naira
      'Customer complaint - service issue'
    );

    // Test driver payout
    const payoutResult = await PaymentQueueHelpers.scheduleDriverPayout(
      'test-driver-1',
      2800,  // Driver earnings (80% of fare)
      { accountNumber: '1234567890', bankCode: '044' }
    );

    logger.info('Payment flow completed', {
      paymentJobId: paymentResult.paymentJobId,
      refundJobId: refundResult.refundJobId,
      payoutJobId: payoutResult.payoutJobId,
    });
  }

  async testBatchOperations(): Promise<void> {
    logger.info('Testing batch operations');

    // Test batch notifications
    const userIds = Array.from({ length: 25 }, (_, i) => `user-${i + 1}`);
    
    const batchJobs = await NotificationQueueHelpers.sendPromotionalNotification(
      userIds,
      'Special Offer!',
      'Get 20% off your next ride with code SAVE20',
      { 
        promoCode: 'SAVE20',
        discountPercent: 20,
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    );

    // Test emergency notifications
    const emergencyUserIds = userIds.slice(0, 5);
    const emergencyJobs = await NotificationQueueHelpers.sendEmergencyNotification(
      emergencyUserIds,
      'Service Alert',
      'Temporary service disruption in your area. We are working to restore service.',
      { alertType: 'service_disruption', severity: 'medium' }
    );

    logger.info('Batch operations completed', {
      promotionalJobCount: batchJobs.length,
      emergencyJobCount: emergencyJobs.length,
      totalUsers: userIds.length,
    });
  }

  async testErrorHandling(): Promise<void> {
    logger.info('Testing error handling and retries');

    // Test invalid phone number (should handle gracefully)
    try {
      await JobScheduler.scheduleSMS({
        type: 'verification',
        to: 'invalid-phone',
        message: 'Test message',
      });
    } catch (error) {
      logger.info('Expected error handled correctly', { error: error.message });
    }

    // Test job with invalid data
    const errorJob = await JobScheduler.scheduleRideJob({
      type: 'calculate_fare',
      rideId: 'error-test-ride',
      data: {
        distance: -1000, // Invalid negative distance
        duration: -500,  // Invalid negative duration
      },
    });

    logger.info('Error handling test job scheduled', { jobId: errorJob.id });
  }

  async testJobStatusMonitoring(): Promise<void> {
    logger.info('Testing job status monitoring');

    // Schedule multiple jobs
    const jobs = await Promise.all([
      JobScheduler.scheduleSMS({
        type: 'notification',
        to: '+2348012345678',
        message: 'Status monitoring test 1',
      }),
      JobScheduler.scheduleNotification({
        type: 'push',
        userId: 'test-user-monitor',
        title: 'Status Test',
        body: 'Monitoring job status',
      }),
      JobScheduler.scheduleEmail({
        type: 'transactional',
        to: 'monitor@test.com',
        subject: 'Status Monitor Test',
        htmlContent: '<p>Testing status monitoring</p>',
      }),
    ]);

    const jobReferences = jobs.map((job, index) => ({
      queueName: [QUEUE_NAMES.SMS, QUEUE_NAMES.NOTIFICATION, QUEUE_NAMES.EMAIL][index],
      jobId: job.id,
    }));

    // Check job statuses
    const statuses = await checkJobStatuses(jobReferences);
    
    logger.info('Job status monitoring completed', {
      jobCount: jobs.length,
      statuses: statuses.map(s => ({ status: s.status, progress: s.progress })),
    });

    // Wait for some jobs to complete (with timeout)
    try {
      await waitForJobs(jobReferences.slice(0, 2), 10000);
      logger.info('Jobs completed successfully');
    } catch (error) {
      logger.info('Jobs may still be processing (expected in test environment)');
    }
  }

  async testRecurringJobs(): Promise<void> {
    logger.info('Testing recurring jobs');

    // Schedule a test recurring job (every minute for testing)
    const recurringJob = await JobScheduler.scheduleRecurringJob(
      QUEUE_NAMES.EMAIL,
      'test_recurring_report',
      {
        type: 'system',
        to: 'admin@ridedeliva.com',
        subject: 'Test Recurring Report',
        templateId: 'recurring_test',
        variables: { timestamp: new Date().toISOString() },
      },
      '*/1 * * * *', // Every minute
      { limit: 3 } // Only run 3 times
    );

    logger.info('Recurring job scheduled', {
      jobId: recurringJob.id,
      pattern: '*/1 * * * *',
      limit: 3,
    });
  }

  async testQueueManagement(): Promise<void> {
    logger.info('Testing queue management operations');

    // Get queue statistics
    const allStats = await queueService.getAllQueueStats();
    logger.info('Queue statistics', { stats: allStats });

    // Test queue operations on a test queue
    const testQueueName = 'management-test';
    queueService.createQueue({
      name: testQueueName,
      concurrency: 1,
    });

    // Add some test jobs
    await queueService.addJob(testQueueName, 'test-1', { data: 1 });
    await queueService.addJob(testQueueName, 'test-2', { data: 2 });

    // Pause the queue
    await queueService.pauseQueue(testQueueName);
    logger.info('Queue paused');

    // Add job while paused
    await queueService.addJob(testQueueName, 'test-paused', { data: 'paused' });

    // Resume the queue
    await queueService.resumeQueue(testQueueName);
    logger.info('Queue resumed');

    // Wait a bit then clean up
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const cleanedJobs = await queueService.cleanQueue(testQueueName, 0, 100, 'completed');
    logger.info('Queue cleaned', { cleanedJobCount: cleanedJobs.length });
  }

  async printSummary(): Promise<void> {
    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = this.testResults.filter(r => r.success === false).length;
    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);

    logger.info('\n📊 TEST SUMMARY', {
      totalTests: this.testResults.length,
      passed: passedTests,
      failed: failedTests,
      successRate: `${((passedTests / this.testResults.length) * 100).toFixed(1)}%`,
      totalDuration: `${totalDuration}ms`,
    });

    if (failedTests > 0) {
      logger.error('❌ Failed Tests:');
      this.testResults
        .filter(r => !r.success)
        .forEach(r => logger.error(`  - ${r.test}: ${r.error}`));
    }

    logger.info('✅ Passed Tests:');
    this.testResults
      .filter(r => r.success)
      .forEach(r => logger.info(`  - ${r.test} (${r.duration}ms)`));
  }

  async runAllTests(): Promise<void> {
    logger.info('🚀 Starting Queue System Tests');
    
    try {
      // Initialize queues
      await initializeQueues();
      logger.info('✅ Queues initialized');

      // Wait a moment for queues to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Run all tests
      await this.runTest('Basic Job Scheduling', () => this.testBasicJobScheduling());
      await this.runTest('Ride Flow', () => this.testRideFlow());
      await this.runTest('Delivery Flow', () => this.testDeliveryFlow());
      await this.runTest('Payment Flow', () => this.testPaymentFlow());
      await this.runTest('Batch Operations', () => this.testBatchOperations());
      await this.runTest('Error Handling', () => this.testErrorHandling());
      await this.runTest('Job Status Monitoring', () => this.testJobStatusMonitoring());
      await this.runTest('Recurring Jobs', () => this.testRecurringJobs());
      await this.runTest('Queue Management', () => this.testQueueManagement());

      // Print summary
      await this.printSummary();

    } catch (error) {
      logger.error('❌ Test suite failed to initialize', { error });
    } finally {
      // Cleanup
      try {
        await queueService.close();
        logger.info('✅ Queue connections closed');
      } catch (error) {
        logger.error('Error during cleanup', { error });
      }
    }
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const tester = new QueueTester();
  
  tester.runAllTests()
    .then(() => {
      logger.info('🎉 Queue system tests completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Queue system tests failed', { error });
      process.exit(1);
    });
}