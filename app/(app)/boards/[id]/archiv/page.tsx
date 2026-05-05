import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { BoardMenu } from '@/components/BoardMenu';
import { BoardTabs } from '@/components/BoardTabs';
import { MembersDialog } from '@/components/MembersDialog';
import { RenameBoardTitle } from '@/components/RenameTitle';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/slug';
import { restoreCard, permanentlyDeleteCard } from '@/app/(app)/actions';

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
  return {
    title: name ? `${name} · Archiv · kanbanly` : 'Archiv · kanbanly',
  };
}

type ArchivedCard = {
  id: string;
  title: string;
  description: string | null;
  archived_at: string;
  list: { title: string } | null;
};

export default async function ArchivPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const filterCol = isUuid(id) ? 'id' : 'slug';
  const { data: boardRow } = await supabase
    .from('boards')
    .select(
      'id, slug, name, workspace_id, workspaces(name, slug)'
    )
    .eq(filterCol, id)
    .maybeSingle();

  type WorkspaceShort = { name: string; slug: string };
  type BoardRow = {
    id: string;
    slug: string;
    name: string;
    workspace_id: string;
    workspaces: WorkspaceShort | WorkspaceShort[] | null;
  };
  const board = boardRow as BoardRow | null;
  if (!board) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (isUuid(id) && board.slug !== id) {
    redirect(`/boards/${board.slug}/archiv`);
  }

  const workspace = Array.isArray(board.workspaces)
    ? board.workspaces[0]
    : board.workspaces;

  const { data: archivedRaw } = await supabase
    .from('cards')
    .select(
      'id, title, description, archived_at, list:lists!inner(title, board_id)'
    )
    .eq('lists.board_id', board.id)
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false });

  const archived = ((archivedRaw ?? []) as unknown as Array<{
    id: string;
    title: string;
    description: string | null;
    archived_at: string;
    list: { title: string } | { title: string }[] | null;
  }>).map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    archived_at: c.archived_at,
    list: Array.isArray(c.list) ? c.list[0] ?? null : c.list,
  })) as ArchivedCard[];

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
      <BoardTabs boardSlug={board.slug} active="archive" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-fg">Archiv</h1>
          <p className="text-xs text-muted mt-1">
            {archived.length === 0
              ? 'Keine archivierten Karten.'
              : `${archived.length} archivierte Karte${archived.length === 1 ? '' : 'n'}. Wiederherstellen oder endgültig löschen.`}
          </p>
        </div>

        {archived.length === 0 ? (
          <div className="rounded-md border border-dashed border-line-strong p-8 text-center text-sm text-subtle">
            Hier landen Karten, die du archivierst.
          </div>
        ) : (
          <ul className="rounded-md border border-line bg-surface overflow-hidden divide-y divide-line">
            {archived.map((c) => (
              <li
                key={c.id}
                className="px-3 py-2.5 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-fg leading-snug break-words">
                    {c.title}
                  </div>
                  <div className="text-[11px] text-subtle mt-0.5 truncate">
                    {c.list?.title ?? '—'}
                    <span className="mx-1 text-faint">·</span>
                    archiviert {formatRelative(c.archived_at)}
                  </div>
                </div>
                <form action={restoreCard.bind(null, c.id, board.slug)}>
                  <button
                    type="submit"
                    className="text-xs text-fg-soft hover:text-fg px-2 py-1 transition-colors"
                  >
                    Wiederherstellen
                  </button>
                </form>
                <form action={permanentlyDeleteCard.bind(null, c.id, board.slug)}>
                  <button
                    type="submit"
                    className="text-xs text-muted hover:text-rose-500 px-2 py-1 transition-colors"
                  >
                    Endgültig löschen
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso);
  const diffMin = Math.round((Date.now() - then.getTime()) / 60000);
  if (diffMin < 1) return 'gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `vor ${diffH} Std`;
  const diffD = Math.round(diffH / 24);
  return `vor ${diffD} Tag${diffD === 1 ? '' : 'en'}`;
}
