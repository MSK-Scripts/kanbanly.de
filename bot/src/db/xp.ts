import { getDb } from '../db.js';

// MEE6-style XP curve: xp_to_next(level) = 5 * level^2 + 50 * level + 100
// Total XP to reach level L (sum from 0..L-1).
export function xpToReachLevel(level: number): number {
  let total = 0;
  for (let l = 0; l < level; l++) {
    total += 5 * l * l + 50 * l + 100;
  }
  return total;
}

export function levelFromXp(xp: number): number {
  let level = 0;
  while (xpToReachLevel(level + 1) <= xp) level++;
  return level;
}

// Cooldown zwischen XP-Drops pro User & Guild (in Sek).
export const XP_COOLDOWN_SECONDS = 60;
// Pro qualifizierender Message zufällig 15-25 XP (klassisch).
export function rollXp(): number {
  return 15 + Math.floor(Math.random() * 11);
}

export type XpRow = {
  guildId: string;
  userId: string;
  xp: number;
  level: number;
  lastMessageAt: string | null;
};

type XpRowDb = {
  guild_id: string;
  user_id: string;
  xp: number;
  level: number;
  last_message_at: string | null;
};

function map(r: XpRowDb): XpRow {
  return {
    guildId: r.guild_id,
    userId: r.user_id,
    xp: r.xp,
    level: r.level,
    lastMessageAt: r.last_message_at,
  };
}

export async function getXp(guildId: string, userId: string): Promise<XpRow | null> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_xp')
    .select('guild_id, user_id, xp, level, last_message_at')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? map(data as XpRowDb) : null;
}

/**
 * Add XP (respektiert Cooldown). Returns null if cooldown active, oder die
 * neue Row inkl. Info ob ein Level-Up stattfand.
 */
export async function addXpWithCooldown(
  guildId: string,
  userId: string,
): Promise<{ row: XpRow; leveledUp: boolean; oldLevel: number } | null> {
  const existing = await getXp(guildId, userId);
  const now = Date.now();
  if (existing?.lastMessageAt) {
    const last = new Date(existing.lastMessageAt).getTime();
    if (now - last < XP_COOLDOWN_SECONDS * 1000) return null;
  }
  const gained = rollXp();
  const oldXp = existing?.xp ?? 0;
  const newXp = oldXp + gained;
  const oldLevel = existing?.level ?? 0;
  const newLevel = levelFromXp(newXp);

  const db = getDb();
  const { data, error } = await db
    .from('bot_xp')
    .upsert(
      {
        guild_id: guildId,
        user_id: userId,
        xp: newXp,
        level: newLevel,
        last_message_at: new Date(now).toISOString(),
      },
      { onConflict: 'guild_id,user_id' },
    )
    .select('guild_id, user_id, xp, level, last_message_at')
    .single();
  if (error || !data) throw error ?? new Error('Upsert lieferte keine Daten.');
  return {
    row: map(data as XpRowDb),
    leveledUp: newLevel > oldLevel,
    oldLevel,
  };
}

export async function getLeaderboard(
  guildId: string,
  limit = 10,
): Promise<XpRow[]> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_xp')
    .select('guild_id, user_id, xp, level, last_message_at')
    .eq('guild_id', guildId)
    .order('xp', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => map(r as XpRowDb));
}

export async function getRank(
  guildId: string,
  userId: string,
): Promise<{ rank: number; row: XpRow } | null> {
  const row = await getXp(guildId, userId);
  if (!row) return null;
  const db = getDb();
  const { count, error } = await db
    .from('bot_xp')
    .select('user_id', { count: 'exact', head: true })
    .eq('guild_id', guildId)
    .gt('xp', row.xp);
  if (error) throw error;
  return { rank: (count ?? 0) + 1, row };
}

export async function getLevelRewards(
  guildId: string,
): Promise<Array<{ level: number; roleId: string }>> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_level_rewards')
    .select('level, role_id')
    .eq('guild_id', guildId)
    .order('level');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    level: r.level as number,
    roleId: r.role_id as string,
  }));
}

export async function addLevelReward(
  guildId: string,
  level: number,
  roleId: string,
): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('bot_level_rewards')
    .upsert(
      { guild_id: guildId, level, role_id: roleId },
      { onConflict: 'guild_id,level' },
    );
  if (error) throw error;
}

export async function removeLevelReward(
  guildId: string,
  level: number,
): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('bot_level_rewards')
    .delete()
    .eq('guild_id', guildId)
    .eq('level', level);
  if (error) throw error;
}

export type LevelConfig = {
  enabled: boolean;
  announce: boolean;
  upChannelId: string | null;
  useEmbed: boolean;
  embedColor: number | null;
};

export async function getLevelConfig(guildId: string): Promise<LevelConfig> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_guilds')
    .select(
      'level_enabled, level_announce, level_up_channel_id, level_use_embed, level_embed_color',
    )
    .eq('guild_id', guildId)
    .maybeSingle();
  if (error) throw error;
  if (!data)
    return {
      enabled: false,
      announce: true,
      upChannelId: null,
      useEmbed: false,
      embedColor: null,
    };
  return {
    enabled: Boolean(data.level_enabled),
    announce: Boolean(data.level_announce),
    upChannelId: data.level_up_channel_id ?? null,
    useEmbed: Boolean(data.level_use_embed),
    embedColor: (data.level_embed_color as number | null) ?? null,
  };
}

export async function setLevelConfig(
  guildId: string,
  patch: Partial<{
    enabled: boolean;
    announce: boolean;
    upChannelId: string | null;
  }>,
): Promise<void> {
  const db = getDb();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.enabled !== undefined) update.level_enabled = patch.enabled;
  if (patch.announce !== undefined) update.level_announce = patch.announce;
  if (patch.upChannelId !== undefined) update.level_up_channel_id = patch.upChannelId;
  const { error } = await db.from('bot_guilds').update(update).eq('guild_id', guildId);
  if (error) throw error;
}
