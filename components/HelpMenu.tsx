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
              <a
                href="https://discord.gg/BA8uB6yNUU"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="text-xs text-fg-soft hover:text-accent-soft flex items-center gap-1.5"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5 fill-current"
                  aria-hidden
                >
                  <path d="M20.317 4.37A19.79 19.79 0 0 0 16.558 3c-.207.369-.449.865-.615 1.26a18.27 18.27 0 0 0-5.487 0A12.64 12.64 0 0 0 9.834 3 19.74 19.74 0 0 0 6.073 4.37C2.38 9.5 1.373 14.55 1.876 19.53a19.93 19.93 0 0 0 6.03 3c.487-.66.92-1.363 1.292-2.104a12.86 12.86 0 0 1-2.034-.971c.17-.125.337-.255.5-.388 4.096 1.898 8.53 1.898 12.57 0 .164.133.33.263.499.388-.65.385-1.33.711-2.036.972.374.741.806 1.443 1.292 2.103a19.9 19.9 0 0 0 6.032-3c.59-5.74-1.01-10.743-4.203-15.16zM8.02 16.4c-1.182 0-2.157-1.09-2.157-2.42s.956-2.42 2.157-2.42 2.177 1.09 2.157 2.42c0 1.33-.956 2.42-2.157 2.42zm7.963 0c-1.183 0-2.157-1.09-2.157-2.42s.956-2.42 2.157-2.42c1.2 0 2.177 1.09 2.156 2.42 0 1.33-.955 2.42-2.156 2.42z" />
                </svg>
                Discord &amp; Support
              </a>
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
