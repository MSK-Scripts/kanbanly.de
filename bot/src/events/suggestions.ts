import {
  Events,
  MessageFlags,
  PermissionFlagsBits,
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

  const authorTag = `${interaction.user.username}`;
  const embed = buildSuggestionEmbed(suggestion, authorTag);
  const components = buildSuggestionButtons(suggestion.id, false);

  try {
    const sent = await channel.send({ embeds: [embed], components });
    await setSuggestionMessageId(suggestion.id, sent.id);
    await interaction.editReply(`✓ Dein Vorschlag wurde in <#${cfg.channelId}> gepostet.`);
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
  const channel = (await interaction.guild.channels
    .fetch(s.channelId)
    .catch(() => null)) as TextChannel | null;
  if (!channel) return;
  const msg = await channel.messages.fetch(s.messageId).catch(() => null);
  if (!msg) return;
  const ended = s.status !== 'open';
  const embed = buildSuggestionEmbed(s, interaction.user.username);
  const components = buildSuggestionButtons(s.id, ended);
  await msg.edit({ embeds: [embed], components }).catch(() => {});
}

async function handleVote(
  interaction: ButtonInteraction,
  suggestionId: string,
  vote: 'up' | 'down',
): Promise<void> {
  const result = await castVote(suggestionId, interaction.user.id, vote);
  await recomputeSuggestionVotes(suggestionId);
  await interaction.reply({
    content: result.removed
      ? '✓ Stimme entfernt.'
      : vote === 'up'
      ? '👍 Yay-Stimme gespeichert.'
      : '👎 Nay-Stimme gespeichert.',
    flags: MessageFlags.Ephemeral,
  });
  refreshMessage(interaction, suggestionId).catch(() => {});
}

async function handleMod(
  interaction: ButtonInteraction,
  suggestionId: string,
  status: SuggestionStatus,
): Promise<void> {
  if (!interaction.guild) return;
  const member = interaction.member;
  if (
    !member ||
    typeof member.permissions === 'string' ||
    !member.permissions.has(PermissionFlagsBits.ManageGuild)
  ) {
    await interaction.reply({
      content: 'Nur für Mods (Manage Guild).',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await updateSuggestionStatus(suggestionId, status, null);
  await interaction.reply({
    content: `✓ Status auf **${status}** gesetzt.`,
    flags: MessageFlags.Ephemeral,
  });
  refreshMessage(interaction, suggestionId).catch(() => {});
}

export function registerSuggestions(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isModalSubmit() && interaction.customId === 'sug:modal') {
        await handleModal(interaction);
        return;
      }
      if (interaction.isButton()) {
        const parsed = parseSuggestionCustomId(interaction.customId);
        if (!parsed) return;
        if (parsed.action === 'up' || parsed.action === 'down') {
          await handleVote(interaction, parsed.id, parsed.action);
          return;
        }
        const statusMap: Record<string, SuggestionStatus> = {
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
