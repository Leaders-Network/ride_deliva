// Payment settlement with a mocked Prisma client: the rules that move money (completion,
// MoMo cashback, driver share, unmatched-payment credit, overdraft guard) and the
// signature checks that gate provider callbacks.
const db = {
  $transaction: jest.fn(),
  $executeRaw: jest.fn(),
  payment: { create: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn(), updateMany: jest.fn(), upsert: jest.fn(), findFirst: jest.fn() },
  ride: { findUnique: jest.fn(), update: jest.fn() },
  delivery: { findUnique: jest.fn(), update: jest.fn() },
  wallet: { upsert: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  transaction: { findUnique: jest.fn(), create: jest.fn() },
  paymentSettings: { upsert: jest.fn() },
  customerProfile: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
  driverEarning: { create: jest.fn() },
  driverProfile: { update: jest.fn() },
};

jest.mock('@/config/database', () => ({ __esModule: true, default: db, prisma: db }));
jest.mock('@/config/queues', () => ({ QUEUE_NAMES: { NOTIFICATION: 'notification', PAYMENT: 'payment' } }));
jest.mock('@/shared/services/queue.service', () => ({ queueService: { addJob: jest.fn().mockResolvedValue({}) } }));

import { createHmac } from 'crypto';
import { Prisma } from '@/generated/prisma';
import { paymentService, paymentIdFromReference } from '@/modules/payments/services/payment.service';
import { walletService } from '@/modules/payments/services/wallet.service';
import { PaystackProvider, MomoProvider, momo } from '@/modules/payments/providers';
import { money, toKobo, toMsisdn, momoPsbAccountNumber, percentOf, toMajorString } from '@/modules/payments/money';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const PID = '3f2b8c1e-5a4d-4c6b-9e7f-1a2b3c4d5e6f';
const REF = `PAY-${PID}-ABC123`;

const settings = (over: Record<string, unknown> = {}) => ({
  id: 'default',
  commissionRate: D('0.20'),
  momoCashbackEnabled: true,
  momoCashbackRate: D('0.02'),
  momoCashbackCap: D(500),
  momoCashbackMinFare: D(1000),
  payoutMinimum: D(1000),
  ...over,
});

const payment = (over: Record<string, unknown> = {}) => ({
  id: PID,
  purpose: 'TRIP',
  userId: 'user-1',
  rideId: 'ride-1',
  deliveryId: null,
  amount: D(5000),
  currency: 'NGN',
  method: 'MOBILE_MONEY',
  provider: 'MOMO',
  status: 'PROCESSING',
  reference: REF,
  providerReference: 'momo-ref',
  cashbackAmount: D(0),
  ...over,
});

const ride = (over: Record<string, unknown> = {}) => ({
  id: 'ride-1',
  rideCode: 'RD1',
  customerId: 'cust-1',
  driverId: 'drv-1',
  status: 'COMPLETED',
  paymentMethod: 'MOBILE_MONEY',
  estimatedFare: D(5000),
  finalFare: D(5000),
  customer: { userId: 'user-1' },
  ...over,
});

const success = (over: Record<string, unknown> = {}) => ({
  status: 'success' as const,
  reference: REF,
  amountMinor: 500000,
  currency: momo.currency,
  providerReference: 'momo-ref',
  channel: 'momo',
  raw: {},
  ...over,
});

/** The payment row as stored; `update` merges into it, like the database would. */
let current: ReturnType<typeof payment>;
const givenPayment = (over: Record<string, unknown> = {}) => {
  current = payment(over);
  db.payment.findUnique.mockResolvedValue(current);
};

const ledger = (type: string) => db.transaction.create.mock.calls.map(([a]) => a.data).filter((d) => d.type === type);

describe('payments', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    db.$transaction.mockImplementation((fn: any) => fn(db));
    db.paymentSettings.upsert.mockResolvedValue(settings());
    db.wallet.upsert.mockImplementation(({ create }: any) => Promise.resolve({ id: create.customerId ? 'w-cust' : 'w-drv', balance: D(0) }));
    db.transaction.findUnique.mockResolvedValue(null);
    db.transaction.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'tx', ...data }));
    db.payment.update.mockImplementation(({ data }: any) => Promise.resolve({ ...current, ...data }));
    givenPayment();
    db.ride.findUnique.mockResolvedValue(ride());
    db.customerProfile.findUnique.mockResolvedValue({ id: 'cust-1' });
  });

  describe('money helpers', () => {
    it('converts naira to integer kobo and rejects fractions of a kobo', () => {
      expect(toKobo(money('1500.50'))).toBe(150050);
      expect(() => toKobo(D('1.005'))).toThrow();
      expect(() => toKobo(money(0))).toThrow();
    });

    it('normalises Nigerian numbers to MSISDN and MoMo PSB account numbers', () => {
      expect(toMsisdn('+234 803 123 4567')).toBe('2348031234567');
      expect(toMsisdn('08031234567')).toBe('2348031234567');
      expect(momoPsbAccountNumber('08031234567')).toBe('8031234567');
      expect(() => toMsisdn('12345')).toThrow();
    });

    it('rounds percentages down and formats MoMo amounts', () => {
      expect(percentOf(D('333.33'), '0.02').toString()).toBe('6.66');
      expect(toMajorString(money(1500))).toBe('1500');
      expect(toMajorString(money('1500.5'))).toBe('1500.50');
    });

    it('recovers the payment id from any attempt reference', () => {
      expect(paymentIdFromReference(REF)).toBe(PID);
      expect(paymentIdFromReference('random-ref')).toBeNull();
    });
  });

  describe('settle', () => {
    it('completes a MoMo trip payment, pays cashback (capped rate) and credits the driver net of commission', async () => {
      const { outcome } = await paymentService.settle(success(), 'MOMO');
      expect(outcome).toBe('completed');

      expect(db.payment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED', provider: 'MOMO' }) }));
      const [cashback] = ledger('BONUS');
      expect(cashback).toMatchObject({ walletId: 'w-cust', reference: `cashback_${PID}` });
      expect(cashback.amount.toString()).toBe('100'); // 2% of 5000, under the 500 cap
      const [earning] = ledger('CREDIT');
      expect(earning).toMatchObject({ walletId: 'w-drv', reference: `earning_${PID}` });
      expect(earning.amount.toString()).toBe('4000'); // 5000 - 20%
      expect(db.driverEarning.create).toHaveBeenCalledTimes(1);
    });

    it('caps cashback and skips it below the minimum fare or when disabled', async () => {
      givenPayment({ amount: D(50000) });
      db.ride.findUnique.mockResolvedValue(ride({ estimatedFare: D(50000), finalFare: D(50000) }));
      await paymentService.settle(success({ amountMinor: 5_000_000 }), 'MOMO');
      expect(ledger('BONUS')[0].amount.toString()).toBe('500');

      jest.clearAllMocks();
      givenPayment();
      db.paymentSettings.upsert.mockResolvedValue(settings({ momoCashbackEnabled: false }));
      await paymentService.settle(success(), 'MOMO');
      expect(ledger('BONUS')).toHaveLength(0);
    });

    it('never pays MoMo cashback on a Paystack payment, even for a MoMo PSB sender', async () => {
      givenPayment({ method: 'BANK_TRANSFER', provider: 'PAYSTACK' });
      await paymentService.settle(success({ currency: 'NGN', channel: 'bank_transfer' }), 'PAYSTACK');
      expect(ledger('BONUS')).toHaveLength(0);
      expect(ledger('CREDIT')).toHaveLength(1); // driver still paid
    });

    it('holds the driver share until the trip is completed', async () => {
      givenPayment();
      db.ride.findUnique.mockResolvedValue(ride({ status: 'IN_PROGRESS' }));
      await paymentService.settle(success(), 'MOMO');
      expect(ledger('CREDIT')).toHaveLength(0);
      expect(db.driverEarning.create).not.toHaveBeenCalled();
    });

    it('refunds to the wallet, net of cashback, when the trip was cancelled before the money arrived', async () => {
      givenPayment();
      db.ride.findUnique.mockResolvedValue(ride({ status: 'CANCELLED' }));
      await paymentService.settle(success(), 'MOMO');
      expect(ledger('BONUS')).toHaveLength(0);
      const [refund] = ledger('REFUND');
      expect(refund.amount.toString()).toBe('5000');
      expect(db.payment.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'REFUNDED' }) }));
    });

    it('credits the wallet instead of double-charging when an older attempt succeeds after the payment completed', async () => {
      givenPayment({ status: 'COMPLETED', reference: `PAY-${PID}-NEWER` });
      const { outcome } = await paymentService.settle(success(), 'MOMO');
      expect(outcome).toBe('orphan_credited');
      expect(ledger('CREDIT')[0]).toMatchObject({ walletId: 'w-cust', reference: `orphan_${REF}` });
      expect(db.payment.update).not.toHaveBeenCalled();
    });

    it('does not complete a payment when the collected amount differs, but keeps the money', async () => {
      givenPayment();
      const { outcome } = await paymentService.settle(success({ amountMinor: 100 }), 'MOMO');
      expect(outcome).toBe('orphan_credited');
      expect(ledger('CREDIT')[0].amount.toString()).toBe('1');
      expect(db.payment.update).not.toHaveBeenCalled();
    });

    it('treats a repeat of the same success as a no-op', async () => {
      givenPayment({ status: 'COMPLETED' });
      expect((await paymentService.settle(success(), 'MOMO')).outcome).toBe('duplicate');
      expect(db.transaction.create).not.toHaveBeenCalled();
    });

    it('ignores a failure for an attempt that is no longer current', async () => {
      givenPayment({ reference: `PAY-${PID}-NEWER` });
      const { outcome } = await paymentService.settle({ status: 'failed', reference: REF, raw: {} }, 'MOMO');
      expect(outcome).toBe('ignored');
      expect(db.payment.update).not.toHaveBeenCalled();
    });

    it('serialises on a per-payment advisory lock', async () => {
      givenPayment();
      await paymentService.settle(success(), 'MOMO');
      expect(db.$executeRaw).toHaveBeenCalled();
    });
  });

  describe('wallet', () => {
    it('refuses a debit the balance cannot cover (guard is in the UPDATE)', async () => {
      db.wallet.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        walletService.debit(db as any, 'w', money(100), { type: 'DEBIT', reference: 'r', description: 'x' })
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(db.wallet.updateMany.mock.calls[0][0].where.balance).toEqual({ gte: money(100) });
      expect(db.transaction.create).not.toHaveBeenCalled();
    });

    it('applies each ledger reference once', async () => {
      db.transaction.findUnique.mockResolvedValue({ id: 'existing' });
      expect(await walletService.credit(db as any, 'w', money(100), { type: 'CREDIT', reference: 'r', description: 'x' })).toBeNull();
      expect(db.wallet.update).not.toHaveBeenCalled();
    });
  });

  describe('top-up', () => {
    it('refuses an unavailable provider before creating the payment, so no PENDING row is left behind', async () => {
      jest.spyOn(momo, 'configured', 'get').mockReturnValue(false);
      const user = { id: 'user-1', phoneNumber: '+2348031234567', customerProfile: { id: 'cust-1' } } as any;
      await expect(paymentService.initializeTopUp(user, { amount: 500, method: 'MOBILE_MONEY' })).rejects.toMatchObject({ statusCode: 503 });
      expect(db.payment.create).not.toHaveBeenCalled();
    });
  });

  describe('callback authentication', () => {
    it('accepts only the exact Paystack HMAC-SHA512 of the raw body', () => {
      const provider = new PaystackProvider('sk_test_123');
      const body = Buffer.from('{"event":"charge.success"}');
      const sig = createHmac('sha512', 'sk_test_123').update(body).digest('hex');
      expect(provider.verifySignature(body, sig)).toBe(true);
      expect(provider.verifySignature(Buffer.from('{"event":"charge.success "}'), sig)).toBe(false);
      expect(provider.verifySignature(body, undefined)).toBe(false);
    });

    it('binds each MoMo callback URL to its own transaction', () => {
      const a = MomoProvider.newReference();
      const b = MomoProvider.newReference();
      const sig = MomoProvider.callbackSignature(a, 'secret');
      expect(MomoProvider.verifyCallbackSignature(a, sig, 'secret')).toBe(true);
      expect(MomoProvider.verifyCallbackSignature(b, sig, 'secret')).toBe(false);
      expect(MomoProvider.verifyCallbackSignature(a, sig, 'other-secret')).toBe(false);
    });
  });
});
