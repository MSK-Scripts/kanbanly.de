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
      ? 'h-6 w-6 text-sm text-muted hover:text-fg hover:bg-elev rounded grid place-items-center transition-colors'
      : 'h-8 w-8 rounded-md border border-line-strong hover:border-fg-soft bg-elev hover:bg-elev text-fg-soft hover:text-fg grid place-items-center transition-colors';

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
        <div className="absolute right-0 top-[calc(100%+4px)] min-w-[180px] rounded-md bg-surface border border-line shadow-md z-50 overflow-hidden">
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
                  ? 'text-rose-700 dark:text-rose-300 hover:bg-rose-500/10'
                  : 'text-fg-soft hover:bg-elev'
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
