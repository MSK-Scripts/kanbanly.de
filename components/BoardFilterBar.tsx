'use client';
import { useEffect, useRef, useState } from 'react';
import { useBoard, type DueBucketFilter } from '@/store/boardStore';
import { activeFilterCount, isFilterActive } from '@/lib/filterCards';
import { createClient } from '@/lib/supabase/client';
import { labelPill } from '@/lib/labelColors';
import { Avatar } from './Avatar';

const DUE_PRIMARY: Array<{ key: DueBucketFilter; label: string }> = [
  { key: 'overdue', label: 'Überfällig' },
  { key: 'today', label: 'Heute' },
  { key: 'week', label: 'Diese Woche' },
];

const DUE_SECONDARY: Array<{ key: DueBucketFilter; label: string }> = [
  { key: 'later', label: 'Später' },
  { key: 'none', label: 'Ohne Datum' },
];

const DUE_LABELS: Record<DueBucketFilter, string> = {
  all: 'Alle',
  overdue: 'Überfällig',
  today: 'Heute',
  week: 'Diese Woche',
  later: 'Später',
  none: 'Ohne Datum',
};

function Chip({
  active,
  onClick,
  children,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accent?: 'violet' | 'rose' | 'amber' | 'emerald';
}) {
  const accentClasses: Record<string, string> = {
    violet: 'bg-accent text-white border-accent-hover',
    rose: 'bg-rose-500/80 text-white border-rose-400',
    amber: 'bg-amber-500/80 text-slate-950 border-amber-400',
    emerald: 'bg-emerald-500/80 text-slate-950 border-emerald-400',
  };
  const a = accent ?? 'violet';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
        active
          ? accentClasses[a]
          : 'bg-elev text-fg-soft border-line-strong hover:border-fg-soft hover:text-fg'
      }`}
    >
      {children}
    </button>
  );
}

export function BoardFilterBar() {
  const filters = useBoard((s) => s.filters);
  const setFilters = useBoard((s) => s.setFilters);
  const clearFilters = useBoard((s) => s.clearFilters);
  const labels = useBoard((s) => s.labels);
  const labelOrder = useBoard((s) => s.labelOrder);
  const memberProfiles = useBoard((s) => s.memberProfiles);
  const memberOrder = useBoard((s) => s.memberOrder);

  const [open, setOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

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
  const hasAny = isFilterActive(filters);
  const onlyMe =
    currentUserId !== null &&
    filters.assignees.length === 1 &&
    filters.assignees[0] === currentUserId;

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
  const toggleOnlyMe = () => {
    if (!currentUserId) return;
    setFilters({ assignees: onlyMe ? [] : [currentUserId] });
  };
  const setDue = (bucket: DueBucketFilter) => {
    setFilters({ due: filters.due === bucket ? 'all' : bucket });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs transition-colors ${
          hasAny
            ? 'border-accent-hover/50 bg-accent/10 text-accent-hover'
            : 'border-line-strong bg-elev text-fg-soft hover:border-fg-soft hover:text-fg'
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
          <path d="M3 5h18l-7 8v6l-4-2v-4L3 5z" />
        </svg>
        Filter
        {activeCount > 0 && (
          <span className="tabular-nums font-mono text-[10px] rounded bg-accent/20 px-1.5">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-40 w-80 rounded-md bg-surface border border-line shadow-md overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <div>
              <h3 className="text-[11px] font-semibold text-fg uppercase tracking-wide">
                Filter
              </h3>
              <p className="text-[10px] text-subtle mt-0.5">
                {hasAny
                  ? `${activeCount} ${activeCount === 1 ? 'Gruppe' : 'Gruppen'} aktiv`
                  : 'Nichts ausgewählt — alle Karten sichtbar'}
              </p>
            </div>
            {hasAny && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[11px] text-muted hover:text-rose-700 dark:text-rose-300"
              >
                Zurücksetzen
              </button>
            )}
          </div>

          {hasAny && (
            <div className="px-4 py-3 border-b border-line bg-bg">
              <h4 className="text-[10px] font-semibold text-subtle uppercase tracking-wide mb-2">
                Aktive Filter
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {filters.due !== 'all' && (
                  <ActiveChip
                    label={DUE_LABELS[filters.due]}
                    onRemove={() => setFilters({ due: 'all' })}
                  />
                )}
                {filters.assignees.map((uid) => {
                  const m = memberProfiles[uid];
                  return (
                    <ActiveChip
                      key={uid}
                      label={`@${m?.username ?? 'user'}`}
                      onRemove={() => toggleAssignee(uid)}
                    />
                  );
                })}
                {filters.labels.map((id) => {
                  const lbl = labels[id];
                  if (!lbl) return null;
                  return (
                    <ActiveChip
                      key={id}
                      label={lbl.name}
                      accent={lbl.color}
                      onRemove={() => toggleLabel(id)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {memberOrder.length > 0 && (
            <section className="px-4 py-3 border-b border-line">
              <div className="flex items-baseline justify-between mb-2">
                <h4 className="text-[10px] font-semibold text-subtle uppercase tracking-wide">
                  Zugewiesen an
                </h4>
                {currentUserId && memberProfiles[currentUserId] && (
                  <button
                    type="button"
                    onClick={toggleOnlyMe}
                    className={`text-[10px] font-medium transition-colors ${
                      onlyMe
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-accent-soft hover:text-accent-hover'
                    }`}
                  >
                    {onlyMe ? '✓ Nur mir' : 'Nur mir'}
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto board-scroll">
                {memberOrder.map((uid) => {
                  const m = memberProfiles[uid];
                  const active = filters.assignees.includes(uid);
                  const isSelf = uid === currentUserId;
                  return (
                    <button
                      key={uid}
                      type="button"
                      onClick={() => toggleAssignee(uid)}
                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-left transition-colors ${
                        active
                          ? 'bg-accent/15 text-accent-soft'
                          : 'text-fg-soft hover:bg-elev'
                      }`}
                    >
                      <Avatar username={m?.username ?? null} size="xs" />
                      <span className="flex-1 truncate">
                        @{m?.username ?? 'user'}
                        {isSelf && (
                          <span className="ml-1.5 text-[9px] text-subtle uppercase">
                            du
                          </span>
                        )}
                      </span>
                      <span
                        className={`h-3.5 w-3.5 rounded border transition-colors shrink-0 ${
                          active
                            ? 'bg-accent border-accent-hover'
                            : 'border-muted'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section className="px-4 py-3 border-b border-line">
            <h4 className="text-[10px] font-semibold text-subtle uppercase tracking-wide mb-2">
              Fällig am
            </h4>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {DUE_PRIMARY.map((o) => {
                const accent: 'rose' | 'amber' | 'emerald' =
                  o.key === 'overdue'
                    ? 'rose'
                    : o.key === 'today'
                    ? 'amber'
                    : 'emerald';
                return (
                  <Chip
                    key={o.key}
                    active={filters.due === o.key}
                    onClick={() => setDue(o.key)}
                    accent={accent}
                  >
                    {o.label}
                  </Chip>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DUE_SECONDARY.map((o) => (
                <Chip
                  key={o.key}
                  active={filters.due === o.key}
                  onClick={() => setDue(o.key)}
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          </section>

          {labelOrder.length > 0 && (
            <section className="px-4 py-3">
              <h4 className="text-[10px] font-semibold text-subtle uppercase tracking-wide mb-2">
                Labels
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {labelOrder.map((id) => {
                  const lbl = labels[id];
                  if (!lbl) return null;
                  const active = filters.labels.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleLabel(id)}
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium border transition-all ${labelPill(lbl.color)} ${
                        active
                          ? 'ring-2 ring-white/60 scale-[1.02]'
                          : 'opacity-55 hover:opacity-100'
                      }`}
                    >
                      {lbl.name}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function ActiveChip({
  label,
  onRemove,
  accent,
}: {
  label: string;
  onRemove: () => void;
  accent?: string;
}) {
  const labelColor = accent ? labelPill(accent) : '';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
        accent
          ? labelColor
          : 'bg-accent/15 border-accent/30 text-accent-hover'
      }`}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Filter entfernen"
        className="text-current opacity-60 hover:opacity-100 leading-none text-sm"
      >
        ×
      </button>
    </span>
  );
}
