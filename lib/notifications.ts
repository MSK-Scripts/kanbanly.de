import type { SupabaseClient } from '@supabase/supabase-js';

export type NotificationKind =
  | 'comment_added'
  | 'card_renamed'
  | 'card_moved'
  | 'card_due_set'
  | 'card_due_cleared'
  | 'card_archived';

/**
 * Notify all subscribers (and assignees) of a card about an event.
 * Skips the actor — the user who triggered the event doesn't need
 * to be told about their own action.
 */
export async function notifySubscribers(
  supabase: SupabaseClient,
  cardId: string,
  actorId: string,
  kind: NotificationKind,
  payload: Record<string, unknown> = {}
) {
  const [subsRes, assigneesRes] = await Promise.all([
    supabase.from('card_subscribers').select('user_id').eq('card_id', cardId),
    supabase.from('card_assignees').select('user_id').eq('card_id', cardId),
  ]);

  const targetIds = new Set<string>();
  for (const r of (subsRes.data ?? []) as Array<{ user_id: string }>) {
    if (r.user_id !== actorId) targetIds.add(r.user_id);
  }
  for (const r of (assigneesRes.data ?? []) as Array<{ user_id: string }>) {
    if (r.user_id !== actorId) targetIds.add(r.user_id);
  }
  if (targetIds.size === 0) return;

  const rows = Array.from(targetIds).map((userId) => ({
    user_id: userId,
    kind,
    card_id: cardId,
    actor_id: actorId,
    payload,
  }));

  const { error } = await supabase.from('notifications').insert(rows);
  if (error) console.error('notifySubscribers', error);
}

/**
 * Subscribe a user to a card (idempotent).
 */
export async function subscribeUserToCard(
  supabase: SupabaseClient,
  cardId: string,
  userId: string
) {
  await supabase.from('card_subscribers').upsert(
    { card_id: cardId, user_id: userId },
    { onConflict: 'card_id,user_id', ignoreDuplicates: true }
  );
}
