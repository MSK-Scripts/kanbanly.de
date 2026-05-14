'use client';

import { useState, useTransition } from 'react';
import {
  createHelpdeskPanel,
  deleteHelpdeskItem,
  deleteHelpdeskPanel,
  publishHelpdeskPanel,
  updateHelpdeskPanel,
  upsertHelpdeskItem,
  type HelpdeskItemInput,
} from '@/app/(app)/integrations/discord/[guildId]/actions';
import { confirm } from '@/store/confirmStore';
import { toast } from '@/store/toastStore';
import { Button } from './ui/Button';
import { ColorPicker } from './ui/ColorPicker';
import { FormSection, FormRow } from './ui/FormSection';
import { StatusPill, StatusBanner } from './ui/Status';

type Channel = { id: string; name: string };

type Panel = {
  id: string;
  channelId: string;
  messageId: string | null;
  title: string;
  description: string | null;
  color: number | null;
  items: Array<{
    id: string;
    label: string;
    emoji: string | null;
    style: 'primary' | 'secondary' | 'success' | 'danger';
    answer: string;
    answerColor: number | null;
    position: number;
  }>;
};

type Props = {
  guildId: string;
  channels: Channel[];
  initial: Panel[];
};

const STYLE_CLASSES: Record<HelpdeskItemInput['style'], string> = {
  primary: 'bg-[#5865F2] text-white',
  secondary: 'bg-[#4E5058] text-white',
  success: 'bg-[#248046] text-white',
  danger: 'bg-[#DA373C] text-white',
};

export function HelpdeskForm({ guildId, channels, initial }: Props) {
  const [panels, setPanels] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [newChannelId, setNewChannelId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState('#5865F2');
  const [pending, startTransition] = useTransition();

  const channelById = new Map(channels.map((c) => [c.id, c.name]));

  const create = () => {
    if (!newChannelId || !newTitle.trim()) return;
    const colorInt = /^#?[0-9a-f]{6}$/i.test(newColor)
      ? parseInt(newColor.replace('#', ''), 16)
      : null;
    startTransition(async () => {
      const r = await createHelpdeskPanel(guildId, {
        channelId: newChannelId,
        title: newTitle,
        description: newDesc || null,
        color: colorInt,
      });
      if (r.ok && r.id) {
        setPanels((prev) => [
          {
            id: r.id!,
            channelId: newChannelId,
            messageId: null,
            title: newTitle.trim(),
            description: newDesc.trim() || null,
            color: colorInt,
            items: [],
          },
          ...prev,
        ]);
        setNewChannelId('');
        setNewTitle('');
        setNewDesc('');
        setCreating(false);
        toast.success('Panel angelegt');
      } else {
        toast.error('Fehler', r.error);
      }
    });
  };

  const removePanel = async (panel: Panel) => {
    const ok = await confirm({
      title: 'Panel löschen?',
      description: `„${panel.title}" wird inkl. aller Fragen entfernt. Die Discord-Nachricht wird gelöscht.`,
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteHelpdeskPanel(guildId, panel.id);
      if (r.ok) {
        setPanels((prev) => prev.filter((p) => p.id !== panel.id));
        toast.success('Panel gelöscht');
      } else toast.error('Fehler', r.error);
    });
  };

  return (
    <div className="space-y-5">
      <StatusBanner kind="info">
        Helpdesk-Panels sind Embeds mit klickbaren Buttons. Pro Button kommt
        eine private Antwort (nur für den User sichtbar). Ideal für FAQ,
        Server-Regeln, Common-Issues.
      </StatusBanner>

      {panels.length > 0 ? (
        <div className="space-y-4">
          {panels.map((p) => (
            <PanelCard
              key={p.id}
              panel={p}
              channels={channels}
              channelName={channelById.get(p.channelId) ?? p.channelId}
              onUpdate={(updated) =>
                setPanels((prev) => prev.map((x) => (x.id === p.id ? updated : x)))
              }
              onDelete={() => removePanel(p)}
              guildId={guildId}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-line-strong p-10 text-center">
          <div className="text-3xl mb-2">❓</div>
          <div className="text-sm text-fg-soft mb-1">Noch keine Helpdesk-Panels</div>
          <div className="text-[12px] text-subtle">
            Lege unten dein erstes Panel an.
          </div>
        </div>
      )}

      {creating ? (
        <FormSection title="Neues Panel" description="Channel + Titel reicht zum Anlegen — Fragen kommen danach.">
          <FormRow label="Channel" required>
            <select
              value={newChannelId}
              onChange={(e) => setNewChannelId(e.target.value)}
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            >
              <option value="">— Channel wählen —</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Titel" required>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value.slice(0, 256))}
              placeholder="Helpdesk / FAQ"
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
          </FormRow>
          <FormRow label="Beschreibung (optional)">
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value.slice(0, 2000))}
              rows={2}
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y transition-all"
            />
          </FormRow>
          <FormRow label="Embed-Farbe">
            <ColorPicker value={newColor} onChange={setNewColor} />
          </FormRow>
          <div className="flex items-center gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Abbrechen
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={pending}
              disabled={!newChannelId || !newTitle.trim()}
              onClick={create}
            >
              Anlegen
            </Button>
          </div>
        </FormSection>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="w-full rounded-xl border border-dashed border-line-strong hover:border-accent hover:bg-elev/40 py-3 text-sm text-muted hover:text-fg transition-colors"
        >
          + Neues Helpdesk-Panel
        </button>
      )}
    </div>
  );
}

function PanelCard({
  panel,
  channels,
  channelName,
  onUpdate,
  onDelete,
  guildId,
}: {
  panel: Panel;
  channels: Channel[];
  channelName: string;
  onUpdate: (p: Panel) => void;
  onDelete: () => void;
  guildId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(panel.title);
  const [desc, setDesc] = useState(panel.description ?? '');
  const [color, setColor] = useState(
    panel.color !== null
      ? '#' + panel.color.toString(16).padStart(6, '0')
      : '#5865F2',
  );
  const [pending, startTransition] = useTransition();
  const [publishing, setPublishing] = useState(false);

  void channels;

  const savePanel = () => {
    const colorInt = /^#?[0-9a-f]{6}$/i.test(color)
      ? parseInt(color.replace('#', ''), 16)
      : null;
    startTransition(async () => {
      const r = await updateHelpdeskPanel(guildId, panel.id, {
        title,
        description: desc || null,
        color: colorInt,
      });
      if (r.ok) {
        onUpdate({
          ...panel,
          title: title.trim(),
          description: desc.trim() || null,
          color: colorInt,
        });
        setEditing(false);
        toast.success('Panel aktualisiert');
      } else toast.error('Fehler', r.error);
    });
  };

  const publish = async () => {
    setPublishing(true);
    const r = await publishHelpdeskPanel(guildId, panel.id);
    setPublishing(false);
    if (r.ok && r.messageId) {
      onUpdate({ ...panel, messageId: r.messageId });
      toast.success('Panel gepostet');
    } else toast.error('Fehler', r.error);
  };

  const upsertItem = async (
    item: HelpdeskItemInput,
    refresh: boolean,
  ): Promise<string | null> => {
    const r = await upsertHelpdeskItem(guildId, panel.id, item);
    if (!r.ok) {
      toast.error('Fehler', r.error);
      return null;
    }
    toast.success(item.id ? 'Frage aktualisiert' : 'Frage hinzugefügt');
    if (refresh && r.id) {
      // Lokal aktualisieren
      const newItem = {
        id: r.id,
        label: item.label,
        emoji: item.emoji,
        style: item.style,
        answer: item.answer,
        answerColor: item.answerColor,
        position:
          panel.items.length > 0
            ? Math.max(...panel.items.map((i) => i.position)) + 1
            : 0,
      };
      if (item.id) {
        onUpdate({
          ...panel,
          items: panel.items.map((i) => (i.id === item.id ? { ...newItem, id: i.id, position: i.position } : i)),
        });
      } else {
        onUpdate({ ...panel, items: [...panel.items, newItem] });
      }
    }
    return r.id ?? null;
  };

  const removeItem = async (itemId: string, label: string) => {
    const ok = await confirm({
      title: 'Frage löschen?',
      description: `„${label}" wird entfernt.`,
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    const r = await deleteHelpdeskItem(guildId, itemId);
    if (r.ok) {
      onUpdate({ ...panel, items: panel.items.filter((i) => i.id !== itemId) });
      toast.success('Frage entfernt');
    } else toast.error('Fehler', r.error);
  };

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line bg-elev/30">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-semibold text-fg truncate max-w-[280px]">
              ❓ {panel.title}
            </span>
            {panel.messageId ? (
              <StatusPill kind="success" dot>Gepostet</StatusPill>
            ) : (
              <StatusPill kind="warning" dot>Nicht gepostet</StatusPill>
            )}
          </div>
          <div className="text-[11.5px] text-muted mt-0.5">
            <span className="text-accent">#{channelName}</span> ·{' '}
            {panel.items.length} Fragen
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Schließen' : 'Bearbeiten'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={publishing}
            onClick={publish}
          >
            {panel.messageId ? 'Neu posten' : 'Posten'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDelete}>
            Löschen
          </Button>
        </div>
      </div>

      {editing && (
        <div className="px-4 py-3 border-b border-line space-y-3">
          <FormRow label="Titel">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 256))}
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
          </FormRow>
          <FormRow label="Beschreibung">
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value.slice(0, 2000))}
              rows={2}
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y transition-all"
            />
          </FormRow>
          <FormRow label="Embed-Farbe">
            <ColorPicker value={color} onChange={setColor} />
          </FormRow>
          <div className="flex justify-end">
            <Button type="button" variant="primary" loading={pending} onClick={savePanel}>
              Speichern
            </Button>
          </div>
        </div>
      )}

      <div className="px-4 py-3 space-y-2">
        {panel.items.length === 0 ? (
          <div className="text-[12.5px] text-subtle text-center py-2">
            Noch keine Fragen — Button unten zum Hinzufügen.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {panel.items.map((it) => (
              <li
                key={it.id}
                className="flex items-center gap-2 rounded-md border border-line bg-elev/40 px-3 py-2"
              >
                <span
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold ${STYLE_CLASSES[it.style]}`}
                >
                  {it.emoji && <span>{it.emoji}</span>}
                  {it.label}
                </span>
                <span className="text-[11.5px] text-muted line-clamp-1 flex-1 min-w-0">
                  {it.answer}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeItem(it.id, it.label)}
                >
                  ×
                </Button>
              </li>
            ))}
          </ul>
        )}
        <AddItemForm panelMaxReached={panel.items.length >= 25} onAdd={(item) => upsertItem(item, true)} />
      </div>
    </div>
  );
}

function AddItemForm({
  onAdd,
  panelMaxReached,
}: {
  onAdd: (item: HelpdeskItemInput) => Promise<string | null>;
  panelMaxReached: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [emoji, setEmoji] = useState('');
  const [style, setStyle] = useState<HelpdeskItemInput['style']>('secondary');
  const [answer, setAnswer] = useState('');
  const [answerColor, setAnswerColor] = useState('#5865F2');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setLabel('');
    setEmoji('');
    setStyle('secondary');
    setAnswer('');
    setAnswerColor('#5865F2');
  };

  const submit = async () => {
    if (!label.trim() || !answer.trim()) return;
    setSubmitting(true);
    const colorInt = /^#?[0-9a-f]{6}$/i.test(answerColor)
      ? parseInt(answerColor.replace('#', ''), 16)
      : null;
    const id = await onAdd({
      label,
      emoji: emoji || null,
      style,
      answer,
      answerColor: colorInt,
    });
    setSubmitting(false);
    if (id) {
      reset();
      setOpen(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={panelMaxReached}
        className="w-full rounded-md border border-dashed border-line-strong hover:border-accent hover:bg-elev/30 py-2 text-[12px] text-muted hover:text-fg transition-colors disabled:opacity-50"
      >
        {panelMaxReached ? 'Max 25 Fragen pro Panel erreicht' : '+ Frage hinzufügen'}
      </button>
    );
  }
  return (
    <div className="rounded-lg border border-line bg-elev/30 p-3 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value.slice(0, 80))}
          placeholder='Button-Label (z.B. "Wie werde ich Mod?")'
          className="rounded-md bg-surface border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
        />
        <input
          type="text"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value.slice(0, 80))}
          placeholder="Emoji (optional)"
          className="rounded-md bg-surface border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-muted">Button-Style:</span>
        {(['primary', 'secondary', 'success', 'danger'] as const).map((s) => {
          const active = style === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStyle(s)}
              className={`text-[11px] px-2.5 py-1 rounded ${STYLE_CLASSES[s]} ${
                active ? 'ring-2 ring-fg/40' : 'opacity-60 hover:opacity-100'
              } transition-all`}
            >
              {s}
            </button>
          );
        })}
      </div>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value.slice(0, 4000))}
        placeholder="Antwort (wird nur dem Klickenden gezeigt)"
        rows={4}
        className="w-full rounded-md bg-surface border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y transition-all"
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted">Embed-Farbe:</span>
          <ColorPicker value={answerColor} onChange={setAnswerColor} />
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => { reset(); setOpen(false); }}>
            Abbrechen
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            loading={submitting}
            onClick={submit}
            disabled={!label.trim() || !answer.trim()}
          >
            Hinzufügen
          </Button>
        </div>
      </div>
    </div>
  );
}
