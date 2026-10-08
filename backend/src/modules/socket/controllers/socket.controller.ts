import { Request, Response } from 'express';
import { sendSuccess } from '@/shared/utils/response';
import { asyncHandler } from '@/shared/middleware/error-handler';
import { AuthenticatedRequest } from '@/types';
import { logger } from '@/config/logger';
import type { SocketService } from '@/shared/services/socket.service';

declare global {
  var socketService: SocketService | undefined;
}

export class SocketController {
  // Get Socket.IO connection status and statistics
  getStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const socketService = global.socketService;

    if (!socketService) {
      sendSuccess(res, {
        status: 'unavailable',
        message: 'Socket.IO service not initialized',
      });
      return;
    }

    const stats = socketService.getStats();

    sendSuccess(res, {
      status: 'active',
      ...stats,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }, 'Socket.IO statistics retrieved');
  });

  // Get user connection status
  getUserConnectionStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const socketService = global.socketService;
    
    if (!req.user) {
      sendSuccess(res, { connected: false }, 'User not authenticated');
      return;
    }

    if (!socketService) {
      sendSuccess(res, { connected: false }, 'Socket service unavailable');
      return;
    }

    const isConnected = socketService.isUserConnected(req.user.id);

    sendSuccess(res, {
      connected: isConnected,
      userId: req.user.id,
      timestamp: new Date().toISOString(),
    });
  });

  // Get all connected drivers (for admin)
  getConnectedDrivers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const socketService = global.socketService;

    if (!socketService) {
      sendSuccess(res, [], 'Socket service unavailable');
      return;
    }

    const driverLocations = socketService.getAllDriverLocations();

    const driversWithStatus = driverLocations.map(({ driverId, location }) => ({
      driverId,
      latitude: location.latitude,
      longitude: location.longitude,
      heading: location.heading,
      speed: location.speed,
      accuracy: location.accuracy,
      lastUpdate: location.lastUpdate,
      connected: true,
    }));

    sendSuccess(res, driversWithStatus, 'Connected drivers retrieved');
  });

  // Send test notification (for development/testing)
  sendTestNotification = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const socketService = global.socketService;
    const { userId, title, message, type = 'TEST' } = req.body;

    if (!socketService) {
      sendSuccess(res, { sent: false }, 'Socket service unavailable');
      return;
    }

    const targetUserId = userId || req.user?.id;

    if (!targetUserId) {
      sendSuccess(res, { sent: false }, 'Target user ID required');
      return;
    }

    const sent = await socketService.sendNotification({
      userId: targetUserId,
      type,
      title: title || 'Test Notification',
      message: message || 'This is a test notification from Socket.IO',
    });

    sendSuccess(res, {
      sent,
      targetUserId,
      timestamp: new Date().toISOString(),
    }, sent ? 'Test notification sent' : 'User not connected');
  });

  // Broadcast message to role (admin only)
  broadcastToRole = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const socketService = global.socketService;
    const { role, event, data } = req.body;

    if (!socketService) {
      sendSuccess(res, { sent: false }, 'Socket service unavailable');
      return;
    }

    socketService.broadcastToRole(role, event, data);

    logger.info('Admin broadcast to role', {
      role,
      event,
      data,
      timestamp: new Date().toISOString(),
    });

    sendSuccess(res, {
      sent: true,
      role,
      event,
      timestamp: new Date().toISOString(),
    }, 'Broadcast sent to role');
  });

  // Send message to ride participants
  sendToRide = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const socketService = global.socketService;
    const { rideId, event, data } = req.body;

    if (!socketService) {
      sendSuccess(res, { sent: false }, 'Socket service unavailable');
      return;
    }

    socketService.sendToRide(rideId, event, data);

    sendSuccess(res, {
      sent: true,
      rideId,
      event,
      timestamp: new Date().toISOString(),
    }, 'Message sent to ride participants');
  });

  // Get driver location (real-time)
  getDriverLocation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const socketService = global.socketService;
    const { driverId } = req.params;

    if (!socketService) {
      sendSuccess(res, null, 'Socket service unavailable');
      return;
    }

    const location = socketService.getDriverLocation(driverId);

    if (!location) {
      sendSuccess(res, null, 'Driver location not available');
      return;
    }

    sendSuccess(res, {
      driverId,
      ...location,
      timestamp: new Date().toISOString(),
    }, 'Driver location retrieved');
  });

  // Health check for Socket.IO service
  healthCheck = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const socketService = global.socketService;

    if (!socketService) {
      res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Socket.IO service not available',
          statusCode: 503,
        },
      });
      return;
    }

    const stats = socketService.getStats();

    sendSuccess(res, {
      status: 'healthy',
      service: 'Socket.IO',
      ...stats,
      timestamp: new Date().toISOString(),
    }, 'Socket.IO service is healthy');
  });

  // Get Socket.IO connection info (for client setup)
  getConnectionInfo = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, {
      endpoint: `ws://localhost:${process.env.PORT || 3000}`,
      namespace: '/',
      authentication: {
        required: true,
        method: 'JWT token in auth object or query parameter',
        example: {
          auth: { token: 'your-jwt-token' },
          // or
          query: { token: 'your-jwt-token' },
        },
      },
      events: {
        client_to_server: [
          'driver:location:update',
          'driver:online',
          'driver:offline',
          'ride:requested',
          'ride:accepted',
          'ride:cancelled',
          'ride:started',
          'ride:completed',
          'ride:location:update',
        ],
        server_to_client: [
          'driver:location:update',
          'driver:online',
          'ride:requested',
          'ride:accepted',
          'ride:cancelled',
          'ride:started',
          'ride:completed',
          'ride:location:update',
          'notification',
        ],
      },
      rooms: {
        user: 'user:{userId}',
        role: 'role:{customer|driver|admin}',
        ride: 'ride:{rideId}',
      },
    }, 'Socket.IO connection information');
  });
}

export const socketController = new SocketController();
