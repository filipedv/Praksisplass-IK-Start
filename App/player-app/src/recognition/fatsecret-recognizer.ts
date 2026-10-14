// FatSecret adapter. OFF by default — enable with EXPO_PUBLIC_RECOGNIZER=fatsecret.
//
// The phone NEVER talks to FatSecret directly: FatSecret uses OAuth 2.0 with
// an IP allow-list, and the client secret must never ship inside the app.
// Instead we send the (compressed) photo to our own recognition-proxy, which
// holds the secret and calls FatSecret from a whitelisted IP.
//
//   phone ──photo + Supabase login token──▶ recognition-proxy ──▶ FatSecret
//   phone ◀──────── labels only ────────── recognition-proxy ◀──

import { supabase } from '@/lib/supabase';

import { compressToBase64 } from './compress-image';
import type { FoodGuess, FoodRecognizer } from './types';

const PROXY_URL = process.env.EXPO_PUBLIC_RECOGNITION_PROXY_URL;

export const fatsecretRecognizer: FoodRecognizer = {
  id: 'fatsecret',
  attribution: 'Powered by fatsecret', // required by FatSecret's terms

  async recognizeFood(image) {
    if (!PROXY_URL) throw new Error('EXPO_PUBLIC_RECOGNITION_PROXY_URL is not set');

    // FatSecret recommends ~512 px and allows at most ~1 MB of base64.
    const imageB64 = await compressToBase64(image.uri, 512, 0.7);

    // Prove to the proxy that we're a logged-in user, so strangers can't use
    // our FatSecret quota. The token goes in a header, never in the URL.
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Not logged in');

    const res = await fetch(`${PROXY_URL}/recognize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ image_b64: imageB64 }),
    });
    if (!res.ok) throw new Error(`Recognition proxy returned HTTP ${res.status}`);

    const body = (await res.json()) as { guesses: FoodGuess[] };
    return body.guesses;
  },
};
