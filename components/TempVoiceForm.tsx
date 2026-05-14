'use client';

import { useState, useTransition } from 'react';
import { updateTempVoiceConfig } from '@/app/(app)/integrations/discord/[guildId]/actions';
import { toast } from '@/store/toastStore';
import { Switch } from './Switch';
import { Button } from './ui/Button';
import { FormSection, FormRow } from './ui/FormSection';
import { StatusPill, StatusBanner } from './ui/Status';

type Props = {
  guildId: string;
  initial: {
    enabled: boolean;
    creatorChannelId: string | null;
    categoryId: string | null;
    nameTemplate: string | null;
    defaultLimit: number;
  };
};

export function TempVoiceForm({ guildId, initial }: Props) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [creatorChannelId, setCreatorChannelId] = useState(initial.creatorChannelId ?? '');
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? '');
  const [nameTemplate, setNameTemplate] = useState(
    initial.nameTemplate ?? "🔊 {user}'s Channel",
  );
  const [defaultLimit, setDefaultLimit] = useState(initial.defaultLimit);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData();
    if (enabled) fd.set('enabled', 'on');
    fd.set('creator_channel_id', creatorChannelId);
    fd.set('category_id', categoryId);
    fd.set('name_template', nameTemplate);
    fd.set('default_limit', String(defaultLimit));
    startTransition(async () => {
      const r = await updateTempVoiceConfig(guildId, fd);
      if (r.ok) toast.success('Temp-Voice gespeichert');
      else toast.error('Fehler', r.error);
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <FormSection
        title="Temp-Voice-Channels"
        description="User joint einen 'Creator'-Voice-Channel → der Bot erstellt automatisch einen persönlichen Voice-Channel und verschiebt den User dorthin. Empty-Channels werden automatisch gelöscht."
        badge={
          <StatusPill kind={enabled ? 'success' : 'neutral'} dot>
            {enabled ? 'Aktiv' : 'Aus'}
          </StatusPill>
        }
        action={<Switch checked={enabled} onChange={setEnabled} />}
      >
        <div className={enabled ? 'space-y-4' : 'space-y-4 opacity-50 pointer-events-none'}>
          <FormRow
            label="Creator-Channel-ID"
            hint="Die Voice-Channel-ID, bei deren Join der Temp-Channel erstellt wird. Rechtsklick auf Channel → ID kopieren (Discord-Developer-Mode an)."
            required
          >
            <input
              type="text"
              value={creatorChannelId}
              onChange={(e) => setCreatorChannelId(e.target.value.trim())}
              placeholder="123456789012345678"
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
          </FormRow>

          <FormRow
            label="Category-ID (optional)"
            hint="Wenn gesetzt: Temp-Channels werden in dieser Kategorie angelegt. Sonst auf gleicher Ebene wie Creator."
          >
            <input
              type="text"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value.trim())}
              placeholder="123456789012345678"
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
          </FormRow>

          <FormRow
            label="Channel-Name-Template"
            hint="{user} wird durch den Benutzernamen ersetzt"
          >
            <input
              type="text"
              value={nameTemplate}
              onChange={(e) => setNameTemplate(e.target.value.slice(0, 100))}
              placeholder="🔊 {user}'s Channel"
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
          </FormRow>

          <FormRow
            label="Standard-User-Limit"
            hint="0 = kein Limit, max 99. Owner kann's später ändern."
          >
            <input
              type="number"
              min={0}
              max={99}
              value={defaultLimit}
              onChange={(e) => setDefaultLimit(parseInt(e.target.value, 10) || 0)}
              className="w-32 rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
          </FormRow>
        </div>
      </FormSection>

      <StatusBanner kind="info">
        Der Bot braucht die Permissions <strong>Channels verwalten</strong> und{' '}
        <strong>Mitglieder verschieben</strong>. Der Owner des Temp-Channels bekommt
        automatisch Manage-Channels, Move/Mute/Deafen-Members für seinen eigenen Channel.
      </StatusBanner>

      <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 bg-bg/80 backdrop-blur-sm border-t border-line flex justify-end">
        <Button type="submit" loading={pending} variant="primary">
          {pending ? 'Speichern…' : 'Speichern'}
        </Button>
      </div>
    </form>
  );
}
