'use server';
import { createClient } from '@/lib/supabase/server';

export async function toggleCardSubscription(
  cardId: string,
  desired: boolean
): Promise<{ subscribed: boolean }> {
  if (!cardId) return { subscribed: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { subscribed: false };

  if (desired) {
    await supabase.from('card_subscribers').upsert(
      { card_id: cardId, user_id: user.id },
      { onConflict: 'card_id,user_id', ignoreDuplicates: true }
    );
    return { subscribed: true };
  }

  await supabase
    .from('card_subscribers')
    .delete()
    .eq('card_id', cardId)
    .eq('user_id', user.id);
  return { subscribed: false };
}

export async function isSubscribedToCard(cardId: string): Promise<boolean> {
  if (!cardId) return false;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from('card_subscribers')
    .select('user_id')
    .eq('card_id', cardId)
    .eq('user_id', user.id)
    .maybeSingle();
  return !!data;
}

export async function markNotificationsRead(ids: string[]) {
  if (ids.length === 0) return;
  const supabase = await createClient();
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', ids);
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);
}
