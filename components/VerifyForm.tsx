'use client';

import { useState, useTransition } from 'react';
import {
  updateVerifyConfig,
  postVerifyPanel,
} from '@/app/(app)/integrations/discord/[guildId]/actions';
import { toast } from '@/store/toastStore';
import { Switch } from './Switch';
import { Button } from './ui/Button';
import { ColorPicker } from './ui/ColorPicker';
import { FormSection, FormRow } from './ui/FormSection';
import { StatusPill, StatusBanner } from './ui/Status';

type ButtonStyle = 'primary' | 'secondary' | 'success' | 'danger';

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
    panelTitle: string | null;
    panelColor: number | null;
    buttonLabel: string | null;
    buttonEmoji: string | null;
    buttonStyle: ButtonStyle;
    replySuccess: string | null;
    replyAlready: string | null;
  };
};

const DEFAULT_MESSAGE =
  'Willkommen! Klick auf den Button unten, um dich zu verifizieren und Zugriff auf den Server zu bekommen.';

const BUTTON_STYLES: Array<{
  value: ButtonStyle;
  label: string;
  classes: string;
}> = [
  { value: 'primary', label: 'Blurple', classes: 'bg-[#5865F2] text-white' },
  { value: 'secondary', label: 'Grau', classes: 'bg-[#4E5058] text-white' },
  { value: 'success', label: 'Grün', classes: 'bg-[#248046] text-white' },
  { value: 'danger', label: 'Rot', classes: 'bg-[#DA373C] text-white' },
];

export function VerifyForm({ guildId, channels, roles, initial }: Props) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [channelId, setChannelId] = useState(initial.channelId ?? '');
  const [roleId, setRoleId] = useState(initial.roleId ?? '');
  const [message, setMessage] = useState(initial.message ?? DEFAULT_MESSAGE);
  const [panelTitle, setPanelTitle] = useState(
    initial.panelTitle ?? 'Verifizierung',
  );
  const [panelColor, setPanelColor] = useState(
    initial.panelColor !== null
      ? '#' + initial.panelColor.toString(16).padStart(6, '0')
      : '#5865F2',
  );
  const [buttonLabel, setButtonLabel] = useState(
    initial.buttonLabel ?? 'Verifizieren',
  );
  const [buttonEmoji, setButtonEmoji] = useState(initial.buttonEmoji ?? '✅');
  const [buttonStyle, setButtonStyle] = useState<ButtonStyle>(
    initial.buttonStyle ?? 'primary',
  );
  const [replySuccess, setReplySuccess] = useState(
    initial.replySuccess ?? '✓ Verifiziert — willkommen auf {server}!',
  );
  const [replyAlready, setReplyAlready] = useState(
    initial.replyAlready ?? '✓ Du bist bereits verifiziert.',
  );
  const [pending, startTransition] = useTransition();
  const [posting, setPosting] = useState(false);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData();
    if (enabled) fd.set('enabled', 'on');
    fd.set('channel_id', channelId);
    fd.set('role_id', roleId);
    fd.set('message', message);
    fd.set('panel_title', panelTitle);
    fd.set('panel_color', panelColor);
    fd.set('button_label', buttonLabel);
    fd.set('button_emoji', buttonEmoji);
    fd.set('button_style', buttonStyle);
    fd.set('reply_success', replySuccess);
    fd.set('reply_already', replyAlready);
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

  const activeStyle = BUTTON_STYLES.find((s) => s.value === buttonStyle)!;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormSection
        title="Verifizierung"
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
        <div
          className={
            enabled ? 'space-y-4' : 'space-y-4 opacity-50 pointer-events-none'
          }
        >
          <FormRow
            label="Verify-Channel"
            hint="Der Channel, in dem das Button-Panel erscheint."
            required
          >
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
            hint="Wird nach Button-Klick vergeben. Bot-Rolle muss in der Hierarchie darüber stehen."
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
        </div>
      </FormSection>

      <FormSection
        title="Panel-Design"
        description="So sieht das Embed mit dem Verify-Button im Channel aus. Live-Vorschau unten."
      >
        <div
          className={
            enabled ? 'space-y-4' : 'space-y-4 opacity-50 pointer-events-none'
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormRow label="Titel">
              <input
                type="text"
                value={panelTitle}
                onChange={(e) => setPanelTitle(e.target.value.slice(0, 256))}
                placeholder="Verifizierung"
                className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </FormRow>
            <FormRow label="Embed-Farbe">
              <ColorPicker value={panelColor} onChange={setPanelColor} />
            </FormRow>
          </div>

          <FormRow label="Beschreibung" hint="Erscheint über dem Button.">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
              rows={3}
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y transition-all"
            />
          </FormRow>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormRow label="Button-Label">
              <input
                type="text"
                value={buttonLabel}
                onChange={(e) => setButtonLabel(e.target.value.slice(0, 80))}
                placeholder="Verifizieren"
                className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </FormRow>
            <FormRow
              label="Button-Emoji (optional)"
              hint="Unicode (✅) oder <:name:id> Custom"
            >
              <input
                type="text"
                value={buttonEmoji}
                onChange={(e) => setButtonEmoji(e.target.value.slice(0, 80))}
                placeholder="✅"
                className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </FormRow>
          </div>

          <FormRow label="Button-Farbe">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {BUTTON_STYLES.map((s) => {
                const active = buttonStyle === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setButtonStyle(s.value)}
                    className={`text-left rounded-lg border p-2.5 transition-all ${
                      active
                        ? 'border-accent bg-accent/10'
                        : 'border-line bg-surface hover:border-line-strong'
                    }`}
                  >
                    <div
                      className={`inline-block px-2.5 py-1 rounded text-[11px] font-semibold ${s.classes}`}
                    >
                      {buttonLabel || 'Button'}
                    </div>
                    <div className="text-[11px] text-muted mt-1">{s.label}</div>
                  </button>
                );
              })}
            </div>
          </FormRow>

          {/* Vorschau */}
          <div>
            <div className="text-[11.5px] font-medium text-muted mb-1.5">
              Vorschau
            </div>
            <div className="rounded-lg border border-line bg-elev/30 p-4">
              <div
                className="rounded border-l-4 bg-elev px-3.5 py-2.5"
                style={{ borderLeftColor: panelColor }}
              >
                {panelTitle && (
                  <div className="text-sm font-semibold text-fg mb-1.5 break-words">
                    {panelTitle}
                  </div>
                )}
                <div className="text-[13px] text-fg-soft whitespace-pre-wrap break-words">
                  {message}
                </div>
                <div className="mt-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[12.5px] font-semibold ${activeStyle.classes}`}
                  >
                    {buttonEmoji && <span>{buttonEmoji}</span>}
                    {buttonLabel || 'Verifizieren'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Antwort-Nachrichten"
        description="Die ephemeralen Nachrichten, die der User nach einem Klick sieht (nur für ihn sichtbar)."
      >
        <div
          className={
            enabled ? 'space-y-4' : 'space-y-4 opacity-50 pointer-events-none'
          }
        >
          <FormRow
            label="Erfolg"
            hint="Wird nach erfolgreicher Verifizierung angezeigt."
          >
            <textarea
              value={replySuccess}
              onChange={(e) => setReplySuccess(e.target.value.slice(0, 500))}
              rows={2}
              placeholder="✓ Verifiziert — willkommen!"
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y transition-all"
            />
          </FormRow>

          <FormRow
            label="Bereits verifiziert"
            hint="Wird angezeigt, wenn der User schon die Rolle hat."
          >
            <textarea
              value={replyAlready}
              onChange={(e) => setReplyAlready(e.target.value.slice(0, 500))}
              rows={2}
              placeholder="✓ Du bist bereits verifiziert."
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y transition-all"
            />
          </FormRow>

          <div className="text-[11px] text-subtle">
            Platzhalter: <code>{'{user}'}</code> <code>{'{mention}'}</code>{' '}
            <code>{'{server}'}</code>
          </div>
        </div>
      </FormSection>

      {enabled && (
        <StatusBanner kind="info">
          Speichere zuerst die Einstellungen, dann klicke <strong>Panel posten</strong>{' '}
          — der Bot postet das Embed mit Button. Ein altes Panel wird automatisch
          gelöscht.
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
