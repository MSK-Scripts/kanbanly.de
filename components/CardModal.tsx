'use client';
import { useEffect, useState } from 'react';
import { useBoard } from '@/store/boardStore';
import { Avatar } from './Avatar';
import { LabelsPicker } from './LabelsPicker';
import { DescriptionEditor } from './DescriptionEditor';
import { ActivityLog } from './ActivityLog';
import { CardComments } from './CardComments';
import { CustomFieldsSection } from './CustomFieldsSection';
import { CardLinksSection } from './CardLinksSection';
import { CardSubscribeButton } from './CardSubscribeButton';
import {
  aiImproveDescription,
  aiSuggestSubtasks,
} from '@/app/(app)/ai-actions';

export function CardModal() {
  const openCardId = useBoard((s) => s.openCardId);
  const setOpenCardId = useBoard((s) => s.setOpenCardId);
  const boardId = useBoard((s) => s.boardId);
  const card = useBoard((s) => (openCardId ? s.cards[openCardId] : null));
  const assignees =
    useBoard((s) => (openCardId ? s.assignees[openCardId] : undefined)) ?? [];
  const memberProfiles = useBoard((s) => s.memberProfiles);
  const memberOrder = useBoard((s) => s.memberOrder);
  const updateCardTitle = useBoard((s) => s.updateCardTitle);
  const updateCardDescription = useBoard((s) => s.updateCardDescription);
  const updateCardDueDate = useBoard((s) => s.updateCardDueDate);
  const archiveCard = useBoard((s) => s.archiveCard);
  const addTask = useBoard((s) => s.addTask);
  const toggleTask = useBoard((s) => s.toggleTask);
  const deleteTask = useBoard((s) => s.deleteTask);
  const toggleAssignee = useBoard((s) => s.toggleAssignee);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [aiDescBusy, setAiDescBusy] = useState(false);
  const [aiTasksBusy, setAiTasksBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description ?? '');
    } else {
      setTitle('');
      setDescription('');
      setNewTaskTitle('');
    }
  }, [card?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!openCardId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenCardId(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openCardId, setOpenCardId]);

  if (!openCardId || !card) return null;

  const close = () => setOpenCardId(null);
  const saveTitle = () => updateCardTitle(openCardId, title);
  const saveDescription = () => updateCardDescription(openCardId, description);

  const doneCount = card.tasks.filter((t) => t.done).length;
  const total = card.tasks.length;
  const progress = total ? (doneCount / total) * 100 : 0;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4"
      onClick={close}
    >
      <div
        className="w-full max-w-5xl h-[calc(100vh-2rem)] md:h-[min(90vh,900px)] rounded-md bg-surface border border-line shadow-md flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-line flex items-start gap-3 shrink-0">
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveTitle();
                (e.currentTarget as HTMLTextAreaElement).blur();
              }
            }}
            rows={1}
            className="flex-1 text-lg font-semibold text-fg bg-transparent resize-none focus:outline-none focus:ring-1 focus:ring-accent-hover/60 rounded px-1 -mx-1 leading-snug"
          />
          <button
            type="button"
            onClick={close}
            className="text-subtle hover:text-fg-soft text-2xl leading-none shrink-0"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_minmax(320px,400px)] min-h-0 overflow-hidden">
          <div className="overflow-y-auto board-scroll md:border-r border-line">
            <section className="p-5 border-b border-line">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide">
                  Zugewiesen
                </h3>
                <button
                  type="button"
                  onClick={() => setPickerOpen((v) => !v)}
                  className="text-xs text-accent-soft hover:text-accent-hover"
                >
                  {pickerOpen ? 'Fertig' : '+ Zuweisen'}
                </button>
              </div>

              {assignees.length === 0 && !pickerOpen ? (
                <p className="text-xs text-subtle">Niemand zugewiesen.</p>
              ) : (
                <div className="flex flex-wrap gap-2 mb-2">
                  {assignees.map((uid) => {
                    const m = memberProfiles[uid];
                    const label = m?.username ? `@${m.username}` : 'User';
                    return (
                      <span
                        key={uid}
                        className="inline-flex items-center gap-1.5 rounded-full bg-elev border border-line-strong pl-0.5 pr-2 py-0.5 text-xs text-fg-soft"
                      >
                        <Avatar username={m?.username ?? null} size="xs" />
                        {label}
                      </span>
                    );
                  })}
                </div>
              )}

              {pickerOpen && (
                <div className="mt-1 rounded-md bg-elev border border-line-strong max-h-52 overflow-y-auto divide-y divide-line">
                  {memberOrder.length === 0 ? (
                    <p className="p-3 text-xs text-subtle">
                      Keine Mitglieder verfügbar.
                    </p>
                  ) : (
                    memberOrder.map((uid) => {
                      const m = memberProfiles[uid];
                      const assigned = assignees.includes(uid);
                      return (
                        <button
                          key={uid}
                          type="button"
                          onClick={() => toggleAssignee(openCardId, uid)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-fg-soft hover:bg-elev transition-colors"
                        >
                          <Avatar username={m?.username ?? null} size="sm" />
                          <span className="flex-1">
                            {m?.username ? `@${m.username}` : 'User'}
                            <span className="ml-2 text-[10px] text-subtle uppercase">
                              {m?.role}
                            </span>
                          </span>
                          <span
                            className={`h-4 w-4 rounded border transition-colors ${
                              assigned
                                ? 'bg-emerald-500/80 border-emerald-400'
                                : 'border-muted'
                            }`}
                          />
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </section>

            <section className="p-5 border-b border-line">
              <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">
                Labels
              </h3>
              <LabelsPicker cardId={openCardId} />
            </section>

            <section className="p-5 border-b border-line">
              <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">
                Fällig am
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={card.due_date ?? ''}
                  onChange={(e) =>
                    updateCardDueDate(openCardId, e.target.value || null)
                  }
                  className="rounded-md bg-elev border border-line-strong px-3 py-1.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent-hover/60 [color-scheme:dark]"
                />
                {card.due_date && (
                  <button
                    type="button"
                    onClick={() => updateCardDueDate(openCardId, null)}
                    className="text-xs text-muted hover:text-rose-600 dark:text-rose-400 transition-colors"
                  >
                    Entfernen
                  </button>
                )}
              </div>
            </section>

            <section className="p-5 border-b border-line">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide">
                  Beschreibung
                </h3>
                <button
                  type="button"
                  disabled={aiDescBusy || !title.trim()}
                  onClick={async () => {
                    setAiDescBusy(true);
                    setAiError(null);
                    const res = await aiImproveDescription(title, description);
                    setAiDescBusy(false);
                    if (res.ok) {
                      setDescription(res.description);
                      updateCardDescription(openCardId, res.description);
                    } else {
                      setAiError(res.error);
                    }
                  }}
                  className="text-[11px] text-accent-soft hover:text-accent-hover disabled:opacity-50 disabled:cursor-wait"
                >
                  {aiDescBusy ? '✨ KI denkt…' : '✨ Mit KI verbessern'}
                </button>
              </div>
              <DescriptionEditor
                value={description}
                onChange={setDescription}
                onBlur={saveDescription}
                placeholder="Details, Links, Notizen… **Markdown** unterstützt."
              />
            </section>

            <section className="p-5 border-b border-line">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide">
                  Checkliste
                </h3>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={aiTasksBusy || !title.trim()}
                    onClick={async () => {
                      setAiTasksBusy(true);
                      setAiError(null);
                      const res = await aiSuggestSubtasks(title, description);
                      setAiTasksBusy(false);
                      if (res.ok) {
                        for (const t of res.tasks) {
                          await addTask(openCardId, t);
                        }
                      } else {
                        setAiError(res.error);
                      }
                    }}
                    className="text-[11px] text-accent-soft hover:text-accent-hover disabled:opacity-50 disabled:cursor-wait"
                  >
                    {aiTasksBusy ? '✨ KI denkt…' : '✨ Subtasks vorschlagen'}
                  </button>
                  {total > 0 && (
                    <span className="text-[11px] text-subtle tabular-nums font-mono">
                      {doneCount}/{total}
                    </span>
                  )}
                </div>
              </div>
              {aiError && (
                <div className="mb-2 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-[11px] px-2 py-1">
                  {aiError}
                </div>
              )}

              {total > 0 && (
                <div className="h-1.5 w-full rounded-full bg-elev overflow-hidden mb-3">
                  <div
                    className="h-full bg-accent transition-[width] duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              <ul className="space-y-1.5">
                {card.tasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 group">
                    <button
                      type="button"
                      onClick={() => toggleTask(openCardId, t.id)}
                      className="shrink-0"
                      aria-label={t.done ? 'Abwählen' : 'Abhaken'}
                    >
                      <span
                        className={`block h-4 w-4 rounded border transition-colors ${
                          t.done
                            ? 'bg-emerald-500/80 border-emerald-400'
                            : 'border-muted hover:border-fg-soft'
                        }`}
                      />
                    </button>
                    <span
                      className={`flex-1 text-sm ${
                        t.done ? 'line-through text-subtle' : 'text-fg-soft'
                      }`}
                    >
                      {t.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteTask(openCardId, t.id)}
                      className="opacity-0 group-hover:opacity-100 text-subtle hover:text-rose-600 dark:text-rose-400 text-sm shrink-0 transition-opacity"
                      aria-label="Löschen"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const t = newTaskTitle.trim();
                  if (!t) return;
                  addTask(openCardId, t);
                  setNewTaskTitle('');
                }}
                className="mt-3 flex gap-2"
              >
                <input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Neuer Task…"
                  className="flex-1 rounded-md bg-elev border border-line-strong px-3 py-1.5 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent-hover/60"
                />
                <button
                  type="submit"
                  className="rounded-md bg-accent hover:bg-accent-hover text-white text-xs font-medium px-4 transition-colors"
                >
                  Hinzufügen
                </button>
              </form>
            </section>

            {boardId && (
              <CustomFieldsSection cardId={openCardId} boardId={boardId} />
            )}

            <CardLinksSection cardId={openCardId} />

            <div className="p-5 flex items-center justify-between">
              <CardSubscribeButton cardId={openCardId} />
              <button
                type="button"
                onClick={() => archiveCard(openCardId)}
                className="text-xs text-muted hover:text-fg transition-colors"
              >
                Karte archivieren
              </button>
            </div>
          </div>

          <div className="flex flex-col min-h-0 border-t md:border-t-0 border-line">
            <section className="flex-1 min-h-0 flex flex-col p-5 border-b border-line">
              <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-3 shrink-0">
                Kommentare
              </h3>
              <div className="flex-1 min-h-0 overflow-y-auto board-scroll -mr-2 pr-2">
                <CardComments cardId={openCardId} />
              </div>
            </section>

            <section className="flex flex-col min-h-0 max-h-[45%] p-5">
              <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-3 shrink-0">
                Aktivität
              </h3>
              <div className="flex-1 min-h-0 overflow-y-auto board-scroll -mr-2 pr-2">
                <ActivityLog cardId={openCardId} />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
