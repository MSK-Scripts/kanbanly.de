import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BoardClient } from '@/components/BoardClient';
import { InviteDialog } from '@/components/InviteDialog';
import { RenameBoardTitle } from '@/components/RenameTitle';
import { createClient } from '@/lib/supabase/server';

type BoardRow = {
  id: string;
  name: string;
  workspace_id: string;
  workspaces: { name: string } | { name: string }[] | null;
  lists: Array<{
    id: string;
    title: string;
    position: number;
    cards: Array<{
      id: string;
      list_id: string;
      title: string;
      description: string | null;
      position: number;
      tasks: Array<{
        id: string;
        card_id: string;
        title: string;
        done: boolean;
        position: number;
      }> | null;
      card_assignees: Array<{ user_id: string }> | null;
    }> | null;
  }> | null;
};

type MemberRow = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  role: string;
};

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data }, { data: membersData }] = await Promise.all([
    supabase
      .from('boards')
      .select(
        `
          id, name, workspace_id,
          workspaces(name),
          lists(
            id, title, position,
            cards(
              id, list_id, title, description, position,
              tasks(id, card_id, title, done, position),
              card_assignees(user_id)
            )
          )
        `
      )
      .eq('id', id)
      .single(),
    supabase.rpc('board_members_list', { b: id }),
  ]);

  const board = data as BoardRow | null;
  if (!board) notFound();

  const members = (membersData ?? []) as MemberRow[];

  const workspace = Array.isArray(board.workspaces)
    ? board.workspaces[0]
    : board.workspaces;

  const initialLists = (board.lists ?? []).map((l) => ({
    id: l.id,
    title: l.title,
    position: l.position,
  }));

  const initialCards = (board.lists ?? []).flatMap((l) =>
    (l.cards ?? []).map((c) => ({
      id: c.id,
      list_id: c.list_id,
      title: c.title,
      description: c.description,
      position: c.position,
    }))
  );

  const initialTasks = (board.lists ?? []).flatMap((l) =>
    (l.cards ?? []).flatMap((c) =>
      (c.tasks ?? []).map((t) => ({
        id: t.id,
        card_id: t.card_id,
        title: t.title,
        done: t.done,
        position: t.position,
      }))
    )
  );

  const initialAssignees = (board.lists ?? []).flatMap((l) =>
    (l.cards ?? []).flatMap((c) =>
      (c.card_assignees ?? []).map((a) => ({
        card_id: c.id,
        user_id: a.user_id,
      }))
    )
  );

  return (
    <>
      <div className="px-6 py-3 border-b border-slate-800/60 flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="text-slate-400 hover:text-slate-100 transition-colors"
          >
            Dashboard
          </Link>
          <span className="text-slate-600">/</span>
          <Link
            href={`/workspaces/${board.workspace_id}`}
            className="text-slate-400 hover:text-slate-100 transition-colors truncate"
          >
            {workspace?.name ?? ''}
          </Link>
          <span className="text-slate-600">/</span>
          <RenameBoardTitle
            id={board.id}
            name={board.name}
            viewClassName="text-slate-100 font-medium truncate hover:text-violet-200 transition-colors text-left"
            inputClassName="text-slate-100 font-medium bg-slate-800 border border-slate-600 rounded px-1 -mx-1 focus:outline-none focus:ring-1 focus:ring-violet-400/60 min-w-0"
          />
        </div>
        <InviteDialog boardId={board.id} />
      </div>
      <BoardClient
        boardId={board.id}
        initialLists={initialLists}
        initialCards={initialCards}
        initialTasks={initialTasks}
        initialAssignees={initialAssignees}
        initialMembers={members}
      />
    </>
  );
}
