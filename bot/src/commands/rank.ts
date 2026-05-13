import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types.js';
import { getRank, xpToReachLevel } from '../db/xp.js';

const data = new SlashCommandBuilder()
  .setName('rank')
  .setDescription('Zeig deinen oder eines anderen Users Rang & Level.')
  .setDMPermission(false)
  .addUserOption((o) =>
    o.setName('user').setDescription('Wessen Rang? (default: du)'),
  );

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: 'Nur in Servern verwendbar.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply();

  const target = interaction.options.getUser('user') ?? interaction.user;
  const result = await getRank(interaction.guild.id, target.id);
  if (!result) {
    await interaction.editReply(
      target.id === interaction.user.id
        ? 'Du hast noch keine XP gesammelt. Schreib was im Server!'
        : `${target.username} hat noch keine XP.`,
    );
    return;
  }

  const { rank, row } = result;
  const nextLevelXp = xpToReachLevel(row.level + 1);
  const currentLevelXp = xpToReachLevel(row.level);
  const progress = row.xp - currentLevelXp;
  const needed = nextLevelXp - currentLevelXp;
  const pct = Math.min(100, Math.round((progress / needed) * 100));
  const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));

  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${target.username}'s Rang`,
      iconURL: target.displayAvatarURL(),
    })
    .setColor(0x8b5cf6)
    .addFields(
      { name: 'Level', value: `**${row.level}**`, inline: true },
      { name: 'Rang', value: `#${rank}`, inline: true },
      { name: 'Gesamt-XP', value: row.xp.toLocaleString('de-DE'), inline: true },
      {
        name: `Fortschritt zu Level ${row.level + 1}`,
        value: `\`${bar}\` ${pct}%\n${progress.toLocaleString('de-DE')} / ${needed.toLocaleString('de-DE')} XP`,
      },
    );
  await interaction.editReply({ embeds: [embed] });
}

const command: SlashCommand = { data, execute };
export default command;
