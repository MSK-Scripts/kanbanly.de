'use client';

import { useState, useTransition } from 'react';
import { sendBotEmbed } from '@/app/(app)/integrations/discord/[guildId]/actions';

type Props = {
  guildId: string;
  channels: { id: string; name: string }[];
};

const COLOR_PRESETS: Array<{ label: string; hex: string; value: number }> = [
  { label: 'Blurple', hex: '#5865F2', value: 0x5865f2 },
  { label: 'Grün', hex: '#22c55e', value: 0x22c55e },
  { label: 'Gelb', hex: '#eab308', value: 0xeab308 },
  { label: 'Rot', hex: '#ef4444', value: 0xef4444 },
  { label: 'Pink', hex: '#ec4899', value: 0xec4899 },
  { label: 'Cyan', hex: '#06b6d4', value: 0x06b6d4 },
];

function colorToHex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

function hexToColor(hex: string): number | null {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  return parseInt(m[1], 16);
}

export function EmbedCreatorForm({ guildId, channels }: Props) {
  const [channelId, setChannelId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<number>(0x5865f2);
  const [footer, setFooter] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const submit = () => {
    if (!channelId) {
      setMsg({ kind: 'err', text: 'Channel wählen.' });
      return;
    }
    if (!title.trim() && !description.trim()) {
      setMsg({ kind: 'err', text: 'Titel oder Beschreibung nötig.' });
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const r = await sendBotEmbed(guildId, channelId, {
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        color,
        footer: footer.trim() || undefined,
        image: imageUrl.trim() || undefined,
      });
      if (r.ok) setMsg({ kind: 'ok', text: 'Embed gesendet.' });
      else setMsg({ kind: 'err', text: r.error ?? 'Fehler.' });
    });
  };

  return (
    <div className="space-y-5">
      <p className="text-xs text-subtle">
        Baue benutzerdefinierte Embed-Nachrichten und sende sie als Bot in einen
        Channel. Ideal für Regelwerke, Ankündigungen, FAQ.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Builder */}
        <div className="space-y-4">
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
              <label className="text-xs font-medium text-muted">Titel</label>
              <span className="text-[10px] text-subtle font-mono tabular-nums">
                {title.length}/256
              </span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 256))}
              placeholder="Server-Regeln"
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-muted">Beschreibung</label>
              <span className="text-[10px] text-subtle font-mono tabular-nums">
                {description.length}/4000
              </span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 4000))}
              rows={6}
              placeholder="**Regel 1** — Sei nett..."
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle font-mono focus:outline-none focus:ring-1 focus:ring-accent resize-y"
            />
            <p className="text-[11px] text-subtle mt-1">
              Markdown unterstützt: **fett**, *kursiv*, `code`, &gt; quote, Listen, Links.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Farbe</label>
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`h-7 w-7 rounded-full border-2 transition-all ${
                    color === c.value
                      ? 'border-fg scale-110'
                      : 'border-line hover:border-line-strong'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.label}
                />
              ))}
              <input
                type="text"
                value={colorToHex(color)}
                onChange={(e) => {
                  const v = hexToColor(e.target.value);
                  if (v !== null) setColor(v);
                }}
                className="w-24 rounded-md bg-elev border border-line-strong px-2 py-1 text-xs text-fg font-mono focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">
              Footer (optional)
            </label>
            <input
              type="text"
              value={footer}
              onChange={(e) => setFooter(e.target.value.slice(0, 2048))}
              placeholder="kanbanly.de"
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">
              Bild-URL (optional)
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        {/* Preview */}
        <div>
          <div className="text-xs font-medium text-muted mb-1.5">Vorschau</div>
          <div className="rounded-md border border-line bg-elev/30 p-4">
            <div className="text-[11px] text-subtle mb-2">
              {channelId
                ? `#${channels.find((c) => c.id === channelId)?.name ?? 'channel'}`
                : '#kein-channel'}
            </div>
            <div className="flex gap-2.5">
              <div className="h-8 w-8 rounded-full bg-accent/20 grid place-items-center text-[11px] font-semibold text-accent shrink-0">
                B
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="text-sm font-medium text-accent">Bot</span>
                  <span className="rounded bg-accent/20 px-1 text-[9px] font-semibold text-accent uppercase tracking-wide">
                    BOT
                  </span>
                  <span className="text-[10px] text-subtle">jetzt</span>
                </div>
                <div
                  className="rounded border-l-4 bg-elev px-3 py-2.5"
                  style={{ borderLeftColor: colorToHex(color) }}
                >
                  {title && (
                    <div className="text-sm font-semibold text-fg mb-1 break-words">
                      {title}
                    </div>
                  )}
                  {description && (
                    <div className="text-xs text-fg-soft whitespace-pre-wrap break-words">
                      {description}
                    </div>
                  )}
                  {imageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={imageUrl}
                      alt=""
                      className="mt-2 max-h-48 rounded object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  {footer && (
                    <div className="text-[10px] text-subtle mt-2">{footer}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-line pt-4">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-md bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          {pending ? 'Sende…' : 'Embed senden'}
        </button>
        {msg && (
          <span
            className={`text-xs ${
              msg.kind === 'ok'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
