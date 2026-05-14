import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { SlashCommand } from '../types.js';
import { ensureGuild } from '../db/guilds.js';
import { getSuggestionConfig } from '../db/suggestions.js';

const data = new SlashCommandBuilder()
  .setName('suggest')
  .setDescription('Reiche einen Vorschlag ein.')
  .setDMPermission(false);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({
      content: 'Nur in Servern verwendbar.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await ensureGuild(interaction.guild);
  const cfg = await getSuggestionConfig(interaction.guild.id);
  if (!cfg.enabled || !cfg.channelId) {
    await interaction.reply({
      content: 'Vorschläge sind auf diesem Server nicht aktiv.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId('sug:modal')
    .setTitle('Vorschlag einreichen');

  const input = new TextInputBuilder()
    .setCustomId('content')
    .setLabel('Dein Vorschlag')
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(10)
    .setMaxLength(1500)
    .setPlaceholder('Beschreibe deinen Vorschlag…')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(input),
  );
  await interaction.showModal(modal);
}

const command: SlashCommand = { data, execute };
export default command;
