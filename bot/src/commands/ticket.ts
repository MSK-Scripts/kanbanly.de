import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type TextChannel,
} from 'discord.js';
import type { SlashCommand } from '../types.js';
import { ensureGuild } from '../db/guilds.js';
import {
  closeTicket,
  createPanel,
  deletePanel,
  getTicketByChannel,
  listPanelsForGuild,
} from '../db/tickets.js';

export const TICKET_OPEN_BUTTON_PREFIX = 'ticket-open:';
export const TICKET_CLOSE_BUTTON_PREFIX = 'ticket-close:';

const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Support-Ticket-System verwalten.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .setDMPermission(false)
  .addSubcommandGroup((g) =>
    g
      .setName('panel')
      .setDescription('Ticket-Panels (Button zum Öffnen) verwalten.')
      .addSubcommand((s) =>
        s
          .setName('create')
          .setDescription('Neues Panel posten.')
          .addChannelOption((o) =>
            o
              .setName('channel')
              .setDescription('Wo soll das Panel angezeigt werden?')
              .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
              .setRequired(true),
          )
          .addRoleOption((o) =>
            o
              .setName('staff_role')
              .setDescription('Rolle, die alle Tickets sehen darf.')
              .setRequired(true),
          )
          .addChannelOption((o) =>
            o
              .setName('category')
              .setDescription('Kategorie für neue Ticket-Channels (optional).')
              .addChannelTypes(ChannelType.GuildCategory),
          )
          .addStringOption((o) =>
            o
              .setName('title')
              .setDescription('Panel-Titel (default „Support öffnen").')
              .setMaxLength(100),
          )
          .addStringOption((o) =>
            o
              .setName('description')
              .setDescription('Beschreibung im Panel.')
              .setMaxLength(1000),
          ),
      )
      .addSubcommand((s) => s.setName('list').setDescription('Alle Panels listen.')),
  )
  .addSubcommand((s) =>
    s
      .setName('close')
      .setDescription('Aktuellen Ticket-Channel schließen.')
      .addStringOption((o) =>
        o.setName('reason').setDescription('Grund (optional).').setMaxLength(500),
      ),
  );

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: 'Nur in Servern verwendbar.', flags: MessageFlags.Ephemeral });
    return;
  }
  await ensureGuild(interaction.guild);

  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand(true);

  // ─── /ticket panel create ─────────────────────────────────────
  if (group === 'panel' && sub === 'create') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = interaction.options.getChannel('channel', true) as TextChannel;
    const staffRole = interaction.options.getRole('staff_role', true);
    const category = interaction.options.getChannel('category');
    const title =
      interaction.options.getString('title') ?? '🎫 Support öffnen';
    const description =
      interaction.options.getString('description') ??
      'Klick den Button unten, um ein privates Ticket zu eröffnen. Nur du und das Staff-Team sehen es.';

    const target = await interaction.guild.channels.fetch(channel.id).catch(() => null);
    if (!target || !target.isTextBased()) {
      await interaction.editReply('Channel konnte nicht geladen werden.');
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(0x6366f1);

    // Wir posten zuerst die Message und verwenden ihre ID als Panel-PK +
    // im Button-Custom-ID, damit wir später wissen welches Panel.
    const sent = await (target as TextChannel).send({ embeds: [embed] });

    const panel = await createPanel({
      guildId: interaction.guild.id,
      channelId: channel.id,
      messageId: sent.id,
      staffRoleId: staffRole.id,
      categoryId: category?.id ?? null,
      createdBy: interaction.user.id,
    });

    // Button mit Panel-ID im Custom-ID.
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${TICKET_OPEN_BUTTON_PREFIX}${panel.id}`)
        .setLabel('Ticket öffnen')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎫'),
    );
    await sent.edit({ embeds: [embed], components: [row] });

    await interaction.editReply(
      `✅ Panel gepostet in <#${channel.id}>.\n**Staff-Rolle:** <@&${staffRole.id}>${
        category ? `\n**Kategorie:** ${category.name}` : ''
      }\n**Message-ID:** \`${sent.id}\``,
    );
    return;
  }

  // ─── /ticket panel list ────────────────────────────────────────
  if (group === 'panel' && sub === 'list') {
    const panels = await listPanelsForGuild(interaction.guild.id);
    if (panels.length === 0) {
      await interaction.reply({
        content: 'Keine Ticket-Panels. Leg eins mit `/ticket panel create` an.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const body = panels
      .map(
        (p) =>
          `<#${p.channelId}> · Staff <@&${p.staffRoleId}> · \`${p.messageId}\``,
      )
      .join('\n');
    const embed = new EmbedBuilder()
      .setTitle('🎫 Ticket-Panels')
      .setDescription(body)
      .setColor(0x6366f1);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  // ─── /ticket close ─────────────────────────────────────────────
  if (sub === 'close') {
    const channelId = interaction.channelId;
    if (!channelId) {
      await interaction.reply({
        content: 'Konnte den aktuellen Channel nicht erkennen.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const ticket = await getTicketByChannel(channelId);
    if (!ticket) {
      await interaction.reply({
        content: 'Das ist kein Ticket-Channel.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (ticket.closedAt) {
      await interaction.reply({
        content: 'Ticket ist schon geschlossen.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const reason = interaction.options.getString('reason');
    await closeTicket(channelId, interaction.user.id);

    await interaction.reply({
      content: `🔒 Ticket geschlossen von <@${interaction.user.id}>.${
        reason ? `\n**Grund:** ${reason}` : ''
      }\n_Channel wird in 10 Sekunden gelöscht._`,
    });

    setTimeout(() => {
      interaction.channel?.delete?.('Ticket geschlossen').catch(() => {});
    }, 10_000);
    return;
  }
}

const command: SlashCommand = { data, execute };
export default command;
