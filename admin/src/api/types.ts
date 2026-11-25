// Prisma Decimals arrive as strings over JSON; format.ts converts them for display.
type Decimal = string | number;

export type DriverStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'INACTIVE';
export type RideStatus = 'REQUESTED' | 'ACCEPTED' | 'DRIVER_ARRIVING' | 'DRIVER_ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type DeliveryStatus = 'REQUESTED' | 'ACCEPTED' | 'DRIVER_ASSIGNED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'WALLET' | 'CARD' | 'BANK_TRANSFER' | 'CASH' | 'MOBILE_MONEY';

export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string | null;
  profilePicture: string | null;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
}

export interface Person {
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

export interface Vehicle {
  id: string;
  type: string;
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  isActive: boolean;
}

export interface Stats {
  customers: { total: number; active: number };
  drivers: { total: number; online: number; byStatus: Partial<Record<DriverStatus, number>> };
  rides: { total: number; today: number; active: number; byStatus: Partial<Record<RideStatus, number>> };
  deliveries: { total: number; today: number; active: number; byStatus: Partial<Record<DeliveryStatus, number>> };
  revenue: { total: number; today: number; commission: number; currency: string };
  trend: { date: string; rides: number; deliveries: number; revenue: number }[];
  pendingDrivers: { id: string; createdAt: string; user: Person; vehicles: Vehicle[] }[];
}

export interface DriverRow {
  id: string;
  status: DriverStatus;
  isOnline: boolean;
  isAvailable: boolean;
  rating: Decimal;
  totalRides: number;
  totalDeliveries: number;
  totalEarnings: Decimal;
  licenseNumber: string;
  createdAt: string;
  user: UserSummary;
  vehicles: Vehicle[];
}

interface Address {
  streetAddress: string;
  city: string;
}

export interface TripRow {
  id: string;
  status: string;
  requestedAt: string;
  estimatedFare: Decimal;
  finalFare: Decimal | null;
  estimatedDistance: Decimal | null;
  customer: { id: string; user: Person };
  driver: { id: string; user: Person } | null;
  pickupAddress: Address;
  destinationAddress: Address;
  payment: { status: PaymentStatus; method: PaymentMethod; amount: Decimal } | null;
}

export interface RideRow extends TripRow {
  rideCode: string;
  status: RideStatus;
  rideType: string;
}

export interface DeliveryRow extends TripRow {
  deliveryCode: string;
  status: DeliveryStatus;
  deliveryType: string;
}

export interface TripDetail extends TripRow {
  rideCode?: string;
  deliveryCode?: string;
  rideType?: string;
  deliveryType?: string;
  acceptedAt: string | null;
  startedAt?: string | null;
  pickedUpAt?: string | null;
  completedAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  actualDistance: Decimal | null;
  actualDuration: number | null;
  estimatedDuration: number | null;
  surgeMultiplier?: Decimal;
  passengerCount?: number;
  packageDetails?: { description?: string; weight?: number };
  senderInfo?: { name: string; phoneNumber: string };
  recipientInfo?: { name: string; phoneNumber: string };
  notes: string | null;
  vehicle: Vehicle | null;
  reviews: { rating: number; comment: string | null; createdAt: string }[];
}

export interface DriverDetail extends DriverRow {
  licenseExpiryDate: string;
  bankAccount: { accountNumber?: string; bankName?: string; accountName?: string } | null;
  verificationDocuments: Record<string, string> | null;
  licenseDocument: string;
  wallet: { balance: Decimal; currency: string } | null;
  locations: { latitude: Decimal; longitude: Decimal; updatedAt: string }[];
  reviews: { id: string; rating: number; comment: string | null; createdAt: string; customer: { user: Person } }[];
  rides: RideRow[];
  deliveries: DeliveryRow[];
  earnings: { gross: number; commission: number; net: number };
}

export interface CustomerRow {
  id: string;
  rating: Decimal;
  totalRides: number;
  totalDeliveries: number;
  createdAt: string;
  user: UserSummary;
  wallet: { balance: Decimal; currency: string } | null;
}

export interface CustomerDetail extends CustomerRow {
  user: UserSummary & { addresses: { id: string; title: string; streetAddress: string; city: string }[] };
  wallet:
    | (CustomerRow['wallet'] & {
        transactions: { id: string; type: string; amount: Decimal; status: string; description: string | null; createdAt: string }[];
      })
    | null;
  rides: RideRow[];
  deliveries: DeliveryRow[];
  totalSpent: number;
}

export interface PaymentRow {
  id: string;
  amount: Decimal;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string | null;
  createdAt: string;
  ride: { id: string; rideCode: string; customer: { id: string; user: Person } } | null;
  delivery: { id: string; deliveryCode: string; customer: { id: string; user: Person } } | null;
}

export type PaymentSummary = Partial<Record<PaymentStatus, { count: number; amount: number }>>;
