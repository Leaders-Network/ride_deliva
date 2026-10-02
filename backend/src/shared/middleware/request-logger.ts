import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/config/logger';

// Extend Request interface to include custom properties
declare global {
  namespace Express {
    interface Request {
      id: string;
      startTime: number;
    }
  }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Generate unique request ID
  req.id = uuidv4();
  req.startTime = Date.now();

  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.id);

  // Log request start
  logger.info('Request started', {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    timestamp: new Date().toISOString(),
  });

  // Override res.json to log response
  const originalJson = res.json.bind(res);
  res.json = function(body: any) {
    const duration = Date.now() - req.startTime;

    // Log response
    logger.info('Request completed', {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length'),
      userId: (req as any).user?.id,
      timestamp: new Date().toISOString(),
    });

    return originalJson(body);
  };

  // Override res.send to log response for non-JSON responses
  const originalSend = res.send.bind(res);
  res.send = function(body: any) {
    const duration = Date.now() - req.startTime;

    // Only log if json hasn't been called (to avoid double logging)
    if (!res.headersSent || !res.get('Content-Type')?.includes('application/json')) {
      logger.info('Request completed', {
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        contentLength: res.get('Content-Length'),
        userId: (req as any).user?.id,
        timestamp: new Date().toISOString(),
      });
    }

    return originalSend(body);
  };

  next();
};
