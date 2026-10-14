// KLUBBINNSTILLINGER: the single club_settings row (id = 1).
// Readable by every logged-in user; only admins may update it (RLS).
//
// The goal values are a TEMPLATE for later sessions (coaches will adjust
// goals per player). Right now the player app only uses the water goal.

import { useEffect, useState, type FormEvent } from 'react';

import { supabase } from '../lib/supabase';
import type { ClubSettings } from '../lib/types';

// Field name in the database → label and unit in the form.
const NUMBER_FIELDS = [
  { key: 'default_goal_kcal', label: 'Energi', unit: 'kcal / dag' },
  { key: 'default_goal_protein_g', label: 'Protein', unit: 'g / dag' },
  { key: 'default_goal_carbs_g', label: 'Karbohydrater', unit: 'g / dag' },
  { key: 'default_goal_fat_g', label: 'Fett', unit: 'g / dag' },
  { key: 'default_goal_water_ml', label: 'Vann', unit: 'ml / dag' },
] as const;

type NumberKey = (typeof NUMBER_FIELDS)[number]['key'];

export function ClubSettingsPage() {
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [form, setForm] = useState<Record<'club_name' | NumberKey, string> | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase
      .from('club_settings')
      .select('club_name, default_goal_kcal, default_goal_protein_g, default_goal_carbs_g, default_goal_fat_g, default_goal_water_ml, updated_at')
      .eq('id', 1)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return setMessage({ text: `Kunne ikke hente innstillinger: ${error?.message}`, ok: false });
        showSettings(data as ClubSettings);
      });
  }, []);

  function showSettings(data: ClubSettings) {
    setSettings(data);
    setForm({
      club_name: data.club_name,
      default_goal_kcal: String(data.default_goal_kcal),
      default_goal_protein_g: String(data.default_goal_protein_g),
      default_goal_carbs_g: String(data.default_goal_carbs_g),
      default_goal_fat_g: String(data.default_goal_fat_g),
      default_goal_water_ml: String(data.default_goal_water_ml),
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setMessage(null);

    if (!form.club_name.trim()) return setMessage({ text: 'Klubbnavn kan ikke være tomt.', ok: false });
    const changes: Record<string, string | number> = { club_name: form.club_name.trim() };
    for (const { key, label } of NUMBER_FIELDS) {
      const value = Number(form[key]);
      // The database also checks these (CHECK constraints), this is just a friendlier message.
      if (!Number.isInteger(value) || value < 0 || (key === 'default_goal_kcal' && value === 0)) {
        return setMessage({ text: `${label}: må være et helt tall ≥ 0.`, ok: false });
      }
      changes[key] = value;
    }

    setBusy(true);
    const { data, error } = await supabase
      .from('club_settings')
      .update(changes)
      .eq('id', 1)
      .select('club_name, default_goal_kcal, default_goal_protein_g, default_goal_carbs_g, default_goal_fat_g, default_goal_water_ml, updated_at')
      .single();
    setBusy(false);
    if (error || !data) return setMessage({ text: `Kunne ikke lagre: ${error?.message ?? 'ingen tilgang'}`, ok: false });
    showSettings(data as ClubSettings);
    setMessage({ text: 'Lagret.', ok: true });
  }

  if (!form || !settings) return message ? <p className="error">{message.text}</p> : <p className="muted">Laster…</p>;

  return (
    <form className="stack" style={{ maxWidth: 520 }} onSubmit={handleSubmit}>
      <h1>Klubbinnstillinger</h1>

      <label>
        Klubb / lag
        <input value={form.club_name} onChange={(e) => setForm({ ...form, club_name: e.target.value })} />
      </label>

      <h2>Standard dagsmål</h2>
      <p className="muted" style={{ margin: 0 }}>
        Plassholderverdier — ikke ernæringsråd. Bør settes av en kvalifisert person. Spillerappen bruker foreløpig
        bare vannmålet; resten blir mal for trenerens mål per spiller senere.
      </p>
      <div className="grid-2">
        {NUMBER_FIELDS.map(({ key, label, unit }) => (
          <label key={key}>
            {label} ({unit})
            <input inputMode="numeric" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
          </label>
        ))}
      </div>

      {message && <p className={message.ok ? 'success' : 'error'}>{message.text}</p>}
      <div className="row">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Lagrer…' : 'Lagre'}
        </button>
        <span className="muted small">Sist endret {new Date(settings.updated_at).toLocaleString('nb-NO')}</span>
      </div>
    </form>
  );
}
