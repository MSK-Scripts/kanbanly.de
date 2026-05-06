import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../types.js';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Zeigt die Latenz des Bots'),
  async execute(interaction) {
    await interaction.reply({ content: 'Pinge…', flags: MessageFlags.Ephemeral });
    const sent = await interaction.fetchReply();
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply(
      `Pong! Round-Trip ${latency}ms · WebSocket ${interaction.client.ws.ping}ms`,
    );
  },
};

export default command;
