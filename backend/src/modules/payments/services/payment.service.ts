import prisma from '@/config/database';
import { config } from '@/config';
import { logger } from '@/config/logger';
import { QUEUE_NAMES } from '@/config/queues';
import { Payment, PaymentMethod, PaymentProvider, Prisma } from '@/generated/prisma';
import { createError, HttpError } from '@/shared/middleware/error-handler';
import { queueService } from '@/shared/services/queue.service';
import { money, Money, percentOf, toKobo, fromKobo, toMajorString, toMsisdn } from '../money';
import { momo, paystack, MomoProvider, CollectionStatus, ProviderError } from '../providers';
import { paymentSettingsService } from './settings.service';
import { walletService } from './wallet.service';

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

export type TripKind = 'ride' | 'delivery';

export interface Payer {
  id: string;
  email?: string | null;
  phoneNumber: string;
  customerProfile?: { id: string } | null;
}

export interface TripPaymentInput {
  rideId?: string;
  deliveryId?: string;
  method?: PaymentMethod;
}

export interface TopUpInput {
  amount: number;
  method: Extract<PaymentMethod, 'CARD' | 'BANK_TRANSFER' | 'MOBILE_MONEY'>;
}

/** What the app must do next to finish paying. */
export type NextAction =
  | { type: 'none' }
  | { type: 'redirect'; authorizationUrl: string; accessCode: string }
  | { type: 'approve_on_phone'; phoneNumber: string; expiresInMinutes: number };

interface Trip {
  kind: TripKind;
  id: string;
  code: string;
  customerId: string;
  customerUserId: string;
  driverId: string | null;
  completed: boolean;
  cancelled: boolean;
  paymentMethod: PaymentMethod;
  amount: Money;
}

export const TOP_UP_LIMITS = { min: 100, max: 500_000 };

/** Which provider collects each method, and which Paystack checkout channels it opens. */
const PAYSTACK_CHANNELS: Partial<Record<PaymentMethod, string[]>> = {
  CARD: ['card'],
  BANK_TRANSFER: ['bank_transfer', 'ussd', 'bank'],
};

/**
 * Our reference for one collection attempt: PAY-<paymentId>-<suffix>. Paystack allows only
 * alphanumerics, "-", "." and "=". Embedding the payment id means a late result for an old
 * attempt (after the customer retried) can still be matched to its payment.
 */
const newReference = (paymentId: string) => `PAY-${paymentId}-${Date.now().toString(36).toUpperCase()}`;
const REFERENCE = /^PAY-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-[0-9A-Z]+$/i;
export const paymentIdFromReference = (reference: string | undefined | null): string | null =>
  (reference && REFERENCE.exec(reference)?.[1]) || null;

/** Columns that leave the API. Gateway payloads stay internal. */
export const paymentView = {
  id: true,
  purpose: true,
  rideId: true,
  deliveryId: true,
  amount: true,
  currency: true,
  method: true,
  provider: true,
  status: true,
  reference: true,
  channel: true,
  cashbackAmount: true,
  failureReason: true,
  paidAt: true,
  refundedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PaymentSelect;

const OPEN: Payment['status'][] = ['PENDING', 'PROCESSING', 'FAILED'];
const naira = (m: Money) => `NGN ${m.toFixed(2)}`;

export class PaymentService {
  // ---------------------------------------------------------------------------
  // Starting payments
  // ---------------------------------------------------------------------------

  async initializeTripPayment(user: Payer, input: TripPaymentInput) {
    const customerId = user.customerProfile?.id;
    if (!customerId) throw createError.forbidden('Customer profile required');

    const kind: TripKind = input.rideId ? 'ride' : 'delivery';
    const tripId = (input.rideId ?? input.deliveryId)!;
    const trip = await this.loadTrip(prisma, kind, tripId);
    // SECURITY: "not yours" and "does not exist" look the same.
    if (!trip || trip.customerId !== customerId) throw createError.notFound(`${kind === 'ride' ? 'Ride' : 'Delivery'} not found`);
    if (trip.cancelled) throw createError.conflict('This trip was cancelled');

    const method = input.method ?? trip.paymentMethod;
    if (method === 'CASH') throw createError.badRequest('Cash is paid to the driver at the end of the trip');

    let payment = await this.tripPayment(prisma, trip, method);
    if (payment.status === 'COMPLETED' || payment.status === 'REFUNDED') throw createError.conflict('This trip is already paid');

    // An earlier attempt may have succeeded in the meantime; never start a second charge blind.
    if (payment.status === 'PROCESSING') {
      payment = await this.refresh(payment.id);
      if (payment.status === 'COMPLETED') return { payment: await this.view(payment.id), next: { type: 'none' } as NextAction };
      if (payment.status === 'PROCESSING' && payment.provider === 'MOMO' && !this.momoPromptExpired(payment)) {
        throw createError.conflict('Approve the MoMo prompt on your phone, or try again in a few minutes');
      }
    }

    if (method !== trip.paymentMethod) await this.setTripMethod(trip, method);

    const description = `${kind === 'ride' ? 'Ride' : 'Delivery'} ${trip.code}`;
    const next = await this.startAttempt(payment, method, user, description, trip.amount);
    return { payment: await this.view(payment.id), next };
  }

  async initializeTopUp(user: Payer, input: TopUpInput) {
    const customerId = user.customerProfile?.id;
    if (!customerId) throw createError.forbidden('Customer profile required');
    const amount = money(input.amount);
    // Before the insert: each top-up is a new row, and one the provider can never take would sit PENDING forever.
    this.assertProviderAvailable(input.method);

    const payment = await prisma.payment.create({
      data: { purpose: 'WALLET_TOP_UP', userId: user.id, amount, method: input.method, status: 'PENDING' },
    });
    const next = await this.startAttempt(payment, input.method, user, 'Wallet top-up', amount);
    return { payment: await this.view(payment.id), next };
  }

  private async startAttempt(
    payment: Payment,
    method: PaymentMethod,
    user: Payer,
    description: string,
    amount: Money
  ): Promise<NextAction> {
    const reference = newReference(payment.id);

    if (method === 'WALLET') {
      await this.payFromWallet(payment.id, reference, amount);
      return { type: 'none' };
    }

    this.assertProviderAvailable(method);

    if (method === 'CARD' || method === 'BANK_TRANSFER') {
      // Record the attempt BEFORE calling out, so a webhook that beats our response still matches.
      await this.recordAttempt(payment.id, { method, amount, reference, provider: 'PAYSTACK' });
      try {
        const checkout = await paystack.initialize({
          reference,
          amountKobo: toKobo(amount),
          email: user.email || `${user.id}@${config.services.paystack.fallbackEmailDomain}`,
          channels: PAYSTACK_CHANNELS[method]!,
          metadata: { paymentId: payment.id, purpose: payment.purpose, description },
        });
        await prisma.payment.update({ where: { id: payment.id }, data: { gatewayResponse: { checkout } } });
        return { type: 'redirect', ...checkout };
      } catch (error) {
        throw await this.attemptFailed(payment.id, reference, error);
      }
    }

    if (method === 'MOBILE_MONEY') {
      // Consent (MoMo best practice): only debit a number proven to belong to this user. The
      // account's phone number is OTP-verified at sign-up, so it is the only one allowed for now.
      let msisdn: string;
      try {
        msisdn = toMsisdn(user.phoneNumber);
      } catch (error) {
        throw createError.badRequest((error as Error).message);
      }
      if ((await momo.isActiveAccount(msisdn)) === false) {
        throw createError.badRequest('This number does not have an active MoMo account');
      }

      const providerReference = MomoProvider.newReference();
      await this.recordAttempt(payment.id, { method, amount, reference, provider: 'MOMO', providerReference, payerPhone: msisdn });
      try {
        await momo.requestToPay({
          providerReference,
          reference,
          amount: toMajorString(amount),
          msisdn,
          payerMessage: `Ride Deliva: ${description}`,
          payeeNote: `${payment.purpose} ${payment.id}`,
          callbackUrl: this.momoCallbackUrl(providerReference),
        });
      } catch (error) {
        // A timeout leaves the prompt possibly sent: keep it PROCESSING and let reconciliation decide.
        if (!(error instanceof ProviderError && error.definitive)) {
          logger.warn('MoMo request-to-pay outcome unknown; will reconcile', { paymentId: payment.id, error: String(error) });
        } else {
          throw await this.attemptFailed(payment.id, reference, error);
        }
      }
      return { type: 'approve_on_phone', phoneNumber: `+${msisdn}`, expiresInMinutes: config.services.momo.requestTimeoutMinutes };
    }

    throw createError.badRequest(`Unsupported payment method: ${method}`);
  }

  private recordAttempt(
    paymentId: string,
    a: { method: PaymentMethod; amount: Money; reference: string; provider: PaymentProvider; providerReference?: string; payerPhone?: string }
  ) {
    return prisma.payment.update({
      where: { id: paymentId },
      data: {
        method: a.method,
        amount: a.amount,
        reference: a.reference,
        provider: a.provider,
        providerReference: a.providerReference ?? null,
        payerPhone: a.payerPhone ?? null,
        status: 'PROCESSING',
        channel: null,
        failureReason: null,
        gatewayResponse: Prisma.DbNull,
      },
    });
  }

  /** The provider refused the attempt: mark it failed and turn it into an HTTP error. */
  private async attemptFailed(paymentId: string, reference: string, error: unknown): Promise<HttpError> {
    const definitive = error instanceof ProviderError && error.definitive;
    logger.warn('Payment attempt rejected by provider', { paymentId, error: String(error) });
    if (definitive) {
      await prisma.payment.updateMany({
        where: { id: paymentId, reference, status: 'PROCESSING' },
        data: { status: 'FAILED', failureReason: (error as Error).message },
      });
      return createError.badRequest(`Payment could not be started: ${(error as Error).message}`);
    }
    return createError.serviceUnavailable('The payment provider is not responding. Please try again');
  }

  private async payFromWallet(paymentId: string, reference: string, amount: Money) {
    await prisma.$transaction(async (tx) => {
      await this.lock(tx, paymentId);
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      if (!OPEN.includes(payment.status)) return;
      if (payment.purpose !== 'TRIP') throw createError.badRequest('The wallet cannot fund itself');

      const trip = await this.tripOf(tx, payment);
      const wallet = await walletService.customerWallet(tx, trip!.customerId);
      await walletService.debit(tx, wallet.id, amount, {
        type: 'DEBIT',
        reference: `wallet_pay_${payment.id}`,
        description: `Payment for ${trip!.kind} ${trip!.code}`,
        metadata: { paymentId: payment.id },
      });
      const completed = await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'COMPLETED', method: 'WALLET', provider: 'INTERNAL', reference, amount, channel: 'wallet', paidAt: new Date(), failureReason: null },
      });
      await this.afterCompletion(tx, completed, trip);
    });
  }

  // ---------------------------------------------------------------------------
  // Settling: the only place a collected payment changes money anywhere
  // ---------------------------------------------------------------------------

  /** Asks the provider where an in-flight attempt stands and settles it. */
  async refresh(paymentId: string): Promise<Payment> {
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.status !== 'PROCESSING') return payment;
    try {
      if (payment.provider === 'PAYSTACK' && payment.reference) {
        await this.settle(await paystack.verify(payment.reference), 'PAYSTACK');
      } else if (payment.provider === 'MOMO' && payment.providerReference) {
        await this.settle(await momo.getStatus(payment.providerReference), 'MOMO');
      }
    } catch (error) {
      logger.warn('Payment status check failed', { paymentId, error: String(error) });
    }
    return prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  }

  /** Paystack webhook path: re-verify the reference with Paystack before trusting it. */
  async verifyPaystackReference(reference: string) {
    return this.settle(await paystack.verify(reference), 'PAYSTACK');
  }

  /** MoMo callback path: the callback is unsigned, so only the status API is believed. */
  async verifyMomoReference(providerReference: string) {
    return this.settle(await momo.getStatus(providerReference), 'MOMO');
  }

  /**
   * Applies a provider-verified result. Idempotent: replays, duplicate webhooks and the
   * polling path racing the webhook path all serialise on the payment lock.
   *
   * Money is never dropped: a success that cannot complete its payment (already paid by
   * another attempt, or the amount does not match) is credited to the payer's wallet.
   */
  async settle(result: CollectionStatus, provider: 'PAYSTACK' | 'MOMO') {
    if (result.status === 'pending') return { outcome: 'pending' as const };
    const paymentId = paymentIdFromReference(result.reference);
    if (!paymentId) {
      logger.warn('Provider result with an unknown reference', { provider, reference: result.reference });
      return { outcome: 'ignored' as const };
    }

    const effects: Array<() => Promise<void>> = [];
    const outcome = await prisma.$transaction(async (tx) => {
      await this.lock(tx, paymentId);
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment) return 'ignored' as const;

      if (result.status === 'failed') {
        if (payment.reference !== result.reference || !['PENDING', 'PROCESSING'].includes(payment.status)) return 'ignored' as const;
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED', failureReason: result.failureReason ?? 'Payment failed', gatewayResponse: result.raw as Prisma.InputJsonValue },
        });
        if (payment.userId) effects.push(() => this.notify(payment.userId!, 'Payment failed', result.failureReason ?? 'Your payment did not go through', payment.id));
        return 'failed' as const;
      }

      // success
      if (result.amountMinor == null) throw new Error(`Provider did not report an amount for ${result.reference}`);
      const received = fromKobo(result.amountMinor);
      const expectedCurrency = provider === 'MOMO' ? momo.currency : 'NGN';

      if (payment.status === 'COMPLETED' || payment.status === 'REFUNDED') {
        if (payment.reference === result.reference) return 'duplicate' as const;
        await this.creditOrphan(tx, payment, result, received, 'Payment received for an earlier checkout');
        return 'orphan_credited' as const;
      }
      if (!received.equals(payment.amount) || (result.currency && result.currency !== expectedCurrency)) {
        logger.error('Collected amount does not match the payment', {
          paymentId, expected: payment.amount.toString(), received: received.toString(), currency: result.currency,
        });
        await this.creditOrphan(tx, payment, result, received, 'Payment received with a different amount');
        return 'orphan_credited' as const;
      }

      const completed = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          reference: result.reference,
          provider,
          providerReference: result.providerReference ?? payment.providerReference,
          channel: result.channel ?? null,
          paidAt: new Date(),
          failureReason: null,
          gatewayResponse: result.raw as Prisma.InputJsonValue,
        },
      });
      const trip = await this.tripOf(tx, completed);
      const { cashback } = await this.afterCompletion(tx, completed, trip);

      if (completed.userId) {
        const what = completed.purpose === 'WALLET_TOP_UP' ? 'Wallet top-up' : `Payment for ${trip?.kind ?? 'trip'} ${trip?.code ?? ''}`.trim();
        const extra = cashback.gt(0) ? ` You earned ${naira(cashback)} MoMo cashback.` : '';
        effects.push(() => this.notify(completed.userId!, 'Payment received', `${what}: ${naira(completed.amount)} received.${extra}`, completed.id));
      }
      return 'completed' as const;
    });

    for (const effect of effects) await effect().catch(() => undefined);
    return { outcome };
  }

  private async creditOrphan(tx: Tx, payment: Payment, result: CollectionStatus, received: Money, description: string) {
    const customer = payment.userId ? await tx.customerProfile.findUnique({ where: { userId: payment.userId }, select: { id: true } }) : null;
    if (!customer) {
      logger.error('Unmatched payment with no customer wallet to credit; needs manual review', { paymentId: payment.id, reference: result.reference });
      return;
    }
    const wallet = await walletService.customerWallet(tx, customer.id);
    await walletService.credit(tx, wallet.id, received, {
      type: 'CREDIT',
      reference: `orphan_${result.reference}`,
      description,
      metadata: { paymentId: payment.id, providerReference: result.providerReference ?? null },
    });
  }

  /** Everything that follows a payment becoming COMPLETED, inside the same transaction. */
  private async afterCompletion(tx: Tx, payment: Payment, trip: Trip | null): Promise<{ cashback: Money }> {
    if (payment.purpose === 'WALLET_TOP_UP') {
      const customer = await tx.customerProfile.findUniqueOrThrow({ where: { userId: payment.userId! }, select: { id: true } });
      const wallet = await walletService.customerWallet(tx, customer.id);
      await walletService.credit(tx, wallet.id, payment.amount, {
        type: 'CREDIT',
        reference: `topup_${payment.id}`,
        description: `Wallet top-up (${payment.method.toLowerCase().replace('_', ' ')})`,
        metadata: { paymentId: payment.id },
      });
      return { cashback: money(0) };
    }

    if (!trip) throw new Error(`Trip payment ${payment.id} has no trip`);
    const cashback = await this.applyCashback(tx, payment, trip);
    if (trip.cancelled) await this.refundToWallet(tx, payment, trip, 'Trip was cancelled');
    else if (trip.completed) await this.creditDriver(tx, payment, trip);
    return { cashback };
  }

  /**
   * MoMo cashback: only for trip fares collected through the MoMo provider, whose status
   * API confirmed the money came from a MoMo wallet. Paystack payments never qualify, even
   * if the customer's bank happens to be MoMo PSB, because that cannot be verified.
   */
  private async applyCashback(tx: Tx, payment: Payment, trip: Trip): Promise<Money> {
    if (payment.method !== 'MOBILE_MONEY' || payment.provider !== 'MOMO' || trip.cancelled) return money(0);
    const s = await paymentSettingsService.get(tx);
    if (!s.momoCashbackEnabled || payment.amount.lt(s.momoCashbackMinFare)) return money(0);

    const amount = Prisma.Decimal.min(percentOf(payment.amount, s.momoCashbackRate), s.momoCashbackCap);
    if (amount.lte(0)) return money(0);

    const wallet = await walletService.customerWallet(tx, trip.customerId);
    const entry = await walletService.credit(tx, wallet.id, amount, {
      type: 'BONUS',
      reference: `cashback_${payment.id}`,
      description: `MoMo cashback for ${trip.kind} ${trip.code}`,
      metadata: { paymentId: payment.id, rate: s.momoCashbackRate.toString() },
    });
    if (!entry) return money(0);
    await tx.payment.update({ where: { id: payment.id }, data: { cashbackAmount: amount } });
    payment.cashbackAmount = amount;
    return amount;
  }

  /**
   * Driver's share. Collected payments credit the net to the driver's wallet; on cash trips
   * the driver already holds the fare, so the commission is debited instead (and may take
   * the wallet negative, which later earnings pay down).
   */
  private async creditDriver(tx: Tx, payment: Payment, trip: Trip) {
    if (!trip.driverId) return;
    const s = await paymentSettingsService.get(tx);
    const commission = percentOf(payment.amount, s.commissionRate);
    const net = payment.amount.sub(commission);
    const wallet = await walletService.driverWallet(tx, trip.driverId);

    const entry =
      payment.method === 'CASH'
        ? await walletService.debit(tx, wallet.id, commission, {
            type: 'COMMISSION',
            reference: `commission_${payment.id}`,
            description: `Commission on cash ${trip.kind} ${trip.code}`,
            metadata: { paymentId: payment.id },
            allowNegative: true,
          })
        : await walletService.credit(tx, wallet.id, net, {
            type: 'CREDIT',
            reference: `earning_${payment.id}`,
            description: `Earnings for ${trip.kind} ${trip.code}`,
            metadata: { paymentId: payment.id, gross: payment.amount.toString(), commission: commission.toString() },
          });
    if (!entry) return; // already credited

    await tx.driverEarning.create({
      data: {
        driverId: trip.driverId,
        rideId: trip.kind === 'ride' ? trip.id : null,
        deliveryId: trip.kind === 'delivery' ? trip.id : null,
        grossAmount: payment.amount,
        commission,
        netAmount: net,
      },
    });
    await tx.driverProfile.update({ where: { id: trip.driverId }, data: { totalEarnings: { increment: net } } });
  }

  /** Refunds go to the in-app wallet (instant, and MoMo has no refund API in Nigeria). Cashback is netted off. */
  private async refundToWallet(tx: Tx, payment: Payment, trip: Trip, reason: string) {
    const back = payment.amount.sub(payment.cashbackAmount);
    const wallet = await walletService.customerWallet(tx, trip.customerId);
    await walletService.credit(tx, wallet.id, back, {
      type: 'REFUND',
      reference: `refund_${payment.id}`,
      description: `Refund for ${trip.kind} ${trip.code}: ${reason}`,
      metadata: { paymentId: payment.id, cashbackNetted: payment.cashbackAmount.toString() },
    });
    await tx.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED', refundedAt: new Date() } });
  }

  // ---------------------------------------------------------------------------
  // Trip lifecycle hooks (called after the ride/delivery transaction commits)
  // ---------------------------------------------------------------------------

  async onTripCompleted(kind: TripKind, tripId: string) {
    const trip = await this.loadTrip(prisma, kind, tripId);
    if (!trip?.completed) return;

    if (trip.paymentMethod === 'CASH') {
      const payment = await this.tripPayment(prisma, trip, 'CASH');
      await prisma.$transaction(async (tx) => {
        await this.lock(tx, payment.id);
        const current = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
        if (!OPEN.includes(current.status)) return;
        const completed = await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'COMPLETED', method: 'CASH', provider: 'INTERNAL', channel: 'cash', amount: trip.amount, reference: newReference(payment.id), paidAt: new Date() },
        });
        await this.creditDriver(tx, completed, trip);
      });
      return;
    }

    const payment = await prisma.payment.findFirst({ where: kind === 'ride' ? { rideId: tripId } : { deliveryId: tripId } });
    if (payment?.status === 'COMPLETED') {
      // Paid before the trip finished: release the driver's share now.
      await prisma.$transaction(async (tx) => {
        await this.lock(tx, payment.id);
        const current = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
        if (current.status === 'COMPLETED') await this.creditDriver(tx, current, trip);
      });
      return;
    }

    if (trip.paymentMethod === 'WALLET') {
      const p = await this.tripPayment(prisma, trip, 'WALLET');
      try {
        await this.payFromWallet(p.id, newReference(p.id), trip.amount);
        return;
      } catch (error) {
        logger.info('Wallet auto-debit failed at trip completion', { kind, tripId, error: String(error) });
      }
    }
    await this.notify(trip.customerUserId, 'Payment due', `Please pay ${naira(trip.amount)} for ${kind} ${trip.code}`, payment?.id);
  }

  async onTripCancelled(kind: TripKind, tripId: string) {
    const payment = await prisma.payment.findFirst({ where: kind === 'ride' ? { rideId: tripId } : { deliveryId: tripId } });
    if (!payment) return;
    if (payment.status === 'COMPLETED') {
      await prisma.$transaction(async (tx) => {
        await this.lock(tx, payment.id);
        const current = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
        const trip = await this.tripOf(tx, current);
        if (current.status === 'COMPLETED' && trip) await this.refundToWallet(tx, current, trip, 'Trip was cancelled');
      });
      if (payment.userId) await this.notify(payment.userId, 'Refund issued', 'Your payment was refunded to your wallet', payment.id);
    }
    // An attempt still in flight is refunded by `settle` if it succeeds, because the trip is now cancelled.
  }

  // ---------------------------------------------------------------------------
  // Reads and reconciliation
  // ---------------------------------------------------------------------------

  async getForUser(paymentId: string, user: { id: string; adminProfile?: unknown }) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: { userId: true, status: true, updatedAt: true } });
    if (!payment || (!user.adminProfile && payment.userId !== user.id)) throw createError.notFound('Payment not found');
    // The app polls this while the customer approves on their phone or finishes checkout.
    if (payment.status === 'PROCESSING' && Date.now() - payment.updatedAt.getTime() > 3000) await this.refresh(paymentId);
    return this.view(paymentId);
  }

  async listForUser(userId: string, page: number, limit: number) {
    const where: Prisma.PaymentWhereInput = { userId };
    const [data, total] = await Promise.all([
      prisma.payment.findMany({ where, select: paymentView, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.payment.count({ where }),
    ]);
    return { data, total };
  }

  /** Catches up on callbacks that never arrived. Run on a schedule. */
  async reconcilePending(limit = 50) {
    const now = Date.now();
    const stale = await prisma.payment.findMany({
      where: {
        status: 'PROCESSING',
        provider: { in: ['PAYSTACK', 'MOMO'] },
        updatedAt: { lt: new Date(now - 2 * 60 * 1000) },
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
      select: { id: true, createdAt: true },
    });
    let settled = 0;
    for (const p of stale) {
      const after = await this.refresh(p.id);
      if (after.status !== 'PROCESSING') settled++;
      else if (now - p.createdAt.getTime() > 48 * 60 * 60 * 1000) {
        // Give up on abandoned checkouts. A late success still settles (as a completion or wallet credit).
        await prisma.payment.updateMany({ where: { id: p.id, status: 'PROCESSING' }, data: { status: 'FAILED', failureReason: 'Payment was not completed' } });
      }
    }
    return { checked: stale.length, settled };
  }

  view(paymentId: string) {
    return prisma.payment.findUniqueOrThrow({ where: { id: paymentId }, select: paymentView });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Serialises everything that touches one payment (webhook, poll, trip hooks) for the transaction's lifetime. */
  private lock(tx: Tx, paymentId: string) {
    return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payment:${paymentId}`}))`;
  }

  private assertProviderAvailable(method: PaymentMethod) {
    if ((method === 'CARD' || method === 'BANK_TRANSFER') && !paystack.configured) {
      throw createError.serviceUnavailable('Card and transfer payments are not available right now');
    }
    if (method === 'MOBILE_MONEY' && !momo.configured) throw createError.serviceUnavailable('MoMo payments are not available right now');
  }

  private momoPromptExpired(payment: Payment) {
    return Date.now() - payment.updatedAt.getTime() > config.services.momo.requestTimeoutMinutes * 60 * 1000;
  }

  private momoCallbackUrl(providerReference: string): string | undefined {
    const base = config.payments.publicBaseUrl;
    const secret = config.services.momo.callbackSecret;
    if (!base || !secret) return undefined; // status polling and reconciliation still settle it
    const signature = MomoProvider.callbackSignature(providerReference, secret);
    return `${base.replace(/\/$/, '')}${config.app.apiPrefix}/webhooks/momo/${providerReference}/${signature}`;
  }

  private async tripPayment(db: Db, trip: Trip, method: PaymentMethod): Promise<Payment> {
    const where = trip.kind === 'ride' ? { rideId: trip.id } : { deliveryId: trip.id };
    return db.payment.upsert({
      where,
      create: { ...where, purpose: 'TRIP', userId: trip.customerUserId, amount: trip.amount, method, status: 'PENDING' },
      update: {},
    });
  }

  private async setTripMethod(trip: Trip, method: PaymentMethod) {
    if (trip.kind === 'ride') await prisma.ride.update({ where: { id: trip.id }, data: { paymentMethod: method } });
    else await prisma.delivery.update({ where: { id: trip.id }, data: { paymentMethod: method } });
  }

  private tripOf(db: Db, payment: Payment) {
    if (payment.rideId) return this.loadTrip(db, 'ride', payment.rideId);
    if (payment.deliveryId) return this.loadTrip(db, 'delivery', payment.deliveryId);
    return Promise.resolve(null);
  }

  private async loadTrip(db: Db, kind: TripKind, id: string): Promise<Trip | null> {
    const select = {
      id: true, customerId: true, driverId: true, status: true, paymentMethod: true,
      estimatedFare: true, finalFare: true, customer: { select: { userId: true } },
    } as const;
    if (kind === 'ride') {
      const r = await db.ride.findUnique({ where: { id }, select: { ...select, rideCode: true } });
      return r && {
        kind, id: r.id, code: r.rideCode, customerId: r.customerId, customerUserId: r.customer.userId, driverId: r.driverId,
        completed: r.status === 'COMPLETED', cancelled: r.status === 'CANCELLED', paymentMethod: r.paymentMethod,
        amount: money(r.finalFare ?? r.estimatedFare),
      };
    }
    const d = await db.delivery.findUnique({ where: { id }, select: { ...select, deliveryCode: true } });
    return d && {
      kind, id: d.id, code: d.deliveryCode, customerId: d.customerId, customerUserId: d.customer.userId, driverId: d.driverId,
      completed: d.status === 'DELIVERED', cancelled: d.status === 'CANCELLED', paymentMethod: d.paymentMethod,
      amount: money(d.finalFare ?? d.estimatedFare),
    };
  }

  private async notify(userId: string, title: string, body: string, paymentId?: string): Promise<void> {
    try {
      await queueService.addJob(QUEUE_NAMES.NOTIFICATION, 'push', { type: 'push', userId, title, body, data: { paymentId }, category: 'payment' });
    } catch (error) {
      logger.warn('Payment notification not enqueued', { userId, error: String(error) });
    }
  }
}

export const paymentService = new PaymentService();
