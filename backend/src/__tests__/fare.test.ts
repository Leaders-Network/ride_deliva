import { estimateFare, haversineKm, averageSpeedKmh, FARE_RATES } from '@/modules/rides/fare';

const lekki = { latitude: 6.4474, longitude: 3.4739 };
const ikeja = { latitude: 6.6018, longitude: 3.3515 };

// WAT (UTC+1) hour -> the UTC Date that lands on it, so band tests don't depend on wall-clock time.
const atWatHour = (hour: number) => new Date(Date.UTC(2026, 0, 1, (hour - 1 + 24) % 24, 0));
const MIDDAY = atWatHour(12); // a quiet, unambiguous reference hour for non-time-focused tests

describe('fare estimation', () => {
  it('computes haversine distance between known points', () => {
    expect(haversineKm(lekki, lekki)).toBe(0);
    // Lekki to Ikeja is roughly 20 km in a straight line
    expect(haversineKm(lekki, ikeja)).toBeGreaterThan(18);
    expect(haversineKm(lekki, ikeja)).toBeLessThan(22);
  });

  it('applies the minimum fare to very short trips', () => {
    const near = { latitude: lekki.latitude + 0.001, longitude: lekki.longitude };
    const result = estimateFare(lekki, near, 'STANDARD', 1, MIDDAY);
    expect(result.fare).toBe(FARE_RATES.minimumFare);
    expect(result.breakdown.minimumFareApplied).toBe(true);
    expect(result.durationMinutes).toBeGreaterThanOrEqual(1);
  });

  it('prices a long trip from base, distance and time', () => {
    const result = estimateFare(lekki, ikeja, 'STANDARD', 1, MIDDAY);
    const expected =
      FARE_RATES.baseFare + result.breakdown.distanceFare + result.breakdown.timeFare;
    expect(result.fare).toBeCloseTo(expected, 1);
    expect(result.currency).toBe('NGN');
    expect(result.breakdown.minimumFareApplied).toBe(false);
  });

  it('scales by ride type and surge', () => {
    const standard = estimateFare(lekki, ikeja, 'STANDARD', 1, MIDDAY).fare;
    expect(estimateFare(lekki, ikeja, 'PREMIUM', 1, MIDDAY).fare).toBeCloseTo(standard * 1.5, 1);
    expect(estimateFare(lekki, ikeja, 'SHARED', 1, MIDDAY).fare).toBeLessThan(standard);
    expect(estimateFare(lekki, ikeja, 'STANDARD', 2, MIDDAY).fare).toBeCloseTo(standard * 2, 1);
  });

  describe('time-of-day traffic model', () => {
    it('picks the slower rush-hour band over the flat average', () => {
      // 8am WAT: deep in the 7-10am band. 30 km/h flat would have understated this trip's time.
      expect(averageSpeedKmh(atWatHour(8))).toBeLessThan(20);
    });

    it('picks a faster late-night band', () => {
      expect(averageSpeedKmh(atWatHour(2))).toBeGreaterThan(35);
    });

    it('is read from WAT, not the server/UTC hour', () => {
      // UTC 23:00 is WAT 00:00 the next day - the clear-roads band, not the "late night easing off" one.
      const utc2300 = new Date(Date.UTC(2026, 0, 1, 23, 0));
      expect(averageSpeedKmh(utc2300)).toBe(40);
    });

    it('prices the same trip higher in traffic than at night', () => {
      const rushHour = estimateFare(lekki, ikeja, 'STANDARD', 1, atWatHour(17)).fare; // evening rush
      const lateNight = estimateFare(lekki, ikeja, 'STANDARD', 1, atWatHour(2)).fare; // clear roads
      expect(rushHour).toBeGreaterThan(lateNight);
    });

    it('is picked up by estimateFare, not just hardcoded', () => {
      const result = estimateFare(lekki, ikeja, 'STANDARD', 1, atWatHour(8));
      expect(result.breakdown.averageSpeedKmh).toBe(averageSpeedKmh(atWatHour(8)));
    });
  });
});
