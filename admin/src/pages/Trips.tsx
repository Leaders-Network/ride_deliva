import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Navigation } from 'lucide-react';
import { useCancelTrip, useDeliveries, useDelivery, useRide, useRides } from '@/api/hooks';
import type { TripRow } from '@/api/types';
import {
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
  Select,
  Spinner,
  StatusBadge,
  type Column,
} from '@/components/ui';
import { useListParams } from '@/lib/useListParams';
import { dateTime, fullName, label, money, toNum } from '@/lib/format';

type Kind = 'rides' | 'deliveries';

const CONFIG = {
  rides: {
    title: 'Rides',
    subtitle: 'Every ride request across the platform.',
    singular: 'ride',
    statuses: ['REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
    terminal: ['COMPLETED', 'CANCELLED'],
  },
  deliveries: {
    title: 'Deliveries',
    subtitle: 'Every package delivery across the platform.',
    singular: 'delivery',
    statuses: ['REQUESTED', 'ACCEPTED', 'DRIVER_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'],
    terminal: ['DELIVERED', 'CANCELLED'],
  },
} as const;

const codeOf = (t: { rideCode?: string; deliveryCode?: string }) => t.rideCode ?? t.deliveryCode ?? '';
const typeOf = (t: { rideType?: string; deliveryType?: string }) => t.rideType ?? t.deliveryType ?? '';

const columns: Column<TripRow & { rideCode?: string; deliveryCode?: string; rideType?: string; deliveryType?: string }>[] = [
  {
    header: 'Trip',
    cell: (t) => (
      <div>
        <div className="font-mono text-xs">{codeOf(t)}</div>
        <div className="text-xs text-muted">{label(typeOf(t))}</div>
      </div>
    ),
  },
  {
    header: 'Route',
    cell: (t) => (
      <div className="max-w-xs text-xs">
        <div className="truncate">{t.pickupAddress.streetAddress}</div>
        <div className="truncate text-muted">→ {t.destinationAddress.streetAddress}</div>
      </div>
    ),
  },
  { header: 'Customer', cell: (t) => fullName(t.customer.user) },
  { header: 'Driver', cell: (t) => (t.driver ? fullName(t.driver.user) : <span className="text-muted">Unassigned</span>) },
  { header: 'Status', cell: (t) => <StatusBadge status={t.status} /> },
  { header: 'Fare', cell: (t) => money(t.finalFare ?? t.estimatedFare), className: 'text-right' },
  { header: 'Requested', cell: (t) => <span className="whitespace-nowrap text-muted">{dateTime(t.requestedAt)}</span> },
];

function TripDrawer({ kind, id, onClose }: { kind: Kind; id?: string; onClose: () => void }) {
  const ride = useRide(kind === 'rides' ? id : undefined);
  const delivery = useDelivery(kind === 'deliveries' ? id : undefined);
  const { data: t, isLoading, error } = kind === 'rides' ? ride : delivery;
  const cancel = useCancelTrip(kind);
  const [confirming, setConfirming] = useState(false);
  const cfg = CONFIG[kind];

  const timeline = t
    ? ([
        ['Requested', t.requestedAt],
        ['Accepted', t.acceptedAt],
        [kind === 'rides' ? 'Started' : 'Picked up', t.startedAt ?? t.pickedUpAt],
        [kind === 'rides' ? 'Completed' : 'Delivered', t.completedAt ?? t.deliveredAt],
        ['Cancelled', t.cancelledAt],
      ].filter(([, at]) => at) as [string, string][])
    : [];

  return (
    <Drawer open={!!id} onClose={onClose} title={t ? <span className="font-mono">{codeOf(t)}</span> : cfg.title}>
      {isLoading ? (
        <Spinner />
      ) : error || !t ? (
        <ErrorState error={error} />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <StatusBadge status={t.status} />
              <span className="text-sm text-muted">{label(typeOf(t))}</span>
            </div>
            {!(cfg.terminal as readonly string[]).includes(t.status) && (
              <Button variant="danger" onClick={() => setConfirming(true)}>
                Cancel {cfg.singular}
              </Button>
            )}
          </div>

          <Card className="mb-6 p-4">
            <div className="flex gap-3">
              <div className="flex flex-col items-center pt-1">
                <Navigation className="h-4 w-4 text-primary" />
                <div className="my-1 w-px flex-1 bg-border" />
                <MapPin className="h-4 w-4 text-danger" />
              </div>
              <div className="flex-1 space-y-4 text-sm">
                <div>
                  <div className="text-xs text-muted">Pickup</div>
                  {t.pickupAddress.streetAddress}, {t.pickupAddress.city}
                </div>
                <div>
                  <div className="text-xs text-muted">Destination</div>
                  {t.destinationAddress.streetAddress}, {t.destinationAddress.city}
                </div>
              </div>
            </div>
          </Card>

          <Section title="Details">
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Customer">
                <Link className="text-primary hover:underline" to={`/customers?id=${t.customer.id}`}>
                  {fullName(t.customer.user)}
                </Link>
                <div className="text-xs text-muted">{t.customer.user.phoneNumber}</div>
              </Field>
              <Field label="Driver">
                {t.driver ? (
                  <>
                    <Link className="text-primary hover:underline" to={`/drivers?id=${t.driver.id}`}>
                      {fullName(t.driver.user)}
                    </Link>
                    <div className="text-xs text-muted">{t.driver.user.phoneNumber}</div>
                  </>
                ) : (
                  'Unassigned'
                )}
              </Field>
              <Field label="Vehicle">
                {t.vehicle ? `${t.vehicle.make} ${t.vehicle.model} · ${t.vehicle.licensePlate}` : '—'}
              </Field>
              <Field label="Distance">
                {toNum(t.actualDistance ?? t.estimatedDistance).toFixed(1)} km
                {t.actualDistance ? '' : ' (est.)'}
              </Field>
              <Field label="Estimated fare">{money(t.estimatedFare)}</Field>
              <Field label="Final fare">{t.finalFare ? money(t.finalFare) : '—'}</Field>
              {t.surgeMultiplier !== undefined && toNum(t.surgeMultiplier) > 1 && (
                <Field label="Surge">{toNum(t.surgeMultiplier)}×</Field>
              )}
              <Field label="Payment">{t.payment ? `${label(t.payment.method)} · ${label(t.payment.status)}` : 'Not paid yet'}</Field>
              {t.packageDetails && (
                <Field label="Package">
                  {t.packageDetails.description} {t.packageDetails.weight ? `· ${t.packageDetails.weight} kg` : ''}
                </Field>
              )}
              {t.recipientInfo && (
                <Field label="Recipient">
                  {t.recipientInfo.name} · {t.recipientInfo.phoneNumber}
                </Field>
              )}
              {t.cancellationReason && <Field label="Cancellation reason">{t.cancellationReason}</Field>}
            </dl>
          </Section>

          <Section title="Timeline">
            <ol className="space-y-2 border-l border-border pl-4 text-sm">
              {timeline.map(([what, at]) => (
                <li key={what} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                  <span className="font-medium">{what}</span> <span className="text-muted">· {dateTime(at)}</span>
                </li>
              ))}
            </ol>
          </Section>

          {t.reviews.length > 0 && (
            <Section title="Review">
              {t.reviews.map((r, i) => (
                <div key={i} className="rounded-lg border border-border p-3 text-sm">
                  <span className="text-warning">{'★'.repeat(r.rating)}</span>
                  {r.comment && <p className="mt-1 text-muted">{r.comment}</p>}
                </div>
              ))}
            </Section>
          )}

          <ConfirmDialog
            open={confirming}
            onClose={() => {
              setConfirming(false);
              cancel.reset();
            }}
            title={`Cancel ${cfg.singular} ${codeOf(t)}?`}
            description="The customer and driver are released and the driver becomes available again."
            confirmLabel={`Cancel ${cfg.singular}`}
            variant="danger"
            requireReason
            loading={cancel.isPending}
            error={(cancel.error as Error | null)?.message}
            onConfirm={(reason) => cancel.mutate({ id: t.id, reason: reason! }, { onSuccess: () => setConfirming(false) })}
          />
        </>
      )}
    </Drawer>
  );
}

export function TripsPage({ kind }: { kind: Kind }) {
  const cfg = CONFIG[kind];
  const { values, set, selected, select } = useListParams(['status', 'search', 'from', 'to'] as const);
  const params = { ...values, limit: 20 };
  const rides = useRides(params, kind === 'rides');
  const deliveries = useDeliveries(params, kind === 'deliveries');
  const { data, isLoading, isFetching, error } = kind === 'rides' ? rides : deliveries;

  const dateInput = 'rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-primary [color-scheme:dark]';

  return (
    <>
      <PageHeader title={cfg.title} subtitle={cfg.subtitle} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={values.search} onChange={(v) => set('search', v)} placeholder="Search code, customer, driver…" />
        <Select value={values.status} onChange={(v) => set('status', v)} options={cfg.statuses} placeholder="All statuses" />
        <input type="date" aria-label="From" className={dateInput} value={values.from} onChange={(e) => set('from', e.target.value)} />
        <input type="date" aria-label="To" className={dateInput} value={values.to} onChange={(e) => set('to', e.target.value)} />
      </div>

      {error ? (
        <ErrorState error={error} />
      ) : (
        <Card className={isFetching ? 'opacity-80' : ''}>
          <DataTable columns={columns} rows={data?.items} loading={isLoading} onRowClick={(t) => select(t.id)} empty={`No ${kind} match these filters`} />
          {data && <Pagination page={values.page} totalPages={data.meta.totalPages} total={data.meta.total} onPage={(p) => set('page', p)} />}
        </Card>
      )}

      <TripDrawer kind={kind} id={selected} onClose={() => select(undefined)} />
    </>
  );
}
