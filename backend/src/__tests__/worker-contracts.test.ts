import { Prisma } from '@/generated/prisma';
import prisma from '@/config/database';
import { queueService } from '@/config/queues';
import { rideProcessor } from '@/shared/processors/ride.processor';
import { deliveryProcessor } from '@/shared/processors/delivery.processor';
import { paymentProcessor } from '@/shared/processors/payment.processor';
import type { ProcessorJob } from '@/shared/processors/processor-job';

jest.mock('@/config/database', () => ({
  __esModule: true,
  default: {
    ride: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    delivery: { update: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn() },
    payment: { upsert: jest.fn() },
    wallet: { update: jest.fn() },
    driverProfile: { update: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('@/config/queues', () => ({
  QUEUE_NAMES: { PAYMENT: 'payment', EMAIL: 'email', NOTIFICATION: 'notification' },
  queueService: { addJob: jest.fn() },
}));
jest.mock('@/shared/services/queue.service', () => ({
  queueService: jest.requireMock('@/config/queues').queueService,
}));

jest.mock('@/shared/services/database', () => ({ dbService: { findNearbyDrivers: jest.fn() } }));
jest.mock('@/modules/payments/services/payment.service', () => ({
  paymentService: { onTripCompleted: jest.fn(), onTripCancelled: jest.fn(), refresh: jest.fn(), reconcilePending: jest.fn() },
}));
jest.mock('@/modules/payments/services/payout.service', () => ({
  payoutService: { runBatch: jest.fn(), reconcileProcessing: jest.fn() },
}));
import { paymentService } from '@/modules/payments/services/payment.service';

function job<T>(data: T): ProcessorJob<T> {
  return { id: 'job-id', data, attemptsMade: 0, updateProgress: jest.fn().mockResolvedValue(undefined) };
}

describe('Worker contracts against the Prisma schema', () => {
  beforeEach(() => jest.resetAllMocks());

  // Regression: matching used to finish with an unconditional `status: 'REQUESTED'` write, which
  // reverted requests a driver had accepted (and moved on) while the job was running.
  describe('matching never rewrites the request status', () => {
    const { dbService } = jest.requireMock('@/shared/services/database');
    const nearby = [{ id: 'drv', distance: 800, averageRating: 4.8, vehicleType: 'MOTORCYCLE' }];
    const pickup = { pickupLatitude: 6.45, pickupLongitude: 3.47 };

    it.each([
      ['ride', () => rideProcessor(job({ type: 'match_driver', rideId: 'ride', data: pickup })), () => prisma.ride],
      ['delivery', () => deliveryProcessor(job({ type: 'assign_courier', deliveryId: 'delivery', data: pickup })), () => prisma.delivery],
    ] as const)('%s: notifies nearby drivers without touching status', async (_name, run, model) => {
      jest.mocked(model().findFirst as jest.Mock).mockResolvedValue({ id: 'x', deliveryType: 'STANDARD' });
      dbService.findNearbyDrivers.mockResolvedValue(nearby);
      jest.mocked(queueService.addJob).mockResolvedValue({} as never);

      await expect(run()).resolves.toMatchObject({ success: true });
      expect(model().update).not.toHaveBeenCalled();
    });

    it.each([
      ['ride', () => rideProcessor(job({ type: 'match_driver', rideId: 'ride', data: pickup })), () => prisma.ride],
      ['delivery', () => deliveryProcessor(job({ type: 'assign_courier', deliveryId: 'delivery', data: pickup })), () => prisma.delivery],
    ] as const)('%s: skips quietly once the request was accepted or cancelled', async (_name, run, model) => {
      jest.mocked(model().findFirst as jest.Mock).mockResolvedValue(null);

      await expect(run()).resolves.toMatchObject({ reason: 'not_requested', retryScheduled: false });
      expect(dbService.findNearbyDrivers).not.toHaveBeenCalled();
      expect(model().update).not.toHaveBeenCalled();
    });
  });

  it('stores a ride quote in naira while returning the calculation in kobo', async () => {
    const result = await rideProcessor(job({ type: 'calculate_fare', rideId: 'ride', data: { distance: 1000, duration: 60 } }));
    expect(prisma.ride.update).toHaveBeenCalledWith({ where: { id: 'ride' }, data: { estimatedFare: 7.5, surgeMultiplier: 1 } });
    expect(result.fareBreakdown?.totalFare).toBe(750);
  });

  it('stores a delivery quote in naira', async () => {
    await deliveryProcessor(job({ type: 'calculate_delivery_fee', deliveryId: 'delivery', data: { distance: 1000, packageType: 'DOCUMENT', packageWeight: 1 } }));
    expect(prisma.delivery.update).toHaveBeenCalledWith({ where: { id: 'delivery' }, data: { estimatedFare: 9.5 } });
  });

  it('rejects an unknown ride status before writing it', async () => {
    await expect(rideProcessor(job({ type: 'update_status', rideId: 'ride', data: { status: 'MATCHING' } }))).rejects.toThrow('Invalid ride status');
    expect(prisma.ride.update).not.toHaveBeenCalled();
  });

  it('rejects an unknown delivery status before writing it', async () => {
    await expect(deliveryProcessor(job({ type: 'update_status', deliveryId: 'delivery', data: { status: 'ASSIGNING' } }))).rejects.toThrow('Invalid delivery status');
    expect(prisma.delivery.update).not.toHaveBeenCalled();
  });

  it('rejects assignment without a driver before modifying the ride', async () => {
    await expect(rideProcessor(job({ type: 'driver_assignment', rideId: 'ride' }))).rejects.toThrow('Driver ID is required');
    expect(prisma.ride.update).not.toHaveBeenCalled();
  });

  it('schedules a completed ride payment with the supported job type and kobo amount', async () => {
    jest.mocked(prisma.ride.update).mockResolvedValue({ finalFare: new Prisma.Decimal(2300), estimatedFare: new Prisma.Decimal(2500) } as Awaited<ReturnType<typeof prisma.ride.update>>);
    jest.mocked(prisma.ride.findFirst).mockResolvedValue(null);
    await rideProcessor(job({ type: 'complete_ride', rideId: 'ride' }));
    expect(queueService.addJob).toHaveBeenCalledWith('payment', 'process_ride_payment', { type: 'process_ride_payment', rideId: 'ride', amount: 230000 });
  });

  it('delegates trip payment jobs to the idempotent settlement hook, ignoring the job amount', async () => {
    await paymentProcessor(job({ type: 'process_delivery_payment', deliveryId: 'delivery', amount: 1 }));
    await paymentProcessor(job({ type: 'process_ride_payment', rideId: 'ride', amount: 230000 }));
    expect(paymentService.onTripCompleted).toHaveBeenCalledWith('delivery', 'delivery');
    expect(paymentService.onTripCompleted).toHaveBeenCalledWith('ride', 'ride');
    expect(prisma.payment.upsert).not.toHaveBeenCalled();
  });

  it('rejects a trip payment job without its trip ID', async () => {
    await expect(paymentProcessor(job({ type: 'process_ride_payment', amount: 230000 }))).rejects.toThrow('Ride ID is required');
    expect(paymentService.onTripCompleted).not.toHaveBeenCalled();
  });

  it('refuses to credit a wallet from a queued top-up (only provider verification can)', async () => {
    await expect(paymentProcessor(job({ type: 'wallet_top_up', userId: 'user', reference: 'external', amount: 10000 }))).rejects.toThrow('provider verification');
    expect(prisma.wallet.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
