import { Router } from 'express';
import { StripeWebhookController } from './controllers/stripe.controller';

const router = Router();
const stripeWebhookController = new StripeWebhookController();

/**
 * Stripe webhook endpoint
 * This endpoint receives webhook events from Stripe
 * 
 * Important: This endpoint should NOT use JSON parsing middleware
 * because Stripe requires the raw body for signature verification
 */
router.post(
  '/stripe',
  stripeWebhookController.handleWebhook.bind(stripeWebhookController)
);

export { router as webhookRoutes };
