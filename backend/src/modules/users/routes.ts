import { Router } from 'express';
import { ResponseUtil } from '@/shared/utils/response';

const router = Router();

// Profile reads/updates live under /auth/profile for now; address book and driver onboarding land here next.
router.get('/', (req, res) => {
  ResponseUtil.success(res, {
    name: 'Users API',
    status: 'planned',
    planned: ['addresses', 'driver documents', 'vehicles', 'driver availability and location'],
  });
});

export { router as userRoutes };
