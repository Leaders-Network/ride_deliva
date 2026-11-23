import { Router } from 'express';
import { rideController } from './controllers/ride.controller';
import { validate } from '@/shared/utils/validation';
import { bookingRateLimiter } from '@/shared/middleware/rate-limiter';
import {
  authenticateCustomer,
  authenticateDriver,
  authenticateVerifiedUser,
} from '@/shared/middleware/auth.middleware';
import {
  estimateFareSchema,
  bookRideSchema,
  rideIdParamSchema,
  listRidesQuerySchema,
  cancelRideSchema,
  completeRideSchema,
} from './validators/ride.validators';

const router = Router();
const withId = validate(rideIdParamSchema, 'params');

// Customer: pricing and booking
// Order matters: authenticate -> rate limit (needs req.user) -> validate -> handler.
router.post('/estimate', authenticateCustomer, bookingRateLimiter, validate(estimateFareSchema), rideController.estimate);
router.post('/', authenticateCustomer, bookingRateLimiter, validate(bookRideSchema), rideController.book);

// Driver: open requests (must stay above /:id)
router.get('/available', authenticateDriver, rideController.available);

// Customer or driver: own history and single ride
router.get('/', authenticateVerifiedUser, validate(listRidesQuerySchema, 'query'), rideController.list);
router.get('/:id', authenticateVerifiedUser, withId, rideController.get);
router.post('/:id/cancel', authenticateVerifiedUser, withId, validate(cancelRideSchema), rideController.cancel);

// Driver: lifecycle
router.post('/:id/accept', authenticateDriver, withId, rideController.accept);
router.post('/:id/arriving', authenticateDriver, withId, rideController.driverAction('arriving', 'Driver is on the way'));
router.post('/:id/arrived', authenticateDriver, withId, rideController.driverAction('arrived', 'Driver has arrived'));
router.post('/:id/start', authenticateDriver, withId, rideController.driverAction('start', 'Ride started'));
router.post('/:id/complete', authenticateDriver, withId, validate(completeRideSchema), rideController.driverAction('complete', 'Ride completed'));

export { router as rideRoutes };
