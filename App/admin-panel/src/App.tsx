// Routes (URLs) of the admin panel:
//
//   /                → Oversikt (start page: key numbers, follow-up, everyone today)
//   /users           → Brukere (accounts, roles, active/inactive)
//   /users/:id       → one player: goals, charts, days, meals (+ corrections), exports
//   /teams           → Lag (teams and team goals)
//   /fixtures        → Kamper og treninger (calendar + reminders to players)
//   /log             → Endringslogg (who changed what)
//   /foods           → Matvarer (search + custom foods editor)
//   /settings        → Klubbinnstillinger
//   /recognition     → Gjenkjenning (how well recognizer labels match)
//
// Two dashboards in one panel:
//   - ADMINS get every page above.
//   - COACHES get a coach dashboard: Oversikt, Spillere (/players: their
//     players, per team), the player page, Mine lag (their team goals) and
//     Kamper og treninger — only for the teams an admin has
//     assigned them (under Lag). Other URLs send a coach back to Oversikt.
// These checks are for the UI only — the database enforces them again with
// RLS on every request (see the coach_role migration).

import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { useAuth } from './auth/auth-context';
import { AuthProvider } from './auth/AuthProvider';
import { Layout } from './components/Layout';
import { FeedbackProvider } from './feedback/FeedbackProvider';
import { ClubSettingsPage } from './pages/ClubSettingsPage';
import { AuditPage } from './pages/AuditPage';
import { FixturesPage } from './pages/FixturesPage';
import { FoodsPage } from './pages/FoodsPage';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { PlayerPage } from './pages/PlayerPage';
import { PlayersPage } from './pages/PlayersPage';
import { RecognitionPage } from './pages/RecognitionPage';
import { TeamsPage } from './pages/TeamsPage';
import { UsersPage } from './pages/UsersPage';
import { t, useLanguage } from './lib/i18n';

export default function App() {
  // Changing the language re-mounts everything below (key), so every text is
  // produced again in the new language. The login session and URL are kept.
  const language = useLanguage();
  return (
    <AuthProvider>
      <FeedbackProvider key={language}>
        <BrowserRouter>
          <Gate />
        </BrowserRouter>
      </FeedbackProvider>
    </AuthProvider>
  );
}

/** Decides what a visitor gets: loading, login, "no access", the coach dashboard, or the admin panel. */
function Gate() {
  const { session, isAdmin, isCoach, isLoading, signOut } = useAuth();

  if (isLoading) return <p className="center muted">{t('Laster…', 'Loading…')}</p>;
  if (!session) return <LoginPage />;

  if (isCoach) {
    return (
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<OverviewPage />} />
          <Route path="players" element={<PlayersPage />} />
          <Route path="users/:id" element={<PlayerPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="fixtures" element={<FixturesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  if (!isAdmin) {
    return (
      <div className="center narrow card stack">
        <h1>{t('Ingen tilgang', 'No access')}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {t(
            'Panelet er for administratorer og trenere, og kontoen din har ingen av rollene (eller er deaktivert). Spillere bruker appen på telefonen. En administrator kan gi deg en rolle, eller den kan settes én gang i Supabase-dashboardet — se README.',
            "The panel is for administrators and coaches, and your account has neither role (or has been deactivated). Players use the app on their phone. An administrator can give you a role, or it can be set once in the Supabase dashboard — see the README.",
          )}
        </p>
        <button onClick={signOut}>{t('Logg ut', 'Sign out')}</button>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<OverviewPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:id" element={<PlayerPage />} />
        <Route path="teams" element={<TeamsPage />} />
        <Route path="fixtures" element={<FixturesPage />} />
        <Route path="log" element={<AuditPage />} />
        <Route path="foods" element={<FoodsPage />} />
        <Route path="settings" element={<ClubSettingsPage />} />
        <Route path="recognition" element={<RecognitionPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
