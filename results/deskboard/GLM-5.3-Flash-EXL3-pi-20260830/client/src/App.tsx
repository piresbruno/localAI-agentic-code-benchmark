/** App shell: header with brand, nav, user menu; hash-based routing. */
import { useState } from 'react';
import { APP_NAME } from 'deskboard-shared';
import { useAuth } from './hooks/useAuth.js';
import { useHashRoute } from './hooks/useHashRoute.js';
import { LoginPage } from './pages/LoginPage.js';
import { RoomGridPage } from './pages/RoomGridPage.js';
import { BookingFormPage } from './pages/BookingFormPage.js';
import { MyBookingsPage } from './pages/MyBookingsPage.js';
import { AdminRoomsPage } from './pages/AdminRoomsPage.js';
import { Button } from './components/ui/Button.js';
import { ToastProvider } from './components/ui/Toast.jsx';
import { todayIso } from './logic/slots.js';

const NAV = [
  { path: '/rooms', label: 'Rooms' },
  { path: '/bookings', label: 'My bookings' },
  { path: '/admin', label: 'Admin', adminOnly: true }
];

function Shell() {
  const { user, ready, logout } = useAuth();
  const [route, navigate] = useHashRoute();
  const [gridDate, setGridDate] = useState(todayIso());
  const [bookingsKey, setBookingsKey] = useState(0);

  if (!ready) {
    return (
      <div className="state" role="status">
        <p>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onDone={() => navigate('/rooms')} />;
  }

  const path = route.path;

  const currentPage = (() => {
    if (path === '/book/new') {
      return (
        <BookingFormPage
          prefill={{
            roomId: route.query.get('roomId') ?? undefined,
            date: route.query.get('date') ?? undefined,
            startTime: route.query.get('start') ?? undefined
          }}
          onBooked={() => {
            setBookingsKey((k) => k + 1);
            navigate('/bookings');
          }}
        />
      );
    }
    if (path === '/bookings') {
      return <MyBookingsPage reloadKey={bookingsKey} />;
    }
    if (path === '/admin' && user.role === 'admin') {
      return <AdminRoomsPage />;
    }
    return (
      <RoomGridPage
        date={gridDate}
        onDateChange={setGridDate}
        onSlotClick={(roomId, slotStart) =>
          navigate(`/book/new?roomId=${roomId}&date=${gridDate}&start=${slotStart}`)
        }
      />
    );
  })();

  return (
    <>
      <header className="app-header">
        <a
          className="app-header__brand"
          href="#/rooms"
          onClick={(e) => {
            e.preventDefault();
            navigate('/rooms');
          }}
        >
          {APP_NAME}
        </a>
        <nav className="app-header__nav" aria-label="Main navigation">
          {NAV.filter((n) => !n.adminOnly || user.role === 'admin').map((n) => (
            <a
              key={n.path}
              href={`#${n.path}`}
              className="app-header__link"
              aria-current={path === n.path ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigate(n.path);
              }}
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="row">
          <span className="muted">{user.name}</span>
          <Button variant="secondary" onClick={logout} aria-label="Log out">
            Log out
          </Button>
        </div>
      </header>
      <main className="container">{currentPage}</main>
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
