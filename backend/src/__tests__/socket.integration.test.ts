import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import Client from 'socket.io-client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../app';
import { config } from '@/config';
import { SocketService } from '@/shared/services/socket.service';

describe('Socket.IO Integration', () => {
  let httpServer: HTTPServer;
  let socketService: SocketService;
  let clientSocket: any;
  let serverSocket: any;

  const validToken = jwt.sign(
    {
      userId: 'test-user-id',
      phoneNumber: '+2348123456789',
      role: 'CUSTOMER',
      sessionId: 'test-session-id',
    },
    config.jwt.secret,
    { expiresIn: '1h' }
  );

  beforeAll((done) => {
    httpServer = app.httpServer;
    socketService = app.socketService;
    
    httpServer.listen(() => {
      const port = (httpServer.address() as any)?.port;
      
      // Create client socket
      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token: validToken },
        transports: ['websocket'],
      });

      // Wait for connection
      clientSocket.on('connect', () => {
        done();
      });

      clientSocket.on('connect_error', (error: any) => {
        done(error);
      });
    });
  });

  afterAll((done) => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    
    httpServer.close(() => {
      done();
    });
  });

  describe('Connection and Authentication', () => {
    it('should connect with valid token', (done) => {
      expect(clientSocket.connected).toBe(true);
      done();
    });

    it('should reject connection with invalid token', (done) => {
      const invalidClient = Client(`http://localhost:${(httpServer.address() as any)?.port}`, {
        auth: { token: 'invalid-token' },
        transports: ['websocket'],
      });

      invalidClient.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        invalidClient.disconnect();
        done();
      });

      invalidClient.on('connect', () => {
        invalidClient.disconnect();
        done(new Error('Should not connect with invalid token'));
      });
    });

    it('should reject connection without token', (done) => {
      const noTokenClient = Client(`http://localhost:${(httpServer.address() as any)?.port}`, {
        transports: ['websocket'],
      });

      noTokenClient.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication');
        noTokenClient.disconnect();
        done();
      });

      noTokenClient.on('connect', () => {
        noTokenClient.disconnect();
        done(new Error('Should not connect without token'));
      });
    });
  });

  describe('Event Handling', () => {
    it('should handle driver location updates', (done) => {
      const driverToken = jwt.sign(
        {
          userId: 'driver-user-id',
          phoneNumber: '+2348087654321',
          role: 'DRIVER',
          sessionId: 'driver-session-id',
        },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      const driverClient = Client(`http://localhost:${(httpServer.address() as any)?.port}`, {
        auth: { token: driverToken },
        transports: ['websocket'],
      });

      driverClient.on('connect', () => {
        const locationData = {
          latitude: 6.4281,
          longitude: 3.4219,
          heading: 45.0,
          speed: 25.0,
          accuracy: 5.0,
        };

        // Listen for location update broadcast
        clientSocket.on('driver:location:update', (data: any) => {
          expect(data.driverId).toBe('driver-user-id');
          expect(data.location.latitude).toBe(locationData.latitude);
          expect(data.location.longitude).toBe(locationData.longitude);
          
          driverClient.disconnect();
          done();
        });

        // Send location update
        driverClient.emit('driver:location:update', locationData);
      });
    });

    it('should handle ride events', (done) => {
      const rideData = {
        rideId: 'test-ride-id',
        customerId: 'test-customer-id',
        driverId: 'test-driver-id',
        status: 'REQUESTED',
      };

      // Listen for ride request
      clientSocket.on('ride:requested', (data: any) => {
        expect(data.rideId).toBe(rideData.rideId);
        expect(data.customerId).toBe(rideData.customerId);
        done();
      });

      // Emit ride request
      clientSocket.emit('ride:requested', rideData);
    });

    it('should handle notifications', (done) => {
      const notification = {
        userId: 'test-user-id',
        type: 'TEST',
        title: 'Test Notification',
        message: 'This is a test notification',
      };

      // Listen for notification
      clientSocket.on('notification', (data: any) => {
        expect(data.type).toBe(notification.type);
        expect(data.title).toBe(notification.title);
        expect(data.message).toBe(notification.message);
        done();
      });

      // Send notification via service
      socketService.sendNotification(notification);
    });
  });

  describe('Real-time Location Tracking', () => {
    it('should track driver location in ride', (done) => {
      const rideId = 'test-ride-tracking';
      const locationUpdate = {
        rideId,
        location: {
          latitude: 6.4474,
          longitude: 3.4553,
          speed: 30.0,
        },
      };

      // Listen for ride location update
      clientSocket.on('ride:location:update', (data: any) => {
        expect(data.rideId).toBe(rideId);
        expect(data.location.latitude).toBe(locationUpdate.location.latitude);
        expect(data.location.longitude).toBe(locationUpdate.location.longitude);
        done();
      });

      // Emit location update
      clientSocket.emit('ride:location:update', locationUpdate);
    });
  });

  describe('Service Methods', () => {
    it('should check user connection status', () => {
      const isConnected = socketService.isUserConnected('test-user-id');
      expect(isConnected).toBe(true);
    });

    it('should get connection statistics', () => {
      const stats = socketService.getStats();
      expect(stats).toHaveProperty('connectedUsers');
      expect(stats).toHaveProperty('connectedDrivers');
      expect(stats).toHaveProperty('totalSockets');
      expect(stats).toHaveProperty('activeRides');
      expect(typeof stats.connectedUsers).toBe('number');
    });

    it('should broadcast to roles', (done) => {
      // Listen for role broadcast
      clientSocket.on('test:broadcast', (data: any) => {
        expect(data.message).toBe('Test broadcast to customers');
        done();
      });

      // Broadcast to customer role
      socketService.broadcastToRole('CUSTOMER', 'test:broadcast', {
        message: 'Test broadcast to customers',
      });
    });
  });
});

describe('Socket.IO HTTP Endpoints', () => {
  describe('GET /api/v1/socket/stats', () => {
    it('should return socket statistics', async () => {
      const response = await request(app.app)
        .get('/api/v1/socket/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('connectedUsers');
      expect(response.body.data).toHaveProperty('totalSockets');
    });
  });

  describe('GET /api/v1/socket/info', () => {
    it('should return connection information', async () => {
      const response = await request(app.app)
        .get('/api/v1/socket/info')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('endpoint');
      expect(response.body.data).toHaveProperty('authentication');
      expect(response.body.data).toHaveProperty('events');
    });
  });

  describe('GET /api/v1/socket/health', () => {
    it('should return health status', async () => {
      const response = await request(app.app)
        .get('/api/v1/socket/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.service).toBe('Socket.IO');
    });
  });

  describe('Protected Endpoints', () => {
    it('should require authentication for connection status', async () => {
      const response = await request(app.app)
        .get('/api/v1/socket/connection/status')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return connection status for authenticated user', async () => {
      const response = await request(app.app)
        .get('/api/v1/socket/connection/status')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('connected');
      expect(response.body.data).toHaveProperty('userId');
    });
  });

  describe('Admin Endpoints', () => {
    it('should require admin role for connected drivers', async () => {
      const response = await request(app.app)
        .get('/api/v1/socket/drivers/connected')
        .set('Authorization', `Bearer ${validToken}`) // Customer token
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });
});

describe('Socket Service Error Handling', () => {
  it('should handle invalid location updates gracefully', () => {
    expect(() => {
      // This should not throw
      socketService.getDriverLocation('non-existent-driver');
    }).not.toThrow();
  });

  it('should handle cleanup of inactive drivers', () => {
    expect(() => {
      socketService.cleanupInactiveDrivers();
    }).not.toThrow();
  });

  it('should handle notification to non-existent user', async () => {
    const result = await socketService.sendNotification({
      userId: 'non-existent-user',
      type: 'TEST',
      title: 'Test',
      message: 'Test message',
    });

    expect(result).toBe(false);
  });
});