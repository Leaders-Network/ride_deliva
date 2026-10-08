import { PrismaClient, Prisma } from '@/generated/prisma';
import prisma from '@/config/database';
import { logger } from '@/config/logger';

export abstract class BaseRepository<T extends { id: string } = { id: string }> {
  protected prisma: PrismaClient;
  protected modelName: string;

  constructor(modelName: string) {
    this.prisma = prisma;
    this.modelName = modelName;
  }

  // Get the Prisma model
  protected get model() {
    return (this.prisma as any)[this.modelName];
  }

  // Generic CRUD operations
  async create(data: any, include?: any): Promise<T> {
    try {
      const result = await this.model.create({
        data,
        include,
      });
      logger.debug(`Created ${this.modelName}`, { id: result.id });
      return result;
    } catch (error) {
      logger.error(`Failed to create ${this.modelName}:`, error);
      throw error;
    }
  }

  async findById(id: string, include?: any): Promise<T | null> {
    try {
      return await this.model.findUnique({
        where: { id },
        include,
      });
    } catch (error) {
      logger.error(`Failed to find ${this.modelName} by id:`, error);
      throw error;
    }
  }

  async findFirst(where: any, include?: any): Promise<T | null> {
    try {
      return await this.model.findFirst({
        where,
        include,
      });
    } catch (error) {
      logger.error(`Failed to find first ${this.modelName}:`, error);
      throw error;
    }
  }

  async findMany(options: {
    where?: any;
    include?: any;
    select?: { [K in keyof T]?: boolean };
    orderBy?: any;
    skip?: number;
    take?: number;
  } = {}): Promise<T[]> {
    try {
      return await this.model.findMany(options);
    } catch (error) {
      logger.error(`Failed to find many ${this.modelName}:`, error);
      throw error;
    }
  }

  async update(id: string, data: any, include?: any): Promise<T> {
    try {
      const result = await this.model.update({
        where: { id },
        data,
        include,
      });
      logger.debug(`Updated ${this.modelName}`, { id });
      return result;
    } catch (error) {
      logger.error(`Failed to update ${this.modelName}:`, error);
      throw error;
    }
  }

  async updateMany(where: any, data: any): Promise<{ count: number }> {
    try {
      const result = await this.model.updateMany({
        where,
        data,
      });
      logger.debug(`Updated many ${this.modelName}`, { count: result.count });
      return result;
    } catch (error) {
      logger.error(`Failed to update many ${this.modelName}:`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<T> {
    try {
      const result = await this.model.delete({
        where: { id },
      });
      logger.debug(`Deleted ${this.modelName}`, { id });
      return result;
    } catch (error) {
      logger.error(`Failed to delete ${this.modelName}:`, error);
      throw error;
    }
  }

  async deleteMany(where: any): Promise<{ count: number }> {
    try {
      const result = await this.model.deleteMany({
        where,
      });
      logger.debug(`Deleted many ${this.modelName}`, { count: result.count });
      return result;
    } catch (error) {
      logger.error(`Failed to delete many ${this.modelName}:`, error);
      throw error;
    }
  }

  async count(where?: any): Promise<number> {
    try {
      return await this.model.count({ where });
    } catch (error) {
      logger.error(`Failed to count ${this.modelName}:`, error);
      throw error;
    }
  }

  async exists(where: any): Promise<boolean> {
    try {
      const count = await this.model.count({
        where,
        take: 1,
      });
      return count > 0;
    } catch (error) {
      logger.error(`Failed to check existence of ${this.modelName}:`, error);
      throw error;
    }
  }

  // Pagination helper
  async paginate(options: {
    where?: any;
    include?: any;
    select?: { [K in keyof T]?: boolean };
    orderBy?: any;
    page: number;
    limit: number;
  }): Promise<{
    data: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const { page, limit, where, include, orderBy } = options;
    const skip = (page - 1) * limit;

    try {
      const [data, total] = await Promise.all([
        this.findMany({
          where,
          include,
          orderBy,
          skip,
          take: limit,
        }),
        this.count(where),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error(`Failed to paginate ${this.modelName}:`, error);
      throw error;
    }
  }

  // Bulk operations
  async createMany(data: any[], skipDuplicates: boolean = true): Promise<{ count: number }> {
    try {
      const result = await this.model.createMany({
        data,
        skipDuplicates,
      });
      logger.debug(`Bulk created ${this.modelName}`, { count: result.count });
      return result;
    } catch (error) {
      logger.error(`Failed to bulk create ${this.modelName}:`, error);
      throw error;
    }
  }

  // Soft delete (if model has deletedAt field)
  async softDelete(id: string): Promise<T> {
    try {
      const result = await this.update(id, {
        deletedAt: new Date(),
      });
      logger.debug(`Soft deleted ${this.modelName}`, { id });
      return result;
    } catch (error) {
      logger.error(`Failed to soft delete ${this.modelName}:`, error);
      throw error;
    }
  }

  // Restore soft deleted record
  async restore(id: string): Promise<T> {
    try {
      const result = await this.update(id, {
        deletedAt: null,
      });
      logger.debug(`Restored ${this.modelName}`, { id });
      return result;
    } catch (error) {
      logger.error(`Failed to restore ${this.modelName}:`, error);
      throw error;
    }
  }

  // Find with soft delete filter
  async findManyWithDeleted(options: {
    where?: any;
    include?: any;
    select?: { [K in keyof T]?: boolean };
    orderBy?: any;
    skip?: number;
    take?: number;
    includeDeleted?: boolean;
  } = {}): Promise<T[]> {
    const { includeDeleted = false, where = {}, ...restOptions } = options;

    const whereClause = includeDeleted
      ? where
      : { ...where, deletedAt: null };

    return this.findMany({
      where: whereClause,
      ...restOptions,
    });
  }

  // Transaction wrapper
  async transaction<R>(
    fn: (prisma: Prisma.TransactionClient) => Promise<R>
  ): Promise<R> {
    try {
      return await this.prisma.$transaction(fn);
    } catch (error) {
      logger.error(`Transaction failed for ${this.modelName}:`, error);
      throw error;
    }
  }

  // Search helper (requires implementing in child classes)
  async search(query: string, options?: any): Promise<T[]> {
    throw new Error(`Search method not implemented for ${this.modelName}`);
  }

  // Batch operations with transaction
  async batchCreate(data: any[]): Promise<T[]> {
    return this.transaction(async (prisma) => {
      const results: T[] = [];
      for (const item of data) {
        const result = await (prisma as any)[this.modelName].create({
          data: item,
        });
        results.push(result);
      }
      return results;
    });
  }

  async batchUpdate(updates: Array<{ id: string; data: any }>): Promise<T[]> {
    return this.transaction(async (prisma) => {
      const results: T[] = [];
      for (const { id, data } of updates) {
        const result = await (prisma as any)[this.modelName].update({
          where: { id },
          data,
        });
        results.push(result);
      }
      return results;
    });
  }

  async batchDelete(ids: string[]): Promise<{ count: number }> {
    return this.transaction(async (prisma) => {
      const result = await (prisma as any)[this.modelName].deleteMany({
        where: {
          id: {
            in: ids,
          },
        },
      });
      return result;
    });
  }

  // Utility methods for common operations
  async getOrCreate(
    where: any,
    defaults: any,
    include?: any
  ): Promise<{ data: T; created: boolean }> {
    try {
      const existing = await this.findFirst(where, include);
      if (existing) {
        return { data: existing, created: false };
      }

      const created = await this.create({ ...where, ...defaults }, include);
      return { data: created, created: true };
    } catch (error) {
      logger.error(`Failed to get or create ${this.modelName}:`, error);
      throw error;
    }
  }

  async updateOrCreate(
    where: any,
    data: any,
    include?: any
  ): Promise<{ data: T; created: boolean }> {
    try {
      const existing = await this.findFirst(where);
      if (existing) {
        const updated = await this.update(existing.id, data, include);
        return { data: updated, created: false };
      }

      const created = await this.create({ ...where, ...data }, include);
      return { data: created, created: true };
    } catch (error) {
      logger.error(`Failed to update or create ${this.modelName}:`, error);
      throw error;
    }
  }

  // Get statistics
  async getStats(dateFrom?: Date, dateTo?: Date): Promise<any> {
    const whereClause: any = {};
    
    if (dateFrom && dateTo) {
      whereClause.createdAt = {
        gte: dateFrom,
        lte: dateTo,
      };
    }

    try {
      const [total, recent] = await Promise.all([
        this.count(),
        this.count(whereClause),
      ]);

      return {
        total,
        recent,
        period: dateFrom && dateTo ? { from: dateFrom, to: dateTo } : null,
      };
    } catch (error) {
      logger.error(`Failed to get stats for ${this.modelName}:`, error);
      throw error;
    }
  }
}
