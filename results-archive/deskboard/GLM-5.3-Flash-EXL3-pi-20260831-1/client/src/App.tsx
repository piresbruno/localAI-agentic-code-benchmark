import { Link, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Button } from './components/ui/Button';
import { LoadingBlock } from './components/States';
import { Login } from './pages/Login';
import { RoomGrid } from './pages/RoomGrid';
import { BookingForm } from './pages/BookingForm';
import { MyBookings } from './pages/MyBookings';
import { AdminRooms } from './pages/AdminRooms';

/** Page scaffold (spec §7.6): header with brand, nav, user menu + routes with guards. */
export function App() {
  const { user, restoring, logout } = useAuth();
  const navigate = useNavigate();

  if (restoring) {
    return (
      <Shell user={null} onLogout={() => undefined}>
        <LoadingBlock label="Restoring session…" />
      </Shell>
    );
  }

  return (
    <Shell
      user={user}
      onLogout={() => {
        logout();
        navigate('/login');
      }}
    >
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route
          path="/"
          element={
            <RequireAuth user={user}>
              <RoomGrid />
            </RequireAuth>
          }
        />
        <Route
          path="/book"
          element={
            <RequireAuth user={user}>
              <BookingForm />
            </RequireAuth>
          }
        />
        <Route
          path="/my"
          element={
            <RequireAuth user={user}>
              <MyBookings />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/rooms"
          element={
            <RequireAuth user={user}>
              <AdminRooms />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

function RequireAuth({ user, children }: { user: unknown; children: React.ReactNode }) {
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Shell({
  user,
  onLogout,
  children,
}: {
  user: { name: string; role: string } | null;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="header">
        <div className="header__inner">
          <Link to="/" className="header__brand">
            DeskBoard
          </Link>
          {user && (
            <nav className="header__nav" aria-label="Main navigation">
              <NavLink to="/" end className={({ isActive }) => `header__link${isActive ? ' header__link--active' : ''}`}>
                Rooms
              </NavLink>
              <NavLink to="/my" className={({ isActive }) => `header__link${isActive ? ' header__link--active' : ''}`}>
                My bookings
              </NavLink>
              {user.role === 'admin' && (
                <NavLink
                  to="/admin/rooms"
                  className={({ isActive }) => `header__link${isActive ? ' header__link--active' : ''}`}
                >
                  Admin
                </NavLink>
              )}
            </nav>
          )}
          <div className="header__spacer" />
          {user && (
            <div className="header__user">
              <span>
                {user.name} · {user.role}
              </span>
              <Button variant="secondary" onClick={onLogout}>
                Log out
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className="container">{children}</main>
    </>
  );
}
