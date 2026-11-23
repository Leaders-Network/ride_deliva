import { Router } from 'express';
import { ResponseUtil } from '@/shared/utils/response';

const router = Router();

router.get('/', (req, res) => {
  ResponseUtil.success(res, {
    name: 'Payments API',
    status: 'planned',
    planned: ['wallet', 'ride settlement', 'payment methods', 'provider webhooks'],
  });
});

export { router as paymentRoutes };
