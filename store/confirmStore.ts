'use client';
import { create } from 'zustand';

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type State = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  resolve: ((ok: boolean) => void) | null;
  prompt: (opts: ConfirmOptions) => Promise<boolean>;
  close: (ok: boolean) => void;
};

export const useConfirmStore = create<State>((set, get) => ({
  open: false,
  title: '',
  description: undefined,
  confirmLabel: 'Bestätigen',
  cancelLabel: 'Abbrechen',
  danger: false,
  resolve: null,

  prompt(opts) {
    return new Promise<boolean>((resolve) => {
      set({
        open: true,
        title: opts.title,
        description: opts.description,
        confirmLabel: opts.confirmLabel ?? 'Bestätigen',
        cancelLabel: opts.cancelLabel ?? 'Abbrechen',
        danger: opts.danger ?? false,
        resolve,
      });
    });
  },

  close(ok) {
    const r = get().resolve;
    set({ open: false, resolve: null });
    if (r) r(ok);
  },
}));

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().prompt(opts);
}
