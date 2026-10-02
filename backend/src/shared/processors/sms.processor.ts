import { Job } from 'bullmq';
import { smsService } from '../services/sms.service';
import { logger } from '../../config/logger';

export interface SMSJobData {
  type: 'verification' | 'notification' | 'alert' | 'marketing';
  to: string;
  message: string;
  templateId?: string;
  variables?: Record<string, string>;
  priority?: 'high' | 'normal' | 'low';
  userId?: string;
  rideId?: string;
  deliveryId?: string;
  metadata?: Record<string, any>;
}

/**
 * SMS Job Processor
 * Handles all SMS-related background jobs
 */
export async function smsProcessor(job: Job<SMSJobData>): Promise<any> {
  const { type, to, message, templateId, variables, userId, rideId, deliveryId, metadata } = job.data;

  // Update job progress
  await job.updateProgress(10);

  logger.info(`Processing SMS job ${job.id}`, {
    jobId: job.id,
    type,
    to: to.replace(/(\d{3})\d{7}(\d{3})/, '$1*******$2'), // Mask phone number
    userId,
    rideId,
    deliveryId,
  });

  try {
    let result;

    switch (type) {
      case 'verification':
        result = await handleVerificationSMS(job);
        break;
      
      case 'notification':
        result = await handleNotificationSMS(job);
        break;
      
      case 'alert':
        result = await handleAlertSMS(job);
        break;
      
      case 'marketing':
        result = await handleMarketingSMS(job);
        break;
      
      default:
        throw new Error(`Unknown SMS job type: ${type}`);
    }

    await job.updateProgress(100);

    logger.info(`SMS job ${job.id} completed successfully`, {
      jobId: job.id,
      type,
      result,
    });

    return result;
  } catch (error) {
    logger.error(`SMS job ${job.id} failed`, {
      jobId: job.id,
      type,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle verification SMS (OTP, phone verification)
 */
async function handleVerificationSMS(job: Job<SMSJobData>) {
  const { to, message, templateId, variables } = job.data;

  await job.updateProgress(30);

  try {
    const result = await smsService.sendSMS(to, message);
    
    await job.updateProgress(80);
    
    // Log verification attempt
    logger.info('Verification SMS sent', {
      jobId: job.id,
      to: to.replace(/(\d{3})\d{7}(\d{3})/, '$1*******$2'),
      messageId: result.messageId,
    });

    return {
      sent: true,
      messageId: result.messageId,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Failed to send verification SMS', {
      jobId: job.id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle notification SMS (ride updates, delivery status)
 */
async function handleNotificationSMS(job: Job<SMSJobData>) {
  const { to, message, rideId, deliveryId, userId } = job.data;

  await job.updateProgress(30);

  try {
    const result = await smsService.sendSMS(to, message);
    
    await job.updateProgress(80);
    
    logger.info('Notification SMS sent', {
      jobId: job.id,
      to: to.replace(/(\d{3})\d{7}(\d{3})/, '$1*******$2'),
      messageId: result.messageId,
      rideId,
      deliveryId,
      userId,
    });

    return {
      sent: true,
      messageId: result.messageId,
      timestamp: new Date().toISOString(),
      rideId,
      deliveryId,
    };
  } catch (error) {
    logger.error('Failed to send notification SMS', {
      jobId: job.id,
      rideId,
      deliveryId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle alert SMS (urgent notifications, emergencies)
 */
async function handleAlertSMS(job: Job<SMSJobData>) {
  const { to, message, metadata } = job.data;

  await job.updateProgress(30);

  try {
    // For alerts, we might want to use a different service or priority
    const result = await smsService.sendSMS(to, message);
    
    await job.updateProgress(80);
    
    logger.warn('Alert SMS sent', {
      jobId: job.id,
      to: to.replace(/(\d{3})\d{7}(\d{3})/, '$1*******$2'),
      messageId: result.messageId,
      alertType: metadata?.alertType,
    });

    return {
      sent: true,
      messageId: result.messageId,
      timestamp: new Date().toISOString(),
      alertType: metadata?.alertType,
    };
  } catch (error) {
    logger.error('Failed to send alert SMS', {
      jobId: job.id,
      alertType: metadata?.alertType,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle marketing SMS (promotions, campaigns)
 */
async function handleMarketingSMS(job: Job<SMSJobData>) {
  const { to, message, metadata } = job.data;

  await job.updateProgress(30);

  try {
    // Check if user has opted out of marketing messages
    // This would typically check a database flag
    
    const result = await smsService.sendSMS(to, message);
    
    await job.updateProgress(80);
    
    logger.info('Marketing SMS sent', {
      jobId: job.id,
      to: to.replace(/(\d{3})\d{7}(\d{3})/, '$1*******$2'),
      messageId: result.messageId,
      campaignId: metadata?.campaignId,
    });

    return {
      sent: true,
      messageId: result.messageId,
      timestamp: new Date().toISOString(),
      campaignId: metadata?.campaignId,
    };
  } catch (error) {
    logger.error('Failed to send marketing SMS', {
      jobId: job.id,
      campaignId: metadata?.campaignId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
