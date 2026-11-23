import request from 'supertest';
import app from '../app';
import { authService } from '@/shared/services/auth.service';
import { adminService } from '@/modules/admin/services/admin.service';
import { createError } from '@/shared/middleware/error-handler';

jest.mock('@/shared/services/auth.service');
jest.mock('@/modules/admin/services/admin.service');

const mockAuth = authService as jest.Mocked<typeof authService>;
const mockAdmin = adminService as jest.Mocked<typeof adminService>;

const ID = '3f2b8c1e-5a4d-4c6b-9e7f-1a2b3c4d5e6f';
const base = { isActive: true, isVerified: true, phoneNumber: '+2348012345678' };
const admin = { ...base, id: 'admin-user', adminProfile: { id: 'a1', role: 'SUPER_ADMIN' } };
const customer = { ...base, id: 'u1', customerProfile: { id: 'c1' } };
const driver = { ...base, id: 'u2', driverProfile: { id: 'd1', status: 'APPROVED' } };

const as = (user: object | null) => {
  mockAuth.getUserFromToken.mockResolvedValue(user as any);
  return { Authorization: 'Bearer token' };
};

describe('Admin API', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    const actual = jest.requireActual('@/shared/services/auth.service').authService;
    mockAuth.hasRole.mockImplementation(actual.hasRole.bind(actual));
  });

  describe('access control', () => {
    it('rejects unauthenticated requests', async () => {
      await request(app.app).get('/api/v1/admin/stats').expect(401);
    });

    it.each([
      ['customer', customer],
      ['driver', driver],
    ])('rejects a %s', async (_label, user) => {
      await request(app.app).get('/api/v1/admin/stats').set(as(user)).expect(403);
      expect(mockAdmin.stats).not.toHaveBeenCalled();
    });

    it('serves stats to an admin', async () => {
      mockAdmin.stats.mockResolvedValue({ customers: { total: 3 } } as any);
      const res = await request(app.app).get('/api/v1/admin/stats').set(as(admin)).expect(200);
      expect(res.body.data.customers.total).toBe(3);
    });
  });

  describe('drivers', () => {
    it('lists drivers with pagination and filters', async () => {
      mockAdmin.listDrivers.mockResolvedValue({ data: [{ id: ID }] as any, total: 41 });
      const res = await request(app.app)
        .get('/api/v1/admin/drivers?status=PENDING&search=mike&page=2&limit=20')
        .set(as(admin))
        .expect(200);
      expect(res.body.meta).toMatchObject({ page: 2, limit: 20, total: 41, totalPages: 3 });
      expect(mockAdmin.listDrivers).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'PENDING', search: 'mike', page: 2, limit: 20 })
      );
    });

    it('rejects an unknown status filter', async () => {
      await request(app.app).get('/api/v1/admin/drivers?status=BOGUS').set(as(admin)).expect(422);
    });

    it('approves a driver without a reason', async () => {
      mockAdmin.updateDriverStatus.mockResolvedValue({ id: ID, status: 'APPROVED' });
      await request(app.app)
        .patch(`/api/v1/admin/drivers/${ID}/status`)
        .set(as(admin))
        .send({ status: 'APPROVED' })
        .expect(200);
      expect(mockAdmin.updateDriverStatus).toHaveBeenCalledWith(ID, 'APPROVED', 'admin-user', undefined);
    });

    it('requires a reason to suspend', async () => {
      await request(app.app)
        .patch(`/api/v1/admin/drivers/${ID}/status`)
        .set(as(admin))
        .send({ status: 'SUSPENDED' })
        .expect(422);
      expect(mockAdmin.updateDriverStatus).not.toHaveBeenCalled();
    });

    it('does not allow setting a driver back to PENDING', async () => {
      await request(app.app)
        .patch(`/api/v1/admin/drivers/${ID}/status`)
        .set(as(admin))
        .send({ status: 'PENDING', reason: 'x' })
        .expect(422);
    });

    it('surfaces an illegal transition as 409', async () => {
      mockAdmin.updateDriverStatus.mockRejectedValue(createError.conflict('Cannot change driver from REJECTED to SUSPENDED'));
      await request(app.app)
        .patch(`/api/v1/admin/drivers/${ID}/status`)
        .set(as(admin))
        .send({ status: 'SUSPENDED', reason: 'Complaints' })
        .expect(409);
    });

    it('404s an unknown driver', async () => {
      mockAdmin.getDriver.mockRejectedValue(createError.notFound('Driver not found'));
      await request(app.app).get(`/api/v1/admin/drivers/${ID}`).set(as(admin)).expect(404);
    });
  });

  describe('customers and users', () => {
    it('lists customers', async () => {
      mockAdmin.listCustomers.mockResolvedValue({ data: [], total: 0 });
      const res = await request(app.app).get('/api/v1/admin/customers?active=false').set(as(admin)).expect(200);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 20, total: 0 });
      expect(mockAdmin.listCustomers).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
    });

    it('blocks a user', async () => {
      mockAdmin.setUserActive.mockResolvedValue({ id: ID, isActive: false });
      const res = await request(app.app)
        .patch(`/api/v1/admin/users/${ID}/active`)
        .set(as(admin))
        .send({ isActive: false, reason: 'Fraud' })
        .expect(200);
      expect(res.body.message).toBe('User blocked');
      expect(mockAdmin.setUserActive).toHaveBeenCalledWith(ID, false, 'admin-user', 'Fraud');
    });
  });

  describe('trips and payments', () => {
    it('rejects an inverted date range', async () => {
      await request(app.app)
        .get('/api/v1/admin/rides?from=2026-11-20&to=2026-11-01')
        .set(as(admin))
        .expect(422);
    });

    it('requires a reason to cancel a ride', async () => {
      await request(app.app).post(`/api/v1/admin/rides/${ID}/cancel`).set(as(admin)).send({}).expect(422);
    });

    it('cancels a delivery', async () => {
      mockAdmin.cancelDelivery.mockResolvedValue({ id: ID, status: 'CANCELLED' } as any);
      await request(app.app)
        .post(`/api/v1/admin/deliveries/${ID}/cancel`)
        .set(as(admin))
        .send({ reason: 'Customer called support' })
        .expect(200);
      expect(mockAdmin.cancelDelivery).toHaveBeenCalledWith(ID, 'admin-user', 'Customer called support');
    });

    it('returns payments with a status summary', async () => {
      mockAdmin.listPayments.mockResolvedValue({
        data: [],
        total: 0,
        summary: { COMPLETED: { count: 2, amount: 5000 } },
      });
      const res = await request(app.app).get('/api/v1/admin/payments?status=COMPLETED').set(as(admin)).expect(200);
      expect(res.body.meta.summary.COMPLETED.amount).toBe(5000);
    });
  });
});
