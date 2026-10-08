import express from 'express';
import request from 'supertest';
import { bullBoardAuth } from '@/config/bull-board';
import { authService } from '@/shared/services/auth.service';

jest.mock('@/config/queues', () => ({ queueService: {}, QUEUE_NAMES: {} }));
jest.mock('@bull-board/api', () => ({ createBullBoard: jest.fn() }));
jest.mock('@bull-board/api/bullMQAdapter', () => ({ BullMQAdapter: jest.fn() }));
jest.mock('@bull-board/express', () => ({
  ExpressAdapter: jest.fn().mockImplementation(() => ({ setBasePath: jest.fn() })),
}));
jest.mock('@/shared/services/auth.service', () => ({
  authService: { getUserFromToken: jest.fn(), hasRole: jest.fn() },
}));

const getUser = jest.mocked(authService.getUserFromToken);
const hasRole = jest.mocked(authService.hasRole);
const app = express();
app.use('/dashboard', bullBoardAuth, (_req, res) => { res.sendStatus(204); });

describe('Bull Board access control', () => {
  beforeEach(() => {
    getUser.mockReset();
    hasRole.mockReset();
  });

  it('requires a token', async () => {
    await request(app).get('/dashboard').expect(401);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('rejects a token without an authenticated user', async () => {
    getUser.mockResolvedValue(null);
    await request(app).get('/dashboard').set('Authorization', 'Bearer expired').expect(403);
    expect(hasRole).not.toHaveBeenCalled();
  });

  it('rejects an inactive account', async () => {
    getUser.mockResolvedValue({ id: 'admin', isActive: false } as NonNullable<Awaited<ReturnType<typeof authService.getUserFromToken>>>);
    await request(app).get('/dashboard').set('Authorization', 'Bearer inactive').expect(403);
    expect(hasRole).not.toHaveBeenCalled();
  });

  it('rejects a non-admin user', async () => {
    getUser.mockResolvedValue({ id: 'customer', isActive: true } as NonNullable<Awaited<ReturnType<typeof authService.getUserFromToken>>>);
    hasRole.mockReturnValue(false);
    await request(app).get('/dashboard').set('Authorization', 'Bearer customer').expect(403);
  });

  it('allows an active administrator and checks both admin roles', async () => {
    const user = { id: 'admin', isActive: true } as NonNullable<Awaited<ReturnType<typeof authService.getUserFromToken>>>;
    getUser.mockResolvedValue(user);
    hasRole.mockReturnValue(true);
    await request(app).get('/dashboard').set('Authorization', 'Bearer admin').expect(204);
    expect(getUser).toHaveBeenCalledWith('admin');
    expect(hasRole).toHaveBeenCalledWith(user, ['ADMIN', 'SUPER_ADMIN']);
  });

  it('rejects invalid tokens', async () => {
    getUser.mockRejectedValue(new Error('Invalid token'));
    await request(app).get('/dashboard').set('Authorization', 'Bearer invalid').expect(401);
  });
});
