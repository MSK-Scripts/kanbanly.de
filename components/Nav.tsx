import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { logout } from '@/app/(auth)/actions';
import { HelpMenu } from './HelpMenu';
import { SearchButton } from './SearchButton';
import { NotificationsBell } from './NotificationsBell';

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
    <header className="px-6 py-3 border-b border-line/60 flex items-center justify-between">
      <Link href="/dashboard" className="flex flex-col group">
        <h1 className="text-base font-semibold text-fg tracking-tight leading-none group-hover:text-accent-hover transition-colors">
          kanbanly
        </h1>
        <p className="text-[11px] text-subtle mt-0.5">
          Flow first. Build fast.
        </p>
      </Link>

      <div className="flex items-center gap-3">
        {user && (
          <>
            <SearchButton />
            <Link
              href="/meine-karten"
              className="text-xs text-fg-soft hover:text-fg transition-colors hidden sm:inline"
            >
              Meine Karten
            </Link>
            <span className="text-xs text-muted hidden sm:inline">
              {displayName}
            </span>
            <NotificationsBell />
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-line-strong hover:border-fg-soft bg-elev hover:bg-elev text-fg-soft hover:text-fg text-xs px-3 py-1.5 transition-colors"
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
