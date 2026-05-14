import {
  ChannelType,
  Events,
  type Client,
  type Message,
  type TextChannel,
} from 'discord.js';
import {
  addXpWithCooldown,
  getLevelConfig,
  getLevelRewards,
} from '../db/xp.js';
import { sendStyled } from '../lib/sendStyled.js';

async function applyLevelRewards(
  message: Message,
  level: number,
): Promise<void> {
  if (!message.guild || !message.member) return;
  const rewards = await getLevelRewards(message.guild.id);
  const reached = rewards.filter((r) => r.level <= level);
  if (reached.length === 0) return;

  const botTop = message.guild.members.me?.roles.highest;
  for (const r of reached) {
    if (message.member.roles.cache.has(r.roleId)) continue;
    const role = await message.guild.roles.fetch(r.roleId).catch(() => null);
    if (!role) continue;
    if (botTop && botTop.comparePositionTo(role.id) <= 0) continue;
    await message.member.roles
      .add(role, `Level-Reward für Level ${r.level}`)
      .catch((err) => {
        console.error(`[xp] reward role add failed:`, err);
      });
  }
}

async function announceLevelUp(
  message: Message,
  newLevel: number,
  upChannelId: string | null,
  useEmbed: boolean,
  embedColor: number | null,
): Promise<void> {
  if (!message.guild) return;
  let channel: TextChannel | null = null;
  if (upChannelId) {
    const ch = await message.guild.channels.fetch(upChannelId).catch(() => null);
    if (
      ch &&
      (ch.type === ChannelType.GuildText ||
        ch.type === ChannelType.GuildAnnouncement)
    ) {
      channel = ch as TextChannel;
    }
  } else if (
    message.channel.type === ChannelType.GuildText ||
    message.channel.type === ChannelType.GuildAnnouncement
  ) {
    channel = message.channel as TextChannel;
  }
  if (!channel) return;
  const text = `🎉 <@${message.author.id}>, Level **${newLevel}** erreicht!`;
  await sendStyled(channel, text, {
    useEmbed,
    embedColor,
    embedTitle: useEmbed ? `Level ${newLevel}` : null,
    allowedMentions: { users: [message.author.id] },
  }).catch(() => {});
}

export function registerXp(client: Client): void {
  client.on(Events.MessageCreate, async (message: Message) => {
    try {
      if (message.author.bot) return;
      if (!message.guild) return;
      if (message.system) return;
      // Slash-Commands und kürzeste Nachrichten ignorieren.
      if (message.content.trim().length < 2) return;

      const cfg = await getLevelConfig(message.guild.id);
      if (!cfg.enabled) return;

      const result = await addXpWithCooldown(message.guild.id, message.author.id);
      if (!result) return; // Cooldown.

      if (result.leveledUp) {
        if (cfg.announce) {
          await announceLevelUp(
            message,
            result.row.level,
            cfg.upChannelId,
            cfg.useEmbed,
            cfg.embedColor,
          );
        }
        await applyLevelRewards(message, result.row.level);
      }
    } catch (err) {
      console.error('[xp] messageCreate:', err);
    }
  });
}
