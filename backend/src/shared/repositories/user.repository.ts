import { User, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { sanitize } from '@/shared/utils/validation';

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super('user');
  }

  // Find user by phone number
  async findByPhoneNumber(phoneNumber: string, include?: any): Promise<User | null> {
    const sanitizedPhone = sanitize.phoneNumber(phoneNumber);
    return this.findFirst({ phoneNumber: sanitizedPhone }, include);
  }

  // Find user by email
  async findByEmail(email: string, include?: any): Promise<User | null> {
    const sanitizedEmail = sanitize.email(email);
    return this.findFirst({ email: sanitizedEmail }, include);
  }

  // Create user with sanitized data
  async createUser(userData: {
    phoneNumber: string;
    email?: string;
    firstName: string;
    lastName: string;
    passwordHash?: string;
    profileType: 'customer' | 'driver' | 'admin';
    profileData?: any;
  }): Promise<User> {
    const { profileType, profileData, ...userBasicData } = userData;

    // Sanitize input data
    const sanitizedData = {
      ...userBasicData,
      phoneNumber: sanitize.phoneNumber(userBasicData.phoneNumber),
      email: userBasicData.email ? sanitize.email(userBasicData.email) : undefined,
      firstName: sanitize.name(userBasicData.firstName),
      lastName: sanitize.name(userBasicData.lastName),
    };

    // Prepare create data with profile
    const createData: any = {
      ...sanitizedData,
    };

    // Add profile based on type
    switch (profileType) {
      case 'customer':
        createData.customerProfile = {
          create: {
            ...profileData,
          },
        };
        break;
      case 'driver':
        createData.driverProfile = {
          create: {
            ...profileData,
          },
        };
        break;
      case 'admin':
        createData.adminProfile = {
          create: {
            ...profileData,
          },
        };
        break;
    }

    const include = {
      customerProfile: true,
      driverProfile: true,
      adminProfile: true,
    };

    return this.create(createData, include);
  }

  // Update user profile
  async updateProfile(userId: string, updates: {
    firstName?: string;
    lastName?: string;
    email?: string;
    profilePicture?: string;
    dateOfBirth?: Date;
    gender?: string;
  }): Promise<User> {
    const sanitizedUpdates: any = {};

    if (updates.firstName) {
      sanitizedUpdates.firstName = sanitize.name(updates.firstName);
    }
    if (updates.lastName) {
      sanitizedUpdates.lastName = sanitize.name(updates.lastName);
    }
    if (updates.email) {
      sanitizedUpdates.email = sanitize.email(updates.email);
    }
    if (updates.profilePicture) {
      sanitizedUpdates.profilePicture = updates.profilePicture;
    }
    if (updates.dateOfBirth) {
      sanitizedUpdates.dateOfBirth = updates.dateOfBirth;
    }
    if (updates.gender) {
      sanitizedUpdates.gender = updates.gender;
    }

    return this.update(userId, sanitizedUpdates);
  }

  // Verify user phone/email
  async markPhoneVerified(userId: string): Promise<User> {
    return this.update(userId, {
      isVerified: true,
      phoneVerifiedAt: new Date(),
    });
  }

  async markEmailVerified(userId: string): Promise<User> {
    return this.update(userId, {
      emailVerifiedAt: new Date(),
    });
  }

  // Search users
  async search(query: string, options: {
    limit?: number;
    includeInactive?: boolean;
    userType?: 'customer' | 'driver' | 'admin';
  } = {}): Promise<User[]> {
    const { limit = 20, includeInactive = false, userType } = options;

    const whereClause: any = {
      OR: [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        { phoneNumber: { contains: query } },
      ],
    };

    if (!includeInactive) {
      whereClause.isActive = true;
    }

    // Add profile type filter
    if (userType === 'customer') {
      whereClause.customerProfile = { isNot: null };
    } else if (userType === 'driver') {
      whereClause.driverProfile = { isNot: null };
    } else if (userType === 'admin') {
      whereClause.adminProfile = { isNot: null };
    }

    return this.findMany({
      where: whereClause,
      take: limit,
      include: {
        customerProfile: true,
        driverProfile: true,
        adminProfile: true,
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' },
      ],
    });
  }

  // Get user with all related data
  async getUserWithProfiles(userId: string): Promise<User | null> {
    return this.findById(userId, {
      customerProfile: {
        include: {
          wallet: true,
        },
      },
      driverProfile: {
        include: {
          vehicles: true,
          wallet: true,
        },
      },
      adminProfile: true,
      addresses: true,
      sessions: {
        where: {
          isActive: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    });
  }

  // Get users by role
  async getUsersByRole(role: 'customer' | 'driver' | 'admin', options: {
    isActive?: boolean;
    isVerified?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<User[]> {
    const { isActive = true, isVerified, limit, offset } = options;

    const whereClause: any = { isActive };

    if (isVerified !== undefined) {
      whereClause.isVerified = isVerified;
    }

    // Add role-specific conditions
    if (role === 'customer') {
      whereClause.customerProfile = { isNot: null };
    } else if (role === 'driver') {
      whereClause.driverProfile = { isNot: null };
    } else if (role === 'admin') {
      whereClause.adminProfile = { isNot: null };
    }

    return this.findMany({
      where: whereClause,
      take: limit,
      skip: offset,
      include: {
        customerProfile: role === 'customer',
        driverProfile: role === 'driver',
        adminProfile: role === 'admin',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Deactivate user account
  async deactivateUser(userId: string, reason?: string): Promise<User> {
    return this.update(userId, {
      isActive: false,
      // You might want to add a deactivation reason field to the schema
    });
  }

  // Reactivate user account
  async reactivateUser(userId: string): Promise<User> {
    return this.update(userId, {
      isActive: true,
    });
  }

  // Get user statistics
  async getUserStats(dateFrom?: Date, dateTo?: Date): Promise<{
    total: number;
    active: number;
    verified: number;
    customers: number;
    drivers: number;
    recent: number;
  }> {
    const baseStats = await this.getStats(dateFrom, dateTo);

    const [active, verified, customers, drivers] = await Promise.all([
      this.count({ isActive: true }),
      this.count({ isVerified: true }),
      this.count({ customerProfile: { isNot: null } }),
      this.count({ driverProfile: { isNot: null } }),
    ]);

    return {
      ...baseStats,
      active,
      verified,
      customers,
      drivers,
    };
  }

  // Check if phone number exists
  async phoneNumberExists(phoneNumber: string): Promise<boolean> {
    const sanitizedPhone = sanitize.phoneNumber(phoneNumber);
    return this.exists({ phoneNumber: sanitizedPhone });
  }

  // Check if email exists
  async emailExists(email: string): Promise<boolean> {
    const sanitizedEmail = sanitize.email(email);
    return this.exists({ email: sanitizedEmail });
  }

  // Get recently registered users
  async getRecentlyRegistered(days: number = 7, limit: number = 10): Promise<User[]> {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    return this.findMany({
      where: {
        createdAt: {
          gte: dateFrom,
        },
      },
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        customerProfile: true,
        driverProfile: true,
      },
    });
  }

  // Update user password
  async updatePassword(userId: string, passwordHash: string): Promise<User> {
    return this.update(userId, { passwordHash });
  }

  // Get users for admin dashboard
  async getAdminUserList(options: {
    page: number;
    limit: number;
    search?: string;
    role?: 'customer' | 'driver' | 'admin';
    isActive?: boolean;
    isVerified?: boolean;
  }) {
    const { page, limit, search, role, isActive, isVerified } = options;

    const whereClause: any = {};

    if (search) {
      whereClause.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
      ];
    }

    if (isActive !== undefined) {
      whereClause.isActive = isActive;
    }

    if (isVerified !== undefined) {
      whereClause.isVerified = isVerified;
    }

    if (role === 'customer') {
      whereClause.customerProfile = { isNot: null };
    } else if (role === 'driver') {
      whereClause.driverProfile = { isNot: null };
    } else if (role === 'admin') {
      whereClause.adminProfile = { isNot: null };
    }

    return this.paginate({
      where: whereClause,
      page,
      limit,
      include: {
        customerProfile: true,
        driverProfile: true,
        adminProfile: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}