import {
  EmbedBuilder,
  type APIEmbedField,
  type ActionRowBuilder,
  type BaseMessageOptions,
  type MessageActionRowComponentBuilder,
  type TextBasedChannel,
} from 'discord.js';

export type StyledOptions = {
  useEmbed?: boolean;
  embedColor?: number | null;
  embedTitle?: string | null;
  embedFooter?: string | null;
  embedFields?: APIEmbedField[];
  allowedMentions?: BaseMessageOptions['allowedMentions'];
  components?: ActionRowBuilder<MessageActionRowComponentBuilder>[];
};

export function buildStyledPayload(text: string, opts: StyledOptions = {}): BaseMessageOptions {
  if (opts.useEmbed) {
    const embed = new EmbedBuilder().setDescription(text);
    if (opts.embedTitle) embed.setTitle(opts.embedTitle);
    if (typeof opts.embedColor === 'number') embed.setColor(opts.embedColor);
    if (opts.embedFooter) embed.setFooter({ text: opts.embedFooter });
    if (opts.embedFields?.length) embed.addFields(opts.embedFields);
    return {
      embeds: [embed],
      allowedMentions: opts.allowedMentions,
      components: opts.components,
    };
  }
  return {
    content: text,
    allowedMentions: opts.allowedMentions,
    components: opts.components,
  };
}

export async function sendStyled(
  channel: TextBasedChannel,
  text: string,
  opts: StyledOptions = {},
) {
  if (!('send' in channel)) return null;
  return await (channel as TextBasedChannel & { send: (o: BaseMessageOptions) => Promise<unknown> }).send(
    buildStyledPayload(text, opts),
  );
}
