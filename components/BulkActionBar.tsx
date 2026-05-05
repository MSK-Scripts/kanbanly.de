'use client';
import { useEffect, useState } from 'react';
import { useBoard } from '@/store/boardStore';
import { confirm } from '@/store/confirmStore';
import { labelPill } from '@/lib/labelColors';

export function BulkActionBar() {
  const selected = useBoard((s) => s.selectedCardIds);
  const lists = useBoard((s) => s.lists);
  const listOrder = useBoard((s) => s.listOrder);
  const labels = useBoard((s) => s.labels);
  const labelOrder = useBoard((s) => s.labelOrder);
  const cardLabels = useBoard((s) => s.cardLabels);
  const bulkDelete = useBoard((s) => s.bulkDelete);
  const bulkMove = useBoard((s) => s.bulkMove);
  const bulkToggleLabel = useBoard((s) => s.bulkToggleLabel);
  const clearSelection = useBoard((s) => s.clearSelection);

  const [moveOpen, setMoveOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);

  const ids = Object.keys(selected);
  const count = ids.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && count > 0) {
        clearSelection();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [count, clearSelection]);

  if (count === 0) return null;

  const handleDelete = async () => {
    const ok = await confirm({
      title: `${count} Karten löschen?`,
      description: 'Die Karten und alle ihre Inhalte werden entfernt.',
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    void bulkDelete();
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[900] flex items-center gap-2 rounded-md bg-surface border border-line shadow-md px-3 py-2">
      <span className="text-xs text-fg font-medium tabular-nums">
        {count} ausgewählt
      </span>

      <span className="text-muted">·</span>

      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setMoveOpen((v) => !v);
            setLabelOpen(false);
          }}
          className="rounded-md text-xs text-fg-soft hover:text-fg hover:bg-elev px-2 py-1"
        >
          Verschieben
        </button>
        {moveOpen && (
          <div className="absolute bottom-full mb-1 left-0 min-w-[160px] rounded-md bg-surface border border-line shadow-md overflow-hidden">
            {listOrder.map((lid) => {
              const list = lists[lid];
              if (!list) return null;
              return (
                <button
                  key={lid}
                  type="button"
                  onClick={() => {
                    void bulkMove(lid);
                    setMoveOpen(false);
                  }}
                  className="w-full text-left text-xs text-fg-soft hover:bg-elev px-3 py-2"
                >
                  → {list.title}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setLabelOpen((v) => !v);
            setMoveOpen(false);
          }}
          className="rounded-md text-xs text-fg-soft hover:text-fg hover:bg-elev px-2 py-1"
        >
          Label
        </button>
        {labelOpen && (
          <div className="absolute bottom-full mb-1 left-0 min-w-[180px] rounded-md bg-surface border border-line shadow-md overflow-hidden p-1.5 max-h-60 overflow-y-auto board-scroll">
            {labelOrder.length === 0 ? (
              <div className="text-[11px] text-subtle p-2">
                Keine Labels vorhanden.
              </div>
            ) : (
              labelOrder.map((lid) => {
                const lbl = labels[lid];
                if (!lbl) return null;
                const allHave = ids.every((cid) =>
                  (cardLabels[cid] ?? []).includes(lid)
                );
                return (
                  <button
                    key={lid}
                    type="button"
                    onClick={() => void bulkToggleLabel(lid)}
                    className="w-full flex items-center gap-2 rounded-md hover:bg-elev px-2 py-1.5"
                  >
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium border ${labelPill(lbl.color)}`}
                    >
                      {lbl.name}
                    </span>
                    {allHave && (
                      <span className="ml-auto text-[10px] text-emerald-700 dark:text-emerald-300">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleDelete}
        className="rounded-md text-xs text-rose-700 dark:text-rose-300 hover:bg-rose-500/10 px-2 py-1"
      >
        Löschen
      </button>

      <span className="text-muted">·</span>

      <button
        type="button"
        onClick={clearSelection}
        className="rounded-md text-xs text-muted hover:text-fg-soft hover:bg-elev px-2 py-1"
      >
        Auswahl aufheben
      </button>
    </div>
  );
}
