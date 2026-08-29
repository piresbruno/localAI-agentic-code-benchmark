import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Badge } from './ui/Badge';

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <NavLink to="/" className="app-brand">
            DeskBoard
          </NavLink>
          <nav className="app-nav" aria-label="Main">
            <NavLink to="/" className="app-nav-link" end>
              Room grid
            </NavLink>
            <NavLink to="/my-bookings" className="app-nav-link">
              My bookings
            </NavLink>
            {user?.role === 'admin' ? (
              <NavLink to="/admin/rooms" className="app-nav-link">
                Admin
              </NavLink>
            ) : null}
          </nav>
          <div className="app-user">
            <span className="app-user-name">
              {user?.name}
              <Badge tone={user?.role === 'admin' ? 'primary' : 'neutral'}>{user?.role}</Badge>
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
