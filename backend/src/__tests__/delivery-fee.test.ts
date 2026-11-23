import { estimateDeliveryFee, DELIVERY_RATES } from '@/modules/delivery/fee';

const lekki = { latitude: 6.4474, longitude: 3.4739 };
const ikeja = { latitude: 6.6018, longitude: 3.3515 };

// WAT (UTC+1) hour -> UTC Date, so results don't depend on wall-clock time (same helper as fare.test.ts).
const atWatHour = (hour: number) => new Date(Date.UTC(2026, 0, 1, (hour - 1 + 24) % 24, 0));
const MIDDAY = atWatHour(12);

describe('delivery fee estimation', () => {
  it('applies the minimum fee to very short, light deliveries', () => {
    const near = { latitude: lekki.latitude + 0.001, longitude: lekki.longitude };
    const result = estimateDeliveryFee(lekki, near, 1, 'STANDARD', MIDDAY);
    expect(result.fee).toBe(DELIVERY_RATES.minimumFee);
    expect(result.breakdown.minimumFeeApplied).toBe(true);
  });

  it('prices a long delivery from base, distance and time', () => {
    const result = estimateDeliveryFee(lekki, ikeja, 2, 'STANDARD', MIDDAY);
    const { baseFee, distanceFee, timeFee, weightFee } = result.breakdown;
    expect(weightFee).toBe(0);
    expect(result.fee).toBeCloseTo(baseFee + distanceFee + timeFee, 1);
    expect(result.currency).toBe('NGN');
  });

  it('charges only for weight above the included allowance', () => {
    const at5 = estimateDeliveryFee(lekki, ikeja, DELIVERY_RATES.includedWeightKg, 'STANDARD', MIDDAY);
    const at12 = estimateDeliveryFee(lekki, ikeja, 12, 'STANDARD', MIDDAY);
    expect(at5.breakdown.weightFee).toBe(0);
    expect(at12.breakdown.weightFee).toBe(7 * DELIVERY_RATES.perExtraKg);
    expect(at12.fee - at5.fee).toBeCloseTo(7 * DELIVERY_RATES.perExtraKg, 1);
  });

  it('applies delivery type multipliers', () => {
    const standard = estimateDeliveryFee(lekki, ikeja, 2, 'STANDARD', MIDDAY).fee;
    expect(estimateDeliveryFee(lekki, ikeja, 2, 'EXPRESS', MIDDAY).fee).toBeCloseTo(standard * 1.5, 1);
    expect(estimateDeliveryFee(lekki, ikeja, 2, 'FRAGILE', MIDDAY).fee).toBeCloseTo(standard * 1.3, 1);
    expect(estimateDeliveryFee(lekki, ikeja, 2, 'SCHEDULED', MIDDAY).fee).toBe(standard);
  });

  it('costs more in rush hour than at night', () => {
    const rush = estimateDeliveryFee(lekki, ikeja, 2, 'STANDARD', atWatHour(17));
    const night = estimateDeliveryFee(lekki, ikeja, 2, 'STANDARD', atWatHour(2));
    expect(rush.durationMinutes).toBeGreaterThan(night.durationMinutes);
    expect(rush.fee).toBeGreaterThan(night.fee);
  });
});
