import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { BoardMenu } from '@/components/BoardMenu';
import { BoardTabs } from '@/components/BoardTabs';
import { MembersDialog } from '@/components/MembersDialog';
import { RenameBoardTitle } from '@/components/RenameTitle';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/slug';
import {
  createAutomation,
  deleteAutomation,
  toggleAutomation,
} from '@/app/(app)/automation-actions';
import type { Automation, AutomationActionKind } from '@/lib/automations';

const ACTION_LABELS: Record<AutomationActionKind, string> = {
  archive_card: 'Karte archivieren',
  clear_due_date: 'Fälligkeit entfernen',
  add_label: 'Label hinzufügen',
  remove_label: 'Label entfernen',
  clear_assignees: 'Zuweisungen entfernen',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const filterCol = isUuid(id) ? 'id' : 'slug';
  const { data } = await supabase
    .from('boards')
    .select('name')
    .eq(filterCol, id)
    .maybeSingle();
  const name = (data as { name?: string } | null)?.name;
  return { title: name ? `${name} · Automation · kanbanly` : 'Automation · kanbanly' };
}

export default async function AutomationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const filterCol = isUuid(id) ? 'id' : 'slug';
  const { data: boardRow } = await supabase
    .from('boards')
    .select(
      'id, slug, name, workspace_id, workspaces(name, slug)'
    )
    .eq(filterCol, id)
    .maybeSingle();

  type WorkspaceShort = { name: string; slug: string };
  type BoardRow = {
    id: string;
    slug: string;
    name: string;
    workspace_id: string;
    workspaces: WorkspaceShort | WorkspaceShort[] | null;
  };
  const board = boardRow as BoardRow | null;
  if (!board) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (isUuid(id) && board.slug !== id) {
    redirect(`/boards/${board.slug}/automation`);
  }

  const workspace = Array.isArray(board.workspaces)
    ? board.workspaces[0]
    : board.workspaces;

  const [{ data: rules }, { data: lists }, { data: labels }] =
    await Promise.all([
      supabase
        .from('board_automations')
        .select(
          'id, board_id, name, enabled, trigger_kind, trigger_config, action_kind, action_config'
        )
        .eq('board_id', board.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('lists')
        .select('id, title')
        .eq('board_id', board.id)
        .order('position'),
      supabase
        .from('labels')
        .select('id, name, color')
        .eq('board_id', board.id)
        .order('created_at'),
    ]);

  const automations = (rules ?? []) as Automation[];
  const listById = new Map(
    (lists ?? []).map((l) => [l.id as string, l.title as string])
  );
  const labelById = new Map(
    (labels ?? []).map((l) => [l.id as string, l.name as string])
  );

  return (
    <>
      <div className="px-3 sm:px-6 py-3 border-b border-line/60 flex items-center justify-between gap-2 sm:gap-3 text-sm">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            href="/dashboard"
            className="text-muted hover:text-fg transition-colors hidden sm:inline"
          >
            Dashboard
          </Link>
          <span className="text-faint hidden sm:inline">/</span>
          <Link
            href={`/workspaces/${workspace?.slug ?? board.workspace_id}`}
            className="text-muted hover:text-fg transition-colors truncate"
          >
            {workspace?.name ?? ''}
          </Link>
          <span className="text-faint">/</span>
          <RenameBoardTitle
            id={board.id}
            name={board.name}
            viewClassName="text-fg font-medium truncate hover:text-accent-hover transition-colors text-left"
            inputClassName="text-fg font-medium bg-elev border border-muted rounded px-1 -mx-1 focus:outline-none focus:ring-1 focus:ring-accent-hover/60 min-w-0"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <MembersDialog boardId={board.id} />
          <BoardMenu
            boardId={board.id}
            boardName={board.name}
            workspaceId={board.workspace_id}
          />
        </div>
      </div>
      <BoardTabs boardSlug={board.slug} active="automation" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-fg">Automation</h1>
          <p className="text-xs text-muted mt-1">
            Regeln, die ausgelöst werden wenn sich etwas auf dem Board tut.
            Aktuell nur ein Trigger: <em>Karte landet in einer Liste</em>.
          </p>
        </div>

        <section>
          <h2 className="text-sm font-semibold text-fg mb-2">Aktive Regeln</h2>
          {automations.length === 0 ? (
            <div className="rounded-md border border-dashed border-line-strong p-6 text-center text-sm text-subtle">
              Keine Regeln. Leg unten deine erste an.
            </div>
          ) : (
            <ul className="rounded-md border border-line bg-surface overflow-hidden divide-y divide-line">
              {automations.map((rule) => {
                const triggerListId = (rule.trigger_config as { listId?: string })
                  .listId;
                const labelId = (rule.action_config as { labelId?: string })
                  .labelId;
                return (
                  <li key={rule.id} className="px-3 py-2.5">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-fg font-medium leading-snug break-words">
                          {rule.name}
                        </div>
                        <div className="text-[11px] text-subtle mt-0.5">
                          Wenn Karte in{' '}
                          <strong className="text-fg-soft">
                            {triggerListId
                              ? listById.get(triggerListId) ?? '?'
                              : '?'}
                          </strong>{' '}
                          landet → {ACTION_LABELS[rule.action_kind]}
                          {labelId && (
                            <>
                              {' '}
                              <strong className="text-fg-soft">
                                ({labelById.get(labelId) ?? '?'})
                              </strong>
                            </>
                          )}
                          {!rule.enabled && (
                            <span className="ml-2 text-rose-500">
                              · pausiert
                            </span>
                          )}
                        </div>
                      </div>
                      <form
                        action={toggleAutomation.bind(
                          null,
                          rule.id,
                          !rule.enabled,
                          board.slug
                        )}
                      >
                        <button
                          type="submit"
                          className="text-xs text-fg-soft hover:text-fg px-2 py-1 transition-colors"
                        >
                          {rule.enabled ? 'Pausieren' : 'Aktivieren'}
                        </button>
                      </form>
                      <form
                        action={deleteAutomation.bind(null, rule.id, board.slug)}
                      >
                        <button
                          type="submit"
                          className="text-xs text-muted hover:text-rose-500 px-2 py-1 transition-colors"
                        >
                          Löschen
                        </button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-fg mb-2">Neue Regel</h2>
          <CreateRuleForm
            boardId={board.id}
            boardSlug={board.slug}
            lists={(lists ?? []) as Array<{ id: string; title: string }>}
            labels={
              (labels ?? []) as Array<{
                id: string;
                name: string;
                color: string;
              }>
            }
          />
        </section>
      </main>
    </>
  );
}

function CreateRuleForm({
  boardId,
  boardSlug,
  lists,
  labels,
}: {
  boardId: string;
  boardSlug: string;
  lists: Array<{ id: string; title: string }>;
  labels: Array<{ id: string; name: string; color: string }>;
}) {
  async function submit(formData: FormData) {
    'use server';
    const name = String(formData.get('name') ?? '').trim();
    const listId = String(formData.get('listId') ?? '');
    const actionKind = String(
      formData.get('actionKind') ?? ''
    ) as AutomationActionKind;
    const labelId = String(formData.get('labelId') ?? '');
    if (!name || !listId || !actionKind) return;

    const actionConfig: Record<string, unknown> = {};
    if (
      (actionKind === 'add_label' || actionKind === 'remove_label') &&
      labelId
    ) {
      actionConfig.labelId = labelId;
    }

    await createAutomation(boardId, boardSlug, {
      name,
      triggerKind: 'card_moved_to_list',
      triggerConfig: { listId },
      actionKind,
      actionConfig,
    });
  }

  return (
    <form
      action={submit}
      className="rounded-md border border-line bg-surface p-4 space-y-3"
    >
      <div>
        <label className="block text-xs text-muted mb-1">Name</label>
        <input
          name="name"
          required
          placeholder="z. B. Erledigte Karten archivieren"
          className="w-full rounded-md bg-elev border border-line-strong px-3 py-1.5 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted mb-1">
            Wenn Karte in Liste landet
          </label>
          <select
            name="listId"
            required
            defaultValue=""
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-1.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="" disabled>
              Liste wählen…
            </option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Action</label>
          <select
            name="actionKind"
            required
            defaultValue=""
            className="w-full rounded-md bg-elev border border-line-strong px-3 py-1.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="" disabled>
              Action wählen…
            </option>
            <option value="archive_card">Karte archivieren</option>
            <option value="clear_due_date">Fälligkeit entfernen</option>
            <option value="add_label">Label hinzufügen</option>
            <option value="remove_label">Label entfernen</option>
            <option value="clear_assignees">Zuweisungen entfernen</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">
          Label (nur für Label-Actions)
        </label>
        <select
          name="labelId"
          defaultValue=""
          className="w-full rounded-md bg-elev border border-line-strong px-3 py-1.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">— kein Label —</option>
          {labels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="rounded-md bg-accent hover:bg-accent-hover text-white text-xs font-medium px-4 py-2 transition-colors"
      >
        Regel anlegen
      </button>
    </form>
  );
}
