import { Request, Response } from 'express';
import Stripe from 'stripe';
import { logger } from '../../../config/logger';
import { config } from '../../../config';

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2024-06-20',
});

export class StripeWebhookController {
  /**
   * Handle Stripe webhook events
   */
  public async handleWebhook(req: Request, res: Response): Promise<void> {
    const sig = req.headers['stripe-signature'] as string;
    const endpointSecret = config.stripe.webhookSecret;

    let event: Stripe.Event;

    try {
      // Verify the webhook signature
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      logger.info('Stripe webhook signature verified', { eventType: event.type });
    } catch (err) {
      logger.error('Stripe webhook signature verification failed', { error: err });
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }

    try {
      // Handle the event
      await this.processWebhookEvent(event);
      
      // Return a response to acknowledge receipt of the event
      res.status(200).json({ received: true });
    } catch (error) {
      logger.error('Error processing Stripe webhook', { 
        eventType: event.type,
        eventId: event.id,
        error 
      });
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Process different types of Stripe webhook events
   */
  private async processWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'charge.dispute.created':
        await this.handleChargeDisputeCreated(event.data.object as Stripe.Dispute);
        break;

      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'account.updated':
        await this.handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      case 'transfer.created':
        await this.handleTransferCreated(event.data.object as Stripe.Transfer);
        break;

      default:
        logger.info('Unhandled Stripe webhook event type', { eventType: event.type });
    }
  }

  /**
   * Handle successful payment intent
   */
  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    logger.info('Payment intent succeeded', { 
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency
    });

    // TODO: Update order status, notify driver, update wallet balance, etc.
    // Example implementation:
    // const orderId = paymentIntent.metadata?.orderId;
    // if (orderId) {
    //   await this.orderService.markPaymentCompleted(orderId, paymentIntent);
    //   await this.notificationService.notifyPaymentSuccess(orderId);
    // }
  }

  /**
   * Handle failed payment intent
   */
  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    logger.warn('Payment intent failed', { 
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      lastPaymentError: paymentIntent.last_payment_error
    });

    // TODO: Handle payment failure - notify customer, cancel order, etc.
    // const orderId = paymentIntent.metadata?.orderId;
    // if (orderId) {
    //   await this.orderService.markPaymentFailed(orderId, paymentIntent);
    //   await this.notificationService.notifyPaymentFailure(orderId);
    // }
  }

  /**
   * Handle charge dispute created
   */
  private async handleChargeDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
    logger.warn('Charge dispute created', { 
      disputeId: dispute.id,
      chargeId: dispute.charge,
      amount: dispute.amount,
      reason: dispute.reason
    });

    // TODO: Handle dispute - notify relevant parties, gather evidence, etc.
  }

  /**
   * Handle subscription created (for premium features)
   */
  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    logger.info('Subscription created', { 
      subscriptionId: subscription.id,
      customerId: subscription.customer
    });

    // TODO: Activate premium features for user
  }

  /**
   * Handle subscription updated
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    logger.info('Subscription updated', { 
      subscriptionId: subscription.id,
      status: subscription.status
    });

    // TODO: Update user's subscription status
  }

  /**
   * Handle subscription deleted
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    logger.info('Subscription deleted', { 
      subscriptionId: subscription.id,
      customerId: subscription.customer
    });

    // TODO: Revoke premium features for user
  }

  /**
   * Handle invoice payment succeeded
   */
  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    logger.info('Invoice payment succeeded', { 
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      amountPaid: invoice.amount_paid
    });

    // TODO: Update subscription status, send receipt, etc.
  }

  /**
   * Handle invoice payment failed
   */
  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    logger.warn('Invoice payment failed', { 
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      amountDue: invoice.amount_due
    });

    // TODO: Handle failed subscription payment - retry, notify user, etc.
  }

  /**
   * Handle connected account updated (for driver payouts)
   */
  private async handleAccountUpdated(account: Stripe.Account): Promise<void> {
    logger.info('Connected account updated', { 
      accountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled
    });

    // TODO: Update driver account status based on Stripe account capabilities
  }

  /**
   * Handle transfer created (driver payouts)
   */
  private async handleTransferCreated(transfer: Stripe.Transfer): Promise<void> {
    logger.info('Transfer created', { 
      transferId: transfer.id,
      amount: transfer.amount,
      destination: transfer.destination
    });

    // TODO: Update driver earnings record, send payout notification
  }
}