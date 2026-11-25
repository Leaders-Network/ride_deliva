import prisma from '@/config/database';
import { Prisma, PaymentSettings } from '@/generated/prisma';

type Db = Prisma.TransactionClient | typeof prisma;

export interface PaymentSettingsInput {
  commissionRate?: number;
  momoCashbackEnabled?: boolean;
  momoCashbackRate?: number;
  momoCashbackCap?: number;
  momoCashbackMinFare?: number;
  payoutMinimum?: number;
}

const ID = 'default';

export class PaymentSettingsService {
  /** The single settings row, created with schema defaults on first read. */
  get(db: Db = prisma): Promise<PaymentSettings> {
    return db.paymentSettings.upsert({ where: { id: ID }, create: { id: ID }, update: {} });
  }

  update(input: PaymentSettingsInput, adminUserId: string): Promise<PaymentSettings> {
    // Name the fields: a spread would write any extra key a caller smuggles in.
    const data = {
      commissionRate: input.commissionRate,
      momoCashbackEnabled: input.momoCashbackEnabled,
      momoCashbackRate: input.momoCashbackRate,
      momoCashbackCap: input.momoCashbackCap,
      momoCashbackMinFare: input.momoCashbackMinFare,
      payoutMinimum: input.payoutMinimum,
      updatedBy: adminUserId,
    };
    return prisma.paymentSettings.upsert({ where: { id: ID }, create: { id: ID, ...data }, update: data });
  }
}

export const paymentSettingsService = new PaymentSettingsService();
