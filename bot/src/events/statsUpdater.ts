import type { Client, GuildBasedChannel } from 'discord.js';
import {
  listAllStatChannels,
  markStatChannelUpdated,
  type StatChannel,
} from '../db/statsChannels.js';

// Discord rate-limits channel-rename auf 2 Änderungen / 10 Min pro Channel.
// Wir laufen alle 10 Min und überspringen unveränderte Werte.
const INTERVAL_MS = 10 * 60 * 1000;

function renderTemplate(
  template: string,
  vars: { members: number; boosts: number; name: string },
): string {
  return template
    .replaceAll('{members}', vars.members.toLocaleString('de-DE'))
    .replaceAll('{boosts}', String(vars.boosts))
    .replaceAll('{name}', vars.name);
}

async function updateOne(
  client: Client,
  sc: StatChannel,
): Promise<void> {
  const guild = client.guilds.cache.get(sc.guildId);
  if (!guild) return;

  const channel = (await guild.channels.fetch(sc.channelId).catch(() => null)) as
    | GuildBasedChannel
    | null;
  if (!channel) return;

  const rendered = renderTemplate(sc.template, {
    members: guild.memberCount,
    boosts: guild.premiumSubscriptionCount ?? 0,
    name: guild.name,
  });

  // Wenn unverändert, sparen wir uns den API-Call.
  if (sc.lastValue === rendered) return;
  // Discord channel-name max 100 Zeichen.
  const name = rendered.slice(0, 100);

  try {
    await channel.setName(name, 'Server-Stats auto-update');
    await markStatChannelUpdated(sc.guildId, sc.channelId, name);
  } catch (err) {
    console.warn(`[stats] setName failed (${sc.channelId}):`, err);
  }
}

export function startStatsUpdater(client: Client): void {
  const tick = async () => {
    try {
      const channels = await listAllStatChannels();
      for (const sc of channels) {
        await updateOne(client, sc);
      }
    } catch (err) {
      console.error('[stats-updater]', err);
    }
  };

  client.once('clientReady', () => {
    // Direkt nach Login einmal, dann jede 10 Min.
    setTimeout(() => {
      tick().catch(() => {});
    }, 30_000); // 30s Initial-Delay, damit Member-Cache halbwegs warm ist.
    setInterval(() => {
      tick().catch(() => {});
    }, INTERVAL_MS);
  });
}
