import {
  EmbedBuilder,
  Events,
  PermissionFlagsBits,
  type Client,
  type GuildMember,
  type TextChannel,
} from 'discord.js';
import { getAntiRaidConfig } from '../db/antiraid.js';

// Rolling Window pro Guild: Liste von Join-Timestamps der letzten X Sekunden.
const joinHistory = new Map<string, number[]>();
// Cooldown nach Trigger: 60s pro Guild, damit nicht jeder Join nochmal Anti-Raid feuert.
const triggerCooldown = new Map<string, number>();
const TRIGGER_COOLDOWN_MS = 60_000;

async function notifyChannel(
  guild: GuildMember['guild'],
  channelId: string | null,
  title: string,
  description: string,
  color: number,
): Promise<void> {
  if (!channelId) return;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
  await (channel as TextChannel).send({ embeds: [embed] }).catch(() => {});
}

async function applyAction(
  member: GuildMember,
  cfg: NonNullable<Awaited<ReturnType<typeof getAntiRaidConfig>>>,
  recentMembers: GuildMember[],
): Promise<void> {
  const guildId = member.guild.id;
  const now = Date.now();
  const cooldown = triggerCooldown.get(guildId) ?? 0;
  if (cooldown > now) return;
  triggerCooldown.set(guildId, now + TRIGGER_COOLDOWN_MS);

  const userList = recentMembers
    .slice(0, 10)
    .map((m) => `• <@${m.id}> (\`${m.user.tag}\`)`)
    .join('\n');

  if (cfg.action === 'alert') {
    await notifyChannel(
      member.guild,
      cfg.alertChannelId,
      '🚨 Anti-Raid: Burst erkannt',
      `**${recentMembers.length}** Joins in **${cfg.joinWindowSec}s** — kann ein Raid sein.\n\nLetzte Beitritte:\n${userList}`,
      0xf59e0b,
    );
    return;
  }

  if (cfg.action === 'kick') {
    let kicked = 0;
    for (const m of recentMembers) {
      if (m.user.bot) continue;
      try {
        await m.kick('Anti-Raid: Burst-Join');
        kicked += 1;
      } catch {
        // continue
      }
    }
    await notifyChannel(
      member.guild,
      cfg.alertChannelId,
      '🚨 Anti-Raid: Member gekickt',
      `**${kicked} / ${recentMembers.length}** verdächtige Member wurden gekickt.`,
      0xef4444,
    );
    return;
  }

  if (cfg.action === 'lockdown') {
    // Lockdown: alle Text-Channels für @everyone temporär auf 'SendMessages: false' setzen
    // ist gefährlich (kann eigene Kanäle blocken) — wir loggen nur warnung in Alert-Channel.
    await notifyChannel(
      member.guild,
      cfg.alertChannelId,
      '🚨 Anti-Raid: LOCKDOWN-Hinweis',
      `**${recentMembers.length}** Joins in **${cfg.joinWindowSec}s**.\nLockdown ist ein Beta-Feature — bitte manuell prüfen.\n\nLetzte Beitritte:\n${userList}`,
      0xdc2626,
    );
  }
}

export function registerAntiRaid(client: Client): void {
  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    try {
      const cfg = await getAntiRaidConfig(member.guild.id);
      if (!cfg || !cfg.enabled) return;

      // Hat der Bot überhaupt die Permission zum Kicken?
      if (cfg.action === 'kick') {
        const botMember = member.guild.members.me;
        if (!botMember?.permissions.has(PermissionFlagsBits.KickMembers)) {
          console.warn(`[antiraid] Bot fehlt KickMembers in ${member.guild.id}`);
        }
      }

      const now = Date.now();
      const windowMs = cfg.joinWindowSec * 1000;
      const hist = joinHistory.get(member.guild.id) ?? [];
      const recent = hist.filter((t) => t > now - windowMs);
      recent.push(now);
      joinHistory.set(member.guild.id, recent);

      if (recent.length < cfg.joinThreshold) return;

      // Letzte N Member aus dem Window holen (Cache).
      const guildMembers = member.guild.members.cache;
      const cutoff = new Date(now - windowMs);
      const recentMembers = Array.from(guildMembers.values())
        .filter((m) => m.joinedAt && m.joinedAt >= cutoff && !m.user.bot)
        .sort(
          (a, b) =>
            (b.joinedAt?.getTime() ?? 0) - (a.joinedAt?.getTime() ?? 0),
        );

      await applyAction(member, cfg, recentMembers);
    } catch (err) {
      console.error('[antiraid]', err);
    }
  });
}
