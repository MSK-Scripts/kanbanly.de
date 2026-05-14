import { getDb } from '../db.js';

export type StickyMessage = {
  guildId: string;
  channelId: string;
  content: string;
  lastMessageId: string | null;
  useEmbed: boolean;
  embedColor: number | null;
};

export async function getStickyForChannel(
  guildId: string,
  channelId: string,
): Promise<StickyMessage | null> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_sticky_messages')
    .select('guild_id, channel_id, content, last_message_id, use_embed, embed_color')
    .eq('guild_id', guildId)
    .eq('channel_id', channelId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    guildId: data.guild_id,
    channelId: data.channel_id,
    content: data.content,
    lastMessageId: data.last_message_id ?? null,
    useEmbed: Boolean(data.use_embed),
    embedColor: (data.embed_color as number | null) ?? null,
  };
}

export async function setStickyLastMessage(
  guildId: string,
  channelId: string,
  lastMessageId: string,
): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('bot_sticky_messages')
    .update({ last_message_id: lastMessageId, updated_at: new Date().toISOString() })
    .eq('guild_id', guildId)
    .eq('channel_id', channelId);
  if (error) throw error;
}
