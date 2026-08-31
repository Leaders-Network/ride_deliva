import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
  timestamp: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  total: number;
}

export class ResponseUtil {
  static success<T>(
    res: Response,
    data?: T,
    message: string = 'Success',
    statusCode: number = 200,
    meta?: any
  ): Response<ApiResponse<T>> {
    const response: ApiResponse<T> = {
      success: true,
      message,
      data,
      meta,
      timestamp: new Date().toISOString(),
    };

    return res.status(statusCode).json(response);
  }

  static created<T>(
    res: Response,
    data?: T,
    message: string = 'Resource created successfully'
  ): Response<ApiResponse<T>> {
    return this.success(res, data, message, 201);
  }

  static paginated<T>(
    res: Response,
    data: T[],
    pagination: PaginationOptions,
    message: string = 'Data retrieved successfully'
  ): Response<ApiResponse<T[]>> {
    const { page, limit, total } = pagination;
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    const meta = {
      page,
      limit,
      total,
      totalPages,
      hasNext,
      hasPrev,
    };

    return this.success(res, data, message, 200, meta);
  }

  static noContent(res: Response, message: string = 'No content'): Response {
    return res.status(204).json({
      success: true,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}

// Utility functions for common response patterns
export const sendSuccess = <T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode?: number,
  meta?: any
) => ResponseUtil.success(res, data, message, statusCode, meta);

export const sendCreated = <T>(res: Response, data?: T, message?: string) =>
  ResponseUtil.created(res, data, message);

export const sendPaginated = <T>(
  res: Response,
  data: T[],
  pagination: PaginationOptions,
  message?: string
) => ResponseUtil.paginated(res, data, pagination, message);

export const sendNoContent = (res: Response, message?: string) =>
  ResponseUtil.noContent(res, message);