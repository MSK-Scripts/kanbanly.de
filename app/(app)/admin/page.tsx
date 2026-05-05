import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadAdminStats } from './admin-data';

export const metadata = {
  title: 'Admin · kanbanly',
};

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  const isAdmin =
    !!(profile as { is_admin?: boolean } | null)?.is_admin;
  if (!isAdmin) redirect('/dashboard');

  const stats = await loadAdminStats();
  const maxSignup = Math.max(1, ...stats.signupsPerDay.map((d) => d.count));

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex items-baseline justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-fg tracking-tight">
            Admin
          </h1>
          <p className="text-sm text-muted mt-1">
            Globale Kanbanly-Zahlen. Service-Role-Zugriff, RLS wird umgangen.
          </p>
        </div>
        <Link href="/dashboard" className="text-xs text-muted hover:text-fg">
          ← Dashboard
        </Link>
      </div>

      <Section title="Gesamtzahlen">
        <Grid>
          <Stat value={stats.totals.users} label="Benutzer" />
          <Stat value={stats.totals.workspaces} label="Workspaces" />
          <Stat value={stats.totals.boards} label="Boards" />
          <Stat value={stats.totals.lists} label="Listen" />
          <Stat value={stats.totals.cards} label="Karten" />
          <Stat value={stats.totals.comments} label="Kommentare" />
          <Stat value={stats.totals.activities} label="Activities" />
          <Stat value={stats.activeUsers7d} label="Aktiv in 7 Tagen" />
        </Grid>
      </Section>

      <Section title="Signups">
        <Grid>
          <Stat value={stats.signups.last24h} label="Letzte 24h" />
          <Stat value={stats.signups.last7d} label="Letzte 7 Tage" />
          <Stat value={stats.signups.last30d} label="Letzte 30 Tage" />
          <Stat value={stats.signups.allTime} label="Insgesamt" />
        </Grid>
      </Section>

      <Section title="Boards erstellt">
        <Grid>
          <Stat value={stats.boards.last7d} label="Letzte 7 Tage" />
          <Stat value={stats.boards.last30d} label="Letzte 30 Tage" />
          <Stat value={stats.boards.allTime} label="Insgesamt" />
        </Grid>
      </Section>

      <Section title="Signups pro Tag (letzte 14 Tage)">
        <div className="rounded-md bg-surface border border-line p-4">
          <div className="flex items-end gap-1.5 h-32">
            {stats.signupsPerDay.map((d) => {
              const h = d.count === 0 ? 2 : (d.count / maxSignup) * 100;
              return (
                <div
                  key={d.day}
                  className="flex-1 flex flex-col items-center gap-1 min-w-0"
                  title={`${d.day}: ${d.count}`}
                >
                  <div
                    className="w-full bg-accent rounded-t-sm transition-all"
                    style={{ height: `${h}%` }}
                  />
                  <span className="text-[9px] text-subtle font-mono tabular-nums">
                    {d.count}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px] text-subtle font-mono">
            <span>{stats.signupsPerDay[0]?.day}</span>
            <span>{stats.signupsPerDay.at(-1)?.day}</span>
          </div>
        </div>
      </Section>

      <Section title="Neueste Nutzer">
        <div className="rounded-md bg-surface border border-line overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-[10px] text-subtle uppercase tracking-wide bg-bg">
              <tr>
                <th className="text-left font-semibold px-4 py-2">Zeit</th>
                <th className="text-left font-semibold px-4 py-2">Username</th>
                <th className="text-left font-semibold px-4 py-2">E-Mail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {stats.recentUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-6 text-center text-xs text-subtle"
                  >
                    Noch keine Nutzer.
                  </td>
                </tr>
              ) : (
                stats.recentUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-elev/30">
                    <td className="px-4 py-2 text-[11px] text-subtle font-mono tabular-nums whitespace-nowrap">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="px-4 py-2 text-fg">
                      {u.username ? `@${u.username}` : (
                        <span className="text-subtle italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted font-mono text-xs truncate">
                      {u.email ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Neueste Boards">
        <div className="rounded-md bg-surface border border-line overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-[10px] text-subtle uppercase tracking-wide bg-bg">
              <tr>
                <th className="text-left font-semibold px-4 py-2">Zeit</th>
                <th className="text-left font-semibold px-4 py-2">Board</th>
                <th className="text-left font-semibold px-4 py-2">Workspace</th>
                <th className="text-left font-semibold px-4 py-2">Ersteller</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {stats.recentBoards.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-xs text-subtle"
                  >
                    Noch keine Boards.
                  </td>
                </tr>
              ) : (
                stats.recentBoards.map((b) => (
                  <tr key={b.id} className="hover:bg-elev/30">
                    <td className="px-4 py-2 text-[11px] text-subtle font-mono tabular-nums whitespace-nowrap">
                      {formatDate(b.created_at)}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/boards/${b.slug}`}
                          className="text-fg hover:text-accent-hover"
                        >
                          {b.name}
                        </Link>
                        <Link
                          href={`/admin/boards/${b.slug}`}
                          className="text-[10px] text-subtle hover:text-accent-soft border border-line-strong rounded px-1 py-0.5"
                          title="Ghost-View — Read-only, unsichtbar"
                        >
                          👻
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-muted text-xs">
                      {b.workspace_name ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-muted text-xs">
                      {b.creator_username ? `@${b.creator_username}` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </main>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  });
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-fg uppercase tracking-wide mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{children}</div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-md bg-surface border border-line p-4">
      <div className="text-2xl font-semibold text-fg font-mono tabular-nums">
        {value}
      </div>
      <div className="text-xs text-fg-soft mt-1">{label}</div>
    </div>
  );
}
