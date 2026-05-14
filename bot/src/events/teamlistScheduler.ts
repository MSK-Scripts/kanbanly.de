import {
  EmbedBuilder,
  type Client,
  type Guild,
  type TextChannel,
} from 'discord.js';
import { getDb } from '../db.js';

const TICK_MS = 30 * 60_000;

async function buildEmbed(
  guild: Guild,
  roleIds: string[],
  title: string,
  color: number | null,
): Promise<EmbedBuilder> {
  // Members fetch.
  await guild.members.fetch().catch(() => {});
  // Roles in absteigender Position holen.
  const roles = roleIds
    .map((id) => guild.roles.cache.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .sort((a, b) => b.position - a.position);

  const lines: string[] = [];
  for (const role of roles) {
    const members = guild.members.cache
      .filter((m) => m.roles.cache.has(role.id) && !m.user.bot)
      .sort((a, b) =>
        (a.displayName ?? '').localeCompare(b.displayName ?? ''),
      );
    lines.push(`**${role.name}** · ${members.size}`);
    if (members.size === 0) {
      lines.push('_— niemand —_');
    } else {
      for (const m of members.values()) {
        lines.push(`• <@${m.id}>`);
      }
    }
    lines.push('');
  }
  const description = lines.join('\n').slice(0, 4000) || '_Keine Rollen konfiguriert._';
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
  if (typeof color === 'number') embed.setColor(color);
  return embed;
}

async function refreshTeamlist(
  client: Client,
  row: {
    id: string;
    guild_id: string;
    channel_id: string;
    message_id: string | null;
    title: string;
    role_ids: unknown;
    color: number | null;
  },
): Promise<void> {
  const roleIds = Array.isArray(row.role_ids)
    ? (row.role_ids as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];
  const guild = await client.guilds.fetch(row.guild_id).catch(() => null);
  if (!guild) return;
  const channel = (await guild.channels.fetch(row.channel_id).catch(() => null)) as
    | TextChannel
    | null;
  if (!channel?.isTextBased()) return;

  const embed = await buildEmbed(guild, roleIds, row.title, row.color);
  const db = getDb();
  if (row.message_id) {
    const msg = await channel.messages.fetch(row.message_id).catch(() => null);
    if (msg) {
      await msg.edit({ embeds: [embed] }).catch(() => {});
      await db
        .from('bot_teamlists')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', row.id);
      return;
    }
  }
  const sent = await channel.send({ embeds: [embed] }).catch(() => null);
  if (sent) {
    await db
      .from('bot_teamlists')
      .update({
        message_id: sent.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
  }
}

async function tick(client: Client): Promise<void> {
  try {
    const db = getDb();
    const { data } = await db
      .from('bot_teamlists')
      .select('id, guild_id, channel_id, message_id, title, role_ids, color');
    for (const row of data ?? []) {
      await refreshTeamlist(client, {
        id: row.id as string,
        guild_id: row.guild_id as string,
        channel_id: row.channel_id as string,
        message_id: (row.message_id as string | null) ?? null,
        title: (row.title as string | null) ?? 'Team',
        role_ids: row.role_ids,
        color: (row.color as number | null) ?? null,
      }).catch((err) => console.error('[teamlist]', err));
    }
  } catch (err) {
    console.error('[teamlist] tick:', err);
  }
}

export function startTeamlistScheduler(client: Client): void {
  setTimeout(() => {
    tick(client).catch(() => {});
    setInterval(() => tick(client).catch(() => {}), TICK_MS);
  }, 120_000);
  console.log('[teamlist] gestartet — Tick alle 30 Min');
}

export async function refreshTeamlistNow(
  client: Client,
  teamlistId: string,
): Promise<void> {
  const db = getDb();
  const { data: row } = await db
    .from('bot_teamlists')
    .select('id, guild_id, channel_id, message_id, title, role_ids, color')
    .eq('id', teamlistId)
    .maybeSingle();
  if (!row) return;
  await refreshTeamlist(client, {
    id: row.id as string,
    guild_id: row.guild_id as string,
    channel_id: row.channel_id as string,
    message_id: (row.message_id as string | null) ?? null,
    title: (row.title as string | null) ?? 'Team',
    role_ids: row.role_ids,
    color: (row.color as number | null) ?? null,
  });
}
