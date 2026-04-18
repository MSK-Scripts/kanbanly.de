import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { BoardClient } from '@/components/BoardClient';
import { BoardMenu } from '@/components/BoardMenu';
import { BoardTabs } from '@/components/BoardTabs';
import { BoardFilterBar } from '@/components/BoardFilterBar';
import { GroupByToggle } from '@/components/GroupByToggle';
import { MembersDialog } from '@/components/MembersDialog';
import { PresenceAvatars } from '@/components/PresenceAvatars';
import { RenameBoardTitle } from '@/components/RenameTitle';
import { createClient } from '@/lib/supabase/server';
import { fetchBoardData } from '@/lib/boardData';
import { isUuid } from '@/lib/slug';

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
    title: name ? `${name} · kanbanly` : 'Board · kanbanly',
  };
}

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const data = await fetchBoardData(supabase, id);
  if (!data) notFound();

  const { board } = data;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();
  const currentUsername = (profile as { username?: string | null } | null)?.username ?? null;

  if (isUuid(id) && board.slug !== id) {
    redirect(`/boards/${board.slug}`);
  }

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
            href={`/workspaces/${board.workspace_slug ?? board.workspace_id}`}
            className="text-muted hover:text-fg transition-colors truncate"
          >
            {board.workspace_name ?? ''}
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
          <PresenceAvatars selfUserId={user.id} />
          <GroupByToggle />
          <BoardFilterBar />
          <MembersDialog boardId={board.id} />
          <BoardMenu
            boardId={board.id}
            boardName={board.name}
            workspaceId={board.workspace_id}
          />
        </div>
      </div>
      <BoardTabs boardSlug={board.slug} active="board" />
      <BoardClient
        boardId={board.id}
        initialLists={data.initialLists}
        initialCards={data.initialCards}
        initialTasks={data.initialTasks}
        initialAssignees={data.initialAssignees}
        initialMembers={data.initialMembers}
        initialLabels={data.initialLabels}
        initialCardLabels={data.initialCardLabels}
        currentUserId={user.id}
        currentUsername={currentUsername}
      />
    </>
  );
}
