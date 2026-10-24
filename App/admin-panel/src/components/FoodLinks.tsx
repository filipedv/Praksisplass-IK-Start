// "Koblede etiketter" in the Matvarer detail panel: which recognizer labels
// point to THIS food (food_aliases), with remove buttons, plus a field to link
// a new label here directly (e.g. type "chicken breast" while looking at
// «Kylling, filet, uten skinn, rå»).

import { Link2, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

import { useFeedback } from '../feedback/feedback-context';
import { linkLabel, normalizeLabel, removeAlias } from '../lib/aliases-api';
import { supabase } from '../lib/supabase';

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
        title: `«${label}» er allerede koblet`,
        body: `Den peker i dag til ${existing.food.name_nb}. Vil du flytte koblingen til ${foodName}?`,
        confirmLabel: 'Flytt koblingen',
      });
      if (!ok) return;
    }
    try {
      await linkLabel(label, foodId);
      toast(`«${label}» er koblet til ${foodName}.`);
      setNewLabel('');
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast(`Kunne ikke lagre koblingen: ${(err as Error).message}`, 'error');
    }
  }

  async function remove(row: Row) {
    try {
      await removeAlias(row.id);
      toast(`Koblingen for «${row.label}» er fjernet.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast(`Kunne ikke fjerne: ${(err as Error).message}`, 'error');
    }
  }

  return (
    <div className="stack" style={{ gap: 8, borderTop: '1px solid var(--raised)', paddingTop: 14 }}>
      <strong className="small">Koblede etiketter</strong>
      <p className="faint small" style={{ margin: 0 }}>
        Når gjenkjenningen gir en av disse etikettene, velger appen denne matvaren.
      </p>
      {links === null ? null : links.length === 0 ? (
        <p className="muted small" style={{ margin: 0 }}>
          Ingen ennå.
        </p>
      ) : (
        <div className="row" style={{ gap: 6 }}>
          {links.map((row) => (
            <span key={row.id} className="pill info">
              {row.label}
              <button className="link-button" onClick={() => void remove(row)} aria-label={`Fjern koblingen for ${row.label}`}>
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
          placeholder="Etikett, f.eks. chicken breast"
          aria-label="Ny etikett"
          style={{ flex: 1, minWidth: 0 }}
        />
        <button type="submit" className="small" disabled={!newLabel.trim()}>
          <Link2 size={13} /> Koble hit
        </button>
      </form>
    </div>
  );
}
