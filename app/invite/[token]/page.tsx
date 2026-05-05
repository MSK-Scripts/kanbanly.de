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
          <h1 className="text-lg font-semibold text-fg">kanbanly</h1>
        </div>

        <div className="rounded-md bg-surface border border-line p-6">
          {!invitation ? (
            <>
              <h2 className="text-lg font-semibold text-fg mb-1">
                Einladung ungültig
              </h2>
              <p className="text-sm text-muted">
                Der Link ist abgelaufen oder existiert nicht.
              </p>
            </>
          ) : invitation.accepted_at ? (
            <>
              <h2 className="text-lg font-semibold text-fg mb-1">
                Bereits angenommen
              </h2>
              <p className="text-sm text-muted mb-4">
                Diese Einladung wurde schon verwendet.
              </p>
              <Link
                href="/dashboard"
                className="inline-block rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2"
              >
                Zum Dashboard
              </Link>
            </>
          ) : new Date(invitation.expires_at) < new Date() ? (
            <>
              <h2 className="text-lg font-semibold text-fg mb-1">
                Einladung abgelaufen
              </h2>
              <p className="text-sm text-muted">
                Frag die einladende Person nach einem neuen Link.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-fg mb-1">
                Einladung zu {invitation.board_name}
              </h2>
              <p className="text-sm text-muted mb-4">
                Workspace:{' '}
                <span className="text-fg-soft">
                  {invitation.workspace_name}
                </span>
                <br />
                Rolle:{' '}
                <span className="text-fg-soft">
                  {ROLE_LABELS[invitation.role] ?? invitation.role}
                </span>
                <br />
                Für:{' '}
                <span className="text-fg-soft">{invitation.email}</span>
              </p>

              {error && (
                <div className="mb-4 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs px-3 py-2">
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
                    className="block text-center rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-medium py-2 transition-colors"
                  >
                    Konto mit {invitation.email} anlegen
                  </Link>
                  <Link
                    href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
                    className="block text-center rounded-md bg-elev hover:bg-elev-hover text-fg-soft text-sm py-2 transition-colors"
                  >
                    Ich habe schon ein Konto — anmelden
                  </Link>
                </div>
              ) : user.email?.toLowerCase() !== invitation.email.toLowerCase() ? (
                <div className="space-y-2">
                  <p className="text-xs text-rose-800 dark:text-rose-200 rounded-md bg-rose-500/10 border border-rose-500/30 px-3 py-2">
                    Du bist als {user.email} angemeldet, aber die Einladung
                    ist für {invitation.email}.
                  </p>
                  <form action={switchAccountForInvite}>
                    <input type="hidden" name="token" value={token} />
                    <button
                      type="submit"
                      className="w-full rounded-md bg-elev hover:bg-elev-hover text-fg-soft text-sm py-2 transition-colors"
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
                    className="w-full rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-medium py-2 transition-colors"
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
