import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  Events,
  MessageFlags,
  PermissionFlagsBits,
  type ButtonInteraction,
  type Client,
  type Interaction,
  type TextChannel,
} from 'discord.js';
import {
  TICKET_OPEN_BUTTON_PREFIX,
  TICKET_CLOSE_BUTTON_PREFIX,
} from '../commands/ticket.js';
import {
  closeTicket,
  createTicket,
  getOpenTicketForOwner,
  getTicketByChannel,
} from '../db/tickets.js';
import { getDb } from '../db.js';
import { captureAndSaveTranscript } from '../lib/ticketTranscript.js';

async function handleOpen(interaction: ButtonInteraction, panelId: string): Promise<void> {
  if (!interaction.guild) return;

  // Check ob User schon ein offenes Ticket hat.
  const existing = await getOpenTicketForOwner(
    interaction.guild.id,
    interaction.user.id,
  );
  if (existing) {
    await interaction.reply({
      content: `Du hast schon ein offenes Ticket: <#${existing.channelId}>`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Panel-Details aus DB holen.
  const db = getDb();
  const { data: panel } = await db
    .from('bot_ticket_panels')
    .select(
      'id, guild_id, channel_id, message_id, staff_role_id, category_id, color, welcome_message',
    )
    .eq('id', panelId)
    .maybeSingle();
  if (!panel) {
    await interaction.reply({
      content: 'Panel wurde gelöscht.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Channel anlegen mit Permission-Overrides.
  const baseUsername = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20) || 'user';
  const channel = await interaction.guild.channels
    .create({
      name: `ticket-${baseUsername}`,
      type: ChannelType.GuildText,
      parent: panel.category_id ?? undefined,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        },
        {
          id: panel.staff_role_id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ManageMessages,
          ],
        },
      ],
    })
    .catch((err) => {
      console.error('[ticket] create channel failed:', err);
      return null;
    });

  if (!channel) {
    await interaction.editReply(
      'Konnte den Ticket-Channel nicht anlegen — bitte Bot-Permissions (Manage Channels) prüfen.',
    );
    return;
  }

  const ticket = await createTicket({
    guildId: interaction.guild.id,
    channelId: channel.id,
    ownerUserId: interaction.user.id,
    panelId: panel.id,
  });

  // Welcome-Message + Close-Button.
  const welcomeText =
    (panel.welcome_message as string | null)?.trim() ||
    `Hi <@${interaction.user.id}>, beschreib dein Anliegen — das Staff-Team meldet sich gleich.\nWenn dein Anliegen erledigt ist, klick auf **Schließen**.`;
  const renderedWelcome = welcomeText
    .replaceAll('{user}', interaction.user.username)
    .replaceAll('{mention}', `<@${interaction.user.id}>`);
  const embed = new EmbedBuilder()
    .setTitle('Ticket eröffnet')
    .setDescription(renderedWelcome)
    .setColor((panel.color as number | null) ?? 0x380d52)
    .setTimestamp();
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${TICKET_CLOSE_BUTTON_PREFIX}${ticket.id}`)
      .setLabel('Schließen')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒'),
  );
  await (channel as TextChannel).send({
    content: `<@${interaction.user.id}> · <@&${panel.staff_role_id}>`,
    embeds: [embed],
    components: [row],
    allowedMentions: { users: [interaction.user.id], roles: [panel.staff_role_id] },
  });

  await interaction.editReply(`✅ Ticket eröffnet: <#${channel.id}>`);
}

async function handleClose(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild || !interaction.channel) return;

  const ticket = await getTicketByChannel(interaction.channel.id);
  if (!ticket) {
    await interaction.reply({
      content: 'Kein zugehöriges Ticket in der DB.',
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

  // Nur Owner oder ManageMessages dürfen schließen.
  const canClose =
    interaction.user.id === ticket.ownerUserId ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages);
  if (!canClose) {
    await interaction.reply({
      content: 'Nur der Ticket-Owner oder Staff darf schließen.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await closeTicket(ticket.channelId, interaction.user.id);
  await interaction.reply({
    content: `🔒 Ticket geschlossen von <@${interaction.user.id}>. Transcript wird gespeichert, Channel wird in 10s gelöscht.`,
  });

  // Transcript erfassen bevor der Channel gelöscht wird.
  if (interaction.channel) {
    try {
      const count = await captureAndSaveTranscript(interaction.channel);
      console.log(`[ticket] transcript saved: ${count} Nachrichten`);
    } catch (err) {
      console.error('[ticket] transcript save:', err);
    }
  }

  setTimeout(() => {
    interaction.channel?.delete?.('Ticket geschlossen').catch(() => {});
  }, 10_000);
}

export function registerTicketButtons(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isButton()) return;
    const id = interaction.customId;
    try {
      if (id.startsWith(TICKET_OPEN_BUTTON_PREFIX)) {
        const panelId = id.slice(TICKET_OPEN_BUTTON_PREFIX.length);
        await handleOpen(interaction, panelId);
      } else if (id.startsWith(TICKET_CLOSE_BUTTON_PREFIX)) {
        await handleClose(interaction);
      }
    } catch (err) {
      console.error('[ticket-buttons]', err);
      if (!interaction.replied) {
        await interaction
          .reply({
            content: 'Da ist was schiefgelaufen.',
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }
    }
  });
}
