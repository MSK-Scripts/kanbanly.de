'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  updateBirthdayConfig,
  sendTestBirthday,
  updateRoleBadgesEnabled,
  addRoleBadge,
  removeRoleBadge,
  updateAfkConfig,
  updateInviteTrackerEnabled,
  listInviteLeaderboard,
  type InviteLeaderRow,
} from '@/app/(app)/integrations/discord/[guildId]/actions';
import { confirm } from '@/store/confirmStore';
import { toast } from '@/store/toastStore';
import { Switch } from './Switch';
import { Button } from './ui/Button';
import { TestSendButton } from './ui/TestSendButton';
import { FormSection, FormRow } from './ui/FormSection';
import { Spinner } from './ui/Spinner';
import { StatusPill, StatusBanner } from './ui/Status';

type Channel = { id: string; name: string };
type Role = { id: string; name: string; color: number };

// ============== Birthday ==============

export function BirthdayForm({
  guildId,
  channels,
  initial,
  birthdays,
}: {
  guildId: string;
  channels: Channel[];
  initial: { enabled: boolean; channelId: string | null; message: string | null };
  birthdays: Array<{ userId: string; month: number; day: number; year: number | null }>;
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [channelId, setChannelId] = useState(initial.channelId ?? '');
  const [message, setMessage] = useState(
    initial.message ?? 'Alles Gute zum Geburtstag, {mention}!',
  );
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData();
    if (enabled) fd.set('enabled', 'on');
    fd.set('channel_id', channelId);
    fd.set('message', message);
    startTransition(async () => {
      const r = await updateBirthdayConfig(guildId, fd);
      if (r.ok) toast.success('Geburtstage gespeichert');
      else toast.error('Speichern fehlgeschlagen', r.error);
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <FormSection
        title="Geburtstage"
        description="Der Bot postet täglich um ~09:00 UTC Glückwünsche im gewählten Channel."
        badge={
          <StatusPill kind={enabled ? 'success' : 'neutral'} dot>
            {enabled ? 'Aktiv' : 'Aus'}
          </StatusPill>
        }
        action={<Switch checked={enabled} onChange={setEnabled} />}
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
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </select>
          </FormRow>

          <FormRow label="Nachricht" hint="Platzhalter: {user} {mention} {age}">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
              rows={3}
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y transition-all"
            />
          </FormRow>
        </div>
      </FormSection>

      <FormSection
        title="Eingetragene Geburtstage"
        description="User tragen sich selbst mit /birthday set ein."
        badge={<StatusPill>{birthdays.length}</StatusPill>}
      >
        {birthdays.length === 0 ? (
          <div className="text-[12.5px] text-subtle text-center py-4">
            Noch keine Geburtstage eingetragen.
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto">
            {birthdays.map((b) => (
              <li
                key={b.userId}
                className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-1.5 text-[12.5px]"
              >
                <span className="text-fg truncate">
                  <code className="text-subtle text-[10px]">{b.userId}</code>
                </span>
                <span className="font-mono text-fg-soft tabular-nums shrink-0">
                  {String(b.day).padStart(2, '0')}.{String(b.month).padStart(2, '0')}
                  {b.year ? `.${b.year}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </FormSection>

      <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 bg-bg/80 backdrop-blur-sm border-t border-line flex items-center justify-end gap-2">
        <TestSendButton onSend={() => sendTestBirthday(guildId)} />
        <Button type="submit" loading={pending} variant="primary">
          {pending ? 'Speichern…' : 'Speichern'}
        </Button>
      </div>
    </form>
  );
}

// ============== Role-Badges ==============

export function RoleBadgesForm({
  guildId,
  roles,
  enabled: initialEnabled,
  badges: initialBadges,
}: {
  guildId: string;
  roles: Role[];
  enabled: boolean;
  badges: Array<{ roleId: string; daysRequired: number }>;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [badges, setBadges] = useState(initialBadges);
  const [newRoleId, setNewRoleId] = useState('');
  const [newDays, setNewDays] = useState(30);
  const [pending, startTransition] = useTransition();
  const roleById = new Map(roles.map((r) => [r.id, r]));

  const toggleEnabled = (next: boolean) => {
    setEnabled(next);
    startTransition(async () => {
      const r = await updateRoleBadgesEnabled(guildId, next);
      if (r.ok) toast.success(`Rollen-Badges ${next ? 'aktiviert' : 'deaktiviert'}`);
      else {
        setEnabled(!next);
        toast.error('Fehler', r.error);
      }
    });
  };

  const add = () => {
    if (!newRoleId || newDays < 1) return;
    startTransition(async () => {
      const r = await addRoleBadge(guildId, newRoleId, newDays);
      if (r.ok) {
        setBadges((prev) => {
          const without = prev.filter((b) => b.roleId !== newRoleId);
          return [...without, { roleId: newRoleId, daysRequired: newDays }].sort(
            (a, b) => a.daysRequired - b.daysRequired,
          );
        });
        setNewRoleId('');
        toast.success('Badge hinzugefügt');
      } else {
        toast.error('Fehler', r.error);
      }
    });
  };

  const remove = async (roleId: string, name: string) => {
    const ok = await confirm({
      title: 'Badge entfernen?',
      description: `Die Regel für „${name}" wird gelöscht.`,
      confirmLabel: 'Entfernen',
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await removeRoleBadge(guildId, roleId);
      if (r.ok) {
        setBadges((prev) => prev.filter((b) => b.roleId !== roleId));
        toast.success('Badge entfernt');
      } else toast.error('Fehler', r.error);
    });
  };

  return (
    <div className="space-y-5">
      <FormSection
        title="Rollen-Badges"
        description='Mitglieder bekommen Rollen automatisch nach X Tagen Mitgliedschaft (z.B. "1-Year-Member"). Check alle 6 Stunden.'
        badge={
          <StatusPill kind={enabled ? 'success' : 'neutral'} dot>
            {enabled ? 'Aktiv' : 'Aus'}
          </StatusPill>
        }
        action={<Switch checked={enabled} onChange={toggleEnabled} />}
      >
        <div className={enabled ? 'space-y-4' : 'space-y-4 opacity-50 pointer-events-none'}>
          {badges.length > 0 && (
            <ul className="rounded-lg border border-line bg-elev/40 divide-y divide-line/60 overflow-hidden">
              {badges.map((b) => {
                const role = roleById.get(b.roleId);
                return (
                  <li
                    key={b.roleId}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-elev/60"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="inline-flex items-center rounded-md bg-elev border border-line-strong px-2 py-0.5 text-[11.5px] font-mono tabular-nums text-fg-soft shrink-0">
                        {b.daysRequired}d
                      </span>
                      <span className="text-muted text-xs shrink-0">→</span>
                      <span className="text-[13.5px] text-fg truncate">
                        {role?.name ?? `(${b.roleId})`}
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => remove(b.roleId, role?.name ?? b.roleId)}
                    >
                      Entfernen
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-line/60">
            <input
              type="number"
              min={1}
              max={9999}
              value={newDays}
              onChange={(e) => setNewDays(parseInt(e.target.value, 10) || 30)}
              placeholder="Tage"
              className="w-full sm:w-28 rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
            <select
              value={newRoleId}
              onChange={(e) => setNewRoleId(e.target.value)}
              className="flex-1 rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            >
              <option value="">— Rolle wählen —</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <Button
              type="button"
              onClick={add}
              loading={pending}
              disabled={!newRoleId}
              variant="primary"
            >
              Hinzufügen
            </Button>
          </div>
        </div>
      </FormSection>
    </div>
  );
}

// ============== AFK-Room ==============

export function AfkForm({
  guildId,
  channels,
  initial,
}: {
  guildId: string;
  channels: Channel[];
  initial: { enabled: boolean; channelId: string | null; timeoutMinutes: number };
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [channelId, setChannelId] = useState(initial.channelId ?? '');
  const [timeout, setTimeoutMin] = useState(initial.timeoutMinutes);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData();
    if (enabled) fd.set('enabled', 'on');
    fd.set('channel_id', channelId);
    fd.set('timeout_minutes', String(timeout));
    startTransition(async () => {
      const r = await updateAfkConfig(guildId, fd);
      if (r.ok) toast.success('AFK-Room gespeichert');
      else toast.error('Fehler', r.error);
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <FormSection
        title="AFK-Room"
        description="Verschiebt User die in einem Voice-Channel länger als X Minuten stumm/taub sind in den AFK-Channel."
        badge={
          <StatusPill kind={enabled ? 'success' : 'neutral'} dot>
            {enabled ? 'Aktiv' : 'Aus'}
          </StatusPill>
        }
        action={<Switch checked={enabled} onChange={setEnabled} />}
      >
        <div className={enabled ? 'space-y-4' : 'space-y-4 opacity-50 pointer-events-none'}>
          <FormRow label="AFK-Voice-Channel" hint="Discord-Server-Einstellungen → AFK-Channel separat setzen." required>
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

          <FormRow label="Timeout (Minuten)" hint="1 – 240">
            <input
              type="number"
              min={1}
              max={240}
              value={timeout}
              onChange={(e) => setTimeoutMin(parseInt(e.target.value, 10) || 10)}
              className="w-32 rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
          </FormRow>
        </div>
      </FormSection>

      <StatusBanner kind="info">
        Hinweis: Die Channel-Liste zeigt aktuell Text-Channels. Für AFK brauchst du
        einen <strong>Voice-Channel</strong> — gib die ID direkt im Discord ein oder
        beachte dass der Channel-Picker hier nur Text-Channels listet.
      </StatusBanner>

      <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 bg-bg/80 backdrop-blur-sm border-t border-line flex justify-end">
        <Button type="submit" loading={pending} variant="primary">
          {pending ? 'Speichern…' : 'Speichern'}
        </Button>
      </div>
    </form>
  );
}

// SuggestionsForm wurde nach components/SuggestionsForm.tsx ausgelagert (v2 mit Live-Preview).

// ============== Invite-Tracker ==============

export function InviteTrackerForm({
  guildId,
  enabled: initialEnabled,
}: {
  guildId: string;
  enabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [rows, setRows] = useState<InviteLeaderRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!enabled || rows !== null) return;
    setLoading(true);
    listInviteLeaderboard(guildId)
      .then((r) => {
        if (r.ok && r.rows) setRows(r.rows);
      })
      .finally(() => setLoading(false));
  }, [enabled, rows, guildId]);

  const toggle = (next: boolean) => {
    setEnabled(next);
    startTransition(async () => {
      const r = await updateInviteTrackerEnabled(guildId, next);
      if (r.ok) toast.success(`Invite-Tracker ${next ? 'aktiviert' : 'deaktiviert'}`);
      else {
        setEnabled(!next);
        toast.error('Fehler', r.error);
      }
    });
  };

  return (
    <div className="space-y-5">
      <FormSection
        title="Invite-Tracker"
        description="Verfolgt welcher Member über welchen Invite-Link beigetreten ist. Aktivierung snapshottet alle bestehenden Invites."
        badge={
          <StatusPill kind={enabled ? 'success' : 'neutral'} dot>
            {enabled ? 'Aktiv' : 'Aus'}
          </StatusPill>
        }
        action={<Switch checked={enabled} onChange={toggle} />}
      >
        {!enabled && (
          <StatusBanner kind="info">
            Aktiviere den Tracker um die Leaderboard zu sehen. Der Bot braucht
            die <strong>Manage Server</strong>-Permission im Discord.
          </StatusBanner>
        )}

        {enabled && (
          <div>
            <div className="text-[12.5px] font-medium text-fg mb-2">
              Top-Inviter
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-[12px] text-subtle py-4">
                <Spinner size="xs" /> Lade Leaderboard…
              </div>
            ) : !rows || rows.length === 0 ? (
              <div className="text-[12.5px] text-subtle text-center py-6">
                Noch keine Invite-Attributions seit Aktivierung.
              </div>
            ) : (
              <ol className="space-y-1.5">
                {rows.map((row, idx) => {
                  const name = row.globalName || row.username || `Unknown (${row.inviterUserId})`;
                  return (
                    <li
                      key={row.inviterUserId}
                      className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2"
                    >
                      <span className="text-[11px] font-bold text-subtle w-6 tabular-nums">
                        #{idx + 1}
                      </span>
                      {row.avatarUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={row.avatarUrl}
                          alt=""
                          width={24}
                          height={24}
                          className="h-6 w-6 rounded-full shrink-0"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-elev border border-line grid place-items-center text-[10px] text-muted shrink-0">
                          {name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="text-[13.5px] text-fg truncate flex-1">{name}</span>
                      <span className="text-[12px] font-mono tabular-nums text-fg-soft shrink-0">
                        {row.count} Invite{row.count === 1 ? '' : 's'}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )}
      </FormSection>
    </div>
  );
}
