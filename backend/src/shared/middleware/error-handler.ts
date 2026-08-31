import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { logger } from '@/config/logger';
import { config } from '@/config';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export class HttpError extends Error implements ApiError {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(statusCode: number, message: string, code?: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || 'HTTP_ERROR';
    this.details = details;
    this.name = 'HttpError';

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HttpError);
    }
  }
}

export const createError = {
  badRequest: (message: string = 'Bad Request', details?: any) =>
    new HttpError(400, message, 'BAD_REQUEST', details),

  unauthorized: (message: string = 'Unauthorized') =>
    new HttpError(401, message, 'UNAUTHORIZED'),

  forbidden: (message: string = 'Forbidden') =>
    new HttpError(403, message, 'FORBIDDEN'),

  notFound: (message: string = 'Resource not found') =>
    new HttpError(404, message, 'NOT_FOUND'),

  conflict: (message: string = 'Conflict', details?: any) =>
    new HttpError(409, message, 'CONFLICT', details),

  validation: (message: string = 'Validation failed', details?: any) =>
    new HttpError(422, message, 'VALIDATION_ERROR', details),

  tooManyRequests: (message: string = 'Too many requests') =>
    new HttpError(429, message, 'TOO_MANY_REQUESTS'),

  internal: (message: string = 'Internal server error', details?: any) =>
    new HttpError(500, message, 'INTERNAL_ERROR', details),

  serviceUnavailable: (message: string = 'Service unavailable') =>
    new HttpError(503, message, 'SERVICE_UNAVAILABLE'),
};

const handlePrismaError = (error: Prisma.PrismaClientKnownRequestError): ApiError => {
  switch (error.code) {
    case 'P2002':
      // Unique constraint failed
      const field = error.meta?.target as string[];
      return createError.conflict(
        `A record with this ${field?.join(', ')} already exists`,
        { field, constraint: 'unique' }
      );

    case 'P2014':
      // Required relation violation
      return createError.badRequest('Invalid relation data provided');

    case 'P2003':
      // Foreign key constraint failed
      return createError.badRequest('Referenced record does not exist');

    case 'P2025':
      // Record not found
      return createError.notFound('Record not found');

    case 'P2016':
      // Query interpretation error
      return createError.badRequest('Invalid query parameters');

    case 'P2021':
      // Table does not exist
      return createError.internal('Database table not found');

    default:
      logger.error('Unhandled Prisma error:', { code: error.code, message: error.message });
      return createError.internal('Database operation failed');
  }
};

const handleValidationError = (error: any): ApiError => {
  if (error.details) {
    // Joi validation error
    const validationDetails = error.details.map((detail: any) => ({
      field: detail.path?.join('.'),
      message: detail.message,
      value: detail.context?.value,
    }));

    return createError.validation('Validation failed', validationDetails);
  }

  // Express-validator errors
  if (Array.isArray(error)) {
    const validationDetails = error.map((err: any) => ({
      field: err.param,
      message: err.msg,
      value: err.value,
    }));

    return createError.validation('Validation failed', validationDetails);
  }

  return createError.badRequest('Invalid input data');
};

export const errorHandler = (
  error: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let apiError: ApiError;

  // Handle different types of errors
  if (error instanceof HttpError) {
    apiError = error;
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    apiError = handlePrismaError(error);
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    apiError = createError.badRequest('Invalid data format');
  } else if (error.name === 'ValidationError') {
    apiError = handleValidationError(error);
  } else if (error.name === 'JsonWebTokenError') {
    apiError = createError.unauthorized('Invalid token');
  } else if (error.name === 'TokenExpiredError') {
    apiError = createError.unauthorized('Token expired');
  } else if (error.name === 'MulterError') {
    apiError = createError.badRequest('File upload error');
  } else if (error.name === 'SyntaxError' && 'body' in error) {
    apiError = createError.badRequest('Invalid JSON format');
  } else {
    // Unknown error
    apiError = createError.internal('An unexpected error occurred');
  }

  // Log error details
  const logLevel = apiError.statusCode >= 500 ? 'error' : 'warn';
  const logData = {
    error: {
      name: error.name,
      message: error.message,
      code: apiError.code,
      statusCode: apiError.statusCode,
      stack: config.app.env === 'development' ? error.stack : undefined,
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id,
    },
  };

  logger[logLevel]('API Error:', logData);

  // Prepare error response
  const errorResponse: any = {
    error: {
      code: apiError.code,
      message: apiError.message,
      statusCode: apiError.statusCode,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    },
  };

  // Add details in development mode or for validation errors
  if (config.app.env === 'development' || apiError.statusCode === 422) {
    errorResponse.error.details = apiError.details;
  }

  // Add stack trace in development mode
  if (config.app.env === 'development') {
    errorResponse.error.stack = error.stack;
  }

  // Add request ID if available
  const requestId = (req as any).id;
  if (requestId) {
    errorResponse.error.requestId = requestId;
  }

  res.status(apiError.statusCode).json(errorResponse);
};

// Async error wrapper
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};