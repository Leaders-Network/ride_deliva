import { Twilio } from 'twilio';
import { config } from '@/config';
import { logger } from '@/config/logger';

export interface SMSOptions {
  to: string;
  message: string;
  type?: 'verification' | 'notification' | 'promotional';
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  cost?: number;
}

class SMSService {
  private client: Twilio | null = null;
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = !!(config.services.twilio.accountSid && config.services.twilio.authToken);
    
    if (this.isEnabled) {
      this.client = new Twilio(
        config.services.twilio.accountSid!,
        config.services.twilio.authToken!
      );
    } else {
      logger.warn('SMS service not configured - Twilio credentials missing');
    }
  }

  // Send SMS message
  async sendSMS(options: SMSOptions): Promise<SMSResult> {
    const { to, message, type = 'notification' } = options;

    // In development mode, just log the message
    if (config.app.env === 'development') {
      logger.info('SMS (Development Mode)', {
        to,
        message,
        type,
      });
      
      return {
        success: true,
        messageId: `dev_${Date.now()}`,
      };
    }

    // If SMS is not configured, log and return success (for testing)
    if (!this.isEnabled || !this.client) {
      logger.warn('SMS not sent - service not configured', { to, type });
      return {
        success: true,
        messageId: `mock_${Date.now()}`,
      };
    }

    try {
      const result = await this.client.messages.create({
        body: message,
        from: config.services.twilio.phoneNumber,
        to: to,
      });

      logger.info('SMS sent successfully', {
        to,
        messageId: result.sid,
        status: result.status,
        type,
      });

      return {
        success: true,
        messageId: result.sid,
        cost: parseFloat(result.price || '0'),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown SMS error';
      
      logger.error('Failed to send SMS', {
        to,
        type,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // Send verification code SMS
  async sendVerificationCode(phoneNumber: string, code: string): Promise<SMSResult> {
    const message = `Your Ride Deliva verification code is: ${code}. This code will expire in 5 minutes. Do not share this code with anyone.`;
    
    return this.sendSMS({
      to: phoneNumber,
      message,
      type: 'verification',
    });
  }

  // Send password reset code
  async sendPasswordResetCode(phoneNumber: string, code: string): Promise<SMSResult> {
    const message = `Your Ride Deliva password reset code is: ${code}. This code will expire in 5 minutes. If you didn't request this, please ignore.`;
    
    return this.sendSMS({
      to: phoneNumber,
      message,
      type: 'verification',
    });
  }

  // Send ride notification
  async sendRideNotification(phoneNumber: string, message: string): Promise<SMSResult> {
    return this.sendSMS({
      to: phoneNumber,
      message: `Ride Deliva: ${message}`,
      type: 'notification',
    });
  }

  // Send delivery notification
  async sendDeliveryNotification(phoneNumber: string, message: string): Promise<SMSResult> {
    return this.sendSMS({
      to: phoneNumber,
      message: `Ride Deliva Delivery: ${message}`,
      type: 'notification',
    });
  }

  // Send promotional SMS
  async sendPromotional(phoneNumber: string, message: string): Promise<SMSResult> {
    return this.sendSMS({
      to: phoneNumber,
      message: `Ride Deliva Promo: ${message}`,
      type: 'promotional',
    });
  }

  // Validate phone number format
  validatePhoneNumber(phoneNumber: string): { isValid: boolean; error?: string } {
    // Basic E.164 format validation
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    
    if (!e164Regex.test(phoneNumber)) {
      return {
        isValid: false,
        error: 'Phone number must be in E.164 format (e.g., +1234567890)',
      };
    }

    // Nigerian phone number specific validation
    const nigerianRegex = /^\+234[789][01]\d{8}$/;
    if (phoneNumber.startsWith('+234') && !nigerianRegex.test(phoneNumber)) {
      return {
        isValid: false,
        error: 'Invalid Nigerian phone number format',
      };
    }

    return { isValid: true };
  }

  // Get SMS delivery status (if supported by provider)
  async getDeliveryStatus(messageId: string): Promise<{
    status: string;
    deliveredAt?: Date;
    errorCode?: string;
  } | null> {
    if (!this.isEnabled || !this.client) {
      return null;
    }

    try {
      const message = await this.client.messages(messageId).fetch();
      
      return {
        status: message.status,
        deliveredAt: message.dateUpdated || undefined,
        errorCode: message.errorCode?.toString(),
      };
    } catch (error) {
      logger.error('Failed to fetch SMS status', { messageId, error });
      return null;
    }
  }

  // Check if SMS service is available
  isServiceAvailable(): boolean {
    return this.isEnabled;
  }

  // Get account balance (if supported)
  async getAccountBalance(): Promise<{ balance?: number; currency?: string } | null> {
    if (!this.isEnabled || !this.client) {
      return null;
    }

    try {
      const account = await this.client.api.accounts.list();
      // Note: Twilio doesn't provide balance info directly in the API
      // This would need to be implemented based on your Twilio account setup
      return { balance: 0, currency: 'USD' };
    } catch (error) {
      logger.error('Failed to fetch account balance', { error });
      return null;
    }
  }
}

// Template messages
export const SMSTemplates = {
  verification: (code: string, appName: string = 'Ride Deliva') =>
    `Your ${appName} verification code is: ${code}. This code will expire in 5 minutes. Do not share this code with anyone.`,

  passwordReset: (code: string, appName: string = 'Ride Deliva') =>
    `Your ${appName} password reset code is: ${code}. This code will expire in 5 minutes. If you didn't request this, please ignore.`,

  rideConfirmed: (rideCode: string, driverName: string) =>
    `Your ride (${rideCode}) has been confirmed! ${driverName} is your driver and will arrive shortly.`,

  rideStarted: (rideCode: string, estimatedArrival: string) =>
    `Your ride (${rideCode}) has started! Estimated arrival: ${estimatedArrival}.`,

  rideCompleted: (rideCode: string, fare: number) =>
    `Your ride (${rideCode}) is complete! Total fare: ₦${fare.toLocaleString()}. Thank you for using Ride Deliva!`,

  deliveryPickedUp: (deliveryCode: string, estimatedDelivery: string) =>
    `Your delivery (${deliveryCode}) has been picked up! Estimated delivery: ${estimatedDelivery}.`,

  deliveryCompleted: (deliveryCode: string) =>
    `Your delivery (${deliveryCode}) has been completed! Thank you for using Ride Deliva Delivery.`,

  promotional: (offer: string, code?: string) =>
    `🎉 Special Offer: ${offer}${code ? ` Use code: ${code}` : ''}. Valid for limited time only!`,

  welcome: (firstName: string) =>
    `Welcome to Ride Deliva, ${firstName}! Your account has been verified. Start booking rides and deliveries today!`,

  driverApproved: (firstName: string) =>
    `Congratulations ${firstName}! Your driver application has been approved. You can now start accepting rides.`,
};

// Export singleton instance
export const smsService = new SMSService();
