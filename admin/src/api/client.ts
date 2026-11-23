const BASE = import.meta.env.VITE_API_URL ?? '/api/v1';
const STORAGE_KEY = 'rd_admin_session';

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; firstName: string; lastName: string; phoneNumber: string; email?: string; role: string };
}

export interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: { page: number; limit: number; total: number; totalPages: number; summary?: unknown };
  error?: { code: string; message: string; details?: unknown };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
  }
}

export const session = {
  get(): Session | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  },
  set(s: Session | null) {
    try {
      if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable: session lives only in memory for this tab */
    }
    listeners.forEach((l) => l(s));
  },
};

const listeners = new Set<(s: Session | null) => void>();
export const onSessionChange = (fn: (s: Session | null) => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

// One refresh at a time, even if several requests 401 together.
let refreshing: Promise<boolean> | null = null;
async function refresh(): Promise<boolean> {
  const current = session.get();
  if (!current) return false;
  refreshing ??= fetch(`${BASE}/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) return false;
      const body = (await res.json()) as Envelope<{ tokens: { accessToken: string; refreshToken: string } }>;
      session.set({ ...current, ...body.data.tokens });
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<Envelope<T>> {
  const token = session.get()?.accessToken;
  const unreachable = () => new ApiError('Cannot reach the API server. Is the backend running on port 3000?', 503, 'API_UNREACHABLE');
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...init.headers,
    },
  }).catch(() => {
    throw unreachable();
  });

  if (res.status === 401 && retry && token) {
    if (await refresh()) return request<T>(path, init, false);
    session.set(null);
  }

  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  // The Vite dev proxy answers with an empty 5xx when the backend is down.
  if (!body && res.status >= 500) throw unreachable();
  if (!res.ok || !body?.success) {
    const message = body?.error?.message ?? body?.message ?? `Request failed (${res.status})`;
    throw new ApiError(message, res.status, body?.error?.code);
  }
  return body;
}

export const api = {
  get: <T>(path: string, params?: Record<string, unknown>) => {
    const qs = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    const q = qs.toString();
    return request<T>(q ? `${path}?${q}` : path);
  },
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
};
