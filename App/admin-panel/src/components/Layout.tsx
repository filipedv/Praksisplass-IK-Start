// Page frame: side navigation on the left, the current page on the right.
// <Outlet /> is where React Router renders the page for the current URL.

import { Apple, LayoutDashboard, LogOut, ScanSearch, Settings, Users } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';

import { useAuth } from '../auth/auth-context';
import { Avatar } from './ui';

const LINKS = [
  { to: '/', label: 'Oversikt', icon: LayoutDashboard, end: true },
  { to: '/users', label: 'Brukere', icon: Users },
  { to: '/foods', label: 'Matvarer', icon: Apple },
  { to: '/settings', label: 'Klubbinnstillinger', icon: Settings },
  { to: '/recognition', label: 'Gjenkjenning', icon: ScanSearch },
];

export function Layout() {
  const { profile, signOut } = useAuth();

  return (
    <div className="layout">
      <nav className="sidebar" aria-label="Hovedmeny">
        <div className="brand">
          <span className="brand-mark">IK</span>
          <span>
            <div className="brand-name">IK Start Ernæring</div>
            <div className="brand-sub">Admin</div>
          </span>
        </div>
        {LINKS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="nav-link">
            <Icon size={17} /> {label}
          </NavLink>
        ))}
        <div className="sidebar-footer">
          {profile && (
            <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
              <Avatar name={profile.display_name} id={profile.id} />
              <div style={{ minWidth: 0 }}>
                <div className="small" style={{ fontWeight: 600 }}>
                  {profile.display_name}
                </div>
                <div className="faint small">Administrator</div>
              </div>
            </div>
          )}
          <button className="small ghost" onClick={signOut} style={{ justifyContent: 'flex-start' }}>
            <LogOut size={14} /> Logg ut
          </button>
          <div className="faint small">Næringsdata: Matvaretabellen (Mattilsynet)</div>
        </div>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
