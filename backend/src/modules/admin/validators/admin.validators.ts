import Joi from 'joi';
import { commonPatterns } from '@/shared/utils/validation';

const search = Joi.string().trim().max(100).allow('');
const dateRange = {
  from: Joi.date().iso(),
  to: Joi.date().iso().min(Joi.ref('from')),
};

export const idParamSchema = Joi.object({
  id: commonPatterns.uuid.required(),
});

export const listDriversQuerySchema = Joi.object({
  ...commonPatterns.pagination,
  search,
  status: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'INACTIVE'),
});

export const listCustomersQuerySchema = Joi.object({
  ...commonPatterns.pagination,
  search,
  active: Joi.boolean(),
});

export const listRidesQuerySchema = Joi.object({
  ...commonPatterns.pagination,
  search,
  ...dateRange,
  status: Joi.string().valid(
    'REQUESTED',
    'ACCEPTED',
    'DRIVER_ARRIVING',
    'DRIVER_ARRIVED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
  ),
});

export const listDeliveriesQuerySchema = Joi.object({
  ...commonPatterns.pagination,
  search,
  ...dateRange,
  status: Joi.string().valid(
    'REQUESTED',
    'ACCEPTED',
    'DRIVER_ASSIGNED',
    'PICKED_UP',
    'IN_TRANSIT',
    'DELIVERED',
    'CANCELLED'
  ),
});

export const listPaymentsQuerySchema = Joi.object({
  ...commonPatterns.pagination,
  ...dateRange,
  status: Joi.string().valid('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED'),
  method: Joi.string().valid('WALLET', 'CARD', 'BANK_TRANSFER', 'CASH', 'MOBILE_MONEY'),
});

export const updateDriverStatusSchema = Joi.object({
  status: Joi.string().valid('APPROVED', 'REJECTED', 'SUSPENDED', 'INACTIVE').required(),
  // A reason is required whenever the driver loses (or is denied) access.
  reason: Joi.string().trim().max(500).when('status', {
    is: 'APPROVED',
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
});

export const setUserActiveSchema = Joi.object({
  isActive: Joi.boolean().required(),
  reason: Joi.string().trim().max(500),
});

export const adminCancelSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required(),
});
