'use client';
import { useEffect, useState } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { useBoard } from '@/store/boardStore';
import { List } from './List';
import { AddListInline } from './AddListInline';

export default function Board() {
  const listOrder = useBoard((s) => s.listOrder);
  const moveCard = useBoard((s) => s.moveCard);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    moveCard(
      { listId: source.droppableId, index: source.index },
      { listId: destination.droppableId, index: destination.index }
    );
  };

  return (
    <div className="flex-1 overflow-x-auto board-scroll p-6 min-h-0">
      {mounted ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 items-start min-h-full">
            {listOrder.map((id) => (
              <List key={id} listId={id} />
            ))}
            <AddListInline />
          </div>
        </DragDropContext>
      ) : (
        <div className="flex gap-4 items-start">
          {listOrder.map((id) => (
            <div
              key={id}
              className="w-[320px] h-40 rounded-2xl bg-slate-900/60 border border-slate-800/80 animate-pulse"
            />
          ))}
        </div>
      )}
    </div>
  );
}
