'use client';
import { useState } from 'react';
import { useBoard } from '@/store/boardStore';
import { confirm } from '@/store/confirmStore';
import {
  LABEL_COLOR_KEYS,
  LABEL_COLORS,
  labelPill,
  type LabelColor,
} from '@/lib/labelColors';

export function LabelsPicker({ cardId }: { cardId: string }) {
  const labels = useBoard((s) => s.labels);
  const labelOrder = useBoard((s) => s.labelOrder);
  const applied = useBoard((s) => s.cardLabels[cardId]) ?? [];
  const toggleCardLabel = useBoard((s) => s.toggleCardLabel);
  const createLabel = useBoard((s) => s.createLabel);
  const deleteLabel = useBoard((s) => s.deleteLabel);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<LabelColor>('violet');

  return (
    <div className="space-y-2">
      {labelOrder.length === 0 && !creating ? (
        <p className="text-xs text-slate-500">Noch keine Labels.</p>
      ) : (
        <ul className="space-y-1">
          {labelOrder.map((id) => {
            const lbl = labels[id];
            if (!lbl) return null;
            const active = applied.includes(id);
            return (
              <li key={id} className="flex items-center gap-2 group">
                <button
                  type="button"
                  onClick={() => toggleCardLabel(cardId, id)}
                  className={`flex-1 flex items-center gap-2 rounded-md px-2 py-1 border text-xs text-left transition-colors ${labelPill(lbl.color)} ${
                    active ? 'ring-1 ring-violet-400/60' : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  <span className="flex-1 truncate">{lbl.name}</span>
                  {active && <span className="text-[10px]">✓</span>}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Label "${lbl.name}" löschen?`,
                      description:
                        'Das Label wird von allen Karten entfernt und board-weit gelöscht.',
                      confirmLabel: 'Löschen',
                      danger: true,
                    });
                    if (ok) deleteLabel(id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 text-sm shrink-0 transition-opacity"
                  aria-label="Label löschen"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {creating ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = newName.trim();
            if (!t) return;
            createLabel(t, newColor);
            setNewName('');
            setCreating(false);
          }}
          className="rounded-md bg-slate-800/60 border border-slate-700 p-2 space-y-2"
        >
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Label-Name"
            className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400/60"
          />
          <div className="flex flex-wrap gap-1">
            {LABEL_COLOR_KEYS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setNewColor(c)}
                className={`h-5 w-5 rounded ${LABEL_COLORS[c].swatch} transition-transform ${
                  newColor === c ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                }`}
                aria-label={`Farbe ${c}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-md bg-violet-500/90 hover:bg-violet-400 text-white text-xs font-medium py-1"
            >
              Erstellen
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setNewName('');
              }}
              className="rounded-md px-2 text-xs text-slate-400 hover:text-slate-200"
            >
              Abbrechen
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="w-full text-left text-xs text-violet-300 hover:text-violet-200"
        >
          + Neues Label
        </button>
      )}
    </div>
  );
}
