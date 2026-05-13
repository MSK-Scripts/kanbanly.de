'use client';
import { createPortal } from 'react-dom';
import { usePresence } from '@/store/presenceStore';
import { useBoard } from '@/store/boardStore';
import { useMounted } from '@/lib/useMounted';

const PALETTE = [
  '#f97316',
  '#22c55e',
  '#06b6d4',
  '#ec4899',
  '#facc15',
  '#a855f7',
  '#ef4444',
];

function colorFor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % PALETTE.length;
  return PALETTE[idx];
}

export function LiveCursors() {
  const cursors = usePresence((s) => s.cursors);
  const openCardId = useBoard((s) => s.openCardId);
  const mounted = useMounted();

  if (!mounted || !openCardId) return null;

  const active = Object.values(cursors).filter(
    (c) => c.card_id === openCardId
  );
  if (active.length === 0) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[2200]">
      {active.map((c) => {
        const color = colorFor(c.user_id);
        return (
          <div
            key={c.user_id}
            style={{
              transform: `translate3d(${c.x}px, ${c.y}px, 0)`,
              color,
            }}
            className="absolute top-0 left-0 transition-transform duration-75 ease-out"
          >
            <svg
              viewBox="0 0 16 16"
              className="h-4 w-4 drop-shadow"
              aria-hidden
            >
              <path
                d="M1 1l12 5-5 2-2 5L1 1z"
                fill="currentColor"
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            <span
              style={{ backgroundColor: color }}
              className="absolute top-4 left-3 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white shadow"
            >
              {c.username ? `@${c.username}` : 'Anon'}
            </span>
          </div>
        );
      })}
    </div>,
    document.body
  );
}
