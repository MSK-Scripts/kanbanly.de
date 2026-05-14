'use client';

import { useState, useTransition } from 'react';
import {
  updateVerifyConfig,
  postVerifyPanel,
} from '@/app/(app)/integrations/discord/[guildId]/actions';
import { toast } from '@/store/toastStore';
import { Switch } from './Switch';
import { Button } from './ui/Button';
import { FormSection, FormRow } from './ui/FormSection';
import { StatusPill, StatusBanner } from './ui/Status';

type Props = {
  guildId: string;
  channels: { id: string; name: string }[];
  roles: { id: string; name: string; color: number }[];
  initial: {
    enabled: boolean;
    channelId: string | null;
    roleId: string | null;
    message: string | null;
    panelMessageId: string | null;
  };
};

const DEFAULT_MESSAGE =
  'Willkommen! Klick auf den Button unten, um dich zu verifizieren und Zugriff auf den Server zu bekommen.';

export function VerifyForm({ guildId, channels, roles, initial }: Props) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [channelId, setChannelId] = useState(initial.channelId ?? '');
  const [roleId, setRoleId] = useState(initial.roleId ?? '');
  const [message, setMessage] = useState(initial.message ?? DEFAULT_MESSAGE);
  const [pending, startTransition] = useTransition();
  const [posting, setPosting] = useState(false);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData();
    if (enabled) fd.set('enabled', 'on');
    fd.set('channel_id', channelId);
    fd.set('role_id', roleId);
    fd.set('message', message);
    startTransition(async () => {
      const r = await updateVerifyConfig(guildId, fd);
      if (r.ok) toast.success('Verify gespeichert');
      else toast.error('Speichern fehlgeschlagen', r.error);
    });
  };

  const postPanel = async () => {
    setPosting(true);
    const r = await postVerifyPanel(guildId);
    setPosting(false);
    if (r.ok) toast.success('Verify-Panel gepostet');
    else toast.error('Posten fehlgeschlagen', r.error);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormSection
        title="Button-Verifizierung"
        description="Schützt vor Selfbots & Raids. Neue Member klicken den Button, um die Verified-Rolle und Zugriff auf den Server zu bekommen."
        badge={
          <StatusPill kind={enabled ? 'success' : 'neutral'} dot>
            {enabled ? 'Aktiv' : 'Aus'}
          </StatusPill>
        }
        action={
          <Switch checked={enabled} onChange={setEnabled} ariaLabel="Verify aktiv" />
        }
      >
        <div className={enabled ? 'space-y-4' : 'space-y-4 opacity-50 pointer-events-none'}>
          <FormRow label="Verify-Channel" hint="Der Channel, in dem das Button-Panel erscheint." required>
            <select
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            >
              <option value="">— Channel wählen —</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
            </select>
          </FormRow>

          <FormRow
            label="Verified-Rolle"
            hint="Die Rolle, die nach erfolgreichem Klick vergeben wird. Bot-Rolle muss in der Hierarchie darüber stehen."
            required
          >
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            >
              <option value="">— Rolle wählen —</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </FormRow>

          <FormRow label="Nachricht im Panel" hint="Erscheint über dem Button-Panel.">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
              rows={3}
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y transition-all"
            />
          </FormRow>
        </div>
      </FormSection>

      {enabled && (
        <StatusBanner kind="info">
          Speichere zuerst die Einstellungen, dann klicke <strong>Panel posten</strong>{' '}
          — der Bot postet ein Embed mit „Verifizieren"-Button in den Channel.
          Ein altes Panel wird vorher automatisch gelöscht.
        </StatusBanner>
      )}

      <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 bg-bg/80 backdrop-blur-sm border-t border-line flex items-center justify-between gap-2">
        <Button
          type="button"
          onClick={postPanel}
          loading={posting}
          disabled={!enabled || !channelId || !roleId}
          variant="secondary"
        >
          {initial.panelMessageId ? 'Panel neu posten' : 'Panel posten'}
        </Button>
        <Button type="submit" loading={pending} variant="primary">
          {pending ? 'Speichern…' : 'Speichern'}
        </Button>
      </div>
    </form>
  );
}
