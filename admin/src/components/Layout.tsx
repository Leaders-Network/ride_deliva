import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Bike, Car, CreditCard, LayoutDashboard, LogOut, Menu, Package, Users, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useStats } from '@/api/hooks';
import { Avatar, cn } from './ui';
import { initials, label } from '@/lib/format';

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
        <Car className="h-5 w-5 text-white" />
      </div>
      <div className="leading-tight">
        <div className="font-semibold">Ride Deliva</div>
        <div className="text-[11px] text-muted">Admin console</div>
      </div>
    </div>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const { data: stats } = useStats();
  const [open, setOpen] = useState(false);

  const nav = [
    { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/drivers', label: 'Drivers', icon: Bike, badge: stats?.drivers.byStatus.PENDING },
    { to: '/customers', label: 'Customers', icon: Users },
    { to: '/rides', label: 'Rides', icon: Car, badge: stats?.rides.active },
    { to: '/deliveries', label: 'Deliveries', icon: Package, badge: stats?.deliveries.active },
    { to: '/payments', label: 'Payments', icon: CreditCard },
  ];

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map(({ to, label: text, icon: Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-primary/15 text-text' : 'text-muted hover:bg-surface-2 hover:text-text'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('h-[18px] w-[18px]', isActive && 'text-primary')} />
                <span className="flex-1">{text}</span>
                {!!badge && <span className="rounded-full bg-primary px-1.5 py-px text-[11px] font-semibold text-white">{badge}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      {user && (
        <div className="m-3 flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3">
          <Avatar name={initials(user)} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {user.firstName} {user.lastName}
            </div>
            <div className="text-xs text-muted">{label(user.role)}</div>
          </div>
          <button onClick={logout} className="rounded-md p-1.5 text-muted hover:bg-surface hover:text-text" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-64 border-r border-border bg-surface">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
          <Logo />
          <button onClick={() => setOpen(!open)} className="rounded-md p-2 text-muted hover:bg-surface-2" aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
