import { randomUUID } from 'crypto';
import { subDays, subMinutes, addMinutes, startOfDay, addHours } from 'date-fns';
import {
  DeliveryStatus,
  DeliveryType,
  DriverStatus,
  PaymentMethod,
  Prisma,
  PrismaClient,
  RideStatus,
  RideType,
  VehicleType,
} from '../generated/prisma';

/**
 * Demo dataset for the admin dashboard: enough drivers, customers and two weeks of
 * trips for the charts and tables to look like a live operation. Deterministic
 * (seeded PRNG) so every `db:seed` produces the same numbers.
 */

let state = 20261123;
const rand = () => {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
};
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
const between = (min: number, max: number) => min + rand() * (max - min);
const int = (min: number, max: number) => Math.floor(between(min, max + 1));
const money = (n: number) => Math.round(n / 50) * 50;

const FIRST = ['Chinedu', 'Aisha', 'Tunde', 'Ngozi', 'Emeka', 'Fatima', 'Segun', 'Amaka', 'Ibrahim', 'Funke', 'Kelechi', 'Zainab',
  'Bayo', 'Chioma', 'Musa', 'Yetunde', 'Obinna', 'Halima', 'Femi', 'Adaeze', 'Sani', 'Bisi', 'Uche', 'Hauwa', 'Dayo', 'Ifeoma',
  'Yusuf', 'Kemi', 'Nnamdi', 'Ronke', 'Gbenga', 'Nkechi'];
const LAST = ['Okafor', 'Bello', 'Adeyemi', 'Eze', 'Ibrahim', 'Okonkwo', 'Balogun', 'Nwosu', 'Abubakar', 'Ogunleye', 'Obi',
  'Mohammed', 'Afolabi', 'Chukwu', 'Lawal', 'Onyeka', 'Adebayo', 'Danjuma', 'Okeke', 'Salami'];

const PLACES = [
  { street: 'Admiralty Way, Lekki Phase 1', lat: 6.4474, lng: 3.4739 },
  { street: 'Allen Avenue, Ikeja', lat: 6.6018, lng: 3.3515 },
  { street: 'Adeola Odeku Street, Victoria Island', lat: 6.4281, lng: 3.4219 },
  { street: 'Awolowo Road, Ikoyi', lat: 6.4474, lng: 3.4361 },
  { street: 'Herbert Macaulay Way, Yaba', lat: 6.5095, lng: 3.3711 },
  { street: 'Ogunlana Drive, Surulere', lat: 6.4969, lng: 3.3543 },
  { street: 'Ajose Adeogun Street, Victoria Island', lat: 6.4318, lng: 3.4253 },
  { street: 'Opebi Road, Ikeja', lat: 6.5927, lng: 3.3601 },
  { street: 'Ozumba Mbadiwe Avenue, Victoria Island', lat: 6.4413, lng: 3.4209 },
  { street: 'Admiralty Road, Lekki', lat: 6.4389, lng: 3.4747 },
  { street: 'Ikorodu Road, Maryland', lat: 6.5713, lng: 3.3667 },
  { street: 'Broad Street, Lagos Island', lat: 6.4541, lng: 3.3947 },
] as const;

const CARS: { type: VehicleType; make: string; model: string }[] = [
  { type: 'SEDAN', make: 'Toyota', model: 'Corolla' },
  { type: 'SEDAN', make: 'Honda', model: 'Accord' },
  { type: 'SUV', make: 'Toyota', model: 'Highlander' },
  { type: 'HATCHBACK', make: 'Kia', model: 'Rio' },
  { type: 'SEDAN', make: 'Hyundai', model: 'Elantra' },
];
const BIKES: { type: VehicleType; make: string; model: string }[] = [
  { type: 'MOTORCYCLE', make: 'Bajaj', model: 'Boxer' },
  { type: 'MOTORCYCLE', make: 'TVS', model: 'Apache' },
];
const COLORS = ['Black', 'Silver', 'White', 'Grey', 'Blue', 'Red'];
const BANKS = ['GTBank', 'Access Bank', 'Zenith Bank', 'First Bank', 'UBA', 'Kuda'];
const PACKAGES = ['Documents', 'Phone accessories', 'Clothing', 'Food order', 'Laptop', 'Groceries', 'Cosmetics'];
const CANCEL_REASONS = ['Driver took too long', 'Changed my plans', 'Booked by mistake', 'Found another ride'];
const REVIEW_COMMENTS = ['Smooth ride, thank you!', 'Very polite driver.', 'Car was clean and cool.', 'Arrived quickly.',
  'Good driving.', null, null];

// Driver mix: a realistic moderation queue for the demo (pending ones can be approved live).
const DRIVER_PLAN: { status: DriverStatus; bike: boolean }[] = [
  ...Array.from({ length: 6 }, () => ({ status: 'APPROVED' as const, bike: false })),
  ...Array.from({ length: 3 }, () => ({ status: 'APPROVED' as const, bike: true })),
  ...Array.from({ length: 4 }, (_, i) => ({ status: 'PENDING' as const, bike: i % 2 === 1 })),
  { status: 'SUSPENDED', bike: false },
  { status: 'REJECTED', bike: true },
];

const COMMISSION = 0.2;
const pad = (n: number, w = 4) => String(n).padStart(w, '0');

export async function seedDemoData(
  prisma: PrismaClient,
  hashes: { customer: string; driver: string }
) {
  const now = new Date();
  const today = startOfDay(now);

  // ---------------------------------------------------------------- customers
  const customers: { profileId: string; userId: string; addressIds: string[]; name: string; phone: string }[] = [];
  for (let i = 0; i < 24; i++) {
    const firstName = FIRST[i % FIRST.length];
    const lastName = pick(LAST);
    const phoneNumber = `+23481300${pad(i, 5)}`;
    const user = await prisma.user.create({
      data: {
        phoneNumber,
        email: `${firstName}.${lastName}.${i}@demo.ridedeliva.com`.toLowerCase(),
        firstName,
        lastName,
        passwordHash: hashes.customer,
        isVerified: true,
        phoneVerifiedAt: subDays(now, int(15, 120)),
        isActive: i !== 7, // one blocked account to show in the dashboard
        createdAt: subDays(now, int(15, 120)),
        customerProfile: {
          create: {
            rating: Number(between(4.2, 5).toFixed(2)),
            wallet: { create: { balance: money(between(0, 25000)) } },
          },
        },
      },
      include: { customerProfile: true },
    });

    const homes = [pick(PLACES), pick(PLACES), pick(PLACES)];
    const addressIds: string[] = [];
    for (const [k, p] of homes.entries()) {
      const a = await prisma.address.create({
        data: {
          userId: user.id,
          type: k === 0 ? 'HOME' : k === 1 ? 'WORK' : 'OTHER',
          title: k === 0 ? 'Home' : k === 1 ? 'Work' : 'Saved place',
          streetAddress: `${int(1, 120)} ${p.street}`,
          city: 'Lagos',
          state: 'Lagos',
          postalCode: '100001',
          latitude: p.lat + between(-0.004, 0.004),
          longitude: p.lng + between(-0.004, 0.004),
          isDefault: k === 0,
        },
      });
      addressIds.push(a.id);
    }

    customers.push({
      profileId: user.customerProfile!.id,
      userId: user.id,
      addressIds,
      name: `${firstName} ${lastName}`,
      phone: phoneNumber,
    });
  }

  // ------------------------------------------------------------------ drivers
  const activeDrivers: { profileId: string; vehicleId: string; bike: boolean }[] = [];
  for (const [i, plan] of DRIVER_PLAN.entries()) {
    const firstName = FIRST[(i + 11) % FIRST.length];
    const lastName = pick(LAST);
    const approved = plan.status === 'APPROVED';
    const joined = plan.status === 'PENDING' ? subDays(now, int(0, 3)) : subDays(now, int(30, 200));
    const online = approved && rand() > 0.35;
    const v = plan.bike ? pick(BIKES) : pick(CARS);

    const user = await prisma.user.create({
      data: {
        phoneNumber: `+23490200${pad(i, 5)}`,
        email: `${firstName}.${lastName}.driver${i}@demo.ridedeliva.com`.toLowerCase(),
        firstName,
        lastName,
        passwordHash: hashes.driver,
        isVerified: true,
        phoneVerifiedAt: joined,
        createdAt: joined,
        driverProfile: {
          create: {
            licenseNumber: `LAG${pad(i, 3)}${int(100000, 999999)}`,
            licenseExpiryDate: addHours(now, 24 * int(120, 900)),
            licenseDocument: `uploads/documents/drivers/demo_license_${i}.pdf`,
            status: plan.status,
            isOnline: online,
            isAvailable: online && rand() > 0.3,
            rating: approved ? Number(between(4.3, 4.98).toFixed(2)) : 5,
            createdAt: joined,
            bankAccount: { accountNumber: `0${int(100000000, 999999999)}`, bankName: pick(BANKS), accountName: `${firstName} ${lastName}` },
            verificationDocuments: {
              license: `uploads/documents/drivers/demo_license_${i}.pdf`,
              nin: `uploads/documents/drivers/demo_nin_${i}.pdf`,
              photo: `uploads/documents/drivers/demo_photo_${i}.jpg`,
            },
            wallet: { create: { balance: approved ? money(between(2000, 40000)) : 0 } },
            vehicles: {
              create: {
                ...v,
                year: int(2012, 2023),
                color: pick(COLORS),
                licensePlate: `${pick(['LAG', 'KJA', 'EKY', 'APP'])}-${int(100, 999)}-${String.fromCharCode(65 + i)}${String.fromCharCode(65 + (i * 7) % 26)}`,
                registrationDoc: `uploads/documents/vehicles/demo_reg_${i}.pdf`,
                insuranceDoc: `uploads/documents/vehicles/demo_ins_${i}.pdf`,
                isActive: true,
                capacity: plan.bike ? { cargoKg: 20 } : { seats: v.type === 'SUV' ? 6 : 4 },
              },
            },
          },
        },
      },
      include: { driverProfile: { include: { vehicles: true } } },
    });

    const profile = user.driverProfile!;
    if (approved) activeDrivers.push({ profileId: profile.id, vehicleId: profile.vehicles[0].id, bike: plan.bike });

    if (online) {
      const p = pick(PLACES);
      await prisma.driverLocation.create({
        data: {
          driverId: profile.id,
          latitude: p.lat + between(-0.01, 0.01),
          longitude: p.lng + between(-0.01, 0.01),
          isOnline: true,
          isAvailable: profile.isAvailable,
        },
      });
    }
  }

  // ---------------------------------------------------------------- trips
  const rides: Prisma.RideCreateManyInput[] = [];
  const deliveries: Prisma.DeliveryCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  const earnings: Prisma.DriverEarningCreateManyInput[] = [];
  const reviews: Prisma.ReviewCreateManyInput[] = [];
  const driverTotals = new Map<string, { rides: number; deliveries: number; earned: number }>();
  const customerTotals = new Map<string, { rides: number; deliveries: number }>();

  const carDrivers = activeDrivers.filter((d) => !d.bike);
  const bikeDrivers = activeDrivers.filter((d) => d.bike);
  const busyDrivers = new Set<string>();
  const activeCustomers = customers.filter((_, i) => i !== 7);

  const route = (c: (typeof customers)[number]) => {
    const from = pick(c.addressIds);
    let to = pick(c.addressIds);
    while (to === from) to = pick(c.addressIds);
    return { from, to, km: Number(between(2.5, 24).toFixed(2)) };
  };

  const settle = (opts: {
    driverId: string;
    customerId: string;
    amount: number;
    at: Date;
    kind: 'ride' | 'delivery';
    id: string;
    code: string;
  }) => {
    const method: PaymentMethod = pick(['WALLET', 'CARD', 'CARD', 'CASH', 'BANK_TRANSFER']);
    payments.push({
      id: randomUUID(),
      ...(opts.kind === 'ride' ? { rideId: opts.id } : { deliveryId: opts.id }),
      amount: opts.amount,
      method,
      status: 'COMPLETED',
      reference: `PAY_${opts.code}`,
      createdAt: opts.at,
    });
    const commission = Math.round(opts.amount * COMMISSION);
    earnings.push({
      driverId: opts.driverId,
      ...(opts.kind === 'ride' ? { rideId: opts.id } : { deliveryId: opts.id }),
      grossAmount: opts.amount,
      commission,
      netAmount: opts.amount - commission,
      earnedAt: opts.at,
    });
    const d = driverTotals.get(opts.driverId) ?? { rides: 0, deliveries: 0, earned: 0 };
    d[opts.kind === 'ride' ? 'rides' : 'deliveries']++;
    d.earned += opts.amount - commission;
    driverTotals.set(opts.driverId, d);
    const c = customerTotals.get(opts.customerId) ?? { rides: 0, deliveries: 0 };
    c[opts.kind === 'ride' ? 'rides' : 'deliveries']++;
    customerTotals.set(opts.customerId, c);
  };

  let rideSeq = 1;
  let deliverySeq = 1;

  for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
    const day = subDays(today, daysAgo);
    // Volume grows over the fortnight so the trend chart tells a story.
    const rideCount = int(4, 7) + Math.floor((13 - daysAgo) / 3);
    const deliveryCount = int(2, 4) + Math.floor((13 - daysAgo) / 4);

    for (let r = 0; r < rideCount; r++) {
      const customer = pick(activeCustomers);
      const driver = pick(carDrivers);
      const { from, to, km } = route(customer);
      const requestedAt = addMinutes(day, int(6 * 60, 22 * 60));
      if (requestedAt > now) continue;
      const rideType: RideType = pick(['STANDARD', 'STANDARD', 'STANDARD', 'PREMIUM', 'SHARED']);
      const surge = rand() > 0.8 ? 1.3 : 1;
      const fare = money((500 + km * 180) * (rideType === 'PREMIUM' ? 1.5 : rideType === 'SHARED' ? 0.8 : 1) * surge);
      const minutes = Math.round(km * 3 + int(3, 12));
      const id = randomUUID();
      const code = `RD${day.getFullYear()}${pad(rideSeq++, 5)}`;

      // Today's last few rides are still in flight; older ones are settled.
      const minsAgo = (now.getTime() - requestedAt.getTime()) / 60000;
      let status: RideStatus;
      if (daysAgo === 0 && minsAgo < minutes + 10 && !busyDrivers.has(driver.profileId)) {
        status = pick(['REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVING', 'IN_PROGRESS']);
      } else {
        status = rand() < 0.12 ? 'CANCELLED' : 'COMPLETED';
      }
      const assigned = status !== 'REQUESTED' && !(status === 'CANCELLED' && rand() < 0.5);
      if (['ACCEPTED', 'DRIVER_ARRIVING', 'IN_PROGRESS'].includes(status)) busyDrivers.add(driver.profileId);

      const acceptedAt = assigned ? addMinutes(requestedAt, int(1, 4)) : null;
      const startedAt = status === 'COMPLETED' || status === 'IN_PROGRESS' ? addMinutes(requestedAt, int(8, 15)) : null;
      const completedAt = status === 'COMPLETED' ? addMinutes(startedAt!, minutes) : null;

      rides.push({
        id,
        rideCode: code,
        customerId: customer.profileId,
        driverId: assigned ? driver.profileId : null,
        vehicleId: assigned ? driver.vehicleId : null,
        pickupAddressId: from,
        destinationAddressId: to,
        status,
        rideType,
        passengerCount: int(1, 3),
        requestedAt,
        acceptedAt,
        arrivedAt: startedAt ? subMinutes(startedAt, 2) : null,
        startedAt,
        completedAt,
        cancelledAt: status === 'CANCELLED' ? addMinutes(requestedAt, int(2, 8)) : null,
        cancellationReason: status === 'CANCELLED' ? pick(CANCEL_REASONS) : null,
        estimatedFare: fare,
        finalFare: status === 'COMPLETED' ? money(fare * between(0.92, 1.08)) : null,
        surgeMultiplier: surge,
        estimatedDistance: km,
        actualDistance: status === 'COMPLETED' ? km : null,
        estimatedDuration: minutes,
        actualDuration: status === 'COMPLETED' ? minutes + int(-3, 6) : null,
        createdAt: requestedAt,
      });

      if (status === 'COMPLETED') {
        const amount = Number(rides[rides.length - 1].finalFare);
        settle({ driverId: driver.profileId, customerId: customer.profileId, amount, at: completedAt!, kind: 'ride', id, code });
        if (rand() < 0.6) {
          reviews.push({
            rideId: id,
            customerId: customer.profileId,
            driverId: driver.profileId,
            rating: pick([5, 5, 5, 4, 4, 3]),
            comment: pick(REVIEW_COMMENTS),
            createdAt: addMinutes(completedAt!, 5),
          });
        }
      }
    }

    for (let r = 0; r < deliveryCount; r++) {
      const customer = pick(activeCustomers);
      const driver = pick(bikeDrivers.length ? bikeDrivers : carDrivers);
      const { from, to, km } = route(customer);
      const requestedAt = addMinutes(day, int(8 * 60, 20 * 60));
      if (requestedAt > now) continue;
      const deliveryType: DeliveryType = pick(['STANDARD', 'STANDARD', 'EXPRESS', 'FRAGILE']);
      const fare = money((400 + km * 120) * (deliveryType === 'EXPRESS' ? 1.4 : deliveryType === 'FRAGILE' ? 1.2 : 1));
      const minutes = Math.round(km * 2.5 + int(10, 25));
      const id = randomUUID();
      const code = `DL${day.getFullYear()}${pad(deliverySeq++, 5)}`;

      const minsAgo = (now.getTime() - requestedAt.getTime()) / 60000;
      let status: DeliveryStatus;
      if (daysAgo === 0 && minsAgo < minutes + 20) {
        status = pick(['REQUESTED', 'DRIVER_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT']);
      } else {
        status = rand() < 0.08 ? 'CANCELLED' : 'DELIVERED';
      }
      const assigned = status !== 'REQUESTED' && status !== 'CANCELLED';
      const pickedUpAt = ['PICKED_UP', 'IN_TRANSIT', 'DELIVERED'].includes(status) ? addMinutes(requestedAt, int(10, 25)) : null;
      const deliveredAt = status === 'DELIVERED' ? addMinutes(pickedUpAt!, minutes) : null;
      const recipient = pick(activeCustomers);

      deliveries.push({
        id,
        deliveryCode: code,
        customerId: customer.profileId,
        driverId: assigned ? driver.profileId : null,
        vehicleId: assigned ? driver.vehicleId : null,
        pickupAddressId: from,
        destinationAddressId: to,
        status,
        deliveryType,
        packageDetails: { description: pick(PACKAGES), weight: Number(between(0.3, 12).toFixed(1)) },
        senderInfo: { name: customer.name, phoneNumber: customer.phone },
        recipientInfo: { name: recipient.name, phoneNumber: recipient.phone },
        requestedAt,
        acceptedAt: assigned ? addMinutes(requestedAt, int(1, 5)) : null,
        pickedUpAt,
        deliveredAt,
        cancelledAt: status === 'CANCELLED' ? addMinutes(requestedAt, int(2, 10)) : null,
        cancellationReason: status === 'CANCELLED' ? pick(['Package not ready', 'Sender cancelled', 'Wrong address']) : null,
        estimatedFare: fare,
        finalFare: status === 'DELIVERED' ? fare : null,
        estimatedDistance: km,
        actualDistance: status === 'DELIVERED' ? km : null,
        estimatedDuration: minutes,
        actualDuration: status === 'DELIVERED' ? minutes + int(-5, 10) : null,
        proofOfDelivery: status === 'DELIVERED' ? `uploads/deliveries/proof/demo_${deliverySeq}.jpg` : null,
        createdAt: requestedAt,
      });

      if (status === 'DELIVERED') {
        settle({ driverId: driver.profileId, customerId: customer.profileId, amount: fare, at: deliveredAt!, kind: 'delivery', id, code });
      }
    }
  }

  await prisma.ride.createMany({ data: rides });
  await prisma.delivery.createMany({ data: deliveries });
  await prisma.payment.createMany({ data: payments });
  await prisma.driverEarning.createMany({ data: earnings });
  await prisma.review.createMany({ data: reviews });

  // Keep the denormalised counters consistent with the trips we just created.
  for (const [id, t] of driverTotals) {
    await prisma.driverProfile.update({
      where: { id },
      data: { totalRides: t.rides, totalDeliveries: t.deliveries, totalEarnings: t.earned },
    });
  }
  for (const [id, t] of customerTotals) {
    await prisma.customerProfile.update({ where: { id }, data: { totalRides: t.rides, totalDeliveries: t.deliveries } });
  }

  return {
    customers: customers.length,
    drivers: DRIVER_PLAN.length,
    rides: rides.length,
    deliveries: deliveries.length,
    payments: payments.length,
  };
}
