import { Prisma } from '@/generated/prisma';

/**
 * Money conventions: the database stores naira as Decimal(_, 2). Paystack works in integer
 * kobo. MoMo takes the amount as a decimal string in major units. Convert only here.
 */
export type Money = Prisma.Decimal;

export const money = (value: Prisma.Decimal.Value): Money => new Prisma.Decimal(value).toDecimalPlaces(2);

export const ZERO = money(0);

export const toKobo = (amount: Money): number => {
  const kobo = amount.mul(100);
  if (!kobo.isInteger() || kobo.lte(0)) throw new Error(`Invalid payment amount: ${amount.toString()}`);
  return kobo.toNumber();
};

export const fromKobo = (kobo: number): Money => money(new Prisma.Decimal(kobo).div(100));

/** "1500" for whole amounts, "1500.50" otherwise. */
export const toMajorString = (amount: Money): string =>
  amount.isInteger() ? amount.toFixed(0) : amount.toFixed(2);

/** Rounds down to the kobo, so a percentage never pays out more than the rate allows. */
export const percentOf = (amount: Money, rate: Prisma.Decimal.Value): Money =>
  amount.mul(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);

/**
 * Nigerian MSISDN in international form without "+": 2348031234567.
 * Accepts +234..., 234... and 0... (11-digit local) forms.
 */
export const toMsisdn = (phone: string): string => {
  const digits = phone.replace(/[^\d]/g, '');
  if (/^234[789]\d{9}$/.test(digits)) return digits;
  if (/^0[789]\d{9}$/.test(digits)) return `234${digits.slice(1)}`;
  if (/^[789]\d{9}$/.test(digits)) return `234${digits}`;
  throw new Error('Enter a valid Nigerian mobile number');
};

/** MoMo PSB wallets are NUBAN accounts numbered as the MSISDN without the leading 0. */
export const momoPsbAccountNumber = (phone: string): string => toMsisdn(phone).slice(3);
