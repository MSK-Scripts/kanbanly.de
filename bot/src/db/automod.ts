import { getDb } from '../db.js';

export type AutoModConfig = {
  enabled: boolean;
  blockLinks: boolean;
  linkAllowlist: string[];
  maxCapsPct: number | null;
  maxMentions: number | null;
  bannedWords: string[];
  ignoredRoleIds: string[];
  ignoredChannelIds: string[];
};

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

export async function getAutoModConfig(guildId: string): Promise<AutoModConfig> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_guilds')
    .select(
      'automod_enabled, automod_block_links, automod_link_allowlist, automod_max_caps_pct, automod_max_mentions, automod_banned_words, automod_ignored_role_ids, automod_ignored_channel_ids',
    )
    .eq('guild_id', guildId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return {
      enabled: false,
      blockLinks: false,
      linkAllowlist: [],
      maxCapsPct: null,
      maxMentions: null,
      bannedWords: [],
      ignoredRoleIds: [],
      ignoredChannelIds: [],
    };
  }
  return {
    enabled: Boolean(data.automod_enabled),
    blockLinks: Boolean(data.automod_block_links),
    linkAllowlist: asStringArray(data.automod_link_allowlist),
    maxCapsPct: (data.automod_max_caps_pct as number | null) ?? null,
    maxMentions: (data.automod_max_mentions as number | null) ?? null,
    bannedWords: asStringArray(data.automod_banned_words),
    ignoredRoleIds: asStringArray(data.automod_ignored_role_ids),
    ignoredChannelIds: asStringArray(data.automod_ignored_channel_ids),
  };
}

export async function setAutoModConfig(
  guildId: string,
  patch: Partial<AutoModConfig>,
): Promise<void> {
  const db = getDb();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.enabled !== undefined) update.automod_enabled = patch.enabled;
  if (patch.blockLinks !== undefined) update.automod_block_links = patch.blockLinks;
  if (patch.linkAllowlist !== undefined)
    update.automod_link_allowlist = patch.linkAllowlist;
  if (patch.maxCapsPct !== undefined) update.automod_max_caps_pct = patch.maxCapsPct;
  if (patch.maxMentions !== undefined) update.automod_max_mentions = patch.maxMentions;
  if (patch.bannedWords !== undefined) update.automod_banned_words = patch.bannedWords;
  if (patch.ignoredRoleIds !== undefined)
    update.automod_ignored_role_ids = patch.ignoredRoleIds;
  if (patch.ignoredChannelIds !== undefined)
    update.automod_ignored_channel_ids = patch.ignoredChannelIds;
  const { error } = await db.from('bot_guilds').update(update).eq('guild_id', guildId);
  if (error) throw error;
}
