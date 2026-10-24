// ⌘K (Ctrl+K on Windows) quick search: jump to a person, team, food or page
// from anywhere, using only the keyboard.
//   ↑/↓ to move, Enter to open, Esc to close.

import { Apple, CornerDownLeft, FileText, Search, Shield, User, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { supabase } from '../lib/supabase';

type Result = { key: string; label: string; hint: string; icon: typeof User; to: string };

const PAGES: Result[] = [
  { key: 'p:/', label: 'Oversikt', hint: 'Side', icon: FileText, to: '/' },
  { key: 'p:/users', label: 'Brukere', hint: 'Side', icon: FileText, to: '/users' },
  { key: 'p:/teams', label: 'Lag', hint: 'Side', icon: FileText, to: '/teams' },
  { key: 'p:/foods', label: 'Matvarer', hint: 'Side', icon: FileText, to: '/foods' },
  { key: 'p:/recognition', label: 'Gjenkjenning', hint: 'Side', icon: FileText, to: '/recognition' },
  { key: 'p:/log', label: 'Endringslogg', hint: 'Side', icon: Shield, to: '/log' },
  { key: 'p:/settings', label: 'Klubbinnstillinger', hint: 'Side', icon: FileText, to: '/settings' },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<Result[]>([]);
  const [teams, setTeams] = useState<Result[]>([]);
  const [foods, setFoods] = useState<Result[]>([]);
  const [active, setActive] = useState(0);

  // Open/close the native modal dialog with the `open` prop.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // People and teams are few: load them each time the palette opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([supabase.from('profiles').select('id, display_name, role'), supabase.from('teams').select('id, name')]).then(
      ([p, t]) => {
        if (cancelled) return;
        setPeople((p.data ?? []).map((u) => ({ key: `u:${u.id}`, label: u.display_name, hint: 'Person', icon: User, to: `/users/${u.id}` })));
        setTeams((t.data ?? []).map((team) => ({ key: `t:${team.id}`, label: team.name, hint: 'Lag', icon: Users, to: `/users?team=${team.id}` })));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Foods: search the database as you type (debounced).
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (query.trim().length < 2) {
        if (!cancelled) setFoods([]);
        return;
      }
      const { data } = await supabase.rpc('search_foods', { search_text: query, max_results: 5 });
      if (cancelled) return;
      setFoods(
        ((data ?? []) as { id: string; name_nb: string }[]).map((f) => ({
          key: `f:${f.id}`,
          label: f.name_nb,
          hint: 'Matvare',
          icon: Apple,
          to: `/foods?q=${encodeURIComponent(f.name_nb)}`,
        })),
      );
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const q = query.trim().toLowerCase();
  const match = (r: Result) => !q || r.label.toLowerCase().includes(q);
  const results = [...people.filter(match).slice(0, 6), ...teams.filter(match), ...PAGES.filter(match), ...foods].slice(0, 14);
  const current = Math.min(active, Math.max(results.length - 1, 0));

  function go(result: Result | undefined) {
    if (!result) return;
    close();
    navigate(result.to);
  }

  function close() {
    setQuery('');
    setActive(0);
    onClose();
  }

  return (
    <dialog ref={dialogRef} onCancel={close} className="palette" aria-label="Hurtigsøk">
      <div className="search">
        <Search size={16} />
        <input
          autoFocus
          placeholder="Søk etter person, lag, matvare eller side …"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              go(results[current]);
            }
          }}
        />
      </div>
      <div className="palette-results" role="listbox">
        {results.map((r, i) => {
          const Icon = r.icon;
          return (
            <button
              key={r.key}
              type="button"
              role="option"
              aria-selected={i === current}
              className={`palette-item ${i === current ? 'active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(r)}>
              <Icon size={15} />
              <span style={{ flex: 1 }}>{r.label}</span>
              <span className="faint small">{r.hint}</span>
              {i === current && <CornerDownLeft size={13} className="faint" />}
            </button>
          );
        })}
        {results.length === 0 && <p className="muted small" style={{ padding: 12, margin: 0 }}>Ingen treff.</p>}
      </div>
      <p className="faint small" style={{ margin: '10px 4px 0' }}>
        ↑ ↓ for å velge · Enter for å åpne · Esc for å lukke
      </p>
    </dialog>
  );
}
