import { useState } from 'react';
import { useCustomer, useCustomers, useSetUserActive } from '@/api/hooks';
import type { CustomerRow } from '@/api/types';
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Drawer,
  ErrorState,
  Field,
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
import { date, dateTime, fullName, initials, label, money } from '@/lib/format';

const columns: Column<CustomerRow>[] = [
  {
    header: 'Customer',
    cell: (c) => (
      <div className="flex items-center gap-3">
        <Avatar name={initials(c.user)} src={c.user.profilePicture} />
        <div>
          <div className="font-medium">{fullName(c.user)}</div>
          <div className="text-xs text-muted">{c.user.email ?? c.user.phoneNumber}</div>
        </div>
      </div>
    ),
  },
  { header: 'Phone', cell: (c) => <span className="text-muted">{c.user.phoneNumber}</span> },
  { header: 'Status', cell: (c) => <StatusBadge status={c.user.isActive ? 'ACTIVE' : 'BLOCKED'} /> },
  { header: 'Rides', cell: (c) => c.totalRides, className: 'text-right' },
  { header: 'Deliveries', cell: (c) => c.totalDeliveries, className: 'text-right' },
  { header: 'Wallet', cell: (c) => money(c.wallet?.balance), className: 'text-right' },
  { header: 'Joined', cell: (c) => <span className="text-muted">{date(c.user.createdAt)}</span> },
];

function CustomerDrawer({ id, onClose }: { id?: string; onClose: () => void }) {
  const { data: c, isLoading, error } = useCustomer(id);
  const setActive = useSetUserActive();
  const [confirming, setConfirming] = useState(false);

  const close = () => {
    setConfirming(false);
    setActive.reset();
  };

  return (
    <Drawer open={!!id} onClose={onClose} title={c ? fullName(c.user) : 'Customer'}>
      {isLoading ? (
        <Spinner />
      ) : error || !c ? (
        <ErrorState error={error} />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <Avatar name={initials(c.user)} src={c.user.profilePicture} />
            <div className="flex-1">
              <StatusBadge status={c.user.isActive ? 'ACTIVE' : 'BLOCKED'} />
              <div className="mt-1 text-xs text-muted">Customer since {date(c.user.createdAt)}</div>
            </div>
            <Button variant={c.user.isActive ? 'danger' : 'success'} onClick={() => setConfirming(true)}>
              {c.user.isActive ? 'Block account' : 'Unblock account'}
            </Button>
          </div>

          <div className="mb-6 grid grid-cols-3 gap-3">
            {[
              ['Total spent', money(c.totalSpent)],
              ['Wallet balance', money(c.wallet?.balance)],
              ['Trips', `${c.totalRides + c.totalDeliveries}`],
            ].map(([k, v]) => (
              <Card key={k} className="p-4">
                <div className="text-xs text-muted">{k}</div>
                <div className="mt-1 font-semibold">{v}</div>
              </Card>
            ))}
          </div>

          <Section title="Profile">
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Phone">{c.user.phoneNumber}</Field>
              <Field label="Email">{c.user.email ?? '—'}</Field>
              <Field label="Verified">{c.user.isVerified ? 'Yes' : 'No'}</Field>
              <Field label="Rating">{Number(c.rating).toFixed(2)}</Field>
            </dl>
          </Section>

          {c.user.addresses.length > 0 && (
            <Section title="Saved places">
              <ul className="space-y-1.5 text-sm">
                {c.user.addresses.map((a) => (
                  <li key={a.id} className="flex gap-2">
                    <span className="w-24 shrink-0 text-muted">{a.title}</span>
                    <span>
                      {a.streetAddress}, {a.city}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Recent trips">
            <RecentTrips rides={c.rides} deliveries={c.deliveries} counterpart="driver" />
          </Section>

          <Section title="Wallet activity">
            {c.wallet?.transactions.length ? (
              <ul className="divide-y divide-border/60 rounded-lg border border-border text-sm">
                {c.wallet.transactions.map((t) => (
                  <li key={t.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <div>{t.description ?? label(t.type)}</div>
                      <div className="text-xs text-muted">{dateTime(t.createdAt)}</div>
                    </div>
                    <span className={t.type === 'CREDIT' || t.type === 'REFUND' ? 'text-success' : ''}>
                      {t.type === 'CREDIT' || t.type === 'REFUND' ? '+' : '−'}
                      {money(t.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-border p-4 text-center text-sm text-muted">No wallet activity</p>
            )}
          </Section>

          <ConfirmDialog
            open={confirming}
            onClose={close}
            title={`${c.user.isActive ? 'Block' : 'Unblock'} ${fullName(c.user)}?`}
            description={
              c.user.isActive
                ? 'They are signed out on every device and cannot book rides or deliveries until unblocked.'
                : 'They can sign in and book again.'
            }
            confirmLabel={c.user.isActive ? 'Block account' : 'Unblock'}
            variant={c.user.isActive ? 'danger' : 'success'}
            requireReason={c.user.isActive}
            loading={setActive.isPending}
            error={(setActive.error as Error | null)?.message}
            onConfirm={(reason) => setActive.mutate({ userId: c.user.id, isActive: !c.user.isActive, reason }, { onSuccess: close })}
          />
        </>
      )}
    </Drawer>
  );
}

export function CustomersPage() {
  const { values, set, selected, select } = useListParams(['active', 'search'] as const);
  const { data, isLoading, isFetching, error } = useCustomers({ ...values, limit: 20 });

  return (
    <>
      <PageHeader title="Customers" subtitle="Everyone booking rides and deliveries." />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={(values.active || 'all') as 'all' | 'true' | 'false'}
          onChange={(v) => set('active', v === 'all' ? '' : v)}
          tabs={[
            { id: 'all', label: 'All' },
            { id: 'true', label: 'Active' },
            { id: 'false', label: 'Blocked' },
          ]}
        />
        <SearchInput value={values.search} onChange={(v) => set('search', v)} placeholder="Search name, phone, email…" />
      </div>

      {error ? (
        <ErrorState error={error} />
      ) : (
        <Card className={isFetching ? 'opacity-80' : ''}>
          <DataTable columns={columns} rows={data?.items} loading={isLoading} onRowClick={(c) => select(c.id)} empty="No customers match these filters" />
          {data && <Pagination page={values.page} totalPages={data.meta.totalPages} total={data.meta.total} onPage={(p) => set('page', p)} />}
        </Card>
      )}

      <CustomerDrawer id={selected} onClose={() => select(undefined)} />
    </>
  );
}
