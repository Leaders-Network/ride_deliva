import prisma from '@/config/database';
import { Prisma, TransactionType, Wallet } from '@/generated/prisma';
import { createError } from '@/shared/middleware/error-handler';
import { Money } from '../money';

type Tx = Prisma.TransactionClient;

export interface LedgerEntry {
  type: TransactionType;
  /** Unique per business event (e.g. `cashback_<paymentId>`); a repeat is a no-op. */
  reference: string;
  description: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Wallet ledger. Every balance change writes a Transaction row with a unique reference in
 * the same database transaction, so the balance always equals the sum of its entries and
 * a retried operation never applies twice. Callers must pass the transaction client.
 */
export class WalletService {
  customerWallet(tx: Tx, customerId: string): Promise<Wallet> {
    return tx.wallet.upsert({ where: { customerId }, create: { customerId }, update: {} });
  }

  driverWallet(tx: Tx, driverId: string): Promise<Wallet> {
    return tx.wallet.upsert({ where: { driverId }, create: { driverId }, update: {} });
  }

  async credit(tx: Tx, walletId: string, amount: Money, entry: LedgerEntry) {
    if (amount.lte(0)) return null;
    if (await tx.transaction.findUnique({ where: { reference: entry.reference } })) return null;
    await tx.wallet.update({ where: { id: walletId }, data: { balance: { increment: amount } } });
    return tx.transaction.create({
      data: { walletId, amount, status: 'COMPLETED', ...entry },
    });
  }

  /**
   * Debits under a `balance >= amount` guard in the UPDATE itself, so concurrent debits
   * cannot overdraw. `allowNegative` is for amounts a driver owes (commission on cash trips).
   */
  async debit(tx: Tx, walletId: string, amount: Money, entry: LedgerEntry & { allowNegative?: boolean }) {
    if (amount.lte(0)) return null;
    const { allowNegative, ...rest } = entry;
    if (await tx.transaction.findUnique({ where: { reference: rest.reference } })) return null;
    const debited = await tx.wallet.updateMany({
      where: { id: walletId, isActive: true, ...(!allowNegative && { balance: { gte: amount } }) },
      data: { balance: { decrement: amount } },
    });
    if (debited.count === 0) throw createError.badRequest('Insufficient wallet balance');
    return tx.transaction.create({
      data: { walletId, amount, status: 'COMPLETED', ...rest },
    });
  }

  async view(owner: { customerId?: string; driverId?: string }) {
    const wallet = await prisma.wallet.findFirst({
      where: owner,
      select: { id: true, balance: true, currency: true, isActive: true, updatedAt: true },
    });
    return wallet ?? { id: null, balance: new Prisma.Decimal(0), currency: 'NGN', isActive: true, updatedAt: null };
  }

  async transactions(owner: { customerId?: string; driverId?: string }, page: number, limit: number) {
    const where: Prisma.TransactionWhereInput = { wallet: owner };
    const [data, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        select: { id: true, type: true, amount: true, currency: true, status: true, description: true, reference: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);
    return { data, total };
  }
}

export const walletService = new WalletService();
