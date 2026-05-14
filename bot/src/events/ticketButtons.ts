import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  Events,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type Client,
  type Interaction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type TextChannel,
  type User,
} from 'discord.js';
import {
  closeTicket,
  createTicket,
  getOpenTicketForOwner,
  getPanelById,
  getTicketById,
  getTicketByChannel,
  saveTicketFeedback,
  type PanelTicketButton,
  type TicketPanel,
} from '../db/tickets.js';
import { captureAndSaveTranscript } from '../lib/ticketTranscript.js';

export const TICKET_OPEN_BUTTON_PREFIX = 'ticket-open:';
export const TICKET_CLOSE_BUTTON_PREFIX = 'ticket-close:';
export const TICKET_SELECT_PREFIX = 'ticket-select:';
export const TICKET_FEEDBACK_PREFIX = 'ticket-feedback:';
export const TICKET_FEEDBACK_MODAL_PREFIX = 'ticket-feedback-modal:';
export const TICKET_FEEDBACK_SKIP_PREFIX = 'ticket-feedback-skip:';

function resolveTicketButton(panel: TicketPanel, buttonId: string | null): PanelTicketButton | null {
  if (panel.buttons && panel.buttons.length > 0 && buttonId) {
    const b = panel.buttons.find((x) => x.id === buttonId && x.kind === 'ticket');
    if (b && b.kind === 'ticket') return b;
  }
  // Legacy-Fallback: nur ein impliziter Button aus Panel-Defaults.
  if (panel.buttons.length === 0) {
    return {
      id: 'default',
      kind: 'ticket',
      label: panel.buttonLabel,
      emoji: panel.buttonEmoji,
      style: panel.buttonStyle,
      categoryId: panel.categoryId,
      staffRoleIds: panel.staffRoleIds.length ? panel.staffRoleIds : [panel.staffRoleId],
      welcomeMessage: panel.welcomeMessage,
      namePattern: panel.namePattern,
    };
  }
  return null;
}

function renderTemplate(text: string, user: User): string {
  return text.replaceAll('{user}', user.username).replaceAll('{mention}', `<@${user.id}>`);
}

function buildTicketName(pattern: string, user: User): string {
  const safe = user.username.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20) || 'user';
  return (pattern || 'ticket-{user}').replaceAll('{user}', safe).slice(0, 90);
}

async function openTicketFlow(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  panel: TicketPanel,
  btn: PanelTicketButton,
): Promise<void> {
  if (!interaction.guild) return;

  const existing = await getOpenTicketForOwner(interaction.guild.id, interaction.user.id);
  if (existing) {
    await interaction.reply({
      content: `Du hast schon ein offenes Ticket: <#${existing.channelId}>`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const staffRoles =
    btn.staffRoleIds && btn.staffRoleIds.length > 0
      ? btn.staffRoleIds
      : panel.staffRoleIds.length > 0
      ? panel.staffRoleIds
      : [panel.staffRoleId];

  const channelName = buildTicketName(btn.namePattern ?? panel.namePattern, interaction.user);

  const channel = await interaction.guild.channels
    .create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: (btn.categoryId ?? panel.categoryId) ?? undefined,
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
        ...staffRoles.map((rid) => ({
          id: rid,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ManageMessages,
          ],
        })),
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
    selectedButtonId: btn.id,
  });

  const welcomeText =
    (btn.welcomeMessage ?? panel.welcomeMessage)?.trim() ||
    `Hi <@${interaction.user.id}>, beschreib dein Anliegen — das Staff-Team meldet sich gleich.\nWenn dein Anliegen erledigt ist, klick auf **Schließen**.`;
  const rendered = renderTemplate(welcomeText, interaction.user);

  const embed = new EmbedBuilder()
    .setTitle('Ticket eröffnet')
    .setDescription(rendered)
    .setColor(panel.color ?? 0x380d52)
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${TICKET_CLOSE_BUTTON_PREFIX}${ticket.id}`)
      .setLabel('Schließen')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒'),
  );

  const mentionContent = `<@${interaction.user.id}> · ${staffRoles
    .map((r) => `<@&${r}>`)
    .join(' ')}`;
  await (channel as TextChannel).send({
    content: mentionContent,
    embeds: [embed],
    components: [row],
    allowedMentions: { users: [interaction.user.id], roles: staffRoles },
  });

  await interaction.editReply(`✅ Ticket eröffnet: <#${channel.id}>`);
}

async function handleOpen(interaction: ButtonInteraction, panelId: string, buttonId: string | null): Promise<void> {
  const panel = await getPanelById(panelId);
  if (!panel) {
    await interaction.reply({ content: 'Panel wurde gelöscht.', flags: MessageFlags.Ephemeral });
    return;
  }
  const btn = resolveTicketButton(panel, buttonId);
  if (!btn) {
    await interaction.reply({
      content: 'Dieser Ticket-Button ist nicht konfiguriert.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await openTicketFlow(interaction, panel, btn);
}

async function handleSelect(interaction: StringSelectMenuInteraction, panelId: string): Promise<void> {
  const panel = await getPanelById(panelId);
  if (!panel) {
    await interaction.reply({ content: 'Panel wurde gelöscht.', flags: MessageFlags.Ephemeral });
    return;
  }
  const value = interaction.values[0];
  const btn = resolveTicketButton(panel, value ?? null);
  if (!btn) {
    await interaction.reply({
      content: 'Auswahl ist nicht konfiguriert.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await openTicketFlow(interaction, panel, btn);
}

function buildFeedbackRow(ticketId: string): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();
  for (let i = 1; i <= 5; i++) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${TICKET_FEEDBACK_PREFIX}${ticketId}:${i}`)
        .setLabel('⭐'.repeat(i))
        .setStyle(ButtonStyle.Secondary),
    );
  }
  return row;
}

function buildFeedbackSkipRow(ticketId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${TICKET_FEEDBACK_SKIP_PREFIX}${ticketId}`)
      .setLabel('Überspringen')
      .setStyle(ButtonStyle.Secondary),
  );
}

async function sendFeedbackPrompt(
  panel: TicketPanel,
  ticketId: string,
  owner: User,
  channel: TextChannel | null,
): Promise<void> {
  if (!panel.feedbackEnabled) return;
  const content = panel.feedbackQuestion || 'Wie zufrieden warst du mit dem Support?';
  const components = [buildFeedbackRow(ticketId), buildFeedbackSkipRow(ticketId)];

  const sendDm = async () => {
    try {
      await owner.send({ content, components });
      return true;
    } catch {
      return false;
    }
  };

  const sendChannel = async () => {
    if (!channel) return false;
    try {
      await channel.send({ content: `<@${owner.id}> ${content}`, components });
      return true;
    } catch {
      return false;
    }
  };

  if (panel.feedbackMode === 'dm') {
    await sendDm();
  } else if (panel.feedbackMode === 'channel') {
    await sendChannel();
  } else {
    const ok = await sendDm();
    if (!ok) await sendChannel();
  }
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

  const panel = ticket.panelId ? await getPanelById(ticket.panelId) : null;

  await closeTicket(ticket.channelId, interaction.user.id);
  await interaction.reply({
    content: `🔒 Ticket geschlossen von <@${interaction.user.id}>. Transcript wird gespeichert, Channel wird in 15s gelöscht.`,
  });

  // Transcript erfassen.
  try {
    const count = await captureAndSaveTranscript(interaction.channel);
    console.log(`[ticket] transcript saved: ${count} Nachrichten`);
  } catch (err) {
    console.error('[ticket] transcript save:', err);
  }

  // Feedback-Prompt.
  if (panel?.feedbackEnabled) {
    try {
      const owner = await interaction.client.users.fetch(ticket.ownerUserId);
      const channel = interaction.channel as TextChannel;
      await sendFeedbackPrompt(panel, ticket.id, owner, channel);
    } catch (err) {
      console.warn('[ticket] feedback prompt failed:', err);
    }
  }

  setTimeout(() => {
    interaction.channel?.delete?.('Ticket geschlossen').catch(() => {});
  }, 15_000);
}

async function handleFeedbackRating(interaction: ButtonInteraction, ticketId: string, rating: number): Promise<void> {
  const ticket = await getTicketById(ticketId);
  if (!ticket) {
    await interaction.reply({
      content: 'Ticket nicht gefunden.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (interaction.user.id !== ticket.ownerUserId) {
    await interaction.reply({
      content: 'Nur der Ticket-Owner darf bewerten.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Speichern, dann Modal für optionalen Kommentar zeigen.
  await saveTicketFeedback({
    ticketId,
    guildId: ticket.guildId,
    userId: interaction.user.id,
    rating,
    comment: null,
  });

  const modal = new ModalBuilder()
    .setCustomId(`${TICKET_FEEDBACK_MODAL_PREFIX}${ticketId}:${rating}`)
    .setTitle('Optionaler Kommentar');
  const input = new TextInputBuilder()
    .setCustomId('comment')
    .setLabel('Was lief gut / was nicht?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(1000);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

async function handleFeedbackModal(interaction: ModalSubmitInteraction): Promise<void> {
  const rest = interaction.customId.slice(TICKET_FEEDBACK_MODAL_PREFIX.length);
  const [ticketId, ratingStr] = rest.split(':');
  if (!ticketId) return;
  const rating = Number(ratingStr) || 0;
  const comment = interaction.fields.getTextInputValue('comment').trim() || null;

  const ticket = await getTicketById(ticketId);
  if (!ticket) {
    await interaction.reply({ content: 'Ticket nicht gefunden.', flags: MessageFlags.Ephemeral });
    return;
  }

  await saveTicketFeedback({
    ticketId,
    guildId: ticket.guildId,
    userId: interaction.user.id,
    rating,
    comment,
  });

  await interaction.reply({
    content: `Danke für dein Feedback (${'⭐'.repeat(rating)})!`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleFeedbackSkip(interaction: ButtonInteraction): Promise<void> {
  await interaction.reply({
    content: 'Alles klar — kein Feedback. Trotzdem danke!',
    flags: MessageFlags.Ephemeral,
  });
}

export function registerTicketButtons(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isButton()) {
        const id = interaction.customId;
        if (id.startsWith(TICKET_OPEN_BUTTON_PREFIX)) {
          const rest = id.slice(TICKET_OPEN_BUTTON_PREFIX.length);
          const [panelId, buttonId] = rest.split(':');
          await handleOpen(interaction, panelId, buttonId ?? null);
        } else if (id.startsWith(TICKET_CLOSE_BUTTON_PREFIX)) {
          await handleClose(interaction);
        } else if (id.startsWith(TICKET_FEEDBACK_PREFIX)) {
          const rest = id.slice(TICKET_FEEDBACK_PREFIX.length);
          const [ticketId, ratingStr] = rest.split(':');
          await handleFeedbackRating(interaction, ticketId, Number(ratingStr));
        } else if (id.startsWith(TICKET_FEEDBACK_SKIP_PREFIX)) {
          await handleFeedbackSkip(interaction);
        }
      } else if (interaction.isStringSelectMenu()) {
        const id = interaction.customId;
        if (id.startsWith(TICKET_SELECT_PREFIX)) {
          const panelId = id.slice(TICKET_SELECT_PREFIX.length);
          await handleSelect(interaction, panelId);
        }
      } else if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith(TICKET_FEEDBACK_MODAL_PREFIX)) {
          await handleFeedbackModal(interaction);
        }
      }
    } catch (err) {
      console.error('[ticket-buttons]', err);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction
          .reply({ content: 'Da ist was schiefgelaufen.', flags: MessageFlags.Ephemeral })
          .catch(() => {});
      }
    }
  });
}

// Helpers für Schedulers, die ein Feedback-Prompt brauchen könnten.
export async function maybePromptFeedback(
  client: Client,
  panel: TicketPanel,
  ticketId: string,
  ownerUserId: string,
  channelId: string,
): Promise<void> {
  if (!panel.feedbackEnabled) return;
  try {
    const owner = await client.users.fetch(ownerUserId);
    const channel = (await client.channels.fetch(channelId).catch(() => null)) as
      | TextChannel
      | null;
    await sendFeedbackPrompt(panel, ticketId, owner, channel);
  } catch (err) {
    console.warn('[ticket] feedback prompt (scheduler):', err);
  }
}
