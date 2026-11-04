// KAMPER OG TRENINGER (route /fixtures): the club calendar, and the reminders
// players get before and after each match or training.
//   - Kommende / Tidligere: the fixtures, with their teams and reminders
//   - Påminnelsesmaler: the reusable reminder texts (TemplatesCard)
// Players see their team's fixtures in the app ("Neste kamp") and get the
// reminders as notifications on their phone.

import { CalendarDays, Dumbbell, MapPin, Pencil, Plus, Trash2, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';

import { FixtureForm } from '../components/FixtureForm';
import { TemplatesCard } from '../components/TemplatesCard';
import { PageHeader, Segmented } from '../components/ui';
import { useFeedback } from '../feedback/feedback-context';
import {
  deleteFixture,
  fetchFixtures,
  fetchTemplates,
  fixtureHeading,
  formatWhen,
  timingLabel,
  type Fixture,
  type FixtureKind,
  type ReminderTemplate,
} from '../lib/fixtures-api';
import { toISODate } from '../lib/format';
import { getLanguage, locale, t } from '../lib/i18n';
import { usePersistentState } from '../lib/persist';
import { listTeams } from '../lib/teams-api';
import type { Team } from '../lib/types';

type Tab = 'upcoming' | 'past' | 'templates';
type Form = { kind: FixtureKind; existing?: Fixture } | null;

type PageData = { requestKey: string; fixtures: Fixture[]; templates: ReminderTemplate[]; teams: Team[] };

export function FixturesPage() {
  const { toast, confirm } = useFeedback();
  const [tab, setTab] = usePersistentState<Tab>('fixtures-tab', 'upcoming');
  const [form, setForm] = useState<Form>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<PageData | null>(null);
  // Read the clock once when the page opens.
  const [now] = useState(() => new Date());

  const requestKey = `${tab}|${reloadKey}`;
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchFixtures(now.toISOString(), tab === 'past'), fetchTemplates(), listTeams()])
      .then(([fixtures, templates, teams]) => !cancelled && setData({ requestKey, fixtures, templates, teams }))
      .catch((e) => !cancelled && toast(`${t('Kunne ikke hente kalenderen', "Couldn't load the calendar")}: ${e.message}`, 'error'));
    return () => {
      cancelled = true;
    };
  }, [tab, requestKey, now, toast]);

  const reload = () => setReloadKey((k) => k + 1);

  async function remove(fixture: Fixture) {
    const ok = await confirm({
      title: t(`Slette «${fixtureHeading(fixture)}»?`, `Delete “${fixtureHeading(fixture)}”?`),
      body: t(
        'Påminnelsene fjernes fra spillernes telefoner neste gang de åpner appen.',
        "The reminders are removed from the players' phones the next time they open the app.",
      ),
      confirmLabel: t('Slett', 'Delete'),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteFixture(fixture.id);
      toast(t('Slettet.', 'Deleted.'));
      reload();
    } catch (e) {
      toast(`${t('Kunne ikke slette', "Couldn't delete")}: ${(e as Error).message}`, 'error');
    }
  }

  if (!data) return <p className="muted">{t('Laster…', 'Loading…')}</p>;
  const loading = data.requestKey !== requestKey;
  const teamName = new Map(data.teams.map((team) => [team.id, team.name]));
  const en = getLanguage() === 'en';

  // Group by day for the list.
  const byDay = new Map<string, Fixture[]>();
  for (const f of data.fixtures) {
    const day = toISODate(new Date(f.starts_at));
    byDay.set(day, [...(byDay.get(day) ?? []), f]);
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title={t('Kamper og treninger', 'Matches and training')}
        subtitle={t('Kalender for lagene, og påminnelser om mat og drikke til spillerne', 'The teams’ calendar, and food and drink reminders to the players')}
        actions={
          <>
            <button className="primary" onClick={() => setForm({ kind: 'match' })}>
              <Plus size={15} /> {t('Ny kamp', 'New match')}
            </button>
            <button onClick={() => setForm({ kind: 'training' })}>
              <Plus size={15} /> {t('Ny trening', 'New training')}
            </button>
          </>
        }
      />

      {form && (
        <FixtureForm
          key={form.existing?.id ?? `new-${form.kind}`}
          kind={form.kind}
          existing={form.existing}
          teams={data.teams}
          templates={data.templates}
          todayIso={toISODate(now)}
          onSaved={() => {
            setForm(null);
            reload();
          }}
          onCancel={() => setForm(null)}
        />
      )}

      <Segmented
        label={t('Vis', 'Show')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'upcoming', label: t('Kommende', 'Upcoming') },
          { value: 'past', label: t('Tidligere', 'Past') },
          { value: 'templates', label: t('Påminnelsesmaler', 'Reminder templates') },
        ]}
      />

      {tab === 'templates' ? (
        <TemplatesCard templates={data.templates} onChanged={reload} />
      ) : data.fixtures.length === 0 ? (
        <section className="card">
          <p className="muted" style={{ margin: 0 }}>
            {tab === 'upcoming'
              ? t('Ingen kommende kamper eller treninger. Legg til en med knappene over.', 'No upcoming matches or training. Add one with the buttons above.')
              : t('Ingen tidligere kamper eller treninger.', 'No past matches or training.')}
          </p>
        </section>
      ) : (
        <div className="stack-lg" style={{ opacity: loading ? 0.6 : 1 }}>
          {[...byDay.entries()].map(([day, fixtures]) => (
            <section key={day} className="stack" style={{ gap: 8 }}>
              <h2 className="row" style={{ gap: 8, margin: 0 }}>
                <CalendarDays size={16} className="muted" />
                {new Date(`${day}T12:00`).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })}
              </h2>
              {fixtures.map((f) => {
                const start = new Date(f.starts_at);
                const end = new Date(f.ends_at);
                const upcoming = f.reminders.filter((r) => new Date(r.send_at) > now);
                return (
                  <article key={f.id} className="card stack" style={{ gap: 10 }}>
                    <div className="row spread" style={{ alignItems: 'flex-start' }}>
                      <div className="row" style={{ gap: 12, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                        <span className={`fixture-icon ${f.kind}`} aria-hidden>
                          {f.kind === 'match' ? <Trophy size={16} /> : <Dumbbell size={16} />}
                        </span>
                        <div>
                          <strong>{fixtureHeading(f)}</strong>
                          <div className="muted small">
                            {start.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}–
                            {end.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}
                            {f.location && (
                              <>
                                {' '}
                                · <MapPin size={12} style={{ verticalAlign: '-1px' }} /> {f.location}
                              </>
                            )}
                          </div>
                          <div className="row" style={{ gap: 6, marginTop: 6 }}>
                            {f.team_ids.map((id) => (
                              <span key={id} className="pill">
                                {teamName.get(id) ?? '?'}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                        <button className="small" onClick={() => setForm({ kind: f.kind, existing: f })}>
                          <Pencil size={12} /> {t('Rediger', 'Edit')}
                        </button>
                        <button className="small danger" onClick={() => void remove(f)} aria-label={t('Slett', 'Delete')}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {f.reminders.length === 0 ? (
                      <span className="faint small">{t('Ingen påminnelser.', 'No reminders.')}</span>
                    ) : (
                      <details>
                        <summary className="small muted">
                          {f.reminders.length === 1
                            ? t('1 påminnelse', '1 reminder')
                            : t(`${f.reminders.length} påminnelser`, `${f.reminders.length} reminders`)}
                          {tab === 'upcoming' && upcoming.length < f.reminders.length
                            ? t(` (${f.reminders.length - upcoming.length} allerede sendt)`, ` (${f.reminders.length - upcoming.length} already sent)`)
                            : ''}
                        </summary>
                        <ul className="reminder-list">
                          {f.reminders.map((r) => (
                            <li key={r.id} className={new Date(r.send_at) <= now ? 'sent' : ''}>
                              <span className="faint small">
                                {formatWhen(new Date(r.send_at))} · {timingLabel(r)}
                              </span>
                              <span className="small">{en && r.body_en ? r.body_en : r.body_nb}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </article>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
