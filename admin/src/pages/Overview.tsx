import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Bike, Car, Package, Users, Wallet } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStats } from '@/api/hooks';
import type { Stats } from '@/api/types';
import { Avatar, Card, CardHeader, ErrorState, PageHeader, Spinner, StatusBadge } from '@/components/ui';
import { ago, fullName, initials, label, money, moneyCompact } from '@/lib/format';

const CHART = { primary: '#1f5eff', info: '#38bdf8', grid: '#232735', axis: '#8a90a2' };
const tooltipStyle = {
  contentStyle: { background: '#161923', border: '1px solid #232735', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#eef0f5' },
};
const dayLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-NG', { weekday: 'short' });

function Kpi({ icon: Icon, label: l, value, sub }: { icon: typeof Car; label: string; value: string | number; sub: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{l}</span>
        <span className="rounded-lg bg-primary/15 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-muted">{sub}</div>
    </Card>
  );
}

function StatusBars({ data, order }: { data: Record<string, number | undefined>; order: string[] }) {
  const total = order.reduce((a, k) => a + (data[k] ?? 0), 0) || 1;
  return (
    <div className="space-y-3 p-5">
      {order.map((k) => (
        <div key={k}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-muted">{label(k)}</span>
            <span className="font-medium">{data[k] ?? 0}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-2">
            <div className="h-1.5 rounded-full bg-primary" style={{ width: `${((data[k] ?? 0) / total) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PendingDrivers({ drivers }: { drivers: Stats['pendingDrivers'] }) {
  const navigate = useNavigate();
  return (
    <Card>
      <CardHeader
        title="Awaiting approval"
        subtitle="New driver applications"
        action={
          <Link to="/drivers?status=PENDING" className="flex items-center gap-1 text-xs text-primary hover:underline">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        }
      />
      {drivers.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">No pending applications 🎉</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {drivers.map((d) => (
            <li
              key={d.id}
              onClick={() => navigate(`/drivers?status=PENDING&id=${d.id}`)}
              className="flex cursor-pointer items-center gap-3 px-5 py-3 hover:bg-surface-2/60"
            >
              <Avatar name={initials(d.user)} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{fullName(d.user)}</div>
                <div className="truncate text-xs text-muted">
                  {d.vehicles[0] ? `${d.vehicles[0].make} ${d.vehicles[0].model} · ${d.vehicles[0].licensePlate}` : 'No vehicle'}
                </div>
              </div>
              <span className="text-xs text-muted">{ago(d.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function OverviewPage() {
  const { data, isLoading, error } = useStats();

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorState error={error} />;

  const trend = data.trend.map((t) => ({ ...t, day: dayLabel(t.date) }));

  return (
    <>
      <PageHeader title="Overview" subtitle="Live snapshot of the platform. Refreshes every 30 seconds." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Wallet} label="Revenue" value={money(data.revenue.total)} sub={`${money(data.revenue.today)} today · ${money(data.revenue.commission)} commission`} />
        <Kpi icon={Car} label="Rides" value={data.rides.total} sub={`${data.rides.today} today · ${data.rides.active} in progress`} />
        <Kpi icon={Package} label="Deliveries" value={data.deliveries.total} sub={`${data.deliveries.today} today · ${data.deliveries.active} in progress`} />
        <Kpi
          icon={Bike}
          label="Drivers"
          value={data.drivers.total}
          sub={`${data.drivers.online} online · ${data.drivers.byStatus.PENDING ?? 0} pending approval`}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Trips, last 7 days" subtitle="Requested rides and deliveries per day" />
          <div className="h-72 p-4">
            <ResponsiveContainer>
              <BarChart data={trend} barGap={4}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="day" stroke={CHART.axis} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={CHART.axis} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="rides" name="Rides" fill={CHART.primary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="deliveries" name="Deliveries" fill={CHART.info} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <PendingDrivers drivers={data.pendingDrivers} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Revenue, last 7 days" subtitle="Completed payments" />
          <div className="h-64 p-4">
            <ResponsiveContainer>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART.primary} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={CHART.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="day" stroke={CHART.axis} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={CHART.axis} fontSize={12} tickLine={false} axisLine={false} tickFormatter={moneyCompact} width={56} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => money(v)} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke={CHART.primary} strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Driver fleet"
            action={
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <Users className="h-3.5 w-3.5" /> {data.customers.total} customers
              </span>
            }
          />
          <StatusBars data={data.drivers.byStatus} order={['APPROVED', 'PENDING', 'SUSPENDED', 'REJECTED', 'INACTIVE']} />
          <div className="flex flex-wrap gap-2 border-t border-border px-5 py-4">
            {Object.entries(data.rides.byStatus)
              .filter(([s]) => !['COMPLETED', 'CANCELLED'].includes(s))
              .map(([s, n]) => (
                <span key={s} className="flex items-center gap-1.5 text-xs text-muted">
                  <StatusBadge status={s} /> {n}
                </span>
              ))}
          </div>
        </Card>
      </div>
    </>
  );
}
