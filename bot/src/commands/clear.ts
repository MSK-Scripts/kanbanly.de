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
  .setName('clear')
  .setDescription('Lösche die letzten N Nachrichten im aktuellen Channel.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false)
  .addIntegerOption((o) =>
    o
      .setName('count')
      .setDescription('Wie viele Nachrichten löschen? (1-100)')
      .setMinValue(1)
      .setMaxValue(100)
      .setRequired(true),
  )
  .addUserOption((o) =>
    o
      .setName('user')
      .setDescription('Optional: nur Nachrichten dieses Users löschen.'),
  );

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) {
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
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const count = interaction.options.getInteger('count', true);
  const filterUser = interaction.options.getUser('user');

  try {
    const fetched = await (channel as TextChannel).messages.fetch({
      limit: filterUser ? 100 : count,
    });
    const toDelete = filterUser
      ? fetched.filter((m) => m.author.id === filterUser.id).first(count)
      : Array.from(fetched.values());

    if (!toDelete || (Array.isArray(toDelete) && toDelete.length === 0)) {
      await interaction.editReply('Keine passenden Nachrichten gefunden.');
      return;
    }

    // bulkDelete kann nur Nachrichten unter 14 Tagen — Discord filtert das selbst.
    const ids = (Array.isArray(toDelete) ? toDelete : [toDelete]).map((m) => m.id);
    const deleted = await (channel as TextChannel).bulkDelete(ids, true);

    await interaction.editReply(
      `🧹 ${deleted.size} Nachricht${deleted.size === 1 ? '' : 'en'} gelöscht.${
        filterUser ? ` (Filter: <@${filterUser.id}>)` : ''
      }`,
    );
  } catch (err) {
    console.error('[clear]', err);
    await interaction.editReply(
      'Konnte nicht alle Nachrichten löschen. Discord erlaubt bulk-delete nur für Nachrichten unter 14 Tagen.',
    );
  }
}

const command: SlashCommand = { data, execute };
export default command;
