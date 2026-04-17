import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { acceptInvite, switchAccountForInvite } from '@/app/(app)/invite-actions';
import { LegalFooter } from '@/components/LegalFooter';

type SearchParams = { error?: string };

const ROLE_LABELS: Record<string, string> = {
  viewer: 'Viewer (nur lesen)',
  editor: 'Editor (bearbeiten)',
  admin: 'Admin (voller Zugriff)',
};

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: rows } = await supabase.rpc('get_invitation_by_token', {
    t: token,
  });
  const invitation = Array.isArray(rows) ? rows[0] : rows;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold text-slate-100">kanbanly</h1>
        </div>

        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-6">
          {!invitation ? (
            <>
              <h2 className="text-lg font-semibold text-slate-100 mb-1">
                Einladung ungültig
              </h2>
              <p className="text-sm text-slate-400">
                Der Link ist abgelaufen oder existiert nicht.
              </p>
            </>
          ) : invitation.accepted_at ? (
            <>
              <h2 className="text-lg font-semibold text-slate-100 mb-1">
                Bereits angenommen
              </h2>
              <p className="text-sm text-slate-400 mb-4">
                Diese Einladung wurde schon verwendet.
              </p>
              <Link
                href="/"
                className="inline-block rounded-lg bg-violet-500/90 hover:bg-violet-400 text-white text-sm font-medium px-4 py-2"
              >
                Zum Dashboard
              </Link>
            </>
          ) : new Date(invitation.expires_at) < new Date() ? (
            <>
              <h2 className="text-lg font-semibold text-slate-100 mb-1">
                Einladung abgelaufen
              </h2>
              <p className="text-sm text-slate-400">
                Frag die einladende Person nach einem neuen Link.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-slate-100 mb-1">
                Einladung zu {invitation.board_name}
              </h2>
              <p className="text-sm text-slate-400 mb-4">
                Workspace:{' '}
                <span className="text-slate-300">
                  {invitation.workspace_name}
                </span>
                <br />
                Rolle:{' '}
                <span className="text-slate-300">
                  {ROLE_LABELS[invitation.role] ?? invitation.role}
                </span>
                <br />
                Für:{' '}
                <span className="text-slate-300">{invitation.email}</span>
              </p>

              {error && (
                <div className="mb-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs px-3 py-2">
                  {error === 'email_mismatch'
                    ? `Diese Einladung ist für ${invitation.email}. Du bist aber als ${user?.email ?? 'jemand anderes'} angemeldet.`
                    : error === 'not_authenticated'
                    ? 'Bitte zuerst anmelden.'
                    : error === 'invitation_invalid_or_expired'
                    ? 'Einladung ungültig oder abgelaufen.'
                    : error}
                </div>
              )}

              {!user ? (
                <div className="space-y-2">
                  <Link
                    href={`/register?next=${encodeURIComponent(`/invite/${token}`)}`}
                    className="block text-center rounded-lg bg-violet-500/90 hover:bg-violet-400 text-white text-sm font-medium py-2 transition-colors"
                  >
                    Konto mit {invitation.email} anlegen
                  </Link>
                  <Link
                    href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
                    className="block text-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm py-2 transition-colors"
                  >
                    Ich habe schon ein Konto — anmelden
                  </Link>
                </div>
              ) : user.email?.toLowerCase() !== invitation.email.toLowerCase() ? (
                <div className="space-y-2">
                  <p className="text-xs text-rose-200 rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-2">
                    Du bist als {user.email} angemeldet, aber die Einladung
                    ist für {invitation.email}.
                  </p>
                  <form action={switchAccountForInvite}>
                    <input type="hidden" name="token" value={token} />
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm py-2 transition-colors"
                    >
                      Abmelden & mit richtiger E-Mail neu anmelden
                    </button>
                  </form>
                </div>
              ) : (
                <form action={acceptInvite}>
                  <input type="hidden" name="token" value={token} />
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-violet-500/90 hover:bg-violet-400 text-white text-sm font-medium py-2 transition-colors"
                  >
                    Einladung annehmen
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
      </div>
      <LegalFooter />
    </div>
  );
}
