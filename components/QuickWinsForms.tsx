'use client';

import { useState, useTransition } from 'react';
import {
  updateDailyImageConfig,
  createTeamlist,
  updateTeamlist,
  deleteTeamlist,
  refreshTeamlistNow,
  type TeamlistRow,
} from '@/app/(app)/integrations/discord/[guildId]/actions';
import { toast } from '@/store/toastStore';
import { confirm } from '@/store/confirmStore';
import { Switch } from './Switch';
import { Button } from './ui/Button';
import { ColorPicker } from './ui/ColorPicker';
import { FormSection, FormRow } from './ui/FormSection';
import { StatusPill, StatusBanner } from './ui/Status';

type Channel = { id: string; name: string };
type Role = { id: string; name: string; color: number };

// ============== Bild des Tages ==============

export function DailyImageForm({
  guildId,
  channels,
  initial,
}: {
  guildId: string;
  channels: Channel[];
  initial: {
    enabled: boolean;
    channelId: string | null;
    hour: number;
    urls: string[];
  };
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [channelId, setChannelId] = useState(initial.channelId ?? '');
  const [hour, setHour] = useState(initial.hour);
  const [urlsText, setUrlsText] = useState(initial.urls.join('\n'));
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData();
    if (enabled) fd.set('enabled', 'on');
    fd.set('channel_id', channelId);
    fd.set('hour', String(hour));
    fd.set('urls', urlsText);
    startTransition(async () => {
      const r = await updateDailyImageConfig(guildId, fd);
      if (r.ok) toast.success('Bild-des-Tages gespeichert');
      else toast.error('Fehler', r.error);
    });
  };

  const validUrls = urlsText
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s));

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormSection
        title="Bild des Tages"
        description="Bot postet zur konfigurierten Stunde (UTC) ein Bild aus der Liste in den Channel. Rotation: täglich wird der nächste Index gepostet."
        badge={
          <StatusPill kind={enabled ? 'success' : 'neutral'} dot>
            {enabled ? 'Aktiv' : 'Aus'}
          </StatusPill>
        }
        action={<Switch checked={enabled} onChange={setEnabled} />}
      >
        <div className={enabled ? 'space-y-4' : 'space-y-4 opacity-50 pointer-events-none'}>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
            <FormRow label="Channel" required>
              <select
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              >
                <option value="">— Channel wählen —</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>#{c.name}</option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Stunde (UTC)" hint="0–23">
              <input
                type="number"
                min={0}
                max={23}
                value={hour}
                onChange={(e) => setHour(parseInt(e.target.value, 10) || 9)}
                className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </FormRow>
          </div>

          <FormRow
            label={`Bild-URLs (${validUrls.length})`}
            hint="Eine URL pro Zeile. Bot rotiert täglich durch."
            required
          >
            <textarea
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
              rows={8}
              placeholder="https://i.imgur.com/abc.jpg&#10;https://cdn.example.com/foo.png"
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y transition-all"
            />
          </FormRow>
        </div>
      </FormSection>

      <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 bg-bg/80 backdrop-blur-sm border-t border-line flex justify-end">
        <Button type="submit" loading={pending} variant="primary">
          {pending ? 'Speichern…' : 'Speichern'}
        </Button>
      </div>
    </form>
  );
}

// ============== Teamlisten ==============

export function TeamlistsForm({
  guildId,
  channels,
  roles,
  initial,
}: {
  guildId: string;
  channels: Channel[];
  roles: Role[];
  initial: TeamlistRow[];
}) {
  const [lists, setLists] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const channelById = new Map(channels.map((c) => [c.id, c.name]));
  const roleById = new Map(roles.map((r) => [r.id, r]));

  const onCreated = (row: TeamlistRow) => {
    setLists((prev) => [row, ...prev]);
    setCreating(false);
  };
  const onUpdated = (row: TeamlistRow) => {
    setLists((prev) => prev.map((l) => (l.id === row.id ? row : l)));
    setEditingId(null);
  };
  const onDeleted = (id: string) => {
    setLists((prev) => prev.filter((l) => l.id !== id));
  };

  return (
    <div className="space-y-5">
      <StatusBanner kind="info">
        Bot postet eine Embed-Liste aller Member mit den gewählten Rollen,
        gruppiert nach Rolle (höchste oben). Auto-Update alle 30 Min.
      </StatusBanner>

      {lists.length > 0 && (
        <ul className="space-y-3">
          {lists.map((l) => (
            <li key={l.id} className="rounded-xl border border-line bg-surface">
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line bg-elev/30">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-fg truncate">
                    {l.title}
                  </div>
                  <div className="text-[11.5px] text-muted mt-0.5">
                    <span className="text-accent-soft">
                      #{channelById.get(l.channelId) ?? l.channelId}
                    </span>{' '}
                    · {l.roleIds.length} Rolle{l.roleIds.length === 1 ? '' : 'n'}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <RefreshNowButton guildId={guildId} id={l.id} />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingId(editingId === l.id ? null : l.id)}
                  >
                    {editingId === l.id ? 'Schließen' : 'Bearbeiten'}
                  </Button>
                </div>
              </div>
              {editingId === l.id && (
                <div className="p-4">
                  <TeamlistEditor
                    guildId={guildId}
                    channels={channels}
                    roles={roles}
                    roleById={roleById}
                    initial={l}
                    onSaved={onUpdated}
                    onDeleted={onDeleted}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {creating ? (
        <FormSection title="Neue Teamliste" description="Channel, Titel und Rollen auswählen.">
          <TeamlistEditor
            guildId={guildId}
            channels={channels}
            roles={roles}
            roleById={roleById}
            initial={null}
            onSaved={onCreated}
            onCancel={() => setCreating(false)}
            onDeleted={() => {}}
          />
        </FormSection>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="w-full rounded-xl border border-dashed border-line-strong hover:border-accent hover:bg-elev/40 py-3 text-sm text-muted hover:text-fg transition-colors"
        >
          + Neue Teamliste
        </button>
      )}
    </div>
  );
}

function RefreshNowButton({ guildId, id }: { guildId: string; id: string }) {
  const [pending, startTransition] = useTransition();
  const onClick = () => {
    startTransition(async () => {
      const r = await refreshTeamlistNow(guildId, id);
      if (r.ok) toast.success('Teamliste aktualisiert');
      else toast.error('Fehler', r.error);
    });
  };
  return (
    <Button type="button" size="sm" variant="secondary" onClick={onClick} loading={pending}>
      Jetzt posten
    </Button>
  );
}

function TeamlistEditor({
  guildId,
  channels,
  roles,
  initial,
  onSaved,
  onDeleted,
  onCancel,
}: {
  guildId: string;
  channels: Channel[];
  roles: Role[];
  roleById: Map<string, Role>;
  initial: TeamlistRow | null;
  onSaved: (row: TeamlistRow) => void;
  onDeleted: (id: string) => void;
  onCancel?: () => void;
}) {
  const [channelId, setChannelId] = useState(initial?.channelId ?? '');
  const [title, setTitle] = useState(initial?.title ?? 'Team');
  const [roleIds, setRoleIds] = useState<Set<string>>(
    new Set(initial?.roleIds ?? []),
  );
  const [color, setColor] = useState(
    initial?.color !== undefined && initial?.color !== null
      ? '#' + initial.color.toString(16).padStart(6, '0')
      : '#380D52',
  );
  const [pending, startTransition] = useTransition();

  const toggleRole = (id: string) => {
    setRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = () => {
    if (!channelId || !title.trim() || roleIds.size === 0) {
      toast.error('Channel, Titel und mindestens eine Rolle nötig');
      return;
    }
    const colorInt = /^#?[0-9a-f]{6}$/i.test(color)
      ? parseInt(color.replace('#', ''), 16)
      : null;
    const payload = {
      title,
      roleIds: Array.from(roleIds),
      color: colorInt,
    };
    startTransition(async () => {
      if (initial) {
        const r = await updateTeamlist(guildId, initial.id, payload);
        if (r.ok) {
          onSaved({ ...initial, ...payload });
          toast.success('Teamliste aktualisiert');
        } else toast.error('Fehler', r.error);
      } else {
        const r = await createTeamlist(guildId, { channelId, ...payload });
        if (r.ok && r.id) {
          onSaved({ id: r.id, channelId, messageId: null, ...payload });
          toast.success('Teamliste angelegt — erste Auto-Posting in <30 Min');
        } else toast.error('Fehler', r.error);
      }
    });
  };

  const remove = async () => {
    if (!initial) return;
    const ok = await confirm({
      title: 'Teamliste löschen?',
      description: `„${initial.title}" wird entfernt, Discord-Nachricht wird gelöscht.`,
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteTeamlist(guildId, initial.id);
      if (r.ok) {
        onDeleted(initial.id);
        toast.success('Teamliste gelöscht');
      } else toast.error('Fehler', r.error);
    });
  };

  return (
    <div className="space-y-4">
      {!initial && (
        <FormRow label="Channel" required>
          <select
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
          >
            <option value="">— Channel wählen —</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>#{c.name}</option>
            ))}
          </select>
        </FormRow>
      )}
      <FormRow label="Titel" required>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 100))}
          className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
        />
      </FormRow>
      <FormRow label={`Rollen (${roleIds.size} ausgewählt)`} required>
        {roles.length === 0 ? (
          <div className="text-xs text-subtle">Keine Rollen verfügbar.</div>
        ) : (
          <div className="rounded-lg border border-line bg-elev/40 max-h-64 overflow-y-auto divide-y divide-line/60">
            {roles.map((r) => {
              const checked = roleIds.has(r.id);
              return (
                <label
                  key={r.id}
                  className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-elev/60 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleRole(r.id)}
                    className="h-4 w-4 accent-accent"
                  />
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-line"
                    style={{
                      backgroundColor: r.color
                        ? '#' + r.color.toString(16).padStart(6, '0')
                        : '#94a3b8',
                    }}
                  />
                  <span className="text-sm text-fg truncate">{r.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </FormRow>
      <FormRow label="Embed-Farbe">
        <ColorPicker value={color} onChange={setColor} />
      </FormRow>
      <div className="flex items-center justify-between gap-2">
        <div>
          {initial && (
            <Button type="button" size="sm" variant="ghost" onClick={remove}>
              Löschen
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
              Abbrechen
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={submit}
            loading={pending}
          >
            {initial ? 'Speichern' : 'Anlegen'}
          </Button>
        </div>
      </div>
    </div>
  );
}
