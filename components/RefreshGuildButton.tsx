'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { refreshGuildCache } from '@/app/(app)/integrations/discord/[guildId]/actions';
import { toast } from '@/store/toastStore';
import { Spinner } from './ui/Spinner';

type Props = {
  guildId: string;
};

export function RefreshGuildButton({ guildId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);

  const onClick = async () => {
    setRefreshing(true);
    const r = await refreshGuildCache(guildId);
    if (r.ok) {
      startTransition(() => {
        router.refresh();
      });
      toast.success('Channels & Rollen neu geladen');
    } else {
      toast.error('Aktualisieren fehlgeschlagen', r.error);
    }
    setRefreshing(false);
  };

  const busy = refreshing || pending;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="group inline-flex items-center gap-2 rounded-lg border border-line bg-surface hover:bg-elev hover:border-line-strong px-3 py-1.5 text-[12.5px] text-muted hover:text-fg transition-all disabled:opacity-50"
      title="Channels und Rollen von Discord neu laden"
    >
      {busy ? (
        <Spinner size="xs" />
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5 transition-transform group-hover:rotate-180"
          aria-hidden
        >
          <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-9-9 9 9 0 0 1 9-9c2.39 0 4.68.94 6.4 2.6L21 8" />
          <polyline points="21 3 21 8 16 8" />
        </svg>
      )}
      Aktualisieren
    </button>
  );
}
