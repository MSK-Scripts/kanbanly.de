import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  parseEmoji,
  type ComponentEmojiResolvable,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import type {
  Suggestion,
  SuggestionConfig,
  SuggestionFieldKey,
} from '../db/suggestions.js';

function applyPlaceholders(
  template: string,
  ctx: { userMention: string; suggestion: string; publicId: string },
): string {
  return template
    .replaceAll('{user}', ctx.userMention)
    .replaceAll('{mention}', ctx.userMention)
    .replaceAll('{suggestion}', ctx.suggestion)
    .replaceAll('{id}', ctx.publicId);
}

function emojiOr(custom: string | null | undefined, fallback: string): string {
  const t = (custom ?? '').trim();
  return t.length ? t : fallback;
}

function toComponentEmoji(
  raw: string | null | undefined,
): ComponentEmojiResolvable | undefined {
  const t = (raw ?? '').trim();
  if (!t) return undefined;
  // Custom-Discord-Emoji (<:name:id> oder <a:name:id>)
  const parsed = parseEmoji(t);
  if (parsed?.id) {
    return { id: parsed.id, name: parsed.name ?? undefined, animated: parsed.animated };
  }
  return t;
}

export function buildSuggestionEmbed(
  s: Suggestion,
  cfg: SuggestionConfig,
  authorTag: string,
): EmbedBuilder {
  const ended = s.status !== 'open';
  const userMention = `<@${s.userId}>`;
  const description = applyPlaceholders(cfg.embedMessage, {
    userMention,
    suggestion: s.content.slice(0, 3500),
    publicId: s.publicId,
  });

  const embed = new EmbedBuilder()
    .setColor(cfg.embedColor & 0xffffff)
    .setTitle(cfg.embedTitle.slice(0, 256) || 'Vorschlag')
    .setDescription(description.slice(0, 4000));

  if (cfg.thumbnailUrl) embed.setThumbnail(cfg.thumbnailUrl);
  if (cfg.bannerUrl) embed.setImage(cfg.bannerUrl);
  if (cfg.footerText) embed.setFooter({ text: cfg.footerText.slice(0, 2048) });
  else embed.setFooter({ text: `${authorTag} · ${s.publicId}` });

  const openEmoji = emojiOr(cfg.statusOpenEmoji, '🟢');
  const endedEmoji = emojiOr(cfg.statusEndedEmoji, '🔴');
  const upEmoji = emojiOr(cfg.upvoteEmoji, '👍');
  const downEmoji = emojiOr(cfg.downvoteEmoji, '👎');

  const addField = (key: SuggestionFieldKey) => {
    switch (key) {
      case 'id':
        embed.addFields({ name: 'ID', value: `#${s.publicId}`, inline: false });
        break;
      case 'status':
        embed.addFields({
          name: 'Status',
          value: ended ? `${endedEmoji} Beendet` : `${openEmoji} Offen`,
          inline: false,
        });
        break;
      case 'upvotes':
        if (ended) {
          embed.addFields({
            name: `${upEmoji} Upvotes`,
            value: String(s.upvotes),
            inline: false,
          });
        }
        break;
      case 'downvotes':
        if (ended) {
          embed.addFields({
            name: `${downEmoji} Downvotes`,
            value: String(s.downvotes),
            inline: false,
          });
        }
        break;
      case 'banner':
        // banner ist über setImage gerendert — wenn keine URL gesetzt, Hinweis-Feld.
        if (!cfg.bannerUrl) {
          embed.addFields({
            name: 'Banner',
            value: '*Kein Banner gesetzt*',
            inline: false,
          });
        }
        break;
    }
  };

  for (const key of cfg.fieldOrder) addField(key);

  if (ended) {
    embed.addFields({ name: 'Hinweis', value: cfg.endMessage.slice(0, 1024) });
  }
  if (s.modNote) {
    embed.addFields({ name: 'Mod-Notiz', value: s.modNote.slice(0, 1024) });
  }
  return embed;
}

export function buildSuggestionButtons(
  s: Suggestion,
  cfg: SuggestionConfig,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const ended = s.status !== 'open';
  const voteRow = new ActionRowBuilder<MessageActionRowComponentBuilder>();
  const upBtn = new ButtonBuilder()
    .setCustomId(`sug:up:${s.id}`)
    .setStyle(ButtonStyle.Success)
    .setLabel(String(s.upvotes))
    .setDisabled(ended);
  const upEmoji = toComponentEmoji(cfg.upvoteEmoji) ?? '👍';
  upBtn.setEmoji(upEmoji);
  const downBtn = new ButtonBuilder()
    .setCustomId(`sug:down:${s.id}`)
    .setStyle(ButtonStyle.Danger)
    .setLabel(String(s.downvotes))
    .setDisabled(ended);
  const downEmoji = toComponentEmoji(cfg.downvoteEmoji) ?? '👎';
  downBtn.setEmoji(downEmoji);
  voteRow.addComponents(upBtn, downBtn);

  if (ended) return [voteRow];

  const modRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`sug:end:${s.id}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Beenden'),
  );
  return [voteRow, modRow];
}

export function parseSuggestionCustomId(
  raw: string,
):
  | { action: 'up' | 'down' | 'end' | 'approve' | 'reject' | 'done'; id: string }
  | null {
  const parts = raw.split(':');
  if (parts.length !== 3 || parts[0] !== 'sug') return null;
  const action = parts[1] as 'up' | 'down' | 'end' | 'approve' | 'reject' | 'done';
  if (!['up', 'down', 'end', 'approve', 'reject', 'done'].includes(action)) return null;
  return { action, id: parts[2] };
}
