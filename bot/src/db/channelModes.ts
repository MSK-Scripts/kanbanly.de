import { getDb } from '../db.js';

export type ChannelMode = {
  mode: 'images_only' | 'text_only';
  allowVideos: boolean;
};

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: ChannelMode | null; expires: number }>();

export async function getChannelMode(
  guildId: string,
  channelId: string,
): Promise<ChannelMode | null> {
  const key = `${guildId}:${channelId}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expires > now) return cached.value;

  const db = getDb();
  const { data, error } = await db
    .from('bot_channel_modes')
    .select('mode, allow_videos')
    .eq('guild_id', guildId)
    .eq('channel_id', channelId)
    .maybeSingle();
  if (error) throw error;
  const value: ChannelMode | null = data
    ? {
        mode: data.mode as 'images_only' | 'text_only',
        allowVideos: Boolean(data.allow_videos),
      }
    : null;
  cache.set(key, { value, expires: now + CACHE_TTL_MS });
  return value;
}

export function invalidateChannelModeCache(guildId: string, channelId: string): void {
  cache.delete(`${guildId}:${channelId}`);
}
