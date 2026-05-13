import { getDb } from '../db.js';

export type Warning = {
  id: string;
  guildId: string;
  userId: string;
  moderatorId: string;
  reason: string | null;
  createdAt: string;
};

type WarningRow = {
  id: string;
  guild_id: string;
  user_id: string;
  moderator_id: string;
  reason: string | null;
  created_at: string;
};

function mapRow(r: WarningRow): Warning {
  return {
    id: r.id,
    guildId: r.guild_id,
    userId: r.user_id,
    moderatorId: r.moderator_id,
    reason: r.reason,
    createdAt: r.created_at,
  };
}

export async function addWarning(args: {
  guildId: string;
  userId: string;
  moderatorId: string;
  reason: string | null;
}): Promise<Warning> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_warnings')
    .insert({
      guild_id: args.guildId,
      user_id: args.userId,
      moderator_id: args.moderatorId,
      reason: args.reason,
    })
    .select('id, guild_id, user_id, moderator_id, reason, created_at')
    .single();
  if (error || !data) throw error ?? new Error('Insert lieferte keine Daten.');
  return mapRow(data as WarningRow);
}

export async function listWarnings(
  guildId: string,
  userId: string,
): Promise<Warning[]> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_warnings')
    .select('id, guild_id, user_id, moderator_id, reason, created_at')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(25);
  if (error) throw error;
  return (data ?? []).map((r) => mapRow(r as WarningRow));
}

export async function clearWarnings(
  guildId: string,
  userId: string,
): Promise<number> {
  const db = getDb();
  const { error, count } = await db
    .from('bot_warnings')
    .delete({ count: 'exact' })
    .eq('guild_id', guildId)
    .eq('user_id', userId);
  if (error) throw error;
  return count ?? 0;
}

export async function deleteWarning(id: string): Promise<void> {
  const db = getDb();
  const { error } = await db.from('bot_warnings').delete().eq('id', id);
  if (error) throw error;
}
