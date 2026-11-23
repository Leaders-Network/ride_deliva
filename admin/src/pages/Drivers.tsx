import { useState } from 'react';
import { Ban, CheckCircle2, FileText, Pause, Play, Star, XCircle } from 'lucide-react';
import { useDriver, useDrivers, useSetUserActive, useStats, useUpdateDriverStatus } from '@/api/hooks';
import type { DriverRow, DriverStatus } from '@/api/types';
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Drawer,
  ErrorState,
  Field,
  OnlineDot,
  PageHeader,
  Pagination,
  SearchInput,
  Section,
  Spinner,
  StatusBadge,
  Tabs,
  type Column,
} from '@/components/ui';
import { RecentTrips } from '@/components/RecentTrips';
import { useListParams } from '@/lib/useListParams';
import { date, fullName, initials, label, money, toNum } from '@/lib/format';

type Decision = Exclude<DriverStatus, 'PENDING'>;

interface Action {
  to: Decision;
  label: string;
  variant: 'success' | 'danger' | 'secondary';
  icon: typeof Play;
  description: string;
}

// What an admin can do from each status. Mirrors DRIVER_TRANSITIONS in the backend admin service.
const ACTIONS: Record<DriverStatus, Action[]> = {
  PENDING: [
    { to: 'APPROVED', label: 'Approve', variant: 'success', icon: CheckCircle2, description: 'The driver can go online and accept trips immediately.' },
    { to: 'REJECTED', label: 'Reject', variant: 'danger', icon: XCircle, description: 'The application is declined. The driver is notified with your reason.' },
  ],
  APPROVED: [
    { to: 'SUSPENDED', label: 'Suspend', variant: 'danger', icon: Pause, description: 'The driver is taken offline and cannot accept trips until reinstated.' },
    { to: 'INACTIVE', label: 'Deactivate', variant: 'secondary', icon: Ban, description: 'Marks the driver as no longer working on the platform.' },
  ],
  SUSPENDED: [
    { to: 'APPROVED', label: 'Reinstate', variant: 'success', icon: Play, description: 'The driver can go online and accept trips again.' },
    { to: 'INACTIVE', label: 'Deactivate', variant: 'secondary', icon: Ban, description: 'Marks the driver as no longer working on the platform.' },
  ],
  REJECTED: [{ to: 'APPROVED', label: 'Approve anyway', variant: 'success', icon: CheckCircle2, description: 'Overturns the rejection.' }],
  INACTIVE: [{ to: 'APPROVED', label: 'Reactivate', variant: 'success', icon: Play, description: 'The driver can go online again.' }],
};

const columns: Column<DriverRow>[] = [
  {
    header: 'Driver',
    cell: (d) => (
      <div className="flex items-center gap-3">
        <Avatar name={initials(d.user)} src={d.user.profilePicture} />
        <div>
          <div className="font-medium">{fullName(d.user)}</div>
          <div className="text-xs text-muted">{d.user.phoneNumber}</div>
        </div>
      </div>
    ),
  },
  {
    header: 'Vehicle',
    cell: (d) =>
      d.vehicles[0] ? (
        <div>
          <div>
            {d.vehicles[0].make} {d.vehicles[0].model}
          </div>
          <div className="font-mono text-xs text-muted">{d.vehicles[0].licensePlate}</div>
        </div>
      ) : (
        <span className="text-muted">—</span>
      ),
  },
  { header: 'Status', cell: (d) => <StatusBadge status={d.user.isActive ? d.status : 'BLOCKED'} /> },
  { header: 'Availability', cell: (d) => <OnlineDot online={d.isOnline} /> },
  {
    header: 'Rating',
    cell: (d) => (
      <span className="inline-flex items-center gap-1">
        <Star className="h-3.5 w-3.5 fill-warning text-warning" /> {toNum(d.rating).toFixed(2)}
      </span>
    ),
  },
  { header: 'Trips', cell: (d) => d.totalRides + d.totalDeliveries, className: 'text-right' },
  { header: 'Earnings', cell: (d) => money(d.totalEarnings), className: 'text-right' },
  { header: 'Joined', cell: (d) => <span className="text-muted">{date(d.createdAt)}</span> },
];

function DriverDrawer({ id, onClose }: { id?: string; onClose: () => void }) {
  const { data: d, isLoading, error } = useDriver(id);
  const updateStatus = useUpdateDriverStatus();
  const setActive = useSetUserActive();
  const [pending, setPending] = useState<Action | 'block' | 'unblock' | null>(null);

  const close = () => {
    setPending(null);
    updateStatus.reset();
    setActive.reset();
  };

  const confirm = async (reason?: string) => {
    if (!d || !pending) return;
    try {
      if (pending === 'block' || pending === 'unblock') {
        await setActive.mutateAsync({ userId: d.user.id, isActive: pending === 'unblock', reason });
      } else {
        await updateStatus.mutateAsync({ id: d.id, status: pending.to, reason });
      }
      close();
    } catch {
      // Error is shown inside the dialog via the mutation's error state.
    }
  };

  const mutationError = (updateStatus.error ?? setActive.error) as Error | null;

  return (
    <Drawer open={!!id} onClose={onClose} title={d ? fullName(d.user) : 'Driver'}>
      {isLoading ? (
        <Spinner />
      ) : error || !d ? (
        <ErrorState error={error} />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <Avatar name={initials(d.user)} src={d.user.profilePicture} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <StatusBadge status={d.status} />
                {!d.user.isActive && <StatusBadge status="BLOCKED" />}
                <OnlineDot online={d.isOnline} />
              </div>
              <div className="mt-1 text-xs text-muted">Applied {date(d.createdAt)}</div>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {ACTIONS[d.status].map((a) => (
              <Button key={a.to} variant={a.variant} onClick={() => setPending(a)}>
                <a.icon className="h-4 w-4" /> {a.label}
              </Button>
            ))}
            <Button variant="ghost" onClick={() => setPending(d.user.isActive ? 'block' : 'unblock')}>
              {d.user.isActive ? 'Block account' : 'Unblock account'}
            </Button>
          </div>

          <div className="mb-6 grid grid-cols-3 gap-3">
            {[
              ['Net earnings', money(d.earnings.net)],
              ['Commission', money(d.earnings.commission)],
              ['Wallet', money(d.wallet?.balance)],
            ].map(([k, v]) => (
              <Card key={k} className="p-4">
                <div className="text-xs text-muted">{k}</div>
                <div className="mt-1 font-semibold">{v}</div>
              </Card>
            ))}
          </div>

          <Section title="Profile">
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Phone">{d.user.phoneNumber}</Field>
              <Field label="Email">{d.user.email ?? '—'}</Field>
              <Field label="Licence number">
                <span className="font-mono">{d.licenseNumber}</span>
              </Field>
              <Field label="Licence expires">{date(d.licenseExpiryDate)}</Field>
              <Field label="Rating">
                {toNum(d.rating).toFixed(2)} ({d.reviews.length} recent reviews)
              </Field>
              <Field label="Completed trips">
                {d.totalRides} rides · {d.totalDeliveries} deliveries
              </Field>
              <Field label="Payout account">
                {d.bankAccount ? `${d.bankAccount.bankName} · ${d.bankAccount.accountNumber}` : '—'}
              </Field>
            </dl>
          </Section>

          <Section title="Vehicles">
            {d.vehicles.map((v) => (
              <div key={v.id} className="mb-2 flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                <div>
                  {v.year} {v.make} {v.model} · {v.color}
                  <div className="text-xs text-muted">{label(v.type)}</div>
                </div>
                <span className="rounded bg-surface-2 px-2 py-1 font-mono text-xs">{v.licensePlate}</span>
              </div>
            ))}
          </Section>

          <Section title="Documents">
            <div className="flex flex-wrap gap-2">
              {Object.entries({ license: d.licenseDocument, ...(d.verificationDocuments ?? {}) }).map(([k, path]) => (
                <span key={k} title={path} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs">
                  <FileText className="h-3.5 w-3.5 text-primary" /> {label(k)}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">Document viewing comes with file storage (next milestone).</p>
          </Section>

          <Section title="Recent trips">
            <RecentTrips rides={d.rides} deliveries={d.deliveries} counterpart="customer" />
          </Section>

          {d.reviews.length > 0 && (
            <Section title="Recent reviews">
              <ul className="space-y-2">
                {d.reviews.map((r) => (
                  <li key={r.id} className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-warning">{'★'.repeat(r.rating)}</span>
                      <span className="text-xs text-muted">{fullName(r.customer.user)}</span>
                    </div>
                    {r.comment && <p className="mt-1 text-muted">{r.comment}</p>}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <ConfirmDialog
            open={!!pending}
            onClose={close}
            loading={updateStatus.isPending || setActive.isPending}
            error={mutationError?.message}
            onConfirm={confirm}
            {...(pending === 'block'
              ? {
                  title: `Block ${fullName(d.user)}?`,
                  description: 'They are signed out everywhere and taken offline. They cannot sign in until unblocked.',
                  confirmLabel: 'Block account',
                  variant: 'danger' as const,
                  requireReason: true,
                }
              : pending === 'unblock'
                ? { title: `Unblock ${fullName(d.user)}?`, description: 'They can sign in again.', confirmLabel: 'Unblock', variant: 'success' as const }
                : pending
                  ? {
                      title: `${pending.label} ${fullName(d.user)}?`,
                      description: pending.description,
                      confirmLabel: pending.label,
                      variant: pending.variant === 'secondary' ? ('danger' as const) : pending.variant,
                      requireReason: pending.to !== 'APPROVED',
                    }
                  : { title: '', description: '', confirmLabel: '' })}
          />
        </>
      )}
    </Drawer>
  );
}

export function DriversPage() {
  const { values, set, selected, select } = useListParams(['status', 'search'] as const);
  const { data, isLoading, isFetching, error } = useDrivers({ ...values, limit: 20 });
  const { data: stats } = useStats();
  const by = stats?.drivers.byStatus ?? {};

  return (
    <>
      <PageHeader title="Drivers" subtitle="Review applications, monitor the fleet and take action on accounts." />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={(values.status || 'ALL') as DriverStatus | 'ALL'}
          onChange={(v) => set('status', v === 'ALL' ? '' : v)}
          tabs={[
            { id: 'ALL', label: 'All', count: stats?.drivers.total },
            { id: 'PENDING', label: 'Pending', count: by.PENDING ?? 0 },
            { id: 'APPROVED', label: 'Approved', count: by.APPROVED ?? 0 },
            { id: 'SUSPENDED', label: 'Suspended', count: by.SUSPENDED ?? 0 },
            { id: 'REJECTED', label: 'Rejected', count: by.REJECTED ?? 0 },
          ]}
        />
        <SearchInput value={values.search} onChange={(v) => set('search', v)} placeholder="Search name, phone, licence…" />
      </div>

      {error ? (
        <ErrorState error={error} />
      ) : (
        <Card className={isFetching ? 'opacity-80' : ''}>
          <DataTable columns={columns} rows={data?.items} loading={isLoading} onRowClick={(d) => select(d.id)} empty="No drivers match these filters" />
          {data && <Pagination page={values.page} totalPages={data.meta.totalPages} total={data.meta.total} onPage={(p) => set('page', p)} />}
        </Card>
      )}

      <DriverDrawer id={selected} onClose={() => select(undefined)} />
    </>
  );
}
