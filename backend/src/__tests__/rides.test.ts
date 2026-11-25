import request from 'supertest';
import app from '../app';
import { authService } from '@/shared/services/auth.service';
import { rideService } from '@/modules/rides/services/ride.service';
import { createError } from '@/shared/middleware/error-handler';

jest.mock('@/shared/services/auth.service');
jest.mock('@/modules/rides/services/ride.service');

const mockAuth = authService as jest.Mocked<typeof authService>;
const mockRides = rideService as jest.Mocked<typeof rideService>;

const RIDE_ID = '3f2b8c1e-5a4d-4c6b-9e7f-1a2b3c4d5e6f';
const base = { isActive: true, isVerified: true, phoneNumber: '+2348123456789' };

const customer = { ...base, id: 'u1', customerProfile: { id: 'c1' } };
const approvedDriver = {
  ...base,
  id: 'u2',
  driverProfile: { id: 'd1', status: 'APPROVED', isOnline: true, isAvailable: true },
};
const pendingDriver = { ...approvedDriver, driverProfile: { ...approvedDriver.driverProfile, status: 'PENDING' } };

const loc = (latitude: number, longitude: number) => ({ latitude, longitude, address: 'Somewhere, Lagos' });
const bookingBody = { pickup: loc(6.4474, 3.4739), destination: loc(6.6018, 3.3515) };

const as = (user: object | null) => {
  mockAuth.getUserFromToken.mockResolvedValue(user as any);
  return { Authorization: 'Bearer token' };
};

describe('Rides API', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // The real role logic is what we want guarding these routes.
    const actual = jest.requireActual('@/shared/services/auth.service').authService;
    mockAuth.hasRole.mockImplementation(actual.hasRole.bind(actual));
  });

  describe('authentication and roles', () => {
    it('rejects unauthenticated booking', async () => {
      await request(app.app).post('/api/v1/rides').send(bookingBody).expect(401);
    });

    it('rejects a driver booking a ride', async () => {
      await request(app.app).post('/api/v1/rides').set(as(approvedDriver)).send(bookingBody).expect(403);
      expect(mockRides.book).not.toHaveBeenCalled();
    });

    it('rejects a customer accepting a ride', async () => {
      await request(app.app).post(`/api/v1/rides/${RIDE_ID}/accept`).set(as(customer)).expect(403);
    });

    it('rejects an unapproved driver', async () => {
      await request(app.app).post(`/api/v1/rides/${RIDE_ID}/accept`).set(as(pendingDriver)).expect(403);
      expect(mockRides.accept).not.toHaveBeenCalled();
    });
  });

  describe('POST /rides/estimate', () => {
    it('returns the estimate', async () => {
      mockRides.estimate.mockReturnValue({ fare: 1234.5, currency: 'NGN' } as any);
      const res = await request(app.app).post('/api/v1/rides/estimate').set(as(customer)).send(bookingBody).expect(200);
      expect(res.body.data.fare).toBe(1234.5);
      expect(mockRides.estimate).toHaveBeenCalledWith(
        expect.objectContaining({ rideType: 'STANDARD' })
      );
    });

    it('validates coordinates', async () => {
      const bad = { ...bookingBody, pickup: { ...bookingBody.pickup, latitude: 200 } };
      const res = await request(app.app).post('/api/v1/rides/estimate').set(as(customer)).send(bad).expect(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /rides', () => {
    it('books a ride for the caller’s customer profile', async () => {
      mockRides.book.mockResolvedValue({ ride: { id: RIDE_ID, status: 'REQUESTED' }, estimate: { fare: 900 } } as any);
      const res = await request(app.app).post('/api/v1/rides').set(as(customer)).send(bookingBody).expect(201);
      expect(res.body.data.ride.id).toBe(RIDE_ID);
      expect(mockRides.book).toHaveBeenCalledWith(
        'c1',
        'u1',
        expect.objectContaining({ passengerCount: 1, rideType: 'STANDARD' })
      );
    });

    it('requires scheduledAt only for SCHEDULE rides', async () => {
      await request(app.app)
        .post('/api/v1/rides')
        .set(as(customer))
        .send({ ...bookingBody, rideType: 'SCHEDULE' })
        .expect(422);
    });

    it('surfaces the active-ride conflict', async () => {
      mockRides.book.mockRejectedValue(createError.conflict('You already have a ride in progress'));
      const res = await request(app.app).post('/api/v1/rides').set(as(customer)).send(bookingBody).expect(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('driver lifecycle', () => {
    it('accepts a ride', async () => {
      mockRides.accept.mockResolvedValue({ id: RIDE_ID, status: 'ACCEPTED' } as any);
      const res = await request(app.app).post(`/api/v1/rides/${RIDE_ID}/accept`).set(as(approvedDriver)).expect(200);
      expect(res.body.data.status).toBe('ACCEPTED');
      expect(mockRides.accept).toHaveBeenCalledWith(RIDE_ID, 'd1');
    });

    it('returns 409 when another driver already took the ride', async () => {
      mockRides.accept.mockRejectedValue(createError.conflict('Ride is no longer available'));
      await request(app.app).post(`/api/v1/rides/${RIDE_ID}/accept`).set(as(approvedDriver)).expect(409);
    });

    it.each([
      ['arriving', 'arriving'],
      ['arrived', 'arrived'],
      ['start', 'start'],
      ['complete', 'complete'],
    ])('POST /:id/%s advances with action %s', async (path, action) => {
      mockRides.advance.mockResolvedValue({ id: RIDE_ID } as any);
      await request(app.app).post(`/api/v1/rides/${RIDE_ID}/${path}`).set(as(approvedDriver)).send({}).expect(200);
      expect(mockRides.advance).toHaveBeenCalledWith(RIDE_ID, 'd1', action, {});
    });

    it('rejects a malformed ride id', async () => {
      await request(app.app).post('/api/v1/rides/not-a-uuid/accept').set(as(approvedDriver)).expect(422);
    });
  });

  describe('reads and cancel', () => {
    it('serves /available before treating it as an id', async () => {
      mockRides.listAvailable.mockResolvedValue([]);
      await request(app.app).get('/api/v1/rides/available').set(as(approvedDriver)).expect(200);
      expect(mockRides.listAvailable).toHaveBeenCalled();
    });

    it('paginates ride history with defaults', async () => {
      mockRides.list.mockResolvedValue({ data: [{ id: RIDE_ID }] as any, total: 1 });
      const res = await request(app.app).get('/api/v1/rides').set(as(customer)).expect(200);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 20, total: 1 });
    });

    it('hides rides the caller does not own', async () => {
      mockRides.getForUser.mockRejectedValue(createError.notFound('Ride not found'));
      await request(app.app).get(`/api/v1/rides/${RIDE_ID}`).set(as(customer)).expect(404);
    });

    it('cancels as a customer with a reason', async () => {
      mockRides.cancel.mockResolvedValue({ id: RIDE_ID, status: 'CANCELLED' } as any);
      await request(app.app)
        .post(`/api/v1/rides/${RIDE_ID}/cancel`)
        .set(as(customer))
        .send({ reason: 'Changed my mind' })
        .expect(200);
      expect(mockRides.cancel).toHaveBeenCalledWith(RIDE_ID, { role: 'customer', profileId: 'c1' }, 'Changed my mind');
    });
  });

  describe('placeholder routers', () => {
    it.each(['users'])('mounts /%s', async (name) => {
      const res = await request(app.app).get(`/api/v1/${name}`).expect(200);
      expect(res.body.data.status).toBe('planned');
    });

    it('mounts /payments behind authentication', async () => {
      await request(app.app).get('/api/v1/payments').expect(401);
    });
  });
});
