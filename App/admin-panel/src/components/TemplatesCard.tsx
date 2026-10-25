// "Påminnelsesmaler": the club's library of reminder texts. Each template is
// for matches or trainings, has a time ("Dagen før kl. 19:00") and a text in
// Norwegian (+ English). "Forhåndsvalgt" = ticked automatically on a new
// fixture. Changing a template doesn't change fixtures already saved (they
// keep their own copy).

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { useFeedback } from '../feedback/feedback-context';
import { PLACEHOLDERS, deleteTemplate, saveTemplate, timingLabel, type FixtureKind, type ReminderTemplate, type Timing } from '../lib/fixtures-api';
import { getLanguage, t } from '../lib/i18n';
import { TimingInput } from './TimingInput';

type Draft = Timing & { id?: string; kind: FixtureKind; name: string; body_nb: string; body_en: string; default_selected: boolean };

const KIND_LABEL = (kind: FixtureKind) => (kind === 'match' ? t('Kamp', 'Match') : t('Trening', 'Training'));

export function TemplatesCard({ templates, onChanged }: { templates: ReminderTemplate[]; onChanged: () => void }) {
  const { toast, confirm } = useFeedback();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  function startNew(kind: FixtureKind) {
    setDraft({ kind, name: '', anchor: 'before_start', offset_minutes: 120, at_time: null, body_nb: '', body_en: '', default_selected: true });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (!draft.name.trim() || !draft.body_nb.trim()) return toast(t('Fyll inn navn og norsk tekst.', 'Fill in a name and the Norwegian text.'), 'error');
    if ((draft.anchor === 'day_before' || draft.anchor === 'same_day') && !draft.at_time)
      return toast(t('Velg klokkeslett.', 'Choose a time of day.'), 'error');
    setBusy(true);
    try {
      const sameKind = templates.filter((tpl) => tpl.kind === draft.kind);
      await saveTemplate(
        {
          kind: draft.kind,
          name: draft.name.trim(),
          anchor: draft.anchor,
          offset_minutes: draft.offset_minutes,
          at_time: draft.at_time,
          body_nb: draft.body_nb.trim(),
          body_en: draft.body_en.trim() || null,
          default_selected: draft.default_selected,
          // New templates go last.
          sort_order: draft.id
            ? (templates.find((tpl) => tpl.id === draft.id)?.sort_order ?? 0)
            : Math.max(0, ...sameKind.map((tpl) => tpl.sort_order)) + 10,
        },
        draft.id,
      );
      toast(t('Malen er lagret.', 'The template has been saved.'));
      setDraft(null);
      onChanged();
    } catch (err) {
      toast(`${t('Kunne ikke lagre', "Couldn't save")}: ${(err as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(tpl: ReminderTemplate) {
    const ok = await confirm({
      title: t(`Slette malen «${tpl.name}»?`, `Delete the template “${tpl.name}”?`),
      body: t('Kamper og treninger som allerede er lagret, beholder påminnelsene sine.', 'Fixtures already saved keep their reminders.'),
      confirmLabel: t('Slett', 'Delete'),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteTemplate(tpl.id);
      onChanged();
    } catch (err) {
      toast(`${t('Kunne ikke slette', "Couldn't delete")}: ${(err as Error).message}`, 'error');
    }
  }

  const en = getLanguage() === 'en';

  return (
    <div className="stack-lg">
      {draft && (
        <form className="card stack" onSubmit={handleSubmit}>
          <h2 style={{ margin: 0 }}>{draft.id ? t('Rediger mal', 'Edit template') : t('Ny mal', 'New template')}</h2>
          <div className="grid-2">
            <label>
              {t('Navn (for trenerne)', 'Name (for the staff)')}
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={60} placeholder={t('f.eks. Kvelden før', 'e.g. The evening before')} autoFocus />
            </label>
            <label>
              {t('Gjelder', 'For')}
              <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as FixtureKind })}>
                <option value="match">{t('Kamp', 'Match')}</option>
                <option value="training">{t('Trening', 'Training')}</option>
              </select>
            </label>
          </div>
          <label>
            {t('Når', 'When')}
            <TimingInput value={draft} onChange={(timing) => setDraft({ ...draft, ...timing })} />
          </label>
          <label>
            {t('Tekst på norsk', 'Text in Norwegian')}
            <textarea rows={2} maxLength={300} value={draft.body_nb} onChange={(e) => setDraft({ ...draft, body_nb: e.target.value })} />
          </label>
          <label>
            {t('Tekst på engelsk (valgfritt)', 'Text in English (optional)')}
            <textarea rows={2} maxLength={300} value={draft.body_en} onChange={(e) => setDraft({ ...draft, body_en: e.target.value })} />
          </label>
          <p className="faint small" style={{ margin: 0 }}>
            {t('Felt som fylles ut automatisk:', 'Filled in automatically:')} {PLACEHOLDERS.join(' ')}
          </p>
          <label className="checkbox">
            <input type="checkbox" checked={draft.default_selected} onChange={(e) => setDraft({ ...draft, default_selected: e.target.checked })} />
            {t('Forhåndsvalgt på nye kamper/treninger', 'Ticked by default on new fixtures')}
          </label>
          <div className="row">
            <button type="submit" className="primary" disabled={busy}>
              {busy ? t('Lagrer…', 'Saving…') : t('Lagre mal', 'Save template')}
            </button>
            <button type="button" onClick={() => setDraft(null)} disabled={busy}>
              {t('Avbryt', 'Cancel')}
            </button>
          </div>
        </form>
      )}

      {(['match', 'training'] as FixtureKind[]).map((kind) => (
        <section key={kind} className="card flush">
          <div className="row spread" style={{ padding: '16px 20px 4px' }}>
            <h2>
              {t('Maler for', 'Templates for')} {KIND_LABEL(kind).toLowerCase()}
            </h2>
            <button className="small" onClick={() => startNew(kind)}>
              <Plus size={13} /> {t('Ny mal', 'New template')}
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('Navn', 'Name')}</th>
                  <th>{t('Når', 'When')}</th>
                  <th>{t('Tekst', 'Text')}</th>
                  <th>{t('Forhåndsvalgt', 'Default')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {templates
                  .filter((tpl) => tpl.kind === kind)
                  .map((tpl) => (
                    <tr key={tpl.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{tpl.name}</td>
                      <td className="muted small" style={{ whiteSpace: 'nowrap' }}>
                        {timingLabel(tpl)}
                      </td>
                      <td className="small">{en && tpl.body_en ? tpl.body_en : tpl.body_nb}</td>
                      <td>{tpl.default_selected ? <span className="pill ok">✓</span> : <span className="faint">–</span>}</td>
                      <td>
                        <div className="row" style={{ gap: 4, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                          <button
                            className="small ghost"
                            aria-label={t('Rediger mal', 'Edit template')}
                            onClick={() => setDraft({ ...tpl, body_en: tpl.body_en ?? '' })}>
                            <Pencil size={13} />
                          </button>
                          <button className="small ghost danger" aria-label={t('Slett mal', 'Delete template')} onClick={() => void remove(tpl)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p className="faint small" style={{ margin: 0 }}>
        {t(
          'Tekstene er plassholdere og bør kvalitetssikres av en ernæringsfaglig person før de brukes for ungdomsspillere.',
          'The texts are placeholders and should be checked by a qualified nutrition professional before use with youth players.',
        )}
      </p>
    </div>
  );
}
