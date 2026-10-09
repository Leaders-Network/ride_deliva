import { PrismaClient, Prisma } from '@/generated/prisma';
import { logger } from '@/config/logger';
import prisma from '@/config/database';

export interface NearbyDriver {
  id: string;
  driverId: string;
  firstName: string;
  lastName: string;
  phone: string;
  averageRating: number;
  vehicleType: string;
  distance: number;
}

export class DatabaseService {
  private client: PrismaClient;

  constructor() {
    this.client = prisma;
  }

  // Generic CRUD operations
  async create<T>(model: string, data: any): Promise<T> {
    try {
      const result = await (this.client as any)[model].create({ data });
      logger.debug(`Created ${model}`, { id: result.id });
      return result;
    } catch (error) {
      logger.error(`Failed to create ${model}:`, error);
      throw error;
    }
  }

  async findById<T>(model: string, id: string, include?: any): Promise<T | null> {
    try {
      const result = await (this.client as any)[model].findUnique({
        where: { id },
        include,
      });
      return result;
    } catch (error) {
      logger.error(`Failed to find ${model} by id:`, error);
      throw error;
    }
  }

  async findMany<T>(
    model: string,
    options: {
      where?: any;
      include?: any;
      orderBy?: any;
      skip?: number;
      take?: number;
    } = {}
  ): Promise<T[]> {
    try {
      const result = await (this.client as any)[model].findMany(options);
      return result;
    } catch (error) {
      logger.error(`Failed to find many ${model}:`, error);
      throw error;
    }
  }

  async findFirst<T>(
    model: string,
    options: {
      where?: any;
      include?: any;
      orderBy?: any;
    } = {}
  ): Promise<T | null> {
    try {
      const result = await (this.client as any)[model].findFirst(options);
      return result;
    } catch (error) {
      logger.error(`Failed to find first ${model}:`, error);
      throw error;
    }
  }

  async update<T>(model: string, id: string, data: any, include?: any): Promise<T> {
    try {
      const result = await (this.client as any)[model].update({
        where: { id },
        data,
        include,
      });
      logger.debug(`Updated ${model}`, { id });
      return result;
    } catch (error) {
      logger.error(`Failed to update ${model}:`, error);
      throw error;
    }
  }

  async delete<T>(model: string, id: string): Promise<T> {
    try {
      const result = await (this.client as any)[model].delete({
        where: { id },
      });
      logger.debug(`Deleted ${model}`, { id });
      return result;
    } catch (error) {
      logger.error(`Failed to delete ${model}:`, error);
      throw error;
    }
  }

  async count(model: string, where?: any): Promise<number> {
    try {
      const result = await (this.client as any)[model].count({ where });
      return result;
    } catch (error) {
      logger.error(`Failed to count ${model}:`, error);
      throw error;
    }
  }

  // Pagination helper
  async paginate<T>(
    model: string,
    options: {
      where?: any;
      include?: any;
      orderBy?: any;
      page: number;
      limit: number;
    }
  ): Promise<{
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
    const { page, limit, ...queryOptions } = options;
    const skip = (page - 1) * limit;

    try {
      const [data, total] = await Promise.all([
        this.findMany<T>(model, {
          ...queryOptions,
          skip,
          take: limit,
        }),
        this.count(model, queryOptions.where),
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
      logger.error(`Failed to paginate ${model}:`, error);
      throw error;
    }
  }

  // Transaction wrapper
  async transaction<T>(fn: (prisma: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      const result = await this.client.$transaction(fn);
      logger.debug('Transaction completed successfully');
      return result;
    } catch (error) {
      logger.error('Transaction failed:', error);
      throw error;
    }
  }

  // Raw query execution
  async executeRaw(sql: string, values: any[] = []): Promise<any> {
    try {
      const result = await this.client.$executeRawUnsafe(sql, ...values);
      logger.debug('Raw query executed', { sql, affectedRows: result });
      return result;
    } catch (error) {
      logger.error('Raw query execution failed:', error);
      throw error;
    }
  }

  async queryRaw<T = any>(sql: string, values: any[] = []): Promise<T[]> {
    try {
      const result = await this.client.$queryRawUnsafe(sql, ...values);
      logger.debug('Raw query executed', { sql, rowCount: (result as any[]).length });
      return result as T[];
    } catch (error) {
      logger.error('Raw query execution failed:', error);
      throw error;
    }
  }

  // Geospatial query helpers
  async findNearbyDrivers(
    latitude: number,
    longitude: number,
    radiusMeters: number = 5000,
    vehicleTypes: string[] = []
  ): Promise<NearbyDriver[]> {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || !Number.isFinite(radiusMeters) || radiusMeters <= 0) {
      throw new Error('Invalid nearby-driver coordinates or radius');
    }
    return this.queryRaw<NearbyDriver>(`
      SELECT u.id, dp.id AS "driverId", u.first_name AS "firstName",
        u.last_name AS "lastName", u.phone_number AS phone,
        dp.rating::float8 AS "averageRating", v.type AS "vehicleType",
        ST_Distance(ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
          ST_SetSRID(ST_MakePoint(dl.longitude::float8, dl.latitude::float8), 4326)::geography) AS distance
      FROM driver_profiles dp
      JOIN users u ON u.id = dp.user_id
      JOIN driver_locations dl ON dl.driver_id = dp.id
      JOIN LATERAL (SELECT type FROM vehicles WHERE driver_id = dp.id AND is_active = true
        AND (cardinality($4::text[]) = 0 OR type::text = ANY($4::text[])) LIMIT 1) v ON true
      WHERE u.is_active = true AND dp.status = 'APPROVED'
        AND dp.is_online = true AND dp.is_available = true
        AND ST_DWithin(ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
          ST_SetSRID(ST_MakePoint(dl.longitude::float8, dl.latitude::float8), 4326)::geography, $3)
      ORDER BY distance ASC, dp.rating DESC LIMIT 20
    `, [latitude, longitude, radiusMeters, vehicleTypes]);
  }

  async calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): Promise<number> {
    const sql = `
      SELECT calculate_distance($1, $2, $3, $4) as distance;
    `;

    const result = await this.queryRaw<{ distance: number }>(sql, [lat1, lon1, lat2, lon2]);
    return result[0]?.distance || 0;
  }

  async updateDriverLocation(
    driverId: string,
    latitude: number,
    longitude: number
  ): Promise<void> {
    const sql = `
      INSERT INTO driver_locations (id, driver_id, latitude, longitude, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, NOW())
      ON CONFLICT (driver_id)
      DO UPDATE SET
        latitude = $2,
        longitude = $3,
        updated_at = NOW();
    `;

    await this.executeRaw(sql, [driverId, latitude, longitude]);
  }

  // Soft delete helper
  async softDelete(model: string, id: string): Promise<any> {
    return this.update(model, id, { deletedAt: new Date() });
  }

  // Bulk operations
  async bulkCreate<T>(model: string, data: any[]): Promise<{ count: number }> {
    try {
      const result = await (this.client as any)[model].createMany({
        data,
        skipDuplicates: true,
      });
      logger.debug(`Bulk created ${model}`, { count: result.count });
      return result;
    } catch (error) {
      logger.error(`Failed to bulk create ${model}:`, error);
      throw error;
    }
  }

  async bulkUpdate(model: string, where: any, data: any): Promise<{ count: number }> {
    try {
      const result = await (this.client as any)[model].updateMany({
        where,
        data,
      });
      logger.debug(`Bulk updated ${model}`, { count: result.count });
      return result;
    } catch (error) {
      logger.error(`Failed to bulk update ${model}:`, error);
      throw error;
    }
  }

  async bulkDelete(model: string, where: any): Promise<{ count: number }> {
    try {
      const result = await (this.client as any)[model].deleteMany({ where });
      logger.debug(`Bulk deleted ${model}`, { count: result.count });
      return result;
    } catch (error) {
      logger.error(`Failed to bulk delete ${model}:`, error);
      throw error;
    }
  }

  // Search helper with full-text search
  async searchUsers(query: string, limit: number = 20): Promise<any[]> {
    const sql = `
      SELECT id, first_name, last_name, phone_number, email
      FROM users
      WHERE 
        to_tsvector('english', first_name || ' ' || last_name || ' ' || COALESCE(email, '')) 
        @@ plainto_tsquery('english', $1)
        OR first_name ILIKE $2
        OR last_name ILIKE $2
        OR phone_number LIKE $3
        OR email ILIKE $2
      LIMIT $4;
    `;

    return this.queryRaw(sql, [
      query,
      `%${query}%`,
      `%${query}%`,
      limit,
    ]);
  }

  // Analytics helpers
  async getRideStats(dateFrom?: Date, dateTo?: Date): Promise<any> {
    const whereClause = dateFrom && dateTo 
      ? `WHERE created_at BETWEEN $1 AND $2`
      : '';
    
    const sql = `
      SELECT 
        COUNT(*) as total_rides,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_rides,
        COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_rides,
        AVG(CASE WHEN final_fare IS NOT NULL THEN final_fare END) as avg_fare,
        SUM(CASE WHEN final_fare IS NOT NULL THEN final_fare ELSE 0 END) as total_revenue
      FROM rides
      ${whereClause};
    `;

    const params = dateFrom && dateTo ? [dateFrom, dateTo] : [];
    const result = await this.queryRaw(sql, params);
    return result[0];
  }

  async getDriverStats(driverId: string, dateFrom?: Date, dateTo?: Date): Promise<any> {
    const whereClause = dateFrom && dateTo 
      ? `AND created_at BETWEEN $2 AND $3`
      : '';
    
    const sql = `
      SELECT 
        COUNT(*) as total_rides,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_rides,
        AVG(CASE WHEN final_fare IS NOT NULL THEN final_fare END) as avg_fare,
        SUM(CASE WHEN final_fare IS NOT NULL THEN final_fare ELSE 0 END) as total_earnings
      FROM rides
      WHERE driver_id = $1 ${whereClause};
    `;

    const params = dateFrom && dateTo 
      ? [driverId, dateFrom, dateTo] 
      : [driverId];
    
    const result = await this.queryRaw(sql, params);
    return result[0];
  }
}

// Export singleton instance
export const dbService = new DatabaseService();
