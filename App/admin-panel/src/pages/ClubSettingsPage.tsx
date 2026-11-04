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
import { locale, t } from '../lib/i18n';

// Field name in the database → label and unit in the form.
// (`get label()` follows the chosen language.)
const NUMBER_FIELDS = [
  { key: 'default_goal_kcal', get label() { return t('Energi', 'Energy'); }, unit: 'kcal' },
  { key: 'default_goal_protein_g', label: 'Protein', unit: 'g' },
  { key: 'default_goal_carbs_g', get label() { return t('Karbohydrater', 'Carbohydrates'); }, unit: 'g' },
  { key: 'default_goal_fat_g', get label() { return t('Fett', 'Fat'); }, unit: 'g' },
  { key: 'default_goal_water_ml', get label() { return t('Vann', 'Water'); }, unit: 'ml' },
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
        if (error || !data) return setLoadError(error?.message ?? t('ukjent feil', 'unknown error'));
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

    if (!form.club_name.trim()) return toast(t('Klubbnavn kan ikke være tomt.', 'Club name cannot be empty.'), 'error');
    const goals = {} as Record<NumberKey, number>;
    for (const { key, label } of NUMBER_FIELDS) {
      const value = Number(form[key]);
      // The database also checks these (CHECK constraints), this is just a friendlier message.
      if (!Number.isInteger(value) || value < 0 || (key === 'default_goal_kcal' && value === 0)) {
        return toast(`${label}: ${t('må være et helt tall ≥ 0.', 'must be a whole number ≥ 0.')}`, 'error');
      }
      goals[key] = value;
    }
    const changes = {
      club_name: form.club_name.trim(),
      fatsecret_trial_started_on: form.trial_start || null, // empty = not started
      ...goals,
    };

    setBusy(true);
    const { data, error } = await supabase
      .from('club_settings')
      .update(changes)
      .eq('id', 1)
      .select(SETTINGS_COLUMNS)
      .single();
    setBusy(false);
    if (error || !data) return toast(`${t('Kunne ikke lagre', "Couldn't save")}: ${error?.message ?? t('ingen tilgang', 'no access')}`, 'error');
    showSettings(data as ClubSettings);
    toast(t('Klubbinnstillingene er lagret.', 'The club settings have been saved.'));
  }

  if (loadError) return <p className="error">{t('Kunne ikke hente innstillinger', "Couldn't load the settings")}: {loadError}</p>;
  if (!form || !settings) return <p className="muted">{t('Laster…', 'Loading…')}</p>;

  return (
    <div className="stack-lg">
      <PageHeader title={t('Klubbinnstillinger', 'Club settings')} subtitle={t('Gjelder hele klubben', 'Applies to the whole club')} />
      <form className="card stack" style={{ maxWidth: 620 }} onSubmit={handleSubmit}>

      <label>
        {t('Klubb / lag', 'Club / team')}
        <input value={form.club_name} onChange={(e) => setForm({ ...form, club_name: e.target.value })} />
      </label>

      <h2>{t('Standard dagsmål', 'Default daily goals')}</h2>
      <p className="muted" style={{ margin: 0 }}>
        {t(
          'Brukes for alle som ikke har egne mål. Egne mål per spiller settes på spillerens side («Juster mål»). Plassholderverdier — ikke ernæringsråd; bør settes av en kvalifisert person.',
          "Used for everyone without their own goals. A player's own goals are set on their page (“Adjust goals”). Placeholder values — not nutrition advice; should be set by a qualified person.",
        )}
      </p>
      <div className="grid-2">
        {NUMBER_FIELDS.map(({ key, label, unit }) => (
          <label key={key}>
            {label} ({unit} {t('/ dag', '/ day')})
            <input inputMode="numeric" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
          </label>
        ))}
      </div>

      <h2>{t('FatSecret-prøveperiode', 'FatSecret trial')}</h2>
      <p className="muted" style={{ margin: 0 }}>
        {t(
          'Bildegjenkjenning fra FatSecret er gratis i 14 dager. Sett datoen den starter, så teller Systemstatus på Oversikt ned.',
          'Image recognition from FatSecret is free for 14 days. Set the date it starts, and System status on Overview counts down.',
        )}
      </p>
      <label style={{ maxWidth: 260 }}>
        {t('Startdato', 'Start date')}
        <input type="date" value={form.trial_start} onChange={(e) => setForm({ ...form, trial_start: e.target.value })} />
      </label>

      <div className="row">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? t('Lagrer…', 'Saving…') : t('Lagre', 'Save')}
        </button>
        <span className="muted small">
          {t('Sist endret', 'Last changed')} {new Date(settings.updated_at).toLocaleString(locale())}
        </span>
      </div>
      </form>
    </div>
  );
}
