'use client';
import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

export type Toast = {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
  durationMs: number;
};

type State = {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id' | 'durationMs'> & { durationMs?: number }) => string;
  dismiss: (id: string) => void;
};

let counter = 0;
const nextId = () => {
  counter += 1;
  return `t-${Date.now()}-${counter}`;
};

const DEFAULT_DURATION: Record<ToastKind, number> = {
  success: 3000,
  info: 3000,
  warning: 5000,
  error: 6000,
};

export const useToastStore = create<State>((set, get) => ({
  toasts: [],
  push(input) {
    const id = nextId();
    const durationMs = input.durationMs ?? DEFAULT_DURATION[input.kind];
    set((s) => ({
      toasts: [...s.toasts, { id, kind: input.kind, title: input.title, description: input.description, durationMs }],
    }));
    if (durationMs > 0) {
      setTimeout(() => get().dismiss(id), durationMs);
    }
    return id;
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ kind: 'success', title, description }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ kind: 'error', title, description }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().push({ kind: 'warning', title, description }),
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ kind: 'info', title, description }),
};
