'use client';
import { memo, useEffect, useRef, useState } from 'react';
import { useBoard } from '@/store/boardStore';
import { Avatar } from './Avatar';
import { labelPill } from '@/lib/labelColors';
import { confirm } from '@/store/confirmStore';
import { KebabMenu } from './KebabMenu';

type Props = { id: string; isDragging: boolean };

function formatDue(date: string | null): {
  label: string;
  tone: 'overdue' | 'today' | 'soon' | 'future';
} | null {
  if (!date) return null;
  const due = new Date(date + 'T00:00:00');
  if (isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  const label = due.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
  });
  if (diffDays < 0) return { label, tone: 'overdue' };
  if (diffDays === 0) return { label: 'heute', tone: 'today' };
  if (diffDays <= 2) return { label, tone: 'soon' };
  return { label, tone: 'future' };
}

const TONE_CLASSES = {
  overdue: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  today: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  soon: 'bg-elev-hover/60 text-fg-soft border-muted',
  future: 'bg-elev text-muted border-line-strong',
} as const;

function CardInner({ id, isDragging }: Props) {
  const card = useBoard((s) => s.cards[id]);
  const toggleTask = useBoard((s) => s.toggleTask);
  const setOpenCardId = useBoard((s) => s.setOpenCardId);
  const assignees = useBoard((s) => s.assignees[id]) ?? [];
  const memberProfiles = useBoard((s) => s.memberProfiles);
  const cardLabelIds = useBoard((s) => s.cardLabels[id]) ?? [];
  const labels = useBoard((s) => s.labels);
  const pulsing = useBoard((s) => !!s.pulsingCards[id]);
  const updateCardTitle = useBoard((s) => s.updateCardTitle);
  const duplicateCard = useBoard((s) => s.duplicateCard);
  const deleteCard = useBoard((s) => s.deleteCard);
  const selected = useBoard((s) => !!s.selectedCardIds[id]);
  const hasSelection = useBoard(
    (s) => Object.keys(s.selectedCardIds).length > 0
  );
  const toggleSelection = useBoard((s) => s.toggleSelection);
  const clearSelection = useBoard((s) => s.clearSelection);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  if (!card) return null;

  const totalTasks = card.tasks.length;
  const doneTasks = card.tasks.filter((t) => t.done).length;
  const progress = totalTasks ? (doneTasks / totalTasks) * 100 : 0;
  const hasDescription = !!card.description?.trim();
  const hasAssignees = assignees.length > 0;

  const dueMeta = formatDue(card.due_date);

  const commitTitle = () => {
    const next = draft.trim();
    if (next && next !== card.title) void updateCardTitle(id, next);
    setEditing(false);
  };

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(card.title);
    setEditing(true);
  };

  const onCardClick = (e: React.MouseEvent) => {
    if (editing) return;
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      e.preventDefault();
      toggleSelection(id);
      return;
    }
    if (hasSelection) clearSelection();
    setOpenCardId(id);
  };

  return (
    <div
      onClick={onCardClick}
      className={`group rounded-xl bg-elev/80 border p-3 cursor-pointer transition-all duration-700 ${
        isDragging
          ? 'shadow-xl shadow-violet-500/30 border-accent-hover/60 ring-1 ring-accent-hover/40'
          : selected
          ? 'border-accent-hover/80 ring-2 ring-accent-hover/60 shadow-md'
          : pulsing
          ? 'border-emerald-400/60 ring-2 ring-emerald-400/50 shadow-lg shadow-emerald-500/20'
          : 'border-line-strong/60 shadow-sm hover:border-muted hover:shadow-md'
      }`}
    >
      {cardLabelIds.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {cardLabelIds.map((lid) => {
            const lbl = labels[lid];
            if (!lbl) return null;
            return (
              <span
                key={lid}
                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium border ${labelPill(lbl.color)}`}
              >
                {lbl.name}
              </span>
            );
          })}
        </div>
      )}

      <div className="flex items-start gap-1">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitTitle();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setEditing(false);
              }
            }}
            className="flex-1 bg-elev border border-accent-hover/60 rounded px-1.5 py-0.5 text-sm font-medium text-fg focus:outline-none focus:ring-2 focus:ring-accent-hover/60"
          />
        ) : (
          <h3
            className="flex-1 text-sm font-medium text-fg leading-snug break-words cursor-text hover:text-accent-hover"
            onClick={startEdit}
            title="Klicken zum Umbenennen"
          >
            {card.title}
          </h3>
        )}
        <div
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <KebabMenu
            size="sm"
            ariaLabel="Karten-Aktionen"
            actions={[
              {
                label: 'Duplizieren',
                onSelect: () => void duplicateCard(id),
              },
              {
                label: 'Löschen',
                danger: true,
                onSelect: async () => {
                  const ok = await confirm({
                    title: `Karte "${card.title}" löschen?`,
                    confirmLabel: 'Löschen',
                    danger: true,
                  });
                  if (!ok) return;
                  void deleteCard(id);
                },
              },
            ]}
          />
        </div>
      </div>

      {dueMeta && (
        <div className="mt-2">
          <span
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium font-mono tabular-nums ${TONE_CLASSES[dueMeta.tone]}`}
          >
            <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" aria-hidden>
              <path d="M7 3v2H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2h-2V3h-2v2H9V3H7zm12 6v10H5V9h14z" />
            </svg>
            {dueMeta.label}
          </span>
        </div>
      )}

      {(totalTasks > 0 || hasDescription) && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-muted mb-1">
            <div className="flex items-center gap-2">
              {totalTasks > 0 && (
                <span className="font-mono tabular-nums">
                  {doneTasks}/{totalTasks} Tasks
                </span>
              )}
              {hasDescription && (
                <span
                  title="Hat Beschreibung"
                  className="inline-flex items-center text-subtle"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3 w-3 fill-current"
                    aria-hidden
                  >
                    <path d="M4 6h16v2H4zm0 4h16v2H4zm0 4h10v2H4z" />
                  </svg>
                </span>
              )}
            </div>
          </div>
          {totalTasks > 0 && (
            <>
              <div className="h-1.5 w-full rounded-full bg-elev-hover/50 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-emerald-400 transition-[width] duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <ul className="mt-2 space-y-1">
            {card.tasks.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTask(id, t.id);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className="w-full flex items-center gap-2 text-left text-[12px] text-fg-soft hover:text-fg"
                >
                  <span
                    className={`h-3.5 w-3.5 shrink-0 rounded border transition-colors ${
                      t.done
                        ? 'bg-emerald-500/80 border-emerald-400'
                        : 'border-muted'
                    }`}
                  />
                  <span className={t.done ? 'line-through text-subtle' : ''}>
                    {t.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
            </>
          )}
        </div>
      )}

      {hasAssignees && (
        <div className="mt-3 flex -space-x-1.5">
          {assignees.slice(0, 4).map((uid) => {
            const m = memberProfiles[uid];
            return (
              <Avatar
                key={uid}
                username={m?.username ?? null}
                size="xs"
                className="ring-2 ring-line"
              />
            );
          })}
          {assignees.length > 4 && (
            <span className="h-5 w-5 rounded-full bg-elev-hover grid place-items-center text-[9px] font-semibold text-fg-soft ring-2 ring-line">
              +{assignees.length - 4}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export const Card = memo(CardInner);
