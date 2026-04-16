'use client';
import { useEffect, useState } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { useBoard } from '@/store/boardStore';
import { List } from './List';

export default function Board() {
  const listOrder = useBoard((s) => s.listOrder);
  const moveCard = useBoard((s) => s.moveCard);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const onDragEnd = async (result: DropResult) => {
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

    if (destination.droppableId === 'done' && source.droppableId !== 'done') {
      const confetti = (await import('canvas-confetti')).default;
      confetti({
        particleCount: 90,
        spread: 75,
        startVelocity: 45,
        origin: { y: 0.65 },
        colors: ['#a78bfa', '#34d399', '#60a5fa', '#f472b6', '#fbbf24'],
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="px-6 py-4 border-b border-slate-800/60 backdrop-blur-sm flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-emerald-400 grid place-items-center font-bold text-white text-sm shadow-lg shadow-violet-500/20">
          k
        </div>
        <div>
          <h1 className="text-base font-semibold text-slate-100 tracking-tight">
            kanbanly
          </h1>
          <p className="text-[11px] text-slate-500">Flow first. Build fast.</p>
        </div>
      </header>

      <div className="flex-1 overflow-x-auto board-scroll p-6 min-h-0">
        {mounted ? (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 items-start min-h-full">
              {listOrder.map((id) => (
                <List key={id} listId={id} />
              ))}
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
    </div>
  );
}
