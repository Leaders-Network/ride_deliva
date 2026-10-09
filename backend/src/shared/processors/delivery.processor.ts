import type { ProcessorJob } from './processor-job';
import { logger } from '../../config/logger';
import { dbService as databaseService } from '../services/database';
import prisma from '../../config/database';
import { Prisma, DeliveryStatus } from '../../generated/prisma';
import { queueService } from '../services/queue.service';
import { QUEUE_NAMES } from '../../config/queues';

export interface DeliveryJobData {
  type: 'assign_courier' | 'update_status' | 'calculate_delivery_fee' | 'optimize_route' | 'handle_delivery_completion' | 'process_failed_delivery';
  deliveryId: string;
  userId?: string;
  courierId?: string;
  data?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Delivery Job Processor
 * Handles all delivery-related background jobs
 */
export async function deliveryProcessor(job: ProcessorJob<DeliveryJobData>): Promise<any> {
  const { type, deliveryId, userId, courierId } = job.data;

  await job.updateProgress(10);

  logger.info(`Processing delivery job ${job.id}`, {
    jobId: job.id,
    type,
    deliveryId,
    userId,
    courierId,
  });

  try {
    let result;

    switch (type) {
      case 'assign_courier':
        result = await handleCourierAssignment(job);
        break;
      
      case 'update_status':
        result = await handleDeliveryStatusUpdate(job);
        break;
      
      case 'calculate_delivery_fee':
        result = await handleDeliveryFeeCalculation(job);
        break;
      
      case 'optimize_route':
        result = await handleDeliveryRouteOptimization(job);
        break;
      
      case 'handle_delivery_completion':
        result = await handleDeliveryCompletion(job);
        break;
      
      case 'process_failed_delivery':
        result = await handleFailedDelivery(job);
        break;
      
      default:
        throw new Error(`Unknown delivery job type: ${type}`);
    }

    await job.updateProgress(100);

    logger.info(`Delivery job ${job.id} completed successfully`, {
      jobId: job.id,
      type,
      deliveryId,
      result,
    });

    return result;
  } catch (error) {
    logger.error(`Delivery job ${job.id} failed`, {
      jobId: job.id,
      type,
      deliveryId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle courier assignment for delivery requests
 */
async function handleCourierAssignment(job: ProcessorJob<DeliveryJobData>) {
  const { deliveryId, data } = job.data;
  const { pickupLatitude, pickupLongitude, maxDistance = 7000 } = data || {};

  await job.updateProgress(20);

  try {
    // Get delivery details
    const delivery = await prisma.delivery.findFirst({
      where: { id: deliveryId, status: 'REQUESTED' },
      include: { customer: { include: { user: true } }, driver: { include: { user: true } }, pickupAddress: true }
    });

    if (!delivery) {
      throw new Error(`Delivery ${deliveryId} not found or not in PENDING status`);
    }

    await job.updateProgress(40);

    // Find available couriers within radius
    const availableCouriers = await databaseService.findNearbyDrivers(pickupLatitude, pickupLongitude, maxDistance, ['MOTORCYCLE', 'VAN']);

    await job.updateProgress(70);

    if (availableCouriers.length === 0) {
      logger.warn(`No couriers available for delivery ${deliveryId}`, {
        deliveryId,
        pickupLocation: { latitude: pickupLatitude, longitude: pickupLongitude },
        searchRadius: maxDistance,
      });

      // Schedule retry with expanded radius
      await queueService.addDelayedJob(
        QUEUE_NAMES.DELIVERY,
        'assign_courier',
        {
          ...job.data,
          data: { ...data, maxDistance: maxDistance * 1.5 }
        },
        45000 // 45 seconds delay
      );

      return {
        success: false,
        reason: 'no_couriers_available',
        searchRadius: maxDistance,
        retryScheduled: true,
      };
    }

    // Send delivery requests to top couriers
    const topCouriers = availableCouriers.slice(0, 3);
    const notifications = [];

    for (const courier of topCouriers) {
      // Send push notification to courier
      await queueService.addJob(
        QUEUE_NAMES.NOTIFICATION,
        'push',
        {
          type: 'push',
          userId: courier.id,
          title: 'New Delivery Request',
          body: `Delivery pickup ${Math.round(courier.distance)}m away`,
          data: {
            deliveryId,
            pickupLatitude,
            pickupLongitude,
            estimatedDistance: courier.distance,
            deliveryType: delivery.deliveryType,
          },
          priority: 'high',
          ttl: 300, // 5 minutes
          category: 'delivery_request',
        }
      );

      notifications.push({
        courierId: courier.id,
        distance: courier.distance,
        rating: courier.averageRating,
        vehicleType: courier.vehicleType,
      });
    }

    // Keep the delivery requested until a courier accepts.
    await prisma.delivery.update({ where: { id: deliveryId }, data: {
      status: 'REQUESTED',
      updatedAt: new Date(),
    } });

    await job.updateProgress(90);

    logger.info(`Courier assignment initiated for delivery ${deliveryId}`, {
      deliveryId,
      availableCouriersCount: availableCouriers.length,
      notificationsSent: notifications.length,
    });

    return {
      success: true,
      availableCouriersCount: availableCouriers.length,
      notificationsSent: notifications.length,
      topCouriers: notifications,
    };

  } catch (error) {
    logger.error(`Courier assignment failed for delivery ${deliveryId}`, {
      deliveryId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle delivery status updates
 */
async function handleDeliveryStatusUpdate(job: ProcessorJob<DeliveryJobData>) {
  const { deliveryId, data } = job.data;
  const { status, location, courierId, proofOfDelivery } = data || {};
  if (!Object.values(DeliveryStatus).some(value => value === status)) throw new Error('Invalid delivery status');

  await job.updateProgress(30);

  try {
    // Update delivery status
    const updateData: Prisma.DeliveryUpdateInput = {
      status,
      updatedAt: new Date(),
    };

    // Add status-specific fields
    if (status === 'DRIVER_ASSIGNED') {
      updateData.acceptedAt = new Date();
    } else if (status === 'PICKED_UP') {
      updateData.pickedUpAt = new Date();
    } else if (status === 'DELIVERED') {
      updateData.deliveredAt = new Date();
      if (proofOfDelivery) {
        updateData.proofOfDelivery = proofOfDelivery;
      }
    }

    await prisma.delivery.update({ where: { id: deliveryId }, data: updateData });

    await job.updateProgress(60);

    // Get delivery details for notifications
    const delivery = await prisma.delivery.findFirst({
      where: { id: deliveryId },
      include: { customer: { include: { user: true } }, driver: { include: { user: true } }, pickupAddress: true }
    });

    if (delivery) {
      // Send notifications based on status
      const notifications = [];

      // Notify customer
      notifications.push(
        queueService.addJob(
          QUEUE_NAMES.NOTIFICATION,
          'push',
          {
            type: 'push',
            userId: delivery.customer.userId,
            title: 'Delivery Update',
            body: getDeliveryStatusMessage(status),
            data: { deliveryId, status },
            category: 'delivery_update',
          }
        )
      );

      // Send SMS for critical updates
      if (['DRIVER_ASSIGNED', 'PICKED_UP', 'DELIVERED'].includes(status)) {
        notifications.push(
          queueService.addJob(
            QUEUE_NAMES.SMS,
            'notification',
            {
              type: 'notification',
              to: delivery.customer.user.phoneNumber,
              message: `Your delivery is ${status.toLowerCase().replace('_', ' ')}. Track in the app.`,
              deliveryId,
              userId: delivery.customer.userId,
            }
          )
        );
      }

      await Promise.all(notifications);
    }

    await job.updateProgress(90);

    logger.info(`Delivery status updated successfully`, {
      deliveryId,
      status,
      courierId,
    });

    return {
      success: true,
      deliveryId,
      status,
      timestamp: new Date().toISOString(),
    };

  } catch (error) {
    logger.error(`Delivery status update failed`, {
      deliveryId,
      status,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle delivery fee calculation
 */
async function handleDeliveryFeeCalculation(job: ProcessorJob<DeliveryJobData>) {
  const { deliveryId, data } = job.data;
  const { 
    distance, 
    packageType, 
    packageWeight, 
    priority = 'STANDARD',
    surgeMultiplier = 1 
  } = data || {};

  await job.updateProgress(30);

  try {
    // Delivery fee calculation logic
    const baseFee = 800; // Base delivery fee in kobo (₦8.00)
    let perKmRate = 150; // ₦1.50 per km
    
    // Adjust rates based on package type
    const packageMultipliers = {
      DOCUMENT: 1.0,
      PACKAGE: 1.2,
      FOOD: 1.1,
      FRAGILE: 1.5,
      ELECTRONICS: 1.3,
    };

    const packageMultiplier = packageMultipliers[packageType as keyof typeof packageMultipliers] || 1.0;
    
    // Weight-based pricing (additional fee for heavy packages)
    let weightFee = 0;
    if (packageWeight > 5) { // Above 5kg
      weightFee = Math.floor((packageWeight - 5) * 50); // ₦0.50 per kg above 5kg
    }

    // Priority-based pricing
    const priorityMultipliers = {
      STANDARD: 1.0,
      EXPRESS: 1.5,
      URGENT: 2.0,
    };

    const priorityMultiplier = priorityMultipliers[priority as keyof typeof priorityMultipliers] || 1.0;

    // Calculate components
    const distanceFee = (distance / 1000) * perKmRate * packageMultiplier; // Convert meters to km
    const subtotal = (baseFee + distanceFee + weightFee) * priorityMultiplier;
    const surgeAmount = subtotal * (surgeMultiplier - 1);
    const totalFee = Math.round(subtotal * surgeMultiplier);

    await job.updateProgress(70);

    // Update delivery with fee details
    await prisma.delivery.update({ where: { id: deliveryId }, data: {
      estimatedFare: totalFee / 100,
    } });

    await job.updateProgress(90);

    logger.info(`Delivery fee calculated successfully`, {
      deliveryId,
      distance,
      packageType,
      packageWeight,
      priority,
      totalFee,
    });

    return {
      success: true,
      deliveryId,
      feeBreakdown: {
        baseFee,
        distanceFee: Math.round(distanceFee),
        weightFee,
        packageMultiplier,
        priorityMultiplier,
        surgeMultiplier,
        surgeAmount: Math.round(surgeAmount),
        totalFee,
      },
    };

  } catch (error) {
    logger.error(`Delivery fee calculation failed`, {
      deliveryId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle delivery route optimization
 */
async function handleDeliveryRouteOptimization(job: ProcessorJob<DeliveryJobData>) {
  const { deliveryId, data } = job.data;
  const { waypoints, courierLocation } = data || {};

  await job.updateProgress(30);

  try {
    // Simulate route optimization logic
    // In a real implementation, this would call a routing service like Google Maps API
    await new Promise(resolve => setTimeout(resolve, 800));

    const optimizedRoute = {
      distance: Math.floor(Math.random() * 15000) + 2000, // Random distance 2-17km
      duration: Math.floor(Math.random() * 2400) + 600, // Random duration 10-50 minutes
      polyline: 'optimized_delivery_route_polyline_here',
      waypoints: waypoints || [],
    };

    await job.updateProgress(80);

    // Update delivery with optimized route
    await prisma.delivery.update({ where: { id: deliveryId }, data: {
      estimatedDistance: optimizedRoute.distance / 1000,
      estimatedDuration: Math.ceil(optimizedRoute.duration / 60),
    } });

    await job.updateProgress(90);

    logger.info(`Delivery route optimized successfully`, {
      deliveryId,
      distance: optimizedRoute.distance,
      duration: optimizedRoute.duration,
    });

    return {
      success: true,
      deliveryId,
      optimizedRoute,
    };

  } catch (error) {
    logger.error(`Delivery route optimization failed`, {
      deliveryId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle delivery completion
 */
async function handleDeliveryCompletion(job: ProcessorJob<DeliveryJobData>) {
  const { deliveryId } = job.data;

  await job.updateProgress(30);

  try {
    // Update delivery status
    await prisma.delivery.update({ where: { id: deliveryId }, data: {
      status: 'DELIVERED',
      deliveredAt: new Date(),
    } });

    await job.updateProgress(50);

    // Trigger payment processing
    const delivery = await prisma.delivery.findFirst({
      where: { id: deliveryId },
      include: { customer: { include: { user: true } }, driver: { include: { user: true } }, pickupAddress: true }
    });

    if (delivery) {
      // Process delivery payment
      await queueService.addJob(
        QUEUE_NAMES.PAYMENT,
        'process_delivery_payment',
        {
          type: 'process_delivery_payment',
          deliveryId,
          amount: Math.round(Number(delivery.finalFare ?? delivery.estimatedFare) * 100),
        }
      );

      await job.updateProgress(70);

      // Send completion notifications
      const notifications = [
        // Customer notification
        queueService.addJob(
          QUEUE_NAMES.NOTIFICATION,
          'push',
          {
            type: 'push',
            userId: delivery.customer.userId,
            title: 'Delivery Completed',
            body: 'Your package has been delivered successfully!',
            data: { deliveryId },
            category: 'delivery_completed',
          }
        ),
        
        // Send delivery receipt email
        queueService.addJob(
          QUEUE_NAMES.EMAIL,
          'receipt',
          {
            type: 'receipt',
            to: delivery.customer.user.email,
            subject: 'Your Delivery Receipt',
            templateId: 'delivery_receipt',
            variables: {
              customerName: `${delivery.customer.user.firstName} ${delivery.customer.user.lastName}`,
              deliveryId,
              deliveryFee: (Number(delivery.finalFare ?? delivery.estimatedFare)).toFixed(2),
              date: new Date().toLocaleDateString(),
            },
            deliveryId,
            userId: delivery.customer.userId,
          }
        ),
      ];

      await Promise.all(notifications);
    }

    await job.updateProgress(90);

    logger.info(`Delivery completed successfully`, {
      deliveryId,
      deliveryFee: delivery ? Number(delivery.finalFare ?? delivery.estimatedFare) : undefined,
    });

    return {
      success: true,
      deliveryId,
      completedAt: new Date().toISOString(),
      deliveryFee: delivery ? Number(delivery.finalFare ?? delivery.estimatedFare) : undefined,
    };

  } catch (error) {
    logger.error(`Delivery completion failed`, {
      deliveryId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle failed delivery
 */
async function handleFailedDelivery(job: ProcessorJob<DeliveryJobData>) {
  const { deliveryId, data } = job.data;
  const { reason, nextAttemptTime, maxAttempts = 3 } = data || {};

  await job.updateProgress(30);

  try {
    // Get current delivery details
    const delivery = await prisma.delivery.findFirst({
      where: { id: deliveryId },
      include: { customer: { include: { user: true } }, driver: { include: { user: true } }, pickupAddress: true }
    });

    if (!delivery) {
      throw new Error(`Delivery ${deliveryId} not found`);
    }

    const currentAttempts = typeof data?.attemptNumber === 'number' ? data.attemptNumber - 1 : job.attemptsMade;
    const newAttempts = currentAttempts + 1;

    await job.updateProgress(60);

    if (newAttempts >= maxAttempts) {
      // Max attempts reached - cancel using the schema lifecycle.
      await prisma.delivery.update({ where: { id: deliveryId }, data: {
        status: 'CANCELLED',
        cancellationReason: reason,
        cancelledAt: new Date(),
      } });

      // Notify customer of failed delivery
      await queueService.addJob(
        QUEUE_NAMES.NOTIFICATION,
        'push',
        {
          type: 'push',
          userId: delivery.customer.userId,
          title: 'Delivery Failed',
          body: `Unable to deliver your package after ${maxAttempts} attempts. Please contact support.`,
          data: { deliveryId, reason },
          category: 'delivery_failed',
          priority: 'high',
        }
      );

      logger.warn(`Delivery failed after ${maxAttempts} attempts`, {
        deliveryId,
        reason,
        attempts: newAttempts,
      });

    } else {
      // Schedule retry
      await prisma.delivery.update({ where: { id: deliveryId }, data: {
        status: 'REQUESTED',
        notes: reason,
      } });

      // Schedule next delivery attempt
      const retryDelay = nextAttemptTime 
        ? new Date(nextAttemptTime).getTime() - Date.now()
        : 3600000; // Default 1 hour delay

      await queueService.addDelayedJob(
        QUEUE_NAMES.DELIVERY,
        'assign_courier',
        {
          type: 'assign_courier',
          deliveryId,
          data: { 
            pickupLatitude: Number(delivery.pickupAddress.latitude),
            pickupLongitude: Number(delivery.pickupAddress.longitude),
            isRetry: true,
            attemptNumber: newAttempts + 1,
          }
        },
        Math.max(retryDelay, 0)
      );

      logger.info(`Delivery retry scheduled`, {
        deliveryId,
        attemptNumber: newAttempts,
        nextAttempt: new Date(Date.now() + retryDelay).toISOString(),
      });
    }

    await job.updateProgress(90);

    return {
      success: true,
      deliveryId,
      attempts: newAttempts,
      maxAttemptsReached: newAttempts >= maxAttempts,
      retryScheduled: newAttempts < maxAttempts,
    };

  } catch (error) {
    logger.error(`Failed delivery handling failed`, {
      deliveryId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get user-friendly delivery status message
 */
function getDeliveryStatusMessage(status: string): string {
  const messages = {
    PENDING: 'Your delivery request has been received.',
    ASSIGNING: 'Finding a courier for your delivery...',
    COURIER_ASSIGNED: 'A courier has been assigned to your delivery.',
    PICKED_UP: 'Your package has been picked up and is on the way.',
    IN_TRANSIT: 'Your package is in transit.',
    DELIVERED: 'Your package has been delivered successfully!',
    FAILED: 'Delivery attempt failed. We will retry soon.',
    CANCELLED: 'Your delivery has been cancelled.',
  };

  return messages[status as keyof typeof messages] || `Delivery status: ${status}`;
}
