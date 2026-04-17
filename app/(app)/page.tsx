import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { CreateWorkspaceInline } from '@/components/CreateWorkspaceInline';
import { CreateBoardInline } from '@/components/CreateBoardInline';

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
    .select('id, name, boards(id, name, created_at)')
    .order('created_at', { ascending: true });

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">Dashboard</h1>
            <p className="text-sm text-slate-400 mt-1">
              Willkommen{username ? ` @${username}` : ''}
            </p>
          </div>
          <CreateWorkspaceInline />
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs px-3 py-2">
            {error}
          </div>
        )}

        {!workspaces || workspaces.length === 0 ? (
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-10 text-center">
            <h2 className="text-lg font-semibold text-slate-100 mb-1">
              Keine Workspaces
            </h2>
            <p className="text-sm text-slate-400 mb-5">
              Leg deinen ersten Workspace an, um mit Boards zu starten.
            </p>
            <div className="inline-flex">
              <CreateWorkspaceInline />
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {workspaces.map((ws) => (
              <section key={ws.id}>
                <div className="flex items-center justify-between mb-3">
                  <Link
                    href={`/workspaces/${ws.id}`}
                    className="text-sm font-semibold text-slate-100 tracking-wide uppercase hover:text-violet-200 transition-colors"
                  >
                    {ws.name}
                  </Link>
                  <span className="text-[11px] text-slate-500">
                    {ws.boards?.length ?? 0} Boards
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(ws.boards ?? []).map((b) => (
                    <Link
                      key={b.id}
                      href={`/boards/${b.id}`}
                      className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-4 hover:border-violet-400/60 hover:bg-slate-900/80 transition-colors min-h-[84px] flex items-center"
                    >
                      <div className="font-medium text-slate-100 text-sm leading-snug break-words">
                        {b.name}
                      </div>
                    </Link>
                  ))}
                  <CreateBoardInline workspaceId={ws.id} />
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
