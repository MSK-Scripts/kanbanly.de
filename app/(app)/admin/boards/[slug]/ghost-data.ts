import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export type GhostBoard = {
  id: string;
  name: string;
  slug: string;
  workspace_name: string | null;
  creator_username: string | null;
  created_at: string;
};

export type GhostList = {
  id: string;
  title: string;
  position: number;
};

export type GhostLabel = {
  id: string;
  name: string;
  color: string;
};

export type GhostCard = {
  id: string;
  list_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  position: number;
  created_at: string;
  creator_username: string | null;
  tasks: Array<{ id: string; title: string; done: boolean; position: number }>;
  label_ids: string[];
  assignee_usernames: string[];
  comments: Array<{
    id: string;
    content: string;
    created_at: string;
    author_username: string | null;
  }>;
};

export type GhostActivity = {
  id: string;
  kind: string;
  meta: unknown;
  created_at: string;
  user_username: string | null;
  card_id: string;
};

export type GhostBoardData = {
  board: GhostBoard;
  lists: GhostList[];
  labels: GhostLabel[];
  cards: GhostCard[];
  activity: GhostActivity[];
};

export async function loadGhostBoard(
  slug: string
): Promise<GhostBoardData | null> {
  const admin = createAdminClient();

  const { data: boardRow } = await admin
    .from('boards')
    .select(
      'id, name, slug, created_at, created_by, workspaces(name)'
    )
    .eq('slug', slug)
    .maybeSingle();
  if (!boardRow) return null;

  const bRow = boardRow as {
    id: string;
    name: string;
    slug: string;
    created_at: string;
    created_by: string | null;
    workspaces: { name: string | null } | { name: string | null }[] | null;
  };

  let creator_username: string | null = null;
  if (bRow.created_by) {
    const { data } = await admin
      .from('profiles')
      .select('username')
      .eq('id', bRow.created_by)
      .maybeSingle();
    creator_username =
      (data as { username?: string | null } | null)?.username ?? null;
  }

  const ws = Array.isArray(bRow.workspaces)
    ? bRow.workspaces[0]
    : bRow.workspaces;
  const board: GhostBoard = {
    id: bRow.id,
    name: bRow.name,
    slug: bRow.slug,
    workspace_name: ws?.name ?? null,
    creator_username,
    created_at: bRow.created_at,
  };

  const [listsRes, cardsRes, labelsRes] = await Promise.all([
    admin
      .from('lists')
      .select('id, title, position')
      .eq('board_id', board.id)
      .order('position'),
    admin
      .from('cards')
      .select(
        'id, list_id, title, description, due_date, position, created_at, created_by, lists!inner(board_id)'
      )
      .eq('lists.board_id', board.id)
      .order('position'),
    admin
      .from('labels')
      .select('id, name, color')
      .eq('board_id', board.id),
  ]);

  const lists = ((listsRes.data ?? []) as GhostList[]).slice();
  const rawCards = (cardsRes.data ?? []) as Array<{
    id: string;
    list_id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    position: number;
    created_at: string;
    created_by: string | null;
  }>;
  const labels = (labelsRes.data ?? []) as GhostLabel[];

  const cardIds = rawCards.map((c) => c.id);

  let tasksByCard = new Map<string, GhostCard['tasks']>();
  let cardLabelsByCard = new Map<string, string[]>();
  let assigneesByCard = new Map<string, string[]>();
  let commentsByCard = new Map<string, GhostCard['comments']>();
  let creatorsByUserId = new Map<string, string | null>();

  if (cardIds.length > 0) {
    const [tasksRes, cardLabelsRes, assigneesRes, commentsRes] =
      await Promise.all([
        admin
          .from('tasks')
          .select('id, card_id, title, done, position')
          .in('card_id', cardIds)
          .order('position'),
        admin.from('card_labels').select('card_id, label_id').in('card_id', cardIds),
        admin
          .from('card_assignees')
          .select('card_id, user_id')
          .in('card_id', cardIds),
        admin
          .from('card_comments')
          .select('id, card_id, user_id, content, created_at')
          .in('card_id', cardIds)
          .order('created_at'),
      ]);

    const tasks = (tasksRes.data ?? []) as Array<{
      id: string;
      card_id: string;
      title: string;
      done: boolean;
      position: number;
    }>;
    tasks.forEach((t) => {
      const arr = tasksByCard.get(t.card_id) ?? [];
      arr.push({
        id: t.id,
        title: t.title,
        done: t.done,
        position: t.position,
      });
      tasksByCard.set(t.card_id, arr);
    });

    const cardLabelsRows = (cardLabelsRes.data ?? []) as Array<{
      card_id: string;
      label_id: string;
    }>;
    cardLabelsRows.forEach((r) => {
      const arr = cardLabelsByCard.get(r.card_id) ?? [];
      arr.push(r.label_id);
      cardLabelsByCard.set(r.card_id, arr);
    });

    const assigneesRows = (assigneesRes.data ?? []) as Array<{
      card_id: string;
      user_id: string;
    }>;
    const userIds = Array.from(
      new Set([
        ...assigneesRows.map((a) => a.user_id),
        ...((commentsRes.data ?? []) as Array<{ user_id: string | null }>)
          .map((c) => c.user_id)
          .filter((x): x is string => !!x),
        ...rawCards.map((c) => c.created_by).filter((x): x is string => !!x),
      ])
    );

    if (userIds.length > 0) {
      const { data: profilesData } = await admin
        .from('profiles')
        .select('id, username')
        .in('id', userIds);
      ((profilesData ?? []) as Array<{ id: string; username: string | null }>).forEach(
        (p) => creatorsByUserId.set(p.id, p.username)
      );
    }

    assigneesRows.forEach((a) => {
      const arr = assigneesByCard.get(a.card_id) ?? [];
      const name = creatorsByUserId.get(a.user_id) ?? null;
      arr.push(name ?? 'unbekannt');
      assigneesByCard.set(a.card_id, arr);
    });

    const commentsRows = (commentsRes.data ?? []) as Array<{
      id: string;
      card_id: string;
      user_id: string | null;
      content: string;
      created_at: string;
    }>;
    commentsRows.forEach((c) => {
      const arr = commentsByCard.get(c.card_id) ?? [];
      arr.push({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        author_username: c.user_id
          ? creatorsByUserId.get(c.user_id) ?? null
          : null,
      });
      commentsByCard.set(c.card_id, arr);
    });
  }

  const cards: GhostCard[] = rawCards.map((c) => ({
    id: c.id,
    list_id: c.list_id,
    title: c.title,
    description: c.description,
    due_date: c.due_date,
    position: c.position,
    created_at: c.created_at,
    creator_username: c.created_by
      ? creatorsByUserId.get(c.created_by) ?? null
      : null,
    tasks: tasksByCard.get(c.id) ?? [],
    label_ids: cardLabelsByCard.get(c.id) ?? [],
    assignee_usernames: assigneesByCard.get(c.id) ?? [],
    comments: commentsByCard.get(c.id) ?? [],
  }));

  const { data: actRaw } = await admin
    .from('card_activity')
    .select('id, card_id, user_id, kind, meta, created_at, cards!inner(list_id, lists!inner(board_id))')
    .eq('cards.lists.board_id', board.id)
    .order('created_at', { ascending: false })
    .limit(50);

  const actRows = (actRaw ?? []) as Array<{
    id: string;
    card_id: string;
    user_id: string | null;
    kind: string;
    meta: unknown;
    created_at: string;
  }>;
  const missingUserIds = actRows
    .map((a) => a.user_id)
    .filter((x): x is string => !!x && !creatorsByUserId.has(x));
  if (missingUserIds.length > 0) {
    const { data: extraProfiles } = await admin
      .from('profiles')
      .select('id, username')
      .in('id', Array.from(new Set(missingUserIds)));
    ((extraProfiles ?? []) as Array<{ id: string; username: string | null }>).forEach(
      (p) => creatorsByUserId.set(p.id, p.username)
    );
  }

  const activity: GhostActivity[] = actRows.map((a) => ({
    id: a.id,
    kind: a.kind,
    meta: a.meta,
    created_at: a.created_at,
    user_username: a.user_id
      ? creatorsByUserId.get(a.user_id) ?? null
      : null,
    card_id: a.card_id,
  }));

  return { board, lists, labels, cards, activity };
}
