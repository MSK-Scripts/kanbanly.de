'use client';
import { memo } from 'react';
import { useBoard } from '@/store/boardStore';
import { Avatar } from './Avatar';
import { labelPill } from '@/lib/labelColors';

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
  overdue: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  today: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  soon: 'bg-slate-700/60 text-slate-200 border-slate-600',
  future: 'bg-slate-800 text-slate-400 border-slate-700',
} as const;

function CardInner({ id, isDragging }: Props) {
  const card = useBoard((s) => s.cards[id]);
  const toggleTask = useBoard((s) => s.toggleTask);
  const setOpenCardId = useBoard((s) => s.setOpenCardId);
  const assignees = useBoard((s) => s.assignees[id]) ?? [];
  const memberProfiles = useBoard((s) => s.memberProfiles);
  const cardLabelIds = useBoard((s) => s.cardLabels[id]) ?? [];
  const labels = useBoard((s) => s.labels);

  if (!card) return null;

  const totalTasks = card.tasks.length;
  const doneTasks = card.tasks.filter((t) => t.done).length;
  const progress = totalTasks ? (doneTasks / totalTasks) * 100 : 0;
  const hasDescription = !!card.description?.trim();
  const hasAssignees = assignees.length > 0;

  const dueMeta = formatDue(card.due_date);

  return (
    <div
      onClick={() => setOpenCardId(id)}
      className={`rounded-xl bg-slate-800/80 border p-3 cursor-pointer transition-shadow duration-150 ${
        isDragging
          ? 'shadow-xl shadow-violet-500/30 border-violet-400/60 ring-1 ring-violet-400/40'
          : 'border-slate-700/60 shadow-sm hover:border-slate-600 hover:shadow-md'
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

      <h3 className="text-sm font-medium text-slate-100 leading-snug break-words">
        {card.title}
      </h3>

      {dueMeta && (
        <div className="mt-2">
          <span
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${TONE_CLASSES[dueMeta.tone]}`}
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
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <div className="flex items-center gap-2">
              {totalTasks > 0 && (
                <span>
                  {doneTasks}/{totalTasks} Tasks
                </span>
              )}
              {hasDescription && (
                <span
                  title="Hat Beschreibung"
                  className="inline-flex items-center text-slate-500"
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
              <div className="h-1.5 w-full rounded-full bg-slate-700/50 overflow-hidden">
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
                  className="w-full flex items-center gap-2 text-left text-[12px] text-slate-300 hover:text-slate-100"
                >
                  <span
                    className={`h-3.5 w-3.5 shrink-0 rounded border transition-colors ${
                      t.done
                        ? 'bg-emerald-500/80 border-emerald-400'
                        : 'border-slate-600'
                    }`}
                  />
                  <span className={t.done ? 'line-through text-slate-500' : ''}>
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
                className="ring-2 ring-slate-800"
              />
            );
          })}
          {assignees.length > 4 && (
            <span className="h-5 w-5 rounded-full bg-slate-700 grid place-items-center text-[9px] font-semibold text-slate-200 ring-2 ring-slate-800">
              +{assignees.length - 4}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export const Card = memo(CardInner);
