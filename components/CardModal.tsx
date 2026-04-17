'use client';
import { useEffect, useState } from 'react';
import { useBoard } from '@/store/boardStore';
import { Avatar } from './Avatar';

export function CardModal() {
  const openCardId = useBoard((s) => s.openCardId);
  const setOpenCardId = useBoard((s) => s.setOpenCardId);
  const card = useBoard((s) => (openCardId ? s.cards[openCardId] : null));
  const assignees =
    useBoard((s) => (openCardId ? s.assignees[openCardId] : undefined)) ?? [];
  const memberProfiles = useBoard((s) => s.memberProfiles);
  const memberOrder = useBoard((s) => s.memberOrder);
  const updateCardTitle = useBoard((s) => s.updateCardTitle);
  const updateCardDescription = useBoard((s) => s.updateCardDescription);
  const deleteCard = useBoard((s) => s.deleteCard);
  const addTask = useBoard((s) => s.addTask);
  const toggleTask = useBoard((s) => s.toggleTask);
  const deleteTask = useBoard((s) => s.deleteTask);
  const toggleAssignee = useBoard((s) => s.toggleAssignee);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

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
      className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={close}
    >
      <div
        className="w-full max-w-lg mt-10 mb-10 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-800 flex items-start gap-3">
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
            className="flex-1 text-lg font-semibold text-slate-100 bg-transparent resize-none focus:outline-none focus:ring-1 focus:ring-violet-400/60 rounded px-1 -mx-1 leading-snug"
          />
          <button
            type="button"
            onClick={close}
            className="text-slate-500 hover:text-slate-200 text-2xl leading-none shrink-0"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        <section className="p-5 border-b border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
              Zugewiesen
            </h3>
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className="text-xs text-violet-300 hover:text-violet-200"
            >
              {pickerOpen ? 'Fertig' : '+ Zuweisen'}
            </button>
          </div>

          {assignees.length === 0 && !pickerOpen ? (
            <p className="text-xs text-slate-500">Niemand zugewiesen.</p>
          ) : (
            <div className="flex flex-wrap gap-2 mb-2">
              {assignees.map((uid) => {
                const m = memberProfiles[uid];
                const label = m?.username ? `@${m.username}` : 'User';
                return (
                  <span
                    key={uid}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 border border-slate-700 pl-0.5 pr-2 py-0.5 text-xs text-slate-200"
                  >
                    <Avatar username={m?.username ?? null} size="xs" />
                    {label}
                  </span>
                );
              })}
            </div>
          )}

          {pickerOpen && (
            <div className="mt-1 rounded-lg bg-slate-800/60 border border-slate-700 max-h-52 overflow-y-auto divide-y divide-slate-800">
              {memberOrder.length === 0 ? (
                <p className="p-3 text-xs text-slate-500">
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
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800 transition-colors"
                    >
                      <Avatar username={m?.username ?? null} size="sm" />
                      <span className="flex-1">
                        {m?.username ? `@${m.username}` : 'User'}
                        <span className="ml-2 text-[10px] text-slate-500 uppercase">
                          {m?.role}
                        </span>
                      </span>
                      <span
                        className={`h-4 w-4 rounded border transition-colors ${
                          assigned
                            ? 'bg-emerald-500/80 border-emerald-400'
                            : 'border-slate-600'
                        }`}
                      />
                    </button>
                  );
                })
              )}
            </div>
          )}
        </section>

        <section className="p-5 border-b border-slate-800">
          <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Beschreibung
          </h3>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
            placeholder="Details, Links, Notizen…"
            rows={3}
            className="w-full rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400/60 resize-y"
          />
        </section>

        <section className="p-5 border-b border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
              Checkliste
            </h3>
            {total > 0 && (
              <span className="text-[11px] text-slate-500 tabular-nums">
                {doneCount}/{total}
              </span>
            )}
          </div>

          {total > 0 && (
            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden mb-3">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-emerald-400 transition-[width] duration-300"
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
                        : 'border-slate-600 hover:border-slate-400'
                    }`}
                  />
                </button>
                <span
                  className={`flex-1 text-sm ${
                    t.done ? 'line-through text-slate-500' : 'text-slate-200'
                  }`}
                >
                  {t.title}
                </span>
                <button
                  type="button"
                  onClick={() => deleteTask(openCardId, t.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 text-sm shrink-0 transition-opacity"
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
              className="flex-1 rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400/60"
            />
            <button
              type="submit"
              className="rounded-lg bg-violet-500/90 hover:bg-violet-400 text-white text-xs font-medium px-4 transition-colors"
            >
              Hinzufügen
            </button>
          </form>
        </section>

        <div className="p-5 flex justify-end">
          <button
            type="button"
            onClick={() => {
              if (confirm('Diese Karte wirklich löschen?')) {
                deleteCard(openCardId);
              }
            }}
            className="text-xs text-slate-400 hover:text-rose-400 transition-colors"
          >
            Karte löschen
          </button>
        </div>
      </div>
    </div>
  );
}
