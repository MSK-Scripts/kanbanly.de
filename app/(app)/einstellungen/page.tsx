import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UsernameForm } from '@/components/UsernameForm';

export const metadata = {
  title: 'Einstellungen · kanbanly',
};

export default async function EinstellungenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, email')
    .eq('id', user.id)
    .maybeSingle();
  const p = (profile as {
    username: string | null;
    email: string | null;
  } | null) ?? null;

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-fg">Einstellungen</h1>
          <p className="text-sm text-muted mt-1">
            Profil und Account-Daten.
          </p>
        </div>

        <section className="mb-6">
          <h2 className="text-sm font-semibold text-fg mb-2">Profil</h2>
          <div className="rounded-md bg-surface border border-line p-5 space-y-4">
            <UsernameForm currentUsername={p?.username ?? null} />

            <div>
              <label className="block text-xs text-muted mb-1">E-Mail</label>
              <div className="text-sm text-fg-soft font-mono">
                {p?.email ?? user.email ?? '—'}
              </div>
              <p className="text-[11px] text-subtle mt-1">
                E-Mail-Änderung ist aktuell nicht über die UI möglich. Bei Bedarf
                über Supabase-Support.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
