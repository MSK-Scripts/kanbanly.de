import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { BoardMenu } from '@/components/BoardMenu';
import { BoardTabs } from '@/components/BoardTabs';
import { MembersDialog } from '@/components/MembersDialog';
import { RenameBoardTitle } from '@/components/RenameTitle';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/slug';
import {
  createCustomField,
  deleteCustomField,
  type CustomFieldKind,
} from '@/app/(app)/custom-field-actions';

type Field = {
  id: string;
  name: string;
  kind: CustomFieldKind;
  options: string[];
  position: number;
};

const KIND_LABELS: Record<CustomFieldKind, string> = {
  text: 'Text',
  number: 'Zahl',
  date: 'Datum',
  dropdown: 'Auswahl',
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
  return { title: name ? `${name} · Felder · kanbanly` : 'Felder · kanbanly' };
}

export default async function FieldsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const filterCol = isUuid(id) ? 'id' : 'slug';
  const { data: boardRow } = await supabase
    .from('boards')
    .select('id, slug, name, workspace_id, workspaces(name, slug)')
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
    redirect(`/boards/${board.slug}/felder`);
  }

  const workspace = Array.isArray(board.workspaces)
    ? board.workspaces[0]
    : board.workspaces;

  const { data: fieldsRaw } = await supabase
    .from('custom_fields')
    .select('id, name, kind, options, position')
    .eq('board_id', board.id)
    .order('position');

  const fields = (fieldsRaw ?? []) as Field[];

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
      <BoardTabs boardSlug={board.slug} active="fields" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-fg">
            Eigene Felder
          </h1>
          <p className="text-xs text-muted mt-1">
            Strukturierte Zusatzdaten pro Karte — Priorität, Kostenstelle,
            Story Points, alles was zu deinem Workflow passt.
          </p>
        </div>

        <section>
          <h2 className="text-sm font-semibold text-fg mb-2">Felder</h2>
          {fields.length === 0 ? (
            <div className="rounded-md border border-dashed border-line-strong p-6 text-center text-sm text-subtle">
              Noch keine Felder. Leg unten dein erstes an.
            </div>
          ) : (
            <ul className="rounded-md border border-line bg-surface overflow-hidden divide-y divide-line">
              {fields.map((f) => (
                <li key={f.id} className="px-3 py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-fg font-medium leading-snug break-words">
                      {f.name}
                    </div>
                    <div className="text-[11px] text-subtle mt-0.5">
                      {KIND_LABELS[f.kind]}
                      {f.kind === 'dropdown' && f.options.length > 0 && (
                        <>
                          <span className="mx-1 text-faint">·</span>
                          {f.options.join(', ')}
                        </>
                      )}
                    </div>
                  </div>
                  <form
                    action={deleteCustomField.bind(null, f.id, board.slug)}
                  >
                    <button
                      type="submit"
                      className="text-xs text-muted hover:text-rose-500 px-2 py-1 transition-colors"
                    >
                      Löschen
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-fg mb-2">Neues Feld</h2>
          <CreateFieldForm boardId={board.id} boardSlug={board.slug} />
        </section>
      </main>
    </>
  );
}

function CreateFieldForm({
  boardId,
  boardSlug,
}: {
  boardId: string;
  boardSlug: string;
}) {
  async function submit(formData: FormData) {
    'use server';
    const name = String(formData.get('name') ?? '').trim();
    const kind = String(formData.get('kind') ?? '') as CustomFieldKind;
    const optionsRaw = String(formData.get('options') ?? '').trim();
    if (!name || !kind) return;
    const options =
      kind === 'dropdown'
        ? optionsRaw
            .split('\n')
            .map((o) => o.trim())
            .filter(Boolean)
        : [];
    await createCustomField(boardId, boardSlug, { name, kind, options });
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
          placeholder="z. B. Priorität"
          className="w-full rounded-md bg-elev border border-line-strong px-3 py-1.5 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">Typ</label>
        <select
          name="kind"
          required
          defaultValue="text"
          className="w-full rounded-md bg-elev border border-line-strong px-3 py-1.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="text">Text</option>
          <option value="number">Zahl</option>
          <option value="date">Datum</option>
          <option value="dropdown">Auswahl</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">
          Optionen (nur bei „Auswahl&quot;, eine pro Zeile)
        </label>
        <textarea
          name="options"
          rows={3}
          placeholder={'Hoch\nMittel\nNiedrig'}
          className="w-full rounded-md bg-elev border border-line-strong px-3 py-1.5 text-sm text-fg placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-accent font-mono"
        />
      </div>
      <button
        type="submit"
        className="rounded-md bg-accent hover:bg-accent-hover text-white text-xs font-medium px-4 py-2 transition-colors"
      >
        Feld anlegen
      </button>
    </form>
  );
}
