import { Ride, RideStatus, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';

export class RideRepository extends BaseRepository<Ride> {
  constructor() {
    super('ride');
  }

  // Find ride by code
  async findByCode(rideCode: string, include?: any): Promise<Ride | null> {
    return this.findFirst({ rideCode }, include);
  }

  // Get rides for customer
  async getCustomerRides(customerId: string, options: {
    status?: RideStatus[];
    page?: number;
    limit?: number;
    dateFrom?: Date;
    dateTo?: Date;
  } = {}) {
    const { status, page = 1, limit = 20, dateFrom, dateTo } = options;

    const whereClause: any = { customerId };

    if (status && status.length > 0) {
      whereClause.status = { in: status };
    }

    if (dateFrom && dateTo) {
      whereClause.createdAt = {
        gte: dateFrom,
        lte: dateTo,
      };
    }

    return this.paginate({
      where: whereClause,
      page,
      limit,
      include: {
        driver: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                profilePicture: true,
              },
            },
          },
        },
        vehicle: true,
        pickupAddress: true,
        destinationAddress: true,
        payment: true,
        reviews: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Get rides for driver
  async getDriverRides(driverId: string, options: {
    status?: RideStatus[];
    page?: number;
    limit?: number;
    dateFrom?: Date;
    dateTo?: Date;
  } = {}) {
    const { status, page = 1, limit = 20, dateFrom, dateTo } = options;

    const whereClause: any = { driverId };

    if (status && status.length > 0) {
      whereClause.status = { in: status };
    }

    if (dateFrom && dateTo) {
      whereClause.createdAt = {
        gte: dateFrom,
        lte: dateTo,
      };
    }

    return this.paginate({
      where: whereClause,
      page,
      limit,
      include: {
        customer: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                profilePicture: true,
              },
            },
          },
        },
        vehicle: true,
        pickupAddress: true,
        destinationAddress: true,
        payment: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Get active rides for driver
  async getDriverActiveRides(driverId: string): Promise<Ride[]> {
    const activeStatuses: RideStatus[] = [
      'ACCEPTED',
      'DRIVER_ARRIVING',
      'DRIVER_ARRIVED',
      'IN_PROGRESS',
    ];

    return this.findMany({
      where: {
        driverId,
        status: { in: activeStatuses },
      },
      include: {
        customer: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                phoneNumber: true,
                profilePicture: true,
              },
            },
          },
        },
        pickupAddress: true,
        destinationAddress: true,
      },
      orderBy: {
        requestedAt: 'asc',
      },
    });
  }

  // Get pending ride requests for matching
  async getPendingRideRequests(options: {
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    limit?: number;
  } = {}): Promise<Ride[]> {
    const { limit = 50 } = options;

    return this.findMany({
      where: {
        status: 'REQUESTED',
        driverId: null,
      },
      take: limit,
      include: {
        customer: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                phoneNumber: true,
              },
            },
          },
        },
        pickupAddress: true,
        destinationAddress: true,
      },
      orderBy: {
        requestedAt: 'asc',
      },
    });
  }

  // Assign driver to ride
  async assignDriver(rideId: string, driverId: string, vehicleId: string): Promise<Ride> {
    return this.update(rideId, {
      driverId,
      vehicleId,
      status: 'ACCEPTED',
      acceptedAt: new Date(),
    });
  }

  // Update ride status
  async updateStatus(rideId: string, status: RideStatus, additionalData?: any): Promise<Ride> {
    const updateData: any = { status };

    // Add timestamp based on status
    switch (status) {
      case 'ACCEPTED':
        updateData.acceptedAt = new Date();
        break;
      case 'DRIVER_ARRIVED':
        updateData.arrivedAt = new Date();
        break;
      case 'IN_PROGRESS':
        updateData.startedAt = new Date();
        break;
      case 'COMPLETED':
        updateData.completedAt = new Date();
        if (additionalData?.finalFare) {
          updateData.finalFare = additionalData.finalFare;
        }
        if (additionalData?.actualDistance) {
          updateData.actualDistance = additionalData.actualDistance;
        }
        if (additionalData?.actualDuration) {
          updateData.actualDuration = additionalData.actualDuration;
        }
        break;
      case 'CANCELLED':
        updateData.cancelledAt = new Date();
        if (additionalData?.cancellationReason) {
          updateData.cancellationReason = additionalData.cancellationReason;
        }
        break;
    }

    return this.update(rideId, updateData);
  }

  // Calculate ride statistics
  async getRideStats(options: {
    driverId?: string;
    customerId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  } = {}): Promise<{
    total: number;
    completed: number;
    cancelled: number;
    inProgress: number;
    totalRevenue: number;
    averageFare: number;
    averageRating: number;
  }> {
    const { driverId, customerId, dateFrom, dateTo } = options;

    const whereClause: any = {};

    if (driverId) whereClause.driverId = driverId;
    if (customerId) whereClause.customerId = customerId;

    if (dateFrom && dateTo) {
      whereClause.createdAt = {
        gte: dateFrom,
        lte: dateTo,
      };
    }

    const [
      total,
      completed,
      cancelled,
      inProgress,
      ridesWithFare,
      ridesWithRating,
    ] = await Promise.all([
      this.count(whereClause),
      this.count({ ...whereClause, status: 'COMPLETED' }),
      this.count({ ...whereClause, status: 'CANCELLED' }),
      this.count({
        ...whereClause,
        status: { in: ['ACCEPTED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'IN_PROGRESS'] },
      }),
      this.findMany({
        where: { ...whereClause, finalFare: { not: null } },
        select: { finalFare: true },
      }),
      this.prisma.review.findMany({
        where: {
          ride: whereClause,
        },
        select: { rating: true },
      }),
    ]);

    const totalRevenue = ridesWithFare.reduce(
      (sum, ride) => sum + (ride.finalFare?.toNumber() || 0),
      0
    );

    const averageFare = ridesWithFare.length > 0 
      ? totalRevenue / ridesWithFare.length 
      : 0;

    const averageRating = ridesWithRating.length > 0
      ? ridesWithRating.reduce((sum, review) => sum + review.rating, 0) / ridesWithRating.length
      : 0;

    return {
      total,
      completed,
      cancelled,
      inProgress,
      totalRevenue,
      averageFare,
      averageRating,
    };
  }

  // Get rides by location (within radius)
  async getRidesByLocation(
    latitude: number,
    longitude: number,
    radiusKm: number = 10,
    options: {
      status?: RideStatus[];
      dateFrom?: Date;
      dateTo?: Date;
      limit?: number;
    } = {}
  ): Promise<Ride[]> {
    const { status, dateFrom, dateTo, limit = 100 } = options;

    // This is a simplified version. In production, you'd use PostGIS functions
    // for accurate geospatial queries
    const sql = `
      SELECT r.*
      FROM rides r
      JOIN addresses pickup ON r.pickup_address_id = pickup.id
      WHERE ST_DWithin(
        ST_GeogFromText('POINT(' || $1 || ' ' || $2 || ')'),
        ST_GeogFromText('POINT(' || pickup.longitude || ' ' || pickup.latitude || ')'),
        $3 * 1000
      )
      ${status && status.length > 0 ? `AND r.status = ANY($4)` : ''}
      ${dateFrom && dateTo ? `AND r.created_at BETWEEN $${status ? 5 : 4} AND $${status ? 6 : 5}` : ''}
      ORDER BY r.created_at DESC
      LIMIT $${status && dateFrom && dateTo ? 7 : status || (dateFrom && dateTo) ? 6 : 4}
    `;

    const params: any[] = [longitude, latitude, radiusKm];
    if (status && status.length > 0) params.push(status);
    if (dateFrom && dateTo) params.push(dateFrom, dateTo);
    params.push(limit);

    const rideIds = await this.prisma.$queryRawUnsafe<{ id: string }[]>(sql, ...params);

    if (rideIds.length === 0) return [];

    return this.findMany({
      where: {
        id: { in: rideIds.map(r => r.id) },
      },
      include: {
        customer: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        driver: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        pickupAddress: true,
        destinationAddress: true,
      },
    });
  }

  // Get popular routes
  async getPopularRoutes(limit: number = 10): Promise<Array<{
    pickupCity: string;
    destinationCity: string;
    count: number;
    avgFare: number;
  }>> {
    const sql = `
      SELECT 
        pickup.city as pickup_city,
        dest.city as destination_city,
        COUNT(*) as count,
        AVG(r.final_fare) as avg_fare
      FROM rides r
      JOIN addresses pickup ON r.pickup_address_id = pickup.id
      JOIN addresses dest ON r.destination_address_id = dest.id
      WHERE r.status = 'COMPLETED'
        AND r.final_fare IS NOT NULL
      GROUP BY pickup.city, dest.city
      HAVING COUNT(*) > 5
      ORDER BY COUNT(*) DESC
      LIMIT $1
    `;

    return this.prisma.$queryRawUnsafe(sql, limit);
  }

  // Get ride completion rate
  async getCompletionRate(options: {
    driverId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  } = {}): Promise<number> {
    const { driverId, dateFrom, dateTo } = options;

    const whereClause: any = {};
    if (driverId) whereClause.driverId = driverId;
    if (dateFrom && dateTo) {
      whereClause.createdAt = { gte: dateFrom, lte: dateTo };
    }

    const [total, completed] = await Promise.all([
      this.count({ ...whereClause, status: { not: 'REQUESTED' } }),
      this.count({ ...whereClause, status: 'COMPLETED' }),
    ]);

    return total > 0 ? (completed / total) * 100 : 0;
  }

  // Get average ride duration and distance
  async getAverageMetrics(options: {
    driverId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  } = {}): Promise<{
    avgDuration: number;
    avgDistance: number;
    avgFare: number;
  }> {
    const { driverId, dateFrom, dateTo } = options;

    const whereClause: any = {
      status: 'COMPLETED',
      actualDuration: { not: null },
      actualDistance: { not: null },
      finalFare: { not: null },
    };

    if (driverId) whereClause.driverId = driverId;
    if (dateFrom && dateTo) {
      whereClause.createdAt = { gte: dateFrom, lte: dateTo };
    }

    const rides = await this.findMany({
      where: whereClause,
      select: {
        actualDuration: true,
        actualDistance: true,
        finalFare: true,
      },
    });

    if (rides.length === 0) {
      return { avgDuration: 0, avgDistance: 0, avgFare: 0 };
    }

    const avgDuration = rides.reduce((sum, ride) => sum + (ride.actualDuration || 0), 0) / rides.length;
    const avgDistance = rides.reduce((sum, ride) => sum + (ride.actualDistance?.toNumber() || 0), 0) / rides.length;
    const avgFare = rides.reduce((sum, ride) => sum + (ride.finalFare?.toNumber() || 0), 0) / rides.length;

    return { avgDuration, avgDistance, avgFare };
  }
}