import { Router } from 'express';
import { ResponseUtil } from '@/shared/utils/response';

const router = Router();

router.get('/', (req, res) => {
  ResponseUtil.success(res, {
    name: 'Delivery API',
    status: 'planned',
    planned: ['booking', 'assignment', 'lifecycle', 'proof of delivery', 'tracking', 'history'],
  });
});

export { router as deliveryRoutes };
