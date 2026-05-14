'use client';

import { useRef, useState, useTransition } from 'react';
import { updateWelcomeConfig } from '@/app/(app)/integrations/discord/[guildId]/actions';
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
    dmEnabled: boolean;
    dmMessage: string | null;
    dmUseEmbed: boolean;
  };
};

const DEFAULT_TEMPLATE = 'Willkommen {mention} auf **{server}** 🎉 — ihr seid jetzt zu {members}.';
const DEFAULT_DM_TEMPLATE = 'Hey {user}! Willkommen auf **{server}** 👋 Schau dich um und sag Hallo.';

const PLACEHOLDERS: Array<{ token: string; label: string; sample: string }> = [
  { token: '{user}', label: 'Username', sample: 'NewUser' },
  { token: '{mention}', label: 'Ping', sample: '@NewUser' },
  { token: '{server}', label: 'Servername', sample: 'Mein Server' },
  { token: '{members}', label: 'Member-Anzahl', sample: '42' },
];

function renderPreview(template: string): string {
  let out = template;
  for (const p of PLACEHOLDERS) out = out.replaceAll(p.token, p.sample);
  return out;
}

function renderInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-elev px-1 text-[0.85em]">$1</code>');
}

export function WelcomeForm({ guildId, channels, initial }: Props) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [channelId, setChannelId] = useState(initial.channelId ?? '');
  const [message, setMessage] = useState(initial.message ?? DEFAULT_TEMPLATE);
  const [useEmbed, setUseEmbed] = useState(initial.useEmbed);
  const [embedColor, setEmbedColor] = useState(
    initial.embedColor !== null
      ? '#' + initial.embedColor.toString(16).padStart(6, '0')
      : '#5865F2',
  );
  const [dmEnabled, setDmEnabled] = useState(initial.dmEnabled);
  const [dmMessage, setDmMessage] = useState(initial.dmMessage ?? DEFAULT_DM_TEMPLATE);
  const [dmUseEmbed, setDmUseEmbed] = useState(initial.dmUseEmbed);
  const [status, setStatus] = useState<{ kind: 'idle' | 'ok' | 'err'; text?: string }>({ kind: 'idle' });
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertPlaceholder(token: string) {
    const ta = textareaRef.current;
    if (!ta) {
      setMessage((m) => m + token);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = message.slice(0, start) + token + message.slice(end);
    setMessage(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    if (enabled) fd.set('enabled', 'on');
    fd.set('channel_id', channelId);
    fd.set('message', message);
    if (useEmbed) fd.set('use_embed', 'on');
    fd.set('embed_color', embedColor);
    if (dmEnabled) fd.set('dm_enabled', 'on');
    fd.set('dm_message', dmMessage);
    if (dmUseEmbed) fd.set('dm_use_embed', 'on');
    startTransition(async () => {
      const r = await updateWelcomeConfig(guildId, fd);
      if (r.ok) setStatus({ kind: 'ok', text: 'Gespeichert.' });
      else setStatus({ kind: 'err', text: r.error ?? 'Fehler.' });
    });
  }

  const previewHtml = renderInlineMarkdown(renderPreview(message || ' '));
  const selectedChannel = channels.find((c) => c.id === channelId);

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex items-center justify-between rounded-md border border-line bg-elev/40 px-4 py-3">
        <div>
          <div className="text-sm font-medium text-fg">Welcome-Messages</div>
          <div className="text-[11px] text-subtle">
            Begrüßt neue Member automatisch im gewählten Channel.
          </div>
        </div>
        <Switch checked={enabled} onChange={setEnabled} />
      </div>

      <div className={enabled ? '' : 'opacity-60 pointer-events-none'}>
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

      <div className={enabled ? '' : 'opacity-60 pointer-events-none'}>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-muted">Nachricht</label>
          <span className="text-[10px] text-subtle font-mono tabular-nums">
            {message.length}/1000
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {PLACEHOLDERS.map((p) => (
            <button
              key={p.token}
              type="button"
              onClick={() => insertPlaceholder(p.token)}
              className="rounded-md border border-line-strong bg-elev hover:bg-elev-hover hover:border-accent px-2 py-1 text-[11px] font-mono text-fg-soft transition-colors"
              title={`Fügt ${p.token} ein → ${p.label}`}
            >
              {p.token}
              <span className="ml-1 text-subtle">· {p.label}</span>
            </button>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={1000}
          className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg font-mono focus:outline-none focus:ring-1 focus:ring-accent resize-y"
        />
        <p className="text-[11px] text-subtle mt-1">
          Markdown unterstützt: <code>**fett**</code>, <code>*kursiv*</code>, <code>`code`</code>.
        </p>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-line bg-elev/40 px-3 py-2">
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

      <div>
        <div className="text-xs font-medium text-muted mb-1.5">Vorschau</div>
        <div className="rounded-md border border-line bg-elev/30 p-3">
          <div className="text-[11px] text-subtle mb-1.5">
            {selectedChannel ? `#${selectedChannel.name}` : '#kein-channel'} · Beispiel
          </div>
          <div className="flex gap-2.5">
            <div className="h-8 w-8 rounded-full bg-accent/20 grid place-items-center text-[11px] font-semibold text-accent shrink-0">
              B
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-accent">Bot</span>
                <span className="rounded bg-accent/20 px-1 text-[9px] font-semibold text-accent uppercase tracking-wide">
                  BOT
                </span>
                <span className="text-[10px] text-subtle">heute</span>
              </div>
              <div
                className="text-sm text-fg-soft break-words"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border border-line bg-elev/40 px-4 py-3 mt-6">
        <div>
          <div className="text-sm font-medium text-fg">Zusätzlich DM senden</div>
          <div className="text-[11px] text-subtle">
            Privatnachricht an neue Mitglieder — funktioniert nur, wenn der User
            DMs vom Server zulässt.
          </div>
        </div>
        <Switch checked={dmEnabled} onChange={setDmEnabled} ariaLabel="DM bei Join aktiv" />
      </div>

      <div className={dmEnabled ? '' : 'opacity-60 pointer-events-none'}>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-muted">DM-Nachricht</label>
          <span className="text-[10px] text-subtle font-mono tabular-nums">
            {dmMessage.length}/1000
          </span>
        </div>
        <textarea
          value={dmMessage}
          onChange={(e) => setDmMessage(e.target.value)}
          rows={3}
          maxLength={1000}
          className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg font-mono focus:outline-none focus:ring-1 focus:ring-accent resize-y"
        />
        <p className="text-[11px] text-subtle mt-1">
          Gleiche Platzhalter wie oben.
        </p>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-line bg-elev/40 px-3 py-2">
          <div className="text-xs text-fg-soft">
            Als <strong>{dmUseEmbed ? 'Embed' : 'Plain-Text'}</strong> senden
          </div>
          <Switch checked={dmUseEmbed} onChange={setDmUseEmbed} size="sm" ariaLabel="DM als Embed" />
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

