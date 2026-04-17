'use client';
import { useEffect, useRef, useState } from 'react';

export type KebabAction = {
  label: string;
  onSelect: () => void;
  danger?: boolean;
};

type Props = {
  actions: KebabAction[];
  ariaLabel?: string;
  size?: 'sm' | 'md';
  buttonClassName?: string;
};

export function KebabMenu({
  actions,
  ariaLabel = 'Aktionen',
  size = 'md',
  buttonClassName,
}: Props) {
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

  const defaultButton =
    size === 'sm'
      ? 'h-6 w-6 text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 rounded grid place-items-center transition-colors'
      : 'h-8 w-8 rounded-lg border border-slate-700 hover:border-slate-500 bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-slate-100 grid place-items-center transition-colors';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-expanded={open}
        className={buttonClassName ?? defaultButton}
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] min-w-[180px] rounded-lg bg-slate-900 border border-slate-800 shadow-xl z-50 overflow-hidden">
          {actions.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setOpen(false);
                a.onSelect();
              }}
              className={`w-full px-3 py-2 text-left text-xs transition-colors ${
                a.danger
                  ? 'text-rose-300 hover:bg-rose-500/10'
                  : 'text-slate-200 hover:bg-slate-800'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
