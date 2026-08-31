// Export all processor types and functions for easy importing
export { smsProcessor, type SMSJobData } from './sms.processor';
export { notificationProcessor, type NotificationJobData } from './notification.processor';
export { emailProcessor, type EmailJobData } from './email.processor';
export { rideProcessor, type RideJobData } from './ride.processor';
export { paymentProcessor, type PaymentJobData } from './payment.processor';
export { deliveryProcessor, type DeliveryJobData } from './delivery.processor';

// Re-export common types
export type ProcessorJobData = 
  | SMSJobData
  | NotificationJobData
  | EmailJobData
  | RideJobData
  | PaymentJobData
  | DeliveryJobData;