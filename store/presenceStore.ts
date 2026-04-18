'use client';
import { create } from 'zustand';

export type PresenceUser = {
  user_id: string;
  username: string | null;
  joined_at: string;
};

export type RemoteCursor = {
  user_id: string;
  username: string | null;
  card_id: string;
  x: number;
  y: number;
  at: number;
};

type State = {
  users: Record<string, PresenceUser>;
  cursors: Record<string, RemoteCursor>;
  setUsers: (u: Record<string, PresenceUser>) => void;
  setCursor: (c: RemoteCursor) => void;
  removeCursor: (userId: string) => void;
};

export const usePresence = create<State>((set) => ({
  users: {},
  cursors: {},
  setUsers: (u) => set({ users: u }),
  setCursor: (c) =>
    set((s) => ({ cursors: { ...s.cursors, [c.user_id]: c } })),
  removeCursor: (userId) =>
    set((s) => {
      const next = { ...s.cursors };
      delete next[userId];
      return { cursors: next };
    }),
}));
