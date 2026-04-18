'use client';
import { useEffect, useState } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { useBoard } from '@/store/boardStore';
import { List } from './List';
import { AddListInline } from './AddListInline';
import { BulkActionBar } from './BulkActionBar';
import { SwimlaneBoard } from './SwimlaneBoard';

export default function Board() {
  const listOrder = useBoard((s) => s.listOrder);
  const moveCard = useBoard((s) => s.moveCard);
  const groupBy = useBoard((s) => s.groupBy);
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

  if (mounted && groupBy !== 'none' && listOrder.length > 0) {
    return (
      <>
        <SwimlaneBoard />
        <BulkActionBar />
      </>
    );
  }

  return (
    <>
    <div className="flex-1 overflow-x-auto overscroll-x-contain board-scroll p-3 sm:p-6 min-h-0">
      {mounted ? (
        listOrder.length === 0 ? (
          <div className="h-full min-h-[60vh] flex items-center justify-center">
            <div className="max-w-sm text-center rounded-2xl bg-surface/50 border border-line/80 p-8">
              <h3 className="text-base font-semibold text-fg mb-1">
                Leere Bühne
              </h3>
              <p className="text-sm text-muted mb-5">
                Leg deine erste Spalte an — z. B. „To-do", „In Arbeit",
                „Erledigt".
              </p>
              <div className="inline-flex">
                <AddListInline />
              </div>
            </div>
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-3 sm:gap-4 items-start min-h-full">
              {listOrder.map((id) => (
                <List key={id} listId={id} />
              ))}
              <AddListInline />
            </div>
          </DragDropContext>
        )
      ) : (
        <div className="flex gap-3 sm:gap-4 items-start">
          {listOrder.map((id) => (
            <div
              key={id}
              className="w-[88vw] sm:w-[320px] h-40 rounded-2xl bg-surface/60 border border-line/80 animate-pulse shrink-0"
            />
          ))}
        </div>
      )}
    </div>
    <BulkActionBar />
    </>
  );
}
