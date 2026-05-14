'use client';
import { useState, useTransition } from 'react';
import {
  addLevelReward,
  removeLevelReward,
  updateLevelConfig,
  sendTestLevelUp,
} from '@/app/(app)/integrations/discord/[guildId]/actions';
import { TestSendButton } from './ui/TestSendButton';
import { toast } from '@/store/toastStore';
import { confirm } from '@/store/confirmStore';
import { Switch } from './Switch';
import { Button } from './ui/Button';
import { ColorPicker } from './ui/ColorPicker';
import { FormSection, FormRow } from './ui/FormSection';
import { StatusPill } from './ui/Status';

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
    useEmbed: boolean;
    embedColor: number | null;
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
  const [useEmbed, setUseEmbed] = useState(initial.useEmbed);
  const [embedColor, setEmbedColor] = useState(
    initial.embedColor !== null
      ? '#' + initial.embedColor.toString(16).padStart(6, '0')
      : '#eab308',
  );
  const [pending, startTransition] = useTransition();
  const [rewardLevel, setRewardLevel] = useState('');
  const [rewardRoleId, setRewardRoleId] = useState('');
  const roleById = new Map(roles.map((r) => [r.id, r]));

  const submitConfig = (formData: FormData) => {
    startTransition(async () => {
      const res = await updateLevelConfig(guildId, formData);
      if (res.ok) toast.success('Level-Einstellungen gespeichert');
      else toast.error('Speichern fehlgeschlagen', res.error);
    });
  };

  const submitReward = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!rewardLevel || !rewardRoleId) return;
    const fd = new FormData();
    fd.set('level', rewardLevel);
    fd.set('role_id', rewardRoleId);
    startTransition(async () => {
      const res = await addLevelReward(guildId, fd);
      if (res.ok) {
        toast.success('Reward hinzugefügt');
        setRewardLevel('');
        setRewardRoleId('');
      } else {
        toast.error('Hinzufügen fehlgeschlagen', res.error);
      }
    });
  };

  const removeReward = async (level: number, roleName: string) => {
    const ok = await confirm({
      title: `Reward für Level ${level} entfernen?`,
      description: `Die Rolle „${roleName}" wird bei neuen Level-Ups nicht mehr vergeben.`,
      confirmLabel: 'Entfernen',
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        await removeLevelReward(guildId, level);
        toast.success('Reward entfernt');
      } catch (err) {
        toast.error('Entfernen fehlgeschlagen', err instanceof Error ? err.message : undefined);
      }
    });
  };

  return (
    <div className="space-y-5">
      <form action={submitConfig} className="space-y-5">
        <FormSection
          title="XP-System"
          description="15–25 XP pro Message · 60s Cooldown pro User."
          badge={
            <StatusPill kind={enabled ? 'success' : 'neutral'} dot>
              {enabled ? 'Aktiv' : 'Aus'}
            </StatusPill>
          }
          action={
            <Switch checked={enabled} onChange={setEnabled} ariaLabel="XP-System aktiv" />
          }
        >
          <input
            type="checkbox"
            name="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="sr-only"
          />
          <div
            className={
              enabled ? 'space-y-4' : 'space-y-4 opacity-50 pointer-events-none'
            }
          >
            <label className="flex items-center gap-2.5 text-[13.5px] text-fg-soft cursor-pointer rounded-md hover:bg-elev/30 px-2 py-1.5 -mx-2 transition-colors">
              <input
                type="checkbox"
                name="announce"
                checked={announce}
                onChange={(e) => setAnnounce(e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              Level-Up im Chat ankündigen
            </label>

            <FormRow
              label="Level-Up-Channel"
              hint="Leer = die Nachricht erscheint dort, wo der User gerade aktiv ist."
            >
              <select
                name="channel_id"
                defaultValue={initial.upChannelId ?? ''}
                className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              >
                <option value="">— im jeweiligen Channel —</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>
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
                  ariaLabel="Level-Up als Embed"
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
            <input type="hidden" name="use_embed" value={useEmbed ? 'on' : ''} />
            <input type="hidden" name="embed_color" value={embedColor} />
          </div>
        </FormSection>

        <FormSection
          title="Level-Rewards"
          description="Rollen, die beim Erreichen eines Levels automatisch vergeben werden."
          badge={
            <StatusPill kind={rewards.length > 0 ? 'success' : 'neutral'}>
              {rewards.length} {rewards.length === 1 ? 'Reward' : 'Rewards'}
            </StatusPill>
          }
        >
          {rewards.length > 0 ? (
            <ul className="rounded-lg border border-line bg-elev/40 divide-y divide-line/60 overflow-hidden">
              {rewards.map((r) => {
                const role = roleById.get(r.roleId);
                const roleName = role?.name ?? `(Rolle ${r.roleId})`;
                return (
                  <li
                    key={r.level}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-elev/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--warning-soft)] border border-[var(--warning-line)] px-2 py-1 text-[11.5px] font-bold text-[var(--warning)] shrink-0">
                        Level {r.level}
                      </span>
                      <span className="text-subtle text-xs shrink-0">→</span>
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-line"
                          style={{ backgroundColor: hexColor(role?.color) }}
                        />
                        <span className="text-[13.5px] text-fg truncate">
                          {roleName}
                        </span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeReward(r.level, roleName)}
                      className="text-[11.5px] text-subtle hover:text-[var(--danger)] px-2 py-1 transition-colors"
                    >
                      Entfernen
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed border-line-strong p-6 text-center text-xs text-subtle">
              Noch keine Rewards definiert.
            </div>
          )}

          <form
            onSubmit={submitReward}
            className="flex flex-col sm:flex-row gap-2 pt-4 mt-1 border-t border-line/60"
          >
            <input
              type="number"
              value={rewardLevel}
              onChange={(e) => setRewardLevel(e.target.value)}
              placeholder="Level"
              min={1}
              max={999}
              required
              className="w-full sm:w-24 rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
            <select
              value={rewardRoleId}
              onChange={(e) => setRewardRoleId(e.target.value)}
              required
              className="flex-1 rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
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
            <Button type="submit" loading={pending} variant="secondary">
              Hinzufügen
            </Button>
          </form>
        </FormSection>

        <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 bg-bg/80 backdrop-blur-sm border-t border-line flex items-center justify-end gap-2">
          <TestSendButton onSend={() => sendTestLevelUp(guildId)} />
          <Button type="submit" loading={pending} variant="primary">
            {pending ? 'Speichern…' : 'Einstellungen speichern'}
          </Button>
        </div>
      </form>
    </div>
  );
}
