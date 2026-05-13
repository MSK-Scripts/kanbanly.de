'use client';

import { useState, useTransition } from 'react';
import {
  upsertChannelMode,
  deleteChannelMode,
} from '@/app/(app)/integrations/discord/[guildId]/actions';
import { confirm } from '@/store/confirmStore';

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
  images_only: '🖼️',
  text_only: '💬',
};

export function ChannelModesForm({ guildId, channels, initial }: Props) {
  const [items, setItems] = useState(initial);
  const [newChannelId, setNewChannelId] = useState('');
  const [newMode, setNewMode] = useState<Mode>('images_only');
  const [newAllowVideos, setNewAllowVideos] = useState(true);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const channelById = new Map(channels.map((c) => [c.id, c.name]));
  const occupiedIds = new Set(items.map((i) => i.channelId));
  const availableChannels = channels.filter((c) => !occupiedIds.has(c.id));

  const add = () => {
    if (!newChannelId) return;
    setMsg(null);
    startTransition(async () => {
      const r = await upsertChannelMode(guildId, newChannelId, newMode, newAllowVideos);
      if (r.ok) {
        setItems((prev) => [
          ...prev.filter((i) => i.channelId !== newChannelId),
          { channelId: newChannelId, mode: newMode, allowVideos: newAllowVideos },
        ]);
        setNewChannelId('');
        setMsg({ kind: 'ok', text: 'Hinzugefügt.' });
      } else {
        setMsg({ kind: 'err', text: r.error ?? 'Fehler.' });
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
    setMsg(null);
    startTransition(async () => {
      const r = await deleteChannelMode(guildId, channelId);
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
        Beschränkt einen Channel auf nur Bilder oder nur Text. Moderatoren werden
        nicht gefiltert. Nicht-konforme Nachrichten werden gelöscht, der User
        bekommt eine DM-Notiz.
      </p>

      {items.length > 0 ? (
        <ul className="rounded-md border border-line bg-elev/40 divide-y divide-line">
          {items.map((item) => (
            <li
              key={item.channelId}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-lg" aria-hidden>
                  {MODE_ICON[item.mode]}
                </span>
                <div className="min-w-0">
                  <div className="text-sm text-fg">
                    #{channelById.get(item.channelId) ?? item.channelId}
                  </div>
                  <div className="text-[11px] text-subtle">
                    {MODE_LABEL[item.mode]}
                    {item.mode === 'images_only' &&
                      (item.allowVideos ? ' · inkl. Videos' : ' · keine Videos')}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(item.channelId)}
                disabled={pending}
                className="text-[11px] text-subtle hover:text-rose-500 px-2 py-1 transition-colors"
              >
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-md border border-dashed border-line-strong p-6 text-center text-xs text-subtle">
          Noch keine Channel-Modes konfiguriert.
        </div>
      )}

      <div className="rounded-md border border-line bg-elev/40 p-4 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">
          Neu hinzufügen
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select
            value={newChannelId}
            onChange={(e) => setNewChannelId(e.target.value)}
            className="rounded-md bg-surface border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">— Channel wählen —</option>
            {availableChannels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
          <select
            value={newMode}
            onChange={(e) => setNewMode(e.target.value as Mode)}
            className="rounded-md bg-surface border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="images_only">🖼️ Bilder-Only</option>
            <option value="text_only">💬 Text-Only</option>
          </select>
        </div>

        {newMode === 'images_only' && (
          <label className="flex items-center gap-2 text-sm text-fg-soft cursor-pointer">
            <input
              type="checkbox"
              checked={newAllowVideos}
              onChange={(e) => setNewAllowVideos(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            Videos auch erlauben
          </label>
        )}

        <button
          type="button"
          onClick={add}
          disabled={pending || !newChannelId}
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
