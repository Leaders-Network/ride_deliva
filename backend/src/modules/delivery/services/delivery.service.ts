import { randomBytes } from 'crypto';
import prisma from '@/config/database';
import { logger } from '@/config/logger';
import { DeliveryStatus, DeliveryType, Prisma } from '@/generated/prisma';
import { createError } from '@/shared/middleware/error-handler';
import { queueService } from '@/shared/services/queue.service';
import { QUEUE_NAMES } from '@/config/queues';
import { customValidators } from '@/shared/utils/validation';
import { estimateDeliveryFee, DeliveryFeeEstimate } from '../fee';
import { generatePin, hashPin, verifyPin, MAX_PIN_ATTEMPTS } from '../pin';

interface LocationInput {
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  state: string;
  postalCode: string;
}

interface Contact {
  name: string;
  phoneNumber: string;
}

export interface PackageInput {
  description: string;
  weightKg: number;
  size?: 'SMALL' | 'MEDIUM' | 'LARGE';
}

export interface EstimateDeliveryInput {
  pickup: LocationInput;
  destination: LocationInput;
  deliveryType: DeliveryType;
  package: PackageInput;
}

export interface BookDeliveryInput extends EstimateDeliveryInput {
  recipient: Contact;
  sender?: Contact;
  specialInstructions?: string;
  scheduledPickupAt?: Date;
}

export interface BookingUser {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

/** A customer may have this many deliveries in flight at once (senders often dispatch several parcels). */
export const MAX_ACTIVE_DELIVERIES = 3;

/**
 * The driver-side state machine as data, like rides. Completion (`deliver`) is not
 * here because it also needs the recipient PIN; see `deliver`.
 * DRIVER_ASSIGNED is reserved for admin dispatch and is accepted as a source state
 * so that path works without changes once it exists.
 */
const DRIVER_ACTIONS = {
  pickup: { from: ['ACCEPTED', 'DRIVER_ASSIGNED'], to: 'PICKED_UP' },
  transit: { from: ['PICKED_UP'], to: 'IN_TRANSIT' },
} as const satisfies Record<string, { from: readonly DeliveryStatus[]; to: DeliveryStatus }>;

export type DeliveryDriverAction = keyof typeof DRIVER_ACTIONS;

const ACTIVE: DeliveryStatus[] = ['REQUESTED', 'ACCEPTED', 'DRIVER_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'];
const DELIVERABLE: DeliveryStatus[] = ['PICKED_UP', 'IN_TRANSIT'];
const TRACKABLE: DeliveryStatus[] = ['ACCEPTED', 'DRIVER_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'];
const CANCELLABLE = {
  customer: ['REQUESTED', 'ACCEPTED', 'DRIVER_ASSIGNED'],
  // Once the driver holds the package, cancelling would strand it; that goes through support.
  driver: ['ACCEPTED', 'DRIVER_ASSIGNED'],
} as const satisfies Record<string, DeliveryStatus[]>;

/**
 * SECURITY: allow-list what leaves the API. This is a `select`, not an `include`, so
 * the PIN hash and attempt counter (and any column added later) stay private unless
 * someone opts them in here. Never return a whole DriverProfile either (bank details,
 * licence, documents): see the same note in ride.service.ts.
 */
const person = { select: { firstName: true, lastName: true, profilePicture: true, phoneNumber: true } };
const address = { select: { streetAddress: true, city: true, state: true, latitude: true, longitude: true } };
const deliveryView = {
  id: true,
  deliveryCode: true,
  status: true,
  deliveryType: true,
  packageDetails: true,
  specialInstructions: true,
  senderInfo: true,
  recipientInfo: true,
  scheduledPickupAt: true,
  scheduledDeliveryAt: true,
  requestedAt: true,
  acceptedAt: true,
  pickedUpAt: true,
  deliveredAt: true,
  cancelledAt: true,
  estimatedFare: true,
  finalFare: true,
  estimatedDistance: true,
  actualDistance: true,
  estimatedDuration: true,
  actualDuration: true,
  notes: true,
  cancellationReason: true,
  proofOfDelivery: true,
  createdAt: true,
  updatedAt: true,
  pickupAddress: address,
  destinationAddress: address,
  vehicle: { select: { type: true, make: true, model: true, color: true, licensePlate: true } },
  payment: { select: { status: true, method: true, amount: true, currency: true } },
  driver: { select: { id: true, rating: true, user: person } },
  customer: { select: { id: true, rating: true, user: person } },
} satisfies Prisma.DeliverySelect;

// Unguessable public reference. Math.random is predictable; crypto is not.
const newDeliveryCode = () => `DL${randomBytes(5).toString('hex').toUpperCase()}`;

const assertInServiceArea = (label: string, p: { latitude: number; longitude: number }) => {
  if (!customValidators.isWithinServiceArea(p.latitude, p.longitude)) {
    throw createError.badRequest(`${label} is outside the service area`);
  }
};

const pinMessage = (code: string, senderName: string, pin: string) =>
  `Ride Deliva: ${senderName} is sending you a package (${code}). ` +
  `Give the driver this PIN only when you receive it: ${pin}`;

type Viewer = { customerProfile?: any; driverProfile?: any; adminProfile?: any };

export class DeliveryService {
  estimate({ pickup, destination, deliveryType, package: pkg }: EstimateDeliveryInput): DeliveryFeeEstimate {
    assertInServiceArea('Pickup', pickup);
    assertInServiceArea('Destination', destination);

    const estimate = estimateDeliveryFee(pickup, destination, pkg.weightKg, deliveryType);
    if (!customValidators.isValidDistance(estimate.distanceKm)) {
      throw createError.badRequest('Delivery distance must be greater than 0 and at most 100 km');
    }
    return estimate;
  }

  async book(customerId: string, user: BookingUser, input: BookDeliveryInput) {
    // Price on the server. The client never sends a fee, so it cannot choose its own price.
    const estimate = this.estimate(input);
    const sender = input.sender ?? { name: `${user.firstName} ${user.lastName}`.trim(), phoneNumber: user.phoneNumber };

    const pin = generatePin();
    const pinHash = await hashPin(pin); // hash before opening the transaction; bcrypt is slow

    const toAddress = (title: string, l: LocationInput) => ({
      userId: user.id,
      type: 'OTHER' as const,
      title,
      streetAddress: l.address,
      city: l.city,
      state: l.state,
      postalCode: l.postalCode,
      latitude: l.latitude,
      longitude: l.longitude,
    });

    const delivery = await prisma.$transaction(async (tx) => {
      // "At most N active" is check-then-insert, which parallel requests can all pass.
      // A per-customer advisory lock (released at commit) serialises them. The key is
      // namespaced so it does not contend with the same customer's ride bookings.
      const lockKey = `delivery:${customerId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const active = await tx.delivery.count({ where: { customerId, status: { in: ACTIVE } } });
      if (active >= MAX_ACTIVE_DELIVERIES) {
        throw createError.conflict(`You can have at most ${MAX_ACTIVE_DELIVERIES} deliveries in progress`);
      }

      const [pickup, destination] = await Promise.all([
        tx.address.create({ data: toAddress('Pickup', input.pickup) }),
        tx.address.create({ data: toAddress('Destination', input.destination) }),
      ]);

      return tx.delivery.create({
        data: {
          deliveryCode: newDeliveryCode(),
          customerId,
          pickupAddressId: pickup.id,
          destinationAddressId: destination.id,
          deliveryType: input.deliveryType,
          // Name the fields: a spread would store any extra key a caller smuggles in.
          packageDetails: { description: input.package.description, weightKg: input.package.weightKg, size: input.package.size ?? null },
          specialInstructions: input.specialInstructions,
          senderInfo: { name: sender.name, phoneNumber: sender.phoneNumber },
          recipientInfo: { name: input.recipient.name, phoneNumber: input.recipient.phoneNumber },
          scheduledPickupAt: input.scheduledPickupAt,
          estimatedFare: estimate.fee,
          estimatedDistance: estimate.distanceKm,
          estimatedDuration: estimate.durationMinutes,
          deliveryPinHash: pinHash,
        },
        select: deliveryView,
      });
    });

    // Enqueue only after the commit, so a worker never sees a delivery that does not exist yet.
    // Best-effort: the delivery is saved, drivers can find it via /delivery/available, and the
    // sender has the PIN from this response if the SMS does not go out.
    if (!input.scheduledPickupAt) {
      await queueService
        .addJob(QUEUE_NAMES.DELIVERY, 'assign_courier', {
          type: 'assign_courier',
          deliveryId: delivery.id,
          userId: user.id,
          data: { pickupLatitude: input.pickup.latitude, pickupLongitude: input.pickup.longitude },
        })
        .catch((error) => logger.warn('Courier assignment not enqueued', { deliveryId: delivery.id, error: String(error) }));
    }
    await this.sendPin(delivery.id, delivery.deliveryCode, sender.name, input.recipient.phoneNumber, pin);

    return { delivery, estimate, deliveryPin: pin };
  }

  /** Visible to the delivery's customer, its driver, or an admin. */
  async getForUser(deliveryId: string, user: Viewer) {
    const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId }, select: deliveryView });

    const allowed =
      delivery &&
      (user.adminProfile ||
        (user.customerProfile && delivery.customer.id === user.customerProfile.id) ||
        (user.driverProfile && delivery.driver?.id === user.driverProfile.id));

    // SECURITY: "exists but not yours" and "does not exist" must look identical (404, not 403).
    if (!allowed) throw createError.notFound('Delivery not found');
    return delivery;
  }

  async list(
    user: { customerProfile?: any; driverProfile?: any },
    { page, limit, status }: { page: number; limit: number; status?: DeliveryStatus }
  ) {
    const scope = user.driverProfile
      ? { driverId: user.driverProfile.id }
      : user.customerProfile
        ? { customerId: user.customerProfile.id }
        : null;
    if (!scope) throw createError.forbidden('Only customers and drivers have delivery history');

    const where: Prisma.DeliveryWhereInput = { ...scope, ...(status && { status }) };
    const [data, total] = await Promise.all([
      prisma.delivery.findMany({
        where,
        select: deliveryView,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.delivery.count({ where }),
    ]);
    return { data, total };
  }

  /**
   * Open requests. Shows what a driver needs to decide (route, fee, parcel size and weight)
   * but not who is sending or receiving: contacts are revealed only after accepting.
   */
  listAvailable(limit = 20) {
    return prisma.delivery.findMany({
      where: { status: 'REQUESTED', driverId: null, scheduledPickupAt: null },
      select: {
        id: true,
        deliveryCode: true,
        deliveryType: true,
        packageDetails: true,
        estimatedFare: true,
        estimatedDistance: true,
        estimatedDuration: true,
        pickupAddress: address,
        destinationAddress: address,
      },
      orderBy: { requestedAt: 'asc' },
      take: limit,
    });
  }

  /** Compare-and-swap claim, as in RideService.accept: exactly one of several racing drivers wins. */
  async accept(deliveryId: string, driverId: string) {
    const vehicle = await prisma.vehicle.findFirst({ where: { driverId, isActive: true }, select: { id: true } });
    if (!vehicle) throw createError.badRequest('An active vehicle is required to accept deliveries');

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.delivery.updateMany({
        where: { id: deliveryId, status: 'REQUESTED', driverId: null },
        data: { driverId, vehicleId: vehicle.id, status: 'ACCEPTED', acceptedAt: new Date() },
      });
      if (claimed.count === 0) throw createError.conflict('Delivery is no longer available');

      // Re-check eligibility in the write itself; the profile on the request may be stale.
      // Throwing rolls back the claim.
      const busy = await tx.driverProfile.updateMany({
        where: { id: driverId, status: 'APPROVED', isOnline: true, isAvailable: true },
        data: { isAvailable: false },
      });
      if (busy.count === 0) throw createError.conflict('You are not available to take deliveries');
    });

    return this.view(deliveryId);
  }

  async advance(deliveryId: string, driverId: string, action: DeliveryDriverAction) {
    const { from, to } = DRIVER_ACTIONS[action];
    const owner = { id: deliveryId, driverId }; // only the assigned driver may touch the delivery

    const data: Prisma.DeliveryUncheckedUpdateManyInput = { status: to };
    if (to === 'PICKED_UP') data.pickedUpAt = new Date();

    const moved = await prisma.delivery.updateMany({ where: { ...owner, status: { in: [...from] } }, data });
    if (moved.count === 0) await this.reject(owner, `move to ${to}`);

    return this.view(deliveryId);
  }

  /**
   * Hand-over. The attempt is reserved (counter incremented under a `< MAX` guard)
   * BEFORE the PIN is checked. Checking first would let many parallel requests all
   * read the same counter and each get a guess; reserving first makes the cap exact.
   */
  async deliver(
    deliveryId: string,
    driverId: string,
    { pin, actualDistance, actualDuration }: { pin: string; actualDistance?: number; actualDuration?: number }
  ) {
    const owner = { id: deliveryId, driverId };

    const reserved = await prisma.delivery.updateMany({
      where: { ...owner, status: { in: DELIVERABLE }, deliveryPinAttempts: { lt: MAX_PIN_ATTEMPTS } },
      data: { deliveryPinAttempts: { increment: 1 } },
    });
    if (reserved.count === 0) {
      const current = await prisma.delivery.findFirst({ where: owner, select: { status: true } });
      if (!current) throw createError.notFound('Delivery not found');
      if (!DELIVERABLE.includes(current.status)) throw createError.conflict(`Cannot complete delivery: delivery is ${current.status}`);
      throw createError.conflict('Too many incorrect PIN attempts. Ask the sender to issue a new PIN or contact support');
    }

    const { deliveryPinHash, deliveryPinAttempts, estimatedFare, customerId } = await prisma.delivery.findUniqueOrThrow({
      where: { id: deliveryId },
      select: { deliveryPinHash: true, deliveryPinAttempts: true, estimatedFare: true, customerId: true },
    });
    // Deliveries created before PINs existed (e.g. demo data) cannot be verified.
    if (!deliveryPinHash) throw createError.conflict('This delivery has no PIN. Ask the sender to issue one');

    if (!(await verifyPin(pin, deliveryPinHash))) {
      const left = Math.max(0, MAX_PIN_ATTEMPTS - deliveryPinAttempts);
      throw createError.badRequest(`Incorrect PIN. ${left} attempt${left === 1 ? '' : 's'} left`);
    }

    await prisma.$transaction(async (tx) => {
      // Still a compare-and-swap: a concurrent cancel or second completion must not be overwritten.
      const done = await tx.delivery.updateMany({
        where: { ...owner, status: { in: DELIVERABLE } },
        data: {
          status: 'DELIVERED',
          deliveredAt: new Date(),
          finalFare: estimatedFare, // server-owned; distance/duration are recorded, never repriced from client input
          actualDistance,
          actualDuration,
          proofOfDelivery: 'PIN_VERIFIED',
        },
      });
      if (done.count === 0) throw createError.conflict('Delivery was changed by another request');

      await tx.driverProfile.update({ where: { id: driverId }, data: { isAvailable: true, totalDeliveries: { increment: 1 } } });
      await tx.customerProfile.update({ where: { id: customerId }, data: { totalDeliveries: { increment: 1 } } });
    });

    return this.view(deliveryId);
  }

  async cancel(deliveryId: string, actor: { role: 'customer' | 'driver'; profileId: string }, reason?: string) {
    const owner = {
      id: deliveryId,
      ...(actor.role === 'customer' ? { customerId: actor.profileId } : { driverId: actor.profileId }),
    };

    await prisma.$transaction(async (tx) => {
      const cancelled = await tx.delivery.updateMany({
        where: { ...owner, status: { in: [...CANCELLABLE[actor.role]] } },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason },
      });
      if (cancelled.count === 0) await this.reject(owner, 'cancel');

      // Safe to read afterwards: a CANCELLED delivery can no longer be accepted, so driverId is final.
      const { driverId } = await tx.delivery.findUniqueOrThrow({ where: { id: deliveryId }, select: { driverId: true } });
      if (driverId) await tx.driverProfile.update({ where: { id: driverId }, data: { isAvailable: true } });
    });

    return this.view(deliveryId);
  }

  /** Sender issues a fresh PIN (lost SMS, or the old one was locked out). The old PIN stops working. */
  async resendPin(deliveryId: string, customerId: string) {
    const owner = { id: deliveryId, customerId };
    const pin = generatePin();

    const updated = await prisma.delivery.updateMany({
      where: { ...owner, status: { in: ACTIVE } },
      data: { deliveryPinHash: await hashPin(pin), deliveryPinAttempts: 0 },
    });
    if (updated.count === 0) await this.reject(owner, 'issue a new PIN');

    const { deliveryCode, senderInfo, recipientInfo } = await prisma.delivery.findUniqueOrThrow({
      where: { id: deliveryId },
      select: { deliveryCode: true, senderInfo: true, recipientInfo: true },
    });
    const sender = senderInfo as unknown as Contact;
    const recipient = recipientInfo as unknown as Contact;
    await this.sendPin(deliveryId, deliveryCode, sender.name, recipient.phoneNumber, pin);

    return { deliveryPin: pin };
  }

  async recordLocation(deliveryId: string, driverId: string, { latitude, longitude }: { latitude: number; longitude: number }) {
    const owner = { id: deliveryId, driverId };
    const delivery = await prisma.delivery.findFirst({ where: { ...owner, status: { in: TRACKABLE } }, select: { status: true } });
    if (!delivery) await this.reject(owner, 'record location');

    return prisma.deliveryTrackingPoint.create({
      data: { deliveryId, latitude, longitude, status: delivery!.status.toLowerCase() },
      select: { latitude: true, longitude: true, status: true, timestamp: true },
    });
  }

  async getTracking(deliveryId: string, user: Viewer) {
    const delivery = await this.getForUser(deliveryId, user); // same visibility rules, same 404
    const points = await prisma.deliveryTrackingPoint.findMany({
      where: { deliveryId },
      select: { latitude: true, longitude: true, status: true, timestamp: true },
      orderBy: { timestamp: 'asc' },
    });
    return { deliveryId, status: delivery.status, points };
  }

  private view(deliveryId: string) {
    return prisma.delivery.findUniqueOrThrow({ where: { id: deliveryId }, select: deliveryView });
  }

  /** Best-effort: the PIN is also returned to the sender, so a failed SMS is not fatal. */
  private async sendPin(deliveryId: string, code: string, senderName: string, to: string, pin: string) {
    await queueService
      .addJob(QUEUE_NAMES.SMS, 'notification', {
        type: 'notification',
        to,
        message: pinMessage(code, senderName, pin),
        deliveryId,
        priority: 'high',
      })
      .catch((error) => logger.warn('Delivery PIN SMS not enqueued', { deliveryId, error: String(error) }));
  }

  /** A guarded write matched nothing: 404 if the caller has no claim on the delivery, otherwise 409 with the reason. */
  private async reject(owner: Prisma.DeliveryWhereInput, attempted: string): Promise<never> {
    const delivery = await prisma.delivery.findFirst({ where: owner, select: { status: true } });
    if (!delivery) throw createError.notFound('Delivery not found');
    throw createError.conflict(`Cannot ${attempted}: delivery is ${delivery.status}`);
  }
}

export const deliveryService = new DeliveryService();
