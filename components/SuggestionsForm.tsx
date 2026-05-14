'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import { updateSuggestionsConfig } from '@/app/(app)/integrations/discord/[guildId]/actions';
import { toast } from '@/store/toastStore';
import { Switch } from './Switch';
import { Button } from './ui/Button';
import { FormSection, FormRow } from './ui/FormSection';
import { StatusPill } from './ui/Status';
import { ColorPicker } from './ui/ColorPicker';

type Channel = { id: string; name: string };
type Role = { id: string; name: string; color: number };

type FieldKey = 'id' | 'status' | 'upvotes' | 'downvotes' | 'banner';

const ALL_FIELD_KEYS: FieldKey[] = ['id', 'status', 'upvotes', 'downvotes', 'banner'];

const FIELD_META: Record<FieldKey, { label: string; openOnly?: boolean; endedOnly?: boolean }> = {
  id: { label: 'ID' },
  status: { label: 'Status' },
  upvotes: { label: 'Upvotes (nur wenn beendet)', endedOnly: true },
  downvotes: { label: 'Downvotes (nur wenn beendet)', endedOnly: true },
  banner: { label: 'Banner' },
};

function intToHex(n: number): string {
  return `#${(n & 0xffffff).toString(16).padStart(6, '0').toUpperCase()}`;
}

function normalizeFieldOrder(raw: FieldKey[]): FieldKey[] {
  const seen = new Set<FieldKey>();
  const out: FieldKey[] = [];
  for (const k of raw) {
    if (ALL_FIELD_KEYS.includes(k) && !seen.has(k)) {
      out.push(k);
      seen.add(k);
    }
  }
  for (const k of ALL_FIELD_KEYS) if (!seen.has(k)) out.push(k);
  return out;
}

type SuggestionsInitial = {
  enabled: boolean;
  channelId: string | null;
  modRoleId: string | null;
  embedTitle: string;
  embedMessage: string;
  embedColor: number;
  footerText: string | null;
  bannerUrl: string | null;
  thumbnailUrl: string | null;
  upvoteEmoji: string | null;
  downvoteEmoji: string | null;
  statusOpenEmoji: string | null;
  statusEndedEmoji: string | null;
  allowedRoleIds: string[];
  endMessage: string;
  fieldOrder: FieldKey[];
};

export function SuggestionsForm({
  guildId,
  channels,
  roles,
  initial,
  list,
}: {
  guildId: string;
  channels: Channel[];
  roles: Role[];
  initial: SuggestionsInitial;
  list: Array<{
    id: string;
    userId: string;
    content: string;
    status: 'open' | 'approved' | 'rejected' | 'implemented';
    upvotes: number;
    downvotes: number;
    createdAt: string;
  }>;
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [channelId, setChannelId] = useState(initial.channelId ?? '');
  const [embedTitle, setEmbedTitle] = useState(initial.embedTitle);
  const [embedMessage, setEmbedMessage] = useState(initial.embedMessage);
  const [embedColor, setEmbedColor] = useState(intToHex(initial.embedColor));
  const [footerText, setFooterText] = useState(initial.footerText ?? '');
  const [bannerUrl, setBannerUrl] = useState(initial.bannerUrl ?? '');
  const [thumbnailUrl, setThumbnailUrl] = useState(initial.thumbnailUrl ?? '');
  const [upvoteEmoji, setUpvoteEmoji] = useState(initial.upvoteEmoji ?? '');
  const [downvoteEmoji, setDownvoteEmoji] = useState(initial.downvoteEmoji ?? '');
  const [statusOpenEmoji, setStatusOpenEmoji] = useState(initial.statusOpenEmoji ?? '');
  const [statusEndedEmoji, setStatusEndedEmoji] = useState(initial.statusEndedEmoji ?? '');
  const [allowedRoleIds, setAllowedRoleIds] = useState<string[]>(initial.allowedRoleIds);
  const [endMessage, setEndMessage] = useState(initial.endMessage);
  const [fieldOrder, setFieldOrder] = useState<FieldKey[]>(
    normalizeFieldOrder(initial.fieldOrder),
  );
  const [previewEnded, setPreviewEnded] = useState(false);
  const [pending, startTransition] = useTransition();

  const rolesById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const availableRoles = useMemo(
    () => roles.filter((r) => !allowedRoleIds.includes(r.id)),
    [roles, allowedRoleIds],
  );

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const next = Array.from(fieldOrder);
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    setFieldOrder(next);
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (enabled && !channelId) {
      toast.error('Vorschlags-Channel nötig');
      return;
    }
    const fd = new FormData();
    if (enabled) fd.set('enabled', 'on');
    fd.set('channel_id', channelId);
    fd.set('mod_role_id', '');
    fd.set('embed_title', embedTitle);
    fd.set('embed_message', embedMessage);
    fd.set('embed_color', embedColor);
    fd.set('footer_text', footerText);
    fd.set('banner_url', bannerUrl);
    fd.set('thumbnail_url', thumbnailUrl);
    fd.set('upvote_emoji', upvoteEmoji);
    fd.set('downvote_emoji', downvoteEmoji);
    fd.set('status_open_emoji', statusOpenEmoji);
    fd.set('status_ended_emoji', statusEndedEmoji);
    fd.set('end_message', endMessage);
    fd.set('allowed_role_ids', allowedRoleIds.join(','));
    fd.set('field_order', fieldOrder.join(','));
    startTransition(async () => {
      const r = await updateSuggestionsConfig(guildId, fd);
      if (r.ok) toast.success('Vorschläge gespeichert');
      else toast.error('Fehler', r.error);
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_minmax(0,420px)] gap-5">
        {/* === LEFT: CONFIG === */}
        <div className="space-y-5 min-w-0">
          <FormSection
            title="Vorschlags-System"
            description="Passe die Einstellungen für dieses Modul an."
            badge={
              <StatusPill kind={enabled ? 'success' : 'neutral'} dot>
                {enabled ? 'Aktiv' : 'Aus'}
              </StatusPill>
            }
            action={<Switch checked={enabled} onChange={setEnabled} />}
          >
            <div className={enabled ? 'space-y-4' : 'space-y-4 opacity-50 pointer-events-none'}>
              <FormRow label="Vorschlags-Channel" hint="Kanal in dem Vorschläge gepostet werden" required>
                <select
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
                >
                  <option value="">— Channel wählen —</option>
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>#{c.name}</option>
                  ))}
                </select>
              </FormRow>

              <FormRow label="Embed-Titel" hint="Titel des Vorschlags-Embeds">
                <input
                  type="text"
                  value={embedTitle}
                  onChange={(e) => setEmbedTitle(e.target.value.slice(0, 256))}
                  className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                />
              </FormRow>

              <FormRow label="Embed-Nachricht" hint="Platzhalter: {user}, {suggestion}, {id}">
                <textarea
                  value={embedMessage}
                  onChange={(e) => setEmbedMessage(e.target.value.slice(0, 3500))}
                  rows={5}
                  className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y"
                />
              </FormRow>

              <FormRow label="Embed-Farbe" hint="Farbe des Embed-Balkens">
                <ColorPicker value={embedColor} onChange={setEmbedColor} />
              </FormRow>

              <FormRow label="Footer-Text" hint="Footer im Embed">
                <input
                  type="text"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value.slice(0, 1024))}
                  placeholder="Mein Server • Vorschläge"
                  className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                />
              </FormRow>

              <FormRow label="Banner URL" hint="Großes Bild unten im Embed">
                <input
                  type="url"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value.slice(0, 1024))}
                  placeholder="https://…"
                  className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                />
              </FormRow>

              <FormRow label="Thumbnail URL" hint="Kleines Bild oben rechts im Embed">
                <input
                  type="url"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value.slice(0, 1024))}
                  placeholder="https://…"
                  className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                />
              </FormRow>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormRow label="Upvote-Emoji" hint="Standard: 👍">
                  <EmojiInput value={upvoteEmoji} onChange={setUpvoteEmoji} placeholder="👍" />
                </FormRow>
                <FormRow label="Downvote-Emoji" hint="Standard: 👎">
                  <EmojiInput value={downvoteEmoji} onChange={setDownvoteEmoji} placeholder="👎" />
                </FormRow>
                <FormRow label="Status: Offen" hint="Standard: 🟢">
                  <EmojiInput value={statusOpenEmoji} onChange={setStatusOpenEmoji} placeholder="🟢" />
                </FormRow>
                <FormRow label="Status: Beendet" hint="Standard: 🔴">
                  <EmojiInput value={statusEndedEmoji} onChange={setStatusEndedEmoji} placeholder="🔴" />
                </FormRow>
              </div>

              <FormRow label="Berechtigte Rollen" hint="Rollen die Vorschläge beenden dürfen (zusätzlich zu 'Server verwalten')">
                <RoleMultiSelect
                  roles={roles}
                  rolesById={rolesById}
                  selected={allowedRoleIds}
                  available={availableRoles}
                  onAdd={(id) => setAllowedRoleIds((prev) => [...prev, id])}
                  onRemove={(id) =>
                    setAllowedRoleIds((prev) => prev.filter((x) => x !== id))
                  }
                />
              </FormRow>

              <FormRow label="End-Nachricht" hint="Text wenn ein Vorschlag beendet wird">
                <textarea
                  value={endMessage}
                  onChange={(e) => setEndMessage(e.target.value.slice(0, 1024))}
                  rows={3}
                  className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y"
                />
              </FormRow>

              <FormRow label="Feld-Reihenfolge" hint="Ziehe Felder um die Reihenfolge im Embed zu ändern">
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="sug-fields">
                    {(prov) => (
                      <ul
                        ref={prov.innerRef}
                        {...prov.droppableProps}
                        className="space-y-1.5"
                      >
                        {fieldOrder.map((key, idx) => (
                          <Draggable key={key} draggableId={key} index={idx}>
                            {(p, snap) => (
                              <li
                                ref={p.innerRef}
                                {...p.draggableProps}
                                {...p.dragHandleProps}
                                className={`flex items-center gap-2 rounded-md border bg-elev px-3 py-2 text-sm text-fg ${
                                  snap.isDragging
                                    ? 'border-accent shadow-lg'
                                    : 'border-line'
                                }`}
                              >
                                <span className="text-subtle font-mono select-none">⋮⋮</span>
                                <span>{FIELD_META[key].label}</span>
                              </li>
                            )}
                          </Draggable>
                        ))}
                        {prov.placeholder}
                      </ul>
                    )}
                  </Droppable>
                </DragDropContext>
              </FormRow>
            </div>
          </FormSection>

          <FormSection
            title="Letzte Vorschläge"
            description="Maximal 50 neueste."
            badge={<StatusPill>{list.length}</StatusPill>}
          >
            {list.length === 0 ? (
              <div className="text-[12.5px] text-subtle text-center py-4">
                Noch keine Vorschläge.
              </div>
            ) : (
              <ul className="space-y-2 max-h-72 overflow-y-auto">
                {list.map((s) => (
                  <li key={s.id} className="rounded-md border border-line bg-surface p-3">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <StatusPill kind={s.status === 'open' ? 'info' : 'success'} dot>
                        {s.status === 'open' ? 'Offen' : 'Beendet'}
                      </StatusPill>
                      <span className="text-[10.5px] text-subtle font-mono">
                        👍 {s.upvotes} · 👎 {s.downvotes}
                      </span>
                    </div>
                    <p className="text-[13px] text-fg-soft line-clamp-2">{s.content}</p>
                    <div className="text-[10.5px] text-subtle mt-1">
                      von <code>{s.userId}</code>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </FormSection>
        </div>

        {/* === RIGHT: LIVE PREVIEW === */}
        <div className="xl:sticky xl:top-3 self-start">
          <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[12.5px] text-muted">
                <span>👁️</span>
                <span>Live-Preview</span>
              </div>
              <div className="flex items-center gap-1 rounded-md border border-line bg-elev p-0.5">
                <button
                  type="button"
                  onClick={() => setPreviewEnded(false)}
                  className={`text-[11.5px] px-2.5 py-1 rounded ${
                    !previewEnded
                      ? 'bg-surface text-fg shadow-sm'
                      : 'text-muted hover:text-fg'
                  }`}
                >
                  Vorschlag
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewEnded(true)}
                  className={`text-[11.5px] px-2.5 py-1 rounded ${
                    previewEnded
                      ? 'bg-surface text-fg shadow-sm'
                      : 'text-muted hover:text-fg'
                  }`}
                >
                  Beendet
                </button>
              </div>
            </div>
            <EmbedPreview
              ended={previewEnded}
              color={embedColor}
              title={embedTitle}
              message={embedMessage}
              footer={footerText}
              bannerUrl={bannerUrl}
              thumbnailUrl={thumbnailUrl}
              upvoteEmoji={upvoteEmoji || '👍'}
              downvoteEmoji={downvoteEmoji || '👎'}
              statusOpenEmoji={statusOpenEmoji || '🟢'}
              statusEndedEmoji={statusEndedEmoji || '🔴'}
              endMessage={endMessage}
              fieldOrder={fieldOrder}
            />
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 bg-bg/80 backdrop-blur-sm border-t border-line flex justify-end">
        <Button type="submit" loading={pending} variant="primary">
          {pending ? 'Speichern…' : 'Speichern'}
        </Button>
      </div>
    </form>
  );
}

// ---------------- Emoji-Input ----------------

function EmojiInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value.slice(0, 120))}
      placeholder={placeholder ?? 'Emoji…'}
      className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
    />
  );
}

// ---------------- Role-Multi-Select ----------------

function RoleMultiSelect({
  roles,
  rolesById,
  selected,
  available,
  onAdd,
  onRemove,
}: {
  roles: Role[];
  rolesById: Map<string, Role>;
  selected: string[];
  available: Role[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [add, setAdd] = useState('');
  void roles;
  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((id) => {
            const r = rolesById.get(id);
            return (
              <li
                key={id}
                className="inline-flex items-center gap-1.5 rounded-md border border-line bg-elev px-2 py-1 text-[12px] text-fg"
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: r?.color
                      ? `#${r.color.toString(16).padStart(6, '0')}`
                      : '#888',
                  }}
                />
                <span className="truncate max-w-[140px]">{r?.name ?? id}</span>
                <button
                  type="button"
                  onClick={() => onRemove(id)}
                  className="text-subtle hover:text-fg"
                  aria-label="entfernen"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex gap-2">
        <select
          value={add}
          onChange={(e) => setAdd(e.target.value)}
          className="flex-1 rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
        >
          <option value="">— Rolle hinzufügen —</option>
          {available.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!add}
          onClick={() => {
            if (add) onAdd(add);
            setAdd('');
          }}
          className="rounded-md border border-line-strong bg-elev px-3 py-2 text-sm text-fg disabled:opacity-50 hover:bg-surface"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ---------------- Embed-Preview ----------------

function applyPreviewPlaceholders(template: string): string {
  return template
    .replaceAll('{user}', '@BeispielUser')
    .replaceAll('{mention}', '@BeispielUser')
    .replaceAll('{suggestion}', 'Wir sollten einen neuen Voice-Channel für Musik erstellen!')
    .replaceAll('{id}', 'R82N91');
}

function EmbedPreview({
  ended,
  color,
  title,
  message,
  footer,
  bannerUrl,
  thumbnailUrl,
  upvoteEmoji,
  downvoteEmoji,
  statusOpenEmoji,
  statusEndedEmoji,
  endMessage,
  fieldOrder,
}: {
  ended: boolean;
  color: string;
  title: string;
  message: string;
  footer: string;
  bannerUrl: string;
  thumbnailUrl: string;
  upvoteEmoji: string;
  downvoteEmoji: string;
  statusOpenEmoji: string;
  statusEndedEmoji: string;
  endMessage: string;
  fieldOrder: FieldKey[];
}) {
  const rendered = applyPreviewPlaceholders(message);

  const renderField = (key: FieldKey) => {
    switch (key) {
      case 'id':
        return (
          <PreviewField key={key} label="ID">
            <code className="text-[12px] text-fg font-mono">#R82N91</code>
          </PreviewField>
        );
      case 'status':
        return (
          <PreviewField key={key} label="Status">
            <span className="text-[12px] text-fg">
              {ended
                ? `${statusEndedEmoji} Beendet`
                : `${statusOpenEmoji} Offen`}
            </span>
          </PreviewField>
        );
      case 'upvotes':
        if (!ended) return null;
        return (
          <PreviewField key={key} label={`${upvoteEmoji} Upvotes`}>
            <span className="text-[12px] text-fg font-semibold">12</span>
          </PreviewField>
        );
      case 'downvotes':
        if (!ended) return null;
        return (
          <PreviewField key={key} label={`${downvoteEmoji} Downvotes`}>
            <span className="text-[12px] text-fg font-semibold">3</span>
          </PreviewField>
        );
      case 'banner':
        if (bannerUrl) return null;
        return (
          <PreviewField key={key} label="BANNER">
            <span className="text-[12px] text-subtle italic">Kein Banner gesetzt</span>
          </PreviewField>
        );
    }
  };

  return (
    <div className="rounded-lg overflow-hidden bg-[#2b2d31] text-[#dbdee1] flex">
      <div className="w-1 shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0 p-3.5 space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="text-[14px] font-semibold text-white">
              {title || 'Vorschlag'}
            </div>
            <div className="text-[13.5px] text-[#dbdee1] whitespace-pre-wrap break-words">
              {rendered}
            </div>
          </div>
          {thumbnailUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={thumbnailUrl}
              alt=""
              className="h-12 w-12 rounded object-cover shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
        </div>
        <div className="space-y-1.5">{fieldOrder.map(renderField)}</div>
        {bannerUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={bannerUrl}
            alt=""
            className="rounded-md w-full max-h-60 object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        {ended && (
          <div className="pt-1.5 border-t border-white/5">
            <div className="text-[11px] uppercase tracking-wide text-[#b5bac1]">Hinweis</div>
            <div className="text-[13.5px] text-white font-semibold mt-0.5 whitespace-pre-wrap">
              {endMessage}
            </div>
          </div>
        )}
        {!ended ? (
          <div className="flex items-center gap-3 pt-1 text-[12px] text-[#b5bac1]">
            <span>{upvoteEmoji} 0</span>
            <span>{downvoteEmoji} 0</span>
          </div>
        ) : null}
        {footer && (
          <div className="pt-1 text-[11.5px] text-[#b5bac1]">{footer}</div>
        )}
      </div>
    </div>
  );
}

function PreviewField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-md bg-[#1e1f22] px-2.5 py-1.5">
      <span className="text-subtle text-[10px] select-none">⋮⋮</span>
      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wide text-[#b5bac1]">
          {label}
        </span>
        <div>{children}</div>
      </div>
    </div>
  );
}
