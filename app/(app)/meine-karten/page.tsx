import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Meine Karten · kanbanly',
};

type Ws = { name: string; slug: string };
type Boards = {
  id: string;
  name: string;
  slug: string;
  workspace_id: string;
  workspaces: Ws | Ws[] | null;
};
type Lists = {
  title: string;
  board_id: string;
  boards: Boards | Boards[] | null;
};
type Cards = {
  id: string;
  title: string;
  due_date: string | null;
  list_id: string;
  lists: Lists | Lists[] | null;
};
type Row = {
  card_id: string;
  cards: Cards | Cards[] | null;
};

function pick<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

type Bucket = 'overdue' | 'today' | 'week' | 'later' | 'none';

const BUCKET_LABELS: Record<Bucket, string> = {
  overdue: 'Überfällig',
  today: 'Heute',
  week: 'Diese Woche',
  later: 'Später',
  none: 'Ohne Fälligkeit',
};

const BUCKET_ORDER: Bucket[] = ['overdue', 'today', 'week', 'later', 'none'];

function bucketFor(dueIso: string | null): Bucket {
  if (!dueIso) return 'none';
  const due = new Date(dueIso + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays <= 7) return 'week';
  return 'later';
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

export default async function MyCardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('card_assignees')
    .select(
      `
        card_id,
        cards(
          id, title, due_date, list_id,
          lists(
            title, board_id,
            boards(
              id, name, slug, workspace_id,
              workspaces(name, slug)
            )
          )
        )
      `
    )
    .eq('user_id', user.id);

  type FlatRow = {
    id: string;
    title: string;
    due_date: string | null;
    list_title: string;
    board_name: string;
    board_slug: string;
    workspace_name: string | null;
    workspace_slug: string | null;
    bucket: Bucket;
  };

  const rows: FlatRow[] = [];
  for (const r of (data ?? []) as unknown as Row[]) {
    const card = pick(r.cards);
    if (!card) continue;
    const list = pick(card.lists);
    const board = pick(list?.boards);
    if (!board) continue;
    const ws = pick(board.workspaces);
    rows.push({
      id: card.id,
      title: card.title,
      due_date: card.due_date,
      list_title: list?.title ?? '',
      board_name: board.name,
      board_slug: board.slug,
      workspace_name: ws?.name ?? null,
      workspace_slug: ws?.slug ?? null,
      bucket: bucketFor(card.due_date),
    });
  }

  const grouped: Record<Bucket, FlatRow[]> = {
    overdue: [],
    today: [],
    week: [],
    later: [],
    none: [],
  };
  for (const row of rows) grouped[row.bucket].push(row);
  for (const b of BUCKET_ORDER) {
    grouped[b].sort((a, bb) => {
      const da = a.due_date ?? '9999-12-31';
      const db = bb.due_date ?? '9999-12-31';
      return da.localeCompare(db);
    });
  }

  const total = rows.length;

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-fg">Meine Karten</h1>
          <p className="text-sm text-muted mt-1">
            Alles was dir workspace-übergreifend zugewiesen ist —{' '}
            <span className="font-mono tabular-nums">{total}</span>{' '}
            {total === 1 ? 'Karte' : 'Karten'}.
          </p>
        </div>

        {total === 0 ? (
          <div className="rounded-md bg-surface border border-line p-8 sm:p-10 text-center">
            <h2 className="text-lg font-semibold text-fg mb-1">
              Nichts zugewiesen
            </h2>
            <p className="text-sm text-muted">
              Sobald dir jemand eine Karte zuweist, taucht sie hier auf.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {BUCKET_ORDER.map((bucket) => {
              const items = grouped[bucket];
              if (items.length === 0) return null;
              const accent =
                bucket === 'overdue'
                  ? 'text-rose-700 dark:text-rose-300'
                  : bucket === 'today'
                  ? 'text-amber-700 dark:text-amber-300'
                  : bucket === 'week'
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-fg-soft';
              return (
                <section key={bucket}>
                  <div className="flex items-baseline justify-between mb-2">
                    <h2
                      className={`text-xs font-semibold uppercase tracking-wide ${accent}`}
                    >
                      {BUCKET_LABELS[bucket]}
                    </h2>
                    <span className="text-[11px] text-subtle tabular-nums font-mono">
                      {items.length}
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {items.map((r) => (
                      <li key={r.id}>
                        <Link
                          href={`/boards/${r.board_slug}?card=${r.id}`}
                          className="block rounded-md bg-surface border border-line hover:border-accent-hover/50 hover:bg-surface transition-colors p-3 flex items-start gap-3"
                        >
                          <span className="text-[11px] text-muted tabular-nums font-mono pt-0.5 shrink-0 w-20">
                            {formatDate(r.due_date)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-fg font-medium leading-snug break-words">
                              {r.title}
                            </div>
                            <div className="text-[11px] text-subtle mt-0.5 truncate">
                              {r.workspace_name && (
                                <>
                                  <span>{r.workspace_name}</span>
                                  <span className="mx-1 text-faint">/</span>
                                </>
                              )}
                              <span>{r.board_name}</span>
                              <span className="mx-1 text-faint">·</span>
                              <span>{r.list_title}</span>
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
