import { Router } from 'express';
import { paymentWebhooksController as c } from './controllers/payment-webhooks.controller';

/**
 * Payment provider callbacks. Unauthenticated by design: each handler verifies its caller
 * (Paystack HMAC signature; MoMo per-transaction path hash plus a status-API re-check).
 *
 * These routes receive the RAW body (express.raw is mounted for this prefix in app.ts,
 * before express.json), because Paystack's signature covers the exact bytes.
 */
const router = Router();

router.post('/paystack', c.paystack);
router.put('/momo/:referenceId/:signature', c.momo);
router.post('/momo/:referenceId/:signature', c.momo);

export { router as webhookRoutes };
