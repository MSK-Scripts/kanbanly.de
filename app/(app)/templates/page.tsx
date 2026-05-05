import { createClient } from '@/lib/supabase/server';
import { TemplateCard } from '@/components/TemplateCard';

export const metadata = {
  title: 'Templates',
};

type TemplateRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_emoji: string | null;
  author_id: string | null;
  is_built_in: boolean;
  is_public: boolean;
  use_count: number;
  created_at: string;
};

type WorkspaceRow = { id: string; name: string; slug: string };

type AuthorRow = { id: string; username: string | null };

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <p className="text-muted">Bitte anmelden, um Templates zu sehen.</p>
      </main>
    );
  }

  const { created } = await searchParams;

  const [tplRes, wsRes] = await Promise.all([
    supabase
      .from('board_templates')
      .select('*')
      .or(`is_public.eq.true,is_built_in.eq.true,author_id.eq.${user.id}`)
      .order('is_built_in', { ascending: false })
      .order('use_count', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('workspaces')
      .select('id, name, slug')
      .order('created_at'),
  ]);

  const templates = (tplRes.data ?? []) as TemplateRow[];
  const workspaces = (wsRes.data ?? []) as WorkspaceRow[];

  const authorIds = Array.from(
    new Set(
      templates
        .filter((t) => t.author_id && !t.is_built_in)
        .map((t) => t.author_id as string)
    )
  );
  let authorsByUserId = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: authors } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', authorIds);
    authorsByUserId = new Map(
      ((authors ?? []) as AuthorRow[]).map((a) => [a.id, a.username ?? 'Unbekannt'])
    );
  }

  const builtIn = templates.filter((t) => t.is_built_in);
  const mine = templates.filter((t) => !t.is_built_in && t.author_id === user.id);
  const community = templates.filter(
    (t) => !t.is_built_in && t.is_public && t.author_id !== user.id
  );

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-fg tracking-tight">
          Templates
        </h1>
        <p className="text-sm text-muted mt-1 max-w-xl">
          Starte dein nächstes Board mit einer Struktur, die funktioniert.
          Nimm eins der kuratierten Templates oder teile deins mit der
          Community.
        </p>
      </div>

      {created && (
        <div className="mb-6 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs px-3 py-2">
          Template wurde gespeichert.
        </div>
      )}

      <Section title="Kuratiert" count={builtIn.length}>
        {builtIn.length === 0 ? (
          <Empty text="Keine Built-In-Templates verfügbar." />
        ) : (
          <Grid>
            {builtIn.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                workspaces={workspaces}
                authorUsername={null}
                isOwner={false}
              />
            ))}
          </Grid>
        )}
      </Section>

      <Section title="Deine Templates" count={mine.length}>
        {mine.length === 0 ? (
          <Empty text={'Du hast noch keine Templates gespeichert. Öffne ein Board und klick im Menü auf „Als Template speichern".'} />
        ) : (
          <Grid>
            {mine.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                workspaces={workspaces}
                authorUsername={null}
                isOwner
              />
            ))}
          </Grid>
        )}
      </Section>

      <Section title="Community" count={community.length}>
        {community.length === 0 ? (
          <Empty text="Noch keine Community-Templates. Sei die Erste, die eins teilt!" />
        ) : (
          <Grid>
            {community.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                workspaces={workspaces}
                authorUsername={
                  t.author_id ? authorsByUserId.get(t.author_id) ?? null : null
                }
                isOwner={false}
              />
            ))}
          </Grid>
        )}
      </Section>
    </main>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-sm font-semibold text-fg uppercase tracking-wide">
          {title}
        </h2>
        <span className="text-[11px] text-subtle font-mono tabular-nums">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-line-strong p-6 text-center text-xs text-subtle">
      {text}
    </div>
  );
}
