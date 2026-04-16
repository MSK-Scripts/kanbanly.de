'use client';
import { memo, useEffect, useState } from 'react';
import { useBoard } from '@/store/boardStore';
import { PlayIcon, PauseIcon } from './Icons';

const fmt = (total: number) => {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

type Props = { id: string; isDragging: boolean };

function CardInner({ id, isDragging }: Props) {
  const card = useBoard((s) => s.cards[id]);
  const toggleTimer = useBoard((s) => s.toggleTimer);
  const toggleTask = useBoard((s) => s.toggleTask);
  const [, setTick] = useState(0);

  const running = card?.timerStartedAt != null;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  if (!card) return null;

  const elapsed =
    card.timeSpent +
    (card.timerStartedAt
      ? Math.floor((Date.now() - card.timerStartedAt) / 1000)
      : 0);

  const totalTasks = card.tasks.length;
  const doneTasks = card.tasks.filter((t) => t.done).length;
  const progress = totalTasks ? (doneTasks / totalTasks) * 100 : 0;

  return (
    <div
      className={`rounded-xl bg-slate-800/80 border p-3 transition-shadow duration-150 ${
        isDragging
          ? 'shadow-xl shadow-violet-500/30 border-violet-400/60 ring-1 ring-violet-400/40'
          : 'border-slate-700/60 shadow-sm hover:border-slate-600 hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-100 leading-snug break-words">
          {card.title}
        </h3>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleTimer(id);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className={`shrink-0 h-7 w-7 grid place-items-center rounded-lg border transition-colors ${
            running
              ? 'bg-violet-500/20 border-violet-400/60 text-violet-200'
              : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:text-slate-100 hover:border-slate-500'
          }`}
          title={running ? 'Timer stoppen' : 'Timer starten'}
          aria-label={running ? 'Timer stoppen' : 'Timer starten'}
        >
          {running ? <PauseIcon /> : <PlayIcon />}
        </button>
      </div>

      {totalTasks > 0 ? (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span>
              {doneTasks}/{totalTasks} Tasks
            </span>
            <span className="tabular-nums">{fmt(elapsed)}</span>
          </div>
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
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-end">
          <span className="text-[11px] tabular-nums text-slate-400">
            {fmt(elapsed)}
          </span>
        </div>
      )}
    </div>
  );
}

export const Card = memo(CardInner);
