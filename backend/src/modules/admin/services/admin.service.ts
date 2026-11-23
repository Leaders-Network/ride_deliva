import { addDays, format, startOfDay, subDays } from 'date-fns';
import prisma from '@/config/database';
import { logger } from '@/config/logger';
import {
  DeliveryStatus,
  DriverStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  RideStatus,
} from '@/generated/prisma';
import { createError } from '@/shared/middleware/error-handler';

/**
 * SECURITY: admin views still allow-list user columns. Never return `user: true`;
 * that would ship password hashes to the browser.
 */
const userSummary = {
  select: {
    id: true,
    firstName: true,
    lastName: true,
    phoneNumber: true,
    email: true,
    profilePicture: true,
    isActive: true,
    isVerified: true,
    createdAt: true,
  },
} satisfies Prisma.UserDefaultArgs;

const personName = { select: { firstName: true, lastName: true, phoneNumber: true } };
const addressLine = { select: { streetAddress: true, city: true } };
const counterpart = (key: 'customer' | 'driver') => ({ [key]: { select: { id: true, user: personName } } });

const rideListInclude = {
  ...counterpart('customer'),
  ...counterpart('driver'),
  pickupAddress: addressLine,
  destinationAddress: addressLine,
  payment: { select: { status: true, method: true, amount: true } },
} satisfies Prisma.RideInclude;

const deliveryListInclude = {
  ...counterpart('customer'),
  ...counterpart('driver'),
  pickupAddress: addressLine,
  destinationAddress: addressLine,
  payment: { select: { status: true, method: true, amount: true } },
} satisfies Prisma.DeliveryInclude;

const vehicleSummary = {
  select: { id: true, type: true, make: true, model: true, year: true, color: true, licensePlate: true, isActive: true },
};

/**
 * Admin driver moderation as data: which status each decision may start from.
 * Mirrors the ride state machine style in rides/services/ride.service.ts.
 */
const DRIVER_TRANSITIONS: Record<Exclude<DriverStatus, 'PENDING'>, DriverStatus[]> = {
  APPROVED: ['PENDING', 'REJECTED', 'SUSPENDED', 'INACTIVE'],
  REJECTED: ['PENDING'],
  SUSPENDED: ['APPROVED'],
  INACTIVE: ['APPROVED', 'SUSPENDED'],
};

const ACTIVE_RIDE: RideStatus[] = ['REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'IN_PROGRESS'];
const ACTIVE_DELIVERY: DeliveryStatus[] = ['REQUESTED', 'ACCEPTED', 'DRIVER_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'];

interface Page {
  page: number;
  limit: number;
}
const paging = ({ page, limit }: Page) => ({ skip: (page - 1) * limit, take: limit });

interface DateRange {
  from?: Date;
  to?: Date;
}
// `to` is a calendar date from the UI, so include that whole day.
const range = ({ from, to }: DateRange) => (from || to ? { gte: from, lt: to ? addDays(to, 1) : undefined } : undefined);

const nameSearch = (search?: string): Prisma.UserWhereInput | undefined => {
  if (!search) return undefined;
  const contains = { contains: search, mode: 'insensitive' as const };
  return {
    OR: [{ firstName: contains }, { lastName: contains }, { phoneNumber: contains }, { email: contains }],
  };
};

const groupCounts = <K extends string>(rows: { status: K; _count: { _all: number } }[]) =>
  Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Partial<Record<K, number>>;

const num = (d: Prisma.Decimal | null | undefined) => (d ? Number(d) : 0);

export class AdminService {
  // --------------------------------------------------------------------------
  // Overview
  // --------------------------------------------------------------------------
  async stats() {
    const today = startOfDay(new Date());
    const weekStart = subDays(today, 6);

    const [
      customers,
      activeCustomers,
      driversByStatus,
      onlineDrivers,
      ridesByStatus,
      deliveriesByStatus,
      ridesToday,
      deliveriesToday,
      revenue,
      revenueToday,
      commission,
      weekRides,
      weekDeliveries,
      weekPayments,
      pendingDrivers,
    ] = await Promise.all([
      prisma.customerProfile.count(),
      prisma.customerProfile.count({ where: { user: { isActive: true } } }),
      prisma.driverProfile.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.driverProfile.count({ where: { isOnline: true, status: 'APPROVED' } }),
      prisma.ride.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.delivery.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.ride.count({ where: { requestedAt: { gte: today } } }),
      prisma.delivery.count({ where: { requestedAt: { gte: today } } }),
      prisma.payment.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { status: 'COMPLETED', createdAt: { gte: today } }, _sum: { amount: true } }),
      prisma.driverEarning.aggregate({ _sum: { commission: true } }),
      prisma.ride.findMany({ where: { requestedAt: { gte: weekStart } }, select: { requestedAt: true } }),
      prisma.delivery.findMany({ where: { requestedAt: { gte: weekStart } }, select: { requestedAt: true } }),
      prisma.payment.findMany({
        where: { status: 'COMPLETED', createdAt: { gte: weekStart } },
        select: { createdAt: true, amount: true },
      }),
      prisma.driverProfile.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: 5,
        select: { id: true, createdAt: true, user: personName, vehicles: vehicleSummary },
      }),
    ]);

    const drivers = groupCounts(driversByStatus);
    const rides = groupCounts(ridesByStatus);
    const deliveries = groupCounts(deliveriesByStatus);
    const sum = (o: Partial<Record<string, number>>) => Object.values(o).reduce<number>((a, b) => a + (b ?? 0), 0);

    // Bucket the last 7 days in JS: small result sets, and avoids raw SQL for an MVP.
    const days = Array.from({ length: 7 }, (_, i) => format(subDays(today, 6 - i), 'yyyy-MM-dd'));
    const trend = Object.fromEntries(days.map((d) => [d, { date: d, rides: 0, deliveries: 0, revenue: 0 }]));
    const day = (d: Date) => format(d, 'yyyy-MM-dd');
    weekRides.forEach((r) => trend[day(r.requestedAt)] && trend[day(r.requestedAt)].rides++);
    weekDeliveries.forEach((r) => trend[day(r.requestedAt)] && trend[day(r.requestedAt)].deliveries++);
    weekPayments.forEach((p) => {
      if (trend[day(p.createdAt)]) trend[day(p.createdAt)].revenue += num(p.amount);
    });

    return {
      customers: { total: customers, active: activeCustomers },
      drivers: { total: sum(drivers), online: onlineDrivers, byStatus: drivers },
      rides: { total: sum(rides), today: ridesToday, active: ACTIVE_RIDE.reduce((a, s) => a + (rides[s] ?? 0), 0), byStatus: rides },
      deliveries: {
        total: sum(deliveries),
        today: deliveriesToday,
        active: ACTIVE_DELIVERY.reduce((a, s) => a + (deliveries[s] ?? 0), 0),
        byStatus: deliveries,
      },
      revenue: {
        total: num(revenue._sum.amount),
        today: num(revenueToday._sum.amount),
        commission: num(commission._sum.commission),
        currency: 'NGN',
      },
      trend: days.map((d) => trend[d]),
      pendingDrivers,
    };
  }

  // --------------------------------------------------------------------------
  // Drivers
  // --------------------------------------------------------------------------
  async listDrivers(q: Page & { search?: string; status?: DriverStatus }) {
    const where: Prisma.DriverProfileWhereInput = {
      status: q.status,
      ...(q.search && {
        OR: [{ user: nameSearch(q.search) }, { licenseNumber: { contains: q.search, mode: 'insensitive' } }],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.driverProfile.findMany({
        where,
        ...paging(q),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          isOnline: true,
          isAvailable: true,
          rating: true,
          totalRides: true,
          totalDeliveries: true,
          totalEarnings: true,
          licenseNumber: true,
          createdAt: true,
          user: userSummary,
          vehicles: { ...vehicleSummary, where: { isActive: true }, take: 1 },
        },
      }),
      prisma.driverProfile.count({ where }),
    ]);
    return { data, total };
  }

  async getDriver(id: string) {
    const driver = await prisma.driverProfile.findUnique({
      where: { id },
      include: {
        user: userSummary,
        vehicles: true,
        wallet: { select: { balance: true, currency: true } },
        locations: { select: { latitude: true, longitude: true, updatedAt: true } },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, rating: true, comment: true, createdAt: true, customer: { select: { user: personName } } },
        },
        rides: { orderBy: { requestedAt: 'desc' }, take: 10, include: rideListInclude },
        deliveries: { orderBy: { requestedAt: 'desc' }, take: 10, include: deliveryListInclude },
      },
    });
    if (!driver) throw createError.notFound('Driver not found');

    const earnings = await prisma.driverEarning.aggregate({
      where: { driverId: id },
      _sum: { grossAmount: true, commission: true, netAmount: true },
    });

    return {
      ...driver,
      earnings: {
        gross: num(earnings._sum.grossAmount),
        commission: num(earnings._sum.commission),
        net: num(earnings._sum.netAmount),
      },
    };
  }

  async updateDriverStatus(id: string, status: Exclude<DriverStatus, 'PENDING'>, adminUserId: string, reason?: string) {
    const allowedFrom = DRIVER_TRANSITIONS[status];

    const driver = await prisma.$transaction(async (tx) => {
      // Guarded write: only succeeds from a legal starting status, so two admins can't race.
      const updated = await tx.driverProfile.updateMany({
        where: { id, status: { in: allowedFrom } },
        data: {
          status,
          // Anyone who is no longer approved is taken off the road immediately.
          ...(status !== 'APPROVED' && { isOnline: false, isAvailable: false }),
        },
      });

      if (updated.count === 0) {
        const current = await tx.driverProfile.findUnique({ where: { id }, select: { status: true } });
        if (!current) throw createError.notFound('Driver not found');
        throw createError.conflict(`Cannot change driver from ${current.status} to ${status}`);
      }

      const profile = await tx.driverProfile.findUniqueOrThrow({ where: { id }, select: { userId: true, status: true } });

      // The driver hears about the decision; this also records the reason, since the schema has no audit table yet.
      await tx.notification.create({
        data: {
          userId: profile.userId,
          type: 'SYSTEM_ALERT',
          title: status === 'APPROVED' ? 'Your driver account is approved' : `Your driver account is ${status.toLowerCase()}`,
          message: reason ?? 'You can now go online and accept trips.',
          data: { driverStatus: status, changedBy: adminUserId },
        },
      });

      return profile;
    });

    logger.info('Admin changed driver status', { driverId: id, status, adminUserId, reason });
    return { id, status: driver.status };
  }

  // --------------------------------------------------------------------------
  // Customers
  // --------------------------------------------------------------------------
  async listCustomers(q: Page & { search?: string; active?: boolean }) {
    const where: Prisma.CustomerProfileWhereInput = {
      user: { ...nameSearch(q.search), ...(q.active !== undefined && { isActive: q.active }) },
    };

    const [data, total] = await Promise.all([
      prisma.customerProfile.findMany({
        where,
        ...paging(q),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          rating: true,
          totalRides: true,
          totalDeliveries: true,
          createdAt: true,
          user: userSummary,
          wallet: { select: { balance: true, currency: true } },
        },
      }),
      prisma.customerProfile.count({ where }),
    ]);
    return { data, total };
  }

  async getCustomer(id: string) {
    const customer = await prisma.customerProfile.findUnique({
      where: { id },
      include: {
        user: { select: { ...userSummary.select, addresses: { select: { id: true, title: true, streetAddress: true, city: true } } } },
        wallet: {
          select: {
            balance: true,
            currency: true,
            transactions: { orderBy: { createdAt: 'desc' }, take: 10 },
          },
        },
        rides: { orderBy: { requestedAt: 'desc' }, take: 10, include: rideListInclude },
        deliveries: { orderBy: { requestedAt: 'desc' }, take: 10, include: deliveryListInclude },
      },
    });
    if (!customer) throw createError.notFound('Customer not found');

    const spent = await prisma.payment.aggregate({
      where: {
        status: 'COMPLETED',
        OR: [{ ride: { customerId: id } }, { delivery: { customerId: id } }],
      },
      _sum: { amount: true },
    });

    return { ...customer, totalSpent: num(spent._sum.amount) };
  }

  // --------------------------------------------------------------------------
  // Users (block / unblock any customer or driver)
  // --------------------------------------------------------------------------
  async setUserActive(userId: string, isActive: boolean, adminUserId: string, reason?: string) {
    if (userId === adminUserId) throw createError.badRequest('You cannot change your own account status');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, adminProfile: { select: { id: true } }, driverProfile: { select: { id: true } } },
    });
    if (!user) throw createError.notFound('User not found');
    if (user.adminProfile) throw createError.forbidden('Admin accounts cannot be blocked from the dashboard');

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { isActive } });
      if (!isActive) {
        // Kick them out everywhere, and take a blocked driver off the road.
        await tx.session.updateMany({ where: { userId, isActive: true }, data: { isActive: false } });
        if (user.driverProfile) {
          await tx.driverProfile.update({ where: { id: user.driverProfile.id }, data: { isOnline: false, isAvailable: false } });
        }
      }
    });

    logger.info('Admin changed user active flag', { userId, isActive, adminUserId, reason });
    return { id: userId, isActive };
  }

  // --------------------------------------------------------------------------
  // Rides
  // --------------------------------------------------------------------------
  async listRides(q: Page & DateRange & { search?: string; status?: RideStatus }) {
    const where: Prisma.RideWhereInput = {
      status: q.status,
      requestedAt: range(q),
      ...(q.search && {
        OR: [
          { rideCode: { contains: q.search, mode: 'insensitive' } },
          { customer: { user: nameSearch(q.search) } },
          { driver: { user: nameSearch(q.search) } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.ride.findMany({ where, ...paging(q), orderBy: { requestedAt: 'desc' }, include: rideListInclude }),
      prisma.ride.count({ where }),
    ]);
    return { data, total };
  }

  async getRide(id: string) {
    const ride = await prisma.ride.findUnique({
      where: { id },
      include: {
        ...rideListInclude,
        vehicle: vehicleSummary,
        pickupAddress: true,
        destinationAddress: true,
        payment: true,
        reviews: { select: { rating: true, comment: true, createdAt: true } },
      },
    });
    if (!ride) throw createError.notFound('Ride not found');
    return ride;
  }

  async cancelRide(id: string, adminUserId: string, reason: string) {
    await prisma.$transaction(async (tx) => {
      const cancelled = await tx.ride.updateMany({
        where: { id, status: { in: ACTIVE_RIDE } },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: `Cancelled by admin: ${reason}` },
      });
      if (cancelled.count === 0) {
        const ride = await tx.ride.findUnique({ where: { id }, select: { status: true } });
        if (!ride) throw createError.notFound('Ride not found');
        throw createError.conflict(`Cannot cancel: ride is ${ride.status}`);
      }
      const { driverId } = await tx.ride.findUniqueOrThrow({ where: { id }, select: { driverId: true } });
      if (driverId) await tx.driverProfile.update({ where: { id: driverId }, data: { isAvailable: true } });
    });

    logger.info('Admin cancelled ride', { rideId: id, adminUserId, reason });
    return this.getRide(id);
  }

  // --------------------------------------------------------------------------
  // Deliveries
  // --------------------------------------------------------------------------
  async listDeliveries(q: Page & DateRange & { search?: string; status?: DeliveryStatus }) {
    const where: Prisma.DeliveryWhereInput = {
      status: q.status,
      requestedAt: range(q),
      ...(q.search && {
        OR: [
          { deliveryCode: { contains: q.search, mode: 'insensitive' } },
          { customer: { user: nameSearch(q.search) } },
          { driver: { user: nameSearch(q.search) } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.delivery.findMany({ where, ...paging(q), orderBy: { requestedAt: 'desc' }, include: deliveryListInclude }),
      prisma.delivery.count({ where }),
    ]);
    return { data, total };
  }

  async getDelivery(id: string) {
    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: {
        ...deliveryListInclude,
        vehicle: vehicleSummary,
        pickupAddress: true,
        destinationAddress: true,
        payment: true,
        reviews: { select: { rating: true, comment: true, createdAt: true } },
      },
    });
    if (!delivery) throw createError.notFound('Delivery not found');
    return delivery;
  }

  async cancelDelivery(id: string, adminUserId: string, reason: string) {
    await prisma.$transaction(async (tx) => {
      const cancelled = await tx.delivery.updateMany({
        where: { id, status: { in: ACTIVE_DELIVERY } },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: `Cancelled by admin: ${reason}` },
      });
      if (cancelled.count === 0) {
        const delivery = await tx.delivery.findUnique({ where: { id }, select: { status: true } });
        if (!delivery) throw createError.notFound('Delivery not found');
        throw createError.conflict(`Cannot cancel: delivery is ${delivery.status}`);
      }
      const { driverId } = await tx.delivery.findUniqueOrThrow({ where: { id }, select: { driverId: true } });
      if (driverId) await tx.driverProfile.update({ where: { id: driverId }, data: { isAvailable: true } });
    });

    logger.info('Admin cancelled delivery', { deliveryId: id, adminUserId, reason });
    return this.getDelivery(id);
  }

  // --------------------------------------------------------------------------
  // Payments
  // --------------------------------------------------------------------------
  async listPayments(q: Page & DateRange & { status?: PaymentStatus; method?: PaymentMethod }) {
    const where: Prisma.PaymentWhereInput = { status: q.status, method: q.method, createdAt: range(q) };
    const payer = { customer: { select: { id: true, user: personName } } };

    const [data, total, totals] = await Promise.all([
      prisma.payment.findMany({
        where,
        ...paging(q),
        orderBy: { createdAt: 'desc' },
        include: {
          ride: { select: { id: true, rideCode: true, ...payer } },
          delivery: { select: { id: true, deliveryCode: true, ...payer } },
        },
      }),
      prisma.payment.count({ where }),
      prisma.payment.groupBy({ by: ['status'], where, _sum: { amount: true }, _count: { _all: true } }),
    ]);

    const summary = Object.fromEntries(totals.map((t) => [t.status, { count: t._count._all, amount: num(t._sum.amount) }]));
    return { data, total, summary };
  }
}

export const adminService = new AdminService();
