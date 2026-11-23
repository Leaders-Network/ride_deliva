import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError, onSessionChange, session, type Session } from '@/api/client';

interface LoginResponse {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    email?: string;
    adminProfile?: { role: string } | null;
  };
  tokens: { accessToken: string; refreshToken: string };
}

interface AuthValue {
  user: Session['user'] | null;
  login: (phoneNumber: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState(session.get());
  const qc = useQueryClient();

  useEffect(() => {
    const off = onSessionChange((s) => {
      setCurrent(s);
      if (!s) qc.clear(); // never show one admin's cached data to the next
    });
    return () => {
      off();
    };
  }, [qc]);

  const login = async (phoneNumber: string, password: string) => {
    const { data } = await api.post<LoginResponse>('/auth/login', { phoneNumber, password });
    // The API would 403 every admin call anyway; fail early with a clear message.
    if (!data.user.adminProfile) throw new ApiError('This account does not have admin access', 403);
    session.set({
      ...data.tokens,
      user: {
        id: data.user.id,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        phoneNumber: data.user.phoneNumber,
        email: data.user.email,
        role: data.user.adminProfile.role,
      },
    });
  };

  const logout = async () => {
    await api.post('/auth/logout').catch(() => undefined);
    session.set(null);
  };

  return <AuthContext.Provider value={{ user: current?.user ?? null, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
