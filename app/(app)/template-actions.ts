'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { slugify, withRandomSuffix } from '@/lib/slug';

type TemplateList = { id: string; title: string; position: number };
type TemplateLabel = { id: string; name: string; color: string };
type TemplateCard = {
  id: string;
  list_id: string;
  title: string;
  description: string | null;
  position: number;
  label_ids: string[];
};
type TemplateTask = {
  id: string;
  card_id: string;
  title: string;
  position: number;
};

async function uniqueTemplateSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base: string
): Promise<string> {
  let slug = base;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data } = await supabase
      .from('board_templates')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!data) return slug;
    slug = withRandomSuffix(base);
  }
  return withRandomSuffix(base);
}

export async function saveBoardAsTemplate(formData: FormData) {
  const boardId = String(formData.get('board_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const coverEmoji = String(formData.get('cover_emoji') ?? '📋').slice(0, 8);
  const isPublic = formData.get('is_public') === 'on';

  if (!boardId || !title) {
    redirect(`/boards/${boardId}?error=${encodeURIComponent('Titel fehlt')}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [listsRes, cardsRes, labelsRes, cardLabelsRes, tasksRes] =
    await Promise.all([
      supabase
        .from('lists')
        .select('id, title, position')
        .eq('board_id', boardId)
        .order('position'),
      supabase
        .from('cards')
        .select('id, list_id, title, description, position')
        .in(
          'list_id',
          (
            await supabase
              .from('lists')
              .select('id')
              .eq('board_id', boardId)
          ).data?.map((l) => l.id) ?? []
        ),
      supabase
        .from('labels')
        .select('id, name, color')
        .eq('board_id', boardId),
      supabase
        .from('card_labels')
        .select('card_id, label_id, labels!inner(board_id)')
        .eq('labels.board_id', boardId),
      supabase
        .from('tasks')
        .select('id, card_id, title, position')
        .in(
          'card_id',
          (
            await supabase
              .from('cards')
              .select('id, list_id, lists!inner(board_id)')
              .eq('lists.board_id', boardId)
          ).data?.map((c) => c.id) ?? []
        ),
    ]);

  if (listsRes.error || cardsRes.error || labelsRes.error) {
    redirect(
      `/boards/${boardId}?error=${encodeURIComponent('Board konnte nicht gelesen werden')}`
    );
  }

  const slug = await uniqueTemplateSlug(supabase, slugify(title));

  const { data: template, error: tErr } = await supabase
    .from('board_templates')
    .insert({
      slug,
      title,
      description,
      cover_emoji: coverEmoji || '📋',
      author_id: user.id,
      is_public: isPublic,
    })
    .select('id, slug')
    .single();

  if (tErr || !template) {
    redirect(
      `/boards/${boardId}?error=${encodeURIComponent('Template konnte nicht erstellt werden')}`
    );
  }

  const labelIdMap = new Map<string, string>();
  if (labelsRes.data && labelsRes.data.length > 0) {
    const newLabels = labelsRes.data.map((l) => ({
      template_id: template.id,
      name: l.name,
      color: l.color,
    }));
    const { data: insertedLabels } = await supabase
      .from('template_labels')
      .insert(newLabels)
      .select('id, name, color');
    if (insertedLabels) {
      labelsRes.data.forEach((old) => {
        const match = insertedLabels.find(
          (nl) => nl.name === old.name && nl.color === old.color
        );
        if (match) labelIdMap.set(old.id, match.id);
      });
    }
  }

  const listIdMap = new Map<string, string>();
  if (listsRes.data && listsRes.data.length > 0) {
    const newLists = listsRes.data.map((l) => ({
      template_id: template.id,
      title: l.title,
      position: l.position,
    }));
    const { data: insertedLists } = await supabase
      .from('template_lists')
      .insert(newLists)
      .select('id, title, position');
    if (insertedLists) {
      listsRes.data.forEach((old) => {
        const match = insertedLists.find(
          (nl) => nl.title === old.title && nl.position === old.position
        );
        if (match) listIdMap.set(old.id, match.id);
      });
    }
  }

  const cardLabelsByCard = new Map<string, string[]>();
  (cardLabelsRes.data ?? []).forEach((cl) => {
    const row = cl as unknown as { card_id: string; label_id: string };
    const mapped = labelIdMap.get(row.label_id);
    if (!mapped) return;
    const arr = cardLabelsByCard.get(row.card_id) ?? [];
    arr.push(mapped);
    cardLabelsByCard.set(row.card_id, arr);
  });

  const cardIdMap = new Map<string, string>();
  if (cardsRes.data && cardsRes.data.length > 0) {
    const newCards = cardsRes.data
      .map((c) => {
        const newListId = listIdMap.get(c.list_id);
        if (!newListId) return null;
        return {
          template_id: template.id,
          list_id: newListId,
          title: c.title,
          description: c.description,
          position: c.position,
          label_ids: cardLabelsByCard.get(c.id) ?? [],
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (newCards.length > 0) {
      const { data: insertedCards } = await supabase
        .from('template_cards')
        .insert(newCards)
        .select('id, list_id, title, position');
      if (insertedCards) {
        cardsRes.data.forEach((old) => {
          const newListId = listIdMap.get(old.list_id);
          if (!newListId) return;
          const match = insertedCards.find(
            (nc) =>
              nc.title === old.title &&
              nc.position === old.position &&
              nc.list_id === newListId
          );
          if (match) cardIdMap.set(old.id, match.id);
        });
      }
    }
  }

  if (tasksRes.data && tasksRes.data.length > 0) {
    const newTasks = tasksRes.data
      .map((t) => {
        const newCardId = cardIdMap.get(t.card_id);
        if (!newCardId) return null;
        return {
          card_id: newCardId,
          title: t.title,
          position: t.position,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (newTasks.length > 0) {
      await supabase.from('template_tasks').insert(newTasks);
    }
  }

  revalidatePath('/templates');
  redirect(`/templates?created=${template.slug}`);
}

async function getUniqueBoardSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base: string
): Promise<string> {
  let slug = base;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data } = await supabase
      .from('boards')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!data) return slug;
    slug = withRandomSuffix(base);
  }
  return withRandomSuffix(base);
}

export async function createBoardFromTemplate(formData: FormData) {
  const templateId = String(formData.get('template_id') ?? '');
  const workspaceId = String(formData.get('workspace_id') ?? '');
  const name = String(formData.get('name') ?? '').trim();

  if (!templateId || !workspaceId || !name) {
    redirect('/dashboard?error=Template-Daten%20unvollständig');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [templateRes, listsRes, labelsRes, cardsRes] = await Promise.all([
    supabase
      .from('board_templates')
      .select('id, title, use_count')
      .eq('id', templateId)
      .maybeSingle(),
    supabase
      .from('template_lists')
      .select('id, title, position')
      .eq('template_id', templateId)
      .order('position'),
    supabase
      .from('template_labels')
      .select('id, name, color')
      .eq('template_id', templateId),
    supabase
      .from('template_cards')
      .select('id, list_id, title, description, position, label_ids')
      .eq('template_id', templateId)
      .order('position'),
  ]);

  if (!templateRes.data) {
    redirect('/dashboard?error=Template%20nicht%20gefunden');
  }

  const tpl = templateRes.data;
  const templateLists = (listsRes.data ?? []) as TemplateList[];
  const templateLabels = (labelsRes.data ?? []) as TemplateLabel[];
  const templateCards = (cardsRes.data ?? []) as TemplateCard[];

  let templateTasks: TemplateTask[] = [];
  if (templateCards.length > 0) {
    const tasksRes = await supabase
      .from('template_tasks')
      .select('id, card_id, title, position')
      .in('card_id', templateCards.map((c) => c.id));
    templateTasks = (tasksRes.data ?? []) as TemplateTask[];
  }

  const boardSlug = await getUniqueBoardSlug(supabase, slugify(name));
  const { data: board, error: boardErr } = await supabase
    .from('boards')
    .insert({
      name,
      workspace_id: workspaceId,
      slug: boardSlug,
      created_by: user.id,
    })
    .select('id, slug')
    .single();

  if (boardErr || !board) {
    redirect(
      `/dashboard?error=${encodeURIComponent('Board konnte nicht erstellt werden')}`
    );
  }

  const labelIdMap = new Map<string, string>();
  if (templateLabels.length > 0) {
    const newLabels = templateLabels.map((l) => ({
      board_id: board.id,
      name: l.name,
      color: l.color,
    }));
    const { data: insertedLabels } = await supabase
      .from('labels')
      .insert(newLabels)
      .select('id, name, color');
    if (insertedLabels) {
      templateLabels.forEach((old) => {
        const match = insertedLabels.find(
          (nl) => nl.name === old.name && nl.color === old.color
        );
        if (match) labelIdMap.set(old.id, match.id);
      });
    }
  }

  const listIdMap = new Map<string, string>();
  if (templateLists.length > 0) {
    const newLists = templateLists.map((l) => ({
      board_id: board.id,
      title: l.title,
      position: l.position,
    }));
    const { data: insertedLists } = await supabase
      .from('lists')
      .insert(newLists)
      .select('id, title, position');
    if (insertedLists) {
      templateLists.forEach((old) => {
        const match = insertedLists.find(
          (nl) => nl.title === old.title && nl.position === old.position
        );
        if (match) listIdMap.set(old.id, match.id);
      });
    }
  }

  const cardIdMap = new Map<string, string>();
  if (templateCards.length > 0) {
    const newCards = templateCards
      .map((c) => {
        const newListId = listIdMap.get(c.list_id);
        if (!newListId) return null;
        return {
          list_id: newListId,
          title: c.title,
          description: c.description,
          position: c.position,
          created_by: user.id,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (newCards.length > 0) {
      const { data: insertedCards } = await supabase
        .from('cards')
        .insert(newCards)
        .select('id, list_id, title, position');
      if (insertedCards) {
        templateCards.forEach((old) => {
          const newListId = listIdMap.get(old.list_id);
          if (!newListId) return;
          const match = insertedCards.find(
            (nc) =>
              nc.title === old.title &&
              nc.position === old.position &&
              nc.list_id === newListId
          );
          if (match) cardIdMap.set(old.id, match.id);
        });
      }

      const cardLabelRows: Array<{ card_id: string; label_id: string }> = [];
      templateCards.forEach((tc) => {
        const newCardId = cardIdMap.get(tc.id);
        if (!newCardId) return;
        (tc.label_ids ?? []).forEach((oldLabelId) => {
          const newLabelId = labelIdMap.get(oldLabelId);
          if (newLabelId) {
            cardLabelRows.push({ card_id: newCardId, label_id: newLabelId });
          }
        });
      });
      if (cardLabelRows.length > 0) {
        await supabase.from('card_labels').insert(cardLabelRows);
      }
    }
  }

  if (templateTasks.length > 0) {
    const newTasks = templateTasks
      .map((t) => {
        const newCardId = cardIdMap.get(t.card_id);
        if (!newCardId) return null;
        return {
          card_id: newCardId,
          title: t.title,
          position: t.position,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (newTasks.length > 0) {
      await supabase.from('tasks').insert(newTasks);
    }
  }

  await supabase
    .from('board_templates')
    .update({ use_count: (tpl.use_count ?? 0) + 1 })
    .eq('id', templateId);

  revalidatePath('/dashboard');
  redirect(`/boards/${board.slug}`);
}

export async function setTemplatePublic(id: string, isPublic: boolean) {
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from('board_templates')
    .update({ is_public: isPublic, updated_at: new Date().toISOString() })
    .eq('id', id);
  revalidatePath('/templates');
}

export async function deleteTemplate(id: string) {
  if (!id) return;
  const supabase = await createClient();
  await supabase.from('board_templates').delete().eq('id', id);
  revalidatePath('/templates');
}
