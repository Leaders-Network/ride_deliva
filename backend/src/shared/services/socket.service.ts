import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { logger } from '@/config/logger';
import { redis } from '@/config/redis';
import { authService } from '@/shared/services/auth.service';
import { SOCKET_EVENTS, CACHE_KEYS } from '@/shared/constants';
import { TokenPayload, SocketData } from '@/types';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  sessionId?: string;
}

interface LocationUpdate {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
}

interface RideEvent {
  rideId: string;
  customerId: string;
  driverId?: string;
  status: string;
  data?: any;
}

interface NotificationEvent {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: any;
}

export class SocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private socketUsers: Map<string, string> = new Map(); // socketId -> userId
  private driverLocations: Map<string, LocationUpdate & { lastUpdate: Date }> = new Map();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: config.security.corsOrigin,
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    logger.info('Socket.IO server initialized');
  }

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;

        if (!token) {
          throw new Error('Authentication token required');
        }

        // Verify JWT token
        const decoded = jwt.verify(token, config.jwt.secret) as TokenPayload;

        // Get user from database to ensure they're still active
        const user = await authService.getUserFromToken(token);
        if (!user || !user.isActive) {
          throw new Error('Invalid or inactive user');
        }

        // Attach user info to socket
        socket.userId = decoded.userId;
        socket.userRole = decoded.role;
        socket.sessionId = decoded.sessionId;

        logger.debug('Socket authenticated', {
          socketId: socket.id,
          userId: decoded.userId,
          role: decoded.role,
        });

        next();
      } catch (error) {
        logger.warn('Socket authentication failed', {
          socketId: socket.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on(SOCKET_EVENTS.CONNECTION, (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: AuthenticatedSocket): void {
    const { userId, userRole } = socket;

    if (!userId) {
      socket.disconnect(true);
      return;
    }

    // Track connected user
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(socket.id);
    this.socketUsers.set(socket.id, userId);

    // Join user to their personal room
    socket.join(`user:${userId}`);

    // Join role-specific rooms
    if (userRole) {
      socket.join(`role:${userRole.toLowerCase()}`);
    }

    logger.info('User connected via socket', {
      socketId: socket.id,
      userId,
      userRole,
      totalConnections: this.connectedUsers.get(userId)!.size,
    });

    // Set up event handlers for this socket
    this.setupSocketEventHandlers(socket);

    // Handle disconnection
    socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      this.handleDisconnection(socket);
    });
  }

  private setupSocketEventHandlers(socket: AuthenticatedSocket): void {
    const { userId, userRole } = socket;

    // Driver location updates
    if (userRole === 'DRIVER') {
      socket.on(SOCKET_EVENTS.DRIVER_LOCATION_UPDATE, (data: LocationUpdate) => {
        this.handleDriverLocationUpdate(socket, data);
      });

      socket.on(SOCKET_EVENTS.DRIVER_ONLINE, () => {
        this.handleDriverStatusChange(socket, true);
      });

      socket.on(SOCKET_EVENTS.DRIVER_OFFLINE, () => {
        this.handleDriverStatusChange(socket, false);
      });
    }

    // Ride-related events
    socket.on(SOCKET_EVENTS.RIDE_REQUESTED, (data: RideEvent) => {
      this.handleRideRequested(socket, data);
    });

    socket.on(SOCKET_EVENTS.RIDE_ACCEPTED, (data: RideEvent) => {
      this.handleRideAccepted(socket, data);
    });

    socket.on(SOCKET_EVENTS.RIDE_CANCELLED, (data: RideEvent) => {
      this.handleRideCancelled(socket, data);
    });

    socket.on(SOCKET_EVENTS.RIDE_STARTED, (data: RideEvent) => {
      this.handleRideStarted(socket, data);
    });

    socket.on(SOCKET_EVENTS.RIDE_COMPLETED, (data: RideEvent) => {
      this.handleRideCompleted(socket, data);
    });

    // Real-time location tracking during rides
    socket.on(SOCKET_EVENTS.RIDE_LOCATION_UPDATE, (data: {
      rideId: string;
      location: LocationUpdate;
    }) => {
      this.handleRideLocationUpdate(socket, data);
    });

    // Generic event handling
    socket.on('error', (error) => {
      logger.error('Socket error', {
        socketId: socket.id,
        userId,
        error: error instanceof Error ? error.message : error,
      });
    });
  }

  private handleDisconnection(socket: AuthenticatedSocket): void {
    const { userId } = socket;

    if (userId) {
      // Remove socket from user's connections
      const userSockets = this.connectedUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          this.connectedUsers.delete(userId);
          
          // If it's a driver, mark as offline after a delay
          if (socket.userRole === 'DRIVER') {
            setTimeout(() => {
              if (!this.connectedUsers.has(userId)) {
                this.handleDriverStatusChange(socket, false);
              }
            }, 30000); // 30 second grace period
          }
        }
      }

      this.socketUsers.delete(socket.id);
    }

    logger.info('User disconnected from socket', {
      socketId: socket.id,
      userId,
      userRole: socket.userRole,
    });
  }

  // Driver location update handler
  private async handleDriverLocationUpdate(
    socket: AuthenticatedSocket,
    data: LocationUpdate
  ): Promise<void> {
    const { userId } = socket;

    if (!userId) return;

    try {
      // Store location in memory for real-time access
      this.driverLocations.set(userId, {
        ...data,
        lastUpdate: new Date(),
      });

      // Store in Redis for persistence
      await redis.setex(
        CACHE_KEYS.DRIVER_LOCATION(userId),
        300, // 5 minutes TTL
        JSON.stringify({
          ...data,
          timestamp: new Date().toISOString(),
        })
      );

      // Broadcast location to tracking customers
      // This would typically be sent to customers tracking this driver
      socket.broadcast.emit(SOCKET_EVENTS.DRIVER_LOCATION_UPDATE, {
        driverId: userId,
        location: data,
        timestamp: new Date().toISOString(),
      });

      logger.debug('Driver location updated', {
        driverId: userId,
        latitude: data.latitude,
        longitude: data.longitude,
      });
    } catch (error) {
      logger.error('Failed to handle driver location update', {
        driverId: userId,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  // Driver status change handler
  private async handleDriverStatusChange(
    socket: AuthenticatedSocket,
    isOnline: boolean
  ): Promise<void> {
    const { userId } = socket;

    if (!userId) return;

    try {
      // Update driver status in Redis
      await redis.setex(
        `driver:status:${userId}`,
        isOnline ? 3600 : 10, // 1 hour if online, 10 seconds if offline
        JSON.stringify({
          isOnline,
          lastUpdate: new Date().toISOString(),
        })
      );

      // Broadcast status change
      this.io.emit(SOCKET_EVENTS.DRIVER_ONLINE, {
        driverId: userId,
        isOnline,
        timestamp: new Date().toISOString(),
      });

      logger.info('Driver status changed', {
        driverId: userId,
        isOnline,
      });
    } catch (error) {
      logger.error('Failed to handle driver status change', {
        driverId: userId,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  // Ride event handlers
  private handleRideRequested(socket: AuthenticatedSocket, data: RideEvent): void {
    // Broadcast to nearby drivers
    socket.broadcast.to('role:driver').emit(SOCKET_EVENTS.RIDE_REQUESTED, {
      ...data,
      timestamp: new Date().toISOString(),
    });

    logger.info('Ride requested broadcast', {
      rideId: data.rideId,
      customerId: data.customerId,
    });
  }

  private handleRideAccepted(socket: AuthenticatedSocket, data: RideEvent): void {
    // Notify customer
    this.io.to(`user:${data.customerId}`).emit(SOCKET_EVENTS.RIDE_ACCEPTED, {
      ...data,
      timestamp: new Date().toISOString(),
    });

    // Join driver and customer to ride-specific room
    socket.join(`ride:${data.rideId}`);
    this.io.to(`user:${data.customerId}`).socketsJoin(`ride:${data.rideId}`);

    logger.info('Ride accepted', {
      rideId: data.rideId,
      customerId: data.customerId,
      driverId: data.driverId,
    });
  }

  private handleRideCancelled(socket: AuthenticatedSocket, data: RideEvent): void {
    // Broadcast to ride participants
    this.io.to(`ride:${data.rideId}`).emit(SOCKET_EVENTS.RIDE_CANCELLED, {
      ...data,
      timestamp: new Date().toISOString(),
    });

    logger.info('Ride cancelled', {
      rideId: data.rideId,
      customerId: data.customerId,
    });
  }

  private handleRideStarted(socket: AuthenticatedSocket, data: RideEvent): void {
    this.io.to(`ride:${data.rideId}`).emit(SOCKET_EVENTS.RIDE_STARTED, {
      ...data,
      timestamp: new Date().toISOString(),
    });

    logger.info('Ride started', {
      rideId: data.rideId,
      customerId: data.customerId,
      driverId: data.driverId,
    });
  }

  private handleRideCompleted(socket: AuthenticatedSocket, data: RideEvent): void {
    this.io.to(`ride:${data.rideId}`).emit(SOCKET_EVENTS.RIDE_COMPLETED, {
      ...data,
      timestamp: new Date().toISOString(),
    });

    // Clean up ride room
    this.io.socketsLeave(`ride:${data.rideId}`);

    logger.info('Ride completed', {
      rideId: data.rideId,
      customerId: data.customerId,
      driverId: data.driverId,
    });
  }

  private handleRideLocationUpdate(
    socket: AuthenticatedSocket,
    data: { rideId: string; location: LocationUpdate }
  ): void {
    // Broadcast to ride participants only
    socket.broadcast.to(`ride:${data.rideId}`).emit(SOCKET_EVENTS.RIDE_LOCATION_UPDATE, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  // Public methods for external use
  
  // Send notification to specific user
  public async sendNotification(notification: NotificationEvent): Promise<boolean> {
    try {
      const userSockets = this.connectedUsers.get(notification.userId);
      
      if (userSockets && userSockets.size > 0) {
        this.io.to(`user:${notification.userId}`).emit(SOCKET_EVENTS.NOTIFICATION, {
          ...notification,
          timestamp: new Date().toISOString(),
        });

        logger.debug('Notification sent via socket', {
          userId: notification.userId,
          type: notification.type,
          socketCount: userSockets.size,
        });

        return true;
      }

      logger.debug('User not connected, notification not sent via socket', {
        userId: notification.userId,
        type: notification.type,
      });

      return false;
    } catch (error) {
      logger.error('Failed to send socket notification', {
        userId: notification.userId,
        error: error instanceof Error ? error.message : error,
      });
      return false;
    }
  }

  // Broadcast to all users of a specific role
  public broadcastToRole(role: string, event: string, data: any): void {
    this.io.to(`role:${role.toLowerCase()}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });

    logger.debug('Broadcast to role', {
      role,
      event,
    });
  }

  // Send message to specific ride participants
  public sendToRide(rideId: string, event: string, data: any): void {
    this.io.to(`ride:${rideId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  // Get connected users count
  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  // Get user connection status
  public isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  // Get driver location from memory
  public getDriverLocation(driverId: string): (LocationUpdate & { lastUpdate: Date }) | null {
    return this.driverLocations.get(driverId) || null;
  }

  // Get all connected drivers locations
  public getAllDriverLocations(): Array<{ driverId: string; location: LocationUpdate & { lastUpdate: Date } }> {
    const locations: Array<{ driverId: string; location: LocationUpdate & { lastUpdate: Date } }> = [];
    
    for (const [driverId, location] of this.driverLocations.entries()) {
      if (this.connectedUsers.has(driverId)) {
        locations.push({ driverId, location });
      }
    }

    return locations;
  }

  // Get server statistics
  public getStats(): {
    connectedUsers: number;
    connectedDrivers: number;
    totalSockets: number;
    activeRides: number;
  } {
    let connectedDrivers = 0;
    let totalSockets = 0;
    const activeRides = new Set<string>();

    for (const [userId, sockets] of this.connectedUsers.entries()) {
      totalSockets += sockets.size;
      
      // Check if any socket for this user is a driver
      for (const socketId of sockets) {
        const socket = this.io.sockets.sockets.get(socketId) as AuthenticatedSocket;
        if (socket?.userRole === 'DRIVER') {
          connectedDrivers++;
          break;
        }
      }
    }

    // Count active rides (rooms with 'ride:' prefix)
    this.io.sockets.adapter.rooms.forEach((sockets, roomId) => {
      if (roomId.startsWith('ride:') && sockets.size > 0) {
        activeRides.add(roomId);
      }
    });

    return {
      connectedUsers: this.connectedUsers.size,
      connectedDrivers,
      totalSockets,
      activeRides: activeRides.size,
    };
  }

  // Cleanup inactive drivers
  public cleanupInactiveDrivers(): void {
    const now = new Date();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [driverId, location] of this.driverLocations.entries()) {
      if (now.getTime() - location.lastUpdate.getTime() > inactiveThreshold) {
        this.driverLocations.delete(driverId);
        logger.debug('Cleaned up inactive driver location', { driverId });
      }
    }
  }
}

export let socketService: SocketService;