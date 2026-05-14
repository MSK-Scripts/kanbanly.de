import { getDb } from '../db.js';

export type GiveawayButtonStyle =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'danger';

export type Giveaway = {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string | null;
  prize: string;
  winnersCount: number;
  endsAt: string;
  createdByUserId: string;
  ended: boolean;
  winnerUserIds: string[] | null;
  embedColor: number | null;
  embedTitle: string | null;
  embedDescription: string | null;
  buttonLabel: string | null;
  buttonEmoji: string | null;
  buttonStyle: GiveawayButtonStyle | null;
};

type GiveawayRow = {
  id: string;
  guild_id: string;
  channel_id: string;
  message_id: string | null;
  prize: string;
  winners_count: number;
  ends_at: string;
  created_by_user_id: string;
  ended: boolean;
  winner_user_ids: unknown;
  embed_color: number | null;
  embed_title: string | null;
  embed_description: string | null;
  button_label: string | null;
  button_emoji: string | null;
  button_style: string | null;
};

function map(r: GiveawayRow): Giveaway {
  return {
    id: r.id,
    guildId: r.guild_id,
    channelId: r.channel_id,
    messageId: r.message_id,
    prize: r.prize,
    winnersCount: r.winners_count,
    endsAt: r.ends_at,
    createdByUserId: r.created_by_user_id,
    ended: r.ended,
    winnerUserIds: Array.isArray(r.winner_user_ids)
      ? (r.winner_user_ids as unknown[]).filter(
          (v): v is string => typeof v === 'string',
        )
      : null,
    embedColor: r.embed_color,
    embedTitle: r.embed_title,
    embedDescription: r.embed_description,
    buttonLabel: r.button_label,
    buttonEmoji: r.button_emoji,
    buttonStyle: (r.button_style as GiveawayButtonStyle | null) ?? null,
  };
}

export async function createGiveaway(input: {
  guildId: string;
  channelId: string;
  prize: string;
  winnersCount: number;
  endsAt: Date;
  createdByUserId: string;
  embedColor?: number | null;
  embedTitle?: string | null;
  embedDescription?: string | null;
  buttonLabel?: string | null;
  buttonEmoji?: string | null;
  buttonStyle?: GiveawayButtonStyle | null;
}): Promise<Giveaway> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_giveaways')
    .insert({
      guild_id: input.guildId,
      channel_id: input.channelId,
      prize: input.prize,
      winners_count: input.winnersCount,
      ends_at: input.endsAt.toISOString(),
      created_by_user_id: input.createdByUserId,
      embed_color: input.embedColor ?? null,
      embed_title: input.embedTitle ?? null,
      embed_description: input.embedDescription ?? null,
      button_label: input.buttonLabel ?? null,
      button_emoji: input.buttonEmoji ?? null,
      button_style: input.buttonStyle ?? null,
    })
    .select('*')
    .single();
  if (error || !data) throw error ?? new Error('Insert fehlgeschlagen.');
  return map(data as GiveawayRow);
}

export async function setGiveawayMessageId(
  id: string,
  messageId: string,
): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('bot_giveaways')
    .update({ message_id: messageId })
    .eq('id', id);
  if (error) throw error;
}

export async function getGiveaway(id: string): Promise<Giveaway | null> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_giveaways')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? map(data as GiveawayRow) : null;
}

export async function listActiveGiveaways(): Promise<Giveaway[]> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_giveaways')
    .select('*')
    .eq('ended', false)
    .order('ends_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((d) => map(d as GiveawayRow));
}

export async function finalizeGiveaway(
  id: string,
  winnerUserIds: string[],
): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('bot_giveaways')
    .update({ ended: true, winner_user_ids: winnerUserIds })
    .eq('id', id);
  if (error) throw error;
}

export async function addEntry(giveawayId: string, userId: string): Promise<boolean> {
  const db = getDb();
  const { error } = await db
    .from('bot_giveaway_entries')
    .insert({ giveaway_id: giveawayId, user_id: userId });
  if (error) {
    // Unique-Violation = bereits drin
    if ((error as { code?: string }).code === '23505') return false;
    throw error;
  }
  return true;
}

export async function removeEntry(
  giveawayId: string,
  userId: string,
): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('bot_giveaway_entries')
    .delete()
    .eq('giveaway_id', giveawayId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function hasEntry(
  giveawayId: string,
  userId: string,
): Promise<boolean> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_giveaway_entries')
    .select('user_id')
    .eq('giveaway_id', giveawayId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function listEntries(giveawayId: string): Promise<string[]> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_giveaway_entries')
    .select('user_id')
    .eq('giveaway_id', giveawayId);
  if (error) throw error;
  return (data ?? []).map((r) => r.user_id as string);
}
