import Link from 'next/link';
import { confirmEmail } from './actions';

type SearchParams = {
  code?: string;
  token_hash?: string;
  type?: string;
  next?: string;
};

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { code, token_hash, type, next } = await searchParams;

  const hasLegacy = token_hash && type;
  const hasPkce = !!code;

  if (!hasLegacy && !hasPkce) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-md bg-surface border border-line p-6 shadow-md text-center">
          <h1 className="text-xl font-semibold text-fg mb-2">
            Link unvollständig
          </h1>
          <p className="text-sm text-muted mb-5">
            Diesem Bestätigungslink fehlen Parameter. Öffne den Link aus
            deiner E-Mail erneut oder fordere einen neuen an.
          </p>
          <Link
            href="/login"
            className="inline-block text-accent-soft hover:text-accent-hover text-sm font-medium"
          >
            Zum Login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-md bg-surface border border-line p-6 shadow-md text-center">
        <h1 className="text-xl font-semibold text-fg mb-2">
          E-Mail bestätigen
        </h1>
        <p className="text-sm text-muted mb-6">
          Klick auf den Button, um dein Konto zu aktivieren.
        </p>

        <form action={confirmEmail}>
          {hasPkce && <input type="hidden" name="code" value={code} />}
          {hasLegacy && (
            <>
              <input type="hidden" name="token_hash" value={token_hash} />
              <input type="hidden" name="type" value={type} />
            </>
          )}
          {next && <input type="hidden" name="next" value={next} />}
          <button
            type="submit"
            className="w-full rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-medium py-2.5 transition-colors"
          >
            Jetzt bestätigen
          </button>
        </form>

        <p className="mt-5 text-[11px] text-subtle leading-relaxed">
          Der Link wird erst durch deinen Klick aktiviert. So verhindern wir,
          dass Spam-Scanner deines E-Mail-Anbieters den Token vorab verbrauchen.
        </p>
      </div>
    </main>
  );
}
