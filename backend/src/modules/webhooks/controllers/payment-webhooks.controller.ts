import { Request, Response } from 'express';
import prisma from '@/config/database';
import { config } from '@/config';
import { logger } from '@/config/logger';
import { Prisma, PaymentProvider } from '@/generated/prisma';
import { paystack, MomoProvider } from '@/modules/payments/providers';
import { paymentService } from '@/modules/payments/services/payment.service';
import { payoutService } from '@/modules/payments/services/payout.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Records the event once. Returns false if it was already processed (a redelivery), so the
 * handler can acknowledge without doing anything. Events that failed mid-way are retried.
 */
async function claim(provider: PaymentProvider, eventKey: string, type: string, payload: unknown): Promise<string | null> {
  try {
    const e = await prisma.webhookEvent.create({ data: { provider, eventKey, type, payload: payload as Prisma.InputJsonValue } });
    return e.id;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    const existing = await prisma.webhookEvent.findUniqueOrThrow({ where: { provider_eventKey: { provider, eventKey } } });
    return existing.processedAt ? null : existing.id;
  }
}

const done = (id: string) => prisma.webhookEvent.update({ where: { id }, data: { processedAt: new Date() } });

export class PaymentWebhooksController {
  /**
   * POST /webhooks/paystack. The body must be the raw bytes (see app.ts) because the
   * signature is computed over them. Even a correctly signed charge is re-verified with
   * Paystack's API before it settles anything.
   */
  paystack = async (req: Request, res: Response): Promise<void> => {
    const raw = req.body;
    if (!Buffer.isBuffer(raw)) {
      logger.error('Paystack webhook received a parsed body; the raw-body parser is not mounted');
      res.status(500).json({ error: 'Webhook misconfigured' });
      return;
    }
    if (!paystack.verifySignature(raw, req.header('x-paystack-signature'))) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    let event: { event?: string; data?: any };
    try {
      event = JSON.parse(raw.toString('utf8'));
    } catch {
      res.status(400).json({ error: 'Invalid JSON' });
      return;
    }
    const type = event.event ?? 'unknown';
    const data = event.data ?? {};
    const key = `${type}:${data.reference ?? data.id ?? data.transfer_code ?? 'none'}`;

    try {
      const id = await claim('PAYSTACK', key, type, event);
      if (!id) {
        res.status(200).json({ received: true, duplicate: true });
        return;
      }
      if (type === 'charge.success' && data.reference) {
        await paymentService.verifyPaystackReference(data.reference);
      } else if (type.startsWith('transfer.')) {
        await payoutService.handleTransferEvent(type, data);
      } else {
        logger.info('Unhandled Paystack event', { type });
      }
      await done(id);
      res.status(200).json({ received: true });
    } catch (error) {
      // Non-2xx makes Paystack retry later.
      logger.error('Paystack webhook processing failed', { type, key, error: String(error) });
      res.status(500).json({ error: 'Processing failed' });
    }
  };

  /**
   * PUT/POST /webhooks/momo/:referenceId/:signature. MoMo callbacks are not signed, so the
   * path carries a per-transaction HMAC of the referenceId (MoMo's recommended pattern) and,
   * optionally, the source IP is checked against MoMo's ranges. The body is never trusted:
   * the authenticated status API is the only source of truth.
   *
   * Per MoMo guidance the callback is acknowledged with 200 at once and processed afterwards;
   * if processing fails, the 10-minute reconciliation job settles the payment instead.
   */
  momo = async (req: Request, res: Response): Promise<void> => {
    const { callbackSecret: secret, callbackIps } = config.services.momo;
    const { referenceId, signature } = req.params;
    if (!secret || !UUID.test(referenceId) || !MomoProvider.verifyCallbackSignature(referenceId, signature ?? '', secret)) {
      res.status(404).end();
      return;
    }
    if (callbackIps.length && !callbackIps.includes(normaliseIp(req.ip))) {
      logger.warn('MoMo callback from an unexpected IP', { ip: req.ip, referenceId });
      res.status(403).end();
      return;
    }

    res.status(200).json({ received: true });

    let body: { status?: unknown } = {};
    try {
      body = Buffer.isBuffer(req.body) && req.body.length ? JSON.parse(req.body.toString('utf8')) : {};
    } catch {
      // Ignored: the body is only used for de-duplication.
    }
    const status = typeof body.status === 'string' ? body.status : 'unknown';
    void (async () => {
      const id = await claim('MOMO', `${referenceId}:${status}`, 'requesttopay', body);
      if (!id) return;
      await paymentService.verifyMomoReference(referenceId);
      await done(id);
    })().catch((error) => logger.error('MoMo callback processing failed; reconciliation will retry', { referenceId, error: String(error) }));
  };
}

/** Express reports IPv4 clients as ::ffff:a.b.c.d on dual-stack sockets. */
const normaliseIp = (ip: string | undefined) => (ip ?? '').replace(/^::ffff:/, '');

export const paymentWebhooksController = new PaymentWebhooksController();
