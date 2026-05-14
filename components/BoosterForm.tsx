'use client';

import { useState, useTransition } from 'react';
import { updateBoosterConfig } from '@/app/(app)/integrations/discord/[guildId]/actions';
import { toast } from '@/store/toastStore';
import { Switch } from './Switch';
import { Button } from './ui/Button';
import { ColorPicker } from './ui/ColorPicker';
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
      if (r.ok) toast.success('Booster-Einstellungen gespeichert');
      else toast.error('Speichern fehlgeschlagen', r.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormSection
        title="Booster-Message"
        description="Bedankt sich automatisch, wenn jemand den Server boostet."
        badge={
          <StatusPill kind={enabled ? 'success' : 'neutral'} dot>
            {enabled ? 'Aktiv' : 'Aus'}
          </StatusPill>
        }
        action={
          <Switch checked={enabled} onChange={setEnabled} ariaLabel="Booster aktiv" />
        }
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
            hint="Platzhalter: {user} {mention} {server} {members}. Markdown ok."
            required
          >
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={1000}
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y transition-all"
            />
            <div className="mt-1 flex items-center justify-end">
              <span className="text-[10px] text-subtle font-mono tabular-nums">
                {message.length}/1000
              </span>
            </div>
          </FormRow>

          <div className="rounded-lg border border-line bg-elev/30 px-3.5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[12.5px] text-fg-soft">
                Format:{' '}
                <span className="font-semibold text-fg">
                  {useEmbed ? 'Embed' : 'Plain-Text'}
                </span>
              </div>
              <Switch
                checked={useEmbed}
                onChange={setUseEmbed}
                size="sm"
                ariaLabel="Als Embed senden"
              />
            </div>
            {useEmbed && (
              <div className="mt-3 pt-3 border-t border-line/60">
                <div className="text-[11.5px] font-medium text-muted mb-2">
                  Embed-Farbe
                </div>
                <ColorPicker value={embedColor} onChange={setEmbedColor} />
              </div>
            )}
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
