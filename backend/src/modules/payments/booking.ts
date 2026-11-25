import prisma from '@/config/database';
import { createError } from '@/shared/middleware/error-handler';

/**
 * Booking-time check for wallet payers. It is advisory (the balance can change before the
 * trip ends); the real guard is the atomic debit at completion.
 */
export async function assertCanPayFromWallet(customerId: string, fare: number) {
  const wallet = await prisma.wallet.findUnique({ where: { customerId }, select: { balance: true, isActive: true } });
  if (!wallet?.isActive || wallet.balance.lt(fare)) {
    throw createError.badRequest('Insufficient wallet balance for this trip. Top up or choose another payment method');
  }
}
