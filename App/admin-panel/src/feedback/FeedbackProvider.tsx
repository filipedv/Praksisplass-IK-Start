// Renders toasts (bottom-right messages) and the confirm dialog for the whole
// app. Pages use them through useFeedback() — see feedback-context.ts.

import { X } from 'lucide-react';
import { useEffect, useRef, useState, type PropsWithChildren } from 'react';

import { FeedbackContext, type ConfirmOptions } from './feedback-context';

type Toast = { id: number; text: string; tone: 'success' | 'error' };

// Success messages disappear by themselves; errors stay until closed, so they
// can't be missed. `long` messages (e.g. with a password to copy) stay 30 s.
const SUCCESS_MS = 6000;
const LONG_MS = 30000;

let nextId = 1;

export function FeedbackProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const [typed, setTyped] = useState(''); // for confirmations that require typing a name
  const dialogRef = useRef<HTMLDialogElement>(null);

  function dismiss(id: number) {
    setToasts((all) => all.filter((t) => t.id !== id));
  }

  function toast(text: string, tone: 'success' | 'error' = 'success', options?: { long?: boolean }) {
    const id = nextId++;
    setToasts((all) => [...all, { id, text, tone }]);
    if (tone === 'success') setTimeout(() => dismiss(id), options?.long ? LONG_MS : SUCCESS_MS);
  }

  function confirm(options: ConfirmOptions) {
    setTyped('');
    return new Promise<boolean>((resolve) => setPending({ ...options, resolve }));
  }

  // Open the native <dialog> as a modal whenever a confirmation is pending.
  // (showModal gives us focus trapping and Esc-to-cancel for free.)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (pending && dialog && !dialog.open) dialog.showModal();
  }, [pending]);

  function answer(ok: boolean) {
    pending?.resolve(ok);
    setPending(null);
    dialogRef.current?.close();
  }

  return (
    <FeedbackContext value={{ toast, confirm }}>
      {children}

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            <p>{t.text}</p>
            <button className="link-button" onClick={() => dismiss(t.id)} aria-label="Lukk melding">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* onCancel = Esc key or clicking outside on some browsers */}
      <dialog ref={dialogRef} onCancel={() => answer(false)}>
        {pending && (
          <>
            <h2>{pending.title}</h2>
            {pending.body && <p>{pending.body}</p>}
            {pending.requireText && (
              <label style={{ marginBottom: 16 }}>
                Skriv «{pending.requireText}» for å bekrefte
                <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus autoComplete="off" />
              </label>
            )}
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: pending.body ? 0 : 20 }}>
              <button onClick={() => answer(false)}>Avbryt</button>
              <button
                className={pending.danger ? 'primary danger-fill' : 'primary'}
                onClick={() => answer(true)}
                disabled={!!pending.requireText && typed.trim() !== pending.requireText}
                autoFocus={!pending.requireText}>
                {pending.confirmLabel ?? 'OK'}
              </button>
            </div>
          </>
        )}
      </dialog>
    </FeedbackContext>
  );
}
