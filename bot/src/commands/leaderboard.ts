import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types.js';
import { getLeaderboard } from '../db/xp.js';

const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Die Top 10 nach XP auf diesem Server.')
  .setDMPermission(false);

const MEDALS = ['🥇', '🥈', '🥉'];

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: 'Nur in Servern verwendbar.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply();

  const rows = await getLeaderboard(interaction.guild.id, 10);
  if (rows.length === 0) {
    await interaction.editReply('Noch keine XP-Aktivität auf diesem Server.');
    return;
  }

  const lines = rows.map((r, i) => {
    const prefix = MEDALS[i] ?? `**${i + 1}.**`;
    return `${prefix} <@${r.userId}> · Level **${r.level}** · ${r.xp.toLocaleString('de-DE')} XP`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`🏆 Leaderboard — ${interaction.guild.name}`)
    .setDescription(lines.join('\n'))
    .setColor(0x8b5cf6);
  await interaction.editReply({ embeds: [embed] });
}

const command: SlashCommand = { data, execute };
export default command;
