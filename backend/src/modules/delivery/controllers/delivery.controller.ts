import { Response } from 'express';
import { asyncHandler, createError } from '@/shared/middleware/error-handler';
import { sendSuccess, sendCreated, sendPaginated } from '@/shared/utils/response';
import { AuthenticatedRequest } from '@/types';
import { deliveryService, DeliveryDriverAction } from '../services/delivery.service';

const requireUser = (req: AuthenticatedRequest) => {
  if (!req.user) throw createError.unauthorized('Authentication required');
  return req.user;
};

const driverProfileOf = (req: AuthenticatedRequest) => {
  const profile = requireUser(req).driverProfile;
  if (!profile) throw createError.forbidden('Driver profile required');
  return profile;
};

const customerProfileOf = (req: AuthenticatedRequest) => {
  const profile = requireUser(req).customerProfile;
  if (!profile) throw createError.forbidden('Customer profile required');
  return profile;
};

export class DeliveryController {
  estimate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, deliveryService.estimate(req.body), 'Delivery fee estimated');
  });

  book = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const result = await deliveryService.book(customerProfileOf(req).id, user, req.body);
    sendCreated(res, result, 'Delivery requested');
  });

  list = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { page, limit, status } = req.query as unknown as { page: number; limit: number; status?: any };

    const { data, total } = await deliveryService.list(user, { page, limit, status });
    sendPaginated(res, data, { page, limit, total }, 'Deliveries retrieved');
  });

  available = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await deliveryService.listAvailable(), 'Available deliveries retrieved');
  });

  get = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await deliveryService.getForUser(req.params.id, requireUser(req)), 'Delivery retrieved');
  });

  tracking = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await deliveryService.getTracking(req.params.id, requireUser(req)), 'Tracking retrieved');
  });

  accept = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await deliveryService.accept(req.params.id, driverProfileOf(req).id), 'Delivery accepted');
  });

  driverAction = (action: DeliveryDriverAction, message: string) =>
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      sendSuccess(res, await deliveryService.advance(req.params.id, driverProfileOf(req).id, action), message);
    });

  deliver = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const delivery = await deliveryService.deliver(req.params.id, driverProfileOf(req).id, req.body);
    sendSuccess(res, delivery, 'Package delivered');
  });

  location = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const point = await deliveryService.recordLocation(req.params.id, driverProfileOf(req).id, req.body);
    sendCreated(res, point, 'Location recorded');
  });

  resendPin = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await deliveryService.resendPin(req.params.id, customerProfileOf(req).id), 'New delivery PIN issued');
  });

  cancel = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const actor = user.driverProfile
      ? ({ role: 'driver', profileId: user.driverProfile.id } as const)
      : user.customerProfile
        ? ({ role: 'customer', profileId: user.customerProfile.id } as const)
        : null;
    if (!actor) throw createError.forbidden('Only customers and drivers can cancel deliveries');

    sendSuccess(res, await deliveryService.cancel(req.params.id, actor, req.body.reason), 'Delivery cancelled');
  });
}

export const deliveryController = new DeliveryController();
