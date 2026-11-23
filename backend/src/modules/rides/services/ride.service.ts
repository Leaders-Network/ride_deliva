import { randomBytes } from 'crypto';
import prisma from '@/config/database';
import { logger } from '@/config/logger';
import { Prisma, RideStatus, RideType } from '@/generated/prisma';
import { createError } from '@/shared/middleware/error-handler';
import { queueService } from '@/shared/services/queue.service';
import { QUEUE_NAMES } from '@/config/queues';
import { customValidators } from '@/shared/utils/validation';
import { estimateFare, FareEstimate } from '../fare';

interface LocationInput {
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface BookRideInput {
  pickup: LocationInput;
  destination: LocationInput;
  rideType: RideType;
  passengerCount: number;
  scheduledAt?: Date;
  notes?: string;
}

/**
 * The ride state machine as data. Each action may only start from the listed
 * statuses. Keeping it declarative means every legal transition is visible in
 * one place, and the database enforces it (see `advance`), not an if-chain.
 */
const DRIVER_ACTIONS = {
  arriving: { from: ['ACCEPTED'], to: 'DRIVER_ARRIVING' },
  arrived: { from: ['ACCEPTED', 'DRIVER_ARRIVING'], to: 'DRIVER_ARRIVED' },
  start: { from: ['DRIVER_ARRIVED'], to: 'IN_PROGRESS' },
  complete: { from: ['IN_PROGRESS'], to: 'COMPLETED' },
} as const satisfies Record<string, { from: readonly RideStatus[]; to: RideStatus }>;

export type DriverAction = keyof typeof DRIVER_ACTIONS;

const ACTIVE: RideStatus[] = ['REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'IN_PROGRESS'];
const CANCELLABLE = {
  customer: ['REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED'],
  driver: ['ACCEPTED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED'], // a driver cannot abandon a trip mid-ride
} as const satisfies Record<string, RideStatus[]>;

/**
 * SECURITY: allow-list what leaves the API. Never `include: { driver: true }`:
 * that returns the whole DriverProfile (bank account, licence number, documents,
 * earnings) to the customer. New columns stay private until someone opts them in here.
 */
const person = { select: { firstName: true, lastName: true, profilePicture: true, phoneNumber: true } };
const address = { select: { streetAddress: true, city: true, state: true, latitude: true, longitude: true } };
const rideView = {
  pickupAddress: address,
  destinationAddress: address,
  vehicle: { select: { type: true, make: true, model: true, color: true, licensePlate: true } },
  payment: { select: { status: true, method: true, amount: true, currency: true } },
  driver: { select: { id: true, rating: true, user: person } },
  customer: { select: { id: true, rating: true, user: person } },
} satisfies Prisma.RideInclude;

// Unguessable public reference. Math.random is predictable; crypto is not.
const newRideCode = () => `RD${randomBytes(5).toString('hex').toUpperCase()}`;

const assertInServiceArea = (label: string, p: { latitude: number; longitude: number }) => {
  if (!customValidators.isWithinServiceArea(p.latitude, p.longitude)) {
    throw createError.badRequest(`${label} is outside the service area`);
  }
};

export class RideService {
  estimate({ pickup, destination, rideType }: Pick<BookRideInput, 'pickup' | 'destination' | 'rideType'>): FareEstimate {
    assertInServiceArea('Pickup', pickup);
    assertInServiceArea('Destination', destination);

    const estimate = estimateFare(pickup, destination, rideType);
    if (!customValidators.isValidDistance(estimate.distanceKm)) {
      throw createError.badRequest('Trip distance must be greater than 0 and at most 100 km');
    }
    return estimate;
  }

  async book(customerId: string, userId: string, input: BookRideInput) {
    // Price on the server. The client never sends a fare, so it cannot choose its own price.
    const estimate = this.estimate(input);

    const toAddress = (title: string, l: LocationInput) => ({
      userId,
      type: 'OTHER' as const,
      title,
      streetAddress: l.address,
      city: l.city,
      state: l.state,
      postalCode: l.postalCode,
      latitude: l.latitude,
      longitude: l.longitude,
    });

    const ride = await prisma.$transaction(async (tx) => {
      // "One active ride" is check-then-insert, which two parallel requests both pass.
      // A per-customer advisory lock (released at commit) serialises them, so the
      // second request sees the first one's ride. No migration needed.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${customerId}))`;

      if ((await tx.ride.count({ where: { customerId, status: { in: ACTIVE } } })) > 0) {
        throw createError.conflict('You already have a ride in progress');
      }

      const [pickup, destination] = await Promise.all([
        tx.address.create({ data: toAddress('Pickup', input.pickup) }),
        tx.address.create({ data: toAddress('Destination', input.destination) }),
      ]);

      return tx.ride.create({
        data: {
          rideCode: newRideCode(),
          customerId,
          pickupAddressId: pickup.id,
          destinationAddressId: destination.id,
          rideType: input.rideType,
          passengerCount: input.passengerCount,
          scheduledAt: input.scheduledAt,
          notes: input.notes,
          estimatedFare: estimate.fare,
          surgeMultiplier: estimate.surgeMultiplier,
          estimatedDistance: estimate.distanceKm,
          estimatedDuration: estimate.durationMinutes,
        },
        include: rideView,
      });
    });

    // Enqueue only after the commit, so a worker can never see a ride that does not exist yet.
    // Best-effort: the ride is already saved, and drivers can still find it via /rides/available.
    if (!input.scheduledAt) {
      await queueService
        .addJob(QUEUE_NAMES.RIDE, 'match_driver', {
          type: 'match_driver',
          rideId: ride.id,
          userId,
          data: { pickupLatitude: input.pickup.latitude, pickupLongitude: input.pickup.longitude },
        })
        .catch((error) => logger.warn('Driver matching not enqueued', { rideId: ride.id, error: String(error) }));
    }

    return { ride, estimate };
  }

  /** Visible to the ride's customer, its driver, or an admin. */
  async getForUser(rideId: string, user: { customerProfile?: any; driverProfile?: any; adminProfile?: any }) {
    const ride = await prisma.ride.findUnique({ where: { id: rideId }, include: rideView });

    const allowed =
      ride &&
      (user.adminProfile ||
        (user.customerProfile && ride.customer.id === user.customerProfile.id) ||
        (user.driverProfile && ride.driver?.id === user.driverProfile.id));

    // SECURITY: "exists but not yours" and "does not exist" must look identical (404, not 403),
    // otherwise ride ids can be probed to learn which ones are real.
    if (!allowed) throw createError.notFound('Ride not found');
    return ride;
  }

  async list(
    user: { customerProfile?: any; driverProfile?: any },
    { page, limit, status }: { page: number; limit: number; status?: RideStatus }
  ) {
    // Scope every query to the caller. A user with neither profile (e.g. an admin) gets a
    // clear 403 instead of a query against an empty id.
    const scope = user.driverProfile
      ? { driverId: user.driverProfile.id }
      : user.customerProfile
        ? { customerId: user.customerProfile.id }
        : null;
    if (!scope) throw createError.forbidden('Only customers and drivers have ride history');

    const where: Prisma.RideWhereInput = { ...scope, ...(status && { status }) };
    const [data, total] = await Promise.all([
      prisma.ride.findMany({
        where,
        include: rideView,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.ride.count({ where }),
    ]);
    return { data, total };
  }

  /** Open requests. Deliberately omits the customer: a driver learns who they are riding with only after accepting. */
  listAvailable(limit = 20) {
    return prisma.ride.findMany({
      where: { status: 'REQUESTED', driverId: null, scheduledAt: null },
      select: {
        id: true,
        rideCode: true,
        estimatedFare: true,
        estimatedDistance: true,
        pickupAddress: address,
        destinationAddress: address,
      },
      orderBy: { requestedAt: 'asc' },
      take: limit,
    });
  }

  /**
   * Two drivers can tap "accept" in the same millisecond. `updateMany` with the
   * expected state in `where` is a compare-and-swap done by the database: exactly one
   * caller gets count = 1, the rest get 0. A read-then-write here would let both win.
   */
  async accept(rideId: string, driverId: string) {
    const vehicle = await prisma.vehicle.findFirst({ where: { driverId, isActive: true }, select: { id: true } });
    if (!vehicle) throw createError.badRequest('An active vehicle is required to accept rides');

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.ride.updateMany({
        where: { id: rideId, status: 'REQUESTED', driverId: null },
        data: { driverId, vehicleId: vehicle.id, status: 'ACCEPTED', acceptedAt: new Date() },
      });
      if (claimed.count === 0) throw createError.conflict('Ride is no longer available');

      // Re-check eligibility in the write itself. The profile attached to the request may be
      // milliseconds stale (suspended, went offline, took another ride). Throwing rolls back the claim.
      const busy = await tx.driverProfile.updateMany({
        where: { id: driverId, status: 'APPROVED', isOnline: true, isAvailable: true },
        data: { isAvailable: false },
      });
      if (busy.count === 0) throw createError.conflict('You are not available to take rides');
    });

    return this.view(rideId);
  }

  async advance(rideId: string, driverId: string, action: DriverAction, metrics: { actualDistance?: number; actualDuration?: number } = {}) {
    const { from, to } = DRIVER_ACTIONS[action];
    const owner = { id: rideId, driverId }; // only the assigned driver may touch the ride

    await prisma.$transaction(async (tx) => {
      const data: Prisma.RideUncheckedUpdateManyInput = { status: to };
      if (to === 'DRIVER_ARRIVED') data.arrivedAt = new Date();
      if (to === 'IN_PROGRESS') data.startedAt = new Date();
      if (to === 'COMPLETED') {
        // The fare is server-owned. Distance/duration are recorded but never repriced from client input.
        const ride = await tx.ride.findFirst({ where: owner, select: { estimatedFare: true } });
        // Name the fields instead of spreading `metrics`: a spread would write any extra key a caller smuggles in.
        Object.assign(data, {
          completedAt: new Date(),
          finalFare: ride?.estimatedFare,
          actualDistance: metrics.actualDistance,
          actualDuration: metrics.actualDuration,
        });
      }

      // Same compare-and-swap: the legal source states are part of the write.
      const moved = await tx.ride.updateMany({ where: { ...owner, status: { in: [...from] } }, data });
      if (moved.count === 0) await this.reject(owner, `move to ${to}`);

      if (to === 'COMPLETED') {
        const ride = await tx.ride.findUniqueOrThrow({ where: { id: rideId }, select: { customerId: true } });
        await tx.driverProfile.update({ where: { id: driverId }, data: { isAvailable: true, totalRides: { increment: 1 } } });
        await tx.customerProfile.update({ where: { id: ride.customerId }, data: { totalRides: { increment: 1 } } });
      }
    });

    return this.view(rideId);
  }

  async cancel(rideId: string, actor: { role: 'customer' | 'driver'; profileId: string }, reason?: string) {
    const owner = { id: rideId, ...(actor.role === 'customer' ? { customerId: actor.profileId } : { driverId: actor.profileId }) };

    await prisma.$transaction(async (tx) => {
      const cancelled = await tx.ride.updateMany({
        where: { ...owner, status: { in: [...CANCELLABLE[actor.role]] } },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason },
      });
      if (cancelled.count === 0) await this.reject(owner, 'cancel');

      // Safe to read afterwards: a CANCELLED ride can no longer be accepted, so driverId is final.
      const { driverId } = await tx.ride.findUniqueOrThrow({ where: { id: rideId }, select: { driverId: true } });
      if (driverId) await tx.driverProfile.update({ where: { id: driverId }, data: { isAvailable: true } });
    });

    return this.view(rideId);
  }

  private view(rideId: string) {
    return prisma.ride.findUniqueOrThrow({ where: { id: rideId }, include: rideView });
  }

  /** A guarded write matched nothing: 404 if the caller has no claim on the ride, otherwise 409 with the reason. */
  private async reject(owner: Prisma.RideWhereInput, attempted: string): Promise<never> {
    const ride = await prisma.ride.findFirst({ where: owner, select: { status: true } });
    if (!ride) throw createError.notFound('Ride not found');
    throw createError.conflict(`Cannot ${attempted}: ride is ${ride.status}`);
  }
}

export const rideService = new RideService();
