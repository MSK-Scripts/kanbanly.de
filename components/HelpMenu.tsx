'use client';
import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { updates } from '@/lib/updates';

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

export function HelpMenu() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number }>({
    top: 0,
    right: 0,
  });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        btnRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
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
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Hilfe und Informationen"
        aria-expanded={open}
        className="h-8 w-8 grid place-items-center rounded-none border border-line hover:border-line-strong bg-elev hover:bg-elev text-fg-soft hover:text-fg text-sm transition-colors"
      >
        ?
      </button>

      {mounted && open &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: pos.top, right: pos.right }}
            className="fixed w-80 rounded-md bg-surface border border-line shadow-md overflow-hidden z-[1100]"
          >
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

            <div className="px-4 pt-2 pb-3 border-t border-line bg-bg">
              <h3 className="text-[11px] font-semibold text-subtle uppercase tracking-wide mb-1.5">
                Links
              </h3>
              <div className="flex flex-col gap-1">
                <a
                  href="https://discord.gg/BA8uB6yNUU"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="text-xs text-fg-soft hover:text-accent-soft"
                >
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
          </div>,
          document.body
        )}
    </>
  );
}
