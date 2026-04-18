import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CalendarClient } from '@/components/CalendarClient';
import { BoardMenu } from '@/components/BoardMenu';
import { BoardTabs } from '@/components/BoardTabs';
import { InviteDialog } from '@/components/InviteDialog';
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
    title: name ? `${name} · Kalender · kanbanly` : 'Kalender · kanbanly',
  };
}

export default async function BoardCalendarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const data = await fetchBoardData(supabase, id);
  if (!data) notFound();

  const { board } = data;

  if (isUuid(id) && board.slug !== id) {
    redirect(`/boards/${board.slug}/kalender`);
  }

  return (
    <>
      <div className="px-3 sm:px-6 py-3 border-b border-slate-800/60 flex items-center justify-between gap-2 sm:gap-3 text-sm">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            href="/dashboard"
            className="text-slate-400 hover:text-slate-100 transition-colors hidden sm:inline"
          >
            Dashboard
          </Link>
          <span className="text-slate-600 hidden sm:inline">/</span>
          <Link
            href={`/workspaces/${board.workspace_slug ?? board.workspace_id}`}
            className="text-slate-400 hover:text-slate-100 transition-colors truncate"
          >
            {board.workspace_name ?? ''}
          </Link>
          <span className="text-slate-600">/</span>
          <RenameBoardTitle
            id={board.id}
            name={board.name}
            viewClassName="text-slate-100 font-medium truncate hover:text-violet-200 transition-colors text-left"
            inputClassName="text-slate-100 font-medium bg-slate-800 border border-slate-600 rounded px-1 -mx-1 focus:outline-none focus:ring-1 focus:ring-violet-400/60 min-w-0"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <InviteDialog boardId={board.id} />
          <BoardMenu
            boardId={board.id}
            boardName={board.name}
            workspaceId={board.workspace_id}
          />
        </div>
      </div>
      <BoardTabs boardSlug={board.slug} active="calendar" />
      <CalendarClient
        boardId={board.id}
        initialLists={data.initialLists}
        initialCards={data.initialCards}
        initialTasks={data.initialTasks}
        initialAssignees={data.initialAssignees}
        initialMembers={data.initialMembers}
        initialLabels={data.initialLabels}
        initialCardLabels={data.initialCardLabels}
      />
    </>
  );
}
