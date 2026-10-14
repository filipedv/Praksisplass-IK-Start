// Admin login. Same accounts as the player app: being an admin is simply
// having role = 'admin' on your profile.

import { useState, type FormEvent } from 'react';

import { useAuth } from '../auth/auth-context';

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); // stop the browser from reloading the page
    setBusy(true);
    setError(await signIn(email.trim(), password));
    setBusy(false);
  }

  return (
    <form className="center narrow card stack" onSubmit={handleSubmit}>
      <h1>IK Start Ernæring – Admin</h1>
      <label>
        E-post
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </label>
      <label>
        Passord
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" className="primary" disabled={busy}>
        {busy ? 'Logger inn…' : 'Logg inn'}
      </button>
    </form>
  );
}
