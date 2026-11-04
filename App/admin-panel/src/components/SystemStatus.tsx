// "Systemstatus" box: the facts nobody should have to remember.
//   - Matvaretabellen: how many foods, and when they were last loaded
//   - custom foods and label links
//   - which recognizer the app used most recently (mock / fatsecret …)
//   - the FatSecret trial: not started, or days left of the 14
// The trial start date is set by an admin under Klubbinnstillinger.

import { Database, ScanSearch, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { formatDateTime } from '../lib/format';
import { supabase } from '../lib/supabase';
import { locale, t } from '../lib/i18n';

const TRIAL_DAYS = 14;

type StatusData = {
  mvtFoods: number;
  customFoods: number;
  aliases: number;
  seededAt: string | null;
  trialStart: string | null;
  lastEvent: { provider: string; created_at: string } | null;
};

async function fetchStatus(): Promise<StatusData> {
  const count = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0);
  const [mvtFoods, customFoods, aliases, club, lastEvent] = await Promise.all([
    count(supabase.from('foods').select('*', { count: 'exact', head: true }).eq('source', 'matvaretabellen')),
    count(supabase.from('foods').select('*', { count: 'exact', head: true }).eq('source', 'custom')),
    count(supabase.from('food_aliases').select('*', { count: 'exact', head: true })),
    supabase.from('club_settings').select('foods_seeded_at, fatsecret_trial_started_on').eq('id', 1).maybeSingle(),
    supabase.from('recognition_events').select('provider, created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    mvtFoods,
    customFoods,
    aliases,
    seededAt: club.data?.foods_seeded_at ?? null,
    trialStart: club.data?.fatsecret_trial_started_on ?? null,
    lastEvent: lastEvent.data ?? null,
  };
}

export function SystemStatus({ todayIso }: { todayIso: string }) {
  const [status, setStatus] = useState<StatusData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStatus().then((s) => !cancelled && setStatus(s));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) return null;

  // FatSecret trial: day N of 14 (start day = day 1).
  let trialText = t('Ikke startet', 'Not started');
  let trialTone = '';
  if (status.trialStart) {
    const daysUsed = Math.round((new Date(todayIso).getTime() - new Date(status.trialStart).getTime()) / 86_400_000) + 1;
    const left = TRIAL_DAYS - daysUsed + 1;
    if (daysUsed < 1) trialText = `${t('Starter', 'Starts')} ${new Date(status.trialStart).toLocaleDateString(locale())}`;
    else if (left > 0) {
      trialText = t(
        `Dag ${daysUsed} av ${TRIAL_DAYS} — ${left} ${left === 1 ? 'dag' : 'dager'} igjen`,
        `Day ${daysUsed} of ${TRIAL_DAYS} — ${left} ${left === 1 ? 'day' : 'days'} left`,
      );
      trialTone = left <= 3 ? 'warn' : 'ok';
    } else {
      trialText = t('Utløpt', 'Expired');
      trialTone = 'off';
    }
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>{t('Systemstatus', 'System status')}</h2>
      </div>
      <div className="grid-3" style={{ gap: 16 }}>
        <div className="stack" style={{ gap: 4 }}>
          <span className="stat-label row" style={{ gap: 6 }}>
            <Database size={13} /> Matvaretabellen
          </span>
          <strong>
            {status.mvtFoods.toLocaleString(locale())} {t('matvarer', 'foods')}
          </strong>
          <span className="faint small">
            {t('Sist lastet:', 'Last loaded:')}{' '}
            {status.seededAt ? formatDateTime(status.seededAt) : t('ukjent (før dette ble registrert)', 'unknown (before this was recorded)')}
          </span>
          <span className="faint small">
            {status.customFoods} {t('egendefinerte', 'custom')} · {status.aliases} {t('koblinger', 'links')}
          </span>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <span className="stat-label row" style={{ gap: 6 }}>
            <ScanSearch size={13} /> {t('Gjenkjenning', 'Recognition')}
          </span>
          <strong>{status.lastEvent ? `${t('Sist brukt', 'Last used')}: ${status.lastEvent.provider}` : t('Ikke brukt ennå', 'Not used yet')}</strong>
          <span className="faint small">{status.lastEvent ? formatDateTime(status.lastEvent.created_at) : ''}</span>
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <span className="stat-label row" style={{ gap: 6 }}>
            <Timer size={13} /> {t('FatSecret-prøveperiode', 'FatSecret trial')}
          </span>
          <span>
            <span className={`pill ${trialTone}`}>{trialText}</span>
          </span>
          <Link to="/settings" className="small">
            {t('Sett startdato i Klubbinnstillinger', 'Set the start date in Club settings')}
          </Link>
        </div>
      </div>
    </section>
  );
}
