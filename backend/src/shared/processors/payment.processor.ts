import type { ProcessorJob } from './processor-job';
import prisma from '../../config/database';
import { logger } from '../../config/logger';
import { paymentService } from '../../modules/payments/services/payment.service';
import { payoutService } from '../../modules/payments/services/payout.service';

export interface PaymentJobData {
  type:
    | 'process_ride_payment'
    | 'process_delivery_payment'
    | 'process_refund'
    | 'payment_verification'
    | 'reconcile_payments'
    | 'driver_payout_batch'
    // Legacy job types from the pre-provider worker; kept so old helpers still type-check.
    | 'wallet_top_up'
    | 'driver_payout'
    | 'failed_payment_retry';
  paymentId?: string;
  rideId?: string;
  deliveryId?: string;
  userId?: string;
  driverId?: string;
  /** Integer kobo where present. Settlement always uses the server-side fare, never this. */
  amount?: number;
  currency?: string;
  paymentMethod?: 'card' | 'wallet' | 'bank_transfer' | 'cash' | 'mobile_money';
  reference?: string;
  batchKey?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Thin queue adapter over the payments module. Every handler is idempotent, so BullMQ
 * retries are safe. Money logic lives in PaymentService / PayoutService, not here.
 */
export async function paymentProcessor(job: ProcessorJob<PaymentJobData>) {
  await job.updateProgress(10);
  const { data } = job;
  try {
    let result: unknown;
    switch (data.type) {
      case 'process_ride_payment':
        if (!data.rideId) throw new Error('Ride ID is required');
        await paymentService.onTripCompleted('ride', data.rideId);
        result = { success: true, rideId: data.rideId };
        break;
      case 'process_delivery_payment':
        if (!data.deliveryId) throw new Error('Delivery ID is required');
        await paymentService.onTripCompleted('delivery', data.deliveryId);
        result = { success: true, deliveryId: data.deliveryId };
        break;
      case 'process_refund':
        result = await refund(data);
        break;
      case 'payment_verification':
      case 'failed_payment_retry':
        if (!data.paymentId) throw new Error('Payment ID is required');
        result = { success: true, status: (await paymentService.refresh(data.paymentId)).status };
        break;
      case 'reconcile_payments':
        result = { payments: await paymentService.reconcilePending(), payouts: await payoutService.reconcileProcessing() };
        break;
      case 'driver_payout_batch':
        result = await payoutService.runBatch(data.batchKey);
        break;
      case 'wallet_top_up':
        throw new Error('Wallet top-ups are settled by provider verification (POST /payments/wallet/top-up), not queued');
      case 'driver_payout':
        throw new Error('Individual payouts are not queued; use driver_payout_batch');
      default:
        throw new Error(`Unknown payment job type: ${(data as { type: string }).type}`);
    }
    await job.updateProgress(100);
    return result;
  } catch (error) {
    logger.error('Payment job failed', { jobId: job.id, type: data.type, error: String(error) });
    throw error;
  }
}

/** Cancels the trip-side effect of a completed payment by refunding it to the wallet. */
async function refund(data: PaymentJobData) {
  if (!data.paymentId) throw new Error('Payment ID is required');
  const payment = await prisma.payment.findUnique({ where: { id: data.paymentId }, select: { rideId: true, deliveryId: true, status: true } });
  if (!payment) throw new Error('Payment not found');
  if (payment.status === 'REFUNDED') return { success: true, alreadyProcessed: true };
  if (payment.rideId) await paymentService.onTripCancelled('ride', payment.rideId);
  else if (payment.deliveryId) await paymentService.onTripCancelled('delivery', payment.deliveryId);
  else throw new Error('Only trip payments can be refunded');
  return { success: true, paymentId: data.paymentId };
}
