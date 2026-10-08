import type { ProcessorJob } from './processor-job';
import { Prisma, PaymentMethod } from '../../generated/prisma';
import prisma from '../../config/database';
import { logger } from '../../config/logger';
import { queueService } from '../services/queue.service';
import { QUEUE_NAMES } from '../../config/queues';

export interface PaymentJobData {
  type: 'process_ride_payment' | 'process_refund' | 'wallet_top_up' | 'driver_payout' | 'payment_verification' | 'failed_payment_retry';
  paymentId?: string;
  rideId?: string;
  deliveryId?: string;
  userId?: string;
  driverId?: string;
  amount: number; // Job amounts are integer kobo; database monetary decimals are naira.
  currency?: string;
  paymentMethod?: 'card' | 'wallet' | 'bank_transfer' | 'cash';
  reference?: string;
  metadata?: Record<string, unknown>;
}

interface GatewayResult {
  success: boolean;
  reference: string;
  amount: number;
  currency: string;
}

// Development placeholder. Real providers and verified webhook settlement remain pending.
class MockPaymentGateway {
  async processPayment(amount: number, currency: string, reference: string): Promise<GatewayResult> {
    return { success: true, reference, amount, currency };
  }
  async verifyPayment(reference: string): Promise<GatewayResult> {
    // A mock cannot attest the amount of an external payment.
    throw new Error(`Payment verification requires a configured gateway: ${reference}`);
  }
  async processRefund(amount: number, currency: string, reference: string): Promise<GatewayResult> {
    return { success: true, reference: `${reference}_refund`, amount, currency };
  }
}
const paymentGateway = new MockPaymentGateway();

function required(value: string | undefined, label: string): string {
  if (!value) throw new Error(`${label} is required`);
  return value;
}
function naira(amount: number): Prisma.Decimal {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Payment amount must be positive integer kobo');
  return new Prisma.Decimal(amount).div(100);
}
function method(value: PaymentJobData['paymentMethod']): PaymentMethod {
  switch (value) {
    case 'wallet': return 'WALLET';
    case 'bank_transfer': return 'BANK_TRANSFER';
    case 'cash': return 'CASH';
    default: return 'CARD';
  }
}
async function customerWallet(userId: string) {
  const wallet = await prisma.wallet.findFirst({ where: { customer: { userId }, isActive: true } });
  if (!wallet) throw new Error(`Active customer wallet not found for ${userId}`);
  return wallet;
}

export async function paymentProcessor(job: ProcessorJob<PaymentJobData>) {
  await job.updateProgress(10);
  try {
    let result;
    switch (job.data.type) {
      case 'process_ride_payment': result = await handleTripPayment(job.data); break;
      case 'process_refund': result = await handleRefund(job); break;
      case 'wallet_top_up': result = await handleWalletTopUp(job); break;
      case 'driver_payout': result = await handleDriverPayout(job); break;
      case 'payment_verification': result = await handlePaymentVerification(job); break;
      case 'failed_payment_retry': result = await handlePaymentRetry(job); break;
      default: throw new Error(`Unknown payment job type: ${job.data.type}`);
    }
    await job.updateProgress(100);
    return result;
  } catch (error) {
    logger.error('Payment job failed', { jobId: job.id, type: job.data.type, error });
    throw error;
  }
}

async function handleTripPayment(data: PaymentJobData) {
  const { rideId, deliveryId, amount, paymentMethod } = data;
  if (!!rideId === !!deliveryId) throw new Error('Exactly one ride or delivery ID is required');
  const trip = rideId
    ? await prisma.ride.findUnique({ where: { id: rideId }, include: { customer: true } })
    : await prisma.delivery.findUnique({ where: { id: deliveryId }, include: { customer: true } });
  if (!trip) throw new Error('Trip not found');
  const value = naira(amount);
  const payment = rideId
    ? await prisma.payment.upsert({ where: { rideId }, create: { rideId, amount: value, method: method(paymentMethod), status: 'PROCESSING' }, update: {} })
    : await prisma.payment.upsert({ where: { deliveryId }, create: { deliveryId, amount: value, method: method(paymentMethod), status: 'PROCESSING' }, update: {} });
  if (payment.status === 'COMPLETED') return { success: true, paymentId: payment.id, alreadyProcessed: true };
  if (!payment.amount.equals(value)) throw new Error('Job amount does not match recorded payment');
  if (payment.method === 'WALLET') {
    throw new Error('Wallet trip settlement requires atomic debit implementation');
  }
  const gateway = await paymentGateway.processPayment(amount, payment.currency, payment.id);
  if (!gateway.success) throw new Error('Payment failed');
  const settled = await prisma.$transaction(async tx => {
    const claimed = await tx.payment.updateMany({ where: { id: payment.id, status: { in: ['PENDING', 'PROCESSING', 'FAILED'] } }, data: { status: 'COMPLETED', reference: gateway.reference, gatewayResponse: { ...gateway } } });
    if (!claimed.count) return false;
    if (trip.driverId) {
      const net = value.mul(0.8).toDecimalPlaces(2);
      const wallet = await tx.wallet.upsert({ where: { driverId: trip.driverId }, create: { driverId: trip.driverId, balance: net }, update: { balance: { increment: net } } });
      await tx.transaction.create({ data: { walletId: wallet.id, type: 'CREDIT', amount: net, status: 'COMPLETED', reference: `earning_${payment.id}` } });
      await tx.driverEarning.create({ data: { driverId: trip.driverId, rideId, deliveryId, grossAmount: value, commission: value.sub(net), netAmount: net } });
      await tx.driverProfile.update({ where: { id: trip.driverId }, data: { totalEarnings: { increment: net } } });
    }
    return true;
  });
  return { success: true, paymentId: payment.id, amount, settled };
}

async function handleRefund(job: ProcessorJob<PaymentJobData>) {
  const paymentId = required(job.data.paymentId, 'Payment ID');
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { ride: { include: { customer: true } }, delivery: { include: { customer: true } } } });
  if (!payment) throw new Error('Payment not found');
  if (payment.status === 'REFUNDED') return { success: true, paymentId, alreadyProcessed: true };
  const amount = naira(job.data.amount);
  if (payment.status !== 'COMPLETED' || !amount.equals(payment.amount)) {
    throw new Error('Only a completed payment can be fully refunded; partial refund accounting is pending');
  }
  const gateway = await paymentGateway.processRefund(job.data.amount, payment.currency, payment.reference ?? payment.id);
  if (!gateway.success) throw new Error('Refund failed');
  await prisma.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED', gatewayResponse: { ...gateway } } });
  const userId = payment.ride?.customer.userId ?? payment.delivery?.customer.userId;
  if (userId) await queueService.addJob(QUEUE_NAMES.NOTIFICATION, 'push', { type: 'push', userId, title: 'Refund Processed', body: `Your refund of NGN ${amount.toFixed(2)} has been processed`, data: { paymentId }, category: 'refund' });
  return { success: true, paymentId, reference: gateway.reference };
}

async function handleWalletTopUp(job: ProcessorJob<PaymentJobData>) {
  const userId = required(job.data.userId, 'User ID');
  const reference = required(job.data.reference, 'Payment reference');
  const value = naira(job.data.amount);
  const verification = await paymentGateway.verifyPayment(reference);
  if (!verification.success || verification.amount !== job.data.amount || verification.currency !== 'NGN') {
    throw new Error('Verified payment amount or currency does not match wallet top-up');
  }
  const wallet = await customerWallet(userId);
  const transaction = await prisma.$transaction(async tx => {
    const existing = await tx.transaction.findUnique({ where: { reference } });
    if (existing) {
      if (existing.walletId !== wallet.id || !existing.amount.equals(value) || existing.status !== 'COMPLETED') throw new Error('Payment reference already belongs to another transaction');
      return existing;
    }
    const created = await tx.transaction.create({ data: { walletId: wallet.id, type: 'CREDIT', amount: value, status: 'COMPLETED', reference, metadata: { ...verification } } });
    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: value } } });
    return created;
  });
  return { success: true, transactionId: transaction.id, userId };
}

async function handleDriverPayout(job: ProcessorJob<PaymentJobData>) {
  const driverId = required(job.data.driverId, 'Driver profile ID');
  const value = naira(job.data.amount);
  const driver = await prisma.driverProfile.findUnique({ where: { id: driverId }, include: { wallet: true } });
  if (!driver?.wallet?.isActive || driver.wallet.balance.lessThan(value)) throw new Error('Active driver wallet has insufficient funds');
  // Reserving funds, gateway idempotency, and payout reconciliation require the financial milestone.
  throw new Error('Driver payout settlement is not implemented');
}

async function handlePaymentVerification(job: ProcessorJob<PaymentJobData>) {
  const reference = required(job.data.reference, 'Payment reference');
  const verification = await paymentGateway.verifyPayment(reference);
  if (job.data.paymentId) {
    const payment = await prisma.payment.findUnique({ where: { id: job.data.paymentId } });
    if (!payment || !payment.amount.equals(naira(verification.amount)) || payment.currency !== verification.currency) throw new Error('Verified payment does not match recorded payment');
    await prisma.payment.update({ where: { id: payment.id }, data: { status: verification.success ? 'COMPLETED' : 'FAILED', gatewayResponse: { ...verification } } });
  }
  return verification;
}

async function handlePaymentRetry(job: ProcessorJob<PaymentJobData>) {
  const paymentId = required(job.data.paymentId, 'Payment ID');
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== 'FAILED') throw new Error('Failed payment not found');
  return handleTripPayment({ ...job.data, rideId: payment.rideId ?? undefined, deliveryId: payment.deliveryId ?? undefined, amount: Number(payment.amount.mul(100)), paymentMethod: payment.method === 'CARD' ? 'card' : payment.method === 'WALLET' ? 'wallet' : payment.method === 'CASH' ? 'cash' : 'bank_transfer' });
}
