import type { SupabaseClient } from '@supabase/supabase-js';
import type { MemberProfile } from '@/store/boardStore';
import { isUuid } from '@/lib/slug';

type BoardRow = {
  id: string;
  slug: string;
  name: string;
  workspace_id: string;
  background_url: string | null;
  workspaces: { name: string; slug: string } | { name: string; slug: string }[] | null;
  lists: Array<{
    id: string;
    title: string;
    position: number;
    wip_limit: number | null;
    cards: Array<{
      id: string;
      list_id: string;
      title: string;
      description: string | null;
      due_date: string | null;
      position: number;
      archived_at: string | null;
      tasks: Array<{
        id: string;
        card_id: string;
        title: string;
        done: boolean;
        position: number;
      }> | null;
      card_assignees: Array<{ user_id: string }> | null;
      card_labels: Array<{ label_id: string }> | null;
    }> | null;
  }> | null;
  labels: Array<{
    id: string;
    name: string;
    color: string;
    created_at: string;
  }> | null;
};

type MemberRow = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  role: string;
};

export type BoardData = {
  board: {
    id: string;
    slug: string;
    name: string;
    workspace_id: string;
    workspace_name: string | null;
    workspace_slug: string | null;
    background_url: string | null;
  };
  initialLists: Array<{
    id: string;
    title: string;
    position: number;
    wip_limit: number | null;
  }>;
  initialCards: Array<{
    id: string;
    list_id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    position: number;
  }>;
  initialTasks: Array<{
    id: string;
    card_id: string;
    title: string;
    done: boolean;
    position: number;
  }>;
  initialAssignees: Array<{ card_id: string; user_id: string }>;
  initialMembers: MemberProfile[];
  initialLabels: Array<{
    id: string;
    name: string;
    color: string;
    created_at: string;
  }>;
  initialCardLabels: Array<{ card_id: string; label_id: string }>;
};

const BOARD_QUERY = `
  id, slug, name, workspace_id, background_url,
  workspaces(name, slug),
  lists(
    id, title, position, wip_limit,
    cards(
      id, list_id, title, description, due_date, position, archived_at,
      tasks(id, card_id, title, done, position),
      card_assignees(user_id),
      card_labels(label_id)
    )
  ),
  labels(id, name, color, created_at)
`;

export async function fetchBoardData(
  supabase: SupabaseClient,
  idOrSlug: string
): Promise<BoardData | null> {
  const filterCol = isUuid(idOrSlug) ? 'id' : 'slug';
  const { data } = await supabase
    .from('boards')
    .select(BOARD_QUERY)
    .eq(filterCol, idOrSlug)
    .maybeSingle();

  const board = data as BoardRow | null;
  if (!board) return null;

  const { data: membersData } = await supabase.rpc('board_members_list', {
    b: board.id,
  });

  const members = (membersData ?? []) as MemberRow[];

  const workspace = Array.isArray(board.workspaces)
    ? board.workspaces[0]
    : board.workspaces;

  const initialLists = (board.lists ?? []).map((l) => ({
    id: l.id,
    title: l.title,
    position: l.position,
    wip_limit: l.wip_limit,
  }));

  const activeCards = (board.lists ?? []).flatMap((l) =>
    (l.cards ?? []).filter((c) => !c.archived_at)
  );

  const initialCards = activeCards.map((c) => ({
    id: c.id,
    list_id: c.list_id,
    title: c.title,
    description: c.description,
    due_date: c.due_date,
    position: c.position,
  }));

  const initialTasks = activeCards.flatMap((c) =>
    (c.tasks ?? []).map((t) => ({
      id: t.id,
      card_id: t.card_id,
      title: t.title,
      done: t.done,
      position: t.position,
    }))
  );

  const initialAssignees = activeCards.flatMap((c) =>
    (c.card_assignees ?? []).map((a) => ({
      card_id: c.id,
      user_id: a.user_id,
    }))
  );

  const initialLabels = board.labels ?? [];

  const initialCardLabels = activeCards.flatMap((c) =>
    (c.card_labels ?? []).map((cl) => ({
      card_id: c.id,
      label_id: cl.label_id,
    }))
  );

  return {
    board: {
      id: board.id,
      slug: board.slug,
      name: board.name,
      workspace_id: board.workspace_id,
      workspace_name: workspace?.name ?? null,
      workspace_slug: workspace?.slug ?? null,
      background_url: board.background_url,
    },
    initialLists,
    initialCards,
    initialTasks,
    initialAssignees,
    initialMembers: members,
    initialLabels,
    initialCardLabels,
  };
}
