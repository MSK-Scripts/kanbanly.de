import { Events, type Client, type GuildMember, type TextChannel } from 'discord.js';
import { getBoosterConfig } from '../db/guilds.js';
import { sendStyled } from '../lib/sendStyled.js';

function renderTemplate(
  template: string,
  ctx: { username: string; mention: string; serverName: string; memberCount: number },
): string {
  return template
    .replaceAll('{user}', ctx.username)
    .replaceAll('{mention}', ctx.mention)
    .replaceAll('{server}', ctx.serverName)
    .replaceAll('{members}', String(ctx.memberCount));
}

export function registerBooster(client: Client): void {
  client.on(
    Events.GuildMemberUpdate,
    async (oldMember, newMember: GuildMember) => {
      try {
        // premiumSince changes from null → Date when user starts boosting.
        const wasBoosting = Boolean(oldMember.premiumSince);
        const isBoosting = Boolean(newMember.premiumSince);
        if (wasBoosting || !isBoosting) return;
        if (newMember.user.bot) return;

        const cfg = await getBoosterConfig(newMember.guild.id);
        if (!cfg || !cfg.enabled || !cfg.channelId || !cfg.message) return;

        const channel = await newMember.guild.channels
          .fetch(cfg.channelId)
          .catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const text = renderTemplate(cfg.message, {
          username: newMember.user.username,
          mention: `<@${newMember.id}>`,
          serverName: newMember.guild.name,
          memberCount: newMember.guild.memberCount,
        });

        await sendStyled(channel as TextChannel, text, {
          useEmbed: cfg.useEmbed,
          embedColor: cfg.embedColor,
          allowedMentions: { users: [newMember.id] },
        });
      } catch (err) {
        console.error('[booster] Fehler:', err);
      }
    },
  );
}
