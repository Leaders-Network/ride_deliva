/**
 * Queue Integration Examples
 * 
 * This file demonstrates how to integrate the job queue system
 * into various parts of the application.
 */

import { Request, Response } from 'express';
import { AuthQueueHelpers, RideQueueHelpers, PaymentQueueHelpers, NotificationQueueHelpers } from '../utils/queue-helpers';
import { JobScheduler } from '../utils/job-scheduler';
import { logger } from '../../config/logger';
import { ApiResponse } from '../utils/response';

/**
 * Example: User Registration with Queue Integration
 */
export async function handleUserRegistration(req: Request, res: Response) {
  try {
    const { firstName, lastName, email, phone, password } = req.body;

    // 1. Create user in database (simulated)
    const newUser = {
      id: `user_${Date.now()}`,
      firstName,
      lastName,
      email,
      phone,
      isVerified: false,
    };

    // 2. Generate and send verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Schedule SMS verification
    const smsJob = await AuthQueueHelpers.sendVerificationCode(
      phone,
      verificationCode,
      newUser.id
    );

    // 3. Send welcome email (delayed to ensure user creation is complete)
    const emailJob = await AuthQueueHelpers.sendWelcomeEmail(
      email,
      firstName,
      newUser.id
    );

    // 4. Schedule onboarding notifications (delayed)
    const onboardingJob = await JobScheduler.schedulePushNotification(
      newUser.id,
      'Welcome to Ride Deliva!',
      'Complete your profile to start booking rides',
      { 
        userId: newUser.id,
        step: 'profile_completion',
        deepLink: '/profile/complete'
      },
      { delay: 300000 } // 5 minutes delay
    );

    logger.info('User registration completed with queue jobs', {
      userId: newUser.id,
      smsJobId: smsJob.id,
      emailJobId: emailJob.id,
      onboardingJobId: onboardingJob.id,
    });

    ApiResponse.success(res, {
      user: newUser,
      message: 'Registration successful. Please check your phone for verification code.',
      jobIds: {
        verification: smsJob.id,
        welcome: emailJob.id,
        onboarding: onboardingJob.id,
      }
    });

  } catch (error) {
    logger.error('User registration failed', { error });
    ApiResponse.error(res, 'Registration failed', 500);
  }
}

/**
 * Example: Ride Booking with Queue Integration
 */
export async function handleRideBooking(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { 
      pickupAddress, 
      pickupLatitude, 
      pickupLongitude,
      destinationAddress,
      destinationLatitude,
      destinationLongitude,
      rideType 
    } = req.body;

    // 1. Create ride record (simulated)
    const ride = {
      id: `ride_${Date.now()}`,
      userId,
      pickupAddress,
      pickupLatitude,
      pickupLongitude,
      destinationAddress,
      destinationLatitude,
      destinationLongitude,
      rideType,
      status: 'REQUESTED',
      createdAt: new Date(),
    };

    // 2. Start ride processing workflow
    const rideWorkflow = await RideQueueHelpers.handleNewRideRequest(
      ride.id,
      pickupLatitude,
      pickupLongitude
    );

    // 3. Schedule route optimization
    const routeJob = await JobScheduler.scheduleRideJob({
      type: 'route_optimization',
      rideId: ride.id,
      data: {
        waypoints: [
          { latitude: pickupLatitude, longitude: pickupLongitude },
          { latitude: destinationLatitude, longitude: destinationLongitude },
        ]
      }
    }, { delay: 1000 });

    // 4. Send booking confirmation to user
    const confirmationJob = await JobScheduler.schedulePushNotification(
      userId!,
      'Ride Booked Successfully',
      'We are finding the best driver for you. You will be notified when a driver accepts.',
      {
        rideId: ride.id,
        pickupAddress,
        destinationAddress,
      },
      { priority: 'high' }
    );

    logger.info('Ride booking completed with queue workflow', {
      rideId: ride.id,
      userId,
      matchingJobId: rideWorkflow.matchingJobId,
      routeJobId: routeJob.id,
      confirmationJobId: confirmationJob.id,
    });

    ApiResponse.success(res, {
      ride,
      message: 'Ride booked successfully. Finding driver...',
      estimatedWaitTime: '3-5 minutes',
      jobIds: {
        matching: rideWorkflow.matchingJobId,
        route: routeJob.id,
        confirmation: confirmationJob.id,
      }
    });

  } catch (error) {
    logger.error('Ride booking failed', { error });
    ApiResponse.error(res, 'Failed to book ride', 500);
  }
}

/**
 * Example: Driver Assignment with Queue Integration
 */
export async function handleDriverAssignment(req: Request, res: Response) {
  try {
    const { rideId, driverId } = req.body;
    
    // 1. Update ride with driver assignment (simulated)
    const ride = {
      id: rideId,
      driverId,
      status: 'DRIVER_ASSIGNED',
      driverAssignedAt: new Date(),
    };

    // 2. Process driver assignment
    const assignmentJob = await JobScheduler.scheduleRideJob({
      type: 'driver_assignment',
      rideId,
      driverId,
    });

    // 3. Send notifications to both customer and driver
    const notifications = await Promise.all([
      // Customer notification
      JobScheduler.schedulePushNotification(
        'customer-user-id', // Would get from ride record
        'Driver Assigned!',
        'Your driver is on the way. Track your ride in real-time.',
        { rideId, driverId },
        { priority: 'high' }
      ),
      
      // Driver notification
      JobScheduler.schedulePushNotification(
        driverId,
        'New Ride Assigned',
        'Navigate to pickup location and contact the customer.',
        { rideId, action: 'navigate_pickup' },
        { priority: 'high' }
      ),

      // SMS to customer with driver details
      JobScheduler.scheduleSMS({
        type: 'notification',
        to: '+2348012345678', // Would get from user record
        message: 'Your driver has been assigned! Track your ride in the app.',
        rideId,
        userId: 'customer-user-id',
      }),
    ]);

    logger.info('Driver assignment completed', {
      rideId,
      driverId,
      assignmentJobId: assignmentJob.id,
      notificationJobIds: notifications.map(job => job.id),
    });

    ApiResponse.success(res, {
      message: 'Driver assigned successfully',
      ride,
      jobIds: {
        assignment: assignmentJob.id,
        notifications: notifications.map(job => job.id),
      }
    });

  } catch (error) {
    logger.error('Driver assignment failed', { error });
    ApiResponse.error(res, 'Failed to assign driver', 500);
  }
}

/**
 * Example: Ride Completion with Payment Processing
 */
export async function handleRideCompletion(req: Request, res: Response) {
  try {
    const { rideId, finalDistance, finalDuration, rating } = req.body;
    
    // 1. Complete the ride workflow
    const completionWorkflow = await RideQueueHelpers.handleRideCompletion(
      rideId,
      finalDistance,
      finalDuration,
      1.0 // No surge
    );

    // 2. Process payment (will be triggered by ride completion)
    const paymentJob = await PaymentQueueHelpers.processRidePayment(
      rideId,
      3500, // 35 Naira (would be calculated)
      'customer-user-id',
      'card'
    );

    // 3. Send completion notifications and receipt
    const notificationJobs = await Promise.all([
      // Customer completion notification
      JobScheduler.schedulePushNotification(
        'customer-user-id',
        'Ride Completed',
        'Thanks for riding with us! Your receipt has been sent.',
        { rideId, rating: rating || 0 }
      ),

      // Driver completion notification
      JobScheduler.schedulePushNotification(
        'driver-user-id',
        'Ride Completed',
        'Great job! Your earnings have been added to your wallet.',
        { rideId, earnings: 2800 } // 80% of fare
      ),

      // Schedule receipt email
      JobScheduler.scheduleEmail({
        type: 'receipt',
        to: 'customer@example.com',
        subject: 'Your Ride Receipt',
        templateId: 'ride_receipt',
        variables: {
          rideId,
          amount: '35.00',
          date: new Date().toLocaleDateString(),
          pickupAddress: 'Victoria Island, Lagos',
          destinationAddress: 'Ikeja, Lagos',
        },
        rideId,
        userId: 'customer-user-id',
      }),
    ]);

    logger.info('Ride completion workflow started', {
      rideId,
      completionJobIds: completionWorkflow,
      paymentJobId: paymentJob.paymentJobId,
      notificationJobIds: notificationJobs.map(job => job.id),
    });

    ApiResponse.success(res, {
      message: 'Ride completed successfully',
      rideId,
      jobIds: {
        completion: completionWorkflow,
        payment: paymentJob.paymentJobId,
        notifications: notificationJobs.map(job => job.id),
      }
    });

  } catch (error) {
    logger.error('Ride completion failed', { error });
    ApiResponse.error(res, 'Failed to complete ride', 500);
  }
}

/**
 * Example: Promotional Campaign with Batch Notifications
 */
export async function handlePromotionalCampaign(req: Request, res: Response) {
  try {
    const { title, message, targetUserIds, promoCode, scheduleTime } = req.body;
    
    // 1. Schedule promotional notifications
    const campaignJobs = await NotificationQueueHelpers.sendPromotionalNotification(
      targetUserIds,
      title,
      message,
      {
        promoCode,
        campaign: 'weekend_special',
        trackingId: `campaign_${Date.now()}`
      },
      scheduleTime ? new Date(scheduleTime) : undefined
    );

    // 2. Schedule follow-up SMS for high-value customers (subset)
    const highValueUsers = targetUserIds.slice(0, Math.min(50, targetUserIds.length));
    
    const smsJobs = await JobScheduler.scheduleBatchJobs(
      'sms',
      highValueUsers.map(userId => ({
        name: 'marketing',
        data: {
          type: 'marketing',
          to: `+234801234${userId.slice(-4)}`, // Mock phone number
          message: `${message} Use code ${promoCode}. Reply STOP to opt out.`,
          userId,
          metadata: { campaignId: `campaign_${Date.now()}` }
        },
        options: {
          delay: scheduleTime ? new Date(scheduleTime).getTime() - Date.now() : 0
        }
      }))
    );

    // 3. Schedule campaign analytics collection
    const analyticsJob = await JobScheduler.scheduleRecurringJob(
      'email',
      'campaign_analytics',
      {
        type: 'system',
        to: 'marketing@ridedeliva.com',
        subject: 'Campaign Performance Report',
        templateId: 'campaign_analytics',
        variables: {
          campaignId: `campaign_${Date.now()}`,
          targetCount: targetUserIds.length,
        }
      },
      '0 9 * * *', // Daily at 9 AM
      { limit: 7 } // For one week
    );

    logger.info('Promotional campaign launched', {
      targetUserCount: targetUserIds.length,
      pushJobCount: campaignJobs.length,
      smsJobCount: smsJobs.length,
      analyticsJobId: analyticsJob.id,
      scheduleTime,
    });

    ApiResponse.success(res, {
      message: 'Promotional campaign launched successfully',
      campaign: {
        targetUsers: targetUserIds.length,
        scheduleTime,
        promoCode,
      },
      jobIds: {
        pushNotifications: campaignJobs.map(job => job.id),
        smsNotifications: smsJobs.map(job => job.id),
        analytics: analyticsJob.id,
      }
    });

  } catch (error) {
    logger.error('Promotional campaign failed', { error });
    ApiResponse.error(res, 'Failed to launch campaign', 500);
  }
}

/**
 * Example: System Maintenance Notification
 */
export async function handleMaintenanceNotification(req: Request, res: Response) {
  try {
    const { maintenanceTime, duration, affectedServices, notifyUserIds } = req.body;

    // 1. Schedule maintenance notifications for all affected users
    const broadcastJob = await JobScheduler.scheduleBroadcastNotification(
      'Scheduled Maintenance',
      `Service will be temporarily unavailable on ${new Date(maintenanceTime).toLocaleDateString()} from ${new Date(maintenanceTime).toLocaleTimeString()}. Duration: ${duration} minutes.`,
      {
        maintenanceTime,
        duration,
        affectedServices,
        type: 'maintenance'
      },
      'all_users',
      { delay: new Date(maintenanceTime).getTime() - Date.now() - (30 * 60 * 1000) } // 30 minutes before
    );

    // 2. Send email notifications to drivers (they need advance notice)
    const driverEmailJobs = await JobScheduler.scheduleBatchJobs(
      'email',
      notifyUserIds.map(userId => ({
        name: 'system',
        data: {
          type: 'system',
          to: `driver-${userId}@example.com`,
          subject: 'Scheduled System Maintenance',
          templateId: 'maintenance_notice',
          variables: {
            maintenanceTime: new Date(maintenanceTime).toLocaleString(),
            duration,
            affectedServices: affectedServices.join(', '),
          },
          userId,
        },
        options: {
          delay: new Date(maintenanceTime).getTime() - Date.now() - (24 * 60 * 60 * 1000) // 24 hours before
        }
      }))
    );

    // 3. Schedule reminder notifications
    const reminderJob = await JobScheduler.schedulePushNotification(
      'all_users', // This would be handled as broadcast
      'Maintenance Reminder',
      'Service maintenance starts in 1 hour. Please complete any ongoing trips.',
      { maintenanceTime, type: 'maintenance_reminder' },
      { 
        delay: new Date(maintenanceTime).getTime() - Date.now() - (60 * 60 * 1000), // 1 hour before
        priority: 'high' 
      }
    );

    logger.info('Maintenance notifications scheduled', {
      maintenanceTime,
      duration,
      affectedServices,
      broadcastJobId: broadcastJob.id,
      driverEmailJobCount: driverEmailJobs.length,
      reminderJobId: reminderJob.id,
    });

    ApiResponse.success(res, {
      message: 'Maintenance notifications scheduled successfully',
      maintenance: {
        scheduledTime: maintenanceTime,
        duration,
        affectedServices,
      },
      jobIds: {
        broadcast: broadcastJob.id,
        driverEmails: driverEmailJobs.map(job => job.id),
        reminder: reminderJob.id,
      }
    });

  } catch (error) {
    logger.error('Maintenance notification scheduling failed', { error });
    ApiResponse.error(res, 'Failed to schedule maintenance notifications', 500);
  }
}

/**
 * Example: Queue Health Monitoring Endpoint
 */
export async function getQueueHealth(req: Request, res: Response) {
  try {
    const { queueService } = await import('../../config/queues');
    
    // Get statistics for all queues
    const allStats = await queueService.getAllQueueStats();
    
    // Calculate health metrics
    const healthMetrics = {
      totalQueues: allStats.length,
      healthyQueues: 0,
      totalJobs: 0,
      failedJobs: 0,
      activeJobs: 0,
      queues: [] as any[],
    };

    for (const queueStats of allStats) {
      if (queueStats.counts) {
        const isHealthy = queueStats.counts.failed < 10 && !queueStats.paused;
        healthMetrics.healthyQueues += isHealthy ? 1 : 0;
        healthMetrics.totalJobs += Object.values(queueStats.counts).reduce((sum: number, count: number) => sum + count, 0);
        healthMetrics.failedJobs += queueStats.counts.failed;
        healthMetrics.activeJobs += queueStats.counts.active;
        
        healthMetrics.queues.push({
          name: queueStats.queueName,
          healthy: isHealthy,
          paused: queueStats.paused,
          counts: queueStats.counts,
        });
      }
    }

    const overallHealth = healthMetrics.healthyQueues === healthMetrics.totalQueues && healthMetrics.failedJobs < 50;

    logger.info('Queue health check completed', healthMetrics);

    res.status(overallHealth ? 200 : 503).json({
      success: true,
      healthy: overallHealth,
      timestamp: new Date().toISOString(),
      metrics: healthMetrics,
    });

  } catch (error) {
    logger.error('Queue health check failed', { error });
    ApiResponse.error(res, 'Failed to check queue health', 500);
  }
}

export {
  handleUserRegistration,
  handleRideBooking,
  handleDriverAssignment,
  handleRideCompletion,
  handlePromotionalCampaign,
  handleMaintenanceNotification,
  getQueueHealth,
};
