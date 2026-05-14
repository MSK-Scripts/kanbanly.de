'use client';
import { useState, useTransition } from 'react';
import { updateLogConfig } from '@/app/(app)/integrations/discord/[guildId]/actions';
import { toast } from '@/store/toastStore';
import { Switch } from './Switch';
import { Button } from './ui/Button';
import { FormSection, FormRow } from './ui/FormSection';
import { StatusPill, StatusBanner } from './ui/Status';

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

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const res = await updateLogConfig(guildId, formData);
      if (res.ok) toast.success('Logging gespeichert');
      else toast.error('Speichern fehlgeschlagen', res.error);
    });
  };

  const enabledCount = [joins, leaves, messageEdits, messageDeletes, roleChanges].filter(Boolean).length;
  const active = channelId !== '';

  return (
    <form action={submit} className="space-y-5">
      <FormSection
        title="Log-Channel"
        description="Welcher Channel soll die Audit-Events empfangen?"
        badge={
          active ? (
            <StatusPill kind="success" dot>
              {enabledCount} Event{enabledCount === 1 ? '' : 's'}
            </StatusPill>
          ) : (
            <StatusPill kind="neutral" dot>
              Aus
            </StatusPill>
          )
        }
      >
        <FormRow label="Channel">
          <select
            id="log-channel"
            name="channel_id"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
          >
            <option value="">— Logging deaktiviert —</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
        </FormRow>
        {active && enabledCount === 0 && (
          <StatusBanner kind="warning">
            Channel ist gesetzt, aber kein Event aktiv. Wähle unten was geloggt werden soll.
          </StatusBanner>
        )}
      </FormSection>

      <div className={active ? 'space-y-4' : 'space-y-4 opacity-50 pointer-events-none'}>
        <EventGroup title="Member-Events" hint="Wer kommt, wer geht">
          <EventRow
            name="log_joins"
            label="Beitritte"
            description="Wenn jemand dem Server beitritt."
            checked={joins}
            onChange={setJoins}
          />
          <EventRow
            name="log_leaves"
            label="Austritte"
            description="Beim Verlassen oder Kick/Ban."
            checked={leaves}
            onChange={setLeaves}
          />
        </EventGroup>

        <EventGroup title="Message-Events" hint="Braucht MESSAGE CONTENT INTENT">
          <EventRow
            name="log_message_deletes"
            label="Gelöschte Nachrichten"
            description="Inhalt + Autor wird mitgeloggt."
            checked={messageDeletes}
            onChange={setMessageDeletes}
          />
          <EventRow
            name="log_message_edits"
            label="Bearbeitete Nachrichten"
            description="Vorher/Nachher-Vergleich."
            checked={messageEdits}
            onChange={setMessageEdits}
          />
        </EventGroup>

        <EventGroup title="Rollen-Events">
          <EventRow
            name="log_role_changes"
            label="Rollen-Änderungen"
            description="Wer welche Rolle bekommen/verloren hat."
            checked={roleChanges}
            onChange={setRoleChanges}
          />
        </EventGroup>
      </div>

      <StatusBanner kind="info">
        Für Message-Edits/Deletes braucht der Bot den{' '}
        <strong>MESSAGE CONTENT INTENT</strong> im Discord Developer Portal —
        sonst kommen Events ohne Inhalt durch.
      </StatusBanner>

      <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 bg-bg/80 backdrop-blur-sm border-t border-line flex items-center justify-end">
        <Button type="submit" loading={pending} variant="primary">
          {pending ? 'Speichern…' : 'Speichern'}
        </Button>
      </div>
    </form>
  );
}

function EventGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2 px-1">
        <h4 className="text-[11.5px] font-semibold uppercase tracking-wider text-muted">
          {title}
        </h4>
        {hint && <span className="text-[10.5px] text-subtle">{hint}</span>}
      </div>
      <div className="rounded-lg border border-line bg-surface divide-y divide-line/60 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function EventRow({
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
    <label className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-elev/30 transition-colors">
      <div className="min-w-0">
        <div className="text-[13.5px] text-fg font-medium">{label}</div>
        <div className="text-[11.5px] text-muted mt-0.5">{description}</div>
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
