import Link from 'next/link';
import { resetPassword } from '../actions';

type SearchParams = { error?: string; email?: string };

export const metadata = {
  title: 'Passwort zurücksetzen · kanbanly',
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { error, email } = await searchParams;

  return (
    <div className="rounded-md bg-surface border border-line p-6 shadow-md">
      <h2 className="text-xl font-semibold text-fg mb-1">
        Passwort zurücksetzen
      </h2>
      <p className="text-sm text-muted mb-5">
        Nutze einen deiner Recovery-Codes, um ein neues Passwort zu setzen.
        Jeder Code kann nur einmal verwendet werden.
      </p>

      {error && (
        <div className="mb-4 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs px-3 py-2">
          {error}
        </div>
      )}

      <form action={resetPassword} className="space-y-3">
        <div>
          <label className="block text-xs text-muted mb-1" htmlFor="email">
            E-Mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={email ?? ''}
            autoComplete="email"
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent-hover/60"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1" htmlFor="code">
            Recovery-Code
          </label>
          <input
            id="code"
            name="code"
            type="text"
            required
            placeholder="XXXXX-XXXXX"
            autoComplete="one-time-code"
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle font-mono tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-accent-hover/60"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1" htmlFor="password">
            Neues Passwort
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent-hover/60"
          />
          <p className="text-[11px] text-subtle mt-1">
            Mindestens 8 Zeichen.
          </p>
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-medium py-2 mt-2 transition-colors"
        >
          Passwort setzen
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-muted">
        Doch nicht?{' '}
        <Link
          href="/login"
          className="text-accent-soft hover:text-accent-hover font-medium"
        >
          Zurück zum Login
        </Link>
      </p>
    </div>
  );
}
