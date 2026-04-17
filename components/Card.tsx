'use client';
import { memo } from 'react';
import { useBoard } from '@/store/boardStore';
import { Avatar } from './Avatar';

type Props = { id: string; isDragging: boolean };

function CardInner({ id, isDragging }: Props) {
  const card = useBoard((s) => s.cards[id]);
  const toggleTask = useBoard((s) => s.toggleTask);
  const setOpenCardId = useBoard((s) => s.setOpenCardId);
  const assignees = useBoard((s) => s.assignees[id]) ?? [];
  const memberProfiles = useBoard((s) => s.memberProfiles);

  if (!card) return null;

  const totalTasks = card.tasks.length;
  const doneTasks = card.tasks.filter((t) => t.done).length;
  const progress = totalTasks ? (doneTasks / totalTasks) * 100 : 0;
  const hasDescription = !!card.description?.trim();
  const hasAssignees = assignees.length > 0;

  return (
    <div
      onClick={() => setOpenCardId(id)}
      className={`rounded-xl bg-slate-800/80 border p-3 cursor-pointer transition-shadow duration-150 ${
        isDragging
          ? 'shadow-xl shadow-violet-500/30 border-violet-400/60 ring-1 ring-violet-400/40'
          : 'border-slate-700/60 shadow-sm hover:border-slate-600 hover:shadow-md'
      }`}
    >
      <h3 className="text-sm font-medium text-slate-100 leading-snug break-words">
        {card.title}
      </h3>

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
