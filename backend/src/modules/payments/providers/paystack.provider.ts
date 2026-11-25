import axios, { AxiosError, AxiosInstance } from 'axios';
import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '@/config';
import { CollectionStatus, ProviderError } from './types';

export interface PaystackBank {
  name: string;
  code: string;
  slug?: string;
  type?: string;
  active?: boolean;
}

export interface InitializeInput {
  reference: string;
  amountKobo: number;
  email: string;
  channels: string[];
  metadata?: Record<string, unknown>;
}

export interface TransferResult {
  status: string; // 'success' | 'pending' | 'otp' | 'failed' | 'reversed' | 'received'
  transferCode?: string;
  raw: unknown;
}

const BANK_CACHE_MS = 6 * 60 * 60 * 1000;

/**
 * Paystack (Nigeria): card and bank-transfer collection through hosted checkout, refunds,
 * and Transfers for driver payouts (banks and MoMo PSB wallets alike).
 */
export class PaystackProvider {
  private banks?: { at: number; list: PaystackBank[] };

  constructor(
    private readonly secretKey = config.services.paystack.secretKey,
    private readonly http: AxiosInstance = axios.create({ baseURL: config.services.paystack.baseUrl, timeout: 20000 })
  ) {}

  get configured(): boolean {
    return !!this.secretKey && !this.secretKey.startsWith('your-');
  }

  async initialize(input: InitializeInput): Promise<{ authorizationUrl: string; accessCode: string }> {
    const data = await this.call<{ authorization_url: string; access_code: string }>('post', '/transaction/initialize', {
      reference: input.reference,
      amount: input.amountKobo,
      currency: 'NGN',
      email: input.email,
      channels: input.channels,
      callback_url: config.services.paystack.callbackUrl,
      metadata: input.metadata,
    });
    return { authorizationUrl: data.authorization_url, accessCode: data.access_code };
  }

  /** Authenticated status lookup. This, not the webhook body, is what settles a payment. */
  async verify(reference: string): Promise<CollectionStatus> {
    let data: any;
    try {
      data = await this.call<any>('get', `/transaction/verify/${encodeURIComponent(reference)}`);
    } catch (error) {
      // Paystack answers 400 "Transaction reference not found" for a checkout never opened.
      if (error instanceof ProviderError && error.status === 400) {
        return { status: 'pending', reference, raw: error.body };
      }
      throw error;
    }
    const status: CollectionStatus['status'] =
      data.status === 'success' ? 'success' : ['failed', 'reversed'].includes(data.status) ? 'failed' : 'pending';
    return {
      status,
      reference: data.reference,
      amountMinor: data.amount,
      currency: data.currency,
      providerReference: data.id != null ? String(data.id) : undefined,
      channel: data.channel,
      failureReason: status === 'failed' ? data.gateway_response || data.status : undefined,
      raw: data,
    };
  }

  async refund(reference: string, amountKobo?: number): Promise<unknown> {
    return this.call('post', '/refund', { transaction: reference, ...(amountKobo && { amount: amountKobo }) });
  }

  /** x-paystack-signature is HMAC-SHA512 of the raw request body keyed with the secret key. */
  verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
    if (!this.secretKey || !signature) return false;
    const expected = createHmac('sha512', this.secretKey).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async listBanks(): Promise<PaystackBank[]> {
    if (this.banks && Date.now() - this.banks.at < BANK_CACHE_MS) return this.banks.list;
    const list: PaystackBank[] = [];
    let next: string | null = null;
    do {
      const res: { data: PaystackBank[]; meta?: { next?: string | null } } = await this.raw('get', '/bank', undefined, {
        country: 'nigeria',
        currency: 'NGN',
        perPage: 100,
        use_cursor: true,
        ...(next && { next }),
      });
      list.push(...res.data.filter((b) => b.active !== false));
      next = res.meta?.next ?? null;
    } while (next);
    this.banks = { at: Date.now(), list };
    return list;
  }

  async momoPsbBank(): Promise<PaystackBank> {
    const banks = await this.listBanks();
    const override = config.services.paystack.momoPsbBankCode;
    const bank = override
      ? banks.find((b) => b.code === override)
      : banks.find((b) => /momo/i.test(b.name) || /momo/i.test(b.slug ?? ''));
    if (!bank) throw new ProviderError('MoMo PSB is not in the Paystack bank list', 'PAYSTACK', true);
    return bank;
  }

  async resolveAccount(accountNumber: string, bankCode: string): Promise<{ accountName: string; accountNumber: string }> {
    const data = await this.call<{ account_name: string; account_number: string }>('get', '/bank/resolve', undefined, {
      account_number: accountNumber,
      bank_code: bankCode,
    });
    return { accountName: data.account_name, accountNumber: data.account_number };
  }

  async createRecipient(input: { name: string; accountNumber: string; bankCode: string }): Promise<string> {
    const data = await this.call<{ recipient_code: string }>('post', '/transferrecipient', {
      type: 'nuban',
      name: input.name,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: 'NGN',
    });
    return data.recipient_code;
  }

  /** Requires OTP for transfers to be disabled on the Paystack dashboard. */
  async transfer(input: { amountKobo: number; recipientCode: string; reference: string; reason: string }): Promise<TransferResult> {
    const data = await this.call<any>('post', '/transfer', {
      source: 'balance',
      amount: input.amountKobo,
      recipient: input.recipientCode,
      reference: input.reference,
      reason: input.reason,
      currency: 'NGN',
    });
    return { status: data.status, transferCode: data.transfer_code, raw: data };
  }

  async verifyTransfer(reference: string): Promise<TransferResult> {
    const data = await this.call<any>('get', `/transfer/verify/${encodeURIComponent(reference)}`);
    return { status: data.status, transferCode: data.transfer_code, raw: data };
  }

  private async call<T>(method: 'get' | 'post', url: string, body?: unknown, params?: Record<string, unknown>): Promise<T> {
    const res = await this.raw<{ status: boolean; message: string; data: T }>(method, url, body, params);
    if (!res.status) throw new ProviderError(res.message || 'Paystack request failed', 'PAYSTACK', true, undefined, res);
    return res.data;
  }

  private async raw<T>(method: 'get' | 'post', url: string, body?: unknown, params?: Record<string, unknown>): Promise<T> {
    if (!this.configured) throw new ProviderError('Paystack is not configured', 'PAYSTACK', true);
    try {
      const res = await this.http.request<T>({
        method,
        url,
        data: body,
        params,
        headers: { Authorization: `Bearer ${this.secretKey}`, 'Content-Type': 'application/json' },
      });
      return res.data;
    } catch (error) {
      const e = error as AxiosError<{ message?: string }>;
      const status = e.response?.status;
      throw new ProviderError(
        e.response?.data?.message || e.message || 'Paystack request failed',
        'PAYSTACK',
        status !== undefined && status >= 400 && status < 500,
        status,
        e.response?.data
      );
    }
  }
}
