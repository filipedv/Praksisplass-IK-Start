// New / edit fixture: what, when, which teams — and which reminders the
// players get. Every template for this kind of fixture is listed with a
// checkbox (the usual ones are ticked already). A ticked reminder's text can
// be changed for this fixture only ("Endre tekst"), and "+ Egendefinert"
// adds a reminder with your own time and text.
//
// The preview shows the text as a player will see it ({motstander} etc.
// filled in) and when it goes out.

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { useFeedback } from '../feedback/feedback-context';
import {
  PLACEHOLDERS,
  fillPlaceholders,
  formatWhen,
  saveFixture,
  sendAtPreview,
  timingLabel,
  type Fixture,
  type FixtureKind,
  type ReminderTemplate,
  type Timing,
} from '../lib/fixtures-api';
import { toISODate } from '../lib/format';
import { getLanguage, t } from '../lib/i18n';
import type { Team } from '../lib/types';
import { Segmented } from './ui';
import { TimingInput } from './TimingInput';

/** One row in the reminder list. templateId null = "Egendefinert". */
type ReminderRow = Timing & {
  key: string;
  templateId: string | null;
  name: string;
  selected: boolean;
  bodyNb: string;
  bodyEn: string;
  editing: boolean;
};

type Draft = {
  kind: FixtureKind;
  title: string;
  opponent: string;
  homeAway: '' | 'home' | 'away';
  location: string;
  date: string;
  start: string;
  end: string;
  teamIds: string[];
};

/** Usual length, used to suggest the end time. */
const DEFAULT_MINUTES: Record<FixtureKind, number> = { match: 120, training: 90 };

let rowCounter = 0;
const newKey = () => `row-${++rowCounter}`;

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Template rows for a kind; an existing fixture's chosen reminders are ticked with their own texts. */
function buildRows(kind: FixtureKind, templates: ReminderTemplate[], existing?: Fixture): ReminderRow[] {
  const rows: ReminderRow[] = templates
    .filter((tpl) => tpl.kind === kind)
    .map((tpl) => {
      const chosen = existing?.reminders.find((r) => r.template_id === tpl.id);
      const source = chosen ?? tpl;
      return {
        key: newKey(),
        templateId: tpl.id,
        name: tpl.name,
        selected: existing ? !!chosen : tpl.default_selected,
        anchor: source.anchor,
        offset_minutes: source.offset_minutes,
        at_time: source.at_time,
        bodyNb: source.body_nb,
        bodyEn: source.body_en ?? '',
        editing: false,
      };
    });
  // Custom reminders (and ones whose template has since been deleted).
  for (const r of existing?.reminders ?? []) {
    if (r.template_id && templates.some((tpl) => tpl.id === r.template_id && tpl.kind === kind)) continue;
    rows.push({
      key: newKey(),
      templateId: null,
      name: t('Egendefinert', 'Custom'),
      selected: true,
      anchor: r.anchor,
      offset_minutes: r.offset_minutes,
      at_time: r.at_time,
      bodyNb: r.body_nb,
      bodyEn: r.body_en ?? '',
      editing: true,
    });
  }
  return rows;
}

type Props = {
  kind: FixtureKind;
  existing?: Fixture;
  teams: Team[];
  templates: ReminderTemplate[];
  todayIso: string;
  onSaved: () => void;
  onCancel: () => void;
};

export function FixtureForm({ kind, existing, teams, templates, todayIso, onSaved, onCancel }: Props) {
  const { toast } = useFeedback();
  const [draft, setDraft] = useState<Draft>(() => {
    if (existing) {
      const start = new Date(existing.starts_at);
      return {
        kind: existing.kind,
        title: existing.title ?? '',
        opponent: existing.opponent ?? '',
        homeAway: existing.home_away ?? '',
        location: existing.location ?? '',
        date: toISODate(start),
        start: hhmm(start),
        end: hhmm(new Date(existing.ends_at)),
        teamIds: existing.team_ids,
      };
    }
    const start = kind === 'match' ? '18:00' : '17:00';
    return {
      kind,
      title: '',
      opponent: '',
      homeAway: kind === 'match' ? 'home' : '',
      location: '',
      date: todayIso,
      start,
      end: addMinutes(start, DEFAULT_MINUTES[kind]),
      // One team? Pick it straight away.
      teamIds: teams.length === 1 ? [teams[0].id] : [],
    };
  });
  const [rows, setRows] = useState<ReminderRow[]>(() => buildRows(existing?.kind ?? kind, templates, existing));
  const [busy, setBusy] = useState(false);
  // Read the clock once (for "time has passed"), not on every render.
  const [now] = useState(() => new Date());

  const set = (changes: Partial<Draft>) => setDraft({ ...draft, ...changes });
  const setRow = (key: string, changes: Partial<ReminderRow>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...changes } : r)));

  function changeKind(next: FixtureKind) {
    if (next === draft.kind) return;
    set({ kind: next, homeAway: next === 'match' ? draft.homeAway || 'home' : '', opponent: next === 'match' ? draft.opponent : '' });
    // Swap the template rows; keep the custom ones.
    setRows([...buildRows(next, templates), ...rows.filter((r) => r.templateId === null)]);
  }

  function changeStart(time: string) {
    // Keep the same length when the start moves.
    const [sh, sm] = draft.start.split(':').map(Number);
    const [eh, em] = draft.end.split(':').map(Number);
    const length = (eh * 60 + em - (sh * 60 + sm) + 24 * 60) % (24 * 60) || DEFAULT_MINUTES[draft.kind];
    set({ start: time, end: time ? addMinutes(time, length) : draft.end });
  }

  function addCustom() {
    setRows([
      ...rows,
      {
        key: newKey(),
        templateId: null,
        name: t('Egendefinert', 'Custom'),
        selected: true,
        anchor: 'before_start',
        offset_minutes: 120,
        at_time: null,
        bodyNb: '',
        bodyEn: '',
        editing: true,
      },
    ]);
  }

  // Times in the admin's browser (Norway). The end may be after midnight.
  const startDate = new Date(`${draft.date}T${draft.start || '00:00'}`);
  let endDate = new Date(`${draft.date}T${draft.end || '00:00'}`);
  if (endDate <= startDate) endDate = new Date(endDate.getTime() + 86_400_000);
  const teamName = teams.find((team) => team.id === draft.teamIds[0])?.name ?? null;
  const preview = (text: string) =>
    fillPlaceholders(text, { team: teamName, opponent: draft.opponent.trim() || null, start: startDate, location: draft.location.trim() || null }, getLanguage());

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.date || !draft.start) return toast(t('Velg dato og starttid.', 'Choose a date and start time.'), 'error');
    if (draft.teamIds.length === 0) return toast(t('Velg minst ett lag.', 'Choose at least one team.'), 'error');
    const chosen = rows.filter((r) => r.selected);
    if (chosen.some((r) => !r.bodyNb.trim())) return toast(t('Alle valgte påminnelser trenger en norsk tekst.', 'Every chosen reminder needs a Norwegian text.'), 'error');
    if (chosen.some((r) => (r.anchor === 'day_before' || r.anchor === 'same_day') && !r.at_time))
      return toast(t('Velg klokkeslett for påminnelsene.', 'Choose a time of day for the reminders.'), 'error');

    setBusy(true);
    try {
      await saveFixture(
        existing?.id ?? null,
        {
          kind: draft.kind,
          title: draft.title.trim() || null,
          opponent: draft.kind === 'match' ? draft.opponent.trim() || null : null,
          home_away: draft.kind === 'match' && draft.homeAway ? draft.homeAway : null,
          location: draft.location.trim() || null,
          starts_at: startDate.toISOString(),
          ends_at: endDate.toISOString(),
        },
        draft.teamIds,
        chosen.map((r) => ({
          template_id: r.templateId,
          anchor: r.anchor,
          offset_minutes: r.offset_minutes,
          at_time: r.at_time,
          body_nb: r.bodyNb.trim(),
          body_en: r.bodyEn.trim() || null,
        })),
      );
      toast(existing ? t('Endringene er lagret.', 'The changes have been saved.') : t('Lagt til i kalenderen.', 'Added to the calendar.'));
      onSaved();
    } catch (err) {
      toast(`${t('Kunne ikke lagre', "Couldn't save")}: ${(err as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  const selectedCount = rows.filter((r) => r.selected).length;

  return (
    <form className="card stack-lg" onSubmit={handleSubmit}>
      <div className="row spread">
        <h2 style={{ margin: 0 }}>
          {existing ? t('Rediger', 'Edit') : draft.kind === 'match' ? t('Ny kamp', 'New match') : t('Ny trening', 'New training')}
        </h2>
        <Segmented
          label={t('Type', 'Type')}
          value={draft.kind}
          onChange={changeKind}
          options={[
            { value: 'match', label: t('Kamp', 'Match') },
            { value: 'training', label: t('Trening', 'Training') },
          ]}
        />
      </div>

      <div className="grid-2">
        {draft.kind === 'match' ? (
          <label>
            {t('Motstander', 'Opponent')}
            <input value={draft.opponent} onChange={(e) => set({ opponent: e.target.value })} placeholder={t('f.eks. Vålerenga', 'e.g. Vålerenga')} autoFocus />
          </label>
        ) : (
          <label>
            {t('Tittel (valgfritt)', 'Title (optional)')}
            <input value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder={t('f.eks. Styrkeøkt', 'e.g. Strength session')} autoFocus />
          </label>
        )}
        <label>
          {t('Sted', 'Place')}
          <input value={draft.location} onChange={(e) => set({ location: e.target.value })} placeholder={t('f.eks. Sparebanken Sør Arena', 'e.g. Sparebanken Sør Arena')} />
        </label>
        <label>
          {t('Dato', 'Date')}
          <input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} required />
        </label>
        <div className="grid-2" style={{ gap: 12 }}>
          <label>
            {t('Start', 'Start')}
            <input type="time" value={draft.start} onChange={(e) => changeStart(e.target.value)} required />
          </label>
          <label>
            {t('Slutt', 'End')}
            <input type="time" value={draft.end} onChange={(e) => set({ end: e.target.value })} required />
          </label>
        </div>
        {draft.kind === 'match' && (
          <>
            <label>
              {t('Hjemme / borte', 'Home / away')}
              <select value={draft.homeAway} onChange={(e) => set({ homeAway: e.target.value as Draft['homeAway'] })}>
                <option value="home">{t('Hjemme', 'Home')}</option>
                <option value="away">{t('Borte', 'Away')}</option>
                <option value="">{t('Ikke oppgitt', 'Not given')}</option>
              </select>
            </label>
            <label>
              {t('Tittel (valgfritt)', 'Title (optional)')}
              <input value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder={t('f.eks. Seriekamp, Cup', 'e.g. League, Cup')} />
            </label>
          </>
        )}
      </div>

      <fieldset className="stack" style={{ gap: 8, border: 0, padding: 0, margin: 0 }}>
        <legend className="stat-label" style={{ marginBottom: 8 }}>
          {t('Lag', 'Teams')}
        </legend>
        {teams.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>
            {t('Ingen lag ennå — opprett lag under «Lag» først.', 'No teams yet — create teams under “Teams” first.')}
          </p>
        ) : (
          <div className="row" style={{ gap: 16 }}>
            {teams.map((team) => (
              <label key={team.id} className="checkbox">
                <input
                  type="checkbox"
                  checked={draft.teamIds.includes(team.id)}
                  onChange={(e) =>
                    set({ teamIds: e.target.checked ? [...draft.teamIds, team.id] : draft.teamIds.filter((id) => id !== team.id) })
                  }
                />
                {team.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="stack" style={{ gap: 8 }}>
        <div className="row spread">
          <strong>
            {t('Påminnelser til spillerne', 'Reminders to the players')} ({selectedCount})
          </strong>
          <span className="faint small">
            {t('Felt som fylles ut automatisk:', 'Filled in automatically:')} {PLACEHOLDERS.join(' ')}
          </span>
        </div>
        {rows.map((row) => {
          const sendAt = sendAtPreview(row, startDate, endDate);
          const past = sendAt < now;
          return (
            <div key={row.key} className={`reminder-row${row.selected ? '' : ' off'}`}>
              <div className="row" style={{ gap: 10, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={(e) => setRow(row.key, { selected: e.target.checked })}
                  aria-label={`${row.name}: ${t('send denne', 'send this')}`}
                  style={{ marginTop: 3 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row spread" style={{ gap: 8 }}>
                    <span>
                      <strong className="small">{row.name}</strong>{' '}
                      <span className="faint small">
                        · {timingLabel(row)} · {formatWhen(sendAt)}
                      </span>
                      {row.selected && past && (
                        <span className="pill warn" style={{ marginLeft: 8 }}>
                          {t('Tidspunktet er passert — sendes ikke', 'Time has passed — not sent')}
                        </span>
                      )}
                    </span>
                    <span className="row" style={{ gap: 2 }}>
                      {row.templateId && !row.editing && (
                        <button type="button" className="small ghost" onClick={() => setRow(row.key, { editing: true, selected: true })}>
                          <Pencil size={12} /> {t('Endre tekst', 'Edit text')}
                        </button>
                      )}
                      {row.templateId === null && (
                        <button
                          type="button"
                          className="small ghost danger"
                          onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
                          aria-label={t('Fjern påminnelsen', 'Remove the reminder')}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </span>
                  </div>
                  {row.editing ? (
                    <div className="stack" style={{ gap: 6, marginTop: 6 }}>
                      <TimingInput value={row} onChange={(timing) => setRow(row.key, timing)} />
                      <textarea
                        rows={2}
                        maxLength={300}
                        value={row.bodyNb}
                        onChange={(e) => setRow(row.key, { bodyNb: e.target.value })}
                        placeholder={t('Tekst på norsk', 'Text in Norwegian')}
                        aria-label={t('Tekst på norsk', 'Text in Norwegian')}
                      />
                      <textarea
                        rows={2}
                        maxLength={300}
                        value={row.bodyEn}
                        onChange={(e) => setRow(row.key, { bodyEn: e.target.value })}
                        placeholder={t('Tekst på engelsk (valgfritt — ellers vises den norske)', 'Text in English (optional — otherwise the Norwegian is shown)')}
                        aria-label={t('Tekst på engelsk', 'Text in English')}
                      />
                      {row.bodyNb.trim() && <p className="faint small" style={{ margin: 0 }}>{t('Spilleren ser:', 'The player sees:')} «{preview(row.bodyNb)}»</p>}
                    </div>
                  ) : (
                    <p className="small" style={{ margin: '4px 0 0', color: 'var(--text-2)' }}>
                      {preview(getLanguage() === 'en' && row.bodyEn ? row.bodyEn : row.bodyNb)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <button type="button" className="ghost" onClick={addCustom} style={{ alignSelf: 'flex-start' }}>
          <Plus size={14} /> {t('Egendefinert påminnelse', 'Custom reminder')}
        </button>
        <p className="faint small" style={{ margin: 0 }}>
          {t(
            'Påminnelsene legges inn på spillerens telefon neste gang appen åpnes. Legg inn kamper i god tid, og be spillerne åpne appen etterpå. Tekstene er forslag — ikke ernæringsråd.',
            "Reminders are put on the player's phone the next time they open the app. Add fixtures in good time, and ask the players to open the app afterwards. The texts are suggestions — not nutrition advice.",
          )}
        </p>
      </div>

      <div className="row">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? t('Lagrer…', 'Saving…') : existing ? t('Lagre endringer', 'Save changes') : t('Legg til', 'Add')}
        </button>
        <button type="button" onClick={onCancel} disabled={busy}>
          {t('Avbryt', 'Cancel')}
        </button>
      </div>
    </form>
  );
}
