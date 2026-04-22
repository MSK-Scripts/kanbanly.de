'use client';
import { memo, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { useBoard } from '@/store/boardStore';
import { cardMatchesFilters, isFilterActive } from '@/lib/filterCards';
import { Card } from './Card';
import { PlusIcon } from './Icons';
import { InlineEditableText } from './InlineEditableText';
import { ListMenu } from './ListMenu';

type Props = { listId: string; index: number };

function ListInner({ listId, index }: Props) {
  const list = useBoard((s) => s.lists[listId]);
  const addCard = useBoard((s) => s.addCard);
  const renameList = useBoard((s) => s.renameList);
  const filters = useBoard((s) => s.filters);
  const cards = useBoard((s) => s.cards);
  const assignees = useBoard((s) => s.assignees);
  const cardLabels = useBoard((s) => s.cardLabels);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  const filterOn = isFilterActive(filters);
  const visibleCardIds = useMemo(() => {
    if (!list) return [];
    if (!filterOn) return list.cardIds;
    return list.cardIds.filter((cid) =>
      cardMatchesFilters(cid, { filters, cards, assignees, cardLabels })
    );
  }, [list, filterOn, filters, cards, assignees, cardLabels]);

  if (!list) return null;

  const titleLower = list.title.trim().toLowerCase();
  const isDone =
    titleLower === 'done' ||
    titleLower === 'erledigt' ||
    titleLower === 'fertig' ||
    titleLower === 'abgeschlossen';
  const isDoing =
    titleLower === 'in progress' ||
    titleLower === 'doing' ||
    titleLower === 'in arbeit';
  const dotColor = isDone
    ? 'bg-emerald-400'
    : isDoing
    ? 'bg-accent-hover'
    : 'bg-muted';

  return (
    <Draggable draggableId={listId} index={index}>
      {(listDrag, listSnap) => (
        <div
          ref={listDrag.innerRef}
          {...listDrag.draggableProps}
          style={{
            ...listDrag.draggableProps.style,
            zIndex: listSnap.isDragging ? 9998 : undefined,
          }}
          className={`w-[88vw] sm:w-[320px] shrink-0 flex flex-col rounded-2xl bg-surface/70 border border-line/80 max-h-[calc(100vh-9rem)] sm:max-h-[calc(100vh-8rem)] ${
            listSnap.isDragging ? 'shadow-xl ring-1 ring-accent-hover/40' : ''
          }`}
        >
          <div
            {...listDrag.dragHandleProps}
            className="flex items-center justify-between px-4 py-3 border-b border-line/80 cursor-grab active:cursor-grabbing select-none"
          >
            <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${dotColor}`} />
          <InlineEditableText
            value={list.title}
            onSave={(v) => renameList(list.id, v)}
            ariaLabel="Spalte umbenennen"
            viewClassName="text-sm font-semibold tracking-wide text-fg hover:text-accent-hover transition-colors"
            inputClassName="text-sm font-semibold tracking-wide text-fg bg-elev border border-muted rounded px-1 -mx-1 focus:outline-none focus:ring-1 focus:ring-accent-hover/60 min-w-0"
          />
          <span className="text-[11px] text-subtle tabular-nums font-mono">
            {filterOn && visibleCardIds.length !== list.cardIds.length
              ? `${visibleCardIds.length}/${list.cardIds.length}`
              : list.cardIds.length}
          </span>
        </div>
        <ListMenu listId={list.id} />
      </div>

      <Droppable droppableId={list.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 overflow-y-auto board-scroll p-3 space-y-2 transition-colors ${
              snapshot.isDraggingOver ? 'bg-elev/30' : ''
            }`}
          >
            {list.cardIds.map((cardId, idx) => {
              const dimmed =
                filterOn && !visibleCardIds.includes(cardId);
              return (
                <Draggable key={cardId} draggableId={cardId} index={idx}>
                  {(drag, snap) => {
                    const content = (
                      <div
                        ref={drag.innerRef}
                        {...drag.draggableProps}
                        {...drag.dragHandleProps}
                        style={{
                          ...drag.draggableProps.style,
                          zIndex: snap.isDragging ? 9999 : undefined,
                        }}
                        className={
                          dimmed && !snap.isDragging
                            ? 'opacity-25 transition-opacity'
                            : 'transition-opacity'
                        }
                      >
                        <Card id={cardId} isDragging={snap.isDragging} />
                      </div>
                    );
                    if (snap.isDragging && portalTarget) {
                      return createPortal(content, portalTarget);
                    }
                    return content;
                  }}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <div className="p-2 border-t border-line/80">
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
              className="w-full rounded-lg bg-elev/80 border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent-hover/60"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-accent/90 hover:bg-accent-hover text-white text-xs font-medium py-1.5 transition-colors"
              >
                Hinzufügen
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setNewTitle('');
                }}
                className="rounded-lg px-3 text-xs text-muted hover:text-fg-soft"
              >
                Abbrechen
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-2 rounded-lg py-2 text-xs text-muted hover:text-fg hover:bg-elev/60 transition-colors"
          >
            <PlusIcon />
            Karte hinzufügen
          </button>
        )}
      </div>
        </div>
      )}
    </Draggable>
  );
}

export const List = memo(ListInner);
