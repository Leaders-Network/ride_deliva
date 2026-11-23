import { Link } from 'react-router-dom';
import type { DeliveryRow, RideRow } from '@/api/types';
import { dateTime, fullName, money } from '@/lib/format';
import { StatusBadge } from './ui';

type Trip = (RideRow | DeliveryRow) & { kind: 'rides' | 'deliveries' };

/** Rides and deliveries merged into one timeline for driver/customer detail drawers. */
export function RecentTrips({ rides, deliveries, counterpart }: { rides: RideRow[]; deliveries: DeliveryRow[]; counterpart: 'driver' | 'customer' }) {
  const trips: Trip[] = [
    ...rides.map((r) => ({ ...r, kind: 'rides' as const })),
    ...deliveries.map((d) => ({ ...d, kind: 'deliveries' as const })),
  ]
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
    .slice(0, 10);

  if (!trips.length) return <p className="rounded-lg border border-border p-4 text-center text-sm text-muted">No trips yet</p>;

  return (
    <ul className="divide-y divide-border/60 rounded-lg border border-border">
      {trips.map((t) => {
        const code = 'rideCode' in t ? t.rideCode : t.deliveryCode;
        const other = counterpart === 'driver' ? t.driver?.user : t.customer.user;
        return (
          <li key={t.id}>
            <Link to={`/${t.kind}?id=${t.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface-2/60">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">{code}</span>
                  <span className="text-xs text-muted">{t.kind === 'rides' ? 'Ride' : 'Delivery'}</span>
                </div>
                <div className="truncate text-xs text-muted">
                  {t.pickupAddress.streetAddress} → {t.destinationAddress.streetAddress}
                </div>
                <div className="text-xs text-muted">
                  {dateTime(t.requestedAt)} · {counterpart === 'driver' ? 'Driver' : 'Customer'}: {fullName(other)}
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">{money(t.finalFare ?? t.estimatedFare)}</div>
                <StatusBadge status={t.status} />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
