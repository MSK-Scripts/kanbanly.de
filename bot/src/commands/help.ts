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
            '`/ping` · Latenz\n`/help` · diese Übersicht\n`/welcome` · Welcome-Messages\n`/reactionroles` · Self-Service-Rollen',
        },
        {
          name: '⚒️ Moderation',
          value:
            '`/warn add|list|clear` · Warnungen\n`/timeout` · stummschalten\n`/kick` · vom Server entfernen\n`/ban` · permanent bannen\n`/clear` · Nachrichten löschen',
        },
        {
          name: '🏆 Engagement',
          value:
            '`/rank` · dein Level\n`/leaderboard` · Top 10\n`/poll` · native Discord-Umfrage',
        },
        {
          name: '💬 Community',
          value:
            '`/tag show|list|add|edit|remove` · FAQ-Antworten\n`/customcmd add|remove|list|prefix` · eigene Prefix-Commands',
        },
        {
          name: '🌐 Dashboard',
          value:
            'Web öffnen: [kanbanly.de/integrations/discord](https://kanbanly.de/integrations/discord)\nDort: AutoMod, Logging, Auto-Roles, Welcome, Levels & mehr konfigurieren.',
        },
      )
      .setColor(0x6366f1)
      .setFooter({ text: 'kanbanly.de · Discord-Bot' });
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export default command;
