import Link from 'next/link';
import { login } from '../actions';
import { OAuthButtons } from '@/components/OAuthButtons';

type SearchParams = { error?: string; next?: string };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="rounded-2xl bg-surface/60 backdrop-blur-md border border-line/80 p-6 shadow-xl shadow-black/20">
      <h2 className="text-xl font-semibold text-fg mb-1">Anmelden</h2>
      <p className="text-sm text-muted mb-5">
        Willkommen zurück bei kanbanly.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs px-3 py-2">
          {error}
        </div>
      )}

      <form action={login} className="space-y-3">
        {next && <input type="hidden" name="next" value={next} />}
        <div>
          <label className="block text-xs text-muted mb-1" htmlFor="email">
            E-Mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-lg bg-elev/80 border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent-hover/60"
          />
        </div>
        <div>
          <label
            className="block text-xs text-muted mb-1"
            htmlFor="password"
          >
            Passwort
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded-lg bg-elev/80 border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent-hover/60"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-accent/90 hover:bg-accent-hover text-white text-sm font-medium py-2 mt-2 transition-colors"
        >
          Anmelden
        </button>
      </form>

      <OAuthButtons />

      <div className="mt-4 text-center">
        <Link
          href="/reset-password"
          className="text-xs text-muted hover:text-accent-soft"
        >
          Passwort vergessen?
        </Link>
      </div>

      <p className="mt-5 text-center text-xs text-muted">
        Noch kein Konto?{' '}
        <Link
          href="/register"
          className="text-accent-soft hover:text-accent-hover font-medium"
        >
          Registrieren
        </Link>
      </p>
    </div>
  );
}
