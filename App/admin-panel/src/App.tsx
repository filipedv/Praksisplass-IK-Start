// Routes (URLs) of the admin panel:
//
//   /                → Oversikt (start page: key numbers, follow-up, everyone today)
//   /users           → Brukere (accounts, roles, active/inactive)
//   /users/:id       → one player: goals, charts, days, meals (+ corrections), exports
//   /teams           → Lag (teams and team goals)
//   /log             → Endringslogg (who changed what)
//   /foods           → Matvarer (search + custom foods editor)
//   /settings        → Klubbinnstillinger
//   /recognition     → Gjenkjenning (how well recognizer labels match)
//
// Everything except the login page requires an active admin. That check is
// for the UI only — the database enforces it again with RLS on every request.

import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { useAuth } from './auth/auth-context';
import { AuthProvider } from './auth/AuthProvider';
import { Layout } from './components/Layout';
import { FeedbackProvider } from './feedback/FeedbackProvider';
import { ClubSettingsPage } from './pages/ClubSettingsPage';
import { AuditPage } from './pages/AuditPage';
import { FoodsPage } from './pages/FoodsPage';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { PlayerPage } from './pages/PlayerPage';
import { RecognitionPage } from './pages/RecognitionPage';
import { TeamsPage } from './pages/TeamsPage';
import { UsersPage } from './pages/UsersPage';

export default function App() {
  return (
    <AuthProvider>
      <FeedbackProvider>
        <BrowserRouter>
          <Gate />
        </BrowserRouter>
      </FeedbackProvider>
    </AuthProvider>
  );
}

/** Decides what a visitor gets: loading, login, "not an admin", or the panel. */
function Gate() {
  const { session, isAdmin, isLoading, signOut } = useAuth();

  if (isLoading) return <p className="center muted">Laster…</p>;
  if (!session) return <LoginPage />;

  if (!isAdmin) {
    return (
      <div className="center narrow card stack">
        <h1>Ingen admintilgang</h1>
        <p className="muted" style={{ margin: 0 }}>
          Kontoen din er ikke administrator (eller er deaktivert). En administrator kan gi deg rollen, eller den
          kan settes én gang i Supabase-dashboardet — se README.
        </p>
        <button onClick={signOut}>Logg ut</button>
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
        <Route path="log" element={<AuditPage />} />
        <Route path="foods" element={<FoodsPage />} />
        <Route path="settings" element={<ClubSettingsPage />} />
        <Route path="recognition" element={<RecognitionPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
