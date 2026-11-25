/**
 * What a provider says happened to one collection attempt. Providers report; the payment
 * service decides. Nothing is settled from a webhook body alone: every result here comes
 * from an authenticated status call to the provider.
 */
export interface CollectionStatus {
  status: 'pending' | 'success' | 'failed';
  /** Our reference for the attempt (Paystack `reference`, MoMo `externalId`). */
  reference: string;
  /** Amount actually collected, in kobo/minor units. */
  amountMinor?: number;
  currency?: string;
  providerReference?: string;
  channel?: string;
  failureReason?: string;
  raw: unknown;
}

/**
 * A provider call failed. `definitive` is true when the provider answered and refused
 * (4xx), so the operation certainly did not happen. Otherwise (timeout, 5xx) the outcome
 * is unknown and must be reconciled, never assumed failed.
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly provider: 'PAYSTACK' | 'MOMO',
    readonly definitive: boolean,
    readonly status?: number,
    readonly body?: unknown
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
