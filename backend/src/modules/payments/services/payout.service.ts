import { randomUUID } from 'crypto';
import prisma from '@/config/database';
import { config } from '@/config';
import { logger } from '@/config/logger';
import { QUEUE_NAMES } from '@/config/queues';
import { Payout, PayoutAccountType, Prisma } from '@/generated/prisma';
import { createError } from '@/shared/middleware/error-handler';
import { queueService } from '@/shared/services/queue.service';
import { money, momoPsbAccountNumber, toKobo } from '../money';
import { paystack, ProviderError } from '../providers';
import { paymentSettingsService } from './settings.service';
import { walletService } from './wallet.service';

export interface PayoutAccountInput {
  type: PayoutAccountType;
  /** MoMo PSB: the driver's MTN number. Bank: the 10-digit NUBAN. */
  accountNumber: string;
  bankCode?: string;
}

const accountView = {
  type: true, accountNumber: true, bankCode: true, bankName: true, accountName: true, updatedAt: true,
} satisfies Prisma.PayoutAccountSelect;

export const payoutView = {
  id: true, batchKey: true, amount: true, currency: true, status: true, reference: true,
  destination: true, failureReason: true, paidAt: true, createdAt: true,
} satisfies Prisma.PayoutSelect;

/** Batch key = the payout date in Lagos, so a re-run on the same day pays nobody twice. */
export const batchKeyFor = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: config.payments.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

// Paystack transfer references: lowercase alphanumerics, "-" and "_", 16 to 50 characters.
const transferReference = (payoutId: string) => `po_${payoutId.replace(/-/g, '')}`;

/**
 * Driver payouts. Nigeria's MoMo disbursement product is a manual CSV upload, so every
 * payout (bank or MoMo PSB wallet) goes through Paystack Transfers.
 *
 * Money moves in two steps: the wallet is debited when the payout row is created (one
 * database transaction), then the transfer is sent. A failed or reversed transfer
 * re-credits the wallet. An unknown outcome (timeout) stays PROCESSING until a webhook
 * or reconciliation resolves it; it is never assumed failed, which could pay twice.
 */
export class PayoutService {
  async banks() {
    const banks = await paystack.listBanks();
    return banks.map((b) => ({ name: b.name, code: b.code }));
  }

  getAccount(driverId: string) {
    return prisma.payoutAccount.findUnique({ where: { driverId }, select: accountView });
  }

  async setAccount(driverId: string, input: PayoutAccountInput) {
    if (!paystack.configured) throw createError.serviceUnavailable('Payout accounts cannot be verified right now');

    let accountNumber: string;
    let bank: { code: string; name: string };
    try {
      if (input.type === 'MOMO_PSB') {
        accountNumber = momoPsbAccountNumber(input.accountNumber);
        bank = await paystack.momoPsbBank();
      } else {
        if (!input.bankCode) throw createError.badRequest('bankCode is required for bank accounts');
        accountNumber = input.accountNumber;
        const found = (await paystack.listBanks()).find((b) => b.code === input.bankCode);
        if (!found) throw createError.badRequest('Unknown bank');
        bank = found;
      }
    } catch (error) {
      if (error instanceof ProviderError) throw createError.serviceUnavailable(error.message);
      if (error instanceof Error && !(error as any).statusCode) throw createError.badRequest(error.message);
      throw error;
    }

    // The name comes from the bank, not the driver, so earnings cannot be pointed at someone else's
    // account under the driver's name without it showing.
    let accountName: string;
    let recipientCode: string;
    try {
      ({ accountName } = await paystack.resolveAccount(accountNumber, bank.code));
      recipientCode = await paystack.createRecipient({ name: accountName, accountNumber, bankCode: bank.code });
    } catch (error) {
      if (error instanceof ProviderError && error.definitive) throw createError.badRequest(`Account could not be verified: ${error.message}`);
      throw createError.serviceUnavailable('Account verification is unavailable. Please try again');
    }

    const data = { type: input.type, accountNumber, bankCode: bank.code, bankName: bank.name, accountName, recipientCode };
    return prisma.payoutAccount.upsert({ where: { driverId }, create: { driverId, ...data }, update: data, select: accountView });
  }

  async list(driverId: string, page: number, limit: number) {
    const where = { driverId };
    const [data, total] = await Promise.all([
      prisma.payout.findMany({ where, select: payoutView, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.payout.count({ where }),
    ]);
    return { data, total };
  }

  async listAll(q: { page: number; limit: number; status?: Payout['status']; batchKey?: string }) {
    const where: Prisma.PayoutWhereInput = { status: q.status, batchKey: q.batchKey };
    const [data, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        select: { ...payoutView, driver: { select: { id: true, user: { select: { firstName: true, lastName: true, phoneNumber: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.payout.count({ where }),
    ]);
    return { data, total };
  }

  async earningsSummary(driverId: string) {
    const [wallet, totals, account, lastPayout] = await Promise.all([
      walletService.view({ driverId }),
      prisma.driverEarning.aggregate({ where: { driverId }, _sum: { grossAmount: true, commission: true, netAmount: true }, _count: { _all: true } }),
      this.getAccount(driverId),
      prisma.payout.findFirst({ where: { driverId }, orderBy: { createdAt: 'desc' }, select: payoutView }),
    ]);
    const settings = await paymentSettingsService.get();
    return {
      balance: wallet.balance,
      currency: wallet.currency,
      trips: totals._count._all,
      gross: totals._sum.grossAmount ?? money(0),
      commission: totals._sum.commission ?? money(0),
      net: totals._sum.netAmount ?? money(0),
      payoutMinimum: settings.payoutMinimum,
      payoutSchedule: config.payments.payoutCron,
      payoutAccount: account,
      lastPayout,
    };
  }

  /** Pays every driver whose balance has reached the minimum. Safe to re-run for the same batch. */
  async runBatch(batchKey = batchKeyFor()) {
    if (!paystack.configured) throw new Error('Paystack is not configured; payouts cannot run');
    const { payoutMinimum } = await paymentSettingsService.get();
    const due = await prisma.wallet.findMany({
      where: { driverId: { not: null }, isActive: true, balance: { gte: payoutMinimum }, driver: { payoutAccount: { isNot: null } } },
      select: { driverId: true },
    });

    const summary = { batchKey, eligible: due.length, created: 0, paid: 0, processing: 0, failed: 0, skipped: 0 };
    for (const { driverId } of due) {
      try {
        const payout = await this.createPayout(driverId!, batchKey, payoutMinimum);
        if (!payout) { summary.skipped++; continue; }
        summary.created++;
        const sent = await this.send(payout.id);
        if (sent.status === 'PAID') summary.paid++;
        else if (sent.status === 'FAILED') summary.failed++;
        else summary.processing++;
      } catch (error) {
        summary.failed++;
        logger.error('Driver payout failed', { driverId, batchKey, error: String(error) });
      }
    }
    logger.info('Payout batch finished', summary);
    return summary;
  }

  /** Debits the whole balance into a PENDING payout. Returns null if already paid in this batch or below the minimum. */
  private async createPayout(driverId: string, batchKey: string, minimum: Prisma.Decimal) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payout:${driverId}`}))`;
        if (await tx.payout.findUnique({ where: { driverId_batchKey: { driverId, batchKey } } })) return null;
        const wallet = await walletService.driverWallet(tx, driverId);
        const account = await tx.payoutAccount.findUnique({ where: { driverId } });
        const amount = money(wallet.balance);
        if (!account || amount.lt(minimum) || amount.lte(0)) return null;

        const id = randomUUID();
        const payout = await tx.payout.create({
          data: {
            id,
            driverId,
            batchKey,
            amount,
            reference: transferReference(id),
            destination: { type: account.type, bankName: account.bankName, accountNumber: account.accountNumber, accountName: account.accountName, recipientCode: account.recipientCode },
          },
        });
        await walletService.debit(tx, wallet.id, amount, {
          type: 'DEBIT',
          reference: `payout_${payout.id}`,
          description: `Payout to ${account.bankName} ${account.accountNumber}`,
          metadata: { payoutId: payout.id, batchKey },
        });
        return payout;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return null;
      throw error;
    }
  }

  /** Sends (or re-sends after a definitive failure, via admin retry) the transfer for a payout. */
  async send(payoutId: string): Promise<Payout> {
    const claimed = await prisma.payout.updateMany({ where: { id: payoutId, status: 'PENDING' }, data: { status: 'PROCESSING' } });
    const payout = await prisma.payout.findUniqueOrThrow({ where: { id: payoutId } });
    if (claimed.count === 0) return payout;
    const destination = payout.destination as { recipientCode: string };

    try {
      const result = await paystack.transfer({
        amountKobo: toKobo(money(payout.amount)),
        recipientCode: destination.recipientCode,
        reference: payout.reference,
        reason: `Ride Deliva earnings ${payout.batchKey}`,
      });
      await prisma.payout.update({ where: { id: payoutId }, data: { transferCode: result.transferCode } });
      return this.applyTransferStatus(payout.reference, result.status, undefined);
    } catch (error) {
      if (error instanceof ProviderError && error.definitive) {
        return this.applyTransferStatus(payout.reference, 'failed', error.message);
      }
      logger.warn('Payout transfer outcome unknown; will reconcile', { payoutId, error: String(error) });
      return payout;
    }
  }

  /** Admin retry of a FAILED or REVERSED payout: re-debit and send again under a new reference. */
  async retry(payoutId: string) {
    const old = await prisma.payout.findUnique({ where: { id: payoutId } });
    if (!old) throw createError.notFound('Payout not found');
    if (!['FAILED', 'REVERSED'].includes(old.status)) throw createError.conflict(`Cannot retry a ${old.status} payout`);
    const batchKey = `${old.batchKey}-retry-${Date.now().toString(36)}`;
    const payout = await this.createPayout(old.driverId, batchKey, money(0.01));
    if (!payout) throw createError.conflict('Driver has no balance or payout account');
    return this.send(payout.id);
  }

  /** Transfer webhooks (transfer.success / transfer.failed / transfer.reversed). */
  async handleTransferEvent(event: string, data: { reference?: string; reason?: string; gateway_response?: string }) {
    if (!data.reference) return;
    const status = event === 'transfer.success' ? 'success' : event === 'transfer.reversed' ? 'reversed' : 'failed';
    await this.applyTransferStatus(data.reference, status, data.reason ?? data.gateway_response);
  }

  /** Resolves transfers that never got a webhook. */
  async reconcileProcessing(limit = 50) {
    const stuck = await prisma.payout.findMany({
      where: { status: 'PROCESSING', updatedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } },
      take: limit,
      select: { reference: true },
    });
    for (const { reference } of stuck) {
      try {
        const result = await paystack.verifyTransfer(reference);
        await this.applyTransferStatus(reference, result.status, undefined);
      } catch (error) {
        logger.warn('Payout reconciliation failed', { reference, error: String(error) });
      }
    }
    return { checked: stuck.length };
  }

  private async applyTransferStatus(reference: string, providerStatus: string, reason: string | undefined): Promise<Payout> {
    const payout = await prisma.payout.findUnique({ where: { reference } });
    if (!payout) {
      logger.warn('Transfer event for an unknown payout', { reference });
      throw createError.notFound('Payout not found');
    }

    if (providerStatus === 'success') {
      const done = await prisma.payout.updateMany({
        where: { id: payout.id, status: { in: ['PENDING', 'PROCESSING'] } },
        data: { status: 'PAID', paidAt: new Date(), failureReason: null },
      });
      if (done.count) await this.notify(payout.driverId, 'Payout sent', `NGN ${payout.amount.toFixed(2)} has been sent to your account`);
    } else if (['failed', 'reversed', 'otp', 'abandoned', 'rejected'].includes(providerStatus)) {
      const next = providerStatus === 'reversed' ? 'REVERSED' : 'FAILED';
      const why = providerStatus === 'otp' ? 'Transfer requires OTP; disable OTP for API transfers in Paystack' : reason ?? `Transfer ${providerStatus}`;
      await prisma.$transaction(async (tx) => {
        // A reversal can follow a success, so PAID is a valid source state for it.
        const from: Payout['status'][] = next === 'REVERSED' ? ['PENDING', 'PROCESSING', 'PAID'] : ['PENDING', 'PROCESSING'];
        const moved = await tx.payout.updateMany({ where: { id: payout.id, status: { in: from } }, data: { status: next, failureReason: why } });
        if (!moved.count) return;
        const wallet = await walletService.driverWallet(tx, payout.driverId);
        await walletService.credit(tx, wallet.id, money(payout.amount), {
          type: 'REFUND',
          reference: `payout_return_${payout.id}`,
          description: `Payout ${next === 'REVERSED' ? 'reversed' : 'failed'}: returned to wallet`,
          metadata: { payoutId: payout.id, reason: why },
        });
      });
    }
    // 'pending' / 'received' / 'queued': still in flight.
    return prisma.payout.findUniqueOrThrow({ where: { id: payout.id } });
  }

  private async notify(driverId: string, title: string, body: string) {
    const driver = await prisma.driverProfile.findUnique({ where: { id: driverId }, select: { userId: true } });
    if (!driver) return;
    await queueService
      .addJob(QUEUE_NAMES.NOTIFICATION, 'push', { type: 'push', userId: driver.userId, title, body, category: 'payout' })
      .catch((error) => logger.warn('Payout notification not enqueued', { driverId, error: String(error) }));
  }
}

export const payoutService = new PayoutService();
