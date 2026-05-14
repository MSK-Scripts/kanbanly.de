import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type MessageActionRowComponentBuilder,
} from 'discord.js';

export type GiveawayButtonStyleName =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'danger';

const STYLE_MAP: Record<GiveawayButtonStyleName, ButtonStyle> = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
};

export function buildGiveawayCustomId(giveawayId: string): string {
  return `gw:join:${giveawayId}`;
}

export function parseGiveawayCustomId(raw: string): string | null {
  const parts = raw.split(':');
  if (parts.length !== 3 || parts[0] !== 'gw' || parts[1] !== 'join') return null;
  return parts[2];
}

function applyTemplate(
  template: string,
  ctx: {
    prize: string;
    endsAt: Date;
    winnersCount: number;
    entries: number;
  },
): string {
  const endsUnix = Math.floor(ctx.endsAt.getTime() / 1000);
  return template
    .replaceAll('{prize}', ctx.prize)
    .replaceAll('{winners}', String(ctx.winnersCount))
    .replaceAll('{entries}', String(ctx.entries))
    .replaceAll('{ends}', `<t:${endsUnix}:R>`)
    .replaceAll('{ends_long}', `<t:${endsUnix}:F>`);
}

export type GiveawayDesign = {
  embedColor?: number | null;
  embedTitle?: string | null;
  embedDescription?: string | null;
  buttonLabel?: string | null;
  buttonEmoji?: string | null;
  buttonStyle?: GiveawayButtonStyleName | null;
};

export function buildGiveawayEmbed(
  prize: string,
  endsAt: Date,
  winnersCount: number,
  entries: number,
  ended: boolean,
  winnerUserIds?: string[],
  design: GiveawayDesign = {},
): EmbedBuilder {
  const ctx = { prize, endsAt, winnersCount, entries };
  const color =
    design.embedColor ?? (ended ? 0x6b7280 : 0xa855f7);
  const titleTemplate = design.embedTitle ?? '🎉  {prize}';
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(applyTemplate(titleTemplate, ctx).slice(0, 256));

  if (ended) {
    const winnersText =
      winnerUserIds && winnerUserIds.length > 0
        ? winnerUserIds.map((id) => `<@${id}>`).join(' · ')
        : '_Keine Teilnehmer_';
    embed.setDescription(
      `**Beendet**\n\nGewinner: ${winnersText}\nTeilnehmer: ${entries}`,
    );
  } else {
    const descTemplate =
      design.embedDescription ??
      [
        'Endet: {ends}',
        'Gewinner: **{winners}**',
        'Teilnehmer: **{entries}**',
        '',
        'Klick auf den Button, um mitzumachen.',
      ].join('\n');
    embed.setDescription(applyTemplate(descTemplate, ctx).slice(0, 4000));
  }
  return embed;
}

function applyEmojiToButton(btn: ButtonBuilder, emojiInput: string): void {
  const trimmed = emojiInput.trim();
  if (!trimmed) return;
  const customMatch = trimmed.match(/^<(a?):([\w~]+):(\d+)>$/);
  if (customMatch) {
    const [, animated, name, id] = customMatch;
    btn.setEmoji({ id, name, animated: animated === 'a' });
  } else {
    btn.setEmoji(trimmed);
  }
}

export function buildGiveawayComponents(
  giveawayId: string,
  ended: boolean,
  design: GiveawayDesign = {},
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  if (ended) return [];
  const styleName = (design.buttonStyle ?? 'primary') as GiveawayButtonStyleName;
  const btn = new ButtonBuilder()
    .setCustomId(buildGiveawayCustomId(giveawayId))
    .setStyle(STYLE_MAP[styleName] ?? ButtonStyle.Primary)
    .setLabel((design.buttonLabel ?? 'Teilnehmen').slice(0, 80));
  applyEmojiToButton(btn, design.buttonEmoji ?? '🎉');
  const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(btn);
  return [row];
}

/** Parsed Dauer-String wie "1d", "2h", "30m", "1d 2h 30m" → Millisekunden. */
export function parseDuration(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  const re = /(\d+)\s*(d|h|m|s)/g;
  let total = 0;
  let match;
  let found = false;
  while ((match = re.exec(trimmed)) !== null) {
    found = true;
    const n = parseInt(match[1], 10);
    if (match[2] === 'd') total += n * 86400 * 1000;
    else if (match[2] === 'h') total += n * 3600 * 1000;
    else if (match[2] === 'm') total += n * 60 * 1000;
    else if (match[2] === 's') total += n * 1000;
  }
  if (!found) return null;
  return total;
}

export function pickWinners(entries: string[], count: number): string[] {
  if (entries.length <= count) return [...entries];
  const pool = [...entries];
  const winners: string[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    winners.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return winners;
}
