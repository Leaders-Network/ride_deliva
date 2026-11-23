import { Response } from 'express';
import { asyncHandler, createError } from '@/shared/middleware/error-handler';
import { sendSuccess, sendCreated, sendPaginated } from '@/shared/utils/response';
import { AuthenticatedRequest } from '@/types';
import { rideService, DriverAction } from '../services/ride.service';

const requireUser = (req: AuthenticatedRequest) => {
  if (!req.user) throw createError.unauthorized('Authentication required');
  return req.user;
};

const driverProfileOf = (req: AuthenticatedRequest) => {
  const profile = requireUser(req).driverProfile;
  if (!profile) throw createError.forbidden('Driver profile required');
  return profile;
};

export class RideController {
  estimate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, rideService.estimate(req.body), 'Fare estimated');
  });

  book = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    if (!user.customerProfile) throw createError.forbidden('Customer profile required');

    const { ride, estimate } = await rideService.book(user.customerProfile.id, user.id, req.body);
    sendCreated(res, { ride, estimate }, 'Ride requested');
  });

  list = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const { page, limit, status } = req.query as unknown as { page: number; limit: number; status?: any };

    const { data, total } = await rideService.list(user, { page, limit, status });
    sendPaginated(res, data, { page, limit, total }, 'Rides retrieved');
  });

  available = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await rideService.listAvailable(), 'Available rides retrieved');
  });

  get = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await rideService.getForUser(req.params.id, requireUser(req)), 'Ride retrieved');
  });

  accept = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const ride = await rideService.accept(req.params.id, driverProfileOf(req).id);
    sendSuccess(res, ride, 'Ride accepted');
  });

  driverAction = (action: DriverAction, message: string) =>
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      // Only `complete` has a validated body; ignore req.body for every other action.
      const metrics = action === 'complete' ? req.body : {};
      const ride = await rideService.advance(req.params.id, driverProfileOf(req).id, action, metrics);
      sendSuccess(res, ride, message);
    });

  cancel = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = requireUser(req);
    const actor = user.driverProfile
      ? ({ role: 'driver', profileId: user.driverProfile.id } as const)
      : user.customerProfile
        ? ({ role: 'customer', profileId: user.customerProfile.id } as const)
        : null;
    if (!actor) throw createError.forbidden('Only customers and drivers can cancel rides');

    sendSuccess(res, await rideService.cancel(req.params.id, actor, req.body.reason), 'Ride cancelled');
  });
}

export const rideController = new RideController();
