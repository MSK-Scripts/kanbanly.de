'use client';

import { useState, useTransition } from 'react';
import {
  upsertStickyMessage,
  deleteStickyMessage,
} from '@/app/(app)/integrations/discord/[guildId]/actions';
import { confirm } from '@/store/confirmStore';
import { toast } from '@/store/toastStore';
import { Switch } from './Switch';
import { Button } from './ui/Button';
import { FormSection } from './ui/FormSection';
import { StatusBanner } from './ui/Status';

type Props = {
  guildId: string;
  channels: { id: string; name: string }[];
  initial: Array<{ channelId: string; content: string; useEmbed: boolean }>;
};

export function StickyMessagesForm({ guildId, channels, initial }: Props) {
  const [items, setItems] = useState(initial);
  const [newChannelId, setNewChannelId] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newUseEmbed, setNewUseEmbed] = useState(false);
  const [pending, startTransition] = useTransition();

  const channelById = new Map(channels.map((c) => [c.id, c.name]));
  const occupiedIds = new Set(items.map((i) => i.channelId));
  const availableChannels = channels.filter((c) => !occupiedIds.has(c.id));

  const addSticky = () => {
    if (!newChannelId || !newContent.trim()) return;
    startTransition(async () => {
      const r = await upsertStickyMessage(guildId, newChannelId, newContent, newUseEmbed);
      if (r.ok) {
        setItems((prev) => [
          ...prev.filter((i) => i.channelId !== newChannelId),
          { channelId: newChannelId, content: newContent.trim(), useEmbed: newUseEmbed },
        ]);
        setNewChannelId('');
        setNewContent('');
        setNewUseEmbed(false);
        toast.success('Sticky-Message angelegt');
      } else {
        toast.error('Anlegen fehlgeschlagen', r.error);
      }
    });
  };

  const updateSticky = (channelId: string, content: string, useEmbed: boolean) => {
    startTransition(async () => {
      const r = await upsertStickyMessage(guildId, channelId, content, useEmbed);
      if (r.ok) {
        setItems((prev) =>
          prev.map((i) => (i.channelId === channelId ? { ...i, content, useEmbed } : i)),
        );
        toast.success('Sticky-Message aktualisiert');
      } else {
        toast.error('Speichern fehlgeschlagen', r.error);
      }
    });
  };

  const removeSticky = async (channelId: string) => {
    const ok = await confirm({
      title: 'Sticky entfernen?',
      description: `Die Sticky-Message in #${channelById.get(channelId) ?? channelId} wird gelöscht.`,
      confirmLabel: 'Entfernen',
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteStickyMessage(guildId, channelId);
      if (r.ok) {
        setItems((prev) => prev.filter((i) => i.channelId !== channelId));
        toast.success('Sticky-Message entfernt');
      } else {
        toast.error('Entfernen fehlgeschlagen', r.error);
      }
    });
  };

  return (
    <div className="space-y-5">
      <StatusBanner kind="info">
        Sticky-Messages werden vom Bot erneut gepostet, damit sie am Channel-Ende
        sichtbar bleiben. Re-Post nach 3 Nachrichten oder 5 Sekunden.
      </StatusBanner>

      {items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((item) => (
            <StickyRow
              key={item.channelId}
              channelName={channelById.get(item.channelId) ?? item.channelId}
              channelId={item.channelId}
              initialContent={item.content}
              initialUseEmbed={item.useEmbed}
              onSave={(content, useEmbed) =>
                updateSticky(item.channelId, content, useEmbed)
              }
              onRemove={() => removeSticky(item.channelId)}
              pending={pending}
            />
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-line-strong p-10 text-center">
          <div className="text-3xl mb-2 text-muted">—</div>
          <div className="text-sm text-fg-soft mb-1">Noch keine Sticky-Messages</div>
          <div className="text-[12px] text-subtle">
            Lege unten deine erste Sticky-Message für einen Channel an.
          </div>
        </div>
      )}

      <FormSection
        title="Neue Sticky-Message"
        description="Eine Sticky pro Channel — der Bot postet sie am Ende erneut."
      >
        <div>
          <label className="block text-[12.5px] font-medium text-fg-soft mb-1.5">
            Channel
          </label>
          <select
            value={newChannelId}
            onChange={(e) => setNewChannelId(e.target.value)}
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            disabled={availableChannels.length === 0}
          >
            <option value="">
              {availableChannels.length === 0
                ? 'Alle Channels haben bereits Sticky-Messages'
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
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[12.5px] font-medium text-fg-soft">Inhalt</label>
            <span className="text-[10px] text-subtle font-mono tabular-nums">
              {newContent.length}/1500
            </span>
          </div>
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={3}
            maxLength={1500}
            placeholder="Wichtige Info, die am Channel-Ende bleiben soll. Markdown ok."
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y transition-all"
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-line bg-elev/30 px-3.5 py-2.5">
          <div className="text-[12.5px] text-fg-soft">
            Format:{' '}
            <span className="font-semibold text-fg">
              {newUseEmbed ? 'Embed' : 'Plain-Text'}
            </span>
          </div>
          <Switch
            checked={newUseEmbed}
            onChange={setNewUseEmbed}
            size="sm"
            ariaLabel="Als Embed senden"
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            onClick={addSticky}
            loading={pending}
            disabled={!newChannelId || !newContent.trim()}
            variant="primary"
          >
            {pending ? 'Anlegen…' : 'Hinzufügen'}
          </Button>
        </div>
      </FormSection>
    </div>
  );
}

function StickyRow({
  channelName,
  channelId,
  initialContent,
  initialUseEmbed,
  onSave,
  onRemove,
  pending,
}: {
  channelName: string;
  channelId: string;
  initialContent: string;
  initialUseEmbed: boolean;
  onSave: (content: string, useEmbed: boolean) => void;
  onRemove: () => void;
  pending: boolean;
}) {
  const [content, setContent] = useState(initialContent);
  const [useEmbed, setUseEmbed] = useState(initialUseEmbed);
  const dirty = content !== initialContent || useEmbed !== initialUseEmbed;
  return (
    <li className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-line bg-elev/30">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[13.5px] font-semibold text-accent">
            #{channelName}
          </span>
        </div>
        <span className="text-[10px] font-mono text-subtle hidden sm:inline">
          {channelId}
        </span>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11.5px] font-medium text-muted">Inhalt</label>
            <span className="text-[10px] text-subtle font-mono tabular-nums">
              {content.length}/1500
            </span>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            maxLength={1500}
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y transition-all"
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-line bg-elev/30 px-3 py-2">
          <div className="text-[12px] text-fg-soft">
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
        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            onClick={() => onSave(content, useEmbed)}
            loading={pending && dirty}
            disabled={!dirty || !content.trim()}
            size="sm"
            variant="primary"
          >
            Speichern
          </Button>
          <Button
            type="button"
            onClick={onRemove}
            disabled={pending}
            size="sm"
            variant="ghost"
          >
            Entfernen
          </Button>
          {dirty && (
            <span className="text-[11px] text-[var(--warning)] ml-auto">
              ● ungespeichert
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
