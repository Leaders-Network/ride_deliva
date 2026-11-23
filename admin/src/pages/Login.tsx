import { useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { Logo } from '@/components/Layout';
import { Button } from '@/components/ui';

export function LoginPage() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(phone.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const input =
    'w-full rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-sm outline-none placeholder:text-muted focus:border-primary';

  return (
    <div className="flex min-h-full items-center justify-center bg-[radial-gradient(ellipse_at_top,rgba(31,94,255,0.18),transparent_60%)] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <form onSubmit={submit} className="rounded-2xl border border-border bg-surface p-6 shadow-2xl">
          <h1 className="text-xl font-semibold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">Sign in to manage drivers, customers and trips.</p>

          <label className="mt-6 block text-xs font-medium text-muted" htmlFor="phone">
            Phone number
          </label>
          <input
            id="phone"
            className={`${input} mt-1.5`}
            placeholder="+234 801 234 5678"
            autoComplete="username"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />

          <label className="mt-4 block text-xs font-medium text-muted" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className={`${input} mt-1.5`}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

          <Button type="submit" variant="primary" loading={loading} className="mt-6 w-full py-2.5">
            Continue
          </Button>

          <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted">
            <ShieldCheck className="h-3.5 w-3.5" /> Admin accounts only
          </p>
        </form>
        {import.meta.env.DEV && (
          <p className="mt-4 text-center text-xs text-muted">Seeded admin: +2348012345678 · admin123!@#</p>
        )}
      </div>
    </div>
  );
}
