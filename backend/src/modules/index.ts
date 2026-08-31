import { Router } from 'express';
import { authRoutes } from './auth/routes';
import { socketRoutes } from './socket/routes';
import queueRoutes from './queue/routes';
// import { webhookRoutes } from './webhooks/routes'; // Temporarily disabled
// import { userRoutes } from './users/routes';
// import { rideRoutes } from './rides/routes';
// import { deliveryRoutes } from './delivery/routes';
// import { paymentRoutes } from './payments/routes';

const router = Router();

// API Documentation
router.get('/', (req, res) => {
  res.json({
    message: 'Ride Deliva API',
    version: '1.0.0',
    status: 'operational',
    endpoints: {
      auth: '/auth',
      socket: '/socket',
      queues: '/queues',
      // webhooks: '/webhooks', // Temporarily disabled
      users: '/users',
      rides: '/rides',
      delivery: '/delivery',
      payments: '/payments',
      admin: '/admin',
    },
    documentation: '/docs',
    health: '/health',
    realtime: {
      websocket: `ws://localhost:${process.env.PORT || 3000}`,
      management: '/socket',
    },
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer <access_token>',
      endpoints: {
        login: 'POST /auth/login',
        register: 'POST /auth/register',
        refresh: 'POST /auth/refresh-token',
        logout: 'POST /auth/logout',
      },
    },
  });
});

// Module routes
router.use('/auth', authRoutes);
router.use('/socket', socketRoutes);
router.use('/queues', queueRoutes);
// router.use('/webhooks', webhookRoutes); // Temporarily disabled
// router.use('/users', userRoutes);
// router.use('/rides', rideRoutes);
// router.use('/delivery', deliveryRoutes);
// router.use('/payments', paymentRoutes);

export { router as apiRoutes };