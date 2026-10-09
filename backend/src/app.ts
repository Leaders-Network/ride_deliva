import express, { Application, Request, Response } from 'express';
import { createServer, Server as HTTPServer } from 'http';
import type { ExpressAdapter } from '@bull-board/express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config, validateConfig } from '@/config';
import { logger, logStream } from '@/config/logger';
import { testDatabaseConnection, closeDatabaseConnection } from '@/config/database';
import { testRedisConnection, closeRedisConnections } from '@/config/redis';
import { initializeQueues, shutdownQueues } from '@/config/queues';
import { initializeBullBoard, bullBoardAuth } from '@/config/bull-board';
import { healthService } from '@/shared/services/health';
import { SocketService } from '@/shared/services/socket.service';
import { errorHandler } from '@/shared/middleware/error-handler';
import { notFoundHandler } from '@/shared/middleware/not-found';
import { rateLimiter } from '@/shared/middleware/rate-limiter';
import { requestLogger } from '@/shared/middleware/request-logger';
import { apiRoutes } from '@/modules';

class RideDelivaApp {
  public app: Application;
  public httpServer: HTTPServer;
  public socketService: SocketService;
  private bullBoardRouter?: ExpressAdapter;
  private cleanupTimer?: NodeJS.Timeout;
  private started = false;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.initializeMiddleware();
    this.initializeRoutes();
    this.mountBullBoard();
    this.initializeSocket();
    this.initializeErrorHandling();
  }

  private validateEnvironment(): void {
    validateConfig();
    logger.info('Environment configuration validated successfully');
  }

  private initializeMiddleware(): void {
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));
    this.app.use(cors({
      origin: config.security.corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use(morgan('combined', { stream: logStream }));
    this.app.use(rateLimiter);
    this.app.use(requestLogger);
    logger.info('Middleware initialized successfully');
  }

  private initializeRoutes(): void {
    this.app.get('/health', async (_req: Request, res: Response) => {
      try {
        const health = await healthService.checkHealth();
        res.status(health.status === 'healthy' ? 200 : 503).json(health);
      } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({ status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    this.app.get('/health/readiness', async (_req: Request, res: Response) => {
      try {
        const ready = await healthService.checkReadiness();
        res.status(ready ? 200 : 503).json({ ready });
      } catch (error) {
        logger.error('Readiness check failed:', error);
        res.status(503).json({ ready: false });
      }
    });

    this.app.get('/health/liveness', async (_req: Request, res: Response) => {
      const alive = await healthService.checkLiveness();
      res.status(alive ? 200 : 503).json({ alive });
    });

    this.app.get('/', (_req: Request, res: Response) => {
      res.json({
        name: config.app.name,
        version: config.app.version,
        environment: config.app.env,
        timestamp: new Date().toISOString(),
        endpoints: {
          api: config.app.apiPrefix,
          health: '/health',
          readiness: '/health/readiness',
          liveness: '/health/liveness',
          queues: '/admin/queues',
        },
      });
    });

    this.app.use(config.app.apiPrefix, apiRoutes);
    logger.info('Routes initialized successfully');
  }

  private mountBullBoard(): void {
    this.app.use('/admin/queues', bullBoardAuth, (req, res, next) => {
      if (!this.bullBoardRouter) {
        return res.status(503).json({ success: false, message: 'Queue dashboard is not ready' });
      }
      return this.bullBoardRouter.getRouter()(req, res, next);
    });
  }

  private initializeSocket(): void {
    this.socketService = new SocketService(this.httpServer);
    (global as { socketService?: SocketService }).socketService = this.socketService;
    this.cleanupTimer = setInterval(() => this.socketService.cleanupInactiveDrivers(), 5 * 60 * 1000);
    this.cleanupTimer.unref();
    logger.info('Socket.IO service initialized');
  }

  private initializeErrorHandling(): void {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
    logger.info('Error handling initialized successfully');
  }

  public async start(): Promise<void> {
    if (this.started) return;

    try {
      this.validateEnvironment();
      logger.info('Starting server with dependency checks enabled');

      const [dbConnected, redisConnected] = await Promise.all([
        testDatabaseConnection(),
        testRedisConnection(),
      ]);
      if (!dbConnected) throw new Error('Failed to connect to database');
      if (!redisConnected) throw new Error('Failed to connect to Redis');

      await initializeQueues();
      this.bullBoardRouter = initializeBullBoard();

      await new Promise<void>((resolve, reject) => {
        this.httpServer.once('error', reject);
        this.httpServer.listen(config.app.port, () => {
          this.httpServer.off('error', reject);
          resolve();
        });
      });

      this.started = true;
      logger.info(`${config.app.name} started successfully`, {
        port: config.app.port,
        environment: config.app.env,
        apiPrefix: config.app.apiPrefix,
        socketIO: 'enabled',
        dependencies: 'postgresql, redis, bullmq',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      await this.stop();
      throw error;
    }
  }

  public async stop(): Promise<void> {
    logger.info('Shutting down server...');
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.socketService.disconnectAll();
    if (this.httpServer.listening) {
      await new Promise<void>((resolve, reject) => {
        this.httpServer.close(error => error ? reject(error) : resolve());
      });
      logger.info('HTTP server closed');
    }
    try {
      // BullMQ workers must release their Redis-backed locks before the shared
      // Redis clients are disconnected.
      await shutdownQueues();
    } catch (error) {
      logger.error('Queue shutdown failed', { error });
    }

    const cleanupResults = await Promise.allSettled([
      closeDatabaseConnection(),
      closeRedisConnections(),
    ]);
    for (const result of cleanupResults) {
      if (result.status === 'rejected') {
        logger.error('Shutdown step failed', { error: result.reason });
      }
    }
    this.started = false;
    logger.info('Server shutdown completed');
  }
}

const app = new RideDelivaApp();

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

process.on('uncaughtException', error => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

if (process.env.NODE_ENV !== 'test') {
  app.start().catch(error => {
    logger.error('Application startup failed:', error);
    process.exit(1);
  });
}

export { RideDelivaApp };
export default app;
