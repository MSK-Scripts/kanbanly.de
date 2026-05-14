'use client';

import { useRef, useState, useTransition } from 'react';
import { updateWelcomeConfig } from '@/app/(app)/integrations/discord/[guildId]/actions';
import { toast } from '@/store/toastStore';
import { Switch } from './Switch';
import { Button } from './ui/Button';
import { FormSection, FormRow } from './ui/FormSection';
import { StatusPill } from './ui/Status';

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
  { token: '{server}', label: 'Server', sample: 'Mein Server' },
  { token: '{members}', label: 'Anzahl', sample: '42' },
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
      if (r.ok) {
        toast.success('Welcome-Einstellungen gespeichert');
      } else {
        toast.error('Speichern fehlgeschlagen', r.error);
      }
    });
  }

  const previewHtml = renderInlineMarkdown(renderPreview(message || ' '));
  const selectedChannel = channels.find((c) => c.id === channelId);

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormSection
        title="Channel-Nachricht"
        description="Begrüßt neue Mitglieder im gewählten Channel."
        badge={
          <StatusPill kind={enabled ? 'success' : 'neutral'} dot>
            {enabled ? 'Aktiv' : 'Aus'}
          </StatusPill>
        }
        action={<Switch checked={enabled} onChange={setEnabled} ariaLabel="Welcome aktiv" />}
      >
        <div className={enabled ? 'space-y-4' : 'space-y-4 opacity-50 pointer-events-none'}>
          <FormRow label="Channel" required>
            <select
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            >
              <option value="">— Channel wählen —</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
            </select>
          </FormRow>

          <FormRow
            label="Nachricht"
            hint="Markdown unterstützt: **fett**, *kursiv*, `code`."
            required
          >
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PLACEHOLDERS.map((p) => (
                <button
                  key={p.token}
                  type="button"
                  onClick={() => insertPlaceholder(p.token)}
                  className="rounded-md border border-line-strong bg-elev hover:bg-elev-hover hover:border-accent/60 px-2 py-1 text-[11px] font-mono text-fg-soft transition-all"
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
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y transition-all"
            />
            <div className="mt-1 flex items-center justify-end">
              <span className="text-[10px] text-subtle font-mono tabular-nums">
                {message.length}/1000
              </span>
            </div>
          </FormRow>

          <div className="flex items-center justify-between rounded-lg border border-line bg-elev/30 px-3.5 py-2.5">
            <div className="text-[12.5px] text-fg-soft">
              Format:{' '}
              <span className="font-semibold text-fg">
                {useEmbed ? 'Embed' : 'Plain-Text'}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              {useEmbed && (
                <input
                  type="color"
                  value={embedColor}
                  onChange={(e) => setEmbedColor(e.target.value)}
                  className="h-6 w-9 rounded border border-line-strong bg-elev cursor-pointer"
                  title="Embed-Farbe"
                />
              )}
              <Switch
                checked={useEmbed}
                onChange={setUseEmbed}
                size="sm"
                ariaLabel="Als Embed senden"
              />
            </div>
          </div>

          <div>
            <div className="text-[11.5px] font-medium text-muted mb-1.5">Vorschau</div>
            <div className="rounded-lg border border-line bg-elev/30 p-3.5">
              <div className="text-[11px] text-subtle mb-2">
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
                  {useEmbed ? (
                    <div
                      className="mt-1 rounded border-l-4 bg-elev px-3 py-2"
                      style={{ borderLeftColor: embedColor }}
                    >
                      <div
                        className="text-sm text-fg-soft break-words"
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                      />
                    </div>
                  ) : (
                    <div
                      className="text-sm text-fg-soft break-words"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Privatnachricht (DM)"
        description="Zusätzliche Direktnachricht — funktioniert nur, wenn der User DMs vom Server zulässt."
        badge={
          <StatusPill kind={dmEnabled ? 'success' : 'neutral'} dot>
            {dmEnabled ? 'Aktiv' : 'Aus'}
          </StatusPill>
        }
        action={
          <Switch checked={dmEnabled} onChange={setDmEnabled} ariaLabel="DM bei Join aktiv" />
        }
      >
        <div className={dmEnabled ? 'space-y-4' : 'space-y-4 opacity-50 pointer-events-none'}>
          <FormRow label="DM-Nachricht" hint="Gleiche Platzhalter wie oben." required>
            <textarea
              value={dmMessage}
              onChange={(e) => setDmMessage(e.target.value)}
              rows={3}
              maxLength={1000}
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y transition-all"
            />
            <div className="mt-1 flex items-center justify-end">
              <span className="text-[10px] text-subtle font-mono tabular-nums">
                {dmMessage.length}/1000
              </span>
            </div>
          </FormRow>

          <div className="flex items-center justify-between rounded-lg border border-line bg-elev/30 px-3.5 py-2.5">
            <div className="text-[12.5px] text-fg-soft">
              Format:{' '}
              <span className="font-semibold text-fg">
                {dmUseEmbed ? 'Embed' : 'Plain-Text'}
              </span>
            </div>
            <Switch
              checked={dmUseEmbed}
              onChange={setDmUseEmbed}
              size="sm"
              ariaLabel="DM als Embed"
            />
          </div>
        </div>
      </FormSection>

      <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 bg-bg/80 backdrop-blur-sm border-t border-line flex items-center justify-end">
        <Button type="submit" loading={pending} variant="primary">
          {pending ? 'Speichern…' : 'Speichern'}
        </Button>
      </div>
    </form>
  );
}
