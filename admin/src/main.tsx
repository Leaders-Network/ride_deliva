import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/pages/Login';
import { OverviewPage } from '@/pages/Overview';
import { DriversPage } from '@/pages/Drivers';
import { CustomersPage } from '@/pages/Customers';
import { TripsPage } from '@/pages/Trips';
import { PaymentsPage } from '@/pages/Payments';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // Don't hammer the API retrying auth/validation failures.
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    },
  },
});

function Protected() {
  const { user } = useAuth();
  return user ? <Layout /> : <Navigate to="/login" replace />;
}

function PublicOnly() {
  const { user } = useAuth();
  return user ? <Navigate to="/" replace /> : <LoginPage />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<PublicOnly />} />
            <Route element={<Protected />}>
              <Route index element={<OverviewPage />} />
              <Route path="drivers" element={<DriversPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="rides" element={<TripsPage kind="rides" />} />
              <Route path="deliveries" element={<TripsPage kind="deliveries" />} />
              <Route path="payments" element={<PaymentsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
