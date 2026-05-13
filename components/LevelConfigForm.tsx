'use client';
import { useState, useTransition } from 'react';
import {
  addLevelReward,
  removeLevelReward,
  updateLevelConfig,
} from '@/app/(app)/integrations/discord/[guildId]/actions';

type Channel = { id: string; name: string };
type Role = { id: string; name: string };

type Props = {
  guildId: string;
  channels: Channel[];
  roles: Role[];
  initial: {
    enabled: boolean;
    announce: boolean;
    upChannelId: string | null;
  };
  rewards: Array<{ level: number; roleId: string }>;
};

export function LevelConfigForm({
  guildId,
  channels,
  roles,
  initial,
  rewards,
}: Props) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [announce, setAnnounce] = useState(initial.announce);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const roleById = new Map(roles.map((r) => [r.id, r.name]));

  const submitConfig = (formData: FormData) => {
    setMsg(null);
    startTransition(async () => {
      const res = await updateLevelConfig(guildId, formData);
      if (res.ok) setMsg({ kind: 'ok', text: 'Gespeichert.' });
      else setMsg({ kind: 'err', text: res.error ?? 'Fehler.' });
    });
  };

  const submitReward = (formData: FormData) => {
    setMsg(null);
    startTransition(async () => {
      const res = await addLevelReward(guildId, formData);
      if (res.ok) setMsg({ kind: 'ok', text: 'Reward hinzugefügt.' });
      else setMsg({ kind: 'err', text: res.error ?? 'Fehler.' });
    });
  };

  return (
    <div className="space-y-6">
      <form action={submitConfig} className="space-y-4">
        <label className="flex items-center gap-2 text-sm text-fg-soft cursor-pointer">
          <input
            type="checkbox"
            name="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          XP-System aktiv (15-25 XP pro Message, 60s Cooldown)
        </label>

        <label className="flex items-center gap-2 text-sm text-fg-soft cursor-pointer">
          <input
            type="checkbox"
            name="announce"
            checked={announce}
            onChange={(e) => setAnnounce(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          Level-Up im Chat ankündigen
        </label>

        <div>
          <label className="block text-xs text-muted mb-1">
            Level-Up-Channel (optional — sonst im Channel der Nachricht)
          </label>
          <select
            name="channel_id"
            defaultValue={initial.upChannelId ?? ''}
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">— im jeweiligen Channel —</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 transition-colors disabled:opacity-50"
        >
          {pending ? 'Speichert…' : 'Einstellungen speichern'}
        </button>
      </form>

      <div className="border-t border-line pt-5">
        <h3 className="text-sm font-medium text-fg mb-2">Level-Rewards</h3>
        <p className="text-[11px] text-subtle mb-3">
          Rollen, die beim Erreichen eines Levels automatisch vergeben werden.
          Der Bot muss in der Rollen-Hierarchie über der vergebenen Rolle stehen.
        </p>

        {rewards.length > 0 ? (
          <ul className="rounded-md border border-line bg-elev divide-y divide-line mb-3">
            {rewards.map((r) => (
              <li key={r.level} className="flex items-center justify-between px-3 py-2">
                <span className="text-sm text-fg">
                  Level <strong>{r.level}</strong> →{' '}
                  <span className="text-fg-soft">
                    {roleById.get(r.roleId) ?? `(Rolle ${r.roleId})`}
                  </span>
                </span>
                <form
                  action={async () => {
                    await removeLevelReward(guildId, r.level);
                  }}
                >
                  <button
                    type="submit"
                    className="text-xs text-muted hover:text-rose-500 px-2 py-1"
                  >
                    Löschen
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-subtle mb-3">Noch keine Rewards definiert.</p>
        )}

        <form action={submitReward} className="flex flex-col sm:flex-row gap-2">
          <input
            type="number"
            name="level"
            placeholder="Level"
            min="1"
            max="999"
            required
            className="w-full sm:w-24 rounded-md bg-elev border border-line-strong px-3 py-1.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <select
            name="role_id"
            required
            defaultValue=""
            className="flex-1 rounded-md bg-elev border border-line-strong px-3 py-1.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="" disabled>
              Rolle wählen…
            </option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-1.5 transition-colors disabled:opacity-50"
          >
            Hinzufügen
          </button>
        </form>
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
