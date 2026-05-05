import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { BoardMenu } from '@/components/BoardMenu';
import { BoardTabs } from '@/components/BoardTabs';
import { MembersDialog } from '@/components/MembersDialog';
import { RenameBoardTitle } from '@/components/RenameTitle';
import { Avatar } from '@/components/Avatar';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/slug';
import { labelPill } from '@/lib/labelColors';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const filterCol = isUuid(id) ? 'id' : 'slug';
  const { data } = await supabase
    .from('boards')
    .select('name')
    .eq(filterCol, id)
    .maybeSingle();
  const name = (data as { name?: string } | null)?.name;
  return { title: name ? `${name} · Tabelle · kanbanly` : 'Tabelle · kanbanly' };
}

type Row = {
  id: string;
  title: string;
  due_date: string | null;
  list_title: string;
  list_position: number;
  position: number;
  labels: Array<{ name: string; color: string }>;
  assignees: Array<{ username: string | null }>;
  taskTotal: number;
  taskDone: number;
};

function formatDate(iso: string | null): {
  label: string;
  tone: 'overdue' | 'today' | 'soon' | 'future' | 'none';
} {
  if (!iso) return { label: '—', tone: 'none' };
  const due = new Date(iso + 'T00:00:00');
  if (isNaN(due.getTime())) return { label: '—', tone: 'none' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  const label = due.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
  });
  if (diff < 0) return { label, tone: 'overdue' };
  if (diff === 0) return { label: 'heute', tone: 'today' };
  if (diff <= 2) return { label, tone: 'soon' };
  return { label, tone: 'future' };
}

const TONE_CLASSES: Record<
  ReturnType<typeof formatDate>['tone'],
  string
> = {
  overdue: 'text-rose-700 dark:text-rose-300',
  today: 'text-amber-700 dark:text-amber-300',
  soon: 'text-fg-soft',
  future: 'text-muted',
  none: 'text-faint',
};

export default async function TablePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const [{ id }, { sort }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();

  const filterCol = isUuid(id) ? 'id' : 'slug';
  const { data: boardRow } = await supabase
    .from('boards')
    .select(
      `
      id, slug, name, workspace_id, workspaces(name, slug),
      lists(
        id, title, position,
        cards(
          id, title, due_date, position, archived_at,
          tasks(id, done),
          card_assignees(user_id),
          card_labels(label_id)
        )
      ),
      labels(id, name, color)
    `
    )
    .eq(filterCol, id)
    .maybeSingle();

  type WorkspaceShort = { name: string; slug: string };
  type LabelShort = { id: string; name: string; color: string };
  type AssigneeShort = { user_id: string };
  type CardLabelShort = { label_id: string };
  type TaskShort = { id: string; done: boolean };
  type CardShort = {
    id: string;
    title: string;
    due_date: string | null;
    position: number;
    archived_at: string | null;
    tasks: TaskShort[] | null;
    card_assignees: AssigneeShort[] | null;
    card_labels: CardLabelShort[] | null;
  };
  type ListShort = {
    id: string;
    title: string;
    position: number;
    cards: CardShort[] | null;
  };
  type BoardShape = {
    id: string;
    slug: string;
    name: string;
    workspace_id: string;
    workspaces: WorkspaceShort | WorkspaceShort[] | null;
    lists: ListShort[] | null;
    labels: LabelShort[] | null;
  };

  const board = boardRow as BoardShape | null;
  if (!board) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (isUuid(id) && board.slug !== id) {
    redirect(`/boards/${board.slug}/tabelle`);
  }

  const workspace = Array.isArray(board.workspaces)
    ? board.workspaces[0]
    : board.workspaces;

  const labelById = new Map<string, LabelShort>();
  for (const l of board.labels ?? []) labelById.set(l.id, l);

  const userIds = Array.from(
    new Set(
      (board.lists ?? []).flatMap((l) =>
        (l.cards ?? []).flatMap((c) =>
          (c.card_assignees ?? []).map((a) => a.user_id)
        )
      )
    )
  );

  const profileByUid = new Map<string, { username: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', userIds);
    for (const p of (profiles ?? []) as Array<{
      id: string;
      username: string | null;
    }>) {
      profileByUid.set(p.id, { username: p.username });
    }
  }

  const rows: Row[] = (board.lists ?? [])
    .flatMap((l) =>
      (l.cards ?? [])
        .filter((c) => !c.archived_at)
        .map((c) => ({
          id: c.id,
          title: c.title,
          due_date: c.due_date,
          list_title: l.title,
          list_position: l.position,
          position: c.position,
          labels: (c.card_labels ?? [])
            .map((cl) => labelById.get(cl.label_id))
            .filter((x): x is LabelShort => Boolean(x))
            .map((x) => ({ name: x.name, color: x.color })),
          assignees: (c.card_assignees ?? [])
            .map((a) => profileByUid.get(a.user_id))
            .filter((x): x is { username: string | null } => Boolean(x)),
          taskTotal: (c.tasks ?? []).length,
          taskDone: (c.tasks ?? []).filter((t) => t.done).length,
        }))
    );

  const sortKey = sort ?? 'list';
  rows.sort((a, b) => {
    if (sortKey === 'due') {
      const da = a.due_date ?? '9999-12-31';
      const db = b.due_date ?? '9999-12-31';
      return da.localeCompare(db);
    }
    if (sortKey === 'title') {
      return a.title.localeCompare(b.title, 'de');
    }
    if (a.list_position !== b.list_position)
      return a.list_position - b.list_position;
    return a.position - b.position;
  });

  return (
    <>
      <div className="px-3 sm:px-6 py-3 border-b border-line/60 flex items-center justify-between gap-2 sm:gap-3 text-sm">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            href="/dashboard"
            className="text-muted hover:text-fg transition-colors hidden sm:inline"
          >
            Dashboard
          </Link>
          <span className="text-faint hidden sm:inline">/</span>
          <Link
            href={`/workspaces/${workspace?.slug ?? board.workspace_id}`}
            className="text-muted hover:text-fg transition-colors truncate"
          >
            {workspace?.name ?? ''}
          </Link>
          <span className="text-faint">/</span>
          <RenameBoardTitle
            id={board.id}
            name={board.name}
            viewClassName="text-fg font-medium truncate hover:text-accent-hover transition-colors text-left"
            inputClassName="text-fg font-medium bg-elev border border-muted rounded px-1 -mx-1 focus:outline-none focus:ring-1 focus:ring-accent-hover/60 min-w-0"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <MembersDialog boardId={board.id} />
          <BoardMenu
            boardId={board.id}
            boardName={board.name}
            workspaceId={board.workspace_id}
          />
        </div>
      </div>
      <BoardTabs boardSlug={board.slug} active="table" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-fg">
              Tabelle
            </h1>
            <p className="text-xs text-muted mt-1">
              {rows.length} aktive Karte{rows.length === 1 ? '' : 'n'} · klick eine
              Zeile, um die Karte zu öffnen.
            </p>
          </div>
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-subtle mr-1">sortiert nach</span>
            <SortLink current={sortKey} value="list" slug={board.slug}>
              Liste
            </SortLink>
            <SortLink current={sortKey} value="due" slug={board.slug}>
              Fällig
            </SortLink>
            <SortLink current={sortKey} value="title" slug={board.slug}>
              Titel
            </SortLink>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-line-strong p-10 text-center text-sm text-subtle">
            Noch keine Karten auf dem Board.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-elev text-[11px] uppercase tracking-wide text-subtle text-left">
                  <th className="px-3 py-2 font-medium">Titel</th>
                  <th className="px-3 py-2 font-medium">Liste</th>
                  <th className="px-3 py-2 font-medium">Fällig</th>
                  <th className="px-3 py-2 font-medium">Tasks</th>
                  <th className="px-3 py-2 font-medium">Labels</th>
                  <th className="px-3 py-2 font-medium">Zugewiesen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const due = formatDate(r.due_date);
                  return (
                    <tr
                      key={r.id}
                      className="border-t border-line hover:bg-elev/60 transition-colors"
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/boards/${board.slug}?card=${r.id}`}
                          className="text-fg hover:text-accent-hover"
                        >
                          {r.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-muted">{r.list_title}</td>
                      <td
                        className={`px-3 py-2 font-mono tabular-nums text-[12px] ${TONE_CLASSES[due.tone]}`}
                      >
                        {due.label}
                      </td>
                      <td className="px-3 py-2 text-muted font-mono tabular-nums text-[12px]">
                        {r.taskTotal === 0 ? '—' : `${r.taskDone}/${r.taskTotal}`}
                      </td>
                      <td className="px-3 py-2">
                        {r.labels.length === 0 ? (
                          <span className="text-faint">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {r.labels.map((l) => (
                              <span
                                key={l.name}
                                className={`inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-medium border ${labelPill(l.color)}`}
                              >
                                {l.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {r.assignees.length === 0 ? (
                          <span className="text-faint">—</span>
                        ) : (
                          <div className="flex -space-x-1.5">
                            {r.assignees.slice(0, 4).map((a, i) => (
                              <Avatar
                                key={i}
                                username={a.username}
                                size="xs"
                                className="ring-2 ring-surface"
                              />
                            ))}
                            {r.assignees.length > 4 && (
                              <span className="h-5 w-5 rounded-full bg-elev-hover grid place-items-center text-[9px] font-semibold text-fg-soft ring-2 ring-surface">
                                +{r.assignees.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}

function SortLink({
  current,
  value,
  slug,
  children,
}: {
  current: string;
  value: string;
  slug: string;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <Link
      href={`/boards/${slug}/tabelle?sort=${value}`}
      className={`px-2 py-1 rounded-md transition-colors ${
        active
          ? 'bg-elev text-fg'
          : 'text-fg-soft hover:bg-elev hover:text-fg'
      }`}
    >
      {children}
    </Link>
  );
}
