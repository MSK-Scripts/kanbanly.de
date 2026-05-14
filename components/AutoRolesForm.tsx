'use client';
import { useState, useTransition } from 'react';
import { updateAutoRolesConfig } from '@/app/(app)/integrations/discord/[guildId]/actions';
import { toast } from '@/store/toastStore';
import { Switch } from './Switch';
import { Button } from './ui/Button';
import { FormSection } from './ui/FormSection';
import { StatusPill, StatusBanner } from './ui/Status';

type Role = { id: string; name: string; color: number };

type Props = {
  guildId: string;
  roles: Role[];
  initial: { enabled: boolean; roleIds: string[] };
};

function hexColor(color: number): string {
  if (color === 0) return '#94a3b8';
  return '#' + color.toString(16).padStart(6, '0');
}

export function AutoRolesForm({ guildId, roles, initial }: Props) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [selected, setSelected] = useState<Set<string>>(new Set(initial.roleIds));
  const [pending, startTransition] = useTransition();

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const res = await updateAutoRolesConfig(guildId, formData);
      if (res.ok) toast.success('Auto-Roles gespeichert');
      else toast.error('Speichern fehlgeschlagen', res.error);
    });
  };

  return (
    <form action={submit} className="space-y-5">
      <input
        type="checkbox"
        name="enabled"
        checked={enabled}
        onChange={(e) => setEnabled(e.target.checked)}
        className="sr-only"
      />
      <FormSection
        title="Auto-Roles"
        description="Jeder neue Member bekommt diese Rollen automatisch beim Beitritt."
        badge={
          <StatusPill kind={enabled ? 'success' : 'neutral'} dot>
            {enabled ? 'Aktiv' : 'Aus'}
          </StatusPill>
        }
        action={
          <Switch checked={enabled} onChange={setEnabled} ariaLabel="Auto-Roles aktiv" />
        }
      >
        <div className={enabled ? 'space-y-4' : 'space-y-4 opacity-50 pointer-events-none'}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12.5px] font-medium text-fg-soft">
                Rollen
              </label>
              <span className="text-[10.5px] font-mono tabular-nums text-subtle">
                {selected.size} / 10 ausgewählt
              </span>
            </div>
            {roles.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line-strong p-6 text-xs text-subtle text-center">
                Keine zuweisbaren Rollen. Erstell auf dem Server eine Rolle.
              </div>
            ) : (
              <div className="rounded-lg border border-line bg-elev/40 max-h-72 overflow-y-auto divide-y divide-line/60">
                {roles.map((r) => {
                  const checked = selected.has(r.id);
                  return (
                    <label
                      key={r.id}
                      className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-elev/60 transition-colors"
                    >
                      <input
                        type="checkbox"
                        name="role_ids"
                        value={r.id}
                        checked={checked}
                        onChange={() => toggle(r.id)}
                        className="h-4 w-4 accent-accent shrink-0"
                      />
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-line"
                        style={{ backgroundColor: hexColor(r.color) }}
                      />
                      <span className="text-sm text-fg flex-1 truncate">{r.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </FormSection>

      <StatusBanner kind="info" title="Hierarchie-Tipp">
        Damit der Bot Rollen vergeben kann, muss seine eigene Rolle im Server
        <strong> über</strong> den Rollen liegen, die er vergeben soll.
        Managed-Rollen (Bot-Integration) und @everyone werden nicht aufgelistet.
      </StatusBanner>

      <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 bg-bg/80 backdrop-blur-sm border-t border-line flex items-center justify-end">
        <Button type="submit" loading={pending} variant="primary">
          {pending ? 'Speichern…' : 'Speichern'}
        </Button>
      </div>
    </form>
  );
}
