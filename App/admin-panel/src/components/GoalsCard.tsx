// "Mål" card on the player page: shows the player's EFFECTIVE goals and lets
// an admin adjust them ("Juster mål", as in the coach sketch).
//
// Each field is either the player's own value or empty = follow the club
// default (shown as the placeholder). Saving writes to player_goals; the
// database (RLS) only allows that for admins.

import { SlidersHorizontal } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { useFeedback } from '../feedback/feedback-context';
import { GOAL_FIELDS, savePlayerGoals, type Goals, type PlayerGoalsRow } from '../lib/summary-api';

type Props = {
  userId: string;
  playerName: string;
  defaults: Goals; // club defaults
  own: PlayerGoalsRow | undefined; // the player's own values (may be partly null)
  onSaved: () => void;
};

export function GoalsCard({ userId, playerName, defaults, own, onSaved }: Props) {
  const { toast, confirm } = useFeedback();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  // Form values as text: '' = use club default.
  const [form, setForm] = useState<Record<keyof Goals, string>>(() => toForm(own));

  function startEditing() {
    setForm(toForm(own));
    setEditing(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const values = {} as { [K in keyof Goals]: number | null };
    for (const { key, label } of GOAL_FIELDS) {
      const raw = form[key].trim();
      if (raw === '') {
        values[key] = null;
        continue;
      }
      const n = Number(raw);
      const min = key === 'goal_kcal' || key === 'goal_water_ml' ? 1 : 0;
      if (!Number.isInteger(n) || n < min) return toast(`${label}: må være et helt tall${min ? ' over 0' : ''}.`, 'error');
      values[key] = n;
    }
    setBusy(true);
    try {
      await savePlayerGoals(userId, values);
      toast(`Målene til ${playerName} er lagret.`);
      setEditing(false);
      onSaved();
    } catch (err) {
      toast(`Kunne ikke lagre målene: ${(err as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function resetToClub() {
    const ok = await confirm({
      title: 'Bruke klubbens standardmål?',
      body: `Alle egne mål for ${playerName} fjernes, og spilleren følger klubbens standard fra Klubbinnstillinger.`,
      confirmLabel: 'Bruk klubbstandard',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await savePlayerGoals(userId, { goal_kcal: null, goal_protein_g: null, goal_carbs_g: null, goal_fat_g: null, goal_water_ml: null });
      toast(`${playerName} følger nå klubbens standardmål.`);
      setEditing(false);
      onSaved();
    } catch (err) {
      toast(`Kunne ikke lagre: ${(err as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  const hasOwn = GOAL_FIELDS.some(({ key }) => own?.[key] != null);

  return (
    <section className="card">
      <div className="card-header">
        <h2>Dagsmål</h2>
        {!editing && (
          <button className="small ghost" onClick={startEditing}>
            <SlidersHorizontal size={13} /> Juster mål
          </button>
        )}
      </div>

      {!editing ? (
        <div className="stack" style={{ gap: 10 }}>
          {GOAL_FIELDS.map(({ key, label, unit }) => {
            const isOwn = own?.[key] != null;
            return (
              <div key={key} className="row spread">
                <span className="muted">{label}</span>
                <span className="row" style={{ gap: 8 }}>
                  <strong className="num">
                    {(own?.[key] ?? defaults[key]).toLocaleString('nb-NO')} {unit}
                  </strong>
                  <span className={`pill ${isOwn ? 'info' : ''}`}>{isOwn ? 'Eget' : 'Klubb'}</span>
                </span>
              </div>
            );
          })}
          <p className="faint small" style={{ margin: '6px 0 0' }}>
            {hasOwn ? '«Eget» = satt for denne spilleren. ' : ''}«Klubb» = standard fra Klubbinnstillinger. Plassholderverdier
            — ikke ernæringsråd.
          </p>
        </div>
      ) : (
        <form className="stack" onSubmit={handleSubmit}>
          <p className="faint small" style={{ margin: 0 }}>
            La et felt stå tomt for å bruke klubbens standard (vist i feltet).
          </p>
          <div className="grid-2">
            {GOAL_FIELDS.map(({ key, label, unit }) => (
              <label key={key}>
                {label} ({unit})
                <input
                  inputMode="numeric"
                  value={form[key]}
                  placeholder={String(defaults[key])}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <div className="row">
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Lagrer…' : 'Lagre mål'}
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={busy}>
              Avbryt
            </button>
            {hasOwn && (
              <button type="button" className="ghost" onClick={resetToClub} disabled={busy} style={{ marginLeft: 'auto' }}>
                Bruk klubbstandard
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

function toForm(own: PlayerGoalsRow | undefined): Record<keyof Goals, string> {
  const form = {} as Record<keyof Goals, string>;
  for (const { key } of GOAL_FIELDS) form[key] = own?.[key] != null ? String(own[key]) : '';
  return form;
}
