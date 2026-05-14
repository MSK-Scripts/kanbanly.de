'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  createTicketPanelWeb,
  updateTicketPanelWeb,
  deleteTicketPanelWeb,
  listTicketsForGuild,
  getTicketTranscript,
  type TicketPanelRow,
  type TicketSummary,
  type TranscriptMessageAct,
} from '@/app/(app)/integrations/discord/[guildId]/actions';
import { toast } from '@/store/toastStore';
import { confirm } from '@/store/confirmStore';
import { Button } from './ui/Button';
import { ColorPicker } from './ui/ColorPicker';
import { FormSection, FormRow } from './ui/FormSection';
import { Spinner } from './ui/Spinner';
import { StatusPill, StatusBanner } from './ui/Status';

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

export function TicketsForm({ guildId, channels, roles, initialPanels }: Props) {
  const [panels, setPanels] = useState(initialPanels);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<'panels' | 'open' | 'closed'>('panels');

  return (
    <div className="space-y-5">
      <StatusBanner kind="info">
        Tickets sind private Channels zwischen User + Staff-Rolle. Panels haben
        einen „Ticket öffnen"-Button — Klick erstellt einen Channel. Beim
        Schließen wird ein Transcript gespeichert und der Channel gelöscht.
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
                onDelete={() =>
                  setPanels((prev) => prev.filter((x) => x.id !== p.id))
                }
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

// ============== Panel-Card mit Inline-Editor ==============

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
  const channelName =
    channels.find((c) => c.id === panel.channelId)?.name ?? panel.channelId;
  const role = roles.find((r) => r.id === panel.staffRoleId);
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

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line bg-elev/30">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-fg truncate">
            {panel.title}
          </div>
          <div className="text-[11.5px] text-muted mt-0.5">
            <span className="text-accent-soft">#{channelName}</span> · Staff:{' '}
            {role?.name ?? `(${panel.staffRoleId})`}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? 'Schließen' : 'Bearbeiten'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={remove}
            disabled={pending}
          >
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
  const [channelId, setChannelId] = useState(initial?.channelId ?? '');
  const [staffRoleId, setStaffRoleId] = useState(initial?.staffRoleId ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [title, setTitle] = useState(initial?.title ?? 'Support öffnen');
  const [description, setDescription] = useState(
    initial?.description ??
      'Klick den Button unten, um ein privates Ticket zu eröffnen. Nur du und das Staff-Team sehen es.',
  );
  const [buttonLabel, setButtonLabel] = useState(
    initial?.buttonLabel ?? 'Ticket öffnen',
  );
  const [buttonEmoji, setButtonEmoji] = useState(initial?.buttonEmoji ?? '');
  const [buttonStyle, setButtonStyle] = useState<ButtonStyle>(
    initial?.buttonStyle ?? 'primary',
  );
  const [color, setColor] = useState(
    initial?.color !== undefined && initial?.color !== null
      ? '#' + initial.color.toString(16).padStart(6, '0')
      : '#380D52',
  );
  const [welcomeMessage, setWelcomeMessage] = useState(
    initial?.welcomeMessage ?? '',
  );
  const [pending, startTransition] = useTransition();

  const activeStyle = BUTTON_STYLES.find((s) => s.value === buttonStyle)!;
  const colorInt = /^#?[0-9a-f]{6}$/i.test(color)
    ? parseInt(color.replace('#', ''), 16)
    : null;

  const submit = () => {
    if (!channelId || !staffRoleId || !title.trim()) {
      toast.error('Channel, Staff-Rolle und Titel nötig');
      return;
    }
    const payload = {
      title,
      description,
      buttonLabel,
      buttonEmoji: buttonEmoji || null,
      buttonStyle,
      color: colorInt,
      welcomeMessage: welcomeMessage || null,
      staffRoleId,
      categoryId: categoryId || null,
    };
    startTransition(async () => {
      if (initial) {
        const r = await updateTicketPanelWeb(guildId, initial.id, payload);
        if (r.ok) {
          onSaved({ ...initial, ...payload, buttonEmoji: payload.buttonEmoji });
          toast.success('Panel aktualisiert');
        } else toast.error('Fehler', r.error);
      } else {
        const r = await createTicketPanelWeb(guildId, { channelId, ...payload });
        if (r.ok && r.id) {
          onSaved({
            id: r.id,
            channelId,
            messageId: '',
            ...payload,
          });
          toast.success('Panel angelegt + gepostet');
        } else toast.error('Fehler', r.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      {!initial && (
        <FormRow label="Channel (wo das Panel erscheint)" required>
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
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormRow label="Staff-Rolle (sieht alle Tickets)" required>
          <select
            value={staffRoleId}
            onChange={(e) => setStaffRoleId(e.target.value)}
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
          >
            <option value="">— Rolle wählen —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Category-ID (optional)" hint="Wo neue Tickets entstehen">
          <input
            type="text"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value.trim())}
            placeholder="123456789012345678"
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
          />
        </FormRow>
      </div>

      <FormRow label="Panel-Titel" required>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 256))}
          className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
        />
      </FormRow>

      <FormRow label="Panel-Beschreibung">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
          rows={3}
          className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y transition-all"
        />
      </FormRow>

      <FormRow label="Embed-Farbe">
        <ColorPicker value={color} onChange={setColor} />
      </FormRow>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormRow label="Button-Label">
          <input
            type="text"
            value={buttonLabel}
            onChange={(e) => setButtonLabel(e.target.value.slice(0, 80))}
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
          />
        </FormRow>
        <FormRow label="Button-Emoji (optional)" hint="Unicode oder <:name:id>">
          <input
            type="text"
            value={buttonEmoji}
            onChange={(e) => setButtonEmoji(e.target.value.slice(0, 80))}
            placeholder="z.B. 🎫"
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

      <FormRow
        label="Willkommens-Nachricht im Ticket"
        hint="Wird beim Öffnen im Ticket-Channel gepostet. Platzhalter: {user} {mention}. Leer = Default."
      >
        <textarea
          value={welcomeMessage}
          onChange={(e) => setWelcomeMessage(e.target.value.slice(0, 2000))}
          rows={3}
          placeholder="Hi {mention}, beschreib dein Anliegen — das Staff-Team meldet sich gleich."
          className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y transition-all"
        />
      </FormRow>

      <div>
        <div className="text-[11.5px] font-medium text-muted mb-1.5">Vorschau</div>
        <div className="rounded-lg border border-line bg-elev/30 p-3.5">
          <div
            className="rounded border-l-4 bg-elev px-3.5 py-2.5"
            style={{ borderLeftColor: color }}
          >
            <div className="text-sm font-semibold text-fg mb-1">{title}</div>
            <div className="text-[12.5px] text-fg-soft whitespace-pre-wrap mb-2.5">
              {description}
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[12px] font-semibold ${activeStyle.classes}`}
            >
              {buttonEmoji && <span>{buttonEmoji}</span>}
              {buttonLabel || 'Button'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end">
        {onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Abbrechen
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={submit}
          loading={pending}
        >
          {initial ? 'Speichern' : 'Anlegen & posten'}
        </Button>
      </div>
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
  const [loading, setLoading] = useState(true);
  const [viewingId, setViewingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listTicketsForGuild(guildId, status).then((r) => {
      if (r.ok && r.tickets) setTickets(r.tickets);
      setLoading(false);
    });
  }, [guildId, status]);

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
              <img
                src={t.ownerAvatarUrl}
                alt=""
                className="h-8 w-8 rounded-full shrink-0"
              />
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getTicketTranscript(guildId, ticketId).then((r) => {
      if (r.ok) {
        setData({ ticket: r.ticket, messages: r.messages });
      }
      setLoading(false);
    });
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
