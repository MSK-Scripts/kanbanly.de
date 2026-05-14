'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  sendBotEmbedComposed,
  saveEmbedTemplate,
  deleteEmbedTemplate,
  type EmbedTemplate,
  type EmbedV2,
  type MessagePayloadV2,
  type ComponentRow,
  type LinkButton,
} from '@/app/(app)/integrations/discord/[guildId]/actions';
import { toast } from '@/store/toastStore';
import { confirm } from '@/store/confirmStore';
import { Switch } from './Switch';
import { Button } from './ui/Button';
import { ColorPicker } from './ui/ColorPicker';
import { FormSection, FormRow } from './ui/FormSection';

type Role = { id: string; name: string; color: number };

type Props = {
  guildId: string;
  channels: { id: string; name: string }[];
  roles?: Role[];
  initialTemplates?: EmbedTemplate[];
};

function colorToHex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

function hexToColor(hex: string): number | null {
  if (!/^#?[0-9a-f]{6}$/i.test(hex)) return null;
  return parseInt(hex.replace('#', ''), 16);
}

function emptyEmbed(): EmbedV2 {
  return {
    color: 0x5865f2,
  };
}

function fromTemplate(tpl: EmbedTemplate): MessagePayloadV2 {
  if (tpl.payload) return tpl.payload;
  // Legacy v1 → v2
  return {
    embeds: [
      {
        title: tpl.title ?? undefined,
        description: tpl.description ?? undefined,
        color: tpl.color ?? undefined,
        footer: tpl.footer ? { text: tpl.footer } : undefined,
        image: tpl.imageUrl ?? undefined,
      },
    ],
  };
}

export function EmbedCreatorForm({ guildId, channels, initialTemplates = [] }: Props) {
  const [channelId, setChannelId] = useState('');
  const [content, setContent] = useState('');
  const [embeds, setEmbeds] = useState<EmbedV2[]>([emptyEmbed()]);
  const [componentRows, setComponentRows] = useState<ComponentRow[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [webhookMode, setWebhookMode] = useState(false);
  const [overrideUsername, setOverrideUsername] = useState('');
  const [overrideAvatarUrl, setOverrideAvatarUrl] = useState('');
  const [templates, setTemplates] = useState<EmbedTemplate[]>(initialTemplates);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [savingTpl, setSavingTpl] = useState(false);
  const [pending, startTransition] = useTransition();

  const currentPayload: MessagePayloadV2 = useMemo(
    () => ({
      content: content.trim() || undefined,
      embeds: embeds.length > 0 ? embeds : undefined,
    }),
    [content, embeds],
  );

  const updateEmbed = (idx: number, patch: Partial<EmbedV2>) => {
    setEmbeds((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    );
  };

  const addEmbed = () => {
    if (embeds.length >= 10) return;
    setEmbeds((prev) => [...prev, emptyEmbed()]);
  };

  const removeEmbed = (idx: number) => {
    setEmbeds((prev) => prev.filter((_, i) => i !== idx));
  };

  const duplicateEmbed = (idx: number) => {
    if (embeds.length >= 10) return;
    setEmbeds((prev) => {
      const copy = [...prev];
      copy.splice(idx + 1, 0, JSON.parse(JSON.stringify(prev[idx])) as EmbedV2);
      return copy;
    });
  };

  const loadTemplate = (tpl: EmbedTemplate) => {
    const p = fromTemplate(tpl);
    setContent(p.content ?? '');
    setEmbeds(p.embeds && p.embeds.length > 0 ? p.embeds : [emptyEmbed()]);
    setActiveTemplateId(tpl.id);
    setTemplateName(tpl.name);
    toast.info(`Vorlage „${tpl.name}" geladen`);
  };

  const newTemplate = () => {
    setContent('');
    setEmbeds([emptyEmbed()]);
    setActiveTemplateId(null);
    setTemplateName('');
  };

  const saveAs = async (asNew: boolean) => {
    const name = templateName.trim();
    if (!name) {
      toast.error('Name fehlt');
      return;
    }
    setSavingTpl(true);
    const r = await saveEmbedTemplate(guildId, {
      id: asNew ? undefined : activeTemplateId ?? undefined,
      name,
      payload: currentPayload,
    });
    setSavingTpl(false);
    if (r.ok && r.id) {
      const saved: EmbedTemplate = {
        id: r.id,
        name,
        payload: currentPayload,
        title: embeds[0]?.title ?? null,
        description: embeds[0]?.description ?? null,
        color: embeds[0]?.color ?? null,
        footer: embeds[0]?.footer?.text ?? null,
        imageUrl: embeds[0]?.image ?? null,
      };
      setTemplates((prev) => [saved, ...prev.filter((t) => t.id !== r.id)]);
      setActiveTemplateId(r.id);
      toast.success(asNew ? 'Als neue Vorlage gespeichert' : 'Vorlage aktualisiert');
    } else {
      toast.error('Fehler', r.error);
    }
  };

  const removeTemplate = async (tpl: EmbedTemplate) => {
    const ok = await confirm({
      title: 'Vorlage löschen?',
      description: `„${tpl.name}" wird endgültig entfernt.`,
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    const r = await deleteEmbedTemplate(guildId, tpl.id);
    if (r.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
      if (activeTemplateId === tpl.id) newTemplate();
      toast.success('Vorlage gelöscht');
    } else {
      toast.error('Fehler', r.error);
    }
  };

  const submit = () => {
    if (!channelId) {
      toast.error('Channel wählen');
      return;
    }
    const totalSize = files.reduce((acc, f) => acc + f.size, 0);
    if (totalSize > 25 * 1024 * 1024) {
      toast.error('Anhänge zusammen >25 MB');
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set('guildId', guildId);
      fd.set('channelId', channelId);
      fd.set(
        'payload',
        JSON.stringify({
          content: content.trim() || undefined,
          embeds: embeds.length > 0 ? embeds : undefined,
          components: componentRows.length > 0 ? componentRows : undefined,
          webhookMode,
          username: webhookMode ? overrideUsername : undefined,
          avatarUrl: webhookMode ? overrideAvatarUrl : undefined,
        }),
      );
      for (const f of files) {
        fd.append('files', f);
      }
      const r = await sendBotEmbedComposed(fd);
      if (r.ok) {
        toast.success('Nachricht gesendet');
        setFiles([]);
      } else {
        toast.error('Senden fehlgeschlagen', r.error);
      }
    });
  };

  void currentPayload; // wird gebraucht für saveAs unten

  const selectedChannel = channels.find((c) => c.id === channelId);

  return (
    <div className="space-y-5">
      {/* Templates-Bar */}
      <FormSection
        title="Vorlagen"
        description="Speichere komplette Nachrichten (Content + alle Embeds) als wiederverwendbare Vorlage."
      >
        {templates.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {templates.map((tpl) => {
              const active = tpl.id === activeTemplateId;
              return (
                <div
                  key={tpl.id}
                  className={`group inline-flex items-center gap-1 rounded-md border text-[12px] transition-all ${
                    active
                      ? 'bg-accent/15 border-accent text-fg'
                      : 'bg-elev border-line-strong text-fg-soft hover:border-fg-soft/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => loadTemplate(tpl)}
                    className="px-2.5 py-1 truncate max-w-[160px]"
                  >
                    {tpl.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTemplate(tpl)}
                    className="px-1.5 py-1 text-subtle hover:text-[var(--danger)] opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value.slice(0, 80))}
            placeholder="Name für die Vorlage…"
            className="flex-1 rounded-md bg-elev border border-line-strong px-2.5 py-1.5 text-[12.5px] text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
          />
          {activeTemplateId && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={savingTpl}
              onClick={() => saveAs(false)}
              disabled={!templateName.trim()}
            >
              Aktualisieren
            </Button>
          )}
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={savingTpl}
            onClick={() => saveAs(true)}
            disabled={!templateName.trim()}
          >
            {activeTemplateId ? 'Als neu' : 'Speichern'}
          </Button>
          {activeTemplateId && (
            <Button type="button" variant="ghost" size="sm" onClick={newTemplate}>
              + Neu
            </Button>
          )}
        </div>
      </FormSection>

      {/* Channel + Content */}
      <FormSection
        title="Nachricht"
        description="Channel + optionaler Plain-Text-Content über den Embeds."
      >
        <FormRow label="Channel" required>
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
          label="Content (optional)"
          hint="Plain-Text der über den Embeds erscheint. Markdown unterstützt."
        >
          <div className="relative">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 2000))}
              rows={3}
              placeholder="@here Achtung, neue Regeln!"
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y transition-all"
            />
            <span className="absolute right-2 bottom-2 text-[10px] text-subtle font-mono tabular-nums">
              {content.length}/2000
            </span>
          </div>
        </FormRow>
      </FormSection>

      {/* Embeds */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <div>
            <h3 className="text-[15px] font-semibold text-fg">
              Embeds <span className="text-subtle">({embeds.length}/10)</span>
            </h3>
            <p className="text-[12px] text-muted mt-0.5">
              Mehrere Embeds pro Nachricht möglich.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addEmbed}
            disabled={embeds.length >= 10}
          >
            + Embed
          </Button>
        </div>

        {embeds.map((embed, idx) => (
          <EmbedEditor
            key={idx}
            index={idx}
            embed={embed}
            onChange={(patch) => updateEmbed(idx, patch)}
            onRemove={() => removeEmbed(idx)}
            onDuplicate={() => duplicateEmbed(idx)}
            canDuplicate={embeds.length < 10}
          />
        ))}
      </div>

      {/* Components (Link-Buttons) */}
      <ComponentsEditor rows={componentRows} onChange={setComponentRows} />

      {/* Attachments */}
      <AttachmentsEditor files={files} onChange={setFiles} />

      {/* Send-Mode */}
      <FormSection
        title="Sende-Modus"
        description="Bot-Send oder Webhook. Webhook erlaubt Username & Avatar zu überschreiben."
      >
        <div className="flex items-center justify-between rounded-lg border border-line bg-elev/30 px-3.5 py-2.5">
          <div className="text-[12.5px] text-fg-soft">
            <span className="font-semibold text-fg">
              {webhookMode ? 'Per Webhook' : 'Als Bot'}
            </span>{' '}
            senden
          </div>
          <Switch checked={webhookMode} onChange={setWebhookMode} size="sm" />
        </div>
        {webhookMode && (
          <>
            <FormRow
              label="Username (überschreibt Bot-Namen)"
              hint='Pro Nachricht setzbar. Discord untersagt "Clyde" und "Discord" als Username.'
            >
              <input
                type="text"
                value={overrideUsername}
                onChange={(e) => setOverrideUsername(e.target.value.slice(0, 80))}
                placeholder="z.B. Server-Bot"
                className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </FormRow>
            <FormRow label="Avatar-URL (überschreibt Bot-Avatar)">
              <input
                type="url"
                value={overrideAvatarUrl}
                onChange={(e) => setOverrideAvatarUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </FormRow>
            <p className="text-[11px] text-subtle">
              Beim ersten Send erstellt der Bot automatisch einen Webhook im Channel.
              Bot braucht <strong>Webhooks verwalten</strong>-Permission.
            </p>
          </>
        )}
      </FormSection>

      {/* Preview */}
      <FormSection title="Vorschau" description={`Sendet an: ${selectedChannel ? '#' + selectedChannel.name : 'kein Channel'}`}>
        <DiscordPreview content={content} embeds={embeds} />
      </FormSection>

      {/* Send */}
      <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 bg-bg/80 backdrop-blur-sm border-t border-line flex justify-end">
        <Button
          type="button"
          onClick={submit}
          loading={pending}
          variant="primary"
          disabled={!channelId}
        >
          {pending ? 'Sende…' : 'Senden'}
        </Button>
      </div>
    </div>
  );
}

// ============== Einzelner Embed-Editor ==============

function EmbedEditor({
  index,
  embed,
  onChange,
  onRemove,
  onDuplicate,
  canDuplicate,
}: {
  index: number;
  embed: EmbedV2;
  onChange: (patch: Partial<EmbedV2>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  canDuplicate: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [sections, setSections] = useState({
    author: Boolean(embed.author?.name),
    body: true,
    images: Boolean(embed.image || embed.thumbnail),
    footer: Boolean(embed.footer?.text || embed.timestamp),
    fields: Boolean(embed.fields && embed.fields.length > 0),
  });

  const color = embed.color ?? 0x5865f2;

  return (
    <div
      className="rounded-xl border border-line bg-surface overflow-hidden"
      style={{ borderLeft: `4px solid ${colorToHex(color)}` }}
    >
      <div
        className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-line bg-elev/30 cursor-pointer"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] text-subtle font-mono">
            Embed {index + 1}
          </span>
          {embed.title && (
            <span className="text-[13px] font-semibold text-fg truncate max-w-[300px]">
              · {embed.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onDuplicate}
            disabled={!canDuplicate}
          >
            Duplizieren
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
            Entfernen
          </Button>
        </div>
      </div>

      {open && (
        <div className="px-4 py-3 space-y-3">
          {/* Author */}
          <CollapsibleSection
            title="Author"
            open={sections.author}
            onToggle={() => setSections((s) => ({ ...s, author: !s.author }))}
          >
            <FormRow label="Name (0-256)">
              <input
                type="text"
                value={embed.author?.name ?? ''}
                onChange={(e) =>
                  onChange({
                    author: { ...embed.author, name: e.target.value.slice(0, 256) },
                  })
                }
                className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </FormRow>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="URL">
                <input
                  type="url"
                  value={embed.author?.url ?? ''}
                  onChange={(e) =>
                    onChange({
                      author: {
                        name: embed.author?.name ?? '',
                        ...embed.author,
                        url: e.target.value || undefined,
                      },
                    })
                  }
                  className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                />
              </FormRow>
              <FormRow label="Icon-URL">
                <input
                  type="url"
                  value={embed.author?.icon_url ?? ''}
                  onChange={(e) =>
                    onChange({
                      author: {
                        name: embed.author?.name ?? '',
                        ...embed.author,
                        icon_url: e.target.value || undefined,
                      },
                    })
                  }
                  className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                />
              </FormRow>
            </div>
          </CollapsibleSection>

          {/* Body */}
          <CollapsibleSection
            title="Body"
            open={sections.body}
            onToggle={() => setSections((s) => ({ ...s, body: !s.body }))}
          >
            <FormRow label="Titel (0-256)">
              <input
                type="text"
                value={embed.title ?? ''}
                onChange={(e) => onChange({ title: e.target.value.slice(0, 256) })}
                className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </FormRow>
            <FormRow label="Titel-URL">
              <input
                type="url"
                value={embed.title_url ?? ''}
                onChange={(e) => onChange({ title_url: e.target.value || undefined })}
                className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </FormRow>
            <FormRow label="Description (0-4000)">
              <div className="relative">
                <textarea
                  value={embed.description ?? ''}
                  onChange={(e) =>
                    onChange({ description: e.target.value.slice(0, 4000) })
                  }
                  rows={5}
                  className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y transition-all"
                />
                <span className="absolute right-2 bottom-2 text-[10px] text-subtle font-mono tabular-nums">
                  {(embed.description ?? '').length}/4000
                </span>
              </div>
            </FormRow>
            <FormRow label="Farbe">
              <ColorPicker
                value={colorToHex(color)}
                onChange={(v) => {
                  const n = hexToColor(v);
                  if (n !== null) onChange({ color: n });
                }}
              />
            </FormRow>
          </CollapsibleSection>

          {/* Images */}
          <CollapsibleSection
            title="Bilder"
            open={sections.images}
            onToggle={() => setSections((s) => ({ ...s, images: !s.images }))}
          >
            <FormRow label="Image-URL">
              <input
                type="url"
                value={embed.image ?? ''}
                onChange={(e) => onChange({ image: e.target.value || undefined })}
                placeholder="https://…"
                className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </FormRow>
            <FormRow label="Thumbnail-URL">
              <input
                type="url"
                value={embed.thumbnail ?? ''}
                onChange={(e) =>
                  onChange({ thumbnail: e.target.value || undefined })
                }
                placeholder="https://…"
                className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </FormRow>
          </CollapsibleSection>

          {/* Footer */}
          <CollapsibleSection
            title="Footer"
            open={sections.footer}
            onToggle={() => setSections((s) => ({ ...s, footer: !s.footer }))}
          >
            <FormRow label="Footer-Text (0-2048)">
              <input
                type="text"
                value={embed.footer?.text ?? ''}
                onChange={(e) =>
                  onChange({
                    footer: { ...embed.footer, text: e.target.value.slice(0, 2048) },
                  })
                }
                className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </FormRow>
            <FormRow label="Footer-Icon-URL">
              <input
                type="url"
                value={embed.footer?.icon_url ?? ''}
                onChange={(e) =>
                  onChange({
                    footer: {
                      text: embed.footer?.text ?? '',
                      ...embed.footer,
                      icon_url: e.target.value || undefined,
                    },
                  })
                }
                className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </FormRow>
            <label className="flex items-center gap-2 text-[13px] text-fg-soft cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(embed.timestamp)}
                onChange={(e) => onChange({ timestamp: e.target.checked })}
                className="h-4 w-4 accent-accent"
              />
              Timestamp (jetzt) anzeigen
            </label>
          </CollapsibleSection>

          {/* Fields */}
          <CollapsibleSection
            title={`Fields (${(embed.fields ?? []).length}/25)`}
            open={sections.fields}
            onToggle={() => setSections((s) => ({ ...s, fields: !s.fields }))}
          >
            <FieldsEditor
              fields={embed.fields ?? []}
              onChange={(fields) => onChange({ fields })}
            />
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-elev/30">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-elev/50 transition-colors"
      >
        <span className="text-[12.5px] font-semibold text-fg">{title}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-3.5 w-3.5 text-subtle transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <div className="px-3 py-3 border-t border-line/60 space-y-3">{children}</div>}
    </div>
  );
}

function FieldsEditor({
  fields,
  onChange,
}: {
  fields: NonNullable<EmbedV2['fields']>;
  onChange: (next: NonNullable<EmbedV2['fields']>) => void;
}) {
  const add = () => {
    if (fields.length >= 25) return;
    onChange([...fields, { name: '', value: '', inline: false }]);
  };
  const update = (idx: number, patch: Partial<EmbedV2['fields'] extends Array<infer T> | undefined ? T : never>) => {
    onChange(fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };
  const remove = (idx: number) => {
    onChange(fields.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      {fields.map((field, idx) => (
        <div
          key={idx}
          className="rounded-md border border-line bg-surface p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-subtle font-mono">Field {idx + 1}</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => remove(idx)}>
              ×
            </Button>
          </div>
          <div className="grid grid-cols-[1fr_64px] gap-2">
            <input
              type="text"
              value={field.name}
              onChange={(e) => update(idx, { name: e.target.value.slice(0, 256) })}
              placeholder="Name"
              className="rounded-md bg-elev border border-line-strong px-2.5 py-1.5 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
            <label className="flex items-center justify-center gap-1.5 rounded-md border border-line-strong bg-elev text-[11px] text-fg-soft cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(field.inline)}
                onChange={(e) => update(idx, { inline: e.target.checked })}
                className="h-3.5 w-3.5 accent-accent"
              />
              Inline
            </label>
          </div>
          <textarea
            value={field.value}
            onChange={(e) => update(idx, { value: e.target.value.slice(0, 1024) })}
            placeholder="Value"
            rows={2}
            className="w-full rounded-md bg-elev border border-line-strong px-2.5 py-1.5 text-sm text-fg placeholder:text-subtle font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y transition-all"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        disabled={fields.length >= 25}
        className="w-full rounded-md border border-dashed border-line-strong hover:border-accent hover:bg-elev/30 py-2 text-[12px] text-muted hover:text-fg transition-colors disabled:opacity-50"
      >
        + Field hinzufügen ({fields.length}/25)
      </button>
    </div>
  );
}

// ============== Discord-Preview ==============

function renderInlineMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-elev px-1 text-[0.85em]">$1</code>')
    .replace(/\n/g, '<br>');
}

// ============== Components-Editor (Link-Buttons in ActionRows) ==============

const BUTTON_STYLE_CLASSES: Record<NonNullable<LinkButton['style']>, string> = {
  primary: 'bg-[#5865F2] text-white',
  secondary: 'bg-[#4E5058] text-white',
  success: 'bg-[#248046] text-white',
  danger: 'bg-[#DA373C] text-white',
  link: 'bg-[#4E5058] text-white',
};

function ComponentsEditor({
  rows,
  onChange,
}: {
  rows: ComponentRow[];
  onChange: (next: ComponentRow[]) => void;
}) {
  const totalButtons = rows.reduce((acc, r) => acc + r.buttons.length, 0);

  const addRow = () => {
    if (rows.length >= 5) return;
    onChange([...rows, { buttons: [] }]);
  };
  const removeRow = (i: number) =>
    onChange(rows.filter((_, idx) => idx !== i));

  const addButton = (rowIdx: number) => {
    const row = rows[rowIdx];
    if (row.buttons.length >= 5) return;
    const next = [...rows];
    next[rowIdx] = {
      buttons: [...row.buttons, { label: 'Klick', url: '', style: 'link' }],
    };
    onChange(next);
  };

  const updateButton = (
    rowIdx: number,
    btnIdx: number,
    patch: Partial<LinkButton>,
  ) => {
    const next = [...rows];
    next[rowIdx] = {
      buttons: rows[rowIdx].buttons.map((b, i) =>
        i === btnIdx ? { ...b, ...patch } : b,
      ),
    };
    onChange(next);
  };

  const removeButton = (rowIdx: number, btnIdx: number) => {
    const next = [...rows];
    next[rowIdx] = {
      buttons: rows[rowIdx].buttons.filter((_, i) => i !== btnIdx),
    };
    onChange(next);
  };

  return (
    <FormSection
      title={`Buttons / Components (${totalButtons}/25)`}
      description="Link-Buttons unter der Nachricht. Max 5 Reihen × 5 Buttons = 25. Aktuell nur URL-Buttons unterstützt."
    >
      {rows.length === 0 ? (
        <div className="text-[12.5px] text-subtle text-center py-2">
          Keine Buttons.
        </div>
      ) : (
        rows.map((row, rowIdx) => (
          <div
            key={rowIdx}
            className="rounded-lg border border-line bg-elev/30 p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-subtle font-mono">
                Reihe {rowIdx + 1} · {row.buttons.length}/5 Buttons
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => removeRow(rowIdx)}
              >
                Reihe entfernen
              </Button>
            </div>
            {row.buttons.map((btn, btnIdx) => (
              <div
                key={btnIdx}
                className="rounded-md border border-line bg-surface p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-subtle font-mono">
                    Button {btnIdx + 1}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeButton(rowIdx, btnIdx)}
                  >
                    ×
                  </Button>
                </div>
                <div className="grid grid-cols-[1fr_140px] gap-2">
                  <input
                    type="text"
                    value={btn.label}
                    onChange={(e) =>
                      updateButton(rowIdx, btnIdx, {
                        label: e.target.value.slice(0, 80),
                      })
                    }
                    placeholder="Label"
                    className="rounded-md bg-elev border border-line-strong px-2.5 py-1.5 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                  />
                  <input
                    type="text"
                    value={btn.emoji ?? ''}
                    onChange={(e) =>
                      updateButton(rowIdx, btnIdx, {
                        emoji: e.target.value.slice(0, 80) || undefined,
                      })
                    }
                    placeholder="Emoji (opt)"
                    className="rounded-md bg-elev border border-line-strong px-2.5 py-1.5 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                  />
                </div>
                <input
                  type="url"
                  value={btn.url}
                  onChange={(e) => updateButton(rowIdx, btnIdx, { url: e.target.value })}
                  placeholder="https://example.com"
                  className="w-full rounded-md bg-elev border border-line-strong px-2.5 py-1.5 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => addButton(rowIdx)}
              disabled={row.buttons.length >= 5}
              className="w-full rounded-md border border-dashed border-line-strong hover:border-accent hover:bg-elev/30 py-1.5 text-[12px] text-muted hover:text-fg transition-colors disabled:opacity-50"
            >
              + Button in dieser Reihe
            </button>
          </div>
        ))
      )}
      <button
        type="button"
        onClick={addRow}
        disabled={rows.length >= 5}
        className="w-full rounded-md border border-dashed border-line-strong hover:border-accent hover:bg-elev/30 py-2 text-[12px] text-muted hover:text-fg transition-colors disabled:opacity-50"
      >
        + Neue Button-Reihe ({rows.length}/5)
      </button>
    </FormSection>
  );
}

// ============== Attachments-Editor (Datei-Upload) ==============

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentsEditor({
  files,
  onChange,
}: {
  files: File[];
  onChange: (next: File[]) => void;
}) {
  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  const over = totalSize > 25 * 1024 * 1024;

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const merged = [...files, ...selected].slice(0, 10);
    onChange(merged);
    // Reset für nochmaliges Hochladen derselben Datei
    e.target.value = '';
  };

  const remove = (i: number) => {
    onChange(files.filter((_, idx) => idx !== i));
  };

  return (
    <FormSection
      title={`Attachments (${files.length}/10 · ${formatBytes(totalSize)} / 25 MB)`}
      description="Bilder, Videos, Dokumente — direkt vom Rechner."
    >
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2 text-[12.5px]"
            >
              <div className="min-w-0 flex-1">
                <div className="text-fg truncate">{f.name}</div>
                <div className="text-[10.5px] text-subtle font-mono">
                  {f.type || 'unknown'} · {formatBytes(f.size)}
                </div>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)}>
                ×
              </Button>
            </li>
          ))}
        </ul>
      )}
      {over && (
        <div className="text-[12px] text-[var(--danger)]">
          Anhänge sind zusammen über 25 MB — Discord wird das ablehnen.
        </div>
      )}
      <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border border-dashed border-line-strong hover:border-accent hover:bg-elev/30 px-4 py-2 text-[12.5px] text-muted hover:text-fg transition-colors">
        <input
          type="file"
          multiple
          onChange={onPick}
          disabled={files.length >= 10}
          className="hidden"
        />
        Datei{files.length === 0 ? '' : 'en'} hinzufügen
      </label>
    </FormSection>
  );
}

function DiscordPreview({
  content,
  embeds,
}: {
  content: string;
  embeds: EmbedV2[];
}) {
  return (
    <div className="rounded-lg border border-line bg-elev/30 p-4">
      <div className="flex gap-2.5">
        <div className="h-8 w-8 rounded-full bg-accent/20 grid place-items-center text-[11px] font-semibold text-accent shrink-0">
          B
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-accent">Bot</span>
            <span className="rounded bg-accent/20 px-1 text-[9px] font-semibold text-accent uppercase tracking-wide">
              BOT
            </span>
            <span className="text-[10px] text-subtle">jetzt</span>
          </div>
          {content && (
            <div
              className="text-sm text-fg-soft break-words"
              dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(content) }}
            />
          )}
          {embeds.map((e, i) => (
            <EmbedPreview key={i} embed={e} />
          ))}
        </div>
      </div>
    </div>
  );
}

function EmbedPreview({ embed }: { embed: EmbedV2 }) {
  const color = colorToHex(embed.color ?? 0x5865f2);
  return (
    <div
      className="rounded border-l-4 bg-elev px-3.5 py-2.5 max-w-[500px]"
      style={{ borderLeftColor: color }}
    >
      {embed.author?.name && (
        <div className="flex items-center gap-1.5 mb-1.5">
          {embed.author.icon_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={embed.author.icon_url}
              alt=""
              className="h-5 w-5 rounded-full"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <span className="text-[12px] text-fg font-medium">{embed.author.name}</span>
        </div>
      )}
      <div className="flex gap-2.5">
        <div className="min-w-0 flex-1">
          {embed.title && (
            <div className="text-[14px] font-semibold text-fg mb-1 break-words">
              {embed.title_url ? (
                <span className="text-[var(--info)] underline">{embed.title}</span>
              ) : (
                embed.title
              )}
            </div>
          )}
          {embed.description && (
            <div
              className="text-[12.5px] text-fg-soft whitespace-pre-wrap break-words"
              dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(embed.description) }}
            />
          )}
          {embed.fields && embed.fields.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {embed.fields.map((f, i) => (
                <div
                  key={i}
                  className={f.inline ? 'col-span-1' : 'col-span-3'}
                >
                  <div className="text-[11.5px] font-semibold text-fg">{f.name}</div>
                  <div className="text-[12px] text-fg-soft whitespace-pre-wrap">
                    {f.value}
                  </div>
                </div>
              ))}
            </div>
          )}
          {embed.image && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={embed.image}
              alt=""
              className="mt-2 max-h-48 rounded object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
        </div>
        {embed.thumbnail && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={embed.thumbnail}
            alt=""
            className="h-16 w-16 rounded object-cover shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
      </div>
      {(embed.footer?.text || embed.timestamp) && (
        <div className="flex items-center gap-1.5 mt-2 pt-1">
          {embed.footer?.icon_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={embed.footer.icon_url}
              alt=""
              className="h-4 w-4 rounded-full"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <span className="text-[10.5px] text-subtle">
            {embed.footer?.text}
            {embed.footer?.text && embed.timestamp && ' · '}
            {embed.timestamp && 'jetzt'}
          </span>
        </div>
      )}
    </div>
  );
}
