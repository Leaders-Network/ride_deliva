import { Router } from 'express';
import { deliveryController } from './controllers/delivery.controller';
import { validate } from '@/shared/utils/validation';
import { bookingRateLimiter } from '@/shared/middleware/rate-limiter';
import {
  authenticateCustomer,
  authenticateDriver,
  authenticateVerifiedUser,
} from '@/shared/middleware/auth.middleware';
import {
  estimateDeliverySchema,
  bookDeliverySchema,
  deliveryIdParamSchema,
  listDeliveriesQuerySchema,
  cancelDeliverySchema,
  completeDeliverySchema,
  locationUpdateSchema,
} from './validators/delivery.validators';

const router = Router();
const withId = validate(deliveryIdParamSchema, 'params');

// Customer: pricing and booking
// Order matters: authenticate -> rate limit (needs req.user) -> validate -> handler.
router.post('/estimate', authenticateCustomer, bookingRateLimiter, validate(estimateDeliverySchema), deliveryController.estimate);
router.post('/', authenticateCustomer, bookingRateLimiter, validate(bookDeliverySchema), deliveryController.book);

// Driver: open requests (must stay above /:id)
router.get('/available', authenticateDriver, deliveryController.available);

// Customer or driver: own history, single delivery, tracking, cancel
router.get('/', authenticateVerifiedUser, validate(listDeliveriesQuerySchema, 'query'), deliveryController.list);
router.get('/:id', authenticateVerifiedUser, withId, deliveryController.get);
router.get('/:id/tracking', authenticateVerifiedUser, withId, deliveryController.tracking);
router.post('/:id/cancel', authenticateVerifiedUser, withId, validate(cancelDeliverySchema), deliveryController.cancel);

// Customer: issue a new recipient PIN
router.post('/:id/pin', authenticateCustomer, bookingRateLimiter, withId, deliveryController.resendPin);

// Driver: lifecycle
router.post('/:id/accept', authenticateDriver, withId, deliveryController.accept);
router.post('/:id/pickup', authenticateDriver, withId, deliveryController.driverAction('pickup', 'Package picked up'));
router.post('/:id/transit', authenticateDriver, withId, deliveryController.driverAction('transit', 'Package in transit'));
router.post('/:id/location', authenticateDriver, withId, validate(locationUpdateSchema), deliveryController.location);
// Rate-limited on top of the per-delivery attempt cap, so one driver cannot spray PINs across deliveries.
router.post('/:id/deliver', authenticateDriver, bookingRateLimiter, withId, validate(completeDeliverySchema), deliveryController.deliver);

export { router as deliveryRoutes };
