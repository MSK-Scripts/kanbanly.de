import {
  EmbedBuilder,
  type Guild,
  type GuildMember,
  type Role,
  type TextChannel,
} from 'discord.js';
import { getLogConfig } from '../db/guilds.js';

export async function logRoleAction(
  guild: Guild,
  member: GuildMember,
  role: Role,
  action: 'add' | 'remove',
  source: 'reaction' | 'button' | 'select',
): Promise<void> {
  try {
    const cfg = await getLogConfig(guild.id);
    if (!cfg.channelId || !cfg.roleChanges) return;
    const channel = await guild.channels.fetch(cfg.channelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    const embed = new EmbedBuilder()
      .setColor(action === 'add' ? 0x22c55e : 0xef4444)
      .setAuthor({
        name: `${member.user.tag} (${member.id})`,
        iconURL: member.user.displayAvatarURL(),
      })
      .setDescription(
        `${action === 'add' ? '➕' : '➖'} **${role.name}** ${
          action === 'add' ? 'erhalten' : 'verloren'
        } via ${source === 'reaction' ? 'Reaction' : source === 'button' ? 'Button' : 'Select-Menu'}`,
      )
      .setTimestamp();
    await (channel as TextChannel).send({ embeds: [embed] }).catch(() => {});
  } catch (err) {
    console.error('[rr-log]', err);
  }
}
