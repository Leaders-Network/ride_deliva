import { Request } from 'express';
import { User } from '../../generated/prisma';

// Extend Express Request interface  
export interface AuthenticatedRequest extends Request {
  user?: User & {
    customerProfile?: any;
    driverProfile?: any;
    adminProfile?: any;
  };
}

// Pagination types
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Location types
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Address {
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  coordinates: Coordinates;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  meta?: any;
  timestamp: string;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: any;
    timestamp: string;
    path?: string;
  };
}

// Authentication types
export interface LoginCredentials {
  phoneNumber: string;
  password?: string;
  verificationCode?: string;
}

export interface RegisterData {
  phoneNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
  password?: string;
  role: 'CUSTOMER' | 'DRIVER';
}

export interface TokenPayload {
  userId: string;
  phoneNumber: string;
  role: string;
  sessionId: string;
  iat: number;
  exp: number;
}

// Ride types
export interface RideRequest {
  customerId: string;
  pickupLocation: Address;
  destinationLocation: Address;
  rideType: 'STANDARD' | 'PREMIUM' | 'SHARED';
  passengerCount: number;
  scheduledAt?: Date;
  notes?: string;
}

export interface RideResponse {
  id: string;
  rideCode: string;
  status: string;
  estimatedFare: number;
  estimatedDuration: number;
  estimatedDistance: number;
  driver?: {
    id: string;
    name: string;
    rating: number;
    vehicle: {
      make: string;
      model: string;
      color: string;
      licensePlate: string;
    };
  };
}

// Delivery types
export interface DeliveryRequest {
  customerId: string;
  pickupLocation: Address;
  destinationLocation: Address;
  packageDetails: {
    description: string;
    weight: number;
    dimensions: {
      length: number;
      width: number;
      height: number;
    };
  };
  senderInfo: {
    name: string;
    phoneNumber: string;
  };
  recipientInfo: {
    name: string;
    phoneNumber: string;
  };
  deliveryType: 'STANDARD' | 'EXPRESS' | 'SCHEDULED';
  scheduledPickupAt?: Date;
  scheduledDeliveryAt?: Date;
  specialInstructions?: string;
}

// Driver types
export interface DriverLocation {
  driverId: string;
  coordinates: Coordinates;
  heading?: number;
  speed?: number;
  accuracy?: number;
  timestamp: Date;
}

export interface DriverProfile {
  id: string;
  userId: string;
  licenseNumber: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  isOnline: boolean;
  isAvailable: boolean;
  rating: number;
  totalRides: number;
  vehicles: VehicleInfo[];
}

export interface VehicleInfo {
  id: string;
  type: string;
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  capacity: any;
  isActive: boolean;
}

// Payment types
export interface PaymentMethod {
  id: string;
  type: 'CARD' | 'BANK_TRANSFER' | 'WALLET';
  details: any;
  isDefault: boolean;
}

export interface WalletBalance {
  balance: number;
  currency: string;
  lastUpdated: Date;
}

// Notification types
export interface NotificationData {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: any;
}

// WebSocket types
export interface SocketData {
  userId: string;
  role: 'CUSTOMER' | 'DRIVER' | 'ADMIN';
  sessionId: string;
}

// Queue Job types
export interface EmailJobData {
  to: string;
  subject: string;
  template: string;
  data: any;
}

export interface SMSJobData {
  to: string;
  message: string;
  type: 'VERIFICATION' | 'NOTIFICATION' | 'PROMOTIONAL';
}

export interface PushNotificationJobData {
  userId: string;
  title: string;
  body: string;
  data?: any;
}

// File Upload types
export interface FileUploadResult {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  path: string;
}

// Search and Filter types
export interface SearchFilters {
  query?: string;
  status?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  location?: {
    coordinates: Coordinates;
    radius: number;
  };
}

// Analytics types
export interface DashboardMetrics {
  totalRides: number;
  totalDeliveries: number;
  activeDrivers: number;
  revenue: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  averageRating: number;
}

// System Health types
export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    application: ApplicationHealth;
  };
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy';
  latency?: number;
  error?: string;
}

export interface ApplicationHealth {
  status: 'healthy';
  uptime: number;
  memory: {
    used: number;
    free: number;
    total: number;
  };
}
