import request from 'supertest';
import app from '../app';
import { authService } from '@/shared/services/auth.service';
import { deliveryService } from '@/modules/delivery/services/delivery.service';
import { createError } from '@/shared/middleware/error-handler';

jest.mock('@/shared/services/auth.service');
jest.mock('@/modules/delivery/services/delivery.service');

const mockAuth = authService as jest.Mocked<typeof authService>;
const mockDeliveries = deliveryService as jest.Mocked<typeof deliveryService>;

const DELIVERY_ID = '3f2b8c1e-5a4d-4c6b-9e7f-1a2b3c4d5e6f';
const base = { isActive: true, isVerified: true, phoneNumber: '+2348123456789', firstName: 'Ada', lastName: 'Obi' };

// The booking rate limiter keys on user id and is not skipped in tests, so every test gets a fresh user.
let seq = 0;
const customer = () => ({ ...base, id: `cust-${++seq}`, customerProfile: { id: 'c1' } });
const driver = (status = 'APPROVED') => ({
  ...base,
  id: `drv-${++seq}`,
  driverProfile: { id: 'd1', status, isOnline: true, isAvailable: true },
});

const loc = (latitude: number, longitude: number) => ({ latitude, longitude, address: 'Somewhere, Lagos' });
const estimateBody = {
  pickup: loc(6.4474, 3.4739),
  destination: loc(6.6018, 3.3515),
  package: { description: 'Shoes', weightKg: 2 },
};
const bookingBody = { ...estimateBody, recipient: { name: 'Chi Eze', phoneNumber: '08031234567' } };

const as = (user: object | null) => {
  mockAuth.getUserFromToken.mockResolvedValue(user as any);
  return { Authorization: 'Bearer token' };
};

describe('Delivery API', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    const actual = jest.requireActual('@/shared/services/auth.service').authService;
    mockAuth.hasRole.mockImplementation(actual.hasRole.bind(actual));
  });

  describe('authentication and roles', () => {
    it('rejects unauthenticated booking', async () => {
      await request(app.app).post('/api/v1/delivery').send(bookingBody).expect(401);
    });

    it('rejects a driver booking a delivery', async () => {
      await request(app.app).post('/api/v1/delivery').set(as(driver())).send(bookingBody).expect(403);
      expect(mockDeliveries.book).not.toHaveBeenCalled();
    });

    it('rejects a customer accepting or completing a delivery', async () => {
      await request(app.app).post(`/api/v1/delivery/${DELIVERY_ID}/accept`).set(as(customer())).expect(403);
      await request(app.app).post(`/api/v1/delivery/${DELIVERY_ID}/deliver`).set(as(customer())).send({ pin: '1234' }).expect(403);
    });

    it('rejects an unapproved driver', async () => {
      await request(app.app).post(`/api/v1/delivery/${DELIVERY_ID}/accept`).set(as(driver('PENDING'))).expect(403);
      expect(mockDeliveries.accept).not.toHaveBeenCalled();
    });

    it('rejects a driver issuing a new PIN', async () => {
      await request(app.app).post(`/api/v1/delivery/${DELIVERY_ID}/pin`).set(as(driver())).expect(403);
      expect(mockDeliveries.resendPin).not.toHaveBeenCalled();
    });
  });

  describe('POST /delivery/estimate', () => {
    it('returns the estimate with defaults applied', async () => {
      mockDeliveries.estimate.mockReturnValue({ fee: 1500, currency: 'NGN' } as any);
      const res = await request(app.app).post('/api/v1/delivery/estimate').set(as(customer())).send(estimateBody).expect(200);
      expect(res.body.data.fee).toBe(1500);
      expect(mockDeliveries.estimate).toHaveBeenCalledWith(expect.objectContaining({ deliveryType: 'STANDARD' }));
    });

    it.each([
      ['missing package', { ...estimateBody, package: undefined }],
      ['overweight package', { ...estimateBody, package: { description: 'Fridge', weightKg: 80 } }],
      ['bad coordinates', { ...estimateBody, pickup: { ...estimateBody.pickup, latitude: 200 } }],
    ])('rejects %s', async (_label, body) => {
      const res = await request(app.app).post('/api/v1/delivery/estimate').set(as(customer())).send(body).expect(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /delivery', () => {
    it('books for the caller and returns the PIN once', async () => {
      mockDeliveries.book.mockResolvedValue({ delivery: { id: DELIVERY_ID }, estimate: { fee: 900 }, deliveryPin: '0420' } as any);
      const user = customer();
      const res = await request(app.app).post('/api/v1/delivery').set(as(user)).send(bookingBody).expect(201);

      expect(res.body.data.deliveryPin).toBe('0420');
      expect(mockDeliveries.book).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ id: user.id }),
        expect.objectContaining({
          deliveryType: 'STANDARD',
          // Local Nigerian numbers are normalised to E.164 by the validator.
          recipient: { name: 'Chi Eze', phoneNumber: '+2348031234567' },
        })
      );
    });

    it('requires a recipient', async () => {
      await request(app.app).post('/api/v1/delivery').set(as(customer())).send(estimateBody).expect(422);
    });

    it('requires scheduledPickupAt only for SCHEDULED deliveries', async () => {
      await request(app.app).post('/api/v1/delivery').set(as(customer())).send({ ...bookingBody, deliveryType: 'SCHEDULED' }).expect(422);
      await request(app.app)
        .post('/api/v1/delivery')
        .set(as(customer()))
        .send({ ...bookingBody, scheduledPickupAt: new Date(Date.now() + 3_600_000).toISOString() })
        .expect(422);
    });

    it('surfaces the active-delivery limit', async () => {
      mockDeliveries.book.mockRejectedValue(createError.conflict('You can have at most 3 deliveries in progress'));
      const res = await request(app.app).post('/api/v1/delivery').set(as(customer())).send(bookingBody).expect(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('driver lifecycle', () => {
    it('accepts a delivery', async () => {
      mockDeliveries.accept.mockResolvedValue({ id: DELIVERY_ID, status: 'ACCEPTED' } as any);
      const res = await request(app.app).post(`/api/v1/delivery/${DELIVERY_ID}/accept`).set(as(driver())).expect(200);
      expect(res.body.data.status).toBe('ACCEPTED');
      expect(mockDeliveries.accept).toHaveBeenCalledWith(DELIVERY_ID, 'd1');
    });

    it('returns 409 when another driver already took it', async () => {
      mockDeliveries.accept.mockRejectedValue(createError.conflict('Delivery is no longer available'));
      await request(app.app).post(`/api/v1/delivery/${DELIVERY_ID}/accept`).set(as(driver())).expect(409);
    });

    it.each(['pickup', 'transit'])('POST /:id/%s advances the delivery', async (action) => {
      mockDeliveries.advance.mockResolvedValue({ id: DELIVERY_ID } as any);
      await request(app.app).post(`/api/v1/delivery/${DELIVERY_ID}/${action}`).set(as(driver())).expect(200);
      expect(mockDeliveries.advance).toHaveBeenCalledWith(DELIVERY_ID, 'd1', action);
    });

    it('completes with a PIN and metrics', async () => {
      mockDeliveries.deliver.mockResolvedValue({ id: DELIVERY_ID, status: 'DELIVERED' } as any);
      await request(app.app)
        .post(`/api/v1/delivery/${DELIVERY_ID}/deliver`)
        .set(as(driver()))
        .send({ pin: '0420', actualDistance: 12.5, extra: 'ignored' })
        .expect(200);
      expect(mockDeliveries.deliver).toHaveBeenCalledWith(DELIVERY_ID, 'd1', { pin: '0420', actualDistance: 12.5 });
    });

    it.each([[{}], [{ pin: '12' }], [{ pin: 'abcd' }], [{ pin: 1234 }]])('rejects a malformed PIN %j', async (body) => {
      await request(app.app).post(`/api/v1/delivery/${DELIVERY_ID}/deliver`).set(as(driver())).send(body).expect(422);
      expect(mockDeliveries.deliver).not.toHaveBeenCalled();
    });

    it('surfaces a wrong PIN as 400', async () => {
      mockDeliveries.deliver.mockRejectedValue(createError.badRequest('Incorrect PIN. 4 attempts left'));
      const res = await request(app.app).post(`/api/v1/delivery/${DELIVERY_ID}/deliver`).set(as(driver())).send({ pin: '9999' }).expect(400);
      expect(res.body.error.message).toMatch(/4 attempts left/);
    });

    it('records a location', async () => {
      mockDeliveries.recordLocation.mockResolvedValue({ latitude: 6.5, longitude: 3.4 } as any);
      await request(app.app)
        .post(`/api/v1/delivery/${DELIVERY_ID}/location`)
        .set(as(driver()))
        .send({ latitude: 6.5, longitude: 3.4 })
        .expect(201);
      expect(mockDeliveries.recordLocation).toHaveBeenCalledWith(DELIVERY_ID, 'd1', { latitude: 6.5, longitude: 3.4 });
    });

    it('rejects a malformed delivery id', async () => {
      await request(app.app).post('/api/v1/delivery/not-a-uuid/accept').set(as(driver())).expect(422);
    });
  });

  describe('reads, cancel and PIN reissue', () => {
    it('serves /available before treating it as an id', async () => {
      mockDeliveries.listAvailable.mockResolvedValue([]);
      await request(app.app).get('/api/v1/delivery/available').set(as(driver())).expect(200);
      expect(mockDeliveries.listAvailable).toHaveBeenCalled();
    });

    it('paginates history with defaults', async () => {
      mockDeliveries.list.mockResolvedValue({ data: [{ id: DELIVERY_ID }] as any, total: 1 });
      const res = await request(app.app).get('/api/v1/delivery').set(as(customer())).expect(200);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 20, total: 1 });
    });

    it('hides deliveries the caller does not own', async () => {
      mockDeliveries.getForUser.mockRejectedValue(createError.notFound('Delivery not found'));
      await request(app.app).get(`/api/v1/delivery/${DELIVERY_ID}`).set(as(customer())).expect(404);
    });

    it('serves tracking to participants', async () => {
      mockDeliveries.getTracking.mockResolvedValue({ deliveryId: DELIVERY_ID, status: 'IN_TRANSIT', points: [] } as any);
      const res = await request(app.app).get(`/api/v1/delivery/${DELIVERY_ID}/tracking`).set(as(customer())).expect(200);
      expect(res.body.data.status).toBe('IN_TRANSIT');
    });

    it('cancels as a customer with a reason', async () => {
      mockDeliveries.cancel.mockResolvedValue({ id: DELIVERY_ID, status: 'CANCELLED' } as any);
      await request(app.app)
        .post(`/api/v1/delivery/${DELIVERY_ID}/cancel`)
        .set(as(customer()))
        .send({ reason: 'Package not ready' })
        .expect(200);
      expect(mockDeliveries.cancel).toHaveBeenCalledWith(DELIVERY_ID, { role: 'customer', profileId: 'c1' }, 'Package not ready');
    });

    it('issues a new PIN to the sender', async () => {
      mockDeliveries.resendPin.mockResolvedValue({ deliveryPin: '5555' });
      const res = await request(app.app).post(`/api/v1/delivery/${DELIVERY_ID}/pin`).set(as(customer())).expect(200);
      expect(res.body.data.deliveryPin).toBe('5555');
      expect(mockDeliveries.resendPin).toHaveBeenCalledWith(DELIVERY_ID, 'c1');
    });
  });
});
