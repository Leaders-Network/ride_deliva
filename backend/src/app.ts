import express, { Application, Request, Response, NextFunction } from 'express';
import { createServer, Server as HTTPServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config, validateConfig } from '@/config';
import { logger, logStream } from '@/config/logger';
// import { testDatabaseConnection, closeDatabaseConnection } from '@/config/database';
// import { testRedisConnection, closeRedisConnections } from '@/config/redis';
import { healthService } from '@/shared/services/health';
import { SocketService, socketService as socketServiceInstance } from '@/shared/services/socket.service';
// import { initializeQueues, shutdownQueues } from '@/config/queues';
// import { initializeBullBoard, bullBoardAuth } from '@/config/bull-board';
import { errorHandler } from '@/shared/middleware/error-handler';
import { notFoundHandler } from '@/shared/middleware/not-found';
import { rateLimiter } from '@/shared/middleware/rate-limiter';
import { requestLogger } from '@/shared/middleware/request-logger';
import { apiRoutes } from '@/modules';

class RideDelivaApp {
  public app: Application;
  public httpServer: HTTPServer;
  public socketService: SocketService;
  private server: any;
  private bullBoardRouter: any;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    // this.validateEnvironment(); // Skip validation for now
    this.initializeMiddleware();
    this.initializeRoutes();
    // this.initializeBullBoard(); // Skip Bull Board for now
    this.initializeSocket();
    this.initializeErrorHandling();
  }

  private validateEnvironment(): void {
    try {
      validateConfig();
      logger.info('Environment configuration validated successfully');
    } catch (error) {
      logger.error('Environment validation failed:', error);
      process.exit(1);
    }
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));

    // CORS configuration
    this.app.use(cors({
      origin: config.security.corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));

    // Compression middleware
    this.app.use(compression());

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // HTTP request logging
    this.app.use(morgan('combined', { stream: logStream }));

    // Rate limiting
    this.app.use(rateLimiter);

    // Request logging middleware
    this.app.use(requestLogger);

    logger.info('Middleware initialized successfully');
  }

  private initializeRoutes(): void {
    // Health check endpoints
    this.app.get('/health', async (req: Request, res: Response) => {
      try {
        const health = await healthService.checkHealth();
        const statusCode = health.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(health);
      } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    this.app.get('/health/readiness', async (req: Request, res: Response) => {
      try {
        const isReady = await healthService.checkReadiness();
        res.status(isReady ? 200 : 503).json({ ready: isReady });
      } catch (error) {
        logger.error('Readiness check failed:', error);
        res.status(503).json({ ready: false });
      }
    });

    this.app.get('/health/liveness', async (req: Request, res: Response) => {
      try {
        const isAlive = await healthService.checkLiveness();
        res.status(isAlive ? 200 : 503).json({ alive: isAlive });
      } catch (error) {
        logger.error('Liveness check failed:', error);
        res.status(503).json({ alive: false });
      }
    });

    // API root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        name: config.app.name,
        version: config.app.version,
        environment: config.app.env,
        timestamp: new Date().toISOString(),
        endpoints: {
          api: `${config.app.apiPrefix}`,
          health: '/health',
          readiness: '/health/readiness',
          liveness: '/health/liveness',
        },
      });
    });

    // API routes
    this.app.use(config.app.apiPrefix, apiRoutes);

    logger.info('Routes initialized successfully');
  }

  private initializeBullBoard(): void {
    try {
      // Initialize Bull Board dashboard
      // this.bullBoardRouter = initializeBullBoard();
      
      // Mount Bull Board with authentication
      // this.app.use('/admin/queues', bullBoardAuth, this.bullBoardRouter.getRouter());
      
      logger.info('Bull Board dashboard initialized successfully', {
        path: '/admin/queues',
        authentication: 'enabled',
      });
    } catch (error) {
      logger.error('Failed to initialize Bull Board dashboard:', error);
      // Don't exit the process, just log the error
    }
  }

  private initializeSocket(): void {
    this.socketService = new SocketService(this.httpServer);
    
    // Make socket service globally available
    (global as any).socketService = this.socketService;

    // Start cleanup interval for inactive drivers
    setInterval(() => {
      this.socketService.cleanupInactiveDrivers();
    }, 5 * 60 * 1000); // Every 5 minutes

    logger.info('Socket.IO service initialized');
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);

    logger.info('Error handling initialized successfully');
  }

  public async start(): Promise<void> {
    try {
      logger.info('🚀 Starting server in basic mode (database connections disabled for testing)');

      // Skip database and Redis connections for now
      // Test database connection
      // const dbConnected = await testDatabaseConnection();
      // if (!dbConnected) {
      //   throw new Error('Failed to connect to database');
      // }

      // Test Redis connection
      // const redisConnected = await testRedisConnection();
      // if (!redisConnected) {
      //   throw new Error('Failed to connect to Redis');
      // }

      // Initialize job queues
      // await initializeQueues();
      // logger.info('Job queues initialized successfully');

      // Start the HTTP server (which includes Socket.IO)
      this.server = this.httpServer.listen(config.app.port, () => {
        logger.info(`🚀 ${config.app.name} started successfully`, {
          port: config.app.port,
          environment: config.app.env,
          apiPrefix: config.app.apiPrefix,
          socketIO: 'enabled',
          mode: 'basic (no database/redis)',
          timestamp: new Date().toISOString(),
        });

        // Log available endpoints
        logger.info('Available endpoints:', {
          root: `http://localhost:${config.app.port}/`,
          api: `http://localhost:${config.app.port}${config.app.apiPrefix}`,
          health: `http://localhost:${config.app.port}/health`,
          websocket: `ws://localhost:${config.app.port}`,
        });
      });

      // Handle server errors
      this.server.on('error', (error: any) => {
        if (error.syscall !== 'listen') {
          throw error;
        }

        const bind = typeof config.app.port === 'string' 
          ? 'Pipe ' + config.app.port 
          : 'Port ' + config.app.port;

        switch (error.code) {
          case 'EACCES':
            logger.error(`${bind} requires elevated privileges`);
            process.exit(1);
            break;
          case 'EADDRINUSE':
            logger.error(`${bind} is already in use`);
            process.exit(1);
            break;
          default:
            throw error;
        }
      });

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    logger.info('Shutting down server...');

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server.close(() => {
          logger.info('HTTP server closed');
          resolve();
        });
      });
    }

    // Skip database and queue shutdowns for basic mode
    // Close database connections
    // await closeDatabaseConnection();

    // Shutdown job queues
    // try {
    //   await shutdownQueues();
    //   logger.info('Job queues shut down successfully');
    // } catch (error) {
    //   logger.error('Error shutting down job queues:', error);
    // }

    // Close Redis connections
    // await closeRedisConnections();

    logger.info('Server shutdown completed');
  }
}

// Graceful shutdown handling
const app = new RideDelivaApp();

// Handle process termination signals
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received');
  await app.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received');
  await app.stop();
  process.exit(0);
});

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application if not in test mode
if (process.env.NODE_ENV !== 'test') {
  app.start().catch((error) => {
    logger.error('Application startup failed:', error);
    process.exit(1);
  });
}

export default app;
