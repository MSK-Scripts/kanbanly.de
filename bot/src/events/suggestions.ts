import {
  ActionRowBuilder,
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
  type TextChannel,
} from 'discord.js';
import {
  castVote,
  createSuggestion,
  getSuggestion,
  getSuggestionConfig,
  recomputeSuggestionVotes,
  setSuggestionMessageId,
  updateSuggestionStatus,
  type SuggestionStatus,
} from '../db/suggestions.js';
import {
  buildSuggestionButtons,
  buildSuggestionEmbed,
  parseSuggestionCustomId,
} from '../lib/suggestionUi.js';

async function handleModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.guild) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const cfg = await getSuggestionConfig(interaction.guild.id);
  if (!cfg.enabled || !cfg.channelId) {
    await interaction.editReply('Vorschläge sind nicht aktiv.');
    return;
  }
  const channel = (await interaction.guild.channels
    .fetch(cfg.channelId)
    .catch(() => null)) as TextChannel | null;
  if (!channel?.isTextBased()) {
    await interaction.editReply('Vorschlags-Channel existiert nicht mehr.');
    return;
  }

  const content = interaction.fields.getTextInputValue('content').trim();
  if (!content) {
    await interaction.editReply('Inhalt fehlt.');
    return;
  }

  const suggestion = await createSuggestion({
    guildId: interaction.guild.id,
    channelId: cfg.channelId,
    userId: interaction.user.id,
    content,
  });

  const authorTag = interaction.user.username;
  const embed = buildSuggestionEmbed(suggestion, cfg, authorTag);
  const components = buildSuggestionButtons(suggestion, cfg);

  try {
    const sent = await channel.send({ embeds: [embed], components });
    await setSuggestionMessageId(suggestion.id, sent.id);
    await interaction.editReply(
      `✓ Dein Vorschlag wurde in <#${cfg.channelId}> gepostet (ID: #${suggestion.publicId}).`,
    );
  } catch (err) {
    console.error('[suggest] post', err);
    await interaction.editReply('Konnte den Vorschlag nicht posten.');
  }
}

async function refreshMessage(
  interaction: ButtonInteraction,
  suggestionId: string,
): Promise<void> {
  const s = await getSuggestion(suggestionId);
  if (!s || !s.messageId || !interaction.guild) return;
  const cfg = await getSuggestionConfig(interaction.guild.id);
  const channel = (await interaction.guild.channels
    .fetch(s.channelId)
    .catch(() => null)) as TextChannel | null;
  if (!channel) return;
  const msg = await channel.messages.fetch(s.messageId).catch(() => null);
  if (!msg) return;
  const embed = buildSuggestionEmbed(s, cfg, interaction.user.username);
  const components = buildSuggestionButtons(s, cfg);
  await msg.edit({ embeds: [embed], components }).catch(() => {});
}

async function handleVote(
  interaction: ButtonInteraction,
  suggestionId: string,
  vote: 'up' | 'down',
): Promise<void> {
  const s = await getSuggestion(suggestionId);
  if (!s || s.status !== 'open') {
    await interaction.reply({
      content: 'Dieser Vorschlag ist beendet.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const result = await castVote(suggestionId, interaction.user.id, vote);
  await recomputeSuggestionVotes(suggestionId);
  await interaction.reply({
    content: result.removed
      ? '✓ Stimme entfernt.'
      : vote === 'up'
      ? '👍 Upvote gespeichert.'
      : '👎 Downvote gespeichert.',
    flags: MessageFlags.Ephemeral,
  });
  refreshMessage(interaction, suggestionId).catch(() => {});
}

function memberHasAllowedRole(
  interaction: ButtonInteraction,
  allowedRoleIds: string[],
): boolean {
  if (allowedRoleIds.length === 0) return false;
  const member = interaction.member;
  if (!member) return false;
  const roles = member.roles as { cache?: Map<string, unknown> } | string[] | undefined;
  if (Array.isArray(roles)) {
    return roles.some((r) => allowedRoleIds.includes(r));
  }
  if (roles && typeof roles === 'object' && 'cache' in roles && roles.cache) {
    for (const id of roles.cache.keys()) {
      if (allowedRoleIds.includes(id)) return true;
    }
  }
  return false;
}

async function handleMod(
  interaction: ButtonInteraction,
  suggestionId: string,
  status: SuggestionStatus,
): Promise<void> {
  if (!interaction.guild) return;
  const cfg = await getSuggestionConfig(interaction.guild.id);
  const member = interaction.member;
  const hasManage =
    member &&
    typeof member.permissions !== 'string' &&
    member.permissions.has(PermissionFlagsBits.ManageGuild);
  const hasAllowedRole = memberHasAllowedRole(interaction, cfg.allowedRoleIds);
  if (!hasManage && !hasAllowedRole) {
    await interaction.reply({
      content: 'Du darfst Vorschläge nicht beenden.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await updateSuggestionStatus(suggestionId, status, null);
  await interaction.reply({
    content: status === 'open' ? '✓ Wieder geöffnet.' : '✓ Vorschlag beendet.',
    flags: MessageFlags.Ephemeral,
  });
  refreshMessage(interaction, suggestionId).catch(() => {});
}

async function handlePanelButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild) return;
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
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

export function registerSuggestions(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isModalSubmit() && interaction.customId === 'sug:modal') {
        await handleModal(interaction);
        return;
      }
      if (interaction.isButton()) {
        // Panel-Button → Modal anzeigen (gleiches Modal wie /suggest).
        if (interaction.customId.startsWith('sug-open:')) {
          await handlePanelButton(interaction);
          return;
        }
        const parsed = parseSuggestionCustomId(interaction.customId);
        if (!parsed) return;
        if (parsed.action === 'up' || parsed.action === 'down') {
          await handleVote(interaction, parsed.id, parsed.action);
          return;
        }
        const statusMap: Record<string, SuggestionStatus> = {
          end: 'implemented',
          approve: 'approved',
          reject: 'rejected',
          done: 'implemented',
        };
        const status = statusMap[parsed.action];
        if (status) await handleMod(interaction, parsed.id, status);
      }
    } catch (err) {
      console.error('[suggestions]', err);
    }
  });
}
