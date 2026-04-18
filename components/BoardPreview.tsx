'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { labelPill } from '@/lib/labelColors';

type PreviewTask = { id: string; title: string; done: boolean };

type PreviewCard = {
  id: string;
  title: string;
  labels: Array<{ name: string; color: string }>;
  due?: { label: string; tone: 'overdue' | 'today' | 'soon' | 'future' };
  tasks?: PreviewTask[];
  assignees?: string[];
};

type PreviewColumn = {
  id: string;
  title: string;
  dotColor: string;
  cardIds: string[];
};

const TONE_CLASSES = {
  overdue: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  today: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  soon: 'bg-slate-700/60 text-slate-200 border-slate-600',
  future: 'bg-slate-800 text-slate-400 border-slate-700',
} as const;

const INITIAL_CARDS: Record<string, PreviewCard> = {
  c1: {
    id: 'c1',
    title: 'Landing-Page Hero überarbeiten',
    labels: [{ name: 'Design', color: 'violet' }],
    due: { label: '22.04', tone: 'soon' },
    assignees: ['F'],
  },
  c2: {
    id: 'c2',
    title: 'Onboarding-Flow skizzieren',
    labels: [
      { name: 'UX', color: 'sky' },
      { name: 'Q2', color: 'teal' },
    ],
    tasks: [
      { id: 't1', title: 'Personas definieren', done: false },
      { id: 't2', title: 'Wireframes zeichnen', done: false },
      { id: 't3', title: 'Review mit Team', done: false },
      { id: 't4', title: 'Prototyp in Figma', done: false },
    ],
    assignees: ['F', 'M'],
  },
  c3: {
    id: 'c3',
    title: 'Realtime-Sync zwischen Sessions',
    labels: [{ name: 'Backend', color: 'emerald' }],
    due: { label: 'heute', tone: 'today' },
    tasks: [
      { id: 't5', title: 'Supabase Channels einrichten', done: true },
      { id: 't6', title: 'Postgres-Changes abonnieren', done: true },
      { id: 't7', title: 'Debounced refetch', done: true },
      { id: 't8', title: 'Pulse-Effekt bei Remote-Änderung', done: false },
      { id: 't9', title: 'Token-Refresh beim Reconnect', done: false },
    ],
    assignees: ['F'],
  },
  c4: {
    id: 'c4',
    title: 'Mobile-Column 88vw testen',
    labels: [{ name: 'Mobile', color: 'pink' }],
    tasks: [
      { id: 't10', title: 'iOS Safari prüfen', done: true },
      { id: 't11', title: 'Swipe-Verhalten', done: false },
      { id: 't12', title: 'Landscape-Modus', done: false },
    ],
    assignees: ['F', 'J', 'M'],
  },
  c5: {
    id: 'c5',
    title: 'Labels + Fälligkeitsdaten',
    labels: [
      { name: 'Feature', color: 'amber' },
      { name: 'v1', color: 'rose' },
    ],
    tasks: [
      { id: 't13', title: 'Label-Tabelle + RLS', done: true },
      { id: 't14', title: '8 Farben definieren', done: true },
      { id: 't15', title: 'Label-Picker im Modal', done: true },
      { id: 't16', title: 'Due-Badge mit Tönen', done: true },
      { id: 't17', title: 'Auf Karten anzeigen', done: true },
      { id: 't18', title: 'Deploy + Test', done: true },
    ],
    assignees: ['F'],
  },
  c6: {
    id: 'c6',
    title: 'Bestätigungsdialog selbst gebaut',
    labels: [{ name: 'UX', color: 'sky' }],
    assignees: ['M'],
  },
};

const INITIAL_COLUMNS: PreviewColumn[] = [
  { id: 'todo', title: 'To do', dotColor: 'bg-slate-400', cardIds: ['c1', 'c2'] },
  { id: 'doing', title: 'In Arbeit', dotColor: 'bg-violet-400', cardIds: ['c3', 'c4'] },
  {
    id: 'done',
    title: 'Erledigt',
    dotColor: 'bg-emerald-400',
    cardIds: ['c5', 'c6'],
  },
];

function PreviewCardView({
  card,
  onToggleTask,
}: {
  card: PreviewCard;
  onToggleTask: (cardId: string, taskId: string) => void;
}) {
  const total = card.tasks?.length ?? 0;
  const done = card.tasks?.filter((t) => t.done).length ?? 0;
  const progressPct = total > 0 ? (done / total) * 100 : 0;

  return (
    <div className="rounded-xl bg-slate-800/80 border border-slate-700/60 p-3 shadow-sm transition-shadow hover:shadow-md hover:border-slate-600">
      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {card.labels.map((l) => (
            <span
              key={l.name}
              className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium border ${labelPill(l.color)}`}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}

      <h4 className="text-sm font-medium text-slate-100 leading-snug break-words">
        {card.title}
      </h4>

      {card.due && (
        <div className="mt-2">
          <span
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium font-mono tabular-nums ${TONE_CLASSES[card.due.tone]}`}
          >
            <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" aria-hidden>
              <path d="M7 3v2H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2h-2V3h-2v2H9V3H7zm12 6v10H5V9h14z" />
            </svg>
            {card.due.label}
          </span>
        </div>
      )}

      {total > 0 && (
        <div className="mt-3">
          <div className="text-[11px] text-slate-400 mb-1 font-mono tabular-nums">
            {done}/{total} Tasks
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-700/50 overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-emerald-400 transition-[width] duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <ul className="space-y-1">
            {card.tasks?.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTask(card.id, t.id);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className="w-full flex items-center gap-2 text-left text-[12px] text-slate-300 hover:text-slate-100"
                >
                  <span
                    className={`h-3.5 w-3.5 shrink-0 rounded border transition-colors ${
                      t.done
                        ? 'bg-emerald-500/80 border-emerald-400'
                        : 'border-slate-600'
                    }`}
                  />
                  <span className={t.done ? 'line-through text-slate-500' : ''}>
                    {t.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {card.assignees && card.assignees.length > 0 && (
        <div className="mt-3 flex -space-x-1.5">
          {card.assignees.slice(0, 4).map((initial, i) => (
            <span
              key={i}
              className="h-5 w-5 grid place-items-center rounded-full bg-violet-500/80 text-[10px] font-semibold text-white ring-2 ring-slate-800"
            >
              {initial}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function BoardPreview() {
  const [columns, setColumns] = useState<PreviewColumn[]>(INITIAL_COLUMNS);
  const [cards, setCards] = useState<Record<string, PreviewCard>>(INITIAL_CARDS);
  const [mounted, setMounted] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    setPortalTarget(document.body);
  }, []);

  const reset = () => {
    setColumns(INITIAL_COLUMNS);
    setCards(INITIAL_CARDS);
  };

  const toggleTask = (cardId: string, taskId: string) => {
    setCards((prev) => {
      const card = prev[cardId];
      if (!card || !card.tasks) return prev;
      return {
        ...prev,
        [cardId]: {
          ...card,
          tasks: card.tasks.map((t) =>
            t.id === taskId ? { ...t, done: !t.done } : t
          ),
        },
      };
    });
  };

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }
    setColumns((prev) => {
      const next = prev.map((c) => ({ ...c, cardIds: [...c.cardIds] }));
      const srcCol = next.find((c) => c.id === source.droppableId);
      const dstCol = next.find((c) => c.id === destination.droppableId);
      if (!srcCol || !dstCol) return prev;
      const [moved] = srcCol.cardIds.splice(source.index, 1);
      dstCol.cardIds.splice(destination.index, 0, moved);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-[11px] sm:text-xs text-slate-500 font-mono">
          Zieh Karten, hak Tasks ab — probier's aus.
        </p>
        <button
          type="button"
          onClick={reset}
          className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          Zurücksetzen
        </button>
      </div>

      <div className="rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-2xl shadow-black/40 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
          </div>
          <div className="flex-1 mx-2 rounded-md bg-slate-800/80 border border-slate-700/60 px-3 py-1 text-[11px] text-slate-400 font-mono truncate">
            kanbanly.de/boards/alpha-projekt
          </div>
        </div>

        <div className="overflow-x-auto board-scroll p-3 sm:p-4">
          {mounted ? (
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="flex gap-3 sm:gap-4 items-start">
                {columns.map((col) => (
                  <div
                    key={col.id}
                    className="w-[260px] sm:w-[280px] shrink-0 flex flex-col rounded-2xl bg-slate-900/70 border border-slate-800/80"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${col.dotColor}`}
                        />
                        <span className="text-sm font-semibold tracking-wide text-slate-100">
                          {col.title}
                        </span>
                        <span className="text-[11px] text-slate-500 tabular-nums font-mono">
                          {col.cardIds.length}
                        </span>
                      </div>
                    </div>
                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`p-3 space-y-2 min-h-[60px] transition-colors ${
                            snapshot.isDraggingOver ? 'bg-slate-800/30' : ''
                          }`}
                        >
                          {col.cardIds.map((cid, idx) => {
                            const card = cards[cid];
                            if (!card) return null;
                            return (
                              <Draggable
                                key={cid}
                                draggableId={cid}
                                index={idx}
                              >
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
                                        snap.isDragging
                                          ? 'ring-1 ring-violet-400/50 rounded-xl'
                                          : ''
                                      }
                                    >
                                      <PreviewCardView
                                        card={card}
                                        onToggleTask={toggleTask}
                                      />
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
                  </div>
                ))}
              </div>
            </DragDropContext>
          ) : (
            <div className="flex gap-3 sm:gap-4 items-start">
              {columns.map((col) => (
                <div
                  key={col.id}
                  className="w-[260px] sm:w-[280px] shrink-0 h-40 rounded-2xl bg-slate-900/60 border border-slate-800/80 animate-pulse"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
