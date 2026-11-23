import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type {
  CustomerDetail,
  CustomerRow,
  DeliveryRow,
  DriverDetail,
  DriverRow,
  DriverStatus,
  PaymentRow,
  PaymentSummary,
  RideRow,
  Stats,
  TripDetail,
} from './types';

export type ListParams = Record<string, string | number | boolean | undefined>;

const list = <T>(key: string, path: string, params: ListParams, enabled = true) =>
  useQuery({
    queryKey: [key, params],
    queryFn: async () => {
      const res = await api.get<T[]>(path, params);
      return { items: res.data, meta: res.meta! };
    },
    placeholderData: keepPreviousData,
    enabled,
  });

const one = <T>(key: string, path: string, id?: string) =>
  useQuery({
    queryKey: [key, id],
    queryFn: async () => (await api.get<T>(`${path}/${id}`)).data,
    enabled: !!id,
  });

export const useStats = () =>
  useQuery({
    queryKey: ['stats'],
    queryFn: async () => (await api.get<Stats>('/admin/stats')).data,
    refetchInterval: 30_000, // keep the overview fresh during a demo
  });

export const useDrivers = (p: ListParams) => list<DriverRow>('drivers', '/admin/drivers', p);
export const useDriver = (id?: string) => one<DriverDetail>('driver', '/admin/drivers', id);
export const useCustomers = (p: ListParams) => list<CustomerRow>('customers', '/admin/customers', p);
export const useCustomer = (id?: string) => one<CustomerDetail>('customer', '/admin/customers', id);
export const useRides = (p: ListParams, enabled = true) => list<RideRow>('rides', '/admin/rides', p, enabled);
export const useRide = (id?: string) => one<TripDetail>('ride', '/admin/rides', id);
export const useDeliveries = (p: ListParams, enabled = true) => list<DeliveryRow>('deliveries', '/admin/deliveries', p, enabled);
export const useDelivery = (id?: string) => one<TripDetail>('delivery', '/admin/deliveries', id);

export const usePayments = (p: ListParams) =>
  useQuery({
    queryKey: ['payments', p],
    queryFn: async () => {
      const res = await api.get<PaymentRow[]>('/admin/payments', p);
      return { items: res.data, meta: res.meta!, summary: (res.meta?.summary ?? {}) as PaymentSummary };
    },
    placeholderData: keepPreviousData,
  });

// Mutations refresh every list/detail that might show the changed record.
const useInvalidate = () => {
  const qc = useQueryClient();
  return (...keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
};

export const useUpdateDriverStatus = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: Exclude<DriverStatus, 'PENDING'>; reason?: string }) =>
      api.patch(`/admin/drivers/${id}/status`, { status, reason }),
    onSuccess: () => invalidate('drivers', 'driver', 'stats'),
  });
};

export const useSetUserActive = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ userId, isActive, reason }: { userId: string; isActive: boolean; reason?: string }) =>
      api.patch(`/admin/users/${userId}/active`, { isActive, reason }),
    onSuccess: () => invalidate('customers', 'customer', 'drivers', 'driver', 'stats'),
  });
};

export const useCancelTrip = (kind: 'rides' | 'deliveries') => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.post(`/admin/${kind}/${id}/cancel`, { reason }),
    onSuccess: () => invalidate(kind, kind === 'rides' ? 'ride' : 'delivery', 'stats', 'driver', 'customer'),
  });
};
