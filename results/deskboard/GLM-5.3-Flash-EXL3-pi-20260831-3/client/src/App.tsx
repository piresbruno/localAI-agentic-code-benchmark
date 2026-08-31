import { useCallback, useEffect, useState } from 'react';
import type { Room } from '@deskboard/shared';
import { api } from './api/client.js';
import { AuthProvider, useAuth } from './hooks/useAuth.js';
import { ToastProvider } from './components/ui/Toast.js';
import { Button } from './components/ui/Button.js';
import { LoginPage } from './pages/LoginPage.js';
import { RoomGridPage } from './pages/RoomGridPage.js';
import { BookingFormPage } from './pages/BookingFormPage.js';
import type { BookingFormPrefill } from './pages/BookingFormPage.js';
import { MyBookingsPage } from './pages/MyBookingsPage.js';
import { AdminRoomsPage } from './pages/AdminRoomsPage.js';
import { toDateKey } from './lib/slots.js';

type Page = 'rooms' | 'bookings' | 'admin' | 'booking-form';

function Shell() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState<Page>('rooms');
  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [prefill, setPrefill] = useState<BookingFormPrefill | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [gridKey, setGridKey] = useState(0);

  const refreshRooms = useCallback(() => {
    api
      .get<Room[]>('/rooms')
      .then(setRooms)
      .catch(() => setRooms([]));
  }, []);

  useEffect(() => {
    if (user) refreshRooms();
  }, [user, refreshRooms]);

  if (!user) {
    return <LoginPage />;
  }

  const isAdmin = user.role === 'admin';

  function bookSlot(roomId: string, bookingDate: string, startTime: string) {
    setPrefill({ roomId, date: bookingDate, startTime });
    setPage('booking-form');
  }

  function bookingDone() {
    setPrefill(null);
    setGridKey((k) => k + 1);
    setPage('rooms');
  }

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <p className="app-name">DeskBoard</p>
          <nav className="app-nav" aria-label="Main navigation">
            <Button
              variant={page === 'rooms' || page === 'booking-form' ? 'primary' : 'secondary'}
              onClick={() => setPage('rooms')}
            >
              Rooms
            </Button>
            <Button
              variant={page === 'bookings' ? 'primary' : 'secondary'}
              onClick={() => setPage('bookings')}
            >
              My bookings
            </Button>
            {isAdmin && (
              <Button
                variant={page === 'admin' ? 'primary' : 'secondary'}
                onClick={() => setPage('admin')}
              >
                Admin
              </Button>
            )}
          </nav>
          <div className="user-menu">
            <span className="muted">
              {user.name} <em>({user.role})</em>
            </span>
            <Button variant="secondary" onClick={logout}>
              Log out
            </Button>
          </div>
        </div>
      </header>

      {page === 'rooms' && (
        <RoomGridPage
          date={date}
          onDateChange={setDate}
          onBookSlot={bookSlot}
          onGridChanged={() => setGridKey((k) => k + 1)}
          refreshKey={gridKey}
        />
      )}
      {page === 'booking-form' && (
        <BookingFormPage
          rooms={rooms}
          prefill={prefill}
          onDone={bookingDone}
          onCancel={() => {
            setPrefill(null);
            setPage('rooms');
          }}
        />
      )}
      {page === 'bookings' && <MyBookingsPage onChanged={() => setGridKey((k) => k + 1)} />}
      {page === 'admin' && isAdmin && <AdminRoomsPage />}
    </>
  );
}

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </ToastProvider>
  );
}
