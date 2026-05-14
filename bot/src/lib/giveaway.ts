import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type MessageActionRowComponentBuilder,
} from 'discord.js';

export function buildGiveawayCustomId(giveawayId: string): string {
  return `gw:join:${giveawayId}`;
}

export function parseGiveawayCustomId(raw: string): string | null {
  const parts = raw.split(':');
  if (parts.length !== 3 || parts[0] !== 'gw' || parts[1] !== 'join') return null;
  return parts[2];
}

export function buildGiveawayEmbed(
  prize: string,
  endsAt: Date,
  winnersCount: number,
  entries: number,
  ended: boolean,
  winnerUserIds?: string[],
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(ended ? 0x6b7280 : 0xa855f7)
    .setTitle(`🎉  ${prize}`);

  if (ended) {
    const winnersText =
      winnerUserIds && winnerUserIds.length > 0
        ? winnerUserIds.map((id) => `<@${id}>`).join(' · ')
        : '_Keine Teilnehmer_';
    embed.setDescription(`**Beendet**\n\nGewinner: ${winnersText}\nTeilnehmer: ${entries}`);
  } else {
    embed.setDescription(
      [
        `Endet: <t:${Math.floor(endsAt.getTime() / 1000)}:R>`,
        `Gewinner: **${winnersCount}**`,
        `Teilnehmer: **${entries}**`,
        '',
        'Klick auf **Teilnehmen**, um mitzumachen.',
      ].join('\n'),
    );
  }
  return embed;
}

export function buildGiveawayComponents(
  giveawayId: string,
  ended: boolean,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  if (ended) return [];
  const btn = new ButtonBuilder()
    .setCustomId(buildGiveawayCustomId(giveawayId))
    .setStyle(ButtonStyle.Primary)
    .setLabel('Teilnehmen')
    .setEmoji('🎉');
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
