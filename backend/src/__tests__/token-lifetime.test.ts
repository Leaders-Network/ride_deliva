import { tokenLifetimeSeconds } from '@/shared/utils/token-lifetime';

describe('JWT lifetime configuration', () => {
  it.each([['7d', 604800], ['30d', 2592000], ['15m', 900], ['1h', 3600], ['120000', 120], ['1.5h', 5400]])(
    'converts %s to seconds without changing JWT duration semantics', (input, seconds) => {
      expect(tokenLifetimeSeconds(input)).toBe(seconds);
    },
  );
  it.each(['', 'invalid', '-1h', '0s', '1ms', 'Infinity', '999999999999999999999d'])(
    'rejects invalid or unusable duration %s', input => {
      expect(() => tokenLifetimeSeconds(input)).toThrow();
    },
  );
});
