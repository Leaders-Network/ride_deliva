import { Router } from 'express';
import { authenticateAdmin } from '@/shared/middleware/auth.middleware';
import { validate } from '@/shared/utils/validation';
import { adminController as c } from './controllers/admin.controller';
import {
  adminCancelSchema,
  idParamSchema,
  listCustomersQuerySchema,
  listDeliveriesQuerySchema,
  listDriversQuerySchema,
  listPaymentsQuerySchema,
  listRidesQuerySchema,
  setUserActiveSchema,
  updateDriverStatusSchema,
} from './validators/admin.validators';

const router = Router();
const withId = validate(idParamSchema, 'params');
const q = (schema: Parameters<typeof validate>[0]) => validate(schema, 'query');

// Every admin route requires an authenticated admin (ADMIN or SUPER_ADMIN).
router.use(...authenticateAdmin);

router.get('/stats', c.stats);

router.get('/drivers', q(listDriversQuerySchema), c.listDrivers);
router.get('/drivers/:id', withId, c.getDriver);
router.patch('/drivers/:id/status', withId, validate(updateDriverStatusSchema), c.updateDriverStatus);

router.get('/customers', q(listCustomersQuerySchema), c.listCustomers);
router.get('/customers/:id', withId, c.getCustomer);

// :id is the User id (works for customers and drivers alike)
router.patch('/users/:id/active', withId, validate(setUserActiveSchema), c.setUserActive);

router.get('/rides', q(listRidesQuerySchema), c.listRides);
router.get('/rides/:id', withId, c.getRide);
router.post('/rides/:id/cancel', withId, validate(adminCancelSchema), c.cancelRide);

router.get('/deliveries', q(listDeliveriesQuerySchema), c.listDeliveries);
router.get('/deliveries/:id', withId, c.getDelivery);
router.post('/deliveries/:id/cancel', withId, validate(adminCancelSchema), c.cancelDelivery);

router.get('/payments', q(listPaymentsQuerySchema), c.listPayments);

export { router as adminRoutes };
