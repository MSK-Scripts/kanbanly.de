'use client';
import { useState, useTransition } from 'react';
import {
  addLevelReward,
  removeLevelReward,
  updateLevelConfig,
} from '@/app/(app)/integrations/discord/[guildId]/actions';

type Channel = { id: string; name: string };
type Role = { id: string; name: string; color?: number };

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

function hexColor(color?: number): string {
  if (!color || color === 0) return '#94a3b8';
  return '#' + color.toString(16).padStart(6, '0');
}

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
  const roleById = new Map(roles.map((r) => [r.id, r]));

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
    <div className="space-y-5">
      <form action={submitConfig} className="space-y-4">
        <div className="flex items-center justify-between rounded-md border border-line bg-elev/40 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-fg">XP-System aktiv</div>
            <div className="text-[11px] text-subtle">
              15–25 XP pro Message · 60s Cooldown pro User.
            </div>
          </div>
          <input
            type="checkbox"
            name="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="sr-only"
          />
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled(!enabled)}
            className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
              enabled ? 'bg-accent border-accent' : 'bg-elev border-line-strong'
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        <div className={enabled ? 'space-y-4' : 'space-y-4 opacity-60 pointer-events-none'}>
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
            <label className="block text-xs font-medium text-muted mb-1.5">
              Level-Up-Channel
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
            <p className="text-[11px] text-subtle mt-1">
              Leer = die Nachricht erscheint dort, wo der User gerade aktiv ist.
            </p>
          </div>
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
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-sm font-semibold text-fg">Level-Rewards</h3>
          <span className="text-[10px] font-mono tabular-nums text-subtle">
            {rewards.length} aktiv
          </span>
        </div>
        <p className="text-[11px] text-subtle mb-3">
          Rollen, die beim Erreichen eines Levels automatisch vergeben werden.
          Der Bot muss in der Hierarchie über der Reward-Rolle stehen.
        </p>

        {rewards.length > 0 ? (
          <ul className="rounded-md border border-line bg-elev/40 divide-y divide-line mb-3">
            {rewards.map((r) => {
              const role = roleById.get(r.roleId);
              return (
                <li
                  key={r.level}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-elev/60 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-yellow-400/25 to-amber-500/15 border border-amber-500/30 px-2 py-1 text-xs font-semibold text-amber-600 dark:text-amber-300 shrink-0">
                      <span aria-hidden>🏆</span>
                      Lvl {r.level}
                    </span>
                    <span className="text-muted text-xs shrink-0">→</span>
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-line"
                        style={{ backgroundColor: hexColor(role?.color) }}
                      />
                      <span className="text-sm text-fg truncate">
                        {role?.name ?? `(Rolle ${r.roleId})`}
                      </span>
                    </span>
                  </div>
                  <form
                    action={async () => {
                      await removeLevelReward(guildId, r.level);
                    }}
                  >
                    <button
                      type="submit"
                      className="text-[11px] text-subtle hover:text-rose-500 px-2 py-1 transition-colors"
                    >
                      Entfernen
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-md border border-dashed border-line-strong p-4 text-center text-xs text-subtle mb-3">
            Noch keine Rewards definiert.
          </div>
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
