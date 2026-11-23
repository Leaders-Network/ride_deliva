// Delivery fee estimation. Amounts are in Naira, matching the Decimal(8,2) Naira columns (see rides/fare.ts).
// Distance and travel time come from the rides helpers so both products agree on how far and how long a trip is.
import { averageSpeedKmh, haversineKm, FARE_RATES, Coordinates } from '../rides/fare';

export type FeeDeliveryType = 'STANDARD' | 'EXPRESS' | 'SCHEDULED' | 'FRAGILE';

export const DELIVERY_RATES = {
  baseFee: 600,
  perKm: 100,
  perMinute: 10,
  minimumFee: 700,
  // Parcels up to this weight cost the same; each kg above it adds `perExtraKg`.
  includedWeightKg: 5,
  perExtraKg: 50,
  maxWeightKg: 30,
} as const;

const DELIVERY_TYPE_MULTIPLIER: Record<FeeDeliveryType, number> = {
  STANDARD: 1,
  EXPRESS: 1.5, // priority dispatch
  SCHEDULED: 1,
  FRAGILE: 1.3, // careful handling, fewer stops
};

export interface DeliveryFeeEstimate {
  distanceKm: number;
  durationMinutes: number;
  fee: number;
  currency: 'NGN';
  breakdown: {
    baseFee: number;
    distanceFee: number;
    timeFee: number;
    weightFee: number;
    deliveryTypeMultiplier: number;
    minimumFeeApplied: boolean;
    averageSpeedKmh: number;
  };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function estimateDeliveryFee(
  pickup: Coordinates,
  destination: Coordinates,
  weightKg: number,
  deliveryType: FeeDeliveryType = 'STANDARD',
  at: Date = new Date() // injectable so tests can pin the traffic band
): DeliveryFeeEstimate {
  const distanceKm = round2(haversineKm(pickup, destination) * FARE_RATES.roadFactor);
  const speedKmh = averageSpeedKmh(at);
  const durationMinutes = Math.max(1, Math.ceil((distanceKm / speedKmh) * 60));

  const distanceFee = distanceKm * DELIVERY_RATES.perKm;
  const timeFee = durationMinutes * DELIVERY_RATES.perMinute;
  const weightFee = Math.max(0, weightKg - DELIVERY_RATES.includedWeightKg) * DELIVERY_RATES.perExtraKg;
  const deliveryTypeMultiplier = DELIVERY_TYPE_MULTIPLIER[deliveryType];

  const subtotal = (DELIVERY_RATES.baseFee + distanceFee + timeFee + weightFee) * deliveryTypeMultiplier;
  const minimumFeeApplied = subtotal < DELIVERY_RATES.minimumFee;

  return {
    distanceKm,
    durationMinutes,
    fee: round2(Math.max(subtotal, DELIVERY_RATES.minimumFee)),
    currency: 'NGN',
    breakdown: {
      baseFee: DELIVERY_RATES.baseFee,
      distanceFee: round2(distanceFee),
      timeFee: round2(timeFee),
      weightFee: round2(weightFee),
      deliveryTypeMultiplier,
      minimumFeeApplied,
      averageSpeedKmh: speedKmh,
    },
  };
}
