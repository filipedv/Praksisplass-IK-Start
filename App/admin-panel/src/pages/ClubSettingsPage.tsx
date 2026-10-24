// KLUBBINNSTILLINGER: the single club_settings row (id = 1).
// Readable by every logged-in user; only admins may update it (RLS).
//
// The goal values are the club's DEFAULTS. A player follows them unless an
// admin sets the player's own goals on their page (player_goals table).
// The player app uses the water goal; the admin panel uses them all.

import { useEffect, useState, type FormEvent } from 'react';

import { PageHeader } from '../components/ui';
import { useFeedback } from '../feedback/feedback-context';
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

const SETTINGS_COLUMNS =
  'club_name, default_goal_kcal, default_goal_protein_g, default_goal_carbs_g, default_goal_fat_g, default_goal_water_ml, fatsecret_trial_started_on, updated_at';

export function ClubSettingsPage() {
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [form, setForm] = useState<Record<'club_name' | 'trial_start' | NumberKey, string> | null>(null);
  const { toast } = useFeedback();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase
      .from('club_settings')
      .select(SETTINGS_COLUMNS)
      .eq('id', 1)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return setLoadError(error?.message ?? 'ukjent feil');
        showSettings(data as ClubSettings);
      });
  }, []);

  function showSettings(data: ClubSettings) {
    setSettings(data);
    setForm({
      club_name: data.club_name,
      trial_start: data.fatsecret_trial_started_on ?? '',
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

    if (!form.club_name.trim()) return toast('Klubbnavn kan ikke være tomt.', 'error');
    const changes: Record<string, string | number | null> = {
      club_name: form.club_name.trim(),
      fatsecret_trial_started_on: form.trial_start || null, // empty = not started
    };
    for (const { key, label } of NUMBER_FIELDS) {
      const value = Number(form[key]);
      // The database also checks these (CHECK constraints), this is just a friendlier message.
      if (!Number.isInteger(value) || value < 0 || (key === 'default_goal_kcal' && value === 0)) {
        return toast(`${label}: må være et helt tall ≥ 0.`, 'error');
      }
      changes[key] = value;
    }

    setBusy(true);
    const { data, error } = await supabase
      .from('club_settings')
      .update(changes)
      .eq('id', 1)
      .select(SETTINGS_COLUMNS)
      .single();
    setBusy(false);
    if (error || !data) return toast(`Kunne ikke lagre: ${error?.message ?? 'ingen tilgang'}`, 'error');
    showSettings(data as ClubSettings);
    toast('Klubbinnstillingene er lagret.');
  }

  if (loadError) return <p className="error">Kunne ikke hente innstillinger: {loadError}</p>;
  if (!form || !settings) return <p className="muted">Laster…</p>;

  return (
    <div className="stack-lg">
      <PageHeader title="Klubbinnstillinger" subtitle="Gjelder hele klubben" />
      <form className="card stack" style={{ maxWidth: 620 }} onSubmit={handleSubmit}>

      <label>
        Klubb / lag
        <input value={form.club_name} onChange={(e) => setForm({ ...form, club_name: e.target.value })} />
      </label>

      <h2>Standard dagsmål</h2>
      <p className="muted" style={{ margin: 0 }}>
        Brukes for alle som ikke har egne mål. Egne mål per spiller settes på spillerens side («Juster mål»).
        Plassholderverdier — ikke ernæringsråd; bør settes av en kvalifisert person.
      </p>
      <div className="grid-2">
        {NUMBER_FIELDS.map(({ key, label, unit }) => (
          <label key={key}>
            {label} ({unit})
            <input inputMode="numeric" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
          </label>
        ))}
      </div>

      <h2>FatSecret-prøveperiode</h2>
      <p className="muted" style={{ margin: 0 }}>
        Bildegjenkjenning fra FatSecret er gratis i 14 dager. Sett datoen den starter, så teller Systemstatus på Oversikt ned.
      </p>
      <label style={{ maxWidth: 260 }}>
        Startdato
        <input type="date" value={form.trial_start} onChange={(e) => setForm({ ...form, trial_start: e.target.value })} />
      </label>

      <div className="row">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Lagrer…' : 'Lagre'}
        </button>
        <span className="muted small">Sist endret {new Date(settings.updated_at).toLocaleString('nb-NO')}</span>
      </div>
      </form>
    </div>
  );
}
