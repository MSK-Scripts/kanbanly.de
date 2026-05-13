'use client';
import { useState, useTransition } from 'react';
import { updateAutoRolesConfig } from '@/app/(app)/integrations/discord/[guildId]/actions';

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
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initial.roleIds),
  );
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setMsg(null);
  };

  const submit = (formData: FormData) => {
    setMsg(null);
    startTransition(async () => {
      const res = await updateAutoRolesConfig(guildId, formData);
      if (res.ok) setMsg({ kind: 'ok', text: 'Gespeichert.' });
      else setMsg({ kind: 'err', text: res.error ?? 'Fehler.' });
    });
  };

  return (
    <form action={submit} className="space-y-4">
      <label className="flex items-center gap-2 text-sm text-fg-soft cursor-pointer">
        <input
          type="checkbox"
          name="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 accent-accent"
        />
        Auto-Roles aktiv — jeder neue Member kriegt die ausgewählten Rollen.
      </label>

      <div>
        <label className="block text-xs text-muted mb-1.5">
          Rollen ({selected.size} ausgewählt, max 10)
        </label>
        {roles.length === 0 ? (
          <div className="rounded-md border border-dashed border-line-strong p-4 text-xs text-subtle text-center">
            Keine zuweisbaren Rollen. Erstell auf dem Server eine Rolle, dann
            lädt die Seite frisch.
          </div>
        ) : (
          <div className="rounded-md border border-line bg-elev max-h-60 overflow-y-auto divide-y divide-line">
            {roles.map((r) => {
              const checked = selected.has(r.id);
              return (
                <label
                  key={r.id}
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-elev-hover transition-colors"
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
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: hexColor(r.color) }}
                  />
                  <span className="text-sm text-fg flex-1 truncate">
                    {r.name}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 transition-colors disabled:opacity-50"
        >
          {pending ? 'Speichert…' : 'Speichern'}
        </button>
        {msg && (
          <span
            className={`text-xs ${
              msg.kind === 'ok'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {msg.text}
          </span>
        )}
      </div>

      <p className="text-[11px] text-subtle">
        Tipp: Damit der Bot Rollen vergeben kann, muss seine eigene Rolle im
        Server <strong>über</strong> den Rollen liegen, die er vergeben soll.
        Managed-Rollen (Bot-Integration) und @everyone werden hier nicht
        aufgelistet.
      </p>
    </form>
  );
}
