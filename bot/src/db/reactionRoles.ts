import { getDb } from '../db.js';

export type ReactionRoleMessage = {
  messageId: string;
  guildId: string;
  channelId: string;
  title: string | null;
  description: string | null;
};

export type ReactionRole = {
  messageId: string;
  emojiKey: string;
  emojiDisplay: string;
  roleId: string;
  label: string | null;
};

export type ParsedEmoji =
  | { kind: 'unicode'; key: string; display: string }
  | { kind: 'custom'; key: string; display: string; id: string; name: string; animated: boolean };

export function parseEmoji(input: string): ParsedEmoji | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const customMatch = trimmed.match(/^<(a?):([\w~]+):(\d+)>$/);
  if (customMatch) {
    const [, animated, name, id] = customMatch;
    return { kind: 'custom', key: id, display: trimmed, id, name, animated: animated === 'a' };
  }
  // Unicode-Emoji oder kurzer Text — Discord lehnt die Reaction ab, falls kein echtes Emoji.
  return { kind: 'unicode', key: trimmed, display: trimmed };
}

export async function createReactionRoleMessage(input: {
  messageId: string;
  guildId: string;
  channelId: string;
  title: string | null;
  description: string | null;
}): Promise<void> {
  const db = getDb();
  const { error } = await db.from('bot_reaction_role_messages').insert({
    message_id: input.messageId,
    guild_id: input.guildId,
    channel_id: input.channelId,
    title: input.title,
    description: input.description,
  });
  if (error) throw error;
}

export async function getReactionRoleMessage(
  messageId: string,
): Promise<ReactionRoleMessage | null> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_reaction_role_messages')
    .select('message_id, guild_id, channel_id, title, description')
    .eq('message_id', messageId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    messageId: data.message_id,
    guildId: data.guild_id,
    channelId: data.channel_id,
    title: data.title,
    description: data.description,
  };
}

export async function listReactionRoleMessages(guildId: string): Promise<ReactionRoleMessage[]> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_reaction_role_messages')
    .select('message_id, guild_id, channel_id, title, description')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((d) => ({
    messageId: d.message_id,
    guildId: d.guild_id,
    channelId: d.channel_id,
    title: d.title,
    description: d.description,
  }));
}

export async function addReactionRole(input: {
  messageId: string;
  emojiKey: string;
  emojiDisplay: string;
  roleId: string;
  label: string | null;
}): Promise<void> {
  const db = getDb();
  const { error } = await db.from('bot_reaction_roles').upsert(
    {
      message_id: input.messageId,
      emoji_key: input.emojiKey,
      emoji_display: input.emojiDisplay,
      role_id: input.roleId,
      label: input.label,
    },
    { onConflict: 'message_id,emoji_key' },
  );
  if (error) throw error;
}

export async function removeReactionRole(messageId: string, emojiKey: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('bot_reaction_roles')
    .delete()
    .eq('message_id', messageId)
    .eq('emoji_key', emojiKey);
  if (error) throw error;
}

export async function listReactionRoles(messageId: string): Promise<ReactionRole[]> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_reaction_roles')
    .select('message_id, emoji_key, emoji_display, role_id, label')
    .eq('message_id', messageId);
  if (error) throw error;
  return (data ?? []).map((d) => ({
    messageId: d.message_id,
    emojiKey: d.emoji_key,
    emojiDisplay: d.emoji_display,
    roleId: d.role_id,
    label: d.label,
  }));
}

export async function lookupReactionRole(
  messageId: string,
  emojiKey: string,
): Promise<ReactionRole | null> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_reaction_roles')
    .select('message_id, emoji_key, emoji_display, role_id, label')
    .eq('message_id', messageId)
    .eq('emoji_key', emojiKey)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    messageId: data.message_id,
    emojiKey: data.emoji_key,
    emojiDisplay: data.emoji_display,
    roleId: data.role_id,
    label: data.label,
  };
}
