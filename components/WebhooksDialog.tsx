'use client';
import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import {
  getBoardWebhook,
  saveBoardWebhook,
  updateBoardWebhookSettings,
  deleteBoardWebhook,
  testBoardWebhook,
} from '@/app/(app)/webhook-actions';
import { confirm } from '@/store/confirmStore';

type Props = {
  boardId: string;
  onClose: () => void;
};

type EventGroup = { label: string; events: Array<{ key: string; label: string }> };

const EVENT_GROUPS: EventGroup[] = [
  {
    label: 'Karten',
    events: [
      { key: 'card_created', label: 'Neue Karte' },
      { key: 'card_moved', label: 'Karte verschoben' },
      { key: 'card_renamed', label: 'Karte umbenannt' },
      { key: 'card_deleted', label: 'Karte gelöscht' },
      { key: 'card_due_set', label: 'Fälligkeit gesetzt' },
      { key: 'card_due_cleared', label: 'Fälligkeit entfernt' },
    ],
  },
  {
    label: 'Tasks',
    events: [
      { key: 'task_added', label: 'Neuer Task' },
      { key: 'task_done', label: 'Task abgehakt' },
      { key: 'task_undone', label: 'Task wieder offen' },
      { key: 'task_deleted', label: 'Task gelöscht' },
    ],
  },
  {
    label: 'Labels & Zuweisungen',
    events: [
      { key: 'label_added', label: 'Label hinzugefügt' },
      { key: 'label_removed', label: 'Label entfernt' },
      { key: 'assignee_added', label: 'Zuweisung hinzugefügt' },
      { key: 'assignee_removed', label: 'Zuweisung entfernt' },
    ],
  },
  {
    label: 'Kommentare',
    events: [
      { key: 'comment_added', label: 'Neuer Kommentar' },
      { key: 'comment_deleted', label: 'Kommentar gelöscht' },
    ],
  },
];

function maskUrl(url: string): string {
  // https://discord.com/api/webhooks/ID/TOKEN → show host + last 6 of token
  const m = url.match(
    /^(https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\/)(\d+)\/([A-Za-z0-9_-]+)$/
  );
  if (!m) return '•••••';
  const [, prefix, , token] = m;
  const last = token.slice(-6);
  return `${prefix}•••/•••${last}`;
}

export function WebhooksDialog({ boardId, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [editingUrl, setEditingUrl] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [events, setEvents] = useState<string[]>([]);
  const [message, setMessage] = useState<
    { kind: 'ok' | 'err'; text: string } | null
  >(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing = await getBoardWebhook(boardId);
      if (cancelled) return;
      if (existing) {
        setSavedUrl(existing.url);
        setEnabled(existing.enabled);
        setEvents(existing.events);
      } else {
        setEditingUrl(true);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  if (!mounted) return null;

  const toggleEvent = (e: string) =>
    setEvents((cur) =>
      cur.includes(e) ? cur.filter((x) => x !== e) : [...cur, e]
    );

  const saveUrl = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await saveBoardWebhook(
        boardId,
        urlInput.trim(),
        enabled,
        events
      );
      if (res.ok) {
        setSavedUrl(urlInput.trim());
        setUrlInput('');
        setEditingUrl(false);
        setRevealed(false);
        setMessage({ kind: 'ok', text: 'URL gespeichert.' });
      } else {
        setMessage({ kind: 'err', text: res.error });
      }
    });
  };

  const saveSettings = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await updateBoardWebhookSettings(boardId, enabled, events);
      if (res.ok) setMessage({ kind: 'ok', text: 'Einstellungen gespeichert.' });
      else setMessage({ kind: 'err', text: res.error });
    });
  };

  const test = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await testBoardWebhook(boardId);
      if (res.ok)
        setMessage({ kind: 'ok', text: 'Test-Nachricht gesendet. Check Discord.' });
      else setMessage({ kind: 'err', text: res.error });
    });
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Webhook entfernen?',
      description: 'Ab sofort werden keine Board-Events mehr an Discord gesendet.',
      confirmLabel: 'Entfernen',
      danger: true,
    });
    if (!ok) return;
    setMessage(null);
    startTransition(async () => {
      const res = await deleteBoardWebhook(boardId);
      if (res.ok) {
        setSavedUrl(null);
        setUrlInput('');
        setEditingUrl(true);
        setRevealed(false);
        setMessage({ kind: 'ok', text: 'Webhook entfernt.' });
      } else {
        setMessage({ kind: 'err', text: res.error });
      }
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl max-h-[90vh] rounded-2xl bg-surface border border-line shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-fg">Discord-Webhook</h2>
            <p className="text-xs text-muted mt-0.5">
              Wähl aus, welche Board-Events in deinem Channel landen.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="text-subtle hover:text-fg-soft text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="p-5 text-xs text-subtle">Lade…</div>
        ) : (
          <div className="p-5 space-y-5 overflow-y-auto board-scroll min-h-0">
            <div>
              <label className="block text-xs text-muted mb-1">
                Webhook-URL
              </label>
              {savedUrl && !editingUrl ? (
                <div className="flex items-center gap-2 rounded-lg bg-elev/60 border border-line-strong px-3 py-1.5">
                  <span className="flex-1 text-xs font-mono text-fg-soft truncate">
                    {revealed ? savedUrl : maskUrl(savedUrl)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRevealed((v) => !v)}
                    className="text-[11px] text-muted hover:text-fg-soft shrink-0"
                  >
                    {revealed ? 'Verbergen' : 'Anzeigen'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingUrl(true);
                      setUrlInput('');
                      setRevealed(false);
                    }}
                    className="text-[11px] text-accent-soft hover:text-accent-hover shrink-0"
                  >
                    Ändern
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/…/…"
                    autoFocus
                    className="flex-1 rounded-lg bg-elev/80 border border-line-strong px-3 py-1.5 text-xs font-mono text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent-hover/60"
                  />
                  <button
                    type="button"
                    onClick={saveUrl}
                    disabled={pending || !urlInput.trim()}
                    className="rounded-lg bg-accent/90 hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5"
                  >
                    {pending ? '…' : savedUrl ? 'Ersetzen' : 'Speichern'}
                  </button>
                  {savedUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingUrl(false);
                        setUrlInput('');
                      }}
                      className="text-[11px] text-muted hover:text-fg-soft px-2"
                    >
                      Zurück
                    </button>
                  )}
                </div>
              )}
              <p className="text-[11px] text-subtle mt-1 leading-relaxed">
                In Discord: Channel → Einstellungen → Integrationen → Webhooks
                → „Neuer Webhook" → URL kopieren.
              </p>
            </div>

            {savedUrl && (
              <>
                <div>
                  <p className="text-xs text-muted mb-2">Events</p>
                  <div className="space-y-3">
                    {EVENT_GROUPS.map((g) => (
                      <div key={g.label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <h4 className="text-[10px] font-semibold text-subtle uppercase tracking-wide">
                            {g.label}
                          </h4>
                          <button
                            type="button"
                            onClick={() => {
                              const all = g.events.map((e) => e.key);
                              const allOn = all.every((k) => events.includes(k));
                              if (allOn) {
                                setEvents((cur) =>
                                  cur.filter((k) => !all.includes(k))
                                );
                              } else {
                                setEvents((cur) =>
                                  Array.from(new Set([...cur, ...all]))
                                );
                              }
                            }}
                            className="text-[10px] text-muted hover:text-accent-soft"
                          >
                            Alle
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {g.events.map((e) => {
                            const on = events.includes(e.key);
                            return (
                              <label
                                key={e.key}
                                className={`inline-flex items-center gap-1.5 cursor-pointer rounded-md border px-2 py-1 text-[11px] transition-colors ${
                                  on
                                    ? 'bg-accent/15 border-accent-hover/50 text-fg'
                                    : 'bg-elev/50 border-line-strong text-muted hover:text-fg-soft'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={() => toggleEvent(e.key)}
                                  className="h-3 w-3 accent-accent"
                                />
                                <span>{e.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="h-4 w-4 accent-accent"
                  />
                  <span className="text-xs text-fg-soft">
                    Webhook aktiv
                    <span className="block text-[11px] text-subtle">
                      Bei „aus" bleibt die URL gespeichert, aber nichts wird gesendet.
                    </span>
                  </span>
                </label>
              </>
            )}

            {message && (
              <div
                className={`rounded-md text-xs px-3 py-2 border ${
                  message.kind === 'ok'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
                }`}
              >
                {message.text}
              </div>
            )}
          </div>
        )}

        {savedUrl && !editingUrl && (
          <div className="px-5 py-3 border-t border-line flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={saveSettings}
              disabled={pending}
              className="rounded-lg bg-accent/90 hover:bg-accent-hover disabled:opacity-60 text-white text-xs font-medium px-3 py-2"
            >
              {pending ? 'Speichere…' : 'Events speichern'}
            </button>
            <button
              type="button"
              onClick={test}
              disabled={pending}
              className="rounded-lg border border-line-strong hover:border-fg-soft bg-elev/60 hover:bg-elev disabled:opacity-50 text-fg-soft hover:text-fg text-xs font-medium px-3 py-2"
            >
              Test senden
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="rounded-lg text-xs text-muted hover:text-rose-600 dark:hover:text-rose-300 px-3 py-2 ml-auto disabled:opacity-50"
            >
              Webhook entfernen
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
