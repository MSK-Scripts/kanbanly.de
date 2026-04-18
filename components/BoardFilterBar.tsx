'use client';
import { useEffect, useRef, useState } from 'react';
import { useBoard, type DueBucketFilter } from '@/store/boardStore';
import { activeFilterCount } from '@/lib/filterCards';
import { labelPill, LABEL_COLORS } from '@/lib/labelColors';
import { Avatar } from './Avatar';

const DUE_OPTIONS: Array<{ key: DueBucketFilter; label: string }> = [
  { key: 'all', label: 'Alle' },
  { key: 'overdue', label: 'Überfällig' },
  { key: 'today', label: 'Heute' },
  { key: 'week', label: 'Diese Woche' },
  { key: 'later', label: 'Später' },
  { key: 'none', label: 'Ohne Datum' },
];

export function BoardFilterBar() {
  const filters = useBoard((s) => s.filters);
  const setFilters = useBoard((s) => s.setFilters);
  const clearFilters = useBoard((s) => s.clearFilters);
  const labels = useBoard((s) => s.labels);
  const labelOrder = useBoard((s) => s.labelOrder);
  const memberProfiles = useBoard((s) => s.memberProfiles);
  const memberOrder = useBoard((s) => s.memberOrder);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const activeCount = activeFilterCount(filters);

  const toggleLabel = (id: string) => {
    setFilters({
      labels: filters.labels.includes(id)
        ? filters.labels.filter((l) => l !== id)
        : [...filters.labels, id],
    });
  };
  const toggleAssignee = (id: string) => {
    setFilters({
      assignees: filters.assignees.includes(id)
        ? filters.assignees.filter((a) => a !== id)
        : [...filters.assignees, id],
    });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs transition-colors ${
          activeCount > 0
            ? 'border-violet-400/50 bg-violet-500/10 text-violet-200'
            : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500 hover:text-slate-100'
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
          <path d="M3 5h18l-7 8v6l-4-2v-4L3 5z" />
        </svg>
        Filter
        {activeCount > 0 && (
          <span className="tabular-nums font-mono text-[10px] rounded bg-violet-500/20 px-1.5">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-40 w-72 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold text-slate-100 uppercase tracking-wide">
              Filter
            </h3>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[11px] text-slate-400 hover:text-rose-300"
              >
                Zurücksetzen
              </button>
            )}
          </div>

          <div className="px-4 py-3 border-b border-slate-800">
            <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Fällig
            </h4>
            <div className="flex flex-wrap gap-1">
              {DUE_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setFilters({ due: o.key })}
                  className={`rounded-md px-2 py-0.5 text-[11px] transition-colors ${
                    filters.due === o.key
                      ? 'bg-violet-500/80 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {labelOrder.length > 0 && (
            <div className="px-4 py-3 border-b border-slate-800">
              <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Labels
              </h4>
              <div className="flex flex-wrap gap-1">
                {labelOrder.map((id) => {
                  const lbl = labels[id];
                  if (!lbl) return null;
                  const active = filters.labels.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleLabel(id)}
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border transition-all ${labelPill(lbl.color)} ${
                        active
                          ? 'ring-2 ring-white/50'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${LABEL_COLORS[lbl.color as keyof typeof LABEL_COLORS]?.swatch ?? 'bg-slate-400'}`}
                      />
                      {lbl.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {memberOrder.length > 0 && (
            <div className="px-4 py-3">
              <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Zugewiesen
              </h4>
              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                {memberOrder.map((uid) => {
                  const m = memberProfiles[uid];
                  const active = filters.assignees.includes(uid);
                  return (
                    <button
                      key={uid}
                      type="button"
                      onClick={() => toggleAssignee(uid)}
                      className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs text-left transition-colors ${
                        active
                          ? 'bg-violet-500/20 text-violet-100'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Avatar username={m?.username ?? null} size="xs" />
                      <span className="flex-1 truncate">
                        @{m?.username ?? 'user'}
                      </span>
                      <span
                        className={`h-3 w-3 rounded border ${
                          active
                            ? 'bg-violet-500 border-violet-400'
                            : 'border-slate-600'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
