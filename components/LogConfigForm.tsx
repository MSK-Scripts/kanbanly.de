'use client';
import { useState, useTransition } from 'react';
import { updateLogConfig } from '@/app/(app)/integrations/discord/[guildId]/actions';
import { Switch } from './Switch';

type Channel = { id: string; name: string };

type Props = {
  guildId: string;
  channels: Channel[];
  initial: {
    channelId: string | null;
    joins: boolean;
    leaves: boolean;
    messageEdits: boolean;
    messageDeletes: boolean;
    roleChanges: boolean;
  };
};

export function LogConfigForm({ guildId, channels, initial }: Props) {
  const [channelId, setChannelId] = useState(initial.channelId ?? '');
  const [joins, setJoins] = useState(initial.joins);
  const [leaves, setLeaves] = useState(initial.leaves);
  const [messageEdits, setMessageEdits] = useState(initial.messageEdits);
  const [messageDeletes, setMessageDeletes] = useState(initial.messageDeletes);
  const [roleChanges, setRoleChanges] = useState(initial.roleChanges);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const submit = (formData: FormData) => {
    setMsg(null);
    startTransition(async () => {
      const res = await updateLogConfig(guildId, formData);
      if (res.ok) setMsg({ kind: 'ok', text: 'Gespeichert.' });
      else setMsg({ kind: 'err', text: res.error ?? 'Fehler.' });
    });
  };

  const enabledCount = [joins, leaves, messageEdits, messageDeletes, roleChanges].filter(Boolean).length;
  const active = channelId !== '';

  return (
    <form action={submit} className="space-y-5">
      <div className="rounded-md border border-line bg-elev/40 p-4">
        <label className="block text-xs font-medium text-muted mb-1.5" htmlFor="log-channel">
          Log-Channel
        </label>
        <select
          id="log-channel"
          name="channel_id"
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          className="w-full rounded-md bg-surface border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">— Logging deaktiviert —</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </select>
        {active && (
          <p className="text-[11px] text-subtle mt-2">
            {enabledCount === 0
              ? 'Channel gesetzt, aber kein Event aktiv — wähle unten was geloggt werden soll.'
              : `${enabledCount} Event-Typ${enabledCount === 1 ? '' : 'en'} aktiv.`}
          </p>
        )}
      </div>

      <div className={active ? '' : 'opacity-60 pointer-events-none'}>
        <Section title="Member-Events" hint="Wer kommt, wer geht">
          <Toggle
            name="log_joins"
            label="Beitritte"
            description="Wenn jemand dem Server beitritt."
            checked={joins}
            onChange={setJoins}
          />
          <Toggle
            name="log_leaves"
            label="Austritte"
            description="Beim Verlassen oder Kick/Ban."
            checked={leaves}
            onChange={setLeaves}
          />
        </Section>

        <Section title="Message-Events" hint="Braucht MESSAGE CONTENT INTENT">
          <Toggle
            name="log_message_deletes"
            label="Gelöschte Nachrichten"
            description="Inhalt + Autor wird mitgeloggt."
            checked={messageDeletes}
            onChange={setMessageDeletes}
          />
          <Toggle
            name="log_message_edits"
            label="Bearbeitete Nachrichten"
            description="Vorher/Nachher-Vergleich."
            checked={messageEdits}
            onChange={setMessageEdits}
          />
        </Section>

        <Section title="Rollen-Events" hint="">
          <Toggle
            name="log_role_changes"
            label="Rollen-Änderungen"
            description="Wer welche Rolle bekommen/verloren hat."
            checked={roleChanges}
            onChange={setRoleChanges}
          />
        </Section>
      </div>

      <div className="flex items-center gap-3 border-t border-line pt-4">
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
        Für Message-Edits/Deletes braucht der Bot den{' '}
        <strong>MESSAGE CONTENT INTENT</strong> im Discord Developer Portal —
        sonst kommen Events ohne Inhalt durch.
      </p>
    </form>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">
          {title}
        </div>
        {hint && <div className="text-[10px] text-subtle">{hint}</div>}
      </div>
      <div className="rounded-md border border-line bg-elev/40 divide-y divide-line">
        {children}
      </div>
    </div>
  );
}

function Toggle({
  name,
  label,
  description,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer hover:bg-elev/60 transition-colors">
      <div className="min-w-0">
        <div className="text-sm text-fg">{label}</div>
        <div className="text-[11px] text-subtle">{description}</div>
      </div>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <Switch checked={checked} onChange={onChange} size="sm" ariaLabel={label} />
    </label>
  );
}
