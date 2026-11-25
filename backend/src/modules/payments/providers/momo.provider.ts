import axios, { AxiosError, AxiosInstance } from 'axios';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { config } from '@/config';
import { CollectionStatus, ProviderError } from './types';

export interface RequestToPayInput {
  /** X-Reference-Id (UUID v4). Generate and persist it before calling, so a callback can always be matched. */
  providerReference: string;
  /** Our attempt reference; sent as `externalId` and echoed back in status responses. */
  reference: string;
  /** Decimal string in major units, e.g. "1500". */
  amount: string;
  msisdn: string;
  payerMessage: string;
  payeeNote: string;
  callbackUrl?: string;
}

type MomoConfig = typeof config.services.momo;

/**
 * MTN MoMo Open API, Collections product (MoMo PSB in Nigeria).
 *
 * Flow: POST /collection/v1_0/requesttopay (202 = queued, not paid) pushes an approval
 * prompt to the customer's phone. The outcome is read from
 * GET /collection/v1_0/requesttopay/{X-Reference-Id}: PENDING, SUCCESSFUL or FAILED.
 * Callbacks are unsigned, so they only trigger that authenticated status read.
 *
 * Nigeria-specific values (production base URL, X-Target-Environment, currency) are config,
 * because they come from the MoMo developer portal after onboarding.
 */
export class MomoProvider {
  private token?: { value: string; expiresAt: number };

  constructor(
    private readonly cfg: MomoConfig = config.services.momo,
    private readonly http: AxiosInstance = axios.create({ baseURL: config.services.momo.baseUrl, timeout: 20000 })
  ) {}

  get configured(): boolean {
    const { subscriptionKey, apiUser, apiKey } = this.cfg;
    return [subscriptionKey, apiUser, apiKey].every((v) => !!v && !v.startsWith('your-'));
  }

  get currency(): string {
    return this.cfg.currency;
  }

  static newReference(): string {
    return randomUUID();
  }

  /**
   * Per-transaction callback hash (MoMo best practice: a transaction-specific hash in the
   * callback path; query strings are not allowed). The shared secret never appears in a URL.
   */
  static callbackSignature(providerReference: string, secret: string): string {
    return createHmac('sha256', secret).update(providerReference).digest('hex');
  }

  static verifyCallbackSignature(providerReference: string, signature: string, secret: string): boolean {
    const expected = Buffer.from(MomoProvider.callbackSignature(providerReference, secret));
    const given = Buffer.from(signature);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  /** Starts a collection. A 202 only means MoMo queued the prompt; poll getStatus for the outcome. */
  async requestToPay(input: RequestToPayInput): Promise<void> {
    const { providerReference } = input;
    await this.request('post', '/collection/v1_0/requesttopay', {
      headers: {
        'X-Reference-Id': providerReference,
        ...(input.callbackUrl && { 'X-Callback-Url': input.callbackUrl }),
      },
      data: {
        amount: input.amount,
        currency: this.cfg.currency,
        externalId: input.reference,
        payer: { partyIdType: 'MSISDN', partyId: input.msisdn },
        // Shown to payer/payee. MoMo returns VALIDATION_ERROR if empty or over 128 characters.
        payerMessage: input.payerMessage.slice(0, 128),
        payeeNote: input.payeeNote.slice(0, 128),
      },
    });
  }

  async getStatus(providerReference: string): Promise<CollectionStatus> {
    const data = await this.request<any>('get', `/collection/v1_0/requesttopay/${encodeURIComponent(providerReference)}`);
    const status: CollectionStatus['status'] =
      data.status === 'SUCCESSFUL' ? 'success' : data.status === 'FAILED' ? 'failed' : 'pending';
    return {
      status,
      reference: data.externalId,
      amountMinor: data.amount != null ? Math.round(Number(data.amount) * 100) : undefined,
      currency: data.currency,
      providerReference,
      channel: 'momo',
      failureReason: status === 'failed' ? describeReason(data.reason) : undefined,
      raw: data,
    };
  }

  /** Best-effort pre-check that the number has an active MoMo wallet. */
  async isActiveAccount(msisdn: string): Promise<boolean | undefined> {
    try {
      const data = await this.request<{ result?: boolean }>('get', `/collection/v1_0/accountholder/msisdn/${msisdn}/active`);
      return data.result;
    } catch (error) {
      if (error instanceof ProviderError && error.status === 404) return false;
      return undefined; // unknown; let request-to-pay decide
    }
  }

  private async accessToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt) return this.token.value;
    const basic = Buffer.from(`${this.cfg.apiUser}:${this.cfg.apiKey}`).toString('base64');
    try {
      const res = await this.http.post<{ access_token: string; expires_in: number }>('/collection/token/', undefined, {
        headers: { Authorization: `Basic ${basic}`, 'Ocp-Apim-Subscription-Key': this.cfg.subscriptionKey! },
      });
      // Refresh a minute early so a token never expires mid-request.
      const ttl = Math.max(60, Number(res.data.expires_in) || 3600) - 60;
      this.token = { value: res.data.access_token, expiresAt: Date.now() + ttl * 1000 };
      return this.token.value;
    } catch (error) {
      throw toProviderError(error, 'MoMo token request failed');
    }
  }

  private async request<T>(
    method: 'get' | 'post',
    url: string,
    opts: { headers?: Record<string, string>; data?: unknown } = {}
  ): Promise<T> {
    if (!this.configured) throw new ProviderError('MoMo is not configured', 'MOMO', true);
    const token = await this.accessToken();
    try {
      const res = await this.http.request<T>({
        method,
        url,
        data: opts.data,
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Target-Environment': this.cfg.targetEnvironment,
          'Ocp-Apim-Subscription-Key': this.cfg.subscriptionKey!,
          'Content-Type': 'application/json',
          ...opts.headers,
        },
      });
      return res.data;
    } catch (error) {
      if ((error as AxiosError).response?.status === 401) this.token = undefined;
      throw toProviderError(error, 'MoMo request failed');
    }
  }
}

const toProviderError = (error: unknown, fallback: string) => {
  const e = error as AxiosError<{ message?: string; code?: string }>;
  const status = e.response?.status;
  return new ProviderError(
    e.response?.data?.message || e.response?.data?.code || e.message || fallback,
    'MOMO',
    status !== undefined && status >= 400 && status < 500,
    status,
    e.response?.data
  );
};

// From the MoMo Open API "Common Error Codes" page.
const REASONS: Record<string, string> = {
  APPROVAL_REJECTED: 'The payment was declined on the phone',
  EXPIRED: 'The payment prompt expired before it was approved',
  COULD_NOT_PERFORM_TRANSACTION: 'The payment was not approved within 5 minutes. Please try again',
  PAYEE_NOT_FOUND: 'Merchant account is unavailable',
  SENDER_ACCOUNT_NOT_ACTIVE: 'Merchant account is not active',
  TRANSACTION_NOT_FOUND: 'The payment could not be found',
  VALIDATION_ERROR: 'The payment request was invalid',
  NOT_ENOUGH_FUNDS: 'Insufficient MoMo balance',
  PAYER_LIMIT_REACHED: 'The MoMo account limit has been reached',
  PAYER_NOT_FOUND: 'No MoMo account for this number',
  PAYEE_NOT_ALLOWED_TO_RECEIVE: 'Merchant account cannot receive payments',
  NOT_ALLOWED: 'The payment was not allowed',
  INTERNAL_PROCESSING_ERROR: 'MoMo could not process the payment',
};

const describeReason = (reason: unknown): string => {
  const code = typeof reason === 'string' ? reason : (reason as { code?: string } | undefined)?.code;
  return (code && REASONS[code]) || code || 'MoMo payment failed';
};
