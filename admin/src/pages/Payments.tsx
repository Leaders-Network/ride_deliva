import { Link } from 'react-router-dom';
import { usePayments } from '@/api/hooks';
import type { PaymentMethod, PaymentRow, PaymentStatus } from '@/api/types';
import { Card, DataTable, ErrorState, PageHeader, Pagination, Select, StatusBadge, type Column } from '@/components/ui';
import { useListParams } from '@/lib/useListParams';
import { dateTime, fullName, label, money } from '@/lib/format';

const STATUSES: PaymentStatus[] = ['COMPLETED', 'PENDING', 'PROCESSING', 'FAILED', 'REFUNDED'];
const METHODS: PaymentMethod[] = ['WALLET', 'CARD', 'BANK_TRANSFER', 'CASH', 'MOBILE_MONEY'];

const columns: Column<PaymentRow>[] = [
  { header: 'Reference', cell: (p) => <span className="font-mono text-xs">{p.reference ?? p.id.slice(0, 8)}</span> },
  {
    header: 'For',
    cell: (p) =>
      p.ride ? (
        <Link to={`/rides?id=${p.ride.id}`} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">
          Ride {p.ride.rideCode}
        </Link>
      ) : p.delivery ? (
        <Link to={`/deliveries?id=${p.delivery.id}`} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">
          Delivery {p.delivery.deliveryCode}
        </Link>
      ) : (
        '—'
      ),
  },
  { header: 'Customer', cell: (p) => fullName((p.ride ?? p.delivery)?.customer.user) },
  { header: 'Method', cell: (p) => label(p.method) },
  { header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
  { header: 'Amount', cell: (p) => <span className="font-medium">{money(p.amount)}</span>, className: 'text-right' },
  { header: 'Date', cell: (p) => <span className="whitespace-nowrap text-muted">{dateTime(p.createdAt)}</span> },
];

export function PaymentsPage() {
  const { values, set } = useListParams(['status', 'method', 'from', 'to'] as const);
  const { data, isLoading, isFetching, error } = usePayments({ ...values, limit: 20 });
  const summary = data?.summary ?? {};

  const dateInput = 'rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-primary [color-scheme:dark]';

  return (
    <>
      <PageHeader title="Payments" subtitle="Money collected for rides and deliveries." />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {(['COMPLETED', 'PENDING', 'FAILED'] as const).map((s) => (
          <Card key={s} className="p-4">
            <div className="flex items-center justify-between">
              <StatusBadge status={s} />
              <span className="text-xs text-muted">{summary[s]?.count ?? 0} payments</span>
            </div>
            <div className="mt-2 text-xl font-semibold">{money(summary[s]?.amount ?? 0)}</div>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={values.status} onChange={(v) => set('status', v)} options={STATUSES} placeholder="All statuses" />
        <Select value={values.method} onChange={(v) => set('method', v)} options={METHODS} placeholder="All methods" />
        <input type="date" aria-label="From" className={dateInput} value={values.from} onChange={(e) => set('from', e.target.value)} />
        <input type="date" aria-label="To" className={dateInput} value={values.to} onChange={(e) => set('to', e.target.value)} />
      </div>

      {error ? (
        <ErrorState error={error} />
      ) : (
        <Card className={isFetching ? 'opacity-80' : ''}>
          <DataTable columns={columns} rows={data?.items} loading={isLoading} empty="No payments match these filters" />
          {data && <Pagination page={values.page} totalPages={data.meta.totalPages} total={data.meta.total} onPage={(p) => set('page', p)} />}
        </Card>
      )}
    </>
  );
}
