import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { CreateWorkspaceInline } from '@/components/CreateWorkspaceInline';
import { CreateBoardInline } from '@/components/CreateBoardInline';

export const metadata = {
  title: 'Dashboard · kanbanly',
};

type SearchParams = { error?: string };

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let username: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();
    username = profile?.username ?? null;
  }

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, slug, name, boards(id, slug, name, created_at)')
    .order('created_at', { ascending: true });

  const myWorkspaceIds = (workspaces ?? []).map((w) => w.id);

  type GuestRow = {
    role: string;
    boards: {
      id: string;
      slug: string;
      name: string;
      workspace_id: string;
      workspaces: { name: string | null; slug: string | null } | { name: string | null; slug: string | null }[] | null;
    } | null;
  };

  const { data: guestRaw } = user
    ? await supabase
        .from('board_members')
        .select(
          'role, boards(id, slug, name, workspace_id, workspaces(name, slug))'
        )
        .eq('user_id', user.id)
    : { data: null };

  const guestBoards = ((guestRaw ?? []) as unknown as GuestRow[])
    .map((g) => {
      if (!g.boards) return null;
      if (myWorkspaceIds.includes(g.boards.workspace_id)) return null;
      const ws = Array.isArray(g.boards.workspaces)
        ? g.boards.workspaces[0] ?? null
        : g.boards.workspaces;
      return {
        id: g.boards.id,
        slug: g.boards.slug,
        name: g.boards.name,
        role: g.role,
        workspace_name: ws?.name ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const totalBoards = (workspaces ?? []).reduce(
    (sum, w) => sum + (w.boards?.length ?? 0),
    0
  );
  const hasContent =
    (workspaces && workspaces.length > 0) || guestBoards.length > 0;

  return (
    <div className="flex-1 flex min-h-0">
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-line bg-surface">
        <nav className="flex-1 overflow-y-auto p-3 text-sm">
          <div className="space-y-0.5">
            <SideLink href="/dashboard" active>
              Übersicht
            </SideLink>
            <SideLink href="/meine-karten">Meine Karten</SideLink>
            <SideLink href="/woche">Diese Woche</SideLink>
            <SideLink href="/stats">Statistiken</SideLink>
            <SideLink href="/templates">Vorlagen</SideLink>
            <SideLink href="/einstellungen">Einstellungen</SideLink>
          </div>

          {(workspaces?.length ?? 0) > 0 && (
            <div className="mt-5">
              <div className="px-2 mb-1 text-[11px] font-medium text-subtle">
                Workspaces
              </div>
              <div className="space-y-0.5">
                {(workspaces ?? []).map((ws) => (
                  <SideLink key={ws.id} href={`/workspaces/${ws.slug}`}>
                    <span className="truncate flex-1">{ws.name}</span>
                    <span className="text-[10px] text-subtle tabular-nums shrink-0 ml-2">
                      {ws.boards?.length ?? 0}
                    </span>
                  </SideLink>
                ))}
              </div>
            </div>
          )}

          {guestBoards.length > 0 && (
            <div className="mt-5">
              <div className="px-2 mb-1 text-[11px] font-medium text-subtle">
                Geteilt mit mir
              </div>
              <div className="space-y-0.5">
                {guestBoards.map((b) => (
                  <SideLink key={b.id} href={`/boards/${b.slug}`}>
                    <span className="truncate">{b.name}</span>
                  </SideLink>
                ))}
              </div>
            </div>
          )}
        </nav>
        <div className="p-3 border-t border-line">
          <CreateWorkspaceInline />
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl font-semibold text-fg">
                Willkommen{username ? `, @${username}` : ''}
              </h1>
              <p className="text-xs text-muted mt-0.5">
                {totalBoards} Board{totalBoards === 1 ? '' : 's'} in{' '}
                {workspaces?.length ?? 0} Workspace
                {(workspaces?.length ?? 0) === 1 ? '' : 's'}
                {guestBoards.length > 0
                  ? ` · ${guestBoards.length} geteilt`
                  : ''}
              </p>
            </div>
            <div className="md:hidden">
              <CreateWorkspaceInline />
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs px-3 py-2">
              {error}
            </div>
          )}

          {!hasContent ? (
            <div className="rounded-md bg-surface border border-line p-10 text-center">
              <h2 className="text-base font-semibold text-fg mb-1">
                Keine Workspaces
              </h2>
              <p className="text-sm text-muted mb-5">
                Leg deinen ersten Workspace an, um mit Boards zu starten.
              </p>
              <div className="inline-flex">
                <CreateWorkspaceInline />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {guestBoards.length > 0 && (
                <section>
                  <div className="flex items-baseline justify-between mb-2">
                    <h2 className="text-sm font-semibold text-fg">
                      Geteilt mit mir
                    </h2>
                    <span className="text-[11px] text-subtle">
                      {guestBoards.length} Board
                      {guestBoards.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <ul className="rounded-md border border-line bg-surface overflow-hidden divide-y divide-line">
                    {guestBoards.map((b) => (
                      <li key={b.id}>
                        <Link
                          href={`/boards/${b.slug}`}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-elev transition-colors"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-muted shrink-0" />
                          <span className="text-sm text-fg flex-1 truncate">
                            {b.name}
                          </span>
                          <span className="text-[11px] text-subtle">
                            {b.workspace_name ?? '—'}
                          </span>
                          <span className="text-[10px] text-subtle uppercase tracking-wide">
                            {b.role}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {(workspaces ?? []).map((ws) => (
                <section key={ws.id}>
                  <div className="flex items-baseline justify-between mb-2">
                    <Link
                      href={`/workspaces/${ws.slug}`}
                      className="text-sm font-semibold text-fg hover:text-accent-hover transition-colors"
                    >
                      {ws.name}
                    </Link>
                    <span className="text-[11px] text-subtle">
                      {ws.boards?.length ?? 0} Board
                      {(ws.boards?.length ?? 0) === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {(ws.boards ?? []).map((b) => (
                      <Link
                        key={b.id}
                        href={`/boards/${b.slug}`}
                        className="rounded-md bg-surface border border-line px-3 py-2.5 hover:border-line-strong hover:bg-elev transition-colors flex items-center gap-2 min-h-[44px]"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                        <span className="text-sm text-fg flex-1 truncate">
                          {b.name}
                        </span>
                      </Link>
                    ))}
                    <CreateBoardInline
                      workspaceId={ws.id}
                      workspaceName={ws.name}
                    />
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SideLink({
  href,
  children,
  active,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
        active
          ? 'bg-elev text-fg font-medium'
          : 'text-fg-soft hover:bg-elev hover:text-fg'
      }`}
    >
      {children}
    </Link>
  );
}
