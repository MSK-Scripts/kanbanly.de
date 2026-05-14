'use client';

import { useState, useTransition } from 'react';
import { updateBoosterConfig } from '@/app/(app)/integrations/discord/[guildId]/actions';
import { Switch } from './Switch';

type Props = {
  guildId: string;
  channels: { id: string; name: string }[];
  initial: {
    enabled: boolean;
    channelId: string | null;
    message: string | null;
    useEmbed: boolean;
    embedColor: number | null;
  };
};

const DEFAULT_TEMPLATE =
  'Danke für den Boost, {mention}! 🚀 **{server}** wird durch dich besser.';

export function BoosterForm({ guildId, channels, initial }: Props) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [channelId, setChannelId] = useState(initial.channelId ?? '');
  const [message, setMessage] = useState(initial.message ?? DEFAULT_TEMPLATE);
  const [useEmbed, setUseEmbed] = useState(initial.useEmbed);
  const [embedColor, setEmbedColor] = useState(
    initial.embedColor !== null
      ? '#' + initial.embedColor.toString(16).padStart(6, '0')
      : '#ec4899',
  );
  const [status, setStatus] = useState<{ kind: 'idle' | 'ok' | 'err'; text?: string }>({ kind: 'idle' });
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    if (enabled) fd.set('enabled', 'on');
    fd.set('channel_id', channelId);
    fd.set('message', message);
    if (useEmbed) fd.set('use_embed', 'on');
    fd.set('embed_color', embedColor);
    startTransition(async () => {
      const r = await updateBoosterConfig(guildId, fd);
      if (r.ok) setStatus({ kind: 'ok', text: 'Gespeichert.' });
      else setStatus({ kind: 'err', text: r.error ?? 'Fehler.' });
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex items-center justify-between rounded-md border border-line bg-elev/40 px-4 py-3">
        <div>
          <div className="text-sm font-medium text-fg">Booster-Message aktiv</div>
          <div className="text-[11px] text-subtle">
            Bedankt sich automatisch, wenn jemand den Server boostet.
          </div>
        </div>
        <Switch checked={enabled} onChange={setEnabled} ariaLabel="Booster-Message aktiv" />
      </div>

      <div className={enabled ? 'space-y-4' : 'space-y-4 opacity-60 pointer-events-none'}>
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">Channel</label>
          <select
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent"
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
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-muted">Nachricht</label>
            <span className="text-[10px] text-subtle font-mono tabular-nums">
              {message.length}/1000
            </span>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={1000}
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg font-mono focus:outline-none focus:ring-1 focus:ring-accent resize-y"
          />
          <p className="text-[11px] text-subtle mt-1">
            Platzhalter: <code>{'{user}'}</code> <code>{'{mention}'}</code>{' '}
            <code>{'{server}'}</code> <code>{'{members}'}</code>. Markdown ok.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-elev/40 px-3 py-2">
          <div className="text-xs text-fg-soft">
            Als <strong>{useEmbed ? 'Embed' : 'Plain-Text'}</strong> senden
          </div>
          <div className="flex items-center gap-2">
            {useEmbed && (
              <input
                type="color"
                value={embedColor}
                onChange={(e) => setEmbedColor(e.target.value)}
                className="h-6 w-8 rounded border border-line-strong bg-elev cursor-pointer"
                title="Embed-Farbe"
              />
            )}
            <Switch checked={useEmbed} onChange={setUseEmbed} size="sm" ariaLabel="Als Embed senden" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          {pending ? 'Speichert…' : 'Speichern'}
        </button>
        {status.kind === 'ok' && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">{status.text}</span>
        )}
        {status.kind === 'err' && (
          <span className="text-xs text-rose-600 dark:text-rose-400">{status.text}</span>
        )}
      </div>
    </form>
  );
}
