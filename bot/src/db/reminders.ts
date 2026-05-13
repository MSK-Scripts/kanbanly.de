import { getDb } from '../db.js';

export type Reminder = {
  id: string;
  userId: string;
  guildId: string | null;
  channelId: string | null;
  dueAt: string;
  content: string;
  createdAt: string;
  deliveredAt: string | null;
};

type Row = {
  id: string;
  user_id: string;
  guild_id: string | null;
  channel_id: string | null;
  due_at: string;
  content: string;
  created_at: string;
  delivered_at: string | null;
};

function map(r: Row): Reminder {
  return {
    id: r.id,
    userId: r.user_id,
    guildId: r.guild_id,
    channelId: r.channel_id,
    dueAt: r.due_at,
    content: r.content,
    createdAt: r.created_at,
    deliveredAt: r.delivered_at,
  };
}

export async function createReminder(args: {
  userId: string;
  guildId: string | null;
  channelId: string | null;
  dueAt: Date;
  content: string;
}): Promise<Reminder> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_reminders')
    .insert({
      user_id: args.userId,
      guild_id: args.guildId,
      channel_id: args.channelId,
      due_at: args.dueAt.toISOString(),
      content: args.content,
    })
    .select('id, user_id, guild_id, channel_id, due_at, content, created_at, delivered_at')
    .single();
  if (error || !data) throw error ?? new Error('Reminder-Insert lieferte keine Daten.');
  return map(data as Row);
}

export async function listDueReminders(now: Date, limit = 25): Promise<Reminder[]> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_reminders')
    .select('id, user_id, guild_id, channel_id, due_at, content, created_at, delivered_at')
    .is('delivered_at', null)
    .lte('due_at', now.toISOString())
    .order('due_at')
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => map(r as Row));
}

export async function markReminderDelivered(id: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('bot_reminders')
    .update({ delivered_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function listUserReminders(
  userId: string,
  limit = 10,
): Promise<Reminder[]> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_reminders')
    .select('id, user_id, guild_id, channel_id, due_at, content, created_at, delivered_at')
    .eq('user_id', userId)
    .is('delivered_at', null)
    .order('due_at')
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => map(r as Row));
}

export async function deleteReminder(id: string, userId: string): Promise<boolean> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_reminders')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id');
  if (error) throw error;
  return (data ?? []).length > 0;
}
