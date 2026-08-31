import { useState } from 'react';
import { Button } from './components/ui/Button';
import { Spinner } from './components/ui/Spinner';
import { useAuth } from './hooks/useAuth';
import { cx } from './lib/cx';
import { AdminRooms } from './pages/AdminRooms';
import { BookingForm } from './pages/BookingForm';
import { Login } from './pages/Login';
import { MyBookings } from './pages/MyBookings';
import { BookingPrefill, RoomGrid } from './pages/RoomGrid';

type Page = 'grid' | 'form' | 'bookings' | 'admin';

/** App shell: header + nav + the active page. Unauthenticated users see Login. */
export function App() {
  const { user, ready, logout } = useAuth();
  const [page, setPage] = useState<Page>('grid');
  const [prefill, setPrefill] = useState<BookingPrefill | null>(null);

  if (!ready) {
    return (
      <div className="app-boot" role="status" aria-live="polite">
        <Spinner label="Starting DeskBoard" />
      </div>
    );
  }
  if (!user) return <Login />;

  const navItems: { id: Page; label: string }[] = [
    { id: 'grid', label: 'Room grid' },
    { id: 'bookings', label: 'My bookings' },
    ...(user.role === 'admin' ? [{ id: 'admin' as Page, label: 'Manage rooms' }] : []),
  ];

  function book(pre: BookingPrefill) {
    setPrefill(pre);
    setPage('form');
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="brand">DeskBoard</span>
        <nav aria-label="Main navigation" className="app-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cx('nav-link', page === item.id && 'nav-link-active')}
              aria-current={page === item.id ? 'page' : undefined}
              onClick={() => {
                if (item.id !== 'form') setPrefill(null);
                setPage(item.id);
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="user-menu">
          <span className="user-name">
            {user.name} <span className="muted">({user.role})</span>
          </span>
          <Button variant="secondary" onClick={logout}>
            Log out
          </Button>
        </div>
      </header>

      <main className="container">
        {page === 'grid' && <RoomGrid onBook={book} />}
        {page === 'form' && <BookingForm prefill={prefill} onBooked={() => setPage('grid')} />}
        {page === 'bookings' && <MyBookings onBrowse={() => setPage('grid')} />}
        {page === 'admin' && <AdminRooms />}
      </main>

      <footer className="app-footer">
        <span className="muted">DeskBoard — internal meeting-room booking</span>
      </footer>
    </div>
  );
}
