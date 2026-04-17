import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { logout } from '@/app/(auth)/actions';
import { HelpMenu } from './HelpMenu';

export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let username: string | null = null;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();
    username = data?.username ?? null;
  }
  const displayName = username ? `@${username}` : user?.email ?? '';

  return (
    <header className="px-6 py-3 border-b border-slate-800/60 backdrop-blur-sm flex items-center justify-between">
      <Link href="/" className="flex flex-col group">
        <h1 className="text-base font-semibold text-slate-100 tracking-tight leading-none group-hover:text-violet-200 transition-colors">
          kanbanly
        </h1>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Flow first. Build fast.
        </p>
      </Link>

      <div className="flex items-center gap-3">
        {user && (
          <>
            <span className="text-xs text-slate-400 hidden sm:inline">
              {displayName}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg border border-slate-700 hover:border-slate-500 bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-slate-100 text-xs px-3 py-1.5 transition-colors"
              >
                Abmelden
              </button>
            </form>
          </>
        )}
        <HelpMenu />
      </div>
    </header>
  );
}
