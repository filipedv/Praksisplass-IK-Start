// Page frame: side navigation on the left, the current page on the right.
// <Outlet /> is where React Router renders the page for the current URL.

import { NavLink, Outlet } from 'react-router';

import { useAuth } from '../auth/auth-context';

const LINKS = [
  { to: '/', label: 'Brukere', end: true },
  { to: '/foods', label: 'Matvarer' },
  { to: '/settings', label: 'Klubbinnstillinger' },
  { to: '/recognition', label: 'Gjenkjenning' },
];

export function Layout() {
  const { profile, signOut } = useAuth();

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="brand">
          IK Start Ernæring
          <span>Admin</span>
        </div>
        {LINKS.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end} className="nav-link">
            {link.label}
          </NavLink>
        ))}
        <div className="sidebar-footer">
          <div className="muted small">Innlogget som {profile?.display_name}</div>
          <button className="link-button" onClick={signOut}>
            Logg ut
          </button>
          <div className="muted small credit">Næringsdata: Matvaretabellen (Mattilsynet)</div>
        </div>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
