// recognition-proxy: a tiny server between the player app and FatSecret.
//
// Why it exists: FatSecret uses OAuth 2.0 + an IP allow-list, so it can only
// be called from a machine whose IP we've whitelisted, using a secret that
// must never be inside the app. This server is that machine.
//
// Run:  npm install  →  cp .env.example .env (fill in)  →  npm start
//
// PRIVACY: the photo is only held in memory for the length of one request.
// It is never written to disk, never logged, and never stored anywhere.

import { createClient } from '@supabase/supabase-js';
import express, { type NextFunction, type Request, type Response } from 'express';

import { recognizeWithFatSecret } from './fatsecret.ts';

const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY missing. Copy .env.example to .env.');
  process.exit(1);
}

const app = express();
// FatSecret accepts at most ~1 MB of base64, so anything bigger is rejected here.
app.use(express.json({ limit: '1.1mb' }));

/**
 * Only logged-in, ACTIVE users of our app may use our FatSecret quota.
 * The app sends its Supabase access token in the Authorization header.
 */
async function requireActiveUser(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  if (!token) return res.status(401).json({ error: 'Missing login token' });

  // A Supabase client acting AS this user, so RLS applies to its queries.
  const supabase = createClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: userData, error } = await supabase.auth.getUser(token);
  if (error || !userData.user) return res.status(401).json({ error: 'Invalid login token' });

  // RLS hides the profile of deactivated users, so "no row" = not allowed.
  const { data: profile } = await supabase.from('profiles').select('id').eq('id', userData.user.id).maybeSingle();
  if (!profile) return res.status(403).json({ error: 'Account is not active' });

  next();
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/recognize', requireActiveUser, async (req, res) => {
  const imageB64 = req.body?.image_b64;
  if (typeof imageB64 !== 'string' || imageB64.length === 0) {
    return res.status(400).json({ error: 'Body must be { image_b64: string }' });
  }

  try {
    const guesses = await recognizeWithFatSecret(imageB64);
    // Log counts only — no image, no user id, no labels.
    console.log(`[recognize] ${guesses.length} foods detected`);
    res.json({ guesses });
  } catch (err) {
    console.error('[recognize] failed:', err instanceof Error ? err.message : err);
    res.status(502).json({ error: 'Recognition failed' });
  }
});

/**
 * FatSecret only accepts calls from whitelisted IPs. We work from more than one
 * place, so warn at startup if this network's public IP isn't in
 * FATSECRET_ALLOWED_IPS — otherwise you'd only find out via a confusing error.
 * This is a convenience check only; the real allow-list is in FatSecret's dashboard.
 */
async function checkPublicIp() {
  const allowed = (process.env.FATSECRET_ALLOWED_IPS ?? '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);
  if (allowed.length === 0) return;

  try {
    // ipv4first (see "start" in package.json) makes this return the IPv4 address.
    const res = await fetch('https://ifconfig.me/ip', { signal: AbortSignal.timeout(5000) });
    const ip = (await res.text()).trim();
    if (allowed.includes(ip)) {
      console.log(`Public IP ${ip} is in FATSECRET_ALLOWED_IPS (whitelisted for FatSecret, if added in the dashboard).`);
    } else {
      console.warn(
        `⚠️  Public IP ${ip} is NOT in FATSECRET_ALLOWED_IPS. FatSecret will reject requests ` +
          `until you add it in the FatSecret dashboard (and to FATSECRET_ALLOWED_IPS in .env).`,
      );
    }
  } catch {
    console.warn('Could not look up this network\'s public IP — skipping the allow-list check.');
  }
}

const port = Number(process.env.PORT ?? 8787);
// 0.0.0.0 = reachable from other devices on the same Wi-Fi (your phone).
app.listen(port, '0.0.0.0', () => {
  console.log(`recognition-proxy listening on port ${port}`);
  checkPublicIp();
});
