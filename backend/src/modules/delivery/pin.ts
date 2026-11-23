// Recipient handover PIN: proof that the package reached the person it was addressed to.
// The sender's booking generates it, the recipient receives it by SMS, and the driver
// must enter it to mark the delivery DELIVERED.
import { randomInt } from 'crypto';
import bcrypt from 'bcrypt';

/**
 * A 4-digit PIN has only 10,000 values, so the hash alone does not protect it; the
 * attempt cap does. After this many wrong entries the delivery is locked and the
 * driver must contact support (or the sender issues a new PIN).
 */
export const MAX_PIN_ATTEMPTS = 5;

// Low cost is fine: the attempt cap, not the hash cost, limits guessing.
const PIN_HASH_ROUNDS = 8;

/** Uniformly random 0000–9999. Math.random is predictable; crypto.randomInt is not. */
export const generatePin = (): string => randomInt(0, 10_000).toString().padStart(4, '0');

export const hashPin = (pin: string): Promise<string> => bcrypt.hash(pin, PIN_HASH_ROUNDS);

export const verifyPin = (pin: string, hash: string): Promise<boolean> => bcrypt.compare(pin, hash);
