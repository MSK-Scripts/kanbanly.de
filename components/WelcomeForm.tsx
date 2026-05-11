'use client';

import { useState, useTransition } from 'react';
import { updateWelcomeConfig } from '@/app/(app)/integrations/discord/[guildId]/actions';

type Props = {
  guildId: string;
  channels: { id: string; name: string }[];
  initial: { enabled: boolean; channelId: string | null; message: string | null };
};

const DEFAULT_TEMPLATE = 'Willkommen {mention} auf **{server}** 🎉 — ihr seid jetzt zu {members}.';

export function WelcomeForm({ guildId, channels, initial }: Props) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [channelId, setChannelId] = useState(initial.channelId ?? '');
  const [message, setMessage] = useState(initial.message ?? DEFAULT_TEMPLATE);
  const [status, setStatus] = useState<{ kind: 'idle' | 'ok' | 'err'; text?: string }>({ kind: 'idle' });
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    if (enabled) fd.set('enabled', 'on');
    fd.set('channel_id', channelId);
    fd.set('message', message);
    startTransition(async () => {
      const r = await updateWelcomeConfig(guildId, fd);
      if (r.ok) setStatus({ kind: 'ok', text: 'Gespeichert.' });
      else setStatus({ kind: 'err', text: r.error ?? 'Fehler.' });
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="flex items-center gap-2 text-sm text-fg">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4"
        />
        Welcome-Messages aktiv
      </label>

      <div>
        <label className="block text-xs text-muted mb-1">Channel</label>
        <select
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          className="w-full rounded-md bg-elev border border-line px-3 py-2 text-sm text-fg"
        >
          <option value="">— Channel wählen —</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">
          Nachricht (Platzhalter: <code>{'{user}'}</code> <code>{'{mention}'}</code>{' '}
          <code>{'{server}'}</code> <code>{'{members}'}</code>)
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={1000}
          className="w-full rounded-md bg-elev border border-line px-3 py-2 text-sm text-fg font-mono"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm px-4 py-2 transition-colors"
        >
          {pending ? 'Speichern…' : 'Speichern'}
        </button>
        {status.kind === 'ok' && <span className="text-xs text-emerald-400">{status.text}</span>}
        {status.kind === 'err' && <span className="text-xs text-red-400">{status.text}</span>}
      </div>
    </form>
  );
}
