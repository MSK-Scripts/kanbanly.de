import { Events, type Client, type GuildMember, type TextChannel } from 'discord.js';
import {
  ensureGuild,
  getAutoRolesConfig,
  getWelcomeConfig,
  renderWelcomeTemplate,
} from '../db/guilds.js';

async function applyAutoRoles(member: GuildMember): Promise<void> {
  try {
    const cfg = await getAutoRolesConfig(member.guild.id);
    if (!cfg.enabled || cfg.roleIds.length === 0) return;

    const botMember = member.guild.members.me;
    const botTop = botMember?.roles.highest;

    for (const roleId of cfg.roleIds) {
      const role = await member.guild.roles.fetch(roleId).catch(() => null);
      if (!role) continue;
      if (botTop && botTop.comparePositionTo(role.id) <= 0) {
        console.warn(
          `[autorole] Rolle ${role.name} liegt über meiner — übersprungen.`,
        );
        continue;
      }
      await member.roles.add(role, 'Auto-Role beim Join').catch((err) => {
        console.error(`[autorole] Konnte ${role.name} nicht vergeben:`, err);
      });
    }
  } catch (err) {
    console.error('[autorole] Fehler:', err);
  }
}

async function sendWelcome(member: GuildMember): Promise<void> {
  try {
    const cfg = await getWelcomeConfig(member.guild.id);
    if (!cfg) return;

    const tplCtx = {
      username: member.user.username,
      mention: `<@${member.id}>`,
      serverName: member.guild.name,
      memberCount: member.guild.memberCount,
    };

    if (cfg.enabled && cfg.channelId && cfg.message) {
      const channel = await member.guild.channels.fetch(cfg.channelId).catch(() => null);
      if (channel && channel.isTextBased()) {
        const text = renderWelcomeTemplate(cfg.message, tplCtx);
        await (channel as TextChannel)
          .send({
            content: text,
            allowedMentions: { users: [member.id] },
          })
          .catch((err) => console.error('[welcome] channel-send:', err));
      }
    }

    if (cfg.dmEnabled && cfg.dmMessage) {
      const dmText = renderWelcomeTemplate(cfg.dmMessage, tplCtx);
      // DMs können fehlschlagen, wenn der User sie blockiert hat — schlucken.
      await member.send({ content: dmText }).catch(() => {});
    }
  } catch (err) {
    console.error('[welcome] Fehler beim Begrüßen:', err);
  }
}

export function registerGuildMemberAdd(client: Client): void {
  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    if (member.user.bot) return;
    await ensureGuild(member.guild).catch((err) =>
      console.error('[guildMemberAdd] ensureGuild:', err),
    );
    await Promise.all([applyAutoRoles(member), sendWelcome(member)]);
  });
}
