'use client';
import { memo, useState } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { useBoard } from '@/store/boardStore';
import { Card } from './Card';
import { PlusIcon } from './Icons';

type Props = { listId: string };

function ListInner({ listId }: Props) {
  const list = useBoard((s) => s.lists[listId]);
  const addCard = useBoard((s) => s.addCard);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  if (!list) return null;

  const dotColor =
    list.id === 'done'
      ? 'bg-emerald-400'
      : list.id === 'doing'
      ? 'bg-violet-400'
      : 'bg-slate-400';

  return (
    <div className="w-[320px] shrink-0 flex flex-col rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 max-h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${dotColor}`} />
          <h2 className="text-sm font-semibold tracking-wide text-slate-100">
            {list.title}
          </h2>
          <span className="text-[11px] text-slate-500 tabular-nums">
            {list.cardIds.length}
          </span>
        </div>
      </div>

      <Droppable droppableId={list.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 overflow-y-auto p-3 space-y-2 transition-colors ${
              snapshot.isDraggingOver ? 'bg-slate-800/30' : ''
            }`}
          >
            {list.cardIds.map((cardId, idx) => (
              <Draggable key={cardId} draggableId={cardId} index={idx}>
                {(drag, snap) => (
                  <div
                    ref={drag.innerRef}
                    {...drag.draggableProps}
                    {...drag.dragHandleProps}
                    style={{
                      ...drag.draggableProps.style,
                      zIndex: snap.isDragging ? 50 : 'auto',
                    }}
                  >
                    <Card id={cardId} isDragging={snap.isDragging} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <div className="p-2 border-t border-slate-800/80">
        {adding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const t = newTitle.trim();
              if (t) addCard(list.id, t);
              setNewTitle('');
              setAdding(false);
            }}
            className="flex flex-col gap-2"
          >
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setAdding(false);
                  setNewTitle('');
                }
              }}
              placeholder="Kartentitel…"
              className="w-full rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400/60"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-violet-500/90 hover:bg-violet-400 text-white text-xs font-medium py-1.5 transition-colors"
              >
                Hinzufügen
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setNewTitle('');
                }}
                className="rounded-lg px-3 text-xs text-slate-400 hover:text-slate-200"
              >
                Abbrechen
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-2 rounded-lg py-2 text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors"
          >
            <PlusIcon />
            Karte hinzufügen
          </button>
        )}
      </div>
    </div>
  );
}

export const List = memo(ListInner);
