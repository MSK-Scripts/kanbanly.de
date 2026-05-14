'use client';

import { useState, useTransition } from 'react';
import {
  addReactionRoleMapping,
  createReactionRoleMessage,
  deleteReactionRoleMessage,
  removeReactionRoleMapping,
  updateReactionRoleMode,
} from '@/app/(app)/integrations/discord/[guildId]/actions';
import { confirm } from '@/store/confirmStore';
import { toast } from '@/store/toastStore';

type RrMode = 'reactions' | 'buttons' | 'select_menu';

const MODE_LABEL: Record<RrMode, string> = {
  reactions: 'Reaktionen',
  buttons: 'Buttons',
  select_menu: 'Dropdown',
};

const MODE_HINT: Record<RrMode, string> = {
  reactions: 'Klassisch — User klickt auf Emoji-Reaktion unter der Nachricht.',
  buttons: 'Modern — bis zu 25 Buttons mit Emoji + Label.',
  select_menu: 'Kompakt — Dropdown mit allen Rollen, Single- oder Multi-Pick.',
};

type Channel = { id: string; name: string };
type Role = { id: string; name: string; color: number };

type RrMessage = {
  messageId: string;
  channelId: string;
  title: string | null;
  description: string | null;
  mode: RrMode;
  roles: Array<{
    emojiKey: string;
    emojiDisplay: string;
    roleId: string;
    label: string | null;
  }>;
};

type Props = {
  guildId: string;
  channels: Channel[];
  roles: Role[];
  initial: RrMessage[];
};

function hexColor(color: number): string {
  if (!color || color === 0) return '#94a3b8';
  return '#' + color.toString(16).padStart(6, '0');
}

export function ReactionRolesManager({ guildId, channels, roles, initial }: Props) {
  const [items, setItems] = useState<RrMessage[]>(initial);
  const [creating, setCreating] = useState(false);
  const [newChannelId, setNewChannelId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newMode, setNewMode] = useState<RrMode>('reactions');
  const [pending, startTransition] = useTransition();

  const channelById = new Map(channels.map((c) => [c.id, c.name]));
  const roleById = new Map(roles.map((r) => [r.id, r]));

  const create = () => {
    if (!newChannelId || !newTitle.trim()) return;
    startTransition(async () => {
      const r = await createReactionRoleMessage(
        guildId,
        newChannelId,
        newTitle,
        newDesc || null,
        newMode,
      );
      if (r.ok && r.messageId) {
        setItems((prev) => [
          {
            messageId: r.messageId!,
            channelId: newChannelId,
            title: newTitle.trim(),
            description: newDesc.trim() || null,
            mode: newMode,
            roles: [],
          },
          ...prev,
        ]);
        setNewChannelId('');
        setNewTitle('');
        setNewDesc('');
        setNewMode('reactions');
        setCreating(false);
        toast.success('RR-Nachricht gepostet');
      } else {
        toast.error('Anlegen fehlgeschlagen', r.error);
      }
    });
  };

  const removeMessage = async (messageId: string) => {
    const ok = await confirm({
      title: 'RR-Nachricht löschen?',
      description: 'Die Discord-Nachricht wird gelöscht, alle Zuordnungen entfernt.',
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteReactionRoleMessage(guildId, messageId);
      if (r.ok) {
        setItems((prev) => prev.filter((i) => i.messageId !== messageId));
        toast.success('RR-Nachricht gelöscht');
      } else {
        toast.error('Löschen fehlgeschlagen', r.error);
      }
    });
  };

  const addMapping = (
    messageId: string,
    emoji: string,
    roleId: string,
    label: string,
  ) => {
    startTransition(async () => {
      const r = await addReactionRoleMapping(
        guildId,
        messageId,
        emoji,
        roleId,
        label.trim() || null,
      );
      if (r.ok) {
        const role = roleById.get(roleId);
        setItems((prev) =>
          prev.map((m) =>
            m.messageId === messageId
              ? {
                  ...m,
                  roles: [
                    ...m.roles.filter((r) => r.emojiDisplay !== emoji),
                    {
                      emojiKey: emoji,
                      emojiDisplay: emoji,
                      roleId,
                      label: label.trim() || null,
                    },
                  ],
                }
              : m,
          ),
        );
        toast.success(`${emoji} → ${role?.name ?? 'Rolle'} hinzugefügt`);
      } else {
        toast.error('Hinzufügen fehlgeschlagen', r.error);
      }
    });
  };

  const changeMode = (messageId: string, mode: RrMode) => {
    startTransition(async () => {
      const r = await updateReactionRoleMode(guildId, messageId, mode);
      if (r.ok) {
        setItems((prev) =>
          prev.map((m) => (m.messageId === messageId ? { ...m, mode } : m)),
        );
        toast.success(`Modus geändert: ${MODE_LABEL[mode]}`);
      } else {
        toast.error('Modus-Wechsel fehlgeschlagen', r.error);
      }
    });
  };

  const removeMapping = (
    messageId: string,
    emojiKey: string,
    emojiDisplay: string,
  ) => {
    startTransition(async () => {
      const r = await removeReactionRoleMapping(
        guildId,
        messageId,
        emojiKey,
        emojiDisplay,
      );
      if (r.ok) {
        setItems((prev) =>
          prev.map((m) =>
            m.messageId === messageId
              ? {
                  ...m,
                  roles: m.roles.filter((r) => r.emojiKey !== emojiKey),
                }
              : m,
          ),
        );
        toast.success('Zuordnung entfernt');
      } else {
        toast.error('Entfernen fehlgeschlagen', r.error);
      }
    });
  };

  return (
    <div className="space-y-5">
      <p className="text-xs text-subtle">
        Reaction-Rollen lassen Mitglieder per Emoji-Klick eine Rolle annehmen
        oder abgeben. Der Bot postet eine Embed-Nachricht, fügt automatisch
        die Reaktionen hinzu, und vergibt/entfernt Rollen bei Klick.
      </p>

      {/* Liste bestehender RR-Nachrichten */}
      {items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((m) => (
            <RrMessageCard
              key={m.messageId}
              message={m}
              channels={channels}
              roles={roles}
              channelName={channelById.get(m.channelId) ?? m.channelId}
              roleById={roleById}
              onAddMapping={(emoji, roleId, label) =>
                addMapping(m.messageId, emoji, roleId, label)
              }
              onRemoveMapping={(emojiKey, emojiDisplay) =>
                removeMapping(m.messageId, emojiKey, emojiDisplay)
              }
              onChangeMode={(mode) => changeMode(m.messageId, mode)}
              onDeleteMessage={() => removeMessage(m.messageId)}
              pending={pending}
            />
          ))}
        </ul>
      ) : (
        <div className="rounded-md border border-dashed border-line-strong p-6 text-center text-xs text-subtle">
          Noch keine Reaction-Roles-Nachrichten.
        </div>
      )}

      {/* Neue Nachricht erstellen */}
      {creating ? (
        <div className="rounded-md border border-line bg-elev/40 p-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Neue Reaction-Roles-Nachricht
          </div>
          <select
            value={newChannelId}
            onChange={(e) => setNewChannelId(e.target.value)}
            className="w-full rounded-md bg-surface border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">— Channel wählen —</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value.slice(0, 200))}
            placeholder='Titel (z. B. "Wähle deine Rollen")'
            className="w-full rounded-md bg-surface border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <textarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value.slice(0, 1500))}
            rows={3}
            placeholder="Beschreibung (optional, Markdown ok)"
            className="w-full rounded-md bg-surface border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle font-mono focus:outline-none focus:ring-1 focus:ring-accent resize-y"
          />
          <div>
            <label className="block text-[11px] font-medium text-muted mb-1.5">
              Modus
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(['reactions', 'buttons', 'select_menu'] as RrMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setNewMode(m)}
                  className={`text-left rounded-md border p-2 transition-colors ${
                    newMode === m
                      ? 'border-accent bg-accent/10'
                      : 'border-line bg-surface hover:border-line-strong'
                  }`}
                >
                  <div className="text-xs font-medium text-fg">
                    {MODE_LABEL[m]}
                  </div>
                  <div className="text-[10px] text-subtle mt-0.5 leading-tight">
                    {MODE_HINT[m]}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={create}
              disabled={pending || !newChannelId || !newTitle.trim()}
              className="rounded-md bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
            >
              {pending ? 'Posted…' : 'Posten'}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setNewChannelId('');
                setNewTitle('');
                setNewDesc('');
              }}
              className="text-xs text-muted hover:text-fg px-3 py-2 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="w-full rounded-md border border-dashed border-line-strong hover:border-accent hover:bg-elev/40 py-3 text-sm text-muted hover:text-fg transition-colors"
        >
          + Neue Reaction-Roles-Nachricht
        </button>
      )}

    </div>
  );
}

function RrMessageCard({
  message,
  channels,
  roles,
  channelName,
  roleById,
  onAddMapping,
  onRemoveMapping,
  onChangeMode,
  onDeleteMessage,
  pending,
}: {
  message: RrMessage;
  channels: Channel[];
  roles: Role[];
  channelName: string;
  roleById: Map<string, Role>;
  onAddMapping: (emoji: string, roleId: string, label: string) => void;
  onRemoveMapping: (emojiKey: string, emojiDisplay: string) => void;
  onChangeMode: (mode: RrMode) => void;
  onDeleteMessage: () => void;
  pending: boolean;
}) {
  const [emoji, setEmoji] = useState('');
  const [roleId, setRoleId] = useState('');
  const [label, setLabel] = useState('');
  void channels;

  const submit = () => {
    if (!emoji.trim() || !roleId) return;
    onAddMapping(emoji.trim(), roleId, label);
    setEmoji('');
    setRoleId('');
    setLabel('');
  };

  return (
    <li className="rounded-md border border-line bg-elev/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-line bg-elev/40">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-fg truncate">
            {message.title ?? '(ohne Titel)'}
          </div>
          <div className="text-[11px] text-subtle mt-0.5">
            <span className="text-accent">#{channelName}</span> ·{' '}
            <span className="font-mono">{message.messageId}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={message.mode}
            onChange={(e) => onChangeMode(e.target.value as RrMode)}
            disabled={pending}
            className="text-[11px] rounded bg-surface border border-line-strong text-fg-soft px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-accent"
            title={MODE_HINT[message.mode]}
          >
            <option value="reactions">{MODE_LABEL.reactions}</option>
            <option value="buttons">{MODE_LABEL.buttons}</option>
            <option value="select_menu">{MODE_LABEL.select_menu}</option>
          </select>
          <button
            type="button"
            onClick={onDeleteMessage}
            disabled={pending}
            className="text-[11px] text-subtle hover:text-rose-500 px-2 py-1 transition-colors"
          >
            Löschen
          </button>
        </div>
      </div>

      {/* Mappings */}
      <div className="px-4 py-3 space-y-2">
        {message.roles.length > 0 ? (
          <ul className="space-y-1.5">
            {message.roles.map((r) => {
              const role = roleById.get(r.roleId);
              return (
                <li
                  key={r.emojiKey}
                  className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5 text-sm group"
                >
                  <span className="text-base leading-none">{r.emojiDisplay}</span>
                  <span className="text-muted text-xs">→</span>
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-line"
                    style={{ backgroundColor: hexColor(role?.color ?? 0) }}
                  />
                  <span className="text-fg flex-1 truncate">
                    {role?.name ?? `(${r.roleId})`}
                  </span>
                  {r.label && (
                    <span className="text-[11px] text-subtle truncate">
                      · {r.label}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveMapping(r.emojiKey, r.emojiDisplay)}
                    disabled={pending}
                    className="opacity-0 group-hover:opacity-100 text-[11px] text-subtle hover:text-rose-500 transition-all"
                  >
                    Entfernen
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[11px] text-subtle italic">
            Noch keine Emoji→Rolle-Zuordnungen.
          </p>
        )}

        {/* Add-Form */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-line/60 mt-3">
          <input
            type="text"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="🎮 oder <:name:id>"
            className="w-full sm:w-32 rounded-md bg-surface border border-line-strong px-2 py-1.5 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="flex-1 rounded-md bg-surface border border-line-strong px-2 py-1.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">— Rolle —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value.slice(0, 100))}
            placeholder="Label (optional)"
            className="w-full sm:w-40 rounded-md bg-surface border border-line-strong px-2 py-1.5 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            type="button"
            onClick={submit}
            disabled={pending || !emoji.trim() || !roleId}
            className="rounded-md bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 transition-colors"
          >
            + Hinzufügen
          </button>
        </div>
      </div>
    </li>
  );
}
