import { type Client, type TextChannel } from 'discord.js';
import {
  finalizeGiveaway,
  listActiveGiveaways,
  listEntries,
} from '../db/giveaways.js';
import { buildGiveawayEmbed, pickWinners } from '../lib/giveaway.js';

const TICK_MS = 30_000;

async function endGiveaway(
  client: Client,
  giveaway: Awaited<ReturnType<typeof listActiveGiveaways>>[number],
): Promise<void> {
  const entries = await listEntries(giveaway.id);
  const winners = pickWinners(entries, giveaway.winnersCount);
  await finalizeGiveaway(giveaway.id, winners);

  const guild = await client.guilds.fetch(giveaway.guildId).catch(() => null);
  if (!guild) return;
  const channel = (await guild.channels.fetch(giveaway.channelId).catch(() => null)) as
    | TextChannel
    | null;
  if (!channel || !giveaway.messageId) return;

  const embed = buildGiveawayEmbed(
    giveaway.prize,
    new Date(giveaway.endsAt),
    giveaway.winnersCount,
    entries.length,
    true,
    winners,
  );
  const msg = await channel.messages.fetch(giveaway.messageId).catch(() => null);
  if (msg) await msg.edit({ embeds: [embed], components: [] }).catch(() => {});

  const winnersTxt = winners.length
    ? winners.map((u) => `<@${u}>`).join(' · ')
    : '_Keine Teilnehmer_';
  await channel
    .send({
      content: `🎉 **${giveaway.prize}** ging an: ${winnersTxt}`,
    })
    .catch(() => {});
}

async function tick(client: Client): Promise<void> {
  try {
    const active = await listActiveGiveaways();
    const now = Date.now();
    for (const gw of active) {
      if (new Date(gw.endsAt).getTime() <= now) {
        await endGiveaway(client, gw).catch((err) =>
          console.error('[giveaway/scheduler] end:', err),
        );
      }
    }
  } catch (err) {
    console.error('[giveaway/scheduler] tick:', err);
  }
}

export function startGiveawayScheduler(client: Client): void {
  // Erst-Tick nach 30s, damit der Bot Zeit hat zum Verbinden.
  setTimeout(() => {
    tick(client).catch(() => {});
    setInterval(() => tick(client).catch(() => {}), TICK_MS);
  }, 30_000);
  console.log('[giveaway/scheduler] gestartet — Tick alle 30s');
}
