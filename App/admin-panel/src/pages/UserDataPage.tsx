// ONE USER'S DATA (read-only): meals and water, grouped by day, for a chosen
// date range (default: the last 7 days).
//
// We can read another user's rows only because the "admin all rows" RLS
// policies allow it for active admins. Editing is a later session.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

import { formatDay, formatNumber, formatTime, sumNutrition, toISODate } from '../lib/format';
import { supabase } from '../lib/supabase';
import type { Meal, Nutrition, Profile, WaterLog } from '../lib/types';

type DayGroup = { iso: string; meals: Meal[]; waterMl: number };

/** Profile + meals + water for one user in a date range, grouped by day (newest first). */
async function fetchUserData(id: string, from: string, to: string) {
  // The date inputs are local days; turn them into a timestamp range.
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  end.setDate(end.getDate() + 1); // include the whole "to" day

  const [profileRes, mealsRes, waterRes] = await Promise.all([
    supabase.from('profiles').select('id, display_name, role, is_active, created_at').eq('id', id).maybeSingle(),
    supabase
      .from('meals')
      .select('id, eaten_at, recognizer, meal_items (id, food_name, amount_g, nutrition, detected_label)')
      .eq('user_id', id)
      .gte('eaten_at', start.toISOString())
      .lt('eaten_at', end.toISOString())
      .order('eaten_at'),
    supabase
      .from('water_logs')
      .select('id, amount_ml, logged_at')
      .eq('user_id', id)
      .gte('logged_at', start.toISOString())
      .lt('logged_at', end.toISOString()),
  ]);

  const groups = new Map<string, DayGroup>();
  const group = (iso: string) => {
    if (!groups.has(iso)) groups.set(iso, { iso, meals: [], waterMl: 0 });
    return groups.get(iso)!;
  };
  for (const meal of (mealsRes.data ?? []) as Meal[]) {
    group(toISODate(new Date(meal.eaten_at))).meals.push({
      ...meal,
      // Postgres numeric comes back as a string — convert to a number.
      meal_items: meal.meal_items.map((i) => ({ ...i, amount_g: Number(i.amount_g) })),
    });
  }
  for (const w of (waterRes.data ?? []) as WaterLog[]) {
    group(toISODate(new Date(w.logged_at))).waterMl += w.amount_ml;
  }

  return {
    user: profileRes.data as Profile | null,
    days: [...groups.values()].sort((a, b) => b.iso.localeCompare(a.iso)),
    error: (profileRes.error ?? mealsRes.error ?? waterRes.error)?.message ?? null,
  };
}

export function UserDataPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<Profile | null | undefined>(undefined);
  const [from, setFrom] = useState(() => toISODate(new Date(Date.now() - 6 * 86_400_000)));
  const [to, setTo] = useState(() => toISODate(new Date()));
  const [days, setDays] = useState<DayGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reload whenever the user or the date range changes.
  useEffect(() => {
    if (!id) return;
    let cancelled = false; // ignore stale answers (e.g. after quickly changing dates)
    void fetchUserData(id, from, to).then((result) => {
      if (cancelled) return;
      setUser(result.user);
      setDays(result.days);
      setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [id, from, to]);

  if (user === undefined) return <p className="muted">Laster…</p>;
  if (user === null) {
    return (
      <div className="stack">
        <Link to="/">← Brukere</Link>
        <p className="error">Fant ikke brukeren.</p>
      </div>
    );
  }

  return (
    <div className="stack">
      <Link to="/">← Brukere</Link>
      <h1>{user.display_name}</h1>
      <p className="muted">Kun visning. Næringsverdier er lagret slik de var da måltidet ble registrert.</p>

      <div className="row">
        <label>
          Fra
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          Til
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      {error && <p className="error">Feil ved henting: {error}</p>}
      {days !== null && days.length === 0 && <p className="muted">Ingen registreringer i perioden.</p>}

      {days?.map((day) => {
        const totals = sumNutrition(day.meals.flatMap((m) => m.meal_items.map((i) => i.nutrition)));
        return (
          <div key={day.iso} className="card stack">
            <div className="row spread">
              <strong>{capitalize(formatDay(new Date(`${day.iso}T12:00:00`)))}</strong>
              <span className="muted">
                <Totals n={totals} /> · Vann {day.waterMl} ml
              </span>
            </div>
            {day.meals.length === 0 ? (
              <p className="muted small">Ingen måltider.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Tid</th>
                    <th>Matvare</th>
                    <th className="num">Mengde</th>
                    <th className="num">kcal</th>
                    <th className="num">Protein</th>
                    <th className="num">Karbo</th>
                    <th className="num">Fett</th>
                    <th>Kilde</th>
                  </tr>
                </thead>
                <tbody>
                  {day.meals.flatMap((meal) =>
                    meal.meal_items.map((item, i) => (
                      <tr key={item.id}>
                        <td className="muted">{i === 0 ? formatTime(meal.eaten_at) : ''}</td>
                        <td>{item.food_name}</td>
                        <td className="num">{formatNumber(item.amount_g)} g</td>
                        <td className="num">{formatNumber(item.nutrition.energy_kcal)}</td>
                        <td className="num">{formatNumber(item.nutrition.protein_g, 1)}</td>
                        <td className="num">{formatNumber(item.nutrition.carbs_g, 1)}</td>
                        <td className="num">{formatNumber(item.nutrition.fat_g, 1)}</td>
                        {/* Which recognizer suggested it, or "manuelt" if the user searched. */}
                        <td className="muted small">{item.detected_label ? meal.recognizer : 'manuelt'}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Totals({ n }: { n: Nutrition }) {
  return (
    <>
      {formatNumber(n.energy_kcal)} kcal · P {formatNumber(n.protein_g)} g · K {formatNumber(n.carbs_g)} g · F{' '}
      {formatNumber(n.fat_g)} g
    </>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
