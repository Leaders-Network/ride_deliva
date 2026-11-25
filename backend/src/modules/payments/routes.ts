import { Router } from 'express';
import { validate } from '@/shared/utils/validation';
import { bookingRateLimiter } from '@/shared/middleware/rate-limiter';
import {
  authenticateAdmin,
  authenticateCustomer,
  authenticateDriver,
  authenticateVerifiedUser,
} from '@/shared/middleware/auth.middleware';
import { paymentController as c } from './controllers/payment.controller';
import {
  initializePaymentSchema,
  topUpSchema,
  paymentIdParamSchema,
  paginationQuerySchema,
  payoutAccountSchema,
  paymentSettingsSchema,
  runPayoutsSchema,
  listPayoutsQuerySchema,
} from './validators/payment.validators';

const router = Router();
const page = validate(paginationQuerySchema, 'query');
const withId = validate(paymentIdParamSchema, 'params');

// Customer: pay for a trip, top up the wallet. Rate-limited: each call can push a MoMo prompt.
router.post('/initialize', authenticateCustomer, bookingRateLimiter, validate(initializePaymentSchema), c.initialize);
router.post('/wallet/top-up', authenticateCustomer, bookingRateLimiter, validate(topUpSchema), c.topUp);

// Customer or driver: own wallet
router.get('/wallet', authenticateVerifiedUser, c.wallet);
router.get('/wallet/transactions', authenticateVerifiedUser, page, c.walletTransactions);

// Driver: earnings and payouts
router.get('/banks', authenticateDriver, c.banks);
router.get('/payout-account', authenticateDriver, c.getPayoutAccount);
router.put('/payout-account', authenticateDriver, bookingRateLimiter, validate(payoutAccountSchema), c.setPayoutAccount);
router.get('/earnings', authenticateDriver, c.earnings);
router.get('/payouts', authenticateDriver, page, c.payouts);

// Admin
router.get('/admin/settings', authenticateAdmin, c.getSettings);
router.put('/admin/settings', authenticateAdmin, validate(paymentSettingsSchema), c.updateSettings);
router.get('/admin/payouts', authenticateAdmin, validate(listPayoutsQuerySchema, 'query'), c.listAllPayouts);
router.post('/admin/payouts/run', authenticateAdmin, validate(runPayoutsSchema), c.runPayouts);
router.post('/admin/payouts/:id/retry', authenticateAdmin, withId, c.retryPayout);
router.post('/admin/reconcile', authenticateAdmin, c.reconcile);

// Own payment history and status (polled while a MoMo prompt or checkout is open). Keep below fixed paths.
router.get('/', authenticateVerifiedUser, page, c.list);
router.get('/:id', authenticateVerifiedUser, withId, c.get);

export { router as paymentRoutes };
