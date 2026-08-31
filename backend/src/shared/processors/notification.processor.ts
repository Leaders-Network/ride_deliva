import { Job } from 'bullmq';
import { logger } from '../../config/logger';

export interface NotificationJobData {
  type: 'push' | 'in_app' | 'broadcast';
  userId?: string;
  userIds?: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  icon?: string;
  image?: string;
  sound?: string;
  badge?: number;
  priority?: 'high' | 'normal' | 'low';
  ttl?: number; // Time to live in seconds
  rideId?: string;
  deliveryId?: string;
  category?: string;
  actions?: Array<{
    id: string;
    title: string;
    icon?: string;
  }>;
  metadata?: Record<string, any>;
}

interface PushNotificationService {
  sendToUser(userId: string, notification: any): Promise<any>;
  sendToUsers(userIds: string[], notification: any): Promise<any>;
  sendBroadcast(notification: any, topic?: string): Promise<any>;
}

// Mock push notification service - replace with actual implementation (FCM, APNs, etc.)
class MockPushNotificationService implements PushNotificationService {
  async sendToUser(userId: string, notification: any): Promise<any> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    logger.info('Push notification sent to user', {
      userId,
      title: notification.title,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    });

    return {
      success: true,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };
  }

  async sendToUsers(userIds: string[], notification: any): Promise<any> {
    // Simulate batch API call
    await new Promise(resolve => setTimeout(resolve, 200));
    
    logger.info('Push notification sent to multiple users', {
      userCount: userIds.length,
      title: notification.title,
    });

    return {
      success: true,
      messageId: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sentCount: userIds.length,
      timestamp: new Date().toISOString(),
    };
  }

  async sendBroadcast(notification: any, topic?: string): Promise<any> {
    // Simulate broadcast API call
    await new Promise(resolve => setTimeout(resolve, 300));
    
    logger.info('Broadcast notification sent', {
      topic,
      title: notification.title,
    });

    return {
      success: true,
      messageId: `broadcast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      topic,
      timestamp: new Date().toISOString(),
    };
  }
}

const pushService = new MockPushNotificationService();

/**
 * Notification Job Processor
 * Handles all push notification-related background jobs
 */
export async function notificationProcessor(job: Job<NotificationJobData>): Promise<any> {
  const { type, userId, userIds, title, body, rideId, deliveryId, category } = job.data;

  await job.updateProgress(10);

  logger.info(`Processing notification job ${job.id}`, {
    jobId: job.id,
    type,
    userId,
    userCount: userIds?.length,
    title,
    rideId,
    deliveryId,
    category,
  });

  try {
    let result;

    switch (type) {
      case 'push':
        result = await handlePushNotification(job);
        break;
      
      case 'in_app':
        result = await handleInAppNotification(job);
        break;
      
      case 'broadcast':
        result = await handleBroadcastNotification(job);
        break;
      
      default:
        throw new Error(`Unknown notification job type: ${type}`);
    }

    await job.updateProgress(100);

    logger.info(`Notification job ${job.id} completed successfully`, {
      jobId: job.id,
      type,
      result,
    });

    return result;
  } catch (error) {
    logger.error(`Notification job ${job.id} failed`, {
      jobId: job.id,
      type,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle push notifications to specific users
 */
async function handlePushNotification(job: Job<NotificationJobData>) {
  const { 
    userId, 
    userIds, 
    title, 
    body, 
    data, 
    icon, 
    image, 
    sound, 
    badge, 
    priority, 
    ttl, 
    actions,
    category 
  } = job.data;

  await job.updateProgress(30);

  const notification = {
    title,
    body,
    data: {
      ...data,
      rideId: job.data.rideId,
      deliveryId: job.data.deliveryId,
      category,
    },
    icon,
    image,
    sound,
    badge,
    priority: priority || 'normal',
    ttl: ttl || 86400, // 24 hours default
    actions,
  };

  try {
    let result;

    if (userId) {
      // Send to single user
      result = await pushService.sendToUser(userId, notification);
      await job.updateProgress(80);
    } else if (userIds && userIds.length > 0) {
      // Send to multiple users
      result = await pushService.sendToUsers(userIds, notification);
      await job.updateProgress(80);
    } else {
      throw new Error('No userId or userIds provided for push notification');
    }

    logger.info('Push notification sent successfully', {
      jobId: job.id,
      userId,
      userCount: userIds?.length,
      messageId: result.messageId,
    });

    return result;
  } catch (error) {
    logger.error('Failed to send push notification', {
      jobId: job.id,
      userId,
      userCount: userIds?.length,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle in-app notifications (stored in database)
 */
async function handleInAppNotification(job: Job<NotificationJobData>) {
  const { userId, userIds, title, body, data, category, rideId, deliveryId } = job.data;

  await job.updateProgress(30);

  try {
    // Here you would typically save to database
    // For now, we'll simulate the database operation
    await new Promise(resolve => setTimeout(resolve, 50));

    const targetUsers = userId ? [userId] : (userIds || []);
    
    await job.updateProgress(80);

    logger.info('In-app notification created', {
      jobId: job.id,
      targetUsers,
      title,
      category,
      rideId,
      deliveryId,
    });

    return {
      success: true,
      notificationId: `inapp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      targetUsers,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Failed to create in-app notification', {
      jobId: job.id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle broadcast notifications (to all users or topic)
 */
async function handleBroadcastNotification(job: Job<NotificationJobData>) {
  const { title, body, data, category, metadata } = job.data;

  await job.updateProgress(30);

  const notification = {
    title,
    body,
    data: {
      ...data,
      category,
    },
  };

  try {
    const topic = metadata?.topic || 'all_users';
    const result = await pushService.sendBroadcast(notification, topic);
    
    await job.updateProgress(80);

    logger.info('Broadcast notification sent successfully', {
      jobId: job.id,
      topic,
      title,
      messageId: result.messageId,
    });

    return result;
  } catch (error) {
    logger.error('Failed to send broadcast notification', {
      jobId: job.id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}