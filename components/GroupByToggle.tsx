'use client';
import { useBoard } from '@/store/boardStore';

const OPTIONS: Array<{ key: 'none' | 'assignee' | 'label'; label: string }> = [
  { key: 'none', label: 'Keine' },
  { key: 'assignee', label: 'Zugewiesene' },
  { key: 'label', label: 'Labels' },
];

export function GroupByToggle() {
  const groupBy = useBoard((s) => s.groupBy);
  const setGroupBy = useBoard((s) => s.setGroupBy);

  return (
    <div className="hidden sm:flex items-center gap-1 rounded-md bg-elev/60 border border-line-strong p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => setGroupBy(o.key)}
          className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
            groupBy === o.key
              ? 'bg-accent/20 text-accent-hover'
              : 'text-muted hover:text-fg'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
