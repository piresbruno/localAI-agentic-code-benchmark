import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './components/ui/Toast';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { RoomGridPage } from './pages/RoomGridPage';
import { BookingFormPage } from './pages/BookingFormPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { AdminRoomsPage } from './pages/AdminRoomsPage';
import './styles/tokens.css';
import './styles/global.css';
import './styles/app.css';

function Protected({ children }: { children: React.ReactNode }) {
  const { user, booting } = useAuth();
  if (booting) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route path="/" element={<RoomGridPage />} />
        <Route path="/bookings/new" element={<BookingFormPage />} />
        <Route path="/my-bookings" element={<MyBookingsPage />} />
        <Route
          path="/admin/rooms"
          element={
            <AdminOnly>
              <AdminRoomsPage />
            </AdminOnly>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
