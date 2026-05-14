import { type Client } from 'discord.js';
import { getDb } from '../db.js';
import { listRoleBadges } from '../db/roleBadges.js';

// Alle 6 Stunden checken
const CHECK_INTERVAL_MS = 6 * 60 * 60_000;

async function processGuild(client: Client, guildId: string): Promise<void> {
  const badges = await listRoleBadges(guildId);
  if (badges.length === 0) return;

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;

  const now = Date.now();
  const botMember = guild.members.me;
  const botTop = botMember?.roles.highest;

  // Member-Liste laden (cache).
  let members;
  try {
    members = await guild.members.fetch();
  } catch (err) {
    console.error('[roleBadge] members.fetch:', err);
    return;
  }

  let granted = 0;
  for (const member of members.values()) {
    if (member.user.bot) continue;
    if (!member.joinedTimestamp) continue;
    const daysJoined = (now - member.joinedTimestamp) / 86400_000;

    for (const badge of badges) {
      if (daysJoined < badge.daysRequired) continue;
      if (member.roles.cache.has(badge.roleId)) continue;
      // Hierarchie-Check
      if (botTop && botTop.comparePositionTo(badge.roleId) <= 0) continue;
      try {
        await member.roles.add(badge.roleId, `Rollen-Badge: ${badge.daysRequired}d`);
        granted += 1;
      } catch {
        // skip
      }
    }
  }
  if (granted > 0) {
    console.log(`[roleBadge] ${granted} Badges in ${guildId} vergeben`);
  }
}

async function tick(client: Client): Promise<void> {
  try {
    const db = getDb();
    const { data: guilds } = await db
      .from('bot_guilds')
      .select('guild_id')
      .eq('role_badges_enabled', true);
    for (const g of guilds ?? []) {
      await processGuild(client, g.guild_id as string).catch((err) =>
        console.error('[roleBadge] processGuild:', err),
      );
    }
  } catch (err) {
    console.error('[roleBadge/scheduler]', err);
  }
}

export function startRoleBadgeScheduler(client: Client): void {
  setTimeout(() => {
    tick(client).catch(() => {});
    setInterval(() => tick(client).catch(() => {}), CHECK_INTERVAL_MS);
  }, 120_000);
  console.log('[roleBadge/scheduler] gestartet — Tick alle 6h');
}
