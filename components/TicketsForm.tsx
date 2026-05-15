'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  createTicketPanelWeb,
  updateTicketPanelWeb,
  deleteTicketPanelWeb,
  listTicketsForGuild,
  getTicketTranscript,
  listTicketFeedbackForGuild,
  type TicketPanelRow,
  type TicketSummary,
  type TranscriptMessageAct,
  type PanelButtonAct,
  type PanelTicketButtonAct,
  type PanelLinkButtonAct,
  type PanelSelectMenuAct,
  type PanelEmbedPayloadAct,
  type PanelEmbedFieldAct,
  type FeedbackModeAct,
  type TicketFeedbackRow,
  type TicketPanelInput,
} from '@/app/(app)/integrations/discord/[guildId]/actions';
import { toast } from '@/store/toastStore';
import { confirm } from '@/store/confirmStore';
import { safeHttpUrl } from '@/lib/safeUrl';
import { Button } from './ui/Button';
import { ColorPicker } from './ui/ColorPicker';
import { FormRow } from './ui/FormSection';
import { Spinner } from './ui/Spinner';
import { StatusPill, StatusBanner } from './ui/Status';
import { Switch } from './Switch';

type Channel = { id: string; name: string };
type Role = { id: string; name: string; color: number };
type ButtonStyle = 'primary' | 'secondary' | 'success' | 'danger';

type Props = {
  guildId: string;
  channels: Channel[];
  roles: Role[];
  initialPanels: TicketPanelRow[];
};

const BUTTON_STYLES: Array<{ value: ButtonStyle; label: string; classes: string }> = [
  { value: 'primary', label: 'Blurple', classes: 'bg-[#5865F2] text-white' },
  { value: 'secondary', label: 'Grau', classes: 'bg-[#4E5058] text-white' },
  { value: 'success', label: 'Grün', classes: 'bg-[#248046] text-white' },
  { value: 'danger', label: 'Rot', classes: 'bg-[#DA373C] text-white' },
];

function newId(prefix = 'b'): string {
  return `${prefix}${Math.random().toString(36).slice(2, 8)}`;
}

function intToHex(n: number | null | undefined): string {
  if (n == null) return '#380D52';
  return '#' + n.toString(16).padStart(6, '0').toUpperCase();
}
function hexToInt(hex: string): number | null {
  return /^#?[0-9a-f]{6}$/i.test(hex) ? parseInt(hex.replace('#', ''), 16) : null;
}

export function TicketsForm({ guildId, channels, roles, initialPanels }: Props) {
  const [panels, setPanels] = useState(initialPanels);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<'panels' | 'open' | 'closed' | 'feedback'>('panels');

  return (
    <div className="space-y-5">
      <StatusBanner kind="info">
        Tickets sind private Channels zwischen User + Staff-Rolle(n). Panels haben
        Buttons oder ein Dropdown — jede Auswahl kann ihre eigene Kategorie,
        Staff-Rolle und Willkommens-Nachricht haben. Beim Schließen wird ein
        Transcript gespeichert und optional Feedback abgefragt.
      </StatusBanner>

      <div className="flex items-center gap-1 border-b border-line">
        <TabBtn active={tab === 'panels'} onClick={() => setTab('panels')}>
          Panels ({panels.length})
        </TabBtn>
        <TabBtn active={tab === 'open'} onClick={() => setTab('open')}>
          Offen
        </TabBtn>
        <TabBtn active={tab === 'closed'} onClick={() => setTab('closed')}>
          Geschlossen + Transcripts
        </TabBtn>
        <TabBtn active={tab === 'feedback'} onClick={() => setTab('feedback')}>
          Feedback
        </TabBtn>
      </div>

      {tab === 'panels' && (
        <div className="space-y-3">
          {panels.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong p-10 text-center">
              <div className="text-sm text-fg-soft mb-1">Noch keine Ticket-Panels</div>
              <div className="text-[12px] text-subtle">
                Leg unten dein erstes Panel an.
              </div>
            </div>
          ) : (
            panels.map((p) => (
              <PanelCard
                key={p.id}
                panel={p}
                channels={channels}
                roles={roles}
                guildId={guildId}
                onUpdate={(updated) =>
                  setPanels((prev) => prev.map((x) => (x.id === p.id ? updated : x)))
                }
                onDelete={() => setPanels((prev) => prev.filter((x) => x.id !== p.id))}
              />
            ))
          )}
          {creating ? (
            <PanelEditor
              guildId={guildId}
              channels={channels}
              roles={roles}
              initial={null}
              onSaved={(panel) => {
                setPanels((prev) => [panel, ...prev]);
                setCreating(false);
              }}
              onCancel={() => setCreating(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full rounded-xl border border-dashed border-line-strong hover:border-accent hover:bg-elev/40 py-3 text-sm text-muted hover:text-fg transition-colors"
            >
              + Neues Ticket-Panel
            </button>
          )}
        </div>
      )}

      {tab === 'open' && <TicketListView guildId={guildId} status="open" />}
      {tab === 'closed' && <TicketListView guildId={guildId} status="closed" />}
      {tab === 'feedback' && <FeedbackView guildId={guildId} />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-[13px] font-medium border-b-2 transition-colors -mb-px ${
        active
          ? 'border-accent text-fg'
          : 'border-transparent text-muted hover:text-fg-soft'
      }`}
    >
      {children}
    </button>
  );
}

// ============== Panel-Card ==============

function PanelCard({
  panel,
  channels,
  roles,
  guildId,
  onUpdate,
  onDelete,
}: {
  panel: TicketPanelRow;
  channels: Channel[];
  roles: Role[];
  guildId: string;
  onUpdate: (p: TicketPanelRow) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const channelName = channels.find((c) => c.id === panel.channelId)?.name ?? panel.channelId;
  const staffNames = panel.staffRoleIds
    .map((id) => roles.find((r) => r.id === id)?.name ?? `(${id.slice(-4)})`)
    .join(', ');
  const [pending, startTransition] = useTransition();

  const remove = async () => {
    const ok = await confirm({
      title: 'Panel löschen?',
      description: 'Die Discord-Nachricht und das Panel werden entfernt.',
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteTicketPanelWeb(guildId, panel.id);
      if (r.ok) {
        onDelete();
        toast.success('Panel gelöscht');
      } else toast.error('Fehler', r.error);
    });
  };

  const btnCount = panel.buttons.length || 1;

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line bg-elev/30">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-fg truncate">{panel.title}</div>
          <div className="text-[11.5px] text-muted mt-0.5">
            <span className="text-accent-soft">#{channelName}</span> · Staff: {staffNames}
            {' · '}
            {panel.selectMenu?.enabled ? 'Dropdown' : `${btnCount} Button(s)`}
            {panel.feedbackEnabled && ' · Feedback'}
            {panel.inactivityHours && ` · ${panel.inactivityHours}h Inaktivität`}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Schließen' : 'Bearbeiten'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={remove} disabled={pending}>
            Löschen
          </Button>
        </div>
      </div>
      {editing && (
        <div className="p-4">
          <PanelEditor
            guildId={guildId}
            channels={channels}
            roles={roles}
            initial={panel}
            onSaved={(updated) => {
              onUpdate(updated);
              setEditing(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

// ============== Panel-Editor (Create + Update) ==============

function PanelEditor({
  guildId,
  channels,
  roles,
  initial,
  onSaved,
  onCancel,
}: {
  guildId: string;
  channels: Channel[];
  roles: Role[];
  initial: TicketPanelRow | null;
  onSaved: (panel: TicketPanelRow) => void;
  onCancel?: () => void;
}) {
  const [section, setSection] = useState<'basics' | 'embed' | 'buttons' | 'feedback' | 'reminder'>(
    'basics',
  );

  // Basics
  const [channelId, setChannelId] = useState(initial?.channelId ?? '');
  const [staffRoleIds, setStaffRoleIds] = useState<string[]>(
    initial?.staffRoleIds ?? (initial?.staffRoleId ? [initial.staffRoleId] : []),
  );
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [namePattern, setNamePattern] = useState(initial?.namePattern ?? 'ticket-{user}');

  // Embed
  const [title, setTitle] = useState(initial?.title ?? 'Support öffnen');
  const [description, setDescription] = useState(
    initial?.description ??
      'Klick den Button unten, um ein privates Ticket zu eröffnen. Nur du und das Staff-Team sehen es.',
  );
  const [color, setColor] = useState(intToHex(initial?.color));
  const [embedAuthor, setEmbedAuthor] = useState(initial?.embedPayload?.author ?? '');
  const [embedFooter, setEmbedFooter] = useState(initial?.embedPayload?.footer ?? '');
  const [embedImage, setEmbedImage] = useState(initial?.embedPayload?.imageUrl ?? '');
  const [embedThumb, setEmbedThumb] = useState(initial?.embedPayload?.thumbnailUrl ?? '');
  const [fields, setFields] = useState<PanelEmbedFieldAct[]>(
    initial?.embedPayload?.fields ?? [],
  );

  // Welcome (Legacy-Default für „default" Button)
  const [welcomeMessage, setWelcomeMessage] = useState(initial?.welcomeMessage ?? '');

  // Buttons
  const [buttons, setButtons] = useState<PanelButtonAct[]>(() => {
    if (initial?.buttons && initial.buttons.length > 0) return initial.buttons;
    if (initial) {
      return [
        {
          id: 'default',
          kind: 'ticket',
          label: initial.buttonLabel,
          emoji: initial.buttonEmoji,
          style: initial.buttonStyle,
        },
      ];
    }
    return [
      {
        id: newId(),
        kind: 'ticket',
        label: 'Ticket öffnen',
        style: 'primary',
      },
    ];
  });

  // Select-Menu
  const [selectEnabled, setSelectEnabled] = useState(initial?.selectMenu?.enabled ?? false);
  const [selectPlaceholder, setSelectPlaceholder] = useState(
    initial?.selectMenu?.placeholder ?? 'Kategorie wählen…',
  );

  // Feedback
  const [feedbackEnabled, setFeedbackEnabled] = useState(initial?.feedbackEnabled ?? false);
  const [feedbackMode, setFeedbackMode] = useState<FeedbackModeAct>(
    initial?.feedbackMode ?? 'dm',
  );
  const [feedbackQuestion, setFeedbackQuestion] = useState(
    initial?.feedbackQuestion ?? 'Wie zufrieden warst du mit dem Support?',
  );

  // Reminder
  const [inactivityHours, setInactivityHours] = useState<string>(
    initial?.inactivityHours != null ? String(initial.inactivityHours) : '',
  );
  const [autoCloseHours, setAutoCloseHours] = useState<string>(
    initial?.autoCloseHours != null ? String(initial.autoCloseHours) : '',
  );
  const [staffSlaMinutes, setStaffSlaMinutes] = useState<string>(
    initial?.staffSlaMinutes != null ? String(initial.staffSlaMinutes) : '',
  );

  const [pending, startTransition] = useTransition();

  const toggleStaffRole = (id: string) => {
    setStaffRoleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const submit = () => {
    if (!channelId || staffRoleIds.length === 0 || !title.trim()) {
      toast.error('Channel, mindestens eine Staff-Rolle und Titel sind nötig');
      return;
    }
    if (buttons.length === 0 && !selectEnabled) {
      toast.error('Mindestens einen Button oder das Dropdown aktivieren');
      return;
    }

    const colorInt = hexToInt(color);

    const embedPayload: PanelEmbedPayloadAct | null =
      embedAuthor || embedFooter || embedImage || embedThumb || fields.length > 0
        ? {
            color: colorInt,
            author: embedAuthor.trim() || null,
            footer: embedFooter.trim() || null,
            imageUrl: embedImage.trim() || null,
            thumbnailUrl: embedThumb.trim() || null,
            title: title.trim(),
            description: description.trim(),
            fields: fields.filter((f) => f.name.trim() || f.value.trim()),
          }
        : null;

    const ticketButtons = buttons.filter((b) => b.kind === 'ticket') as PanelTicketButtonAct[];
    const selectMenu: PanelSelectMenuAct | null =
      selectEnabled && ticketButtons.length > 0
        ? {
            enabled: true,
            placeholder: selectPlaceholder,
            options: ticketButtons.map((b) => ({
              label: b.label,
              description: null,
              emoji: b.emoji ?? null,
              buttonId: b.id,
            })),
          }
        : null;

    const firstTicket = ticketButtons[0];
    const payload: TicketPanelInput = {
      channelId,
      staffRoleIds,
      categoryId: categoryId.trim() || null,
      title,
      description,
      buttonLabel: firstTicket?.label ?? 'Ticket öffnen',
      buttonEmoji: firstTicket?.emoji ?? null,
      buttonStyle: firstTicket?.style ?? 'primary',
      color: colorInt,
      welcomeMessage: welcomeMessage.trim() || null,
      buttons,
      selectMenu,
      embedPayload,
      feedbackEnabled,
      feedbackMode,
      feedbackQuestion,
      inactivityHours: inactivityHours ? Math.max(0, Number(inactivityHours)) : null,
      autoCloseHours: autoCloseHours ? Math.max(0, Number(autoCloseHours)) : null,
      staffSlaMinutes: staffSlaMinutes ? Math.max(0, Number(staffSlaMinutes)) : null,
      namePattern,
    };

    startTransition(async () => {
      if (initial) {
        const r = await updateTicketPanelWeb(guildId, initial.id, payload);
        if (r.ok) {
          onSaved({
            ...initial,
            channelId,
            staffRoleIds,
            staffRoleId: staffRoleIds[0] ?? '',
            categoryId: payload.categoryId,
            title,
            description,
            buttonLabel: payload.buttonLabel,
            buttonEmoji: payload.buttonEmoji,
            buttonStyle: payload.buttonStyle,
            color: colorInt,
            welcomeMessage: payload.welcomeMessage,
            buttons,
            selectMenu,
            embedPayload,
            feedbackEnabled,
            feedbackMode,
            feedbackQuestion,
            inactivityHours: payload.inactivityHours,
            autoCloseHours: payload.autoCloseHours,
            staffSlaMinutes: payload.staffSlaMinutes,
            namePattern,
          });
          toast.success('Panel aktualisiert');
        } else toast.error('Fehler', r.error);
      } else {
        const r = await createTicketPanelWeb(guildId, payload);
        if (r.ok && r.id) {
          onSaved({
            id: r.id,
            messageId: '',
            channelId,
            staffRoleId: staffRoleIds[0] ?? '',
            staffRoleIds,
            categoryId: payload.categoryId,
            title,
            description,
            buttonLabel: payload.buttonLabel,
            buttonEmoji: payload.buttonEmoji,
            buttonStyle: payload.buttonStyle,
            color: colorInt,
            welcomeMessage: payload.welcomeMessage,
            buttons,
            selectMenu,
            embedPayload,
            feedbackEnabled,
            feedbackMode,
            feedbackQuestion,
            inactivityHours: payload.inactivityHours,
            autoCloseHours: payload.autoCloseHours,
            staffSlaMinutes: payload.staffSlaMinutes,
            namePattern,
          });
          toast.success('Panel angelegt + gepostet');
        } else toast.error('Fehler', r.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-line">
        {(['basics', 'embed', 'buttons', 'feedback', 'reminder'] as const).map((s) => (
          <TabBtn key={s} active={section === s} onClick={() => setSection(s)}>
            {s === 'basics'
              ? 'Basis'
              : s === 'embed'
              ? 'Embed'
              : s === 'buttons'
              ? `Buttons (${buttons.length})`
              : s === 'feedback'
              ? 'Feedback'
              : 'Reminder'}
          </TabBtn>
        ))}
      </div>

      {section === 'basics' && (
        <div className="space-y-3">
          {!initial && (
            <FormRow label="Channel (wo das Panel erscheint)" required>
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

          <FormRow
            label="Staff-Rollen (sehen alle Tickets)"
            hint="Mehrere möglich. Klick auf Chips zum An/Aus."
            required
          >
            <div className="flex flex-wrap gap-1.5">
              {roles.map((r) => {
                const active = staffRoleIds.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleStaffRole(r.id)}
                    className={`text-[12px] px-2.5 py-1 rounded-full border transition-colors ${
                      active
                        ? 'bg-accent text-white border-accent'
                        : 'bg-surface border-line text-fg-soft hover:border-line-strong'
                    }`}
                  >
                    {r.name}
                  </button>
                );
              })}
              {roles.length === 0 && (
                <span className="text-[12px] text-subtle">Keine Rollen geladen.</span>
              )}
            </div>
          </FormRow>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormRow label="Category-ID (optional)" hint="Wo neue Tickets entstehen">
              <input
                type="text"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value.trim())}
                placeholder="123456789012345678"
                className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              />
            </FormRow>
            <FormRow
              label="Channel-Name-Schema"
              hint="Platzhalter {user}. Max 50 Zeichen."
            >
              <input
                type="text"
                value={namePattern}
                onChange={(e) => setNamePattern(e.target.value.slice(0, 50))}
                placeholder="ticket-{user}"
                className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              />
            </FormRow>
          </div>

          <FormRow
            label="Default-Willkommens-Nachricht im Ticket"
            hint="Wird beim Öffnen im Ticket-Channel gepostet, wenn der Button keine eigene Welcome-Message hat. Platzhalter: {user} {mention}."
          >
            <textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value.slice(0, 2000))}
              rows={3}
              placeholder="Hi {mention}, beschreib dein Anliegen — das Staff-Team meldet sich gleich."
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y"
            />
          </FormRow>
        </div>
      )}

      {section === 'embed' && (
        <div className="space-y-3">
          <FormRow label="Titel" required>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 256))}
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            />
          </FormRow>

          <FormRow label="Beschreibung (Markdown OK)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 4000))}
              rows={4}
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y"
            />
          </FormRow>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormRow label="Embed-Farbe">
              <ColorPicker value={color} onChange={setColor} />
            </FormRow>
            <FormRow label="Author (optional)">
              <input
                type="text"
                value={embedAuthor}
                onChange={(e) => setEmbedAuthor(e.target.value.slice(0, 256))}
                className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              />
            </FormRow>
          </div>

          <FormRow label="Footer (optional)">
            <input
              type="text"
              value={embedFooter}
              onChange={(e) => setEmbedFooter(e.target.value.slice(0, 2048))}
              className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            />
          </FormRow>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormRow label="Bild-URL (großes Bild)">
              <input
                type="text"
                value={embedImage}
                onChange={(e) => setEmbedImage(e.target.value.trim())}
                placeholder="https://…"
                className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              />
            </FormRow>
            <FormRow label="Thumbnail-URL (klein, rechts oben)">
              <input
                type="text"
                value={embedThumb}
                onChange={(e) => setEmbedThumb(e.target.value.trim())}
                placeholder="https://…"
                className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              />
            </FormRow>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[12px] font-medium text-fg-soft">Felder / Trenner</div>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setFields((prev) => [...prev, { name: '', value: '', inline: false }])
                  }
                >
                  + Feld
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setFields((prev) => [...prev, { name: '​', value: '​', inline: false }])
                  }
                >
                  + Trenner
                </Button>
              </div>
            </div>
            {fields.length === 0 ? (
              <div className="text-[11.5px] text-subtle italic">Keine Felder.</div>
            ) : (
              <ul className="space-y-2">
                {fields.map((f, i) => (
                  <li
                    key={i}
                    className="rounded-md border border-line bg-elev/30 p-2.5 space-y-1.5"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={f.name}
                        onChange={(e) => {
                          const v = e.target.value.slice(0, 256);
                          setFields((prev) =>
                            prev.map((x, idx) => (idx === i ? { ...x, name: v } : x)),
                          );
                        }}
                        placeholder="Feld-Name"
                        className="rounded-md bg-elev border border-line-strong px-2.5 py-1.5 text-[12.5px] text-fg placeholder:text-subtle"
                      />
                      <input
                        type="text"
                        value={f.value}
                        onChange={(e) => {
                          const v = e.target.value.slice(0, 1024);
                          setFields((prev) =>
                            prev.map((x, idx) => (idx === i ? { ...x, value: v } : x)),
                          );
                        }}
                        placeholder="Feld-Wert"
                        className="rounded-md bg-elev border border-line-strong px-2.5 py-1.5 text-[12.5px] text-fg placeholder:text-subtle"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-[11.5px] text-muted">
                        <input
                          type="checkbox"
                          checked={Boolean(f.inline)}
                          onChange={(e) =>
                            setFields((prev) =>
                              prev.map((x, idx) =>
                                idx === i ? { ...x, inline: e.target.checked } : x,
                              ),
                            )
                          }
                        />
                        Inline
                      </label>
                      <button
                        type="button"
                        onClick={() => setFields((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-[11px] text-muted hover:text-danger transition-colors"
                      >
                        Entfernen
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Preview */}
          <div>
            <div className="text-[11.5px] font-medium text-muted mb-1.5">Vorschau</div>
            <div className="rounded-lg border border-line bg-elev/30 p-3.5">
              <div
                className="rounded border-l-4 bg-elev px-3.5 py-2.5"
                style={{ borderLeftColor: color }}
              >
                {embedAuthor && (
                  <div className="text-[11px] text-muted mb-1">{embedAuthor}</div>
                )}
                <div className="text-sm font-semibold text-fg mb-1">{title}</div>
                <div className="text-[12.5px] text-fg-soft whitespace-pre-wrap mb-2.5">
                  {description}
                </div>
                {fields.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                    {fields.map((f, i) => (
                      <div
                        key={i}
                        className={f.inline ? '' : 'sm:col-span-3'}
                      >
                        <div className="text-[11px] font-semibold text-fg">{f.name}</div>
                        <div className="text-[11.5px] text-fg-soft whitespace-pre-wrap">
                          {f.value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {(() => {
                  const safe = safeHttpUrl(embedImage);
                  return safe ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={safe} alt="" className="max-h-48 rounded mt-1" />
                  ) : null;
                })()}
                {embedFooter && (
                  <div className="text-[10.5px] text-subtle mt-2">{embedFooter}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {section === 'buttons' && (
        <ButtonsEditor
          buttons={buttons}
          setButtons={setButtons}
          channels={channels}
          roles={roles}
          selectEnabled={selectEnabled}
          setSelectEnabled={setSelectEnabled}
          selectPlaceholder={selectPlaceholder}
          setSelectPlaceholder={setSelectPlaceholder}
        />
      )}

      {section === 'feedback' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-line bg-elev/30 px-3 py-2.5">
            <div>
              <div className="text-[13px] font-medium text-fg">Feedback aktivieren</div>
              <div className="text-[11.5px] text-muted">
                Nach Close wird der User um eine Sterne-Bewertung gebeten.
              </div>
            </div>
            <Switch checked={feedbackEnabled} onChange={setFeedbackEnabled} size="sm" />
          </div>

          {feedbackEnabled && (
            <>
              <FormRow label="Wo fragen?">
                <div className="grid grid-cols-3 gap-1.5">
                  {(['dm', 'channel', 'both'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setFeedbackMode(m)}
                      className={`rounded-md border px-2 py-2 text-[12px] transition-colors ${
                        feedbackMode === m
                          ? 'bg-accent text-white border-accent'
                          : 'border-line bg-surface text-fg-soft hover:border-line-strong'
                      }`}
                    >
                      {m === 'dm' ? 'Per DM' : m === 'channel' ? 'Im Channel' : 'DM + Fallback'}
                    </button>
                  ))}
                </div>
              </FormRow>
              <FormRow label="Frage-Text">
                <input
                  type="text"
                  value={feedbackQuestion}
                  onChange={(e) => setFeedbackQuestion(e.target.value.slice(0, 200))}
                  className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                />
              </FormRow>
            </>
          )}
        </div>
      )}

      {section === 'reminder' && (
        <div className="space-y-3">
          <div className="text-[12px] text-muted">
            Leer = deaktiviert. Werte werden jede Minute geprüft.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormRow
              label="Inaktivitäts-Reminder (h)"
              hint="Pingt User wenn so lange keine Nachricht."
            >
              <input
                type="number"
                min="0"
                value={inactivityHours}
                onChange={(e) => setInactivityHours(e.target.value)}
                placeholder="z.B. 24"
                className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle"
              />
            </FormRow>
            <FormRow
              label="Auto-Close (h)"
              hint="Schließt Ticket automatisch nach Inaktivität."
            >
              <input
                type="number"
                min="0"
                value={autoCloseHours}
                onChange={(e) => setAutoCloseHours(e.target.value)}
                placeholder="z.B. 72"
                className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle"
              />
            </FormRow>
            <FormRow
              label="Staff-SLA (Min)"
              hint="Erinnert Staff wenn nicht innerhalb X Min geantwortet."
            >
              <input
                type="number"
                min="0"
                value={staffSlaMinutes}
                onChange={(e) => setStaffSlaMinutes(e.target.value)}
                placeholder="z.B. 30"
                className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle"
              />
            </FormRow>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 justify-end pt-2 border-t border-line">
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Abbrechen
          </Button>
        )}
        <Button type="button" size="sm" variant="primary" onClick={submit} loading={pending}>
          {initial ? 'Speichern' : 'Anlegen & posten'}
        </Button>
      </div>
    </div>
  );
}

// ============== Buttons-Editor ==============

function ButtonsEditor({
  buttons,
  setButtons,
  channels,
  roles,
  selectEnabled,
  setSelectEnabled,
  selectPlaceholder,
  setSelectPlaceholder,
}: {
  buttons: PanelButtonAct[];
  setButtons: (b: PanelButtonAct[]) => void;
  channels: Channel[];
  roles: Role[];
  selectEnabled: boolean;
  setSelectEnabled: (v: boolean) => void;
  selectPlaceholder: string;
  setSelectPlaceholder: (v: string) => void;
}) {
  const addTicket = () => {
    if (buttons.length >= 25) return toast.error('Max 25 Buttons');
    setButtons([
      ...buttons,
      { id: newId(), kind: 'ticket', label: 'Neuer Button', style: 'primary' },
    ]);
  };
  const addLink = () => {
    if (buttons.length >= 25) return toast.error('Max 25 Buttons');
    setButtons([
      ...buttons,
      { id: newId('l'), kind: 'link', label: 'Link', url: 'https://' },
    ]);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= buttons.length) return;
    const copy = buttons.slice();
    [copy[i], copy[j]] = [copy[j], copy[i]];
    setButtons(copy);
  };
  const remove = (i: number) => setButtons(buttons.filter((_, idx) => idx !== i));
  const update = (i: number, patch: Partial<PanelButtonAct>) => {
    setButtons(
      buttons.map((b, idx) =>
        idx === i ? ({ ...b, ...patch } as PanelButtonAct) : b,
      ),
    );
  };

  const ticketCount = buttons.filter((b) => b.kind === 'ticket').length;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-line bg-elev/30 px-3 py-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-fg">Als Dropdown anzeigen statt Buttons</div>
          <div className="text-[11.5px] text-muted">
            Bei vielen Kategorien übersichtlicher. Nur Ticket-Buttons werden als Optionen
            übernommen. Link-Buttons bleiben zusätzlich sichtbar.
          </div>
        </div>
        <Switch checked={selectEnabled} onChange={setSelectEnabled} size="sm" />
      </div>
      {selectEnabled && (
        <FormRow label="Dropdown-Placeholder">
          <input
            type="text"
            value={selectPlaceholder}
            onChange={(e) => setSelectPlaceholder(e.target.value.slice(0, 100))}
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
          />
        </FormRow>
      )}

      <div className="flex items-center justify-between">
        <div className="text-[12px] text-muted">
          {ticketCount} Ticket-Button(s), {buttons.length - ticketCount} Link(s)
        </div>
        <div className="flex gap-1.5">
          <Button type="button" size="sm" variant="ghost" onClick={addLink}>
            + Link
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={addTicket}>
            + Ticket-Button
          </Button>
        </div>
      </div>

      {buttons.length === 0 ? (
        <div className="rounded-md border border-dashed border-line-strong p-6 text-center text-[12px] text-subtle">
          Keine Buttons.
        </div>
      ) : (
        <ul className="space-y-2">
          {buttons.map((b, i) => (
            <li key={b.id} className="rounded-lg border border-line bg-surface p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold ${
                      b.kind === 'link'
                        ? 'bg-elev text-fg-soft border border-line'
                        : BUTTON_STYLES.find((s) => s.value === b.style)?.classes ??
                          BUTTON_STYLES[0].classes
                    }`}
                  >
                    {b.emoji && <span>{b.emoji}</span>}
                    {b.label || 'Button'}
                  </span>
                  <span className="text-[10.5px] text-subtle uppercase tracking-wider">
                    {b.kind === 'ticket' ? 'Ticket' : 'Link'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="text-muted hover:text-fg disabled:opacity-30 px-1 text-sm"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === buttons.length - 1}
                    className="text-muted hover:text-fg disabled:opacity-30 px-1 text-sm"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="text-muted hover:text-danger px-1 text-[11px]"
                  >
                    Entfernen
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={b.label}
                  onChange={(e) => update(i, { label: e.target.value.slice(0, 80) })}
                  placeholder="Label"
                  className="rounded-md bg-elev border border-line-strong px-2.5 py-1.5 text-[12.5px] text-fg placeholder:text-subtle"
                />
                <input
                  type="text"
                  value={b.emoji ?? ''}
                  onChange={(e) => update(i, { emoji: e.target.value.slice(0, 80) || null })}
                  placeholder="Emoji"
                  className="rounded-md bg-elev border border-line-strong px-2.5 py-1.5 text-[12.5px] text-fg placeholder:text-subtle"
                />
                {b.kind === 'ticket' ? (
                  <select
                    value={(b as PanelTicketButtonAct).style}
                    onChange={(e) =>
                      update(i, { style: e.target.value as ButtonStyle })
                    }
                    className="rounded-md bg-elev border border-line-strong px-2.5 py-1.5 text-[12.5px] text-fg"
                  >
                    {BUTTON_STYLES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={(b as PanelLinkButtonAct).url}
                    onChange={(e) => update(i, { url: e.target.value.trim() })}
                    placeholder="https://…"
                    className="rounded-md bg-elev border border-line-strong px-2.5 py-1.5 text-[12.5px] text-fg placeholder:text-subtle font-mono"
                  />
                )}
              </div>

              {b.kind === 'ticket' && (
                <details className="text-[12px]">
                  <summary className="cursor-pointer text-muted hover:text-fg-soft py-1">
                    Override (Kategorie, Staff-Rollen, Welcome-Message)
                  </summary>
                  <div className="mt-2 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={(b as PanelTicketButtonAct).categoryId ?? ''}
                        onChange={(e) =>
                          update(i, { categoryId: e.target.value.trim() || null })
                        }
                        placeholder="Eigene Category-ID"
                        className="rounded-md bg-elev border border-line-strong px-2.5 py-1.5 text-[12.5px] text-fg placeholder:text-subtle font-mono"
                      />
                      <input
                        type="text"
                        value={(b as PanelTicketButtonAct).namePattern ?? ''}
                        onChange={(e) =>
                          update(i, { namePattern: e.target.value.slice(0, 50) || null })
                        }
                        placeholder="Eigenes Namens-Schema"
                        className="rounded-md bg-elev border border-line-strong px-2.5 py-1.5 text-[12.5px] text-fg placeholder:text-subtle font-mono"
                      />
                    </div>
                    <div>
                      <div className="text-[11px] text-muted mb-1">
                        Eigene Staff-Rollen (überschreibt Panel-Default):
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {roles.map((r) => {
                          const active = (
                            (b as PanelTicketButtonAct).staffRoleIds ?? []
                          ).includes(r.id);
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => {
                                const cur = (b as PanelTicketButtonAct).staffRoleIds ?? [];
                                const next = active
                                  ? cur.filter((x) => x !== r.id)
                                  : [...cur, r.id];
                                update(i, { staffRoleIds: next });
                              }}
                              className={`text-[11px] px-2 py-0.5 rounded-full border ${
                                active
                                  ? 'bg-accent text-white border-accent'
                                  : 'bg-surface border-line text-fg-soft'
                              }`}
                            >
                              {r.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <textarea
                      value={(b as PanelTicketButtonAct).welcomeMessage ?? ''}
                      onChange={(e) =>
                        update(i, {
                          welcomeMessage: e.target.value.slice(0, 2000) || null,
                        })
                      }
                      rows={2}
                      placeholder="Eigene Willkommens-Nachricht (sonst Panel-Default)"
                      className="w-full rounded-md bg-elev border border-line-strong px-2.5 py-1.5 text-[12.5px] text-fg placeholder:text-subtle font-mono resize-y"
                    />
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
      {!channels && null}
    </div>
  );
}

// ============== Ticket-Liste (Open / Closed) ==============

function TicketListView({
  guildId,
  status,
}: {
  guildId: string;
  status: 'open' | 'closed';
}) {
  const [tickets, setTickets] = useState<TicketSummary[] | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const key = `${guildId}:${status}`;
  const loading = loadedKey !== key;

  useEffect(() => {
    let active = true;
    listTicketsForGuild(guildId, status).then((r) => {
      if (!active) return;
      if (r.ok && r.tickets) setTickets(r.tickets);
      setLoadedKey(key);
    });
    return () => {
      active = false;
    };
  }, [guildId, status, key]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[12.5px] text-subtle py-6">
        <Spinner size="xs" /> Lade…
      </div>
    );
  }
  if (!tickets || tickets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong p-10 text-center">
        <div className="text-sm text-fg-soft">
          {status === 'open' ? 'Keine offenen Tickets.' : 'Keine geschlossenen Tickets.'}
        </div>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {tickets.map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5"
          >
            {t.ownerAvatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={t.ownerAvatarUrl} alt="" className="h-8 w-8 rounded-full shrink-0" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-elev border border-line grid place-items-center text-[10px] text-muted shrink-0">
                {(t.ownerName ?? t.ownerUserId).slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium text-fg truncate">
                {t.ownerName ?? `(${t.ownerUserId})`}
              </div>
              <div className="text-[11px] text-muted">
                {new Date(t.createdAt).toLocaleString('de-DE')}
                {t.closedAt && (
                  <> · geschlossen {new Date(t.closedAt).toLocaleString('de-DE')}</>
                )}
              </div>
            </div>
            {status === 'closed' ? (
              t.hasTranscript ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setViewingId(t.id)}
                >
                  Transcript ansehen
                </Button>
              ) : (
                <StatusPill kind="neutral">Kein Transcript</StatusPill>
              )
            ) : (
              <StatusPill kind="success" dot>
                Offen
              </StatusPill>
            )}
          </li>
        ))}
      </ul>
      {viewingId && (
        <TranscriptViewer
          guildId={guildId}
          ticketId={viewingId}
          onClose={() => setViewingId(null)}
        />
      )}
    </>
  );
}

// ============== Feedback-View ==============

function FeedbackView({ guildId }: { guildId: string }) {
  const [data, setData] = useState<{ feedback: TicketFeedbackRow[]; avg: number } | null>(null);
  const [loadedGuild, setLoadedGuild] = useState<string | null>(null);
  const loading = loadedGuild !== guildId;

  useEffect(() => {
    let active = true;
    listTicketFeedbackForGuild(guildId).then((r) => {
      if (!active) return;
      if (r.ok) setData({ feedback: r.feedback ?? [], avg: r.avgRating ?? 0 });
      setLoadedGuild(guildId);
    });
    return () => {
      active = false;
    };
  }, [guildId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[12.5px] text-subtle py-6">
        <Spinner size="xs" /> Lade Feedback…
      </div>
    );
  }
  if (!data || data.feedback.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong p-10 text-center">
        <div className="text-sm text-fg-soft">
          Noch kein Feedback. Aktiviere es in einem Panel unter „Feedback&quot;.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-elev/30 px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-[12px] text-muted">Durchschnitt</div>
          <div className="text-2xl font-bold text-fg">
            {data.avg.toFixed(2)}{' '}
            <span className="text-[14px] font-normal text-muted">
              / 5 ({data.feedback.length})
            </span>
          </div>
        </div>
        <div className="text-2xl">{'⭐'.repeat(Math.round(data.avg))}</div>
      </div>
      <ul className="space-y-2">
        {data.feedback.map((f) => (
          <li key={f.id} className="rounded-lg border border-line bg-surface px-3 py-2.5">
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-medium text-fg">
                {'⭐'.repeat(f.rating)}
              </div>
              <div className="text-[10.5px] text-subtle font-mono">
                {new Date(f.createdAt).toLocaleString('de-DE')}
              </div>
            </div>
            {f.comment && (
              <div className="text-[12.5px] text-fg-soft mt-1 whitespace-pre-wrap">
                {f.comment}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============== Transcript-Viewer (Modal) ==============

function TranscriptViewer({
  guildId,
  ticketId,
  onClose,
}: {
  guildId: string;
  ticketId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<{
    ticket?: TicketSummary;
    messages?: TranscriptMessageAct[];
  } | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const loading = loadedId !== ticketId;

  useEffect(() => {
    let active = true;
    getTicketTranscript(guildId, ticketId).then((r) => {
      if (!active) return;
      if (r.ok) {
        setData({ ticket: r.ticket, messages: r.messages });
      }
      setLoadedId(ticketId);
    });
    return () => {
      active = false;
    };
  }, [guildId, ticketId]);

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-toast-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] rounded-xl bg-surface border border-line shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line bg-elev/40">
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-fg">
              Transcript {data?.ticket?.ownerName && `· ${data.ticket.ownerName}`}
            </div>
            {data?.ticket && (
              <div className="text-[11px] text-muted mt-0.5">
                {new Date(data.ticket.createdAt).toLocaleString('de-DE')}
                {data.ticket.closedAt && (
                  <> → {new Date(data.ticket.closedAt).toLocaleString('de-DE')}</>
                )}{' '}
                · {data?.messages?.length ?? 0} Nachrichten
              </div>
            )}
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            ×
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center gap-2 text-[12.5px] text-subtle py-6">
              <Spinner size="xs" /> Lade Transcript…
            </div>
          ) : !data?.messages || data.messages.length === 0 ? (
            <div className="text-center text-[12.5px] text-subtle py-10">
              Keine Nachrichten im Transcript.
            </div>
          ) : (
            <ul className="space-y-3">
              {data.messages.map((m) => (
                <li key={m.id} className="flex gap-2.5">
                  {m.author.avatarUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={m.author.avatarUrl}
                      alt=""
                      className="h-8 w-8 rounded-full shrink-0"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-elev border border-line shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] font-semibold text-fg">
                        {m.author.username}
                      </span>
                      <span className="text-[10.5px] text-subtle font-mono">
                        {new Date(m.timestamp).toLocaleString('de-DE')}
                      </span>
                    </div>
                    {m.content && (
                      <div className="text-[13px] text-fg-soft whitespace-pre-wrap mt-0.5">
                        {m.content}
                      </div>
                    )}
                    {m.attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {m.attachments.map((a, i) => (
                          <a
                            key={i}
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-[11.5px] text-accent-soft hover:underline"
                          >
                            📎 {a.name}
                          </a>
                        ))}
                      </div>
                    )}
                    {m.embedsCount > 0 && (
                      <div className="text-[10.5px] text-subtle mt-1 italic">
                        + {m.embedsCount} Embed{m.embedsCount === 1 ? '' : 's'}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
