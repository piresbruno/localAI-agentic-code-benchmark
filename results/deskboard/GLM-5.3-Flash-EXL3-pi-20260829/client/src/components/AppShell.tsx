/** App shell: header with brand, navigation, user menu; routes between pages. */
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { LoginPage } from '../pages/LoginPage.js';
import { RoomGridPage } from '../pages/RoomGridPage.js';
import { MyBookingsPage } from '../pages/MyBookingsPage.js';
import { AdminRoomsPage } from '../pages/AdminRoomsPage.js';
import { Button } from './ui/Button.js';
import { Spinner } from './ui/Spinner.js';

type Page = 'grid' | 'my-bookings' | 'admin-rooms';

const PAGE_TITLES: Record<Page, string> = {
  grid: 'Room grid',
  'my-bookings': 'My bookings',
  'admin-rooms': 'Admin — rooms & usage',
};

export function AppShell() {
  const { user, initializing, logout } = useAuth();
  const [page, setPage] = useState<Page>('grid');

  if (initializing) {
    return (
      <div className="app-shell">
        <div className="app-main" style={{ display: 'flex', justifyContent: 'center', paddingTop: 96 }}>
          <Spinner size={32} label="Starting DeskBoard…" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-header__brand">DeskBoard</span>
        <nav className="app-nav" aria-label="Main navigation">
          <a
            href="#grid"
            className="app-nav__link"
            aria-current={page === 'grid' ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              setPage('grid');
            }}
          >
            Room grid
          </a>
          <a
            href="#my-bookings"
            className="app-nav__link"
            aria-current={page === 'my-bookings' ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              setPage('my-bookings');
            }}
          >
            My bookings
          </a>
          {user.role === 'admin' && (
            <a
              href="#admin-rooms"
              className="app-nav__link"
              aria-current={page === 'admin-rooms' ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                setPage('admin-rooms');
              }}
            >
              Admin
            </a>
          )}
        </nav>
        <span className="app-header__spacer" />
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          {user.name} ({user.role})
        </span>
        <Button variant="secondary" onClick={logout}>
          Log out
        </Button>
      </header>
      <main className="app-main">
        <h1 className="page-title">{PAGE_TITLES[page]}</h1>
        {page === 'grid' && <RoomGridPage />}
        {page === 'my-bookings' && <MyBookingsPage />}
        {page === 'admin-rooms' && user.role === 'admin' && <AdminRoomsPage />}
      </main>
    </div>
  );
}
