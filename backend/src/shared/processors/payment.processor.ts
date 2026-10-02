import { Job } from 'bullmq';
import { logger } from '../../config/logger';
import { dbService as databaseService } from '../services/database';
import { queueService } from '../services/queue.service';
import { QUEUE_NAMES } from '../../config/queues';

export interface PaymentJobData {
  type: 'process_ride_payment' | 'process_refund' | 'wallet_top_up' | 'driver_payout' | 'payment_verification' | 'failed_payment_retry';
  paymentId?: string;
  rideId?: string;
  deliveryId?: string;
  userId?: string;
  driverId?: string;
  amount: number; // Amount in kobo
  currency?: string;
  paymentMethod?: 'card' | 'wallet' | 'bank_transfer' | 'cash';
  reference?: string;
  metadata?: Record<string, any>;
}

interface PaymentGateway {
  processPayment(data: any): Promise<any>;
  verifyPayment(reference: string): Promise<any>;
  processRefund(data: any): Promise<any>;
  transferToBank(data: any): Promise<any>;
}

// Mock payment gateway - replace with actual implementation (Paystack, Flutterwave, etc.)
class MockPaymentGateway implements PaymentGateway {
  async processPayment(data: any): Promise<any> {
    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const success = Math.random() > 0.1; // 90% success rate
    
    if (!success) {
      throw new Error('Payment failed: Insufficient funds');
    }

    return {
      success: true,
      reference: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'success',
      amount: data.amount,
      currency: data.currency,
      gateway_response: 'Approved',
      timestamp: new Date().toISOString(),
    };
  }

  async verifyPayment(reference: string): Promise<any> {
    // Simulate verification delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      success: true,
      reference,
      status: 'success',
      amount: Math.floor(Math.random() * 10000) + 1000,
      currency: 'NGN',
      timestamp: new Date().toISOString(),
    };
  }

  async processRefund(data: any): Promise<any> {
    // Simulate refund processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      success: true,
      refund_reference: `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount: data.amount,
      status: 'success',
      timestamp: new Date().toISOString(),
    };
  }

  async transferToBank(data: any): Promise<any> {
    // Simulate bank transfer delay
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return {
      success: true,
      transfer_reference: `tfr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount: data.amount,
      recipient: data.recipient,
      status: 'success',
      timestamp: new Date().toISOString(),
    };
  }
}

const paymentGateway = new MockPaymentGateway();

/**
 * Payment Job Processor
 * Handles all payment-related background jobs
 */
export async function paymentProcessor(job: Job<PaymentJobData>): Promise<any> {
  const { type, paymentId, rideId, deliveryId, userId, amount } = job.data;

  await job.updateProgress(10);

  logger.info(`Processing payment job ${job.id}`, {
    jobId: job.id,
    type,
    paymentId,
    rideId,
    deliveryId,
    userId,
    amount,
  });

  try {
    let result;

    switch (type) {
      case 'process_ride_payment':
        result = await handleRidePayment(job);
        break;
      
      case 'process_refund':
        result = await handleRefund(job);
        break;
      
      case 'wallet_top_up':
        result = await handleWalletTopUp(job);
        break;
      
      case 'driver_payout':
        result = await handleDriverPayout(job);
        break;
      
      case 'payment_verification':
        result = await handlePaymentVerification(job);
        break;
      
      case 'failed_payment_retry':
        result = await handleFailedPaymentRetry(job);
        break;
      
      default:
        throw new Error(`Unknown payment job type: ${type}`);
    }

    await job.updateProgress(100);

    logger.info(`Payment job ${job.id} completed successfully`, {
      jobId: job.id,
      type,
      result,
    });

    return result;
  } catch (error) {
    logger.error(`Payment job ${job.id} failed`, {
      jobId: job.id,
      type,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle ride payment processing
 */
async function handleRidePayment(job: Job<PaymentJobData>) {
  const { rideId, amount, paymentMethod = 'card', userId } = job.data;

  await job.updateProgress(20);

  try {
    // Get ride details
    const ride = await databaseService.findFirst('Ride', {
      where: { id: rideId },
      include: { user: true, driver: { include: { user: true } } }
    });

    if (!ride) {
      throw new Error(`Ride ${rideId} not found`);
    }

    await job.updateProgress(40);

    // Create payment record
    const payment = await databaseService.create('Payment', {
      id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: ride.userId,
      rideId,
      amount,
      paymentMethod,
      status: 'PROCESSING',
      createdAt: new Date(),
    });

    await job.updateProgress(60);

    // Process payment through gateway
    const paymentResult = await paymentGateway.processPayment({
      amount,
      currency: 'NGN',
      email: ride.user.email,
      reference: payment.id,
      paymentMethod,
    });

    await job.updateProgress(80);

    // Update payment status
    await databaseService.update('Payment', payment.id, {
      status: 'COMPLETED',
      gatewayResponse: JSON.stringify(paymentResult),
      processedAt: new Date(),
    });

    // Calculate driver earnings (80% of fare)
    const driverEarnings = Math.floor(amount * 0.8);
    const platformFee = amount - driverEarnings;

    // Update driver wallet
    if (ride.driverId) {
      await databaseService.update('Driver', ride.driverId, {
        walletBalance: {
          increment: driverEarnings
        }
      });

      // Send payout notification to driver
      await queueService.addJob(
        QUEUE_NAMES.NOTIFICATION,
        'push',
        {
          type: 'push',
          userId: ride.driverId,
          title: 'Payment Received',
          body: `You earned ₦${(driverEarnings / 100).toFixed(2)} from your last ride`,
          data: { rideId, amount: driverEarnings },
          category: 'earnings',
        }
      );
    }

    await job.updateProgress(90);

    logger.info(`Ride payment processed successfully`, {
      rideId,
      paymentId: payment.id,
      amount,
      driverEarnings,
      platformFee,
    });

    return {
      success: true,
      paymentId: payment.id,
      rideId,
      amount,
      driverEarnings,
      platformFee,
      reference: paymentResult.reference,
    };

  } catch (error) {
    logger.error(`Ride payment processing failed`, {
      rideId,
      amount,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle refund processing
 */
async function handleRefund(job: Job<PaymentJobData>) {
  const { paymentId, amount, metadata } = job.data;
  const { reason } = metadata || {};

  await job.updateProgress(30);

  try {
    // Get original payment
    const payment = await databaseService.findFirst('Payment', {
      where: { id: paymentId },
      include: { user: true, ride: true }
    });

    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    await job.updateProgress(50);

    // Process refund through gateway
    const refundResult = await paymentGateway.processRefund({
      amount,
      original_reference: payment.id,
      reason,
    });

    await job.updateProgress(80);

    // Create refund record
    const refund = await databaseService.create('Payment', {
      id: refundResult.refund_reference,
      userId: payment.userId,
      rideId: payment.rideId,
      amount: -amount, // Negative amount for refund
      paymentMethod: payment.paymentMethod,
      status: 'COMPLETED',
      type: 'REFUND',
      originalPaymentId: paymentId,
      gatewayResponse: JSON.stringify(refundResult),
      createdAt: new Date(),
      processedAt: new Date(),
    });

    // Send refund notification
    await queueService.addJob(
      QUEUE_NAMES.NOTIFICATION,
      'push',
      {
        type: 'push',
        userId: payment.userId,
        title: 'Refund Processed',
        body: `Your refund of ₦${(amount / 100).toFixed(2)} has been processed`,
        data: { refundId: refund.id, amount },
        category: 'refund',
      }
    );

    await job.updateProgress(90);

    logger.info(`Refund processed successfully`, {
      paymentId,
      refundId: refund.id,
      amount,
      reason,
    });

    return {
      success: true,
      refundId: refund.id,
      originalPaymentId: paymentId,
      amount,
      reference: refundResult.refund_reference,
    };

  } catch (error) {
    logger.error(`Refund processing failed`, {
      paymentId,
      amount,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle wallet top-up
 */
async function handleWalletTopUp(job: Job<PaymentJobData>) {
  const { userId, amount, reference } = job.data;

  await job.updateProgress(30);

  try {
    // Verify payment with gateway
    const verificationResult = await paymentGateway.verifyPayment(reference!);

    if (!verificationResult.success) {
      throw new Error('Payment verification failed');
    }

    await job.updateProgress(60);

    // Update user wallet
    await databaseService.update('User', userId!, {
      walletBalance: {
        increment: amount
      }
    });

    // Create wallet transaction record
    const transaction = await databaseService.create('Payment', {
      id: `wallet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: userId!,
      amount,
      paymentMethod: 'card',
      status: 'COMPLETED',
      type: 'WALLET_TOP_UP',
      gatewayResponse: JSON.stringify(verificationResult),
      createdAt: new Date(),
      processedAt: new Date(),
    });

    await job.updateProgress(90);

    logger.info(`Wallet top-up processed successfully`, {
      userId,
      amount,
      transactionId: transaction.id,
    });

    return {
      success: true,
      transactionId: transaction.id,
      userId,
      amount,
      newBalance: await getUserWalletBalance(userId!),
    };

  } catch (error) {
    logger.error(`Wallet top-up failed`, {
      userId,
      amount,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle driver payout
 */
async function handleDriverPayout(job: Job<PaymentJobData>) {
  const { driverId, amount, metadata } = job.data;
  const { bankAccount } = metadata || {};

  await job.updateProgress(30);

  try {
    // Get driver details
    const driver = await databaseService.findFirst('Driver', {
      where: { userId: driverId },
      include: { user: true }
    });

    if (!driver) {
      throw new Error(`Driver ${driverId} not found`);
    }

    await job.updateProgress(50);

    // Process bank transfer
    const transferResult = await paymentGateway.transferToBank({
      amount,
      recipient: bankAccount || driver.bankAccount,
      reason: 'Driver payout',
    });

    await job.updateProgress(80);

    // Update driver wallet (deduct payout amount)
    await databaseService.update('Driver', driverId!, {
      walletBalance: {
        decrement: amount
      }
    });

    // Create payout record
    const payout = await databaseService.create('Payment', {
      id: transferResult.transfer_reference,
      userId: driverId!,
      amount: -amount, // Negative amount for payout
      paymentMethod: 'bank_transfer',
      status: 'COMPLETED',
      type: 'DRIVER_PAYOUT',
      gatewayResponse: JSON.stringify(transferResult),
      createdAt: new Date(),
      processedAt: new Date(),
    });

    await job.updateProgress(90);

    logger.info(`Driver payout processed successfully`, {
      driverId,
      amount,
      payoutId: payout.id,
    });

    return {
      success: true,
      payoutId: payout.id,
      driverId,
      amount,
      reference: transferResult.transfer_reference,
    };

  } catch (error) {
    logger.error(`Driver payout failed`, {
      driverId,
      amount,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle payment verification
 */
async function handlePaymentVerification(job: Job<PaymentJobData>) {
  const { reference, paymentId } = job.data;

  await job.updateProgress(30);

  try {
    // Verify payment with gateway
    const verificationResult = await paymentGateway.verifyPayment(reference!);

    await job.updateProgress(70);

    if (paymentId) {
      // Update existing payment record
      await databaseService.update('Payment', paymentId, {
        status: verificationResult.success ? 'COMPLETED' : 'FAILED',
        gatewayResponse: JSON.stringify(verificationResult),
        processedAt: new Date(),
      });
    }

    await job.updateProgress(90);

    logger.info(`Payment verification completed`, {
      reference,
      paymentId,
      success: verificationResult.success,
    });

    return {
      success: verificationResult.success,
      reference,
      paymentId,
      verificationResult,
    };

  } catch (error) {
    logger.error(`Payment verification failed`, {
      reference,
      paymentId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Handle failed payment retry
 */
async function handleFailedPaymentRetry(job: Job<PaymentJobData>) {
  const { paymentId, rideId } = job.data;

  await job.updateProgress(30);

  try {
    // Get failed payment details
    const payment = await databaseService.findFirst('Payment', {
      where: { id: paymentId },
      include: { user: true, ride: true }
    });

    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    await job.updateProgress(50);

    // Retry payment processing
    const retryResult = await paymentGateway.processPayment({
      amount: payment.amount,
      currency: 'NGN',
      email: payment.user.email,
      reference: `${payment.id}_retry_${Date.now()}`,
    });

    await job.updateProgress(80);

    // Update payment status
    await databaseService.update('Payment', paymentId!, {
      status: 'COMPLETED',
      gatewayResponse: JSON.stringify(retryResult),
      processedAt: new Date(),
    });

    await job.updateProgress(90);

    logger.info(`Payment retry successful`, {
      paymentId,
      rideId,
      retryReference: retryResult.reference,
    });

    return {
      success: true,
      paymentId,
      rideId,
      retryReference: retryResult.reference,
    };

  } catch (error) {
    logger.error(`Payment retry failed`, {
      paymentId,
      rideId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get user wallet balance
 */
async function getUserWalletBalance(userId: string): Promise<number> {
  const user = await databaseService.findFirst('User', {
    where: { id: userId },
    select: { walletBalance: true }
  });

  return user?.walletBalance || 0;
}
