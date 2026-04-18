'use client';
import { usePresence } from '@/store/presenceStore';
import { Avatar } from './Avatar';

const MAX_VISIBLE = 5;

export function PresenceAvatars({ selfUserId }: { selfUserId: string }) {
  const users = usePresence((s) => s.users);
  const list = Object.values(users)
    .filter((u) => u.user_id !== selfUserId)
    .sort((a, b) => a.joined_at.localeCompare(b.joined_at));

  if (list.length === 0) return null;

  const visible = list.slice(0, MAX_VISIBLE);
  const extra = list.length - visible.length;

  return (
    <div className="flex items-center -space-x-1.5" aria-label="Aktive Nutzer">
      {visible.map((u) => (
        <div
          key={u.user_id}
          className="relative"
          title={u.username ? `@${u.username} ist hier` : 'Nutzer ist hier'}
        >
          <Avatar
            username={u.username}
            size="sm"
            className="ring-2 ring-surface"
          />
          <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-surface" />
        </div>
      ))}
      {extra > 0 && (
        <span className="h-6 w-6 grid place-items-center rounded-full bg-elev-hover text-[10px] font-semibold text-fg-soft ring-2 ring-surface">
          +{extra}
        </span>
      )}
    </div>
  );
}
