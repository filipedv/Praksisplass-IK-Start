// Admin login. Same accounts as the player app: being an admin is simply
// having role = 'admin' on your profile. The language can be chosen here
// too, before signing in.

import { useState, type FormEvent } from 'react';

import { useAuth } from '../auth/auth-context';
import { Segmented } from '../components/ui';
import { setLanguage, t, useLanguage } from '../lib/i18n';

export function LoginPage() {
  const { signIn } = useAuth();
  const language = useLanguage();
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
      <div className="row spread">
        <h1>IK Start Ernæring – Admin</h1>
        <Segmented
          label={t('Språk', 'Language')}
          value={language}
          onChange={setLanguage}
          options={[
            { value: 'nb', label: 'Norsk' },
            { value: 'en', label: 'English' },
          ]}
        />
      </div>
      <label>
        {t('E-post', 'Email')}
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </label>
      <label>
        {t('Passord', 'Password')}
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
        {busy ? t('Logger inn…', 'Signing in…') : t('Logg inn', 'Sign in')}
      </button>
    </form>
  );
}
