// Talking to FatSecret: get an OAuth 2.0 access token, then call image recognition.
// Docs: https://platform.fatsecret.com/docs/v2/image.recognition

const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const RECOGNITION_URL = 'https://platform.fatsecret.com/rest/image-recognition/v2';

/** Same shape as FoodGuess in player-app/src/recognition/types.ts. */
export type FoodGuess = { label: string; confidence: number | null; storableId: string };

// --- OAuth token, cached in memory until shortly before it expires ---
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const id = process.env.FATSECRET_CLIENT_ID;
  const secret = process.env.FATSECRET_CLIENT_SECRET;
  if (!id || !secret) throw new Error('FATSECRET_CLIENT_ID / FATSECRET_CLIENT_SECRET missing in .env');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // "Basic auth" = base64("id:secret") — standard OAuth client credentials.
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'image-recognition' }),
  });
  if (!res.ok) throw new Error(`FatSecret token request failed: HTTP ${res.status}`);

  const body = (await res.json()) as { access_token: string; expires_in: number };
  // Renew one minute early to be safe.
  cachedToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };
  return cachedToken.value;
}

// --- The part of FatSecret's response we use ---
type FatSecretResponse = {
  food_response?: {
    food_id: number;
    food_entry_name: string;
    eaten?: { food_name_singular?: string };
  }[];
};

export async function recognizeWithFatSecret(imageB64: string): Promise<FoodGuess[]> {
  const token = await getAccessToken();

  const payload: Record<string, unknown> = { image_b64: imageB64 };
  // region/language are optional Premier features — only send them if set.
  if (process.env.FATSECRET_REGION) payload.region = process.env.FATSECRET_REGION;
  if (process.env.FATSECRET_LANGUAGE) payload.language = process.env.FATSECRET_LANGUAGE;

  const res = await fetch(RECOGNITION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`FatSecret recognition failed: HTTP ${res.status}`);

  const body = (await res.json()) as FatSecretResponse;

  // We ONLY pass labels on. FatSecret's own nutrition numbers are ignored on
  // purpose — Matvaretabellen is our single source of truth for nutrition.
  return (body.food_response ?? []).map((f) => ({
    // Prefer the plain singular name ("banana") over the entry name ("Bananas").
    label: f.eaten?.food_name_singular || f.food_entry_name,
    confidence: null, // FatSecret's API doesn't return a confidence score
    // FatSecret's terms only allow storing food_id (not names), so that's
    // what the app may save.
    storableId: `fatsecret:${f.food_id}`,
  }));
}
