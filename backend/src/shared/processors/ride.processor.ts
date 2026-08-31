import { Job } from 'bullmq';
import { logger } from '../../config/logger';
import { databaseService } from '../services/database';
import { queueService } from '../services/queue.service';
import { QUEUE_NAMES } from '../../config/queues';

export interface RideJobData {
  type: 'match_driver' | 'update_status' | 'calculate_fare' | 'cancel_ride' | 'complete_ride' | 'driver_assignment' | 'route_optimization';
  rideId: string;
  userId?: string;
  driverId?: string;
  data?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Ride Job Processor
 * Handles all ride-related background jobs
 */
export async function rideProcessor(job: Job<RideJobData>): Promise<any> {
  const { type, rideId, userId, driverId } = job.data;

  await job.updateProgress(10);

  logger.info(`Processing ride job ${job.id}`, {
    jobId: job.id,
    type,
    rideId,
    userId,
    driverId,
  });

  try {
    let result;

    switch (type) {
      case 'match_driver':
        result = await handleDriverMatching(job);
        break;
      
      case 'update_status':
        result = await handleStatusUpdate(job);
        break;
      
      case 'calculate_fare':
        result = await handleFareCalculation(job);
        break;
      
      case 'cancel_ride':
        result = await handleRideCancellation(job);
        break;
      
      case 'complete_ride':
        result = await handleRideCompletion(job);
        break;
      
      case 'driver_assignment':
        result = await handleDriverAssignment(job);
        break;
      
      case 'route_optimization':
        result = await handleRouteOptimization(job);
        break;
      
      default:
        throw new Error(`Unknown ride job type: ${type}`);
    }

    await job.updateProgress(100);

    logger.info(`Ride job ${job.id} completed successfully`, {
      jobId: job.id,
      type,
      rideId,
      result,
    });

    return result;
  } catch (error) {
    logger.error(`Ride job ${job.id} failed`, {
      jobId: job.id,
      type,
      rideId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle driver matching for ride requests
 */
async function handleDriverMatching(job: Job<RideJobData>) {
  const { rideId, data } = job.data;
  const { pickupLatitude, pickupLongitude, maxDistance = 5000 } = data || {};

  await job.updateProgress(20);

  try {
    // Get ride details
    const ride = await databaseService.findFirst('Ride', {
      where: { id: rideId, status: 'REQUESTED' },
      include: { user: true }
    });

    if (!ride) {
      throw new Error(`Ride ${rideId} not found or not in REQUESTED status`);
    }

    await job.updateProgress(40);

    // Find available drivers within radius
    const availableDrivers = await databaseService.rawQuery(`
      SELECT 
        u.id,
        u.firstName,
        u.lastName,
        u.phone,
        u.averageRating,
        d.vehicleType,
        d.currentLatitude,
        d.currentLongitude,
        ST_Distance(
          ST_Point($1, $2)::geography,
          ST_Point(d.currentLatitude, d.currentLongitude)::geography
        ) as distance
      FROM "User" u
      JOIN "Driver" d ON u.id = d.userId
      WHERE 
        u.role = 'DRIVER' 
        AND u.isActive = true
        AND d.isOnline = true
        AND d.status = 'AVAILABLE'
        AND ST_DWithin(
          ST_Point($1, $2)::geography,
          ST_Point(d.currentLatitude, d.currentLongitude)::geography,
          $3
        )
      ORDER BY distance ASC, u.averageRating DESC
      LIMIT 10
    `, [pickupLatitude, pickupLongitude, maxDistance]);

    await job.updateProgress(70);

    if (availableDrivers.length === 0) {
      // No drivers available - schedule retry or expand search radius
      logger.warn(`No drivers available for ride ${rideId}`, {
        rideId,
        pickupLocation: { latitude: pickupLatitude, longitude: pickupLongitude },
        searchRadius: maxDistance,
      });

      // Schedule retry with expanded radius
      await queueService.addDelayedJob(
        QUEUE_NAMES.RIDE,
        'match_driver',
        {
          ...job.data,
          data: { ...data, maxDistance: maxDistance * 1.5 }
        },
        30000 // 30 seconds delay
      );

      return {
        success: false,
        reason: 'no_drivers_available',
        searchRadius: maxDistance,
        retryScheduled: true,
      };
    }

    // Send ride requests to top drivers
    const topDrivers = availableDrivers.slice(0, 3);
    const notifications = [];

    for (const driver of topDrivers) {
      // Send push notification to driver
      await queueService.addJob(
        QUEUE_NAMES.NOTIFICATION,
        'push',
        {
          type: 'push',
          userId: driver.id,
          title: 'New Ride Request',
          body: `Ride request ${Math.round(driver.distance)}m away`,
          data: {
            rideId,
            pickupLatitude,
            pickupLongitude,
            estimatedDistance: driver.distance,
          },
          priority: 'high',
          ttl: 300, // 5 minutes
          category: 'ride_request',
        }
      );

      notifications.push({
        driverId: driver.id,
        distance: driver.distance,
        rating: driver.averageRating,
      });
    }

    // Update ride status to MATCHING
    await databaseService.update('Ride', rideId, {
      status: 'MATCHING',
      updatedAt: new Date(),
    });

    await job.updateProgress(90);

    logger.info(`Driver matching completed for ride ${rideId}`, {
      rideId,
      availableDriversCount: availableDrivers.length,
      notificationsSent: notifications.length,
    });

    return {
      success: true,
      availableDriversCount: availableDrivers.length,
      notificationsSent: notifications.length,
      topDrivers: notifications,
    };

  } catch (error) {
    logger.error(`Driver matching failed for ride ${rideId}`, {
      rideId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle ride status updates
 */
async function handleStatusUpdate(job: Job<RideJobData>) {
  const { rideId, data } = job.data;
  const { status, location, driverId } = data || {};

  await job.updateProgress(30);

  try {
    // Update ride status
    const updatedRide = await databaseService.update('Ride', rideId, {
      status,
      updatedAt: new Date(),
    });

    await job.updateProgress(60);

    // Send notifications based on status
    const ride = await databaseService.findFirst('Ride', {
      where: { id: rideId },
      include: { user: true, driver: { include: { user: true } } }
    });

    if (ride) {
      // Send notification to customer
      await queueService.addJob(
        QUEUE_NAMES.NOTIFICATION,
        'push',
        {
          type: 'push',
          userId: ride.userId,
          title: 'Ride Update',
          body: getStatusMessage(status),
          data: { rideId, status },
          category: 'ride_update',
        }
      );

      // Send SMS for critical updates
      if (['DRIVER_ASSIGNED', 'ARRIVED', 'COMPLETED'].includes(status)) {
        await queueService.addJob(
          QUEUE_NAMES.SMS,
          'notification',
          {
            type: 'notification',
            to: ride.user.phone,
            message: `Your ride is ${status.toLowerCase()}. Track your ride in the app.`,
            rideId,
            userId: ride.userId,
          }
        );
      }
    }

    await job.updateProgress(90);

    logger.info(`Ride status updated successfully`, {
      rideId,
      oldStatus: ride?.status,
      newStatus: status,
      driverId,
    });

    return {
      success: true,
      rideId,
      status,
      timestamp: new Date().toISOString(),
    };

  } catch (error) {
    logger.error(`Ride status update failed`, {
      rideId,
      status,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle fare calculation
 */
async function handleFareCalculation(job: Job<RideJobData>) {
  const { rideId, data } = job.data;
  const { distance, duration, surgeMultiplier = 1 } = data || {};

  await job.updateProgress(30);

  try {
    // Base fare calculation logic
    const baseFare = 500; // Base fare in kobo (₦5.00)
    const perKmRate = 200; // ₦2.00 per km
    const perMinuteRate = 50; // ₦0.50 per minute
    
    const distanceFare = (distance / 1000) * perKmRate; // Convert meters to km
    const timeFare = (duration / 60) * perMinuteRate; // Convert seconds to minutes
    
    const subtotal = baseFare + distanceFare + timeFare;
    const surgeAmount = subtotal * (surgeMultiplier - 1);
    const totalFare = Math.round(subtotal * surgeMultiplier);

    await job.updateProgress(70);

    // Update ride with fare details
    const updatedRide = await databaseService.update('Ride', rideId, {
      baseFare,
      distanceFare: Math.round(distanceFare),
      timeFare: Math.round(timeFare),
      surgeMultiplier,
      surgeAmount: Math.round(surgeAmount),
      totalFare,
      fareCalculatedAt: new Date(),
    });

    await job.updateProgress(90);

    logger.info(`Fare calculated successfully`, {
      rideId,
      distance,
      duration,
      surgeMultiplier,
      totalFare,
    });

    return {
      success: true,
      rideId,
      fareBreakdown: {
        baseFare,
        distanceFare: Math.round(distanceFare),
        timeFare: Math.round(timeFare),
        surgeMultiplier,
        surgeAmount: Math.round(surgeAmount),
        totalFare,
      },
    };

  } catch (error) {
    logger.error(`Fare calculation failed`, {
      rideId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle ride cancellation
 */
async function handleRideCancellation(job: Job<RideJobData>) {
  const { rideId, data } = job.data;
  const { reason, cancelledBy, cancellationFee = 0 } = data || {};

  await job.updateProgress(30);

  try {
    // Update ride status
    const updatedRide = await databaseService.update('Ride', rideId, {
      status: 'CANCELLED',
      cancellationReason: reason,
      cancelledBy,
      cancellationFee,
      cancelledAt: new Date(),
    });

    await job.updateProgress(60);

    // Get ride details for notifications
    const ride = await databaseService.findFirst('Ride', {
      where: { id: rideId },
      include: { user: true, driver: { include: { user: true } } }
    });

    if (ride) {
      // Notify both parties
      const notifications = [];

      // Notify customer
      notifications.push(
        queueService.addJob(
          QUEUE_NAMES.NOTIFICATION,
          'push',
          {
            type: 'push',
            userId: ride.userId,
            title: 'Ride Cancelled',
            body: `Your ride has been cancelled. ${reason || ''}`,
            data: { rideId, reason },
            category: 'ride_cancelled',
          }
        )
      );

      // Notify driver if assigned
      if (ride.driverId) {
        notifications.push(
          queueService.addJob(
            QUEUE_NAMES.NOTIFICATION,
            'push',
            {
              type: 'push',
              userId: ride.driverId,
              title: 'Ride Cancelled',
              body: `The ride has been cancelled. ${reason || ''}`,
              data: { rideId, reason },
              category: 'ride_cancelled',
            }
          )
        );
      }

      await Promise.all(notifications);
    }

    await job.updateProgress(90);

    logger.info(`Ride cancelled successfully`, {
      rideId,
      reason,
      cancelledBy,
      cancellationFee,
    });

    return {
      success: true,
      rideId,
      reason,
      cancelledBy,
      cancellationFee,
      timestamp: new Date().toISOString(),
    };

  } catch (error) {
    logger.error(`Ride cancellation failed`, {
      rideId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle ride completion
 */
async function handleRideCompletion(job: Job<RideJobData>) {
  const { rideId } = job.data;

  await job.updateProgress(30);

  try {
    // Update ride status
    const updatedRide = await databaseService.update('Ride', rideId, {
      status: 'COMPLETED',
      completedAt: new Date(),
    });

    await job.updateProgress(50);

    // Trigger payment processing
    await queueService.addJob(
      QUEUE_NAMES.PAYMENT,
      'process_ride_payment',
      {
        type: 'ride_payment',
        rideId,
        amount: updatedRide.totalFare,
      }
    );

    await job.updateProgress(70);

    // Send completion notifications
    const ride = await databaseService.findFirst('Ride', {
      where: { id: rideId },
      include: { user: true, driver: { include: { user: true } } }
    });

    if (ride) {
      // Send receipt email
      await queueService.addJob(
        QUEUE_NAMES.EMAIL,
        'receipt',
        {
          type: 'receipt',
          to: ride.user.email,
          subject: 'Your Ride Receipt',
          templateId: 'ride_receipt',
          variables: {
            customerName: `${ride.user.firstName} ${ride.user.lastName}`,
            rideId,
            totalFare: (ride.totalFare / 100).toFixed(2), // Convert kobo to naira
            date: new Date().toLocaleDateString(),
          },
          rideId,
          userId: ride.userId,
        }
      );
    }

    await job.updateProgress(90);

    logger.info(`Ride completed successfully`, {
      rideId,
      totalFare: updatedRide.totalFare,
    });

    return {
      success: true,
      rideId,
      completedAt: new Date().toISOString(),
      totalFare: updatedRide.totalFare,
    };

  } catch (error) {
    logger.error(`Ride completion failed`, {
      rideId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle driver assignment
 */
async function handleDriverAssignment(job: Job<RideJobData>) {
  const { rideId, driverId } = job.data;

  await job.updateProgress(30);

  try {
    // Assign driver to ride
    const updatedRide = await databaseService.update('Ride', rideId, {
      driverId,
      status: 'DRIVER_ASSIGNED',
      driverAssignedAt: new Date(),
    });

    await job.updateProgress(60);

    // Update driver status
    await databaseService.update('Driver', driverId, {
      status: 'ON_RIDE',
      currentRideId: rideId,
    });

    await job.updateProgress(90);

    logger.info(`Driver assigned successfully`, {
      rideId,
      driverId,
    });

    return {
      success: true,
      rideId,
      driverId,
      assignedAt: new Date().toISOString(),
    };

  } catch (error) {
    logger.error(`Driver assignment failed`, {
      rideId,
      driverId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle route optimization
 */
async function handleRouteOptimization(job: Job<RideJobData>) {
  const { rideId, data } = job.data;
  const { waypoints } = data || {};

  await job.updateProgress(30);

  try {
    // Simulate route optimization logic
    // In a real implementation, this would call a routing service
    await new Promise(resolve => setTimeout(resolve, 500));

    const optimizedRoute = {
      distance: Math.floor(Math.random() * 10000) + 1000, // Random distance in meters
      duration: Math.floor(Math.random() * 1800) + 300, // Random duration in seconds
      polyline: 'optimized_route_polyline_here',
    };

    await job.updateProgress(80);

    // Update ride with optimized route
    await databaseService.update('Ride', rideId, {
      estimatedDistance: optimizedRoute.distance,
      estimatedDuration: optimizedRoute.duration,
      routePolyline: optimizedRoute.polyline,
    });

    await job.updateProgress(90);

    logger.info(`Route optimized successfully`, {
      rideId,
      distance: optimizedRoute.distance,
      duration: optimizedRoute.duration,
    });

    return {
      success: true,
      rideId,
      optimizedRoute,
    };

  } catch (error) {
    logger.error(`Route optimization failed`, {
      rideId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get user-friendly status message
 */
function getStatusMessage(status: string): string {
  const messages = {
    REQUESTED: 'Looking for a driver...',
    MATCHING: 'Finding the best driver for you...',
    DRIVER_ASSIGNED: 'Driver assigned! They are on their way.',
    DRIVER_ARRIVED: 'Your driver has arrived!',
    IN_PROGRESS: 'Your ride is in progress.',
    COMPLETED: 'Your ride is complete. Thanks for riding with us!',
    CANCELLED: 'Your ride has been cancelled.',
  };

  return messages[status as keyof typeof messages] || `Ride status: ${status}`;
}