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
        {
          name: '🛠️ Allgemein',
          value:
            '`/ping` · Latenz\n`/help` · diese Übersicht\n`/welcome` · Welcome-Messages konfigurieren\n`/reactionroles` · Self-Service-Rollen',
        },
        {
          name: '⚒️ Moderation',
          value:
            '`/warn add|list|clear` · Warnungen\n`/timeout` · User stummschalten\n`/kick` · vom Server entfernen\n`/ban` · permanent bannen\n`/clear` · Nachrichten löschen',
        },
        {
          name: '🌐 Dashboard',
          value:
            'Webseite öffnen: [kanbanly.de/integrations/discord](https://kanbanly.de/integrations/discord)',
        },
      )
      .setColor(0x6366f1)
      .setFooter({ text: 'Mehr Features (Leveling, Logs, AutoMod) sind in Arbeit.' });
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export default command;
