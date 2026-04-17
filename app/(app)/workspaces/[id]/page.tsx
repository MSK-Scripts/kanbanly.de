import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CreateBoardInline } from '@/components/CreateBoardInline';
import { RenameWorkspaceTitle } from '@/components/RenameTitle';
import { WorkspaceMenu } from '@/components/WorkspaceMenu';

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, boards(id, name, created_at)')
    .eq('id', id)
    .single();

  if (!workspace) notFound();

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/" className="hover:text-slate-200 transition-colors">
            Dashboard
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-slate-300">{workspace.name}</span>
        </div>

        <div className="mb-6 flex items-start justify-between gap-4">
          <RenameWorkspaceTitle
            id={workspace.id}
            name={workspace.name}
            viewClassName="text-2xl font-semibold text-slate-100 hover:text-violet-200 transition-colors text-left"
            inputClassName="text-2xl font-semibold text-slate-100 bg-slate-800 border border-slate-600 rounded px-2 -mx-2 focus:outline-none focus:ring-2 focus:ring-violet-400/60"
          />
          <WorkspaceMenu
            workspaceId={workspace.id}
            workspaceName={workspace.name}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(workspace.boards ?? []).map((b) => (
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
          <CreateBoardInline workspaceId={workspace.id} />
        </div>
      </div>
    </div>
  );
}
