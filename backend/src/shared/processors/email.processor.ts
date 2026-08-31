import { Job } from 'bullmq';
import { logger } from '../../config/logger';

export interface EmailJobData {
  type: 'transactional' | 'marketing' | 'system' | 'receipt' | 'notification';
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  templateId?: string;
  htmlContent?: string;
  textContent?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  variables?: Record<string, any>;
  userId?: string;
  rideId?: string;
  deliveryId?: string;
  paymentId?: string;
  priority?: 'high' | 'normal' | 'low';
  metadata?: Record<string, any>;
}

interface EmailService {
  sendTransactional(emailData: any): Promise<any>;
  sendMarketing(emailData: any): Promise<any>;
  sendSystem(emailData: any): Promise<any>;
}

// Mock email service - replace with actual implementation (SendGrid, SES, etc.)
class MockEmailService implements EmailService {
  async sendTransactional(emailData: any): Promise<any> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    logger.info('Transactional email sent', {
      to: Array.isArray(emailData.to) ? emailData.to.join(', ') : emailData.to,
      subject: emailData.subject,
    });

    return {
      success: true,
      messageId: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };
  }

  async sendMarketing(emailData: any): Promise<any> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    logger.info('Marketing email sent', {
      to: Array.isArray(emailData.to) ? emailData.to.join(', ') : emailData.to,
      subject: emailData.subject,
    });

    return {
      success: true,
      messageId: `marketing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };
  }

  async sendSystem(emailData: any): Promise<any> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 150));
    
    logger.info('System email sent', {
      to: Array.isArray(emailData.to) ? emailData.to.join(', ') : emailData.to,
      subject: emailData.subject,
    });

    return {
      success: true,
      messageId: `system_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };
  }
}

const emailService = new MockEmailService();

/**
 * Email Job Processor
 * Handles all email-related background jobs
 */
export async function emailProcessor(job: Job<EmailJobData>): Promise<any> {
  const { type, to, subject, userId, rideId, deliveryId, paymentId } = job.data;

  await job.updateProgress(10);

  logger.info(`Processing email job ${job.id}`, {
    jobId: job.id,
    type,
    to: Array.isArray(to) ? `${to.length} recipients` : to,
    subject,
    userId,
    rideId,
    deliveryId,
    paymentId,
  });

  try {
    let result;

    switch (type) {
      case 'transactional':
        result = await handleTransactionalEmail(job);
        break;
      
      case 'marketing':
        result = await handleMarketingEmail(job);
        break;
      
      case 'system':
        result = await handleSystemEmail(job);
        break;
      
      case 'receipt':
        result = await handleReceiptEmail(job);
        break;
      
      case 'notification':
        result = await handleNotificationEmail(job);
        break;
      
      default:
        throw new Error(`Unknown email job type: ${type}`);
    }

    await job.updateProgress(100);

    logger.info(`Email job ${job.id} completed successfully`, {
      jobId: job.id,
      type,
      result,
    });

    return result;
  } catch (error) {
    logger.error(`Email job ${job.id} failed`, {
      jobId: job.id,
      type,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle transactional emails (account verification, password reset, etc.)
 */
async function handleTransactionalEmail(job: Job<EmailJobData>) {
  const { 
    to, 
    cc, 
    bcc, 
    subject, 
    templateId, 
    htmlContent, 
    textContent, 
    variables, 
    attachments 
  } = job.data;

  await job.updateProgress(30);

  const emailData = {
    to,
    cc,
    bcc,
    subject,
    templateId,
    htmlContent,
    textContent,
    variables,
    attachments,
  };

  try {
    const result = await emailService.sendTransactional(emailData);
    
    await job.updateProgress(80);

    logger.info('Transactional email sent successfully', {
      jobId: job.id,
      to: Array.isArray(to) ? `${to.length} recipients` : to,
      subject,
      messageId: result.messageId,
    });

    return result;
  } catch (error) {
    logger.error('Failed to send transactional email', {
      jobId: job.id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle marketing emails (campaigns, promotions)
 */
async function handleMarketingEmail(job: Job<EmailJobData>) {
  const { to, subject, templateId, htmlContent, variables, metadata } = job.data;

  await job.updateProgress(30);

  // Check if user has opted out of marketing emails
  // This would typically check a database flag

  const emailData = {
    to,
    subject,
    templateId,
    htmlContent,
    variables,
    campaignId: metadata?.campaignId,
  };

  try {
    const result = await emailService.sendMarketing(emailData);
    
    await job.updateProgress(80);

    logger.info('Marketing email sent successfully', {
      jobId: job.id,
      to: Array.isArray(to) ? `${to.length} recipients` : to,
      subject,
      campaignId: metadata?.campaignId,
      messageId: result.messageId,
    });

    return result;
  } catch (error) {
    logger.error('Failed to send marketing email', {
      jobId: job.id,
      campaignId: metadata?.campaignId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle system emails (alerts, notifications)
 */
async function handleSystemEmail(job: Job<EmailJobData>) {
  const { to, subject, htmlContent, textContent, metadata } = job.data;

  await job.updateProgress(30);

  const emailData = {
    to,
    subject,
    htmlContent,
    textContent,
    priority: 'high', // System emails are high priority
  };

  try {
    const result = await emailService.sendSystem(emailData);
    
    await job.updateProgress(80);

    logger.info('System email sent successfully', {
      jobId: job.id,
      to: Array.isArray(to) ? `${to.length} recipients` : to,
      subject,
      alertType: metadata?.alertType,
      messageId: result.messageId,
    });

    return result;
  } catch (error) {
    logger.error('Failed to send system email', {
      jobId: job.id,
      alertType: metadata?.alertType,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle receipt emails (ride receipts, payment confirmations)
 */
async function handleReceiptEmail(job: Job<EmailJobData>) {
  const { 
    to, 
    subject, 
    templateId, 
    variables, 
    rideId, 
    deliveryId, 
    paymentId, 
    attachments 
  } = job.data;

  await job.updateProgress(30);

  const emailData = {
    to,
    subject,
    templateId,
    variables: {
      ...variables,
      rideId,
      deliveryId,
      paymentId,
      receiptDate: new Date().toLocaleDateString(),
    },
    attachments, // PDF receipt, etc.
  };

  try {
    const result = await emailService.sendTransactional(emailData);
    
    await job.updateProgress(80);

    logger.info('Receipt email sent successfully', {
      jobId: job.id,
      to,
      subject,
      rideId,
      deliveryId,
      paymentId,
      messageId: result.messageId,
    });

    return result;
  } catch (error) {
    logger.error('Failed to send receipt email', {
      jobId: job.id,
      rideId,
      deliveryId,
      paymentId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle notification emails (ride updates, delivery status)
 */
async function handleNotificationEmail(job: Job<EmailJobData>) {
  const { to, subject, templateId, variables, rideId, deliveryId } = job.data;

  await job.updateProgress(30);

  const emailData = {
    to,
    subject,
    templateId,
    variables: {
      ...variables,
      rideId,
      deliveryId,
    },
  };

  try {
    const result = await emailService.sendTransactional(emailData);
    
    await job.updateProgress(80);

    logger.info('Notification email sent successfully', {
      jobId: job.id,
      to,
      subject,
      rideId,
      deliveryId,
      messageId: result.messageId,
    });

    return result;
  } catch (error) {
    logger.error('Failed to send notification email', {
      jobId: job.id,
      rideId,
      deliveryId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}