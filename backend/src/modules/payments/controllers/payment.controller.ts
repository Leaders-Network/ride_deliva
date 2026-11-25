import { Response } from 'express';
import { asyncHandler, createError } from '@/shared/middleware/error-handler';
import { sendSuccess, sendCreated, sendPaginated } from '@/shared/utils/response';
import { AuthenticatedRequest } from '@/types';
import { paymentService } from '../services/payment.service';
import { payoutService } from '../services/payout.service';
import { walletService } from '../services/wallet.service';
import { paymentSettingsService } from '../services/settings.service';

const requireUser = (req: AuthenticatedRequest) => {
  if (!req.user) throw createError.unauthorized('Authentication required');
  return req.user;
};

const driverIdOf = (req: AuthenticatedRequest): string => {
  const profile = requireUser(req).driverProfile;
  if (!profile) throw createError.forbidden('Driver profile required');
  return profile.id;
};

/** Customers and drivers each have their own wallet. */
const walletOwner = (req: AuthenticatedRequest) => {
  const user = requireUser(req);
  if (user.driverProfile) return { driverId: user.driverProfile.id as string };
  if (user.customerProfile) return { customerId: user.customerProfile.id as string };
  throw createError.forbidden('Only customers and drivers have wallets');
};

const pageOf = (req: AuthenticatedRequest) => req.query as unknown as { page: number; limit: number };

export class PaymentController {
  // Collections
  initialize = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await paymentService.initializeTripPayment(requireUser(req), req.body), 'Payment started');
  });

  topUp = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendCreated(res, await paymentService.initializeTopUp(requireUser(req), req.body), 'Top-up started');
  });

  get = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await paymentService.getForUser(req.params.id, requireUser(req)), 'Payment retrieved');
  });

  list = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit } = pageOf(req);
    const { data, total } = await paymentService.listForUser(requireUser(req).id, page, limit);
    sendPaginated(res, data, { page, limit, total }, 'Payments retrieved');
  });

  // Wallet
  wallet = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await walletService.view(walletOwner(req)), 'Wallet retrieved');
  });

  walletTransactions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit } = pageOf(req);
    const { data, total } = await walletService.transactions(walletOwner(req), page, limit);
    sendPaginated(res, data, { page, limit, total }, 'Transactions retrieved');
  });

  // Driver earnings and payouts
  banks = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await payoutService.banks(), 'Banks retrieved');
  });

  getPayoutAccount = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await payoutService.getAccount(driverIdOf(req)), 'Payout account retrieved');
  });

  setPayoutAccount = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await payoutService.setAccount(driverIdOf(req), req.body), 'Payout account saved');
  });

  earnings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await payoutService.earningsSummary(driverIdOf(req)), 'Earnings retrieved');
  });

  payouts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit } = pageOf(req);
    const { data, total } = await payoutService.list(driverIdOf(req), page, limit);
    sendPaginated(res, data, { page, limit, total }, 'Payouts retrieved');
  });

  // Admin
  getSettings = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await paymentSettingsService.get(), 'Payment settings retrieved');
  });

  updateSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await paymentSettingsService.update(req.body, requireUser(req).id), 'Payment settings updated');
  });

  listAllPayouts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const q = req.query as unknown as Parameters<typeof payoutService.listAll>[0];
    const { data, total } = await payoutService.listAll(q);
    sendPaginated(res, data, { page: q.page, limit: q.limit, total }, 'Payouts retrieved');
  });

  runPayouts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await payoutService.runBatch(req.body.batchKey), 'Payout batch run');
  });

  retryPayout = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await payoutService.retry(req.params.id), 'Payout retried');
  });

  reconcile = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const [payments, payouts] = await Promise.all([paymentService.reconcilePending(), payoutService.reconcileProcessing()]);
    sendSuccess(res, { payments, payouts }, 'Reconciliation run');
  });
}

export const paymentController = new PaymentController();
