import {
  EmbedBuilder,
  type Client,
  type TextChannel,
} from 'discord.js';
import { getDb } from '../db.js';

const CHECK_INTERVAL_MS = 60 * 60_000;
const lastFiredKey = new Map<string, string>(); // guildId -> 'YYYY-MM-DD'

async function fireForGuild(
  client: Client,
  row: {
    guild_id: string;
    daily_image_channel_id: string | null;
    daily_image_urls: unknown;
    daily_image_index: number;
  },
): Promise<void> {
  const channelId = row.daily_image_channel_id;
  const urls = Array.isArray(row.daily_image_urls)
    ? (row.daily_image_urls as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];
  if (!channelId || urls.length === 0) return;

  const idx = row.daily_image_index % urls.length;
  const url = urls[idx];

  const guild = await client.guilds.fetch(row.guild_id).catch(() => null);
  if (!guild) return;
  const channel = (await guild.channels.fetch(channelId).catch(() => null)) as
    | TextChannel
    | null;
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder().setColor(0x380d52).setImage(url);
  await channel.send({ embeds: [embed] }).catch((err) =>
    console.error('[dailyImage] send:', err),
  );

  // Index in DB hochzählen.
  const db = getDb();
  await db
    .from('bot_guilds')
    .update({ daily_image_index: idx + 1 })
    .eq('guild_id', row.guild_id);
}

async function tick(client: Client): Promise<void> {
  try {
    const now = new Date();
    const hourUtc = now.getUTCHours();
    const today = now.toISOString().slice(0, 10);

    const db = getDb();
    const { data } = await db
      .from('bot_guilds')
      .select('guild_id, daily_image_channel_id, daily_image_hour, daily_image_urls, daily_image_index')
      .eq('daily_image_enabled', true);
    for (const row of data ?? []) {
      const cfgHour = (row.daily_image_hour as number | null) ?? 9;
      if (hourUtc < cfgHour) continue;
      if (lastFiredKey.get(row.guild_id as string) === today) continue;
      lastFiredKey.set(row.guild_id as string, today);
      await fireForGuild(client, {
        guild_id: row.guild_id as string,
        daily_image_channel_id: (row.daily_image_channel_id as string | null) ?? null,
        daily_image_urls: row.daily_image_urls,
        daily_image_index: (row.daily_image_index as number) ?? 0,
      }).catch((err) => console.error('[dailyImage] fire:', err));
    }
  } catch (err) {
    console.error('[dailyImage] tick:', err);
  }
}

export function startDailyImageScheduler(client: Client): void {
  setTimeout(() => {
    tick(client).catch(() => {});
    setInterval(() => tick(client).catch(() => {}), CHECK_INTERVAL_MS);
  }, 90_000);
  console.log('[dailyImage] gestartet — Tick pro Stunde');
}
