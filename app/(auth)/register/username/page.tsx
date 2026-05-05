import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { completeUsername } from '../../actions';

type SearchParams = { error?: string; next?: string };

export const metadata = { title: 'Benutzername wählen · kanbanly' };

function sanitizeSuggestion(raw: string | null | undefined): string {
  if (!raw) return '';
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
  if (cleaned.length < 3) return '';
  return cleaned;
}

export default async function ChooseUsernamePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { error, next } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();
  const hasUsername =
    !!(profile as { username?: string | null } | null)?.username;
  if (hasUsername) redirect(next ?? '/dashboard');

  const meta = user.user_metadata as Record<string, unknown>;
  const suggestions = [
    meta.user_name,
    meta.preferred_username,
    meta.name,
    meta.full_name,
    user.email?.split('@')[0],
  ]
    .map((x) => (typeof x === 'string' ? sanitizeSuggestion(x) : ''))
    .filter((x) => x.length >= 3);
  const suggestion = suggestions[0] ?? '';

  return (
    <div className="rounded-md bg-surface border border-line p-6 shadow-md">
      <h2 className="text-xl font-semibold text-fg mb-1">Noch ein Schritt</h2>
      <p className="text-sm text-muted mb-5">
        Such dir einen Benutzernamen aus. Andere sehen ihn bei deinen Karten
        und Kommentaren.
      </p>

      {error && (
        <div className="mb-4 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs px-3 py-2">
          {error}
        </div>
      )}

      <form action={completeUsername} className="space-y-3">
        <input type="hidden" name="next" value={next ?? '/dashboard'} />
        <div>
          <label
            className="block text-xs text-muted mb-1"
            htmlFor="username"
          >
            Benutzername
          </label>
          <input
            id="username"
            name="username"
            type="text"
            required
            minLength={3}
            maxLength={20}
            pattern="[a-zA-Z0-9_-]{3,20}"
            autoComplete="username"
            defaultValue={suggestion}
            autoFocus
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent-hover/60"
          />
          <p className="text-[11px] text-subtle mt-1">
            3–20 Zeichen: Buchstaben, Ziffern, _ und -.
          </p>
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-medium py-2 mt-2 transition-colors"
        >
          Weiter
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-muted">
        <Link
          href="/dashboard"
          className="hover:text-accent-soft"
        >
          Später
        </Link>
      </p>
    </div>
  );
}
