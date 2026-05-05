import Link from 'next/link';
import { register } from '../actions';
import { OAuthButtons } from '@/components/OAuthButtons';

type SearchParams = { error?: string };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { error } = await searchParams;

  return (
    <div className="rounded-md bg-surface border border-line p-6 shadow-md">
      <h2 className="text-xl font-semibold text-fg mb-1">
        Konto erstellen
      </h2>
      <p className="text-sm text-muted mb-5">
        Starte mit deinem ersten Board. Kein E-Mail-Versand nötig — du kriegst
        Recovery-Codes zum Ausdrucken.
      </p>

      {error && (
        <div className="mb-4 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs px-3 py-2">
          {error}
        </div>
      )}

      <form action={register} className="space-y-3">
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
            placeholder="z. B. Felix_F"
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent-hover/60"
          />
          <p className="text-[11px] text-subtle mt-1">
            3–20 Zeichen: Buchstaben, Ziffern, _ und - (Groß-/Kleinschreibung egal für Uniqueness)
          </p>
        </div>
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
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-2 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent-hover/60"
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
          Registrieren
        </button>
      </form>

      <OAuthButtons />

      <p className="mt-5 text-center text-xs text-muted">
        Schon ein Konto?{' '}
        <Link
          href="/login"
          className="text-accent-soft hover:text-accent-hover font-medium"
        >
          Anmelden
        </Link>
      </p>
    </div>
  );
}
