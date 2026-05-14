import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import type { Suggestion } from '../db/suggestions.js';

const STATUS_META: Record<
  Suggestion['status'],
  { color: number; label: string }
> = {
  open: { color: 0x5865f2, label: 'Offen' },
  approved: { color: 0x10b981, label: '✅ Angenommen' },
  rejected: { color: 0xef4444, label: '❌ Abgelehnt' },
  implemented: { color: 0xa855f7, label: '🚀 Umgesetzt' },
};

export function buildSuggestionEmbed(
  s: Suggestion,
  authorTag: string,
): EmbedBuilder {
  const meta = STATUS_META[s.status];
  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(`💡 Vorschlag · ${meta.label}`)
    .setDescription(s.content.slice(0, 4000))
    .addFields(
      { name: 'Von', value: `<@${s.userId}>`, inline: true },
      {
        name: 'Stimmen',
        value: `👍 **${s.upvotes}** · 👎 **${s.downvotes}**`,
        inline: true,
      },
    )
    .setFooter({ text: `${authorTag} · ID: ${s.id.slice(0, 8)}` })
    .setTimestamp();
  if (s.modNote) {
    embed.addFields({ name: 'Mod-Notiz', value: s.modNote });
  }
  return embed;
}

export function buildSuggestionButtons(
  suggestionId: string,
  ended: boolean,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const voteRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`sug:up:${suggestionId}`)
      .setStyle(ButtonStyle.Success)
      .setEmoji('👍')
      .setLabel('Yay')
      .setDisabled(ended),
    new ButtonBuilder()
      .setCustomId(`sug:down:${suggestionId}`)
      .setStyle(ButtonStyle.Danger)
      .setEmoji('👎')
      .setLabel('Nay')
      .setDisabled(ended),
  );
  if (ended) return [voteRow];
  const modRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`sug:approve:${suggestionId}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Annehmen'),
    new ButtonBuilder()
      .setCustomId(`sug:reject:${suggestionId}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Ablehnen'),
    new ButtonBuilder()
      .setCustomId(`sug:done:${suggestionId}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Umgesetzt'),
  );
  return [voteRow, modRow];
}

export function parseSuggestionCustomId(
  raw: string,
):
  | { action: 'up' | 'down' | 'approve' | 'reject' | 'done'; id: string }
  | null {
  const parts = raw.split(':');
  if (parts.length !== 3 || parts[0] !== 'sug') return null;
  const action = parts[1] as 'up' | 'down' | 'approve' | 'reject' | 'done';
  if (!['up', 'down', 'approve', 'reject', 'done'].includes(action)) return null;
  return { action, id: parts[2] };
}
