import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { labelPill } from '@/lib/labelColors';
import { loadGhostBoard } from './ghost-data';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Ghost-View · Admin · kanbanly',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
  });
}

const KIND_LABEL: Record<string, string> = {
  created: 'Karte erstellt',
  renamed: 'Karte umbenannt',
  described: 'Beschreibung geändert',
  due_set: 'Fälligkeit gesetzt',
  due_cleared: 'Fälligkeit entfernt',
  moved: 'Karte verschoben',
  assignee_added: 'Zuweisung hinzugefügt',
  assignee_removed: 'Zuweisung entfernt',
  label_added: 'Label hinzugefügt',
  label_removed: 'Label entfernt',
  task_added: 'Task hinzugefügt',
  task_done: 'Task abgehakt',
  task_undone: 'Task wieder offen',
  task_deleted: 'Task gelöscht',
};

export default async function GhostBoardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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
  const isAdmin = !!(profile as { is_admin?: boolean } | null)?.is_admin;
  if (!isAdmin) redirect('/dashboard');

  const data = await loadGhostBoard(slug);
  if (!data) notFound();

  const { board, lists, labels, cards, activity } = data;
  const labelMap = new Map(labels.map((l) => [l.id, l]));
  const cardsByList = new Map<string, typeof cards>();
  cards
    .slice()
    .sort((a, b) => a.position - b.position)
    .forEach((c) => {
      const arr = cardsByList.get(c.list_id) ?? [];
      arr.push(c);
      cardsByList.set(c.list_id, arr);
    });

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-4 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs px-3 py-2 flex items-center justify-between gap-3">
        <span>
          👻 <strong>Ghost-Modus:</strong> Read-only, keine Presence, keine
          Activity, keine Webhooks. Der Board-Besitzer sieht nicht dass du hier
          bist.
        </span>
        <Link href="/admin" className="text-[11px] underline shrink-0">
          ← Admin
        </Link>
      </div>

      <div className="flex items-baseline justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-fg">
            {board.name}
          </h1>
          <p className="text-xs text-muted mt-1">
            {board.workspace_name ? `${board.workspace_name} · ` : ''}
            {board.creator_username ? `@${board.creator_username} · ` : ''}
            erstellt {formatDateTime(board.created_at)}
          </p>
        </div>
        <div className="text-[11px] text-subtle font-mono">
          /boards/{board.slug}
        </div>
      </div>

      {labels.length > 0 && (
        <section className="mb-6">
          <h2 className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">
            Labels
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {labels.map((l) => (
              <span
                key={l.id}
                className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium border ${labelPill(l.color)}`}
              >
                {l.name}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8 overflow-x-auto board-scroll">
        <div className="flex gap-3 items-start min-w-min">
          {lists.length === 0 ? (
            <p className="text-xs text-subtle">Noch keine Listen.</p>
          ) : (
            lists.map((list) => {
              const listCards = cardsByList.get(list.id) ?? [];
              return (
                <div
                  key={list.id}
                  className="w-[300px] shrink-0 rounded-md bg-surface border border-line"
                >
                  <div className="px-3 py-2 border-b border-line flex items-center justify-between">
                    <span className="text-sm font-semibold text-fg">
                      {list.title}
                    </span>
                    <span className="text-[10px] text-subtle tabular-nums font-mono">
                      {listCards.length}
                    </span>
                  </div>
                  <div className="p-2 space-y-2">
                    {listCards.length === 0 ? (
                      <p className="text-[11px] text-subtle text-center py-2">
                        —
                      </p>
                    ) : (
                      listCards.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-md bg-elev border border-line-strong p-2.5 text-xs"
                        >
                          {c.label_ids.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1.5">
                              {c.label_ids.map((lid) => {
                                const l = labelMap.get(lid);
                                if (!l) return null;
                                return (
                                  <span
                                    key={lid}
                                    className={`inline-block rounded px-1 py-0.5 text-[10px] font-medium border ${labelPill(l.color)}`}
                                  >
                                    {l.name}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          <div className="text-fg font-medium leading-snug">
                            {c.title}
                          </div>
                          {c.description && (
                            <p className="mt-1 text-[11px] text-muted leading-snug line-clamp-3 whitespace-pre-wrap">
                              {c.description}
                            </p>
                          )}
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-subtle">
                            {c.due_date && <span>⏰ {formatDate(c.due_date)}</span>}
                            {c.tasks.length > 0 && (
                              <span>
                                ✓ {c.tasks.filter((t) => t.done).length}/
                                {c.tasks.length}
                              </span>
                            )}
                            {c.assignee_usernames.length > 0 && (
                              <span>
                                👥 {c.assignee_usernames.map((u) => `@${u}`).join(', ')}
                              </span>
                            )}
                            {c.comments.length > 0 && (
                              <span>💬 {c.comments.length}</span>
                            )}
                            {c.creator_username && (
                              <span className="ml-auto">
                                von @{c.creator_username}
                              </span>
                            )}
                          </div>
                          {c.tasks.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5">
                              {c.tasks.map((t) => (
                                <li
                                  key={t.id}
                                  className={`text-[11px] ${t.done ? 'line-through text-subtle' : 'text-fg-soft'}`}
                                >
                                  {t.done ? '☑' : '☐'} {t.title}
                                </li>
                              ))}
                            </ul>
                          )}
                          {c.comments.length > 0 && (
                            <details className="mt-2 border-t border-line/60 pt-1.5">
                              <summary className="text-[10px] text-muted cursor-pointer hover:text-fg-soft">
                                {c.comments.length} Kommentar
                                {c.comments.length === 1 ? '' : 'e'} anzeigen
                              </summary>
                              <ul className="mt-1.5 space-y-1.5">
                                {c.comments.map((cm) => (
                                  <li
                                    key={cm.id}
                                    className="text-[11px] text-fg-soft leading-snug"
                                  >
                                    <div className="text-[10px] text-subtle">
                                      {cm.author_username ? `@${cm.author_username}` : 'anon'}
                                      {' · '}
                                      {formatDateTime(cm.created_at)}
                                    </div>
                                    <div className="whitespace-pre-wrap">
                                      {cm.content}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">
          Letzte Aktivität (max 50)
        </h2>
        <div className="rounded-md bg-surface border border-line divide-y divide-line">
          {activity.length === 0 ? (
            <p className="p-4 text-xs text-subtle">Noch keine Aktivität.</p>
          ) : (
            activity.map((a) => (
              <div
                key={a.id}
                className="flex items-baseline gap-3 px-3 py-2 text-xs"
              >
                <span className="text-[10px] text-subtle font-mono tabular-nums w-28 shrink-0">
                  {formatDateTime(a.created_at)}
                </span>
                <span className="text-fg-soft w-40 shrink-0 truncate">
                  {a.user_username ? `@${a.user_username}` : '—'}
                </span>
                <span className="text-muted truncate">
                  {KIND_LABEL[a.kind] ?? a.kind}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
