'use client';

import { useState, useTransition } from 'react';
import {
  upsertChannelMode,
  deleteChannelMode,
} from '@/app/(app)/integrations/discord/[guildId]/actions';
import { confirm } from '@/store/confirmStore';
import { toast } from '@/store/toastStore';
import { Button } from './ui/Button';
import { FormSection } from './ui/FormSection';
import { StatusPill, StatusBanner } from './ui/Status';

type Mode = 'images_only' | 'text_only';

type Props = {
  guildId: string;
  channels: { id: string; name: string }[];
  initial: Array<{ channelId: string; mode: Mode; allowVideos: boolean }>;
};

const MODE_LABEL: Record<Mode, string> = {
  images_only: 'Bilder-Only',
  text_only: 'Text-Only',
};

const MODE_ICON: Record<Mode, string> = {
  images_only: 'IMG',
  text_only: 'TXT',
};

export function ChannelModesForm({ guildId, channels, initial }: Props) {
  const [items, setItems] = useState(initial);
  const [newChannelId, setNewChannelId] = useState('');
  const [newMode, setNewMode] = useState<Mode>('images_only');
  const [newAllowVideos, setNewAllowVideos] = useState(true);
  const [pending, startTransition] = useTransition();

  const channelById = new Map(channels.map((c) => [c.id, c.name]));
  const occupiedIds = new Set(items.map((i) => i.channelId));
  const availableChannels = channels.filter((c) => !occupiedIds.has(c.id));

  const add = () => {
    if (!newChannelId) return;
    startTransition(async () => {
      const r = await upsertChannelMode(guildId, newChannelId, newMode, newAllowVideos);
      if (r.ok) {
        setItems((prev) => [
          ...prev.filter((i) => i.channelId !== newChannelId),
          { channelId: newChannelId, mode: newMode, allowVideos: newAllowVideos },
        ]);
        setNewChannelId('');
        toast.success('Channel-Mode hinzugefügt');
      } else {
        toast.error('Anlegen fehlgeschlagen', r.error);
      }
    });
  };

  const remove = async (channelId: string) => {
    const ok = await confirm({
      title: 'Channel-Mode entfernen?',
      description: `Der Filter in #${channelById.get(channelId) ?? channelId} wird deaktiviert.`,
      confirmLabel: 'Entfernen',
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteChannelMode(guildId, channelId);
      if (r.ok) {
        setItems((prev) => prev.filter((i) => i.channelId !== channelId));
        toast.success('Channel-Mode entfernt');
      } else {
        toast.error('Entfernen fehlgeschlagen', r.error);
      }
    });
  };

  return (
    <div className="space-y-5">
      <StatusBanner kind="info">
        Beschränkt einen Channel auf nur Bilder oder nur Text. Moderatoren werden
        nicht gefiltert. Nicht-konforme Nachrichten werden gelöscht, der User
        bekommt eine DM-Notiz.
      </StatusBanner>

      {items.length > 0 ? (
        <ul className="rounded-xl border border-line bg-surface divide-y divide-line/60 overflow-hidden">
          {items.map((item) => (
            <li
              key={item.channelId}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-elev/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-lg bg-elev border border-line grid place-items-center shrink-0">
                  <span className="text-lg" aria-hidden>
                    {MODE_ICON[item.mode]}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-fg">
                    #{channelById.get(item.channelId) ?? item.channelId}
                  </div>
                  <div className="text-[11.5px] text-muted">
                    {MODE_LABEL[item.mode]}
                    {item.mode === 'images_only' &&
                      (item.allowVideos ? ' · inkl. Videos' : ' · keine Videos')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusPill kind="success" dot>
                  Aktiv
                </StatusPill>
                <Button
                  type="button"
                  onClick={() => remove(item.channelId)}
                  disabled={pending}
                  size="sm"
                  variant="ghost"
                >
                  Entfernen
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-line-strong p-10 text-center">
          <div className="text-3xl mb-2 text-muted">—</div>
          <div className="text-sm text-fg-soft mb-1">
            Noch keine Channel-Modes konfiguriert
          </div>
          <div className="text-[12px] text-subtle">
            Lege unten den ersten Filter für einen Channel an.
          </div>
        </div>
      )}

      <FormSection
        title="Neuer Channel-Mode"
        description="Wähle Channel + Modus. Optional: Videos in Bilder-Channels erlauben."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[12.5px] font-medium text-fg-soft mb-1.5">
              Channel
            </label>
            <select
              value={newChannelId}
              onChange={(e) => setNewChannelId(e.target.value)}
              disabled={availableChannels.length === 0}
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            >
              <option value="">
                {availableChannels.length === 0
                  ? 'Alle Channels haben bereits einen Mode'
                  : '— Channel wählen —'}
              </option>
              {availableChannels.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12.5px] font-medium text-fg-soft mb-1.5">
              Modus
            </label>
            <select
              value={newMode}
              onChange={(e) => setNewMode(e.target.value as Mode)}
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            >
              <option value="images_only">Bilder-Only</option>
              <option value="text_only">Text-Only</option>
            </select>
          </div>
        </div>

        {newMode === 'images_only' && (
          <label className="flex items-center justify-between gap-3 rounded-lg border border-line bg-elev/30 px-3.5 py-2.5 cursor-pointer">
            <div className="text-[12.5px] text-fg-soft">
              Videos auch erlauben
            </div>
            <input
              type="checkbox"
              checked={newAllowVideos}
              onChange={(e) => setNewAllowVideos(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
          </label>
        )}

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            onClick={add}
            disabled={!newChannelId}
            loading={pending}
            variant="primary"
          >
            {pending ? 'Anlegen…' : 'Hinzufügen'}
          </Button>
        </div>
      </FormSection>
    </div>
  );
}
