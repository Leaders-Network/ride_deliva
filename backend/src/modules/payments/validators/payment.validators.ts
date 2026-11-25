import Joi from 'joi';
import { commonPatterns } from '@/shared/utils/validation';
import { TOP_UP_LIMITS } from '../services/payment.service';

export const initializePaymentSchema = Joi.object({
  rideId: commonPatterns.uuid,
  deliveryId: commonPatterns.uuid,
  // Omit to use the method chosen at booking. Cash is settled with the driver, not here.
  // MoMo always charges the account's verified phone number (customer consent).
  method: Joi.string().valid('WALLET', 'CARD', 'BANK_TRANSFER', 'MOBILE_MONEY'),
}).xor('rideId', 'deliveryId');

export const topUpSchema = Joi.object({
  amount: Joi.number().precision(2).min(TOP_UP_LIMITS.min).max(TOP_UP_LIMITS.max).required(),
  method: Joi.string().valid('CARD', 'BANK_TRANSFER', 'MOBILE_MONEY').required(),
});

export const paymentIdParamSchema = Joi.object({ id: commonPatterns.uuid.required() });

export const paginationQuerySchema = Joi.object({ ...commonPatterns.pagination });

export const payoutAccountSchema = Joi.object({
  type: Joi.string().valid('MOMO_PSB', 'BANK').required(),
  accountNumber: Joi.when('type', {
    is: 'BANK',
    then: Joi.string().pattern(/^\d{10}$/).required().messages({ 'string.pattern.base': 'accountNumber must be a 10-digit NUBAN' }),
    otherwise: Joi.string().trim().required(), // MTN number in any common format
  }),
  bankCode: Joi.when('type', { is: 'BANK', then: Joi.string().trim().max(20).required(), otherwise: Joi.forbidden() }),
});

export const paymentSettingsSchema = Joi.object({
  commissionRate: Joi.number().min(0).max(0.5),
  momoCashbackEnabled: Joi.boolean(),
  momoCashbackRate: Joi.number().min(0).max(0.2),
  momoCashbackCap: Joi.number().min(0).max(100_000),
  momoCashbackMinFare: Joi.number().min(0).max(1_000_000),
  payoutMinimum: Joi.number().min(0).max(1_000_000),
}).min(1);

export const runPayoutsSchema = Joi.object({
  batchKey: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
});

export const listPayoutsQuerySchema = Joi.object({
  ...commonPatterns.pagination,
  status: Joi.string().valid('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REVERSED'),
  batchKey: Joi.string().max(60),
});
