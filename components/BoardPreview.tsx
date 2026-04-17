import { labelPill } from '@/lib/labelColors';

type PreviewCard = {
  title: string;
  labels: Array<{ name: string; color: string }>;
  due?: { label: string; tone: 'overdue' | 'today' | 'soon' | 'future' };
  progress?: { done: number; total: number };
  assignees?: string[];
};

const TONE_CLASSES = {
  overdue: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  today: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  soon: 'bg-slate-700/60 text-slate-200 border-slate-600',
  future: 'bg-slate-800 text-slate-400 border-slate-700',
} as const;

const COLUMNS: Array<{ title: string; dotColor: string; cards: PreviewCard[] }> = [
  {
    title: 'To do',
    dotColor: 'bg-slate-400',
    cards: [
      {
        title: 'Landing-Page Hero überarbeiten',
        labels: [{ name: 'Design', color: 'violet' }],
        due: { label: '22.04', tone: 'soon' },
        assignees: ['F'],
      },
      {
        title: 'Onboarding-Flow skizzieren',
        labels: [
          { name: 'UX', color: 'sky' },
          { name: 'Q2', color: 'teal' },
        ],
        progress: { done: 0, total: 4 },
        assignees: ['F', 'M'],
      },
    ],
  },
  {
    title: 'In Arbeit',
    dotColor: 'bg-violet-400',
    cards: [
      {
        title: 'Realtime-Sync zwischen Sessions',
        labels: [{ name: 'Backend', color: 'emerald' }],
        due: { label: 'heute', tone: 'today' },
        progress: { done: 3, total: 5 },
        assignees: ['F'],
      },
      {
        title: 'Mobile-Column 88vw testen',
        labels: [{ name: 'Mobile', color: 'pink' }],
        progress: { done: 1, total: 3 },
        assignees: ['F', 'J', 'M'],
      },
    ],
  },
  {
    title: 'Erledigt',
    dotColor: 'bg-emerald-400',
    cards: [
      {
        title: 'Labels + Fälligkeitsdaten',
        labels: [
          { name: 'Feature', color: 'amber' },
          { name: 'v1', color: 'rose' },
        ],
        progress: { done: 6, total: 6 },
        assignees: ['F'],
      },
      {
        title: 'Bestätigungsdialog selbst gebaut',
        labels: [{ name: 'UX', color: 'sky' }],
        assignees: ['M'],
      },
    ],
  },
];

function PreviewCardView({ card }: { card: PreviewCard }) {
  const progressPct = card.progress
    ? (card.progress.done / card.progress.total) * 100
    : 0;

  return (
    <div className="rounded-xl bg-slate-800/80 border border-slate-700/60 p-3 shadow-sm">
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

      {card.progress && (
        <div className="mt-3">
          <div className="text-[11px] text-slate-400 mb-1 font-mono tabular-nums">
            {card.progress.done}/{card.progress.total} Tasks
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-700/50 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-emerald-400"
              style={{ width: `${progressPct}%` }}
            />
          </div>
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
  return (
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
        <div className="flex gap-3 sm:gap-4 items-start">
          {COLUMNS.map((col) => (
            <div
              key={col.title}
              className="w-[260px] sm:w-[280px] shrink-0 flex flex-col rounded-2xl bg-slate-900/70 border border-slate-800/80"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${col.dotColor}`} />
                  <span className="text-sm font-semibold tracking-wide text-slate-100">
                    {col.title}
                  </span>
                  <span className="text-[11px] text-slate-500 tabular-nums font-mono">
                    {col.cards.length}
                  </span>
                </div>
              </div>
              <div className="p-3 space-y-2">
                {col.cards.map((c, i) => (
                  <PreviewCardView key={i} card={c} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
