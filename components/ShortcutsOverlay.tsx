'use client';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

type Row = { keys: string[]; label: string };

const SHORTCUTS: { section: string; rows: Row[] }[] = [
  {
    section: 'Global',
    rows: [
      { keys: ['⌘', 'K'], label: 'Suche öffnen (Boards, Karten, Workspaces)' },
      { keys: ['?'], label: 'Diese Shortcut-Übersicht' },
      { keys: ['Esc'], label: 'Dialog oder Overlay schließen' },
    ],
  },
  {
    section: 'Suche',
    rows: [
      { keys: ['↑', '↓'], label: 'Zwischen Treffern navigieren' },
      { keys: ['↵'], label: 'Ausgewähltes Ergebnis öffnen' },
    ],
  },
  {
    section: 'Karten',
    rows: [
      { keys: ['Klick'], label: 'Karte öffnen' },
      { keys: ['Titel-Klick'], label: 'Titel inline umbenennen' },
      { keys: ['Shift', 'Klick'], label: 'Karte zur Mehrfachauswahl hinzufügen' },
      { keys: ['⌘', 'Klick'], label: 'Alternative für Shift+Klick' },
      { keys: ['Esc'], label: 'Auswahl aufheben' },
    ],
  },
];

export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[1800] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-surface border border-line shadow-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-fg">Keyboard-Shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="h-7 w-7 grid place-items-center rounded text-muted hover:text-fg hover:bg-elev/60"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {SHORTCUTS.map((s) => (
            <div key={s.section}>
              <h3 className="text-[11px] font-semibold text-subtle uppercase tracking-wide mb-1.5">
                {s.section}
              </h3>
              <ul className="space-y-1.5">
                {s.rows.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="text-fg-soft">{r.label}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {r.keys.map((k, j) => (
                        <kbd
                          key={j}
                          className="px-1.5 py-0.5 text-[10px] font-mono bg-elev border border-line-strong text-fg rounded"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-5 text-[11px] text-subtle">
          Shortcuts sind nur im eingeloggten App-Bereich aktiv.
        </p>
      </div>
    </div>,
    document.body
  );
}
