import { Router } from 'express';
import { socketController } from './controllers/socket.controller';
import { authenticate, requireAdmin, requireDriverOrAdmin } from '@/shared/middleware/auth.middleware';
import { validate } from '@/shared/utils/validation';
import Joi from 'joi';

const router = Router();

// Validation schemas
const testNotificationSchema = Joi.object({
  userId: Joi.string().uuid().optional(),
  title: Joi.string().min(1).max(100).optional(),
  message: Joi.string().min(1).max(500).optional(),
  type: Joi.string().valid('TEST', 'INFO', 'WARNING', 'ERROR').default('TEST'),
});

const broadcastSchema = Joi.object({
  role: Joi.string().valid('customer', 'driver', 'admin').required(),
  event: Joi.string().min(1).required(),
  data: Joi.object().required(),
});

const rideMessageSchema = Joi.object({
  rideId: Joi.string().uuid().required(),
  event: Joi.string().min(1).required(),
  data: Joi.object().required(),
});

// Public routes
// Get Socket.IO connection information
router.get('/info', socketController.getConnectionInfo);

// Health check for Socket.IO service
router.get('/health', socketController.healthCheck);

// Get general statistics (public for monitoring)
router.get('/stats', socketController.getStats);

// Protected routes (require authentication)

// Get user connection status
router.get('/connection/status', 
  authenticate,
  socketController.getUserConnectionStatus
);

// Get driver location (drivers and admins only)
router.get('/drivers/:driverId/location', 
  requireDriverOrAdmin,
  socketController.getDriverLocation
);

// Send test notification (authenticated users can send to themselves, admins to anyone)
router.post('/notifications/test', 
  authenticate,
  validate(testNotificationSchema),
  socketController.sendTestNotification
);

// Admin-only routes

// Get all connected drivers
router.get('/drivers/connected', 
  requireAdmin,
  socketController.getConnectedDrivers
);

// Broadcast message to specific role
router.post('/broadcast/role', 
  requireAdmin,
  validate(broadcastSchema),
  socketController.broadcastToRole
);

// Send message to ride participants
router.post('/rides/message', 
  requireAdmin,
  validate(rideMessageSchema),
  socketController.sendToRide
);

// API documentation
router.get('/', (req, res) => {
  res.json({
    name: 'Socket.IO Management API',
    version: '1.0.0',
    description: 'Real-time communication management endpoints',
    endpoints: {
      // Public endpoints
      'GET /info': 'Get Socket.IO connection information',
      'GET /health': 'Socket.IO service health check',
      'GET /stats': 'Get connection statistics',
      
      // Protected endpoints
      'GET /connection/status': 'Get current user connection status',
      'GET /drivers/:driverId/location': 'Get real-time driver location',
      'POST /notifications/test': 'Send test notification',
      
      // Admin endpoints
      'GET /drivers/connected': 'Get all connected drivers (Admin only)',
      'POST /broadcast/role': 'Broadcast to user role (Admin only)',
      'POST /rides/message': 'Send message to ride participants (Admin only)',
    },
    websocket: {
      endpoint: `ws://localhost:${process.env.PORT || 3000}`,
      authentication: 'JWT token required',
      documentation: 'See GET /info for detailed WebSocket documentation',
    },
    authentication: {
      header: 'Authorization: Bearer <jwt-token>',
      websocket: 'auth: { token: "<jwt-token>" } or query: { token: "<jwt-token>" }',
    },
  });
});

export { router as socketRoutes };
