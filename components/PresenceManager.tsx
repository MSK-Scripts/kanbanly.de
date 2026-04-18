'use client';
import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePresence, type PresenceUser } from '@/store/presenceStore';
import { useBoard } from '@/store/boardStore';

type Props = {
  boardId: string;
  userId: string;
  username: string | null;
};

const CURSOR_STALE_MS = 5000;
const CURSOR_THROTTLE_MS = 50;

export function PresenceManager({ boardId, userId, username }: Props) {
  const setUsers = usePresence((s) => s.setUsers);
  const setCursor = usePresence((s) => s.setCursor);
  const removeCursor = usePresence((s) => s.removeCursor);
  const openCardId = useBoard((s) => s.openCardId);

  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>['channel']
  > | null>(null);
  const lastSentRef = useRef(0);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const openCardIdRef = useRef<string | null>(openCardId);

  useEffect(() => {
    openCardIdRef.current = openCardId;
    if (!openCardId && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'cursor-leave',
        payload: { user_id: userId },
      });
    }
  }, [openCardId, userId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`board:${boardId}:presence`, {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: Record<string, PresenceUser> = {};
        for (const key of Object.keys(state)) {
          const entries = state[key] as Array<Record<string, unknown>>;
          const first = entries[0];
          if (!first) continue;
          users[key] = {
            user_id: key,
            username: (first.username as string | null) ?? null,
            joined_at:
              (first.joined_at as string | undefined) ?? new Date().toISOString(),
          };
        }
        setUsers(users);
      })
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        const p = payload as {
          user_id?: string;
          username?: string | null;
          card_id?: string;
          x?: number;
          y?: number;
        };
        if (
          !p.user_id ||
          !p.card_id ||
          typeof p.x !== 'number' ||
          typeof p.y !== 'number'
        )
          return;
        if (p.user_id === userId) return;
        setCursor({
          user_id: p.user_id,
          username: p.username ?? null,
          card_id: p.card_id,
          x: p.x,
          y: p.y,
          at: Date.now(),
        });
      })
      .on('broadcast', { event: 'cursor-leave' }, ({ payload }) => {
        const p = payload as { user_id?: string };
        if (p.user_id && p.user_id !== userId) removeCursor(p.user_id);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            username,
            joined_at: new Date().toISOString(),
          });
        }
      });

    const pruneInterval = setInterval(() => {
      const state = usePresence.getState();
      const now = Date.now();
      for (const [uid, c] of Object.entries(state.cursors)) {
        if (now - c.at > CURSOR_STALE_MS) removeCursor(uid);
      }
    }, 1000);

    return () => {
      clearInterval(pruneInterval);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [boardId, userId, username, setUsers, setCursor, removeCursor]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const cardId = openCardIdRef.current;
      if (!cardId) return;
      pendingRef.current = { x: e.clientX, y: e.clientY };
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const now = Date.now();
        if (now - lastSentRef.current < CURSOR_THROTTLE_MS) return;
        lastSentRef.current = now;
        const pt = pendingRef.current;
        if (!pt) return;
        const ch = channelRef.current;
        if (!ch) return;
        ch.send({
          type: 'broadcast',
          event: 'cursor',
          payload: {
            user_id: userId,
            username,
            card_id: cardId,
            x: pt.x,
            y: pt.y,
          },
        });
      });
    };
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [userId, username]);

  return null;
}
