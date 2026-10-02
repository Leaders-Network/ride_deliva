import { queueService, QueueConfig } from '../shared/services/queue.service';
import { smsProcessor } from '../shared/processors/sms.processor';
import { notificationProcessor } from '../shared/processors/notification.processor';
import { emailProcessor } from '../shared/processors/email.processor';
import { rideProcessor } from '../shared/processors/ride.processor';
import { paymentProcessor } from '../shared/processors/payment.processor';
import { deliveryProcessor } from '../shared/processors/delivery.processor';
import { logger } from './logger';

// Queue names
export const QUEUE_NAMES = {
  SMS: 'sms',
  EMAIL: 'email',
  NOTIFICATION: 'notification',
  RIDE: 'ride',
  PAYMENT: 'payment',
  DELIVERY: 'delivery',
} as const;

// Queue configurations
const queueConfigs: QueueConfig[] = [
  // SMS Queue - High priority, fast processing
  {
    name: QUEUE_NAMES.SMS,
    concurrency: 10,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 200,
      removeOnFail: 100,
    },
    processor: smsProcessor,
  },

  // Email Queue - Medium priority
  {
    name: QUEUE_NAMES.EMAIL,
    concurrency: 5,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
    processor: emailProcessor,
  },

  // Push Notification Queue - High priority
  {
    name: QUEUE_NAMES.NOTIFICATION,
    concurrency: 15,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 300,
      removeOnFail: 100,
    },
    processor: notificationProcessor,
  },

  // Ride Processing Queue - Critical operations
  {
    name: QUEUE_NAMES.RIDE,
    concurrency: 8,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 500,
      removeOnFail: 200,
    },
    processor: rideProcessor,
  },

  // Payment Processing Queue - High security, retry logic
  {
    name: QUEUE_NAMES.PAYMENT,
    concurrency: 3,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 1000,
      removeOnFail: 500,
    },
    processor: paymentProcessor,
  },

  // Delivery Processing Queue
  {
    name: QUEUE_NAMES.DELIVERY,
    concurrency: 6,
    defaultJobOptions: {
      attempts: 4,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
      removeOnComplete: 300,
      removeOnFail: 150,
    },
    processor: deliveryProcessor,
  },
];

/**
 * Initialize all queues
 */
export async function initializeQueues(): Promise<void> {
  try {
    logger.info('Initializing job queues...');

    for (const config of queueConfigs) {
      queueService.createQueue(config);
    }

    logger.info(`Successfully initialized ${queueConfigs.length} job queues`);
  } catch (error) {
    logger.error('Failed to initialize queues', { error });
    throw error;
  }
}

/**
 * Gracefully shutdown all queues
 */
export async function shutdownQueues(): Promise<void> {
  try {
    logger.info('Shutting down job queues...');
    await queueService.close();
    logger.info('All job queues shut down successfully');
  } catch (error) {
    logger.error('Error during queue shutdown', { error });
    throw error;
  }
}

// Export queue service for direct access
export { queueService };
