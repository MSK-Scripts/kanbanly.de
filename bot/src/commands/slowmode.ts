import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type TextChannel,
} from 'discord.js';
import type { SlashCommand } from '../types.js';

const data = new SlashCommandBuilder()
  .setName('slowmode')
  .setDescription('Setze den Slowmode im aktuellen Channel (in Sekunden).')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .setDMPermission(false)
  .addIntegerOption((o) =>
    o
      .setName('seconds')
      .setDescription('0 = aus, max 21600 (6 Stunden).')
      .setMinValue(0)
      .setMaxValue(21600)
      .setRequired(true),
  );

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: 'Nur in Servern verwendbar.', flags: MessageFlags.Ephemeral });
    return;
  }
  const channel = interaction.channel;
  if (
    !channel ||
    (channel.type !== ChannelType.GuildText &&
      channel.type !== ChannelType.GuildAnnouncement)
  ) {
    await interaction.reply({
      content: 'Nur in Text-Channels verwendbar.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const seconds = interaction.options.getInteger('seconds', true);
  try {
    await (channel as TextChannel).setRateLimitPerUser(
      seconds,
      `Slowmode via /slowmode durch ${interaction.user.tag}`,
    );
    await interaction.reply({
      content:
        seconds === 0
          ? '🐢 Slowmode deaktiviert.'
          : `🐢 Slowmode auf **${seconds}s** gesetzt.`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (err) {
    console.error('[slowmode]', err);
    await interaction.reply({
      content: 'Konnte Slowmode nicht setzen. Hat der Bot die Permission „Channel verwalten"?',
      flags: MessageFlags.Ephemeral,
    });
  }
}

const command: SlashCommand = { data, execute };
export default command;
