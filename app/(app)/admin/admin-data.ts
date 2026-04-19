import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export type AdminStats = {
  totals: {
    users: number;
    workspaces: number;
    boards: number;
    lists: number;
    cards: number;
    comments: number;
    activities: number;
  };
  signups: {
    last24h: number;
    last7d: number;
    last30d: number;
    allTime: number;
  };
  boards: {
    last7d: number;
    last30d: number;
    allTime: number;
  };
  activeUsers7d: number;
  recentUsers: Array<{
    id: string;
    username: string | null;
    email: string | null;
    created_at: string;
  }>;
  recentBoards: Array<{
    id: string;
    name: string;
    slug: string;
    created_at: string;
    workspace_name: string | null;
    creator_username: string | null;
  }>;
  signupsPerDay: Array<{ day: string; count: number }>;
};

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function loadAdminStats(): Promise<AdminStats> {
  const admin = createAdminClient();

  const day1 = isoDaysAgo(1);
  const day7 = isoDaysAgo(7);
  const day30 = isoDaysAgo(30);

  const countExact = async (
    table: string,
    filter?: (q: ReturnType<ReturnType<typeof admin.from>['select']>) => ReturnType<ReturnType<typeof admin.from>['select']>
  ): Promise<number> => {
    let q = admin.from(table).select('*', { count: 'exact', head: true });
    if (filter) q = filter(q);
    const { count } = await q;
    return count ?? 0;
  };

  const [
    usersTotal,
    workspaces,
    boards,
    lists,
    cards,
    comments,
    activities,
    signups1d,
    signups7d,
    signups30d,
    boards7d,
    boards30d,
  ] = await Promise.all([
    countExact('profiles'),
    countExact('workspaces'),
    countExact('boards'),
    countExact('lists'),
    countExact('cards'),
    countExact('card_comments'),
    countExact('card_activity'),
    countExact('profiles', (q) => q.gte('created_at', day1)),
    countExact('profiles', (q) => q.gte('created_at', day7)),
    countExact('profiles', (q) => q.gte('created_at', day30)),
    countExact('boards', (q) => q.gte('created_at', day7)),
    countExact('boards', (q) => q.gte('created_at', day30)),
  ]);

  const { data: activeUsersData } = await admin
    .from('card_activity')
    .select('user_id')
    .gte('created_at', day7);
  const activeUsers7d = new Set(
    ((activeUsersData ?? []) as Array<{ user_id: string | null }>)
      .map((r) => r.user_id)
      .filter((x): x is string => !!x)
  ).size;

  const { data: rawRecentUsers } = await admin
    .from('profiles')
    .select('id, username, email, created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  const recentUsers = (rawRecentUsers ?? []) as AdminStats['recentUsers'];

  type RecentBoardRow = {
    id: string;
    name: string;
    slug: string;
    created_at: string;
    created_by: string | null;
    workspaces: { name: string | null } | { name: string | null }[] | null;
  };
  const { data: rawRecentBoards } = await admin
    .from('boards')
    .select('id, name, slug, created_at, created_by, workspaces(name)')
    .order('created_at', { ascending: false })
    .limit(20);
  const recentBoardsRaw = (rawRecentBoards ?? []) as RecentBoardRow[];

  const creatorIds = Array.from(
    new Set(
      recentBoardsRaw
        .map((b) => b.created_by)
        .filter((x): x is string => !!x)
    )
  );
  const creatorsMap = new Map<string, string | null>();
  if (creatorIds.length > 0) {
    const { data: creatorsData } = await admin
      .from('profiles')
      .select('id, username')
      .in('id', creatorIds);
    (creatorsData ?? []).forEach((c) => {
      const row = c as { id: string; username: string | null };
      creatorsMap.set(row.id, row.username);
    });
  }

  const recentBoards: AdminStats['recentBoards'] = recentBoardsRaw.map(
    (b) => {
      const ws = Array.isArray(b.workspaces) ? b.workspaces[0] : b.workspaces;
      return {
        id: b.id,
        name: b.name,
        slug: b.slug,
        created_at: b.created_at,
        workspace_name: ws?.name ?? null,
        creator_username: b.created_by ? creatorsMap.get(b.created_by) ?? null : null,
      };
    }
  );

  const { data: signupSeriesRaw } = await admin
    .from('profiles')
    .select('created_at')
    .gte('created_at', day30)
    .order('created_at', { ascending: true });
  const signupsPerDay = bucketByDay(
    ((signupSeriesRaw ?? []) as Array<{ created_at: string }>).map(
      (r) => r.created_at
    ),
    14
  );

  return {
    totals: {
      users: usersTotal,
      workspaces,
      boards,
      lists,
      cards,
      comments,
      activities,
    },
    signups: {
      last24h: signups1d,
      last7d: signups7d,
      last30d: signups30d,
      allTime: usersTotal,
    },
    boards: {
      last7d: boards7d,
      last30d: boards30d,
      allTime: boards,
    },
    activeUsers7d,
    recentUsers,
    recentBoards,
    signupsPerDay,
  };
}

function bucketByDay(
  isoDates: string[],
  days: number
): Array<{ day: string; count: number }> {
  const buckets = new Map<string, number>();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, 0);
  }
  for (const iso of isoDates) {
    const key = iso.slice(0, 10);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }
  return Array.from(buckets.entries()).map(([day, count]) => ({ day, count }));
}
