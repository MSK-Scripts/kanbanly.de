'use client';
import { useRef } from 'react';
import { DragDropContext, Droppable, type DropResult } from '@hello-pangea/dnd';
import { useBoard } from '@/store/boardStore';
import { useMounted } from '@/lib/useMounted';
import { List } from './List';
import { AddListInline } from './AddListInline';
import { BulkActionBar } from './BulkActionBar';
import { SwimlaneBoard } from './SwimlaneBoard';

export default function Board() {
  const listOrder = useBoard((s) => s.listOrder);
  const moveCard = useBoard((s) => s.moveCard);
  const moveList = useBoard((s) => s.moveList);
  const groupBy = useBoard((s) => s.groupBy);
  const backgroundUrl = useBoard((s) => s.backgroundUrl);
  const mounted = useMounted();
  const scrollRef = useRef<HTMLDivElement>(null);

  function onPanStart(e: React.MouseEvent) {
    if (e.target !== e.currentTarget) return;
    if (e.button !== 0) return;
    const sc = scrollRef.current;
    if (!sc) return;
    const startX = e.pageX;
    const startScrollLeft = sc.scrollLeft;

    function onMove(ev: MouseEvent) {
      if (!sc) return;
      sc.scrollLeft = startScrollLeft - (ev.pageX - startX);
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (sc) sc.style.cursor = '';
    }

    sc.style.cursor = 'grabbing';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const onDragEnd = (result: DropResult) => {
    const { source, destination, type } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    if (type === 'COLUMN') {
      moveList(source.index, destination.index);
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
        <BoardBackground url={backgroundUrl} />
        <SwimlaneBoard />
        <BulkActionBar />
      </>
    );
  }

  return (
    <>
      <BoardBackground url={backgroundUrl} />
      <div
        ref={scrollRef}
        onMouseDown={onPanStart}
        className="relative flex-1 overflow-x-auto overscroll-x-contain board-scroll p-3 sm:p-6 min-h-0 cursor-grab"
      >
        {mounted ? (
          listOrder.length === 0 ? (
            <div className="h-full min-h-[60vh] flex items-center justify-center">
              <div className="max-w-sm text-center rounded-md bg-surface border border-line p-8">
                <h3 className="text-base font-semibold text-fg mb-1">
                  Leere Bühne
                </h3>
                <p className="text-sm text-muted mb-5">
                  Leg deine erste Spalte an — z. B. „To-do&quot;, „In Arbeit&quot;,
                  „Erledigt&quot;.
                </p>
                <div className="inline-flex">
                  <AddListInline />
                </div>
              </div>
            </div>
          ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable
                droppableId="board"
                type="COLUMN"
                direction="horizontal"
              >
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    onMouseDown={onPanStart}
                    className="flex gap-3 sm:gap-4 items-start min-h-full"
                  >
                    {listOrder.map((id, idx) => (
                      <List key={id} listId={id} index={idx} />
                    ))}
                    {provided.placeholder}
                    <AddListInline />
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )
        ) : (
          <div className="flex gap-3 sm:gap-4 items-start">
            {listOrder.map((id) => (
              <div
                key={id}
                className="w-[88vw] sm:w-[320px] h-40 rounded-md bg-surface border border-line animate-pulse shrink-0"
              />
            ))}
          </div>
        )}
      </div>
      <BulkActionBar />
    </>
  );
}

function BoardBackground({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none -z-10"
    >
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url("${url.replace(/"/g, '%22')}")` }}
      />
      <div className="absolute inset-0 bg-bg/70 backdrop-blur-[2px]" />
    </div>
  );
}
