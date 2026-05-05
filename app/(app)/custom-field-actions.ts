'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type CustomFieldKind = 'text' | 'number' | 'date' | 'dropdown';

export async function createCustomField(
  boardId: string,
  boardSlug: string,
  payload: { name: string; kind: CustomFieldKind; options?: string[] }
) {
  const trimmed = payload.name.trim();
  if (!boardId || !trimmed) return;
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('custom_fields')
    .select('position')
    .eq('board_id', boardId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((existing?.position as number | undefined) ?? -1) + 1;

  await supabase.from('custom_fields').insert({
    board_id: boardId,
    name: trimmed,
    kind: payload.kind,
    options: payload.options ?? [],
    position,
  });

  revalidatePath(`/boards/${boardSlug}/felder`);
  revalidatePath(`/boards/${boardSlug}`);
}

export async function deleteCustomField(id: string, boardSlug: string) {
  if (!id) return;
  const supabase = await createClient();
  await supabase.from('custom_fields').delete().eq('id', id);
  revalidatePath(`/boards/${boardSlug}/felder`);
  revalidatePath(`/boards/${boardSlug}`);
}

export async function setCardFieldValue(
  cardId: string,
  fieldId: string,
  value: string | number | null
) {
  if (!cardId || !fieldId) return;
  const supabase = await createClient();
  if (value === null || value === '') {
    await supabase
      .from('card_field_values')
      .delete()
      .eq('card_id', cardId)
      .eq('field_id', fieldId);
    return;
  }
  await supabase.from('card_field_values').upsert(
    {
      card_id: cardId,
      field_id: fieldId,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'card_id,field_id' }
  );
}
