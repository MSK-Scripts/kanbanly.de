import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Diese Woche · kanbanly' };

type Ws = { name: string; slug: string };
type Boards = {
  name: string;
  slug: string;
  workspaces: Ws | Ws[] | null;
};
type Lists = {
  title: string;
  boards: Boards | Boards[] | null;
};
type CardRow = {
  id: string;
  title: string;
  due_date: string | null;
  created_at: string;
  lists: Lists | Lists[] | null;
};
type AssigneeRow = {
  cards: CardRow | CardRow[] | null;
};

function pick<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

function formatRelative(iso: string): string {
  const then = new Date(iso);
  const diffMin = Math.round((Date.now() - then.getTime()) / 60000);
  if (diffMin < 1) return 'gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `vor ${diffH} Std`;
  const diffD = Math.round(diffH / 24);
  return `vor ${diffD} Tag${diffD === 1 ? '' : 'en'}`;
}

export default async function WochePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const today = now.toISOString().slice(0, 10);
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [createdRes, dueRes, overdueRes] = await Promise.all([
    supabase
      .from('cards')
      .select(
        'id, title, due_date, created_at, lists!inner(title, boards!inner(name, slug, workspaces(name, slug)))'
      )
      .eq('created_by', user.id)
      .gte('created_at', weekAgo)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('card_assignees')
      .select(
        'cards!inner(id, title, due_date, created_at, lists!inner(title, boards!inner(name, slug, workspaces(name, slug))))'
      )
      .eq('user_id', user.id)
      .gte('cards.due_date', today)
      .lte('cards.due_date', in7),
    supabase
      .from('card_assignees')
      .select(
        'cards!inner(id, title, due_date, created_at, lists!inner(title, boards!inner(name, slug, workspaces(name, slug))))'
      )
      .eq('user_id', user.id)
      .lt('cards.due_date', today)
      .not('cards.due_date', 'is', null),
  ]);

  const created = ((createdRes.data ?? []) as unknown as CardRow[]).map((c) => {
    const list = pick(c.lists);
    const board = list ? pick(list.boards) : null;
    const ws = board ? pick(board.workspaces) : null;
    return {
      id: c.id,
      title: c.title,
      due_date: c.due_date,
      created_at: c.created_at,
      listTitle: list?.title ?? null,
      boardName: board?.name ?? null,
      boardSlug: board?.slug ?? null,
      workspaceName: ws?.name ?? null,
    };
  });

  const unpack = (rows: AssigneeRow[]) =>
    rows
      .map((r) => {
        const c = pick(r.cards);
        if (!c) return null;
        const list = pick(c.lists);
        const board = list ? pick(list.boards) : null;
        return {
          id: c.id,
          title: c.title,
          due_date: c.due_date,
          listTitle: list?.title ?? null,
          boardName: board?.name ?? null,
          boardSlug: board?.slug ?? null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

  const due = unpack((dueRes.data ?? []) as unknown as AssigneeRow[]);
  const overdue = unpack((overdueRes.data ?? []) as unknown as AssigneeRow[]);

  const weekday = now.toLocaleDateString('de-DE', { weekday: 'long' });

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex items-baseline justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-fg tracking-tight">
            Diese Woche
          </h1>
          <p className="text-sm text-muted mt-1 capitalize">
            {weekday}, {now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </p>
        </div>
        <Link href="/dashboard" className="text-xs text-muted hover:text-fg">
          ← Dashboard
        </Link>
      </div>

      <Section
        title="Überfällig"
        count={overdue.length}
        tone="rose"
      >
        {overdue.length === 0 ? (
          <Empty text="Keine überfälligen Karten. Gut so." />
        ) : (
          <ul className="flex flex-col gap-2">
            {overdue.map((c) => (
              <CardRow
                key={c.id}
                href={`/boards/${c.boardSlug}?card=${c.id}`}
                title={c.title}
                meta={`${c.boardName} · ${c.listTitle}`}
                trailing={formatDate(c.due_date)}
                trailingTone="rose"
              />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Fällig in dieser Woche" count={due.length} tone="amber">
        {due.length === 0 ? (
          <Empty text="Nichts fällig. Entspannt." />
        ) : (
          <ul className="flex flex-col gap-2">
            {due.map((c) => (
              <CardRow
                key={c.id}
                href={`/boards/${c.boardSlug}?card=${c.id}`}
                title={c.title}
                meta={`${c.boardName} · ${c.listTitle}`}
                trailing={formatDate(c.due_date)}
                trailingTone="amber"
              />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Von dir diese Woche erstellt" count={created.length}>
        {created.length === 0 ? (
          <Empty text="Noch keine Karten diese Woche. Los!" />
        ) : (
          <ul className="flex flex-col gap-2">
            {created.map((c) => (
              <CardRow
                key={c.id}
                href={`/boards/${c.boardSlug}?card=${c.id}`}
                title={c.title}
                meta={`${c.boardName} · ${c.listTitle}${c.workspaceName ? ' · ' + c.workspaceName : ''}`}
                trailing={formatRelative(c.created_at)}
              />
            ))}
          </ul>
        )}
      </Section>
    </main>
  );
}

function Section({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone?: 'rose' | 'amber';
  children: React.ReactNode;
}) {
  const toneClass =
    tone === 'rose'
      ? 'text-rose-700 dark:text-rose-300'
      : tone === 'amber'
      ? 'text-amber-700 dark:text-amber-300'
      : 'text-fg';
  return (
    <section className="mb-8">
      <div className="flex items-baseline gap-2 mb-3">
        <h2
          className={`text-sm font-semibold uppercase tracking-wide ${toneClass}`}
        >
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

function CardRow({
  href,
  title,
  meta,
  trailing,
  trailingTone,
}: {
  href: string;
  title: string;
  meta: string;
  trailing: string;
  trailingTone?: 'rose' | 'amber';
}) {
  const toneClass =
    trailingTone === 'rose'
      ? 'text-rose-700 dark:text-rose-300'
      : trailingTone === 'amber'
      ? 'text-amber-700 dark:text-amber-300'
      : 'text-subtle';
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-lg bg-surface/60 border border-line/80 hover:border-muted p-3 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm text-fg truncate">{title}</div>
          <div className="text-[11px] text-subtle truncate mt-0.5">{meta}</div>
        </div>
        <div
          className={`text-[11px] font-mono tabular-nums shrink-0 ${toneClass}`}
        >
          {trailing}
        </div>
      </Link>
    </li>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong p-4 text-center text-xs text-subtle">
      {text}
    </div>
  );
}
