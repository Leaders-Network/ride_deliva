import { PaystackProvider } from './paystack.provider';
import { MomoProvider } from './momo.provider';

// Single instances so token and bank-list caches are shared.
export const paystack = new PaystackProvider();
export const momo = new MomoProvider();

export { PaystackProvider, MomoProvider };
export * from './types';
