import type { Guild } from 'discord.js';
import { getDb } from '../db.js';

export type WelcomeConfig = {
  enabled: boolean;
  channelId: string | null;
  message: string | null;
  useEmbed: boolean;
  embedColor: number | null;
  dmEnabled: boolean;
  dmMessage: string | null;
  dmUseEmbed: boolean;
};

export type BoosterConfig = {
  enabled: boolean;
  channelId: string | null;
  message: string | null;
  useEmbed: boolean;
  embedColor: number | null;
};

export type AutoRolesConfig = {
  enabled: boolean;
  roleIds: string[];
};

export type LogConfig = {
  channelId: string | null;
  joins: boolean;
  leaves: boolean;
  messageEdits: boolean;
  messageDeletes: boolean;
  roleChanges: boolean;
};

export async function ensureGuild(guild: Guild): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('bot_guilds')
    .upsert(
      {
        guild_id: guild.id,
        owner_id: guild.ownerId,
        name: guild.name,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'guild_id', ignoreDuplicates: false },
    );
  if (error) throw error;
}

export async function getWelcomeConfig(guildId: string): Promise<WelcomeConfig | null> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_guilds')
    .select(
      'welcome_enabled, welcome_channel_id, welcome_message, welcome_use_embed, welcome_embed_color, welcome_dm_enabled, welcome_dm_message, welcome_dm_use_embed',
    )
    .eq('guild_id', guildId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    enabled: data.welcome_enabled,
    channelId: data.welcome_channel_id,
    message: data.welcome_message,
    useEmbed: Boolean(data.welcome_use_embed),
    embedColor: (data.welcome_embed_color as number | null) ?? null,
    dmEnabled: Boolean(data.welcome_dm_enabled),
    dmMessage: data.welcome_dm_message ?? null,
    dmUseEmbed: Boolean(data.welcome_dm_use_embed),
  };
}

export async function getBoosterConfig(guildId: string): Promise<BoosterConfig | null> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_guilds')
    .select(
      'booster_enabled, booster_channel_id, booster_message, booster_use_embed, booster_embed_color',
    )
    .eq('guild_id', guildId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    enabled: Boolean(data.booster_enabled),
    channelId: data.booster_channel_id ?? null,
    message: data.booster_message ?? null,
    useEmbed: Boolean(data.booster_use_embed),
    embedColor: (data.booster_embed_color as number | null) ?? null,
  };
}

export async function setWelcomeConfig(
  guildId: string,
  patch: Partial<{ enabled: boolean; channelId: string | null; message: string | null }>,
): Promise<void> {
  const db = getDb();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.enabled !== undefined) update.welcome_enabled = patch.enabled;
  if (patch.channelId !== undefined) update.welcome_channel_id = patch.channelId;
  if (patch.message !== undefined) update.welcome_message = patch.message;
  const { error } = await db.from('bot_guilds').update(update).eq('guild_id', guildId);
  if (error) throw error;
}

export async function getAutoRolesConfig(
  guildId: string,
): Promise<AutoRolesConfig> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_guilds')
    .select('auto_roles_enabled, auto_role_ids')
    .eq('guild_id', guildId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { enabled: false, roleIds: [] };
  const raw = (data.auto_role_ids ?? []) as unknown;
  const roleIds = Array.isArray(raw)
    ? (raw as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];
  return {
    enabled: Boolean(data.auto_roles_enabled),
    roleIds,
  };
}

export async function setAutoRolesConfig(
  guildId: string,
  patch: Partial<{ enabled: boolean; roleIds: string[] }>,
): Promise<void> {
  const db = getDb();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.enabled !== undefined) update.auto_roles_enabled = patch.enabled;
  if (patch.roleIds !== undefined) update.auto_role_ids = patch.roleIds;
  const { error } = await db.from('bot_guilds').update(update).eq('guild_id', guildId);
  if (error) throw error;
}

export async function getLogConfig(guildId: string): Promise<LogConfig> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_guilds')
    .select(
      'log_channel_id, log_joins, log_leaves, log_message_edits, log_message_deletes, log_role_changes',
    )
    .eq('guild_id', guildId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return {
      channelId: null,
      joins: false,
      leaves: false,
      messageEdits: false,
      messageDeletes: false,
      roleChanges: false,
    };
  }
  return {
    channelId: data.log_channel_id ?? null,
    joins: Boolean(data.log_joins),
    leaves: Boolean(data.log_leaves),
    messageEdits: Boolean(data.log_message_edits),
    messageDeletes: Boolean(data.log_message_deletes),
    roleChanges: Boolean(data.log_role_changes),
  };
}

export async function setLogConfig(
  guildId: string,
  patch: Partial<{
    channelId: string | null;
    joins: boolean;
    leaves: boolean;
    messageEdits: boolean;
    messageDeletes: boolean;
    roleChanges: boolean;
  }>,
): Promise<void> {
  const db = getDb();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.channelId !== undefined) update.log_channel_id = patch.channelId;
  if (patch.joins !== undefined) update.log_joins = patch.joins;
  if (patch.leaves !== undefined) update.log_leaves = patch.leaves;
  if (patch.messageEdits !== undefined) update.log_message_edits = patch.messageEdits;
  if (patch.messageDeletes !== undefined) update.log_message_deletes = patch.messageDeletes;
  if (patch.roleChanges !== undefined) update.log_role_changes = patch.roleChanges;
  const { error } = await db.from('bot_guilds').update(update).eq('guild_id', guildId);
  if (error) throw error;
}

export function renderWelcomeTemplate(
  template: string,
  ctx: { username: string; mention: string; serverName: string; memberCount: number },
): string {
  return template
    .replaceAll('{user}', ctx.username)
    .replaceAll('{mention}', ctx.mention)
    .replaceAll('{server}', ctx.serverName)
    .replaceAll('{members}', String(ctx.memberCount));
}
