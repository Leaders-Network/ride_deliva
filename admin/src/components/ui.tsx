import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Loader2, Search, X } from 'lucide-react';
import { label } from '@/lib/format';

export const cn = clsx;

// ----------------------------------------------------------------------------- layout
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-xl border border-border bg-surface', className)}>{children}</div>;
}

export function CardHeader({ title, action, subtitle }: { title: string; action?: ReactNode; subtitle?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

// ----------------------------------------------------------------------------- controls
type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'bg-surface-2 text-text border border-border hover:border-muted/50',
  danger: 'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25',
  success: 'bg-success/15 text-success border border-success/30 hover:bg-success/25',
  ghost: 'text-muted hover:text-text hover:bg-surface-2',
};

export function Button({
  variant = 'secondary',
  loading,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  // Debounce so typing doesn't fire a request per keystroke.
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    const t = setTimeout(() => text !== value && onChange(text), 300);
    return () => clearTimeout(t);
  }, [text, value, onChange]);

  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-surface-2 py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted focus:border-primary"
      />
    </div>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: T | '';
  onChange: (v: T | '') => void;
  options: readonly T[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T | '')}
      className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-primary"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {label(o)}
        </option>
      ))}
    </select>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { id: T; label: string; count?: number }[] }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === t.id ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cn('rounded-full px-1.5 text-xs', value === t.id ? 'bg-primary text-white' : 'bg-surface-2')}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------- status
const tone = {
  green: 'bg-success/15 text-success',
  amber: 'bg-warning/15 text-warning',
  red: 'bg-danger/15 text-danger',
  blue: 'bg-primary/20 text-[#7fa3ff]',
  sky: 'bg-info/15 text-info',
  gray: 'bg-surface-2 text-muted',
};
const STATUS_TONE: Record<string, keyof typeof tone> = {
  APPROVED: 'green',
  COMPLETED: 'green',
  DELIVERED: 'green',
  ACTIVE: 'green',
  PENDING: 'amber',
  REQUESTED: 'amber',
  PROCESSING: 'amber',
  REJECTED: 'red',
  SUSPENDED: 'red',
  CANCELLED: 'red',
  FAILED: 'red',
  BLOCKED: 'red',
  INACTIVE: 'gray',
  REFUNDED: 'gray',
  ACCEPTED: 'blue',
  DRIVER_ASSIGNED: 'blue',
  DRIVER_ARRIVING: 'blue',
  DRIVER_ARRIVED: 'blue',
  IN_PROGRESS: 'sky',
  PICKED_UP: 'sky',
  IN_TRANSIT: 'sky',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', tone[STATUS_TONE[status] ?? 'gray'])}>
      {label(status)}
    </span>
  );
}

export function OnlineDot({ online }: { online: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className={cn('h-2 w-2 rounded-full', online ? 'bg-success shadow-[0_0_6px] shadow-success' : 'bg-border')} />
      {online ? 'Online' : 'Offline'}
    </span>
  );
}

export function Avatar({ name, src }: { name: string; src?: string | null }) {
  return src ? (
    <img src={src} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
  ) : (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-[#9db8ff]">
      {name}
    </div>
  );
}

// ----------------------------------------------------------------------------- table
export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  onRowClick,
  empty = 'Nothing to show yet',
}: {
  columns: Column<T>[];
  rows?: T[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  empty?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
            {columns.map((c) => (
              <th key={c.header} className={cn('px-5 py-3 font-medium', c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && !rows ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-16 text-center text-muted">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </td>
            </tr>
          ) : rows?.length ? (
            rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={cn('border-b border-border/60 last:border-0', onRowClick && 'cursor-pointer hover:bg-surface-2/60')}
              >
                {columns.map((c) => (
                  <td key={c.header} className={cn('px-5 py-3', c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-5 py-16 text-center text-muted">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted">
      <span>
        {total} result{total === 1 ? '' : 's'}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" className="px-2" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span>
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <Button variant="ghost" className="px-2" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------- overlays
export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-2xl flex-col border-l border-border bg-bg shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="min-w-0 font-semibold">{title}</div>
          <Button variant="ghost" className="px-2" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </aside>
    </div>
  );
}

/** Confirmation modal that optionally collects a reason (required for destructive admin actions). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  variant = 'primary',
  requireReason,
  loading,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: Variant;
  requireReason?: boolean;
  loading?: boolean;
  error?: string | null;
  onConfirm: (reason?: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  if (!open) return null;
  const valid = !requireReason || reason.trim().length >= 3;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-1.5 text-sm text-muted">{description}</p>
        {requireReason && (
          <textarea
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (shared with the user)"
            rows={3}
            className="mt-4 w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-primary"
          />
        )}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={variant} loading={loading} disabled={!valid} onClick={() => onConfirm(reason.trim() || undefined)}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------- misc
export function Spinner() {
  return (
    <div className="flex justify-center py-16 text-muted">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  return (
    <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
      {error instanceof Error ? error.message : 'Something went wrong'}
    </div>
  );
}

export function Field({ label: l, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{l}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h4>
        {action}
      </div>
      {children}
    </section>
  );
}
