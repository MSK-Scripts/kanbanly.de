import { getDb } from '../db.js';

export type RoleBadge = {
  guildId: string;
  roleId: string;
  daysRequired: number;
};

export async function isRoleBadgesEnabled(guildId: string): Promise<boolean> {
  const db = getDb();
  const { data } = await db
    .from('bot_guilds')
    .select('role_badges_enabled')
    .eq('guild_id', guildId)
    .maybeSingle();
  return Boolean(data?.role_badges_enabled);
}

export async function listRoleBadges(guildId: string): Promise<RoleBadge[]> {
  const db = getDb();
  const { data, error } = await db
    .from('bot_role_badges')
    .select('guild_id, role_id, days_required')
    .eq('guild_id', guildId)
    .order('days_required', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    guildId: r.guild_id as string,
    roleId: r.role_id as string,
    daysRequired: r.days_required as number,
  }));
}
