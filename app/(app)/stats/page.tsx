import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Deine Stats' };

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <p className="text-muted">Bitte anmelden.</p>
      </main>
    );
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const [
    createdAll,
    createdWeek,
    createdMonth,
    assigned,
    workspaces,
    boardsOwner,
    boardsGuest,
    labelsCreated,
    commentsAll,
    activityWeek,
    activityMonth,
  ] = await Promise.all([
    supabase.from('cards').select('id', { count: 'exact', head: true }).eq('created_by', user.id),
    supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', user.id)
      .gte('created_at', weekAgo),
    supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', user.id)
      .gte('created_at', monthAgo),
    supabase
      .from('card_assignees')
      .select('card_id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('workspaces')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id),
    supabase
      .from('boards')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', user.id),
    supabase
      .from('board_members')
      .select('board_id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('labels')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('card_comments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('card_activity')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', weekAgo),
    supabase
      .from('card_activity')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', monthAgo),
  ]);

  const cardsCreated = createdAll.count ?? 0;
  const cardsWeek = createdWeek.count ?? 0;
  const cardsMonth = createdMonth.count ?? 0;
  const cardsAssigned = assigned.count ?? 0;
  const wsOwned = workspaces.count ?? 0;
  const boardsCreated = boardsOwner.count ?? 0;
  const boardsGuestOf = boardsGuest.count ?? 0;
  const labelsCount = labelsCreated.count ?? 0;
  const commentsCount = commentsAll.count ?? 0;
  const actionsWeek = activityWeek.count ?? 0;
  const actionsMonth = activityMonth.count ?? 0;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-fg tracking-tight">
          Deine Stats
        </h1>
        <p className="text-sm text-muted mt-1">
          Was du insgesamt bei Kanbanly angerichtet hast.
        </p>
      </div>

      <Section title="Diese Woche">
        <Grid>
          <Stat value={actionsWeek} label="Aktionen" hint="zuletzt 7 Tage" />
          <Stat value={cardsWeek} label="Neue Karten" hint="erstellt in 7 Tagen" />
        </Grid>
      </Section>

      <Section title="Dieser Monat">
        <Grid>
          <Stat value={actionsMonth} label="Aktionen" hint="zuletzt 30 Tage" />
          <Stat value={cardsMonth} label="Neue Karten" hint="erstellt in 30 Tagen" />
        </Grid>
      </Section>

      <Section title="Insgesamt">
        <Grid>
          <Stat value={cardsCreated} label="Karten erstellt" />
          <Stat value={cardsAssigned} label="Karten zugewiesen" />
          <Stat value={commentsCount} label="Kommentare geschrieben" />
          <Stat value={labelsCount} label="Labels in deinen Boards" />
          <Stat value={boardsCreated} label="Boards erstellt" />
          <Stat value={boardsGuestOf} label="Als Gast auf Boards" />
          <Stat value={wsOwned} label="Workspaces" />
        </Grid>
      </Section>
    </main>
  );
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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {children}
    </div>
  );
}

function Stat({
  value,
  label,
  hint,
}: {
  value: number;
  label: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md bg-surface border border-line p-4">
      <div className="text-2xl font-semibold text-fg font-mono tabular-nums">
        {value}
      </div>
      <div className="text-xs text-fg-soft mt-1">{label}</div>
      {hint && <div className="text-[10px] text-subtle mt-0.5">{hint}</div>}
    </div>
  );
}
