'use server';
import { createClient } from '@/lib/supabase/server';

export async function linkCards(fromCardId: string, toCardId: string) {
  if (!fromCardId || !toCardId || fromCardId === toCardId) return;
  const supabase = await createClient();
  await supabase.from('card_links').upsert(
    {
      from_card_id: fromCardId,
      to_card_id: toCardId,
      kind: 'related',
    },
    { onConflict: 'from_card_id,to_card_id,kind', ignoreDuplicates: true }
  );
}

export async function unlinkCards(fromCardId: string, toCardId: string) {
  if (!fromCardId || !toCardId) return;
  const supabase = await createClient();
  // ungerichtet — beide möglichen Richtungen löschen
  await supabase
    .from('card_links')
    .delete()
    .or(
      `and(from_card_id.eq.${fromCardId},to_card_id.eq.${toCardId}),and(from_card_id.eq.${toCardId},to_card_id.eq.${fromCardId})`
    );
}
