import Joi from 'joi';
import { commonPatterns, bookingLocationSchema } from '@/shared/utils/validation';
import { DELIVERY_RATES } from '../fee';

const deliveryType = Joi.string().valid('STANDARD', 'EXPRESS', 'SCHEDULED', 'FRAGILE').default('STANDARD');

const packageSchema = Joi.object({
  description: Joi.string().trim().min(1).max(200).required(),
  weightKg: Joi.number().min(0.1).max(DELIVERY_RATES.maxWeightKg).required(),
  size: Joi.string().valid('SMALL', 'MEDIUM', 'LARGE'),
});

const contact = Joi.object({
  name: commonPatterns.name.required(),
  phoneNumber: commonPatterns.phoneNumber.required(),
});

export const estimateDeliverySchema = Joi.object({
  pickup: bookingLocationSchema.required(),
  destination: bookingLocationSchema.required(),
  deliveryType,
  package: packageSchema.required(),
});

export const bookDeliverySchema = Joi.object({
  pickup: bookingLocationSchema.required(),
  destination: bookingLocationSchema.required(),
  deliveryType,
  package: packageSchema.required(),
  recipient: contact.required(),
  sender: contact, // defaults to the booking customer
  specialInstructions: Joi.string().trim().max(500),
  // How the customer will pay. Cash is the default; card/transfer/MoMo are paid via POST /payments/initialize.
  paymentMethod: Joi.string().valid('CASH', 'WALLET', 'CARD', 'BANK_TRANSFER', 'MOBILE_MONEY').default('CASH'),
  scheduledPickupAt: Joi.date().iso().greater('now').when('deliveryType', {
    is: 'SCHEDULED',
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
});

export const deliveryIdParamSchema = Joi.object({
  id: commonPatterns.uuid.required(),
});

export const listDeliveriesQuerySchema = Joi.object({
  ...commonPatterns.pagination,
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

export const cancelDeliverySchema = Joi.object({
  reason: Joi.string().trim().max(500),
});

export const completeDeliverySchema = Joi.object({
  pin: Joi.string()
    .pattern(/^\d{4}$/)
    .required()
    .messages({ 'string.pattern.base': 'pin must be 4 digits' }),
  actualDistance: Joi.number().positive().max(100),
  actualDuration: Joi.number().integer().positive().max(1440),
});

export const locationUpdateSchema = Joi.object({
  latitude: commonPatterns.coordinates.latitude,
  longitude: commonPatterns.coordinates.longitude,
});
