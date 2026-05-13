'use client';

import { useState, useTransition } from 'react';
import {
  upsertStickyMessage,
  deleteStickyMessage,
} from '@/app/(app)/integrations/discord/[guildId]/actions';
import { confirm } from '@/store/confirmStore';

type Props = {
  guildId: string;
  channels: { id: string; name: string }[];
  initial: Array<{ channelId: string; content: string }>;
};

export function StickyMessagesForm({ guildId, channels, initial }: Props) {
  const [items, setItems] = useState(initial);
  const [newChannelId, setNewChannelId] = useState('');
  const [newContent, setNewContent] = useState('');
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const channelById = new Map(channels.map((c) => [c.id, c.name]));
  const occupiedIds = new Set(items.map((i) => i.channelId));
  const availableChannels = channels.filter((c) => !occupiedIds.has(c.id));

  const addSticky = () => {
    if (!newChannelId || !newContent.trim()) return;
    setMsg(null);
    startTransition(async () => {
      const r = await upsertStickyMessage(guildId, newChannelId, newContent);
      if (r.ok) {
        setItems((prev) => [
          ...prev.filter((i) => i.channelId !== newChannelId),
          { channelId: newChannelId, content: newContent.trim() },
        ]);
        setNewChannelId('');
        setNewContent('');
        setMsg({ kind: 'ok', text: 'Sticky angelegt.' });
      } else {
        setMsg({ kind: 'err', text: r.error ?? 'Fehler.' });
      }
    });
  };

  const updateSticky = (channelId: string, content: string) => {
    setMsg(null);
    startTransition(async () => {
      const r = await upsertStickyMessage(guildId, channelId, content);
      if (r.ok) setMsg({ kind: 'ok', text: 'Aktualisiert.' });
      else setMsg({ kind: 'err', text: r.error ?? 'Fehler.' });
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
    setMsg(null);
    startTransition(async () => {
      const r = await deleteStickyMessage(guildId, channelId);
      if (r.ok) {
        setItems((prev) => prev.filter((i) => i.channelId !== channelId));
        setMsg({ kind: 'ok', text: 'Entfernt.' });
      } else {
        setMsg({ kind: 'err', text: r.error ?? 'Fehler.' });
      }
    });
  };

  return (
    <div className="space-y-5">
      <p className="text-xs text-subtle">
        Sticky-Messages werden vom Bot regelmäßig erneut gepostet, damit sie am
        Ende des Channels sichtbar bleiben. Re-Post nach 3 Nachrichten oder 5
        Sekunden.
      </p>

      {items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((item) => (
            <StickyRow
              key={item.channelId}
              channelName={channelById.get(item.channelId) ?? item.channelId}
              channelId={item.channelId}
              initialContent={item.content}
              onSave={(content) => updateSticky(item.channelId, content)}
              onRemove={() => removeSticky(item.channelId)}
              pending={pending}
            />
          ))}
        </ul>
      ) : (
        <div className="rounded-md border border-dashed border-line-strong p-6 text-center text-xs text-subtle">
          Noch keine Sticky-Messages.
        </div>
      )}

      <div className="rounded-md border border-line bg-elev/40 p-4 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">
          Neu hinzufügen
        </div>
        <select
          value={newChannelId}
          onChange={(e) => setNewChannelId(e.target.value)}
          className="w-full rounded-md bg-surface border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">— Channel wählen —</option>
          {availableChannels.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </select>
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          rows={3}
          maxLength={1500}
          placeholder="Inhalt der Sticky-Message (Markdown ok)…"
          className="w-full rounded-md bg-surface border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle font-mono focus:outline-none focus:ring-1 focus:ring-accent resize-y"
        />
        <button
          type="button"
          onClick={addSticky}
          disabled={pending || !newChannelId || !newContent.trim()}
          className="rounded-md bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          {pending ? 'Speichert…' : 'Hinzufügen'}
        </button>
      </div>

      {msg && (
        <div
          className={`text-xs ${
            msg.kind === 'ok'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'
          }`}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}

function StickyRow({
  channelName,
  channelId,
  initialContent,
  onSave,
  onRemove,
  pending,
}: {
  channelName: string;
  channelId: string;
  initialContent: string;
  onSave: (content: string) => void;
  onRemove: () => void;
  pending: boolean;
}) {
  const [content, setContent] = useState(initialContent);
  const dirty = content !== initialContent;
  return (
    <li className="rounded-md border border-line bg-elev/40 p-4">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-sm font-medium text-fg">
          📌 <span className="text-accent">#{channelName}</span>
        </div>
        <span className="text-[10px] font-mono text-subtle">{channelId}</span>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        maxLength={1500}
        className="w-full rounded-md bg-surface border border-line-strong px-3 py-2 text-sm text-fg font-mono focus:outline-none focus:ring-1 focus:ring-accent resize-y"
      />
      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          onClick={() => onSave(content)}
          disabled={pending || !dirty || !content.trim()}
          className="rounded-md bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 transition-colors"
        >
          Speichern
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={pending}
          className="text-xs text-subtle hover:text-rose-500 px-2 py-1.5 transition-colors"
        >
          Entfernen
        </button>
        {dirty && <span className="text-[11px] text-amber-500 ml-auto">● ungespeichert</span>}
      </div>
    </li>
  );
}
