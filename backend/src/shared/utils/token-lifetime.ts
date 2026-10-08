// JWT duration strings use milliseconds when no unit is specified.
export function tokenLifetimeSeconds(value: string): number {
  const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w|y)?$/i.exec(value.trim());
  if (!match) throw new Error(`Invalid JWT lifetime: ${value}`);
  const units: Record<string, number> = {
    ms: 0.001, s: 1, m: 60, h: 3600, d: 86400, w: 604800, y: 31557600,
  };
  const seconds = Number(match[1]) * units[(match[2] || 'ms').toLowerCase()];
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new Error('JWT lifetime must resolve to a positive whole number of seconds');
  }
  return seconds;
}
