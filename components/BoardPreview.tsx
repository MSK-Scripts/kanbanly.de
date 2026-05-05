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
  overdue:
    'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  today:
    'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  soon: 'bg-elev-hover/60 text-fg border-line-strong',
  future: 'bg-elev text-muted border-line-strong',
} as const;

const INITIAL_CARDS: Record<string, PreviewCard> = {
  c1: {
    id: 'c1',
    title: 'Newsletter Mai vorbereiten',
    labels: [{ name: 'Marketing', color: 'violet' }],
    due: { label: '15.05', tone: 'soon' },
    assignees: ['L'],
  },
  c2: {
    id: 'c2',
    title: 'Briefing für Neukunde Schmitz GmbH',
    labels: [
      { name: 'Vertrieb', color: 'sky' },
      { name: 'Q2', color: 'teal' },
    ],
    tasks: [
      { id: 't1', title: 'Kick-off-Call terminieren', done: false },
      { id: 't2', title: 'Anforderungs-Doc anlegen', done: false },
      { id: 't3', title: 'Angebot kalkulieren', done: false },
    ],
    assignees: ['L', 'M'],
  },
  c3: {
    id: 'c3',
    title: 'Website-Relaunch finalisieren',
    labels: [{ name: 'Web', color: 'emerald' }],
    due: { label: 'heute', tone: 'today' },
    tasks: [
      { id: 't5', title: 'DNS umstellen', done: true },
      { id: 't6', title: 'Tracking & Cookie-Banner', done: true },
      { id: 't7', title: 'Lighthouse-Score prüfen', done: true },
      { id: 't8', title: '404-Weiterleitungen anlegen', done: false },
      { id: 't9', title: 'Newsletter-Formular testen', done: false },
    ],
    assignees: ['L'],
  },
  c4: {
    id: 'c4',
    title: 'Rechnungen April versenden',
    labels: [{ name: 'Finanzen', color: 'pink' }],
    tasks: [
      { id: 't10', title: 'Stunden zusammenfassen', done: true },
      { id: 't11', title: 'PDFs erstellen', done: false },
      { id: 't12', title: 'Per Mail rausschicken', done: false },
    ],
    assignees: ['L'],
  },
  c5: {
    id: 'c5',
    title: 'Logo-Redesign abgenommen',
    labels: [
      { name: 'Design', color: 'amber' },
      { name: 'v2', color: 'rose' },
    ],
    tasks: [
      { id: 't13', title: 'Moodboard', done: true },
      { id: 't14', title: 'Erste Entwürfe', done: true },
      { id: 't15', title: 'Feedback-Runde', done: true },
      { id: 't16', title: 'Finalisierung', done: true },
      { id: 't17', title: 'Brand-Guide anlegen', done: true },
    ],
    assignees: ['M'],
  },
  c6: {
    id: 'c6',
    title: 'Onboarding-Guide veröffentlicht',
    labels: [{ name: 'Content', color: 'sky' }],
    assignees: ['L', 'M', 'J'],
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
    <div className="rounded-md bg-elev border border-line-strong p-3 shadow-sm transition-shadow hover:shadow-md hover:border-muted">
      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {card.labels.map((l) => (
            <span
              key={l.name}
              className={`inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-medium border ${labelPill(l.color)}`}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}

      <h4 className="text-sm font-medium text-fg leading-snug break-words">
        {card.title}
      </h4>

      {card.due && (
        <div className="mt-2">
          <span
            className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium font-mono tabular-nums ${TONE_CLASSES[card.due.tone]}`}
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
          <div className="text-[11px] text-muted mb-1 font-mono tabular-nums">
            {done}/{total} Tasks
          </div>
          <div className="h-1.5 w-full rounded-sm bg-elev-hover overflow-hidden mb-2">
            <div
              className="h-full bg-accent transition-[width] duration-300"
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
                  className="w-full flex items-center gap-2 text-left text-[12px] text-fg-soft hover:text-fg"
                >
                  <span
                    className={`h-3.5 w-3.5 shrink-0 rounded-sm border transition-colors ${
                      t.done
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-line-strong'
                    }`}
                  />
                  <span className={t.done ? 'line-through text-subtle' : ''}>
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
              className="h-5 w-5 grid place-items-center rounded-full bg-accent text-[10px] font-semibold text-white ring-2 ring-surface"
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
        <p className="text-[11px] sm:text-xs text-subtle font-mono">
          Zieh Karten, hak Tasks ab — probier's aus.
        </p>
        <button
          type="button"
          onClick={reset}
          className="text-[11px] text-subtle hover:text-fg-soft transition-colors"
        >
          Zurücksetzen
        </button>
      </div>

      <div className="rounded-md bg-surface border border-line shadow-md overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line bg-bg">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-elev-hover" />
            <span className="h-2.5 w-2.5 rounded-full bg-elev-hover" />
            <span className="h-2.5 w-2.5 rounded-full bg-elev-hover" />
          </div>
          <div className="flex-1 mx-2 rounded-sm bg-elev border border-line-strong px-3 py-1 text-[11px] text-muted font-mono truncate">
            kanbanly.de/boards/agentur-q2
          </div>
        </div>

        <div className="overflow-x-auto board-scroll p-3 sm:p-4">
          {mounted ? (
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="flex gap-3 sm:gap-4 items-start">
                {columns.map((col) => (
                  <div
                    key={col.id}
                    className="w-[260px] sm:w-[280px] shrink-0 flex flex-col rounded-md bg-surface border border-line"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${col.dotColor}`}
                        />
                        <span className="text-sm font-semibold tracking-wide text-fg">
                          {col.title}
                        </span>
                        <span className="text-[11px] text-subtle tabular-nums font-mono">
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
                            snapshot.isDraggingOver ? 'bg-elev/30' : ''
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
                                          ? 'ring-1 ring-accent rounded-md'
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
                  className="w-[260px] sm:w-[280px] shrink-0 h-40 rounded-md bg-surface border border-line animate-pulse"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
