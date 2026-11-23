// Fare estimation. All amounts are in Naira (the schema stores Decimal(8,2) Naira, not kobo).

export type FareRideType = 'STANDARD' | 'PREMIUM' | 'SHARED' | 'SCHEDULE';

export const FARE_RATES = {
  baseFare: 500,
  perKm: 120,
  perMinute: 20,
  minimumFare: 800,
  // Straight-line distance understates road distance; scale it until a routing API is wired in.
  roadFactor: 1.3,
} as const;

/**
 * Lagos traffic-speed bands, used until a routing API gives a real ETA. A flat
 * average hides the gap between 2am (open road) and 8am (gridlock) — pricing both
 * the same way either overcharges the quiet trip or undercharges the slow one.
 *
 * `fromHour` is in West Africa Time (WAT, UTC+1), the service area's only timezone,
 * not the server's local time or UTC. Bands are sorted ascending and the lookup
 * takes the last one whose `fromHour` has started. Source: no live telemetry yet —
 * these are planning estimates to replace once /rides data accumulates.
 */
const LAGOS_TRAFFIC_BANDS = [
  { fromHour: 0, speedKmh: 40 }, // midnight–5am: roads are clear
  { fromHour: 5, speedKmh: 30 }, // early morning: traffic building
  { fromHour: 7, speedKmh: 15 }, // morning rush: 7–10am gridlock
  { fromHour: 10, speedKmh: 28 }, // late morning–afternoon: moderate
  { fromHour: 16, speedKmh: 13 }, // evening rush: 4–8pm, the worst band
  { fromHour: 20, speedKmh: 25 }, // evening: easing off
  { fromHour: 22, speedKmh: 35 }, // late night: clear again
] as const satisfies ReadonlyArray<{ fromHour: number; speedKmh: number }>;

/** The WAT hour-of-day for `at`, independent of the server's own timezone. */
function watHour(at: Date): number {
  const watMillis = at.getTime() + 60 * 60 * 1000; // UTC+1, no daylight saving in Nigeria
  return new Date(watMillis).getUTCHours();
}

export function averageSpeedKmh(at: Date = new Date()): number {
  const hour = watHour(at);
  // Bands are sorted, so the last match at or before `hour` is the active one.
  let speed: number = LAGOS_TRAFFIC_BANDS[0].speedKmh;
  for (const band of LAGOS_TRAFFIC_BANDS) {
    if (band.fromHour > hour) break;
    speed = band.speedKmh;
  }
  return speed;
}

const RIDE_TYPE_MULTIPLIER: Record<FareRideType, number> = {
  STANDARD: 1,
  PREMIUM: 1.5,
  SHARED: 0.7,
  SCHEDULE: 1,
};

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface FareEstimate {
  distanceKm: number;
  durationMinutes: number;
  surgeMultiplier: number;
  fare: number;
  currency: 'NGN';
  breakdown: {
    baseFare: number;
    distanceFare: number;
    timeFare: number;
    rideTypeMultiplier: number;
    minimumFareApplied: boolean;
    averageSpeedKmh: number;
  };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function haversineKm(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function estimateFare(
  pickup: Coordinates,
  destination: Coordinates,
  rideType: FareRideType = 'STANDARD',
  surgeMultiplier = 1,
  at: Date = new Date() // injectable so tests can pin a specific hour instead of depending on wall-clock time
): FareEstimate {
  const distanceKm = round2(haversineKm(pickup, destination) * FARE_RATES.roadFactor);
  const speedKmh = averageSpeedKmh(at);
  const durationMinutes = Math.max(1, Math.ceil((distanceKm / speedKmh) * 60));

  const distanceFare = distanceKm * FARE_RATES.perKm;
  const timeFare = durationMinutes * FARE_RATES.perMinute;
  const rideTypeMultiplier = RIDE_TYPE_MULTIPLIER[rideType];

  const subtotal = (FARE_RATES.baseFare + distanceFare + timeFare) * rideTypeMultiplier * surgeMultiplier;
  const minimumFareApplied = subtotal < FARE_RATES.minimumFare;

  return {
    distanceKm,
    durationMinutes,
    surgeMultiplier,
    fare: round2(Math.max(subtotal, FARE_RATES.minimumFare)),
    currency: 'NGN',
    breakdown: {
      baseFare: FARE_RATES.baseFare,
      distanceFare: round2(distanceFare),
      timeFare: round2(timeFare),
      rideTypeMultiplier,
      minimumFareApplied,
      averageSpeedKmh: speedKmh,
    },
  };
}
