'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { updates } from '@/lib/updates';

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

export function HelpMenu() {
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

  const recent = updates.slice(0, 10);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Hilfe und Informationen"
        aria-expanded={open}
        className="h-8 w-8 grid place-items-center rounded-none border border-line hover:border-line-strong bg-elev/60 hover:bg-elev text-fg-soft hover:text-fg text-sm transition-colors"
      >
        ?
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 rounded-xl bg-surface border border-line shadow-2xl overflow-hidden z-50">
          <div className="px-4 pt-3 pb-2 border-b border-line">
            <h3 className="text-xs font-semibold text-fg uppercase tracking-wide">
              Neuigkeiten
            </h3>
          </div>
          <ul className="max-h-80 overflow-y-auto board-scroll divide-y divide-line">
            {recent.map((u, i) => (
              <li key={i} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-2 mb-0.5">
                  <span className="text-sm font-medium text-fg">
                    {u.title}
                  </span>
                  <span className="text-[10px] text-subtle tabular-nums shrink-0">
                    {formatDate(u.date)}
                  </span>
                </div>
                <p className="text-xs text-muted leading-snug">
                  {u.description}
                </p>
              </li>
            ))}
          </ul>

          <div className="px-4 pt-2 pb-3 border-t border-line bg-bg/40">
            <h3 className="text-[11px] font-semibold text-subtle uppercase tracking-wide mb-1.5">
              Links
            </h3>
            <div className="flex flex-col gap-1">
              <Link
                href="/templates"
                onClick={() => setOpen(false)}
                className="text-xs text-fg-soft hover:text-accent-soft"
              >
                Templates durchstöbern
              </Link>
              <Link
                href="/impressum"
                onClick={() => setOpen(false)}
                className="text-xs text-fg-soft hover:text-accent-soft"
              >
                Impressum
              </Link>
              <Link
                href="/datenschutz"
                onClick={() => setOpen(false)}
                className="text-xs text-fg-soft hover:text-accent-soft"
              >
                Datenschutzerklärung
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
