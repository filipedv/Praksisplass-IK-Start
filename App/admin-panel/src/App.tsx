// Routes (URLs) of the admin panel:
//
//   /                → Brukere (user list)
//   /users/:id       → one user's logged meals and water (read-only)
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
import { ClubSettingsPage } from './pages/ClubSettingsPage';
import { FoodsPage } from './pages/FoodsPage';
import { LoginPage } from './pages/LoginPage';
import { RecognitionPage } from './pages/RecognitionPage';
import { UserDataPage } from './pages/UserDataPage';
import { UsersPage } from './pages/UsersPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
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
      <div className="center narrow">
        <h1>Ingen admintilgang</h1>
        <p className="muted">
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
        <Route index element={<UsersPage />} />
        <Route path="users/:id" element={<UserDataPage />} />
        <Route path="foods" element={<FoodsPage />} />
        <Route path="settings" element={<ClubSettingsPage />} />
        <Route path="recognition" element={<RecognitionPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
