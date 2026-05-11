import { Events, type Client, type GuildMember, type TextChannel } from 'discord.js';
import { ensureGuild, getWelcomeConfig, renderWelcomeTemplate } from '../db/guilds.js';

export function registerGuildMemberAdd(client: Client): void {
  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    try {
      if (member.user.bot) return;
      await ensureGuild(member.guild);
      const cfg = await getWelcomeConfig(member.guild.id);
      if (!cfg || !cfg.enabled || !cfg.channelId || !cfg.message) return;
      const channel = await member.guild.channels.fetch(cfg.channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) return;
      const text = renderWelcomeTemplate(cfg.message, {
        username: member.user.username,
        mention: `<@${member.id}>`,
        serverName: member.guild.name,
        memberCount: member.guild.memberCount,
      });
      await (channel as TextChannel).send({
        content: text,
        allowedMentions: { users: [member.id] },
      });
    } catch (err) {
      console.error('[welcome] Fehler beim Begrüßen:', err);
    }
  });
}
