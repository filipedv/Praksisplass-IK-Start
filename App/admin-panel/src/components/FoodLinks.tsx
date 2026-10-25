// "Koblede etiketter" in the Matvarer detail panel: which recognizer labels
// point to THIS food (food_aliases), with remove buttons, plus a field to link
// a new label here directly (e.g. type "chicken breast" while looking at
// «Kylling, filet, uten skinn, rå»).

import { Link2, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

import { useFeedback } from '../feedback/feedback-context';
import { linkLabel, normalizeLabel, removeAlias } from '../lib/aliases-api';
import { supabase } from '../lib/supabase';
import { t } from '../lib/i18n';

type Row = { id: string; label: string };

export function FoodLinks({ foodId, foodName }: { foodId: string; foodName: string }) {
  const { toast, confirm } = useFeedback();
  const [links, setLinks] = useState<Row[] | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from('food_aliases')
      .select('id, label')
      .eq('food_id', foodId)
      .order('label')
      .then(({ data }) => !cancelled && setLinks((data ?? []) as Row[]));
    return () => {
      cancelled = true;
    };
  }, [foodId, reloadKey]);

  async function add(e: FormEvent) {
    e.preventDefault();
    const label = normalizeLabel(newLabel);
    if (!label) return;
    // A label can only point to ONE food. If it's linked elsewhere, ask first.
    const { data: existing } = await supabase
      .from('food_aliases')
      .select('food:foods (id, name_nb)')
      .eq('label', label)
      .maybeSingle<{ food: { id: string; name_nb: string } | null }>();
    if (existing?.food && existing.food.id !== foodId) {
      const ok = await confirm({
        title: t(`«${label}» er allerede koblet`, `“${label}” is already linked`),
        body: t(
          `Den peker i dag til ${existing.food.name_nb}. Vil du flytte koblingen til ${foodName}?`,
          `It currently points to ${existing.food.name_nb}. Move the link to ${foodName}?`,
        ),
        confirmLabel: t('Flytt koblingen', 'Move the link'),
      });
      if (!ok) return;
    }
    try {
      await linkLabel(label, foodId);
      toast(t(`«${label}» er koblet til ${foodName}.`, `“${label}” is now linked to ${foodName}.`));
      setNewLabel('');
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast(`${t('Kunne ikke lagre koblingen', "Couldn't save the link")}: ${(err as Error).message}`, 'error');
    }
  }

  async function remove(row: Row) {
    try {
      await removeAlias(row.id);
      toast(t(`Koblingen for «${row.label}» er fjernet.`, `The link for “${row.label}” was removed.`));
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast(`${t('Kunne ikke fjerne', "Couldn't remove")}: ${(err as Error).message}`, 'error');
    }
  }

  return (
    <div className="stack" style={{ gap: 8, borderTop: '1px solid var(--raised)', paddingTop: 14 }}>
      <strong className="small">{t('Koblede etiketter', 'Linked labels')}</strong>
      <p className="faint small" style={{ margin: 0 }}>
        {t('Når gjenkjenningen gir en av disse etikettene, velger appen denne matvaren.', 'When recognition returns one of these labels, the app picks this food.')}
      </p>
      {links === null ? null : links.length === 0 ? (
        <p className="muted small" style={{ margin: 0 }}>
          {t('Ingen ennå.', 'None yet.')}
        </p>
      ) : (
        <div className="row" style={{ gap: 6 }}>
          {links.map((row) => (
            <span key={row.id} className="pill info">
              {row.label}
              <button className="link-button" onClick={() => void remove(row)} aria-label={`${t('Fjern koblingen for', 'Remove the link for')} ${row.label}`}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <form className="row" style={{ flexWrap: 'nowrap', gap: 8 }} onSubmit={add}>
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder={t('Etikett, f.eks. chicken breast', 'Label, e.g. chicken breast')}
          aria-label="Ny etikett"
          style={{ flex: 1, minWidth: 0 }}
        />
        <button type="submit" className="small" disabled={!newLabel.trim()}>
          <Link2 size={13} /> {t('Koble hit', 'Link here')}
        </button>
      </form>
    </div>
  );
}
