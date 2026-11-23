import { Response } from 'express';
import { asyncHandler, createError } from '@/shared/middleware/error-handler';
import { sendPaginated, sendSuccess } from '@/shared/utils/response';
import { AuthenticatedRequest } from '@/types';
import { adminService } from '../services/admin.service';

const adminId = (req: AuthenticatedRequest) => {
  if (!req.user) throw createError.unauthorized('Authentication required');
  return req.user.id;
};

// Query values arrive already coerced and defaulted by the Joi `validate(..., 'query')` middleware.
const query = <T>(req: AuthenticatedRequest) => req.query as unknown as T & { page: number; limit: number };

export class AdminController {
  stats = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await adminService.stats(), 'Dashboard stats retrieved');
  });

  // Drivers
  listDrivers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const q = query<Parameters<typeof adminService.listDrivers>[0]>(req);
    const { data, total } = await adminService.listDrivers(q);
    sendPaginated(res, data, { page: q.page, limit: q.limit, total }, 'Drivers retrieved');
  });

  getDriver = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await adminService.getDriver(req.params.id), 'Driver retrieved');
  });

  updateDriverStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { status, reason } = req.body;
    const result = await adminService.updateDriverStatus(req.params.id, status, adminId(req), reason);
    sendSuccess(res, result, `Driver ${status.toLowerCase()}`);
  });

  // Customers
  listCustomers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const q = query<Parameters<typeof adminService.listCustomers>[0]>(req);
    const { data, total } = await adminService.listCustomers(q);
    sendPaginated(res, data, { page: q.page, limit: q.limit, total }, 'Customers retrieved');
  });

  getCustomer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await adminService.getCustomer(req.params.id), 'Customer retrieved');
  });

  // Users
  setUserActive = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { isActive, reason } = req.body;
    const result = await adminService.setUserActive(req.params.id, isActive, adminId(req), reason);
    sendSuccess(res, result, isActive ? 'User unblocked' : 'User blocked');
  });

  // Rides
  listRides = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const q = query<Parameters<typeof adminService.listRides>[0]>(req);
    const { data, total } = await adminService.listRides(q);
    sendPaginated(res, data, { page: q.page, limit: q.limit, total }, 'Rides retrieved');
  });

  getRide = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await adminService.getRide(req.params.id), 'Ride retrieved');
  });

  cancelRide = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await adminService.cancelRide(req.params.id, adminId(req), req.body.reason), 'Ride cancelled');
  });

  // Deliveries
  listDeliveries = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const q = query<Parameters<typeof adminService.listDeliveries>[0]>(req);
    const { data, total } = await adminService.listDeliveries(q);
    sendPaginated(res, data, { page: q.page, limit: q.limit, total }, 'Deliveries retrieved');
  });

  getDelivery = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await adminService.getDelivery(req.params.id), 'Delivery retrieved');
  });

  cancelDelivery = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await adminService.cancelDelivery(req.params.id, adminId(req), req.body.reason), 'Delivery cancelled');
  });

  // Payments: paginated, plus per-status totals for the filtered set
  listPayments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const q = query<Parameters<typeof adminService.listPayments>[0]>(req);
    const { data, total, summary } = await adminService.listPayments(q);
    sendSuccess(res, data, 'Payments retrieved', 200, {
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.ceil(total / q.limit),
      summary,
    });
  });
}

export const adminController = new AdminController();
