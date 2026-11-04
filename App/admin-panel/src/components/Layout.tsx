// Page frame: side navigation on the left, the current page on the right.
// <Outlet /> is where React Router renders the page for the current URL.
//
// On narrow screens (phones) the sidebar becomes a slide-in menu behind a
// ☰ button in a top bar. ⌘K / Ctrl+K opens quick search from anywhere.
// The sidebar footer has the language switch (Norsk / English).

import { Apple, CalendarDays, LayoutDashboard, LogOut, Menu, ScanSearch, Search, Settings, Shield, Users, UsersRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router';

import { useAuth } from '../auth/auth-context';
import { setLanguage, t, useLanguage } from '../lib/i18n';
import { CommandPalette } from './CommandPalette';
import { Avatar, Segmented } from './ui';

// A function (not a constant) so the labels follow the chosen language.
const links = () => [
  { to: '/', label: t('Oversikt', 'Overview'), icon: LayoutDashboard, end: true },
  { to: '/users', label: t('Brukere', 'Users'), icon: Users },
  { to: '/teams', label: t('Lag', 'Teams'), icon: UsersRound },
  { to: '/fixtures', label: t('Kamper og treninger', 'Matches and training'), icon: CalendarDays },
  { to: '/foods', label: t('Matvarer', 'Foods'), icon: Apple },
  { to: '/recognition', label: t('Gjenkjenning', 'Recognition'), icon: ScanSearch },
  { to: '/log', label: t('Endringslogg', 'Change log'), icon: Shield },
  { to: '/settings', label: t('Klubbinnstillinger', 'Club settings'), icon: Settings },
];

// Show ⌘ on Macs and "Ctrl" elsewhere.
const SHORTCUT = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

export function Layout() {
  const { profile, signOut } = useAuth();
  const language = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false); // phone menu
  const [paletteOpen, setPaletteOpen] = useState(false);

  // ⌘K / Ctrl+K anywhere opens quick search.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="layout">
      {/* Only visible on narrow screens */}
      <header className="topbar">
        <button className="ghost" onClick={() => setMenuOpen(true)} aria-label={t('Åpne meny', 'Open menu')}>
          <Menu size={20} />
        </button>
        <span className="brand-name">IK Start Ernæring</span>
        <button className="ghost" onClick={() => setPaletteOpen(true)} aria-label={t('Søk', 'Search')}>
          <Search size={18} />
        </button>
      </header>
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} aria-hidden />}

      <nav className={`sidebar ${menuOpen ? 'open' : ''}`} aria-label={t('Hovedmeny', 'Main menu')}>
        <div className="brand">
          <span className="brand-mark">IK</span>
          <span style={{ flex: 1 }}>
            <div className="brand-name">IK Start Ernæring</div>
            <div className="brand-sub">Admin</div>
          </span>
          <button className="ghost close-menu" onClick={() => setMenuOpen(false)} aria-label={t('Lukk meny', 'Close menu')}>
            <X size={18} />
          </button>
        </div>
        <button className="search-button" onClick={() => setPaletteOpen(true)}>
          <Search size={14} /> <span style={{ flex: 1, textAlign: 'left' }}>{t('Søk', 'Search')}</span> <kbd>{SHORTCUT}</kbd>
        </button>
        {links().map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="nav-link" onClick={() => setMenuOpen(false)}>
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
                <div className="faint small">{t('Administrator', 'Administrator')}</div>
              </div>
            </div>
          )}
          <Segmented
            label={t('Språk', 'Language')}
            value={language}
            onChange={setLanguage}
            options={[
              { value: 'nb', label: 'Norsk' },
              { value: 'en', label: 'English' },
            ]}
          />
          <button className="small ghost" onClick={signOut} style={{ justifyContent: 'flex-start' }}>
            <LogOut size={14} /> {t('Logg ut', 'Sign out')}
          </button>
          <div className="faint small">{t('Næringsdata: Matvaretabellen (Mattilsynet)', 'Nutrition data: Matvaretabellen (Norwegian Food Safety Authority)')}</div>
        </div>
      </nav>
      <main className="content">
        <Outlet />
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
