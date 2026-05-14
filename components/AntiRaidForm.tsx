'use client';

import { useState, useTransition } from 'react';
import { updateAntiRaidConfig } from '@/app/(app)/integrations/discord/[guildId]/actions';
import { toast } from '@/store/toastStore';
import { Switch } from './Switch';
import { Button } from './ui/Button';
import { FormSection, FormRow } from './ui/FormSection';
import { StatusPill, StatusBanner } from './ui/Status';

type Action = 'alert' | 'kick' | 'lockdown';

type Props = {
  guildId: string;
  channels: { id: string; name: string }[];
  initial: {
    enabled: boolean;
    joinThreshold: number;
    joinWindowSec: number;
    action: Action;
    alertChannelId: string | null;
  };
};

const ACTION_INFO: Record<Action, { label: string; hint: string }> = {
  alert: { label: 'Nur Alarm', hint: 'Postet eine Warnung im Alert-Channel, keine Aktion.' },
  kick: { label: 'Kicken', hint: 'Kickt verdächtige Member. Reversibel (Member können wieder beitreten).' },
  lockdown: {
    label: 'Lockdown (Beta)',
    hint: 'Postet einen LOCKDOWN-Alarm. Channel-Schließung muss manuell erfolgen.',
  },
};

export function AntiRaidForm({ guildId, channels, initial }: Props) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [threshold, setThreshold] = useState(initial.joinThreshold);
  const [windowSec, setWindowSec] = useState(initial.joinWindowSec);
  const [action, setAction] = useState<Action>(initial.action);
  const [alertChannelId, setAlertChannelId] = useState(initial.alertChannelId ?? '');
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData();
    if (enabled) fd.set('enabled', 'on');
    fd.set('threshold', String(threshold));
    fd.set('window_sec', String(windowSec));
    fd.set('action', action);
    fd.set('alert_channel_id', alertChannelId);
    startTransition(async () => {
      const r = await updateAntiRaidConfig(guildId, fd);
      if (r.ok) toast.success('Anti-Raid gespeichert');
      else toast.error('Speichern fehlgeschlagen', r.error);
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormSection
        title="Anti-Raid"
        description="Erkennt Burst-Joins (X Mitglieder in Y Sekunden) und reagiert automatisch."
        badge={
          <StatusPill kind={enabled ? 'success' : 'neutral'} dot>
            {enabled ? 'Aktiv' : 'Aus'}
          </StatusPill>
        }
        action={
          <Switch checked={enabled} onChange={setEnabled} ariaLabel="Anti-Raid aktiv" />
        }
      >
        <div className={enabled ? 'space-y-4' : 'space-y-4 opacity-50 pointer-events-none'}>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Schwellenwert" hint="Joins, ab denen Anti-Raid feuert">
              <input
                type="number"
                min={2}
                max={50}
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value, 10) || 5)}
                className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </FormRow>
            <FormRow label="Zeitfenster (Sek.)" hint="In diesem Fenster zählen Joins">
              <input
                type="number"
                min={5}
                max={300}
                value={windowSec}
                onChange={(e) => setWindowSec(parseInt(e.target.value, 10) || 10)}
                className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </FormRow>
          </div>

          <FormRow label="Aktion bei Trigger">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(Object.keys(ACTION_INFO) as Action[]).map((a) => {
                const active = action === a;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAction(a)}
                    className={`text-left rounded-lg border p-3 transition-all ${
                      active
                        ? 'border-accent bg-accent/10'
                        : 'border-line bg-surface hover:border-line-strong'
                    }`}
                  >
                    <div className="text-[13px] font-semibold text-fg">
                      {ACTION_INFO[a].label}
                    </div>
                    <div className="text-[11px] text-muted mt-0.5 leading-tight">
                      {ACTION_INFO[a].hint}
                    </div>
                  </button>
                );
              })}
            </div>
          </FormRow>

          <FormRow
            label="Alert-Channel"
            hint="Wo Anti-Raid-Warnungen gepostet werden. Optional, aber dringend empfohlen."
          >
            <select
              value={alertChannelId}
              onChange={(e) => setAlertChannelId(e.target.value)}
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            >
              <option value="">— Kein Channel —</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
            </select>
          </FormRow>
        </div>
      </FormSection>

      <StatusBanner kind="warning">
        Damit Anti-Raid <strong>Kick</strong>-Aktionen ausführen kann, braucht der
        Bot die Permission <strong>Kick Members</strong> und muss in der
        Rollen-Hierarchie über den verdächtigen Membern stehen.
      </StatusBanner>

      <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 bg-bg/80 backdrop-blur-sm border-t border-line flex items-center justify-end">
        <Button type="submit" loading={pending} variant="primary">
          {pending ? 'Speichern…' : 'Speichern'}
        </Button>
      </div>
    </form>
  );
}
