import Link from 'next/link';
import { register } from '../actions';

type SearchParams = { error?: string; sent?: string };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { error, sent } = await searchParams;

  if (sent) {
    return (
      <div className="rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-6 shadow-xl shadow-black/20 text-center">
        <h2 className="text-xl font-semibold text-slate-100 mb-2">
          Bitte E-Mail bestätigen
        </h2>
        <p className="text-sm text-slate-400">
          Wir haben dir einen Bestätigungslink geschickt. Öffne ihn, um dein
          Konto zu aktivieren.
        </p>
        <Link
          href="/login"
          className="inline-block mt-5 text-violet-300 hover:text-violet-200 text-sm font-medium"
        >
          Zurück zum Login
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-6 shadow-xl shadow-black/20">
      <h2 className="text-xl font-semibold text-slate-100 mb-1">
        Konto erstellen
      </h2>
      <p className="text-sm text-slate-400 mb-5">
        Starte mit deinem ersten Board.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs px-3 py-2">
          {error}
        </div>
      )}

      <form action={register} className="space-y-3">
        <div>
          <label
            className="block text-xs text-slate-400 mb-1"
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
            pattern="[a-z0-9_-]{3,20}"
            autoComplete="username"
            placeholder="z. B. felix_f"
            className="w-full rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400/60 lowercase"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            3–20 Zeichen: a–z, 0–9, _ und -
          </p>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1" htmlFor="email">
            E-Mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400/60"
          />
        </div>
        <div>
          <label
            className="block text-xs text-slate-400 mb-1"
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
            className="w-full rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400/60"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Mindestens 8 Zeichen.
          </p>
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-violet-500/90 hover:bg-violet-400 text-white text-sm font-medium py-2 mt-2 transition-colors"
        >
          Registrieren
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-slate-400">
        Schon ein Konto?{' '}
        <Link
          href="/login"
          className="text-violet-300 hover:text-violet-200 font-medium"
        >
          Anmelden
        </Link>
      </p>
    </div>
  );
}
