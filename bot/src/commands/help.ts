import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../types.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Übersicht der Bot-Befehle'),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('Kanbanly Bot')
      .setDescription(
        'Der Discord-Bot für ernsthafte Communities — von [kanbanly.de](https://kanbanly.de).',
      )
      .addFields(
        { name: '/ping', value: 'Latenz prüfen' },
        { name: '/help', value: 'Diese Übersicht zeigen' },
      )
      .setColor(0x6366f1)
      .setFooter({ text: 'Mehr Features kommen bald.' });
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export default command;
