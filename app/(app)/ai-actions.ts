'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { slugify, withRandomSuffix } from '@/lib/slug';
import {
  generateBoard,
  improveCardDescription,
  suggestCardSubtasks,
  type GeneratedBoard,
} from '@/lib/ai';

export type AIBoardDraft = GeneratedBoard;

export async function previewAIBoard(
  _prev: { ok: boolean; draft?: AIBoardDraft; error?: string } | null,
  formData: FormData
): Promise<{ ok: boolean; draft?: AIBoardDraft; error?: string }> {
  const prompt = String(formData.get('prompt') ?? '');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Nicht angemeldet.' };

  try {
    const draft = await generateBoard(prompt);
    if (draft.lists.length === 0) {
      return { ok: false, error: 'KI hat keine Listen generiert — versuch eine andere Beschreibung.' };
    }
    return { ok: true, draft };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unbekannter Fehler.';
    return { ok: false, error: msg };
  }
}

async function uniqueBoardSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base: string
): Promise<string> {
  let slug = base || 'board';
  for (let i = 0; i < 5; i++) {
    const { data } = await supabase
      .from('boards')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!data) return slug;
    slug = withRandomSuffix(base || 'board');
  }
  return withRandomSuffix(base || 'board');
}

export async function createAIBoard(formData: FormData) {
  const workspaceId = String(formData.get('workspace_id') ?? '');
  const draftJson = String(formData.get('draft') ?? '');
  const overrideName = String(formData.get('name') ?? '').trim();

  if (!workspaceId || !draftJson) {
    redirect('/dashboard?error=Daten%20unvollst%C3%A4ndig');
  }

  let draft: AIBoardDraft;
  try {
    draft = JSON.parse(draftJson);
  } catch {
    redirect('/dashboard?error=Draft%20ung%C3%BCltig');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const boardName = overrideName || draft.name;
  const boardSlug = await uniqueBoardSlug(supabase, slugify(boardName));

  const { data: board, error: boardErr } = await supabase
    .from('boards')
    .insert({
      name: boardName,
      workspace_id: workspaceId,
      slug: boardSlug,
      created_by: user.id,
    })
    .select('id, slug')
    .single();

  if (boardErr || !board) {
    redirect(
      `/dashboard?error=${encodeURIComponent(boardErr?.message ?? 'Board konnte nicht angelegt werden')}`
    );
  }

  const labelNameToId = new Map<string, string>();
  if (draft.labels.length > 0) {
    const { data: insertedLabels } = await supabase
      .from('labels')
      .insert(
        draft.labels.map((l) => ({
          board_id: board.id,
          name: l.name,
          color: l.color,
        }))
      )
      .select('id, name');
    (insertedLabels ?? []).forEach((l) => {
      const row = l as { id: string; name: string };
      labelNameToId.set(row.name, row.id);
    });
  }

  for (let listIdx = 0; listIdx < draft.lists.length; listIdx++) {
    const listDraft = draft.lists[listIdx];
    const { data: listRow } = await supabase
      .from('lists')
      .insert({
        board_id: board.id,
        title: listDraft.title,
        position: listIdx,
      })
      .select('id')
      .single();
    if (!listRow) continue;
    const listId = (listRow as { id: string }).id;

    for (let cardIdx = 0; cardIdx < listDraft.cards.length; cardIdx++) {
      const cardDraft = listDraft.cards[cardIdx];
      const { data: cardRow } = await supabase
        .from('cards')
        .insert({
          list_id: listId,
          title: cardDraft.title,
          description: cardDraft.description || null,
          position: cardIdx,
          created_by: user.id,
        })
        .select('id')
        .single();
      if (!cardRow) continue;
      const cardId = (cardRow as { id: string }).id;

      if (cardDraft.tasks.length > 0) {
        await supabase.from('tasks').insert(
          cardDraft.tasks.map((title, i) => ({
            card_id: cardId,
            title,
            position: i,
          }))
        );
      }

      const cardLabelIds = cardDraft.labels
        .map((n) => labelNameToId.get(n))
        .filter((x): x is string => !!x);
      if (cardLabelIds.length > 0) {
        await supabase.from('card_labels').insert(
          cardLabelIds.map((lid) => ({ card_id: cardId, label_id: lid }))
        );
      }
    }
  }

  revalidatePath('/dashboard');
  redirect(`/boards/${board.slug}`);
}

export async function aiImproveDescription(
  title: string,
  currentDescription: string
): Promise<{ ok: true; description: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Nicht angemeldet.' };

  try {
    const description = await improveCardDescription(title, currentDescription);
    return { ok: true, description };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'KI-Fehler.';
    return { ok: false, error: msg };
  }
}

export async function aiSuggestSubtasks(
  title: string,
  description: string
): Promise<{ ok: true; tasks: string[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Nicht angemeldet.' };

  try {
    const tasks = await suggestCardSubtasks(title, description);
    if (tasks.length === 0) {
      return { ok: false, error: 'KI hat keine Subtasks vorgeschlagen.' };
    }
    return { ok: true, tasks };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'KI-Fehler.';
    return { ok: false, error: msg };
  }
}
