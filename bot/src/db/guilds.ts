import type { Guild } from 'discord.js';
import { getDb } from '../db.js';

export type WelcomeConfig = {
  enabled: boolean;
  channelId: string | null;
  message: string | null;
};

export type AutoRolesConfig = {
  enabled: boolean;
  roleIds: string[];
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
    .select('welcome_enabled, welcome_channel_id, welcome_message')
    .eq('guild_id', guildId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    enabled: data.welcome_enabled,
    channelId: data.welcome_channel_id,
    message: data.welcome_message,
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
