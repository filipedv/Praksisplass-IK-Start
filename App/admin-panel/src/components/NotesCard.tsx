// "Notater" on a player's page (coach dashboard sketch): short notes for
// staff, e.g. "Nevnte lett kneplage — følg opp med fysio".
//
// Visible to admins and coaches only; the player never sees them in the app.
// BUT the player has a right of access (GDPR), so notes are included in
// "Last ned alle data" — write them as if the player could read them.
// Only the author can edit a note; the author or an admin can delete it.

import { NotebookPen, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAuth } from '../auth/auth-context';
import { useFeedback } from '../feedback/feedback-context';
import { addNote, deleteNote, fetchNotes, updateNote, type Note } from '../lib/body-api';
import { formatDateTime } from '../lib/format';
import { t } from '../lib/i18n';

const MAX_LENGTH = 2000;

export function NotesCard({ userId }: { userId: string }) {
  const { toast, confirm } = useFeedback();
  const { profile: me, isAdmin } = useAuth();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchNotes(userId)
      .then((rows) => !cancelled && setNotes(rows))
      .catch((e) => {
        if (cancelled) return;
        setNotes([]);
        toast(`${t('Kunne ikke hente notater', "Couldn't load notes")}: ${e.message}`, 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey, toast]);

  async function run(action: () => Promise<void>, done: () => void) {
    setBusy(true);
    try {
      await action();
      done();
      setReloadKey((k) => k + 1);
    } catch (e) {
      toast(`${t('Kunne ikke lagre', "Couldn't save")}: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(note: Note) {
    const ok = await confirm({ title: t('Slette notatet?', 'Delete the note?'), body: note.body.slice(0, 200), confirmLabel: t('Slett', 'Delete'), danger: true });
    if (ok) await run(() => deleteNote(note.id), () => {});
  }

  return (
    <section className="card stack">
      <div className="card-header" style={{ marginBottom: 0 }}>
        <h2 className="row" style={{ gap: 8 }}>
          <NotebookPen size={16} className="muted" /> {t('Notater', 'Notes')}
        </h2>
        <span className="faint small">{t('Kun synlig for administratorer og trenere', 'Only visible to administrators and coaches')}</span>
      </div>

      <form
        className="stack"
        style={{ gap: 8 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) void run(() => addNote(userId, text.trim()), () => setText(''));
        }}>
        <textarea
          rows={2}
          maxLength={MAX_LENGTH}
          placeholder={t('Skriv et notat…', 'Write a note…')}
          aria-label={t('Nytt notat', 'New note')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // ⌘/Ctrl + Enter saves; plain Enter makes a new line.
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) (e.currentTarget.form as HTMLFormElement).requestSubmit();
          }}
        />
        <div className="row spread">
          <span className="faint small">{t('Spilleren kan be om innsyn — skriv saklig.', 'The player can ask to see notes — keep them factual.')}</span>
          <button type="submit" className="primary small" disabled={busy || !text.trim()}>
            {t('Legg til', 'Add')}
          </button>
        </div>
      </form>

      <div className="stack" style={{ gap: 8, maxHeight: 360, overflowY: 'auto' }}>
        {notes === null && <p className="muted small">{t('Laster…', 'Loading…')}</p>}
        {notes?.length === 0 && <p className="muted small">{t('Ingen notater ennå.', 'No notes yet.')}</p>}
        {notes?.map((n) => {
          const mine = n.author_id === me?.id;
          return (
            <div key={n.id} className="note">
              <div className="row spread" style={{ gap: 8 }}>
                <span className="faint small">
                  {formatDateTime(n.created_at)} · {n.author_name ?? t('ukjent', 'unknown')}
                  {n.updated_at !== n.created_at ? ` · ${t('redigert', 'edited')}` : ''}
                </span>
                <span className="row" style={{ gap: 2 }}>
                  {mine && (
                    <button className="small ghost" aria-label={t('Rediger notat', 'Edit note')} onClick={() => setEditing({ id: n.id, text: n.body })}>
                      <Pencil size={13} />
                    </button>
                  )}
                  {(mine || isAdmin) && (
                    <button className="small ghost danger" aria-label={t('Slett notat', 'Delete note')} onClick={() => void remove(n)}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </span>
              </div>
              {editing?.id === n.id ? (
                <form
                  className="stack"
                  style={{ gap: 6, marginTop: 6 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editing.text.trim()) void run(() => updateNote(n.id, editing.text.trim()), () => setEditing(null));
                  }}>
                  <textarea rows={3} maxLength={MAX_LENGTH} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} autoFocus />
                  <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                    <button type="button" className="small" onClick={() => setEditing(null)}>
                      {t('Avbryt', 'Cancel')}
                    </button>
                    <button type="submit" className="small primary" disabled={busy || !editing.text.trim()}>
                      {t('Lagre', 'Save')}
                    </button>
                  </div>
                </form>
              ) : (
                <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{n.body}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
