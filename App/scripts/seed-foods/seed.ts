// Seed the `foods` table from Matvaretabellen (https://www.matvaretabellen.no).
//
// Run from this folder:   npm install   then   npm run seed
//
// Safe to re-run (e.g. when Matvaretabellen publishes its yearly update):
// rows are matched on (source, source_id) and updated in place. Custom foods
// added by admins are never touched.
//
// Uses the Supabase SECRET key, which bypasses RLS. That is why this runs on
// your own machine only and the key lives in a git-ignored .env file.

import { createClient } from '@supabase/supabase-js';
import { toFoodRow, type MvtFood } from './transform.ts';

const BASE = 'https://www.matvaretabellen.no/api';

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const supabase = createClient(url, secretKey, { auth: { persistSession: false } });

async function download(locale: 'nb' | 'en'): Promise<MvtFood[]> {
  console.log(`Downloading ${BASE}/${locale}/foods.json …`);
  const res = await fetch(`${BASE}/${locale}/foods.json`);
  if (!res.ok) throw new Error(`Matvaretabellen returned HTTP ${res.status}`);
  const body = (await res.json()) as { foods: MvtFood[] };
  return body.foods;
}

async function main() {
  // Both files contain the same foods with the same foodId — only names differ.
  const [nbFoods, enFoods] = await Promise.all([download('nb'), download('en')]);
  const enById = new Map(enFoods.map((f) => [f.foodId, f]));

  const rows = nbFoods.map((nb) => toFoodRow(nb, enById.get(nb.foodId)));
  console.log(`Prepared ${rows.length} foods. Uploading…`);

  // Upload in batches so no single request gets too big.
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('foods').upsert(batch, { onConflict: 'source,source_id' });
    if (error) throw error;
    console.log(`  ${Math.min(i + BATCH, rows.length)} / ${rows.length}`);
  }

  // Record when the foods were loaded, for the admin panel's system status.
  const { error: stampError } = await supabase
    .from('club_settings')
    .update({ foods_seeded_at: new Date().toISOString() })
    .eq('id', 1);
  if (stampError) console.warn('Could not record the seed time:', stampError.message);

  console.log('Done. Data source: Matvaretabellen (Mattilsynet).');
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
