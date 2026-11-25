import Joi from 'joi';
import { commonPatterns, bookingLocationSchema as rideLocation } from '@/shared/utils/validation';

const rideType = Joi.string().valid('STANDARD', 'PREMIUM', 'SHARED', 'SCHEDULE').default('STANDARD');

export const estimateFareSchema = Joi.object({
  pickup: rideLocation.required(),
  destination: rideLocation.required(),
  rideType,
});

export const bookRideSchema = Joi.object({
  pickup: rideLocation.required(),
  destination: rideLocation.required(),
  rideType,
  passengerCount: Joi.number().integer().min(1).max(6).default(1),
  scheduledAt: Joi.date().iso().greater('now').when('rideType', {
    is: 'SCHEDULE',
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  notes: Joi.string().trim().max(500),
  // How the customer will pay. Cash is the default; card/transfer/MoMo are paid via POST /payments/initialize.
  paymentMethod: Joi.string().valid('CASH', 'WALLET', 'CARD', 'BANK_TRANSFER', 'MOBILE_MONEY').default('CASH'),
});

export const rideIdParamSchema = Joi.object({
  id: commonPatterns.uuid.required(),
});

export const listRidesQuerySchema = Joi.object({
  ...commonPatterns.pagination,
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

export const cancelRideSchema = Joi.object({
  reason: Joi.string().trim().max(500),
});

export const completeRideSchema = Joi.object({
  actualDistance: Joi.number().positive().max(100),
  actualDuration: Joi.number().integer().positive().max(1440),
});
