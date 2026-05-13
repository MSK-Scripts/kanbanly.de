'use client';
import { useState, useTransition } from 'react';
import { updateLogConfig } from '@/app/(app)/integrations/discord/[guildId]/actions';

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

  return (
    <form action={submit} className="space-y-4">
      <div>
        <label className="block text-xs text-muted mb-1" htmlFor="log-channel">
          Log-Channel
        </label>
        <select
          id="log-channel"
          name="channel_id"
          defaultValue={initial.channelId ?? ''}
          className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">— deaktiviert —</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.name}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="text-xs text-muted mb-2">Was loggen?</legend>
        <div className="space-y-1.5">
          <Toggle name="log_joins" label="Server-Beitritte" defaultChecked={initial.joins} />
          <Toggle name="log_leaves" label="Server-Austritte" defaultChecked={initial.leaves} />
          <Toggle
            name="log_message_deletes"
            label="Gelöschte Nachrichten"
            defaultChecked={initial.messageDeletes}
          />
          <Toggle
            name="log_message_edits"
            label="Bearbeitete Nachrichten"
            defaultChecked={initial.messageEdits}
          />
          <Toggle
            name="log_role_changes"
            label="Rollen-Änderungen"
            defaultChecked={initial.roleChanges}
          />
        </div>
      </fieldset>

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
        Für Message-Edits/Deletes braucht der Bot den{' '}
        <strong>MESSAGE CONTENT INTENT</strong> im Discord Developer Portal —
        sonst kommen Events ohne Inhalt durch.
      </p>
    </form>
  );
}

function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-fg-soft cursor-pointer">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 accent-accent"
      />
      {label}
    </label>
  );
}
