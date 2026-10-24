// Shared "feedback" helpers for every page:
//   const { toast, confirm } = useFeedback();
//   toast('Lagret.');                       // small message, bottom right
//   if (await confirm({ title: 'Slette?' })) { … }   // in-page dialog
//
// They replace the browser's window.alert/confirm, which look out of place
// and block the whole page. (This file holds only the context + hook, so
// FeedbackProvider.tsx can export just a component — needed for Vite fast refresh.)

import { createContext, use } from 'react';

export type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel?: string;
  danger?: boolean; // red confirm button for destructive actions
  /** For irreversible actions: the user must type this exact text first. */
  requireText?: string;
};

export type FeedbackValue = {
  /** `long: true` keeps a success message up for 30 s (e.g. one that shows a password to copy). */
  toast: (text: string, tone?: 'success' | 'error', options?: { long?: boolean }) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

export const FeedbackContext = createContext<FeedbackValue | null>(null);

export function useFeedback() {
  const value = use(FeedbackContext);
  if (!value) throw new Error('useFeedback must be used inside <FeedbackProvider>');
  return value;
}
