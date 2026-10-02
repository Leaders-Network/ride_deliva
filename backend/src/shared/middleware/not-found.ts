import { Request, Response, NextFunction } from 'express';
import { createError } from './error-handler';

export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = createError.notFound(`Route ${req.method} ${req.originalUrl} not found`);
  next(error);
};
