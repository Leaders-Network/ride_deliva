// Service-level tests with a mocked Prisma client. The HTTP tests mock the service away, so the
// PIN check, attempt cap, active-delivery limit and response allow-list are covered here.
const db = {
  $transaction: jest.fn(),
  $executeRaw: jest.fn(),
  delivery: {
    count: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    updateMany: jest.fn(),
  },
  address: { create: jest.fn() },
  driverProfile: { update: jest.fn(), updateMany: jest.fn() },
  customerProfile: { update: jest.fn() },
  vehicle: { findFirst: jest.fn() },
  deliveryTrackingPoint: { create: jest.fn(), findMany: jest.fn() },
};

jest.mock('@/config/database', () => ({ __esModule: true, default: db, prisma: db }));
jest.mock('@/shared/services/queue.service', () => ({ queueService: { addJob: jest.fn() } }));

import { deliveryService, MAX_ACTIVE_DELIVERIES } from '@/modules/delivery/services/delivery.service';
import { hashPin, MAX_PIN_ATTEMPTS } from '@/modules/delivery/pin';
import { queueService } from '@/shared/services/queue.service';

const ID = '3f2b8c1e-5a4d-4c6b-9e7f-1a2b3c4d5e6f';
const loc = (latitude: number, longitude: number) => ({ latitude, longitude, address: 'Somewhere', city: 'Lagos', state: 'Lagos', postalCode: '' });
const booking = {
  pickup: loc(6.4474, 3.4739),
  destination: loc(6.6018, 3.3515),
  deliveryType: 'STANDARD' as const,
  package: { description: 'Shoes', weightKg: 2 },
  recipient: { name: 'Chi Eze', phoneNumber: '+2348031234567' },
};
const user = { id: 'u1', firstName: 'Ada', lastName: 'Obi', phoneNumber: '+2348123456789' };

describe('DeliveryService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    db.$transaction.mockImplementation((fn: any) => fn(db));
    (queueService.addJob as jest.Mock).mockResolvedValue({});
  });

  describe('book', () => {
    it(`refuses a ${MAX_ACTIVE_DELIVERIES + 1}th active delivery`, async () => {
      db.delivery.count.mockResolvedValue(MAX_ACTIVE_DELIVERIES);
      await expect(deliveryService.book('c1', user, booking)).rejects.toMatchObject({ statusCode: 409 });
      expect(db.delivery.create).not.toHaveBeenCalled();
    });

    it('stores only a hash of the PIN, returns the PIN, and texts it to the recipient', async () => {
      db.delivery.count.mockResolvedValue(MAX_ACTIVE_DELIVERIES - 1);
      db.address.create.mockResolvedValue({ id: 'a1' });
      db.delivery.create.mockResolvedValue({ id: ID, deliveryCode: 'DLABC' });

      const { deliveryPin, estimate } = await deliveryService.book('c1', user, booking);

      expect(deliveryPin).toMatch(/^\d{4}$/);
      const { data, select } = db.delivery.create.mock.calls[0][0];
      expect(data.deliveryPinHash).toBeDefined();
      expect(data.deliveryPinHash).not.toContain(deliveryPin);
      expect(data.estimatedFare).toBe(estimate.fee); // server-priced
      expect(data.senderInfo).toEqual({ name: 'Ada Obi', phoneNumber: user.phoneNumber }); // defaults to the caller
      // SECURITY: the response select never includes the PIN columns.
      expect(select.deliveryPinHash).toBeUndefined();
      expect(select.deliveryPinAttempts).toBeUndefined();

      const sms = (queueService.addJob as jest.Mock).mock.calls.find(([queue]) => queue === 'sms');
      expect(sms?.[2]).toMatchObject({ to: booking.recipient.phoneNumber, deliveryId: ID });
      expect(sms?.[2].message).toContain(deliveryPin);
    });

    it('rejects a pickup outside the service area', async () => {
      await expect(deliveryService.book('c1', user, { ...booking, pickup: loc(9.05, 7.49) })).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('deliver', () => {
    const owned = async (attemptsAfterReserve: number) => {
      db.delivery.updateMany.mockResolvedValueOnce({ count: 1 }); // attempt reserved
      db.delivery.findUniqueOrThrow.mockResolvedValueOnce({
        deliveryPinHash: await hashPin('0420'),
        deliveryPinAttempts: attemptsAfterReserve,
        estimatedFare: 1500,
        customerId: 'c1',
      });
    };

    it('reserves the attempt before checking the PIN, under the cap', async () => {
      await owned(1);
      await expect(deliveryService.deliver(ID, 'd1', { pin: '9999' })).rejects.toMatchObject({ statusCode: 400 });

      const reserve = db.delivery.updateMany.mock.calls[0][0];
      expect(reserve.where).toMatchObject({ id: ID, driverId: 'd1', deliveryPinAttempts: { lt: MAX_PIN_ATTEMPTS } });
      expect(reserve.data).toEqual({ deliveryPinAttempts: { increment: 1 } });
    });

    it('reports remaining attempts on a wrong PIN', async () => {
      await owned(2);
      await expect(deliveryService.deliver(ID, 'd1', { pin: '9999' })).rejects.toThrow(`${MAX_PIN_ATTEMPTS - 2} attempts left`);
      expect(db.driverProfile.update).not.toHaveBeenCalled();
    });

    it('locks out once the cap is reached', async () => {
      db.delivery.updateMany.mockResolvedValueOnce({ count: 0 });
      db.delivery.findFirst.mockResolvedValueOnce({ status: 'IN_TRANSIT' });
      await expect(deliveryService.deliver(ID, 'd1', { pin: '0420' })).rejects.toThrow(/Too many incorrect PIN attempts/);
    });

    it('404s for a delivery that is not the driver’s', async () => {
      db.delivery.updateMany.mockResolvedValueOnce({ count: 0 });
      db.delivery.findFirst.mockResolvedValueOnce(null);
      await expect(deliveryService.deliver(ID, 'd1', { pin: '0420' })).rejects.toMatchObject({ statusCode: 404 });
    });

    it('409s when the package has not been picked up', async () => {
      db.delivery.updateMany.mockResolvedValueOnce({ count: 0 });
      db.delivery.findFirst.mockResolvedValueOnce({ status: 'ACCEPTED' });
      await expect(deliveryService.deliver(ID, 'd1', { pin: '0420' })).rejects.toThrow(/delivery is ACCEPTED/);
    });

    it('completes with the right PIN at the server-owned fare and frees the driver', async () => {
      await owned(1);
      db.delivery.updateMany.mockResolvedValueOnce({ count: 1 }); // DELIVERED
      db.delivery.findUniqueOrThrow.mockResolvedValueOnce({ id: ID, status: 'DELIVERED' });

      const result = await deliveryService.deliver(ID, 'd1', { pin: '0420', actualDistance: 14 });

      expect(result).toEqual({ id: ID, status: 'DELIVERED' });
      const complete = db.delivery.updateMany.mock.calls[1][0];
      expect(complete.where.status).toEqual({ in: ['PICKED_UP', 'IN_TRANSIT'] });
      expect(complete.data).toMatchObject({ status: 'DELIVERED', finalFare: 1500, actualDistance: 14, proofOfDelivery: 'PIN_VERIFIED' });
      expect(db.driverProfile.update).toHaveBeenCalledWith({
        where: { id: 'd1' },
        data: { isAvailable: true, totalDeliveries: { increment: 1 } },
      });
      expect(db.customerProfile.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { totalDeliveries: { increment: 1 } } });
    });
  });

  describe('cancel', () => {
    it('does not let a driver cancel once the package is picked up', async () => {
      db.delivery.updateMany.mockResolvedValueOnce({ count: 0 });
      db.delivery.findFirst.mockResolvedValueOnce({ status: 'PICKED_UP' });
      await expect(deliveryService.cancel(ID, { role: 'driver', profileId: 'd1' })).rejects.toMatchObject({ statusCode: 409 });
      expect(db.delivery.updateMany.mock.calls[0][0].where.status).toEqual({ in: ['ACCEPTED', 'DRIVER_ASSIGNED'] });
    });
  });

  describe('resendPin', () => {
    it('replaces the hash, resets attempts and texts the new PIN', async () => {
      db.delivery.updateMany.mockResolvedValueOnce({ count: 1 });
      db.delivery.findUniqueOrThrow.mockResolvedValueOnce({
        deliveryCode: 'DLABC',
        senderInfo: { name: 'Ada Obi', phoneNumber: '+2348123456789' },
        recipientInfo: booking.recipient,
      });

      const { deliveryPin } = await deliveryService.resendPin(ID, 'c1');

      const { where, data } = db.delivery.updateMany.mock.calls[0][0];
      expect(where).toMatchObject({ id: ID, customerId: 'c1' });
      expect(data.deliveryPinAttempts).toBe(0);
      expect((queueService.addJob as jest.Mock).mock.calls[0][2].message).toContain(deliveryPin);
    });
  });
});
