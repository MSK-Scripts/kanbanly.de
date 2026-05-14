'use client';

import { useState, useTransition } from 'react';
import {
  createPricelistPanelWeb,
  updatePricelistPanelWeb,
  deletePricelistPanelWeb,
  upsertPricelistItem,
  deletePricelistItem,
  publishPricelistPanel,
  type PricelistPanelRow,
  type PricelistItemRow,
} from '@/app/(app)/integrations/discord/[guildId]/actions';
import { toast } from '@/store/toastStore';
import { confirm } from '@/store/confirmStore';
import { Button } from './ui/Button';
import { ColorPicker } from './ui/ColorPicker';
import { FormRow } from './ui/FormSection';
import { StatusBanner } from './ui/Status';

type Channel = { id: string; name: string };
type ButtonStyle = 'primary' | 'secondary' | 'success' | 'danger';

const BUTTON_STYLES: Array<{ value: ButtonStyle; label: string }> = [
  { value: 'primary', label: 'Blurple' },
  { value: 'secondary', label: 'Grau' },
  { value: 'success', label: 'Grün' },
  { value: 'danger', label: 'Rot' },
];

function intToHex(n: number | null | undefined): string {
  if (n == null) return '#380D52';
  return '#' + n.toString(16).padStart(6, '0').toUpperCase();
}
function hexToInt(hex: string): number | null {
  return /^#?[0-9a-f]{6}$/i.test(hex) ? parseInt(hex.replace('#', ''), 16) : null;
}

export function PricelistForm({
  guildId,
  channels,
  initialPanels,
}: {
  guildId: string;
  channels: Channel[];
  initialPanels: PricelistPanelRow[];
}) {
  const [panels, setPanels] = useState(initialPanels);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <StatusBanner kind="info">
        Preisliste = Embed mit Buttons im konfigurierten Channel. Klick auf einen
        Button öffnet eine private Detail-Ansicht (Preis, Beschreibung, Bild).
      </StatusBanner>

      {panels.length > 0 && (
        <ul className="space-y-3">
          {panels.map((p) => {
            const ch = channels.find((c) => c.id === p.channelId)?.name ?? p.channelId;
            const open = editingId === p.id;
            return (
              <li key={p.id} className="rounded-xl border border-line bg-surface overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line bg-elev/30">
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-fg truncate">{p.title}</div>
                    <div className="text-[11.5px] text-muted mt-0.5">
                      <span className="text-accent-soft">#{ch}</span> · {p.items.length} Eintrag/Einträge
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <PublishButton guildId={guildId} panelId={p.id} messageId={p.messageId} />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(open ? null : p.id)}
                    >
                      {open ? 'Schließen' : 'Bearbeiten'}
                    </Button>
                    <DeleteBtn
                      guildId={guildId}
                      panelId={p.id}
                      onDeleted={() =>
                        setPanels((prev) => prev.filter((x) => x.id !== p.id))
                      }
                    />
                  </div>
                </div>
                {open && (
                  <div className="p-4 space-y-4">
                    <PanelEditor
                      guildId={guildId}
                      channels={channels}
                      initial={p}
                      onSaved={(u) =>
                        setPanels((prev) => prev.map((x) => (x.id === u.id ? u : x)))
                      }
                    />
                    <ItemsEditor
                      guildId={guildId}
                      panel={p}
                      onChange={(items) =>
                        setPanels((prev) =>
                          prev.map((x) => (x.id === p.id ? { ...x, items } : x)),
                        )
                      }
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {creating ? (
        <div className="rounded-xl border border-line bg-elev/30 p-4">
          <PanelEditor
            guildId={guildId}
            channels={channels}
            initial={null}
            onSaved={(u) => {
              setPanels((prev) => [u, ...prev]);
              setCreating(false);
              setEditingId(u.id);
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="w-full rounded-xl border border-dashed border-line-strong hover:border-accent hover:bg-elev/40 py-3 text-sm text-muted hover:text-fg transition-colors"
        >
          + Neue Preisliste
        </button>
      )}
    </div>
  );
}

function PublishButton({
  guildId,
  panelId,
  messageId,
}: {
  guildId: string;
  panelId: string;
  messageId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const onClick = () => {
    startTransition(async () => {
      const r = await publishPricelistPanel(guildId, panelId);
      if (r.ok) toast.success(messageId ? 'Aktualisiert' : 'Gepostet');
      else toast.error('Fehler', r.error);
    });
  };
  return (
    <Button type="button" size="sm" variant="secondary" onClick={onClick} loading={pending}>
      {messageId ? 'Neu posten' : 'Posten'}
    </Button>
  );
}

function DeleteBtn({
  guildId,
  panelId,
  onDeleted,
}: {
  guildId: string;
  panelId: string;
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const onClick = async () => {
    const ok = await confirm({
      title: 'Preisliste löschen?',
      description: 'Die Discord-Nachricht und alle Einträge werden entfernt.',
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deletePricelistPanelWeb(guildId, panelId);
      if (r.ok) {
        onDeleted();
        toast.success('Preisliste gelöscht');
      } else toast.error('Fehler', r.error);
    });
  };
  return (
    <Button type="button" size="sm" variant="ghost" onClick={onClick} disabled={pending}>
      Löschen
    </Button>
  );
}

function PanelEditor({
  guildId,
  channels,
  initial,
  onSaved,
  onCancel,
}: {
  guildId: string;
  channels: Channel[];
  initial: PricelistPanelRow | null;
  onSaved: (p: PricelistPanelRow) => void;
  onCancel?: () => void;
}) {
  const [channelId, setChannelId] = useState(initial?.channelId ?? '');
  const [title, setTitle] = useState(initial?.title ?? 'Preisliste');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [color, setColor] = useState(intToHex(initial?.color));
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [thumbnailUrl, setThumbnailUrl] = useState(initial?.thumbnailUrl ?? '');
  const [footer, setFooter] = useState(initial?.footer ?? '');
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!channelId || !title.trim()) {
      toast.error('Channel und Titel nötig');
      return;
    }
    const payload = {
      channelId,
      title,
      description,
      color: hexToInt(color),
      imageUrl: imageUrl || null,
      thumbnailUrl: thumbnailUrl || null,
      footer: footer || null,
    };
    startTransition(async () => {
      if (initial) {
        const r = await updatePricelistPanelWeb(guildId, initial.id, payload);
        if (r.ok) {
          onSaved({ ...initial, ...payload });
          toast.success('Preisliste aktualisiert');
        } else toast.error('Fehler', r.error);
      } else {
        const r = await createPricelistPanelWeb(guildId, payload);
        if (r.ok && r.id) {
          onSaved({
            id: r.id,
            messageId: null,
            ...payload,
            items: [],
          });
          toast.success('Preisliste angelegt. Einträge anlegen + dann posten.');
        } else toast.error('Fehler', r.error);
      }
    });
  };

  return (
    <div className="space-y-3">
      {!initial && (
        <FormRow label="Channel" required>
          <select
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
          >
            <option value="">— Channel wählen —</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
        </FormRow>
      )}
      <FormRow label="Titel" required>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 256))}
          className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
        />
      </FormRow>
      <FormRow label="Beschreibung">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
          rows={3}
          className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg font-mono resize-y focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
        />
      </FormRow>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormRow label="Farbe">
          <ColorPicker value={color} onChange={setColor} />
        </FormRow>
        <FormRow label="Footer">
          <input
            type="text"
            value={footer}
            onChange={(e) => setFooter(e.target.value.slice(0, 2048))}
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
          />
        </FormRow>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormRow label="Bild-URL">
          <input
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value.trim())}
            placeholder="https://…"
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
          />
        </FormRow>
        <FormRow label="Thumbnail-URL">
          <input
            type="text"
            value={thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value.trim())}
            placeholder="https://…"
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
          />
        </FormRow>
      </div>
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Abbrechen
          </Button>
        )}
        <Button type="button" size="sm" variant="primary" onClick={submit} loading={pending}>
          {initial ? 'Embed-Daten speichern' : 'Anlegen'}
        </Button>
      </div>
    </div>
  );
}

function ItemsEditor({
  guildId,
  panel,
  onChange,
}: {
  guildId: string;
  panel: PricelistPanelRow;
  onChange: (items: PricelistItemRow[]) => void;
}) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-2 pt-3 border-t border-line">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-medium text-fg-soft">
          Einträge / Buttons ({panel.items.length})
        </div>
        {!adding && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(true)}>
            + Eintrag
          </Button>
        )}
      </div>

      {panel.items.length === 0 && !adding && (
        <div className="rounded-md border border-dashed border-line-strong p-4 text-center text-[12px] text-subtle">
          Noch keine Einträge.
        </div>
      )}

      <ul className="space-y-2">
        {panel.items.map((it) => {
          const open = editingItemId === it.id;
          return (
            <li key={it.id} className="rounded-md border border-line bg-elev/30">
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0 flex items-center gap-2">
                  {it.emoji && <span className="text-base">{it.emoji}</span>}
                  <span className="text-[13px] font-medium text-fg truncate">
                    {it.label}
                  </span>
                  {it.detailPrice && (
                    <span className="text-[11.5px] text-accent-soft font-mono">
                      {it.detailPrice}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingItemId(open ? null : it.id)}
                  >
                    {open ? 'Schließen' : 'Bearbeiten'}
                  </Button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Eintrag löschen?',
                        confirmLabel: 'Löschen',
                        danger: true,
                      });
                      if (!ok) return;
                      const r = await deletePricelistItem(guildId, it.id);
                      if (r.ok) {
                        onChange(panel.items.filter((x) => x.id !== it.id));
                        toast.success('Entfernt');
                      } else toast.error('Fehler', r.error);
                    }}
                    className="text-[11px] text-muted hover:text-danger px-2"
                  >
                    Löschen
                  </button>
                </div>
              </div>
              {open && (
                <div className="p-3 border-t border-line">
                  <ItemEditor
                    guildId={guildId}
                    panelId={panel.id}
                    initial={it}
                    onSaved={(u) => {
                      onChange(panel.items.map((x) => (x.id === u.id ? u : x)));
                      setEditingItemId(null);
                    }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {adding && (
        <div className="rounded-md border border-line bg-elev/30 p-3 mt-2">
          <ItemEditor
            guildId={guildId}
            panelId={panel.id}
            initial={null}
            onSaved={(u) => {
              onChange([...panel.items, u]);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}
    </div>
  );
}

function ItemEditor({
  guildId,
  panelId,
  initial,
  onSaved,
  onCancel,
}: {
  guildId: string;
  panelId: string;
  initial: PricelistItemRow | null;
  onSaved: (it: PricelistItemRow) => void;
  onCancel?: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? '');
  const [style, setStyle] = useState<ButtonStyle>(initial?.style ?? 'secondary');
  const [detailTitle, setDetailTitle] = useState(initial?.detailTitle ?? '');
  const [detailDescription, setDetailDescription] = useState(initial?.detailDescription ?? '');
  const [detailPrice, setDetailPrice] = useState(initial?.detailPrice ?? '');
  const [detailColor, setDetailColor] = useState(intToHex(initial?.detailColor));
  const [detailImageUrl, setDetailImageUrl] = useState(initial?.detailImageUrl ?? '');
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!label.trim() || !detailTitle.trim()) {
      toast.error('Label und Detail-Titel nötig');
      return;
    }
    const payload = {
      label,
      emoji: emoji || null,
      style,
      detailTitle,
      detailDescription,
      detailPrice: detailPrice || null,
      detailColor: hexToInt(detailColor),
      detailImageUrl: detailImageUrl || null,
    };
    startTransition(async () => {
      const r = await upsertPricelistItem(guildId, panelId, initial?.id ?? null, payload);
      if (r.ok && r.id) {
        onSaved({
          id: r.id,
          position: initial?.position ?? 0,
          ...payload,
        });
        toast.success(initial ? 'Aktualisiert' : 'Eintrag angelegt');
      } else toast.error('Fehler', r.error);
    });
  };

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_140px] gap-2">
        <FormRow label="Button-Label" required>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value.slice(0, 80))}
            className="w-full rounded-md bg-elev border border-line-strong px-2.5 py-1.5 text-[13px] text-fg"
          />
        </FormRow>
        <FormRow label="Emoji">
          <input
            type="text"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value.slice(0, 80))}
            placeholder="💼"
            className="w-full rounded-md bg-elev border border-line-strong px-2.5 py-1.5 text-[13px] text-fg placeholder:text-subtle"
          />
        </FormRow>
        <FormRow label="Style">
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value as ButtonStyle)}
            className="w-full rounded-md bg-elev border border-line-strong px-2.5 py-1.5 text-[13px] text-fg"
          >
            {BUTTON_STYLES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </FormRow>
      </div>

      <FormRow label="Detail-Titel" required hint="Wird im Detail-Embed beim Klick angezeigt.">
        <input
          type="text"
          value={detailTitle}
          onChange={(e) => setDetailTitle(e.target.value.slice(0, 256))}
          className="w-full rounded-md bg-elev border border-line-strong px-2.5 py-1.5 text-[13px] text-fg"
        />
      </FormRow>
      <FormRow label="Detail-Beschreibung">
        <textarea
          value={detailDescription}
          onChange={(e) => setDetailDescription(e.target.value.slice(0, 2000))}
          rows={4}
          className="w-full rounded-md bg-elev border border-line-strong px-2.5 py-1.5 text-[13px] text-fg font-mono resize-y"
        />
      </FormRow>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <FormRow label="Preis">
          <input
            type="text"
            value={detailPrice}
            onChange={(e) => setDetailPrice(e.target.value.slice(0, 200))}
            placeholder="z.B. 99 € / Monat"
            className="w-full rounded-md bg-elev border border-line-strong px-2.5 py-1.5 text-[13px] text-fg placeholder:text-subtle"
          />
        </FormRow>
        <FormRow label="Detail-Farbe">
          <ColorPicker value={detailColor} onChange={setDetailColor} />
        </FormRow>
        <FormRow label="Detail-Bild URL">
          <input
            type="text"
            value={detailImageUrl}
            onChange={(e) => setDetailImageUrl(e.target.value.trim())}
            placeholder="https://…"
            className="w-full rounded-md bg-elev border border-line-strong px-2.5 py-1.5 text-[13px] text-fg placeholder:text-subtle"
          />
        </FormRow>
      </div>
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Abbrechen
          </Button>
        )}
        <Button type="button" size="sm" variant="primary" onClick={submit} loading={pending}>
          {initial ? 'Speichern' : 'Anlegen'}
        </Button>
      </div>
    </div>
  );
}
